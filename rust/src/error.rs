//! Error types for the AMDY client.

use std::fmt;

/// Errors returned by [`AmdyClient`](crate::AmdyClient) calls.
#[derive(Debug)]
pub enum AmdyError {
    /// The API returned a non-2xx response. `message` comes from the body's
    /// `error` field when present, otherwise the raw body text.
    Api {
        status: u16,
        message: String,
        body: Option<serde_json::Value>,
    },
    /// 401: missing or invalid API key.
    Auth {
        message: String,
        body: Option<serde_json::Value>,
    },
    /// 404: client not found for this API key.
    NotFound {
        message: String,
        body: Option<serde_json::Value>,
    },
    /// Request failed before a response arrived.
    Transport(String),
    /// Response body could not be parsed as JSON.
    Json(serde_json::Error),
}

impl AmdyError {
    /// HTTP status code, if the error came from a response.
    pub fn status(&self) -> Option<u16> {
        match self {
            AmdyError::Api { status, .. } => Some(*status),
            AmdyError::Auth { .. } => Some(401),
            AmdyError::NotFound { .. } => Some(404),
            _ => None,
        }
    }
}

impl fmt::Display for AmdyError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AmdyError::Api { status, message, .. } => {
                write!(f, "amdy api error ({}): {}", status, message)
            }
            AmdyError::Auth { message, .. } => {
                write!(f, "amdy auth error (401): {}", message)
            }
            AmdyError::NotFound { message, .. } => {
                write!(f, "amdy client not found (404): {}", message)
            }
            AmdyError::Transport(msg) => write!(f, "amdy transport error: {}", msg),
            AmdyError::Json(err) => write!(f, "amdy json error: {}", err),
        }
    }
}

impl std::error::Error for AmdyError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            AmdyError::Json(err) => Some(err),
            _ => None,
        }
    }
}

impl From<ureq::Error> for AmdyError {
    fn from(err: ureq::Error) -> Self {
        match err {
            ureq::Error::Status(code, resp) => {
                let status = code;
                let body: Option<serde_json::Value> = resp.into_string().ok().and_then(|text| {
                    serde_json::from_str(&text).ok().or(Some(serde_json::Value::String(text)))
                });
                let message = body
                    .as_ref()
                    .and_then(|v| v.get("error").and_then(|e| e.as_str()))
                    .map(|s| s.to_string())
                    .or_else(|| {
                        body.as_ref().and_then(|v| v.as_str().map(|s| s.to_string()))
                    })
                    .unwrap_or_else(|| "request failed".to_string());
                match status {
                    401 => AmdyError::Auth { message, body },
                    404 => AmdyError::NotFound { message, body },
                    _ => AmdyError::Api { status, message, body },
                }
            }
            ureq::Error::Transport(t) => AmdyError::Transport(t.to_string()),
        }
    }
}

impl From<serde_json::Error> for AmdyError {
    fn from(err: serde_json::Error) -> Self {
        AmdyError::Json(err)
    }
}

impl From<std::io::Error> for AmdyError {
    fn from(err: std::io::Error) -> Self {
        AmdyError::Transport(err.to_string())
    }
}
