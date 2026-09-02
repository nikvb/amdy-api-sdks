# amdy (TypeScript)

TypeScript/Node SDK for the [AMDY Answering Machine Detection API](https://amdy.io/docs/api/reference).

Zero runtime dependencies. Requires Node >= 18 (global `fetch`); the WebSocket
client needs Node >= 22 or the optional `ws` package.

## Install

```bash
npm install amdy
```

## Quickstart

```typescript
import { AmdyClient } from "amdy";

const client = new AmdyClient({
  apiKey: process.env.AMDY_API_KEY!, // amd_live_...
});

// Unauthenticated liveness probe
await client.health();

// Detection tuning for this client (poll every ~60s if you run your own nodes)
const config = await client.getConfig();
// { clientId: 1042, detectionSensitivity: 3, maxDetectionMs: 8000, ... }

// Settings for the presented key
await client.getClientSettings();

// Provision the source IPs allowed to reach the detection service
await client.listIps();
// The spec defines no request body; the server infers the IP from the originating request.
await client.registerIp();
```

### Authentication

By default the key is sent as `Authorization: Bearer amd_live_...`. To send it
as `X-API-Key: <key>` instead:

```typescript
const client = new AmdyClient({ apiKey: key, authStyle: "header" });
```

### Errors

`AmdyError` is the base class. A 401 raises `UnauthorizedError`, a 404 raises
`NotFoundError`; both expose the server's `error` message and the HTTP status.

## Streaming detection (WebSocket)

Detection runs over `wss://api.amdy.io:2700`. Send raw 8 kHz 16-bit signed
little-endian mono PCM in 320-sample (20 ms) frames; the server replies with a
JSON verdict (result, duration, confidence).

```typescript
import { detect } from "amdy";

const pcm: Buffer = get8kPcmAudio(); // 16-bit LE mono
const verdict = await detect(pcm);
console.log(verdict.result, verdict.duration, verdict.confidence);
```

On Node < 22, install `ws` (`npm install ws`) and the client picks it up
automatically.

## Documentation

- API reference: https://amdy.io/docs/api/reference
- Streaming docs: https://amdy.io/docs/api/streaming
- OpenAPI spec: https://amdy.io/openapi.json

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # node:test suite against a local HTTP fixture
```

## License

MIT
