//! # amdy
//!
//! Rust SDK for the AMDY answering-machine-detection API.
//!
//! ```no_run
//! use amdy::AmdyClient;
//!
//! let client = AmdyClient::new("amd_live_...");
//! let health = client.health()?;
//! let config = client.config()?;
//! println!("client {} sensitivity {}", config.client_id, config.detection_sensitivity);
//! client.register_ip()?;
//! # Ok::<(), amdy::AmdyError>(())
//! ```
//!
//! API reference: <https://amdy.io/docs/api/reference>

mod client;
mod error;
mod models;

pub use client::{AmdyClient, DEFAULT_BASE_URL};
pub use error::AmdyError;
pub use models::DetectionConfig;
