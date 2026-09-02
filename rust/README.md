# amdy (Rust SDK)

Rust client for the [AMDY](https://amdy.io) answering-machine-detection API.
Synchronous, built on `ureq` and `serde` — no async runtime, minimal
dependencies.

## Install

```toml
[dependencies]
amdy = "0.1"
```

or:

```bash
cargo add amdy
```

## Quickstart

```rust
use amdy::{AmdyClient, AmdyError};

fn main() -> Result<(), AmdyError> {
    let client = AmdyClient::new("amd_live_...");

    // Liveness probe — no auth sent.
    let health = client.health()?;

    // Typed detection configuration.
    let config = client.config()?;
    println!("client {} sensitivity {}", config.client_id, config.detection_sensitivity);

    // Arbitrary JSON payloads.
    let settings = client.client_settings()?;
    let ips = client.ips()?;

    // Register a source IP.
    client.register_ip()?;

    Ok(())
}
```

Base URL defaults to `https://amdy.io`; override with `.base_url(...)`
for tests or proxies:

```rust
let client = AmdyClient::new("amd_live_...").base_url("http://127.0.0.1:8080");
```

## Errors

All methods return `Result<_, AmdyError>`:

- `AmdyError::Auth` — 401, bad or missing key
- `AmdyError::NotFound` — 404, client not found
- `AmdyError::Api` — any other non-2xx status (carries status, message, body)
- `AmdyError::Transport` — request failed before a response
- `AmdyError::Json` — response body was not valid JSON

The `message` comes from the body's `error` field when the server provides it.

## API reference

https://amdy.io/docs/api/reference

## License

MIT
