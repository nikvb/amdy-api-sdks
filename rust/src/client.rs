//! HTTP client for the AMDY API.

use serde_json::{json, Value};

use crate::error::AmdyError;
use crate::models::DetectionConfig;

/// Default base URL for the AMDY API.
pub const DEFAULT_BASE_URL: &str = "https://amdy.io";

/// Client for the AMDY API. Cheap to clone; each call opens its own
/// connection.
#[derive(Debug, Clone)]
pub struct AmdyClient {
    api_key: String,
    base_url: String,
}

impl AmdyClient {
    /// Create a client using the default base URL (`https://amdy.io`).
    pub fn new(api_key: impl Into<String>) -> Self {
        Self {
            api_key: api_key.into(),
            base_url: DEFAULT_BASE_URL.to_string(),
        }
    }

    /// Override the base URL (e.g. for testing or a proxy).
    pub fn base_url(mut self, url: impl Into<String>) -> Self {
        self.base_url = url.into().trim_end_matches('/').to_string();
        self
    }

    /// `GET /api/health` — liveness probe. No authentication is sent.
    pub fn health(&self) -> Result<Value, AmdyError> {
        self.request_json("GET", "/api/health", false, None)
    }

    /// `GET /api/v1/config` — typed detection configuration.
    pub fn config(&self) -> Result<DetectionConfig, AmdyError> {
        let value = self.request_json("GET", "/api/v1/config", true, None)?;
        serde_json::from_value(value).map_err(Into::into)
    }

    /// `GET /api/v1/client-settings` — arbitrary settings object.
    pub fn client_settings(&self) -> Result<Value, AmdyError> {
        self.request_json("GET", "/api/v1/client-settings", true, None)
    }

    /// `GET /api/v1/ips` — registered source IPs.
    pub fn ips(&self) -> Result<Value, AmdyError> {
        self.request_json("GET", "/api/v1/ips", true, None)
    }

    /// `POST /api/v1/ips/register` — register a source IP.
    pub fn register_ip(&self, ip: &str) -> Result<Value, AmdyError> {
        self.request_json("POST", "/api/v1/ips/register", true, Some(json!({ "ip": ip })))
    }

    fn request_json(
        &self,
        method: &str,
        path: &str,
        auth: bool,
        body: Option<Value>,
    ) -> Result<Value, AmdyError> {
        let url = format!("{}{}", self.base_url, path);
        let mut req = match method {
            "POST" => ureq::post(&url),
            _ => ureq::get(&url),
        };
        if auth {
            req = req.set("Authorization", &format!("Bearer {}", self.api_key));
        }
        let resp = match body {
            Some(payload) => req.send_json(payload)?,
            None => req.call()?,
        };
        resp.into_json::<Value>().map_err(Into::into)
    }
}
