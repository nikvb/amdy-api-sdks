//! Integration tests against a hand-rolled local HTTP fixture.

use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::thread;

use amdy::{AmdyClient, AmdyError};
use serde_json::{json, Value};

#[derive(Default)]
struct CapturedRequest {
    method: String,
    path: String,
    authorization: String,
    body: String,
}

type RouteMap = Vec<((String, String), (u16, Value))>;

struct Fixture {
    url: String,
    captured: Arc<Mutex<CapturedRequest>>,
}

fn serve(routes: RouteMap) -> Fixture {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
    let addr = listener.local_addr().expect("addr");
    let captured = Arc::new(Mutex::new(CapturedRequest::default()));
    let captured_clone = Arc::clone(&captured);

    thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            let captured = Arc::clone(&captured_clone);
            let routes = routes.clone();
            thread::spawn(move || handle_conn(stream, &routes, &captured));
        }
    });

    Fixture {
        url: format!("http://{}", addr),
        captured,
    }
}

fn handle_conn(mut stream: TcpStream, routes: &RouteMap, captured: &Mutex<CapturedRequest>) {
    let mut reader = BufReader::new(match stream.try_clone() {
        Ok(s) => s,
        Err(_) => return,
    });

    let mut request_line = String::new();
    if reader.read_line(&mut request_line).is_err() {
        return;
    }
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or("").to_string();
    let path = parts.next().unwrap_or("").to_string();

    let mut content_length = 0usize;
    loop {
        let mut line = String::new();
        match reader.read_line(&mut line) {
            Ok(0) => break,
            Ok(_) if line.trim().is_empty() => break,
            Ok(_) => {
                let lower = line.to_ascii_lowercase();
                if lower.starts_with("authorization:") {
                    captured.lock().unwrap().authorization =
                        line.split_once(':').unwrap().1.trim().to_string();
                } else if let Some(rest) = lower.strip_prefix("content-length:") {
                    content_length = rest.trim().parse().unwrap_or(0);
                }
            }
            Err(_) => return,
        }
    }

    let mut body = vec![0u8; content_length];
    if content_length > 0 {
        if reader.read_exact(&mut body).is_err() {
            return;
        }
    }

    {
        let mut cap = captured.lock().unwrap();
        cap.method = method.clone();
        cap.path = path.clone();
        cap.body = String::from_utf8_lossy(&body).to_string();
    }

    let (status, body_json) = routes
        .iter()
        .find(|((m, p), _)| *m == method && *p == path)
        .map(|(_, resp)| resp.clone())
        .unwrap_or((404, json!({"error": "fixture: no route"})));

    let body_text = body_json.to_string();
    let reason = match status {
        200 => "OK",
        401 => "Unauthorized",
        404 => "Not Found",
        _ => "Internal Server Error",
    };
    let response = format!(
        "HTTP/1.1 {} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        status,
        reason,
        body_text.len(),
        body_text
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

impl Fixture {
    fn client(&self) -> AmdyClient {
        AmdyClient::new("amd_live_test_key").base_url(&self.url)
    }

    fn request(&self) -> CapturedRequest {
        self.captured.lock().unwrap().clone()
    }
}

impl Clone for CapturedRequest {
    fn clone(&self) -> Self {
        Self {
            method: self.method.clone(),
            path: self.path.clone(),
            authorization: self.authorization.clone(),
            body: self.body.clone(),
        }
    }
}

fn route(method: &str, path: &str, status: u16, body: Value) -> ((String, String), (u16, Value)) {
    ((method.to_string(), path.to_string()), (status, body))
}

#[test]
fn health_sends_no_auth_header() {
    let fx = serve(vec![route("GET", "/api/health", 200, json!({"ok": true}))]);
    let result = fx.client().health().unwrap();
    assert_eq!(result, json!({"ok": true}));

    let req = fx.request();
    assert_eq!(req.method, "GET");
    assert_eq!(req.path, "/api/health");
    assert_eq!(req.authorization, "", "health must not send Authorization");
}

#[test]
fn config_deserializes_camel_case_fields() {
    let fx = serve(vec![route(
        "GET",
        "/api/v1/config",
        200,
        json!({
            "clientId": 1042,
            "detectionSensitivity": 3,
            "maxDetectionMs": 8000,
            "updatedAt": "2026-08-28T14:02:11.000Z"
        }),
    )]);
    let config = fx.client().config().unwrap();
    assert_eq!(config.client_id, 1042);
    assert_eq!(config.detection_sensitivity, 3);
    assert_eq!(config.max_detection_ms, 8000);
    assert_eq!(config.updated_at.as_deref(), Some("2026-08-28T14:02:11.000Z"));

    let req = fx.request();
    assert_eq!(req.authorization, "Bearer amd_live_test_key");
}

#[test]
fn config_null_updated_at_is_none() {
    let fx = serve(vec![route(
        "GET",
        "/api/v1/config",
        200,
        json!({
            "clientId": 1,
            "detectionSensitivity": 5,
            "maxDetectionMs": 8000,
            "updatedAt": null
        }),
    )]);
    let config = fx.client().config().unwrap();
    assert_eq!(config.updated_at, None);
}

#[test]
fn client_settings_passes_through() {
    let payload = json!({"theme": "dark", "features": {"amd": true}, "nested": [1, 2, 3]});
    let fx = serve(vec![route("GET", "/api/v1/client-settings", 200, payload.clone())]);
    let result = fx.client().client_settings().unwrap();
    assert_eq!(result, payload);
}

#[test]
fn ips_passes_through() {
    let payload = json!({"ips": ["203.0.113.10", "198.51.100.7"]});
    let fx = serve(vec![route("GET", "/api/v1/ips", 200, payload.clone())]);
    let result = fx.client().ips().unwrap();
    assert_eq!(result, payload);
}

#[test]
fn register_ip_sends_post_with_json_body() {
    let fx = serve(vec![route(
        "POST",
        "/api/v1/ips/register",
        200,
        json!({"ip": "203.0.113.10", "status": "registered"}),
    )]);
    let result = fx.client().register_ip("203.0.113.10").unwrap();
    assert_eq!(result, json!({"ip": "203.0.113.10", "status": "registered"}));

    let req = fx.request();
    assert_eq!(req.method, "POST");
    assert_eq!(req.path, "/api/v1/ips/register");
    assert_eq!(req.body, r#"{"ip":"203.0.113.10"}"#);
    assert_eq!(req.authorization, "Bearer amd_live_test_key");
}

#[test]
fn unauthorized_becomes_auth_error_with_server_message() {
    let fx = serve(vec![route(
        "GET",
        "/api/v1/config",
        401,
        json!({"error": "Invalid API key"}),
    )]);
    let err = fx.client().config().unwrap_err();
    match &err {
        AmdyError::Auth { message, body } => {
            assert_eq!(message, "Invalid API key");
            assert_eq!(body.as_ref(), Some(&json!({"error": "Invalid API key"})));
        }
        other => panic!("expected Auth error, got {:?}", other),
    }
    assert_eq!(err.status(), Some(401));
    assert!(err.to_string().contains("Invalid API key"));
}

#[test]
fn not_found_becomes_not_found_error() {
    let fx = serve(vec![route(
        "GET",
        "/api/v1/config",
        404,
        json!({"error": "Client not found"}),
    )]);
    let err = fx.client().config().unwrap_err();
    match &err {
        AmdyError::NotFound { message, .. } => assert_eq!(message, "Client not found"),
        other => panic!("expected NotFound error, got {:?}", other),
    }
    assert_eq!(err.status(), Some(404));
}

#[test]
fn other_error_status_becomes_api_error() {
    let fx = serve(vec![route(
        "GET",
        "/api/v1/client-settings",
        500,
        json!({"error": "internal failure"}),
    )]);
    let err = fx.client().client_settings().unwrap_err();
    match &err {
        AmdyError::Api { status, message, body } => {
            assert_eq!(*status, 500);
            assert_eq!(message, "internal failure");
            assert!(body.is_some());
        }
        other => panic!("expected Api error, got {:?}", other),
    }
}
