# AMDY API SDKs

Official client SDKs for the [AMDY Answering Machine Detection API](https://amdy.io/docs/api/reference).

AMDY tells an outbound dialer whether a live person or a voicemail system answered a call, in time to act on it. The REST control surface (config, client settings, IP provisioning) is documented in the [OpenAPI spec](https://amdy.io/openapi.json); detection itself streams 8 kHz 16-bit PCM over a WebSocket (see the [streaming guide](https://amdy.io/docs/api/streaming)).

## Packages

| Language | Directory | Registry |
|---|---|---|
| TypeScript / Node | [`typescript/`](./typescript) | npm: `amdy` |
| Python | [`python/`](./python) | PyPI: `amdy` |
| C# (.NET) | [`csharp/`](./csharp) | NuGet: `Amdy.Client` |
| Ruby | [`ruby/`](./ruby) | RubyGems: `amdy` |
| Rust | [`rust/`](./rust) | crates.io: `amdy` |

## Coverage

- `GET /api/health` — service liveness
- `GET /api/v1/config` — detection settings for the authenticated client
- `GET /api/v1/client-settings` — settings for the presented API key
- `GET /api/v1/ips` — list registered source IPs
- `POST /api/v1/ips/register` — register a source IP

Auth: `Authorization: Bearer amd_live_...` or `X-API-Key` header.

## License

MIT
