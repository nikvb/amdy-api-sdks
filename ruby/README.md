# amdy (Ruby)

Ruby client for the AMDY AMD (Answering Machine Detection) API. No runtime
dependencies beyond the Ruby standard library.

## Installation

```bash
gem install amdy
```

Or in a Gemfile:

```ruby
gem "amdy"
```

Requires Ruby >= 2.6.

## Quickstart

```ruby
require "amdy"

client = Amdy::Client.new(api_key: "amd_live_...")  # base_url defaults to https://amdy.io

client.health            # liveness probe (no auth sent)
client.config            # {"clientId"=>1042, "detectionSensitivity"=>3, ...}
client.client_settings   # arbitrary settings JSON
client.ips               # registered source IPs
client.register_ip         # POST /api/v1/ips/register (no body; server infers the source IP)
```

Timeouts are configurable:

```ruby
client = Amdy::Client.new(api_key: "amd_live_...", open_timeout: 5, read_timeout: 15)
```

## Errors

All errors subclass `Amdy::Error`.

| Class | Raised when |
|---|---|
| `Amdy::ApiError` | any non-2xx response (has `status`, `message`, `body`) |
| `Amdy::AuthError` | 401, bad or missing API key |
| `Amdy::NotFoundError` | 404, client not found |
| `Amdy::ConnectionError` | network-level failure (DNS, refused connection, timeout) |

The error message is taken from the response body's `"error"` field when present.

## Authentication

Authed requests send `Authorization: Bearer <key>`. `#health` sends no auth header.

## Documentation

API reference: https://amdy.io/docs/api/reference

## Development

```bash
gem install webrick rake minitest
rake test
# or
ruby -Ilib -Itest test/all.rb
```

Tests run against a local WEBrick fixture; no network access to amdy.io is needed.

## License

MIT
