//! Typed models returned by the AMDY API.

use serde::Deserialize;

/// Detection configuration for a client, from `GET /api/v1/config`.
#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DetectionConfig {
    pub client_id: i64,
    pub detection_sensitivity: i64,
    pub max_detection_ms: i64,
    pub updated_at: Option<String>,
}
