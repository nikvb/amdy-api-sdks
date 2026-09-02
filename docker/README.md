# amdy-cli Docker image

A dependency-free CLI (`amdy-cli.js`, Node >= 20 global fetch, zero npm packages)
for the [AMDY Answering Machine Detection API](https://amdy.io/docs/api/reference).

## Build

```bash
docker build -t amdy-cli:0.1.0 docker/
```

## Run

All commands talk to `https://amdy.io` by default. Override with
`--base-url <url>` or the `AMDY_BASE_URL` env var.

Health check (no authentication required):

```bash
docker run --rm amdy-cli:0.1.0 health
```

Authenticated commands need an API key (`amd_live_...`). Pass it with
`--api-key` or the `AMDY_API_KEY` env variable. Never bake a key into the
image; pass it at runtime:

```bash
# Detection settings for the authenticated client
docker run --rm -e AMDY_API_KEY="amd_live_..." amdy-cli:0.1.0 get-config

# Client settings
docker run --rm -e AMDY_API_KEY="amd_live_..." amdy-cli:0.1.0 get-client-settings

# List registered source IPs
docker run --rm -e AMDY_API_KEY="amd_live_..." amdy-cli:0.1.0 list-ips

# Register the calling host's IP so its traffic is accepted by the detection service
docker run --rm -e AMDY_API_KEY="amd_live_..." amdy-cli:0.1.0 register-ip
```

Or with an explicit base URL:

```bash
docker run --rm amdy-cli:0.1.0 --base-url https://amdy.io health
```

## Commands

| Command | Endpoint | Auth |
|---|---|---|
| `health` | `GET /api/health` | none |
| `get-config` | `GET /api/v1/config` | Bearer / X-API-Key |
| `get-client-settings` | `GET /api/v1/client-settings` | Bearer / X-API-Key |
| `list-ips` | `GET /api/v1/ips` | Bearer / X-API-Key |
| `register-ip` | `POST /api/v1/ips/register` | Bearer / X-API-Key |

Any command without an API key exits with code 2 and an error message.
Non-2xx responses exit with code 1 and print the API error body.

## Documentation

- API reference: https://amdy.io/docs/api/reference
- Streaming (WebSocket) docs: https://amdy.io/docs/api/streaming
