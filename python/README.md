# amdy (Python)

Python SDK for the [AMDY Answering Machine Detection API](https://amdy.io/docs/api/reference).
Zero required dependencies (uses `urllib.request`); the WebSocket detection
helper needs the optional `websockets` extra.

## Install

```bash
pip install amdy            # REST client only
pip install "amdy[ws]"      # include WebSocket detection helper
```

## Quickstart

```python
from amdy import AmdyClient

client = AmdyClient(api_key="amd_live_...")  # defaults to https://amdy.io

# Liveness probe - no authentication required
print(client.health())

# Detection settings for this client (polled by detection nodes ~every 60s)
config = client.get_config()
print(config["clientId"], config["detectionSensitivity"], config["maxDetectionMs"])

# Client settings and registered source IPs
print(client.get_client_settings())
print(client.list_ips())

# Register the calling host's source IP (server infers it from the request)
print(client.register_ip())
```

Authentication sends `Authorization: Bearer <api_key>` by default. To use the
equivalent `X-API-Key` header instead:

```python
client = AmdyClient(api_key="amd_live_...", auth_scheme="api_key")
```

## Errors

All errors derive from `amdy.AmdyError`. HTTP failures raise
`AmdyApiError` (with `status_code`, `message`, and `body`), specialized as
`AmdyAuthError` (401) and `AmdyNotFoundError` (404). Network failures raise
`AmdyConnectionError`.

```python
from amdy import AmdyAuthError

try:
    client.get_config()
except AmdyAuthError as e:
    print(e.status_code, e.message)
```

## WebSocket detection

Per the API spec (`x-websocket`): connect to `wss://api.amdy.io:2700` and send
raw 8 kHz, 16-bit signed little-endian mono PCM in 320-sample (20 ms) frames.
The server replies with a JSON verdict carrying the detection result, audio
duration consumed, and a confidence score.

```python
from amdy import AmdyDetector

detector = AmdyDetector()          # requires pip install "amdy[ws]"
verdict = detector.detect(pcm_bytes)
print(verdict)
```

## Development

```bash
cd python
python3 -m pytest              # run the test suite
python3 -m build               # build sdist + wheel
```

## License

MIT
