import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { AmdyClient, UnauthorizedError, NotFoundError, AmdyError } from "../src/client";

/** Start a local HTTP fixture server; returns base URL and captured requests. */
async function startFixture(
  handler: (req: IncomingMessage, res: ServerResponse, body: string) => void
) {
  const requests: { method: string; url: string; headers: any; body: string }[] = [];
  const server = createServer((req, res) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      requests.push({ method: req.method!, url: req.url!, headers: req.headers, body: data });
      handler(req, res, data);
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

const KEY = "amd_live_testkey123";

test("health() GETs /api/health with no auth header", async () => {
  const fx = await startFixture((req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ status: "ok" }));
  });
  try {
    const client = new AmdyClient({ apiKey: KEY, baseUrl: fx.baseUrl });
    const health = await client.health();
    assert.deepEqual(health, { status: "ok" });
    const r = fx.requests[0];
    assert.equal(r.method, "GET");
    assert.equal(r.url, "/api/health");
    assert.equal(r.headers.authorization, undefined);
    assert.equal(r.headers["x-api-key"], undefined);
  } finally {
    await fx.close();
  }
});

test("getConfig() sends Authorization: Bearer by default", async () => {
  const fx = await startFixture((req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        clientId: 1042,
        detectionSensitivity: 3,
        maxDetectionMs: 8000,
        updatedAt: "2026-08-28T14:02:11.000Z",
      })
    );
  });
  try {
    const client = new AmdyClient({ apiKey: KEY, baseUrl: fx.baseUrl });
    const cfg = await client.getConfig();
    assert.equal(cfg.clientId, 1042);
    assert.equal(cfg.detectionSensitivity, 3);
    assert.equal(cfg.maxDetectionMs, 8000);
    const r = fx.requests[0];
    assert.equal(r.method, "GET");
    assert.equal(r.url, "/api/v1/config");
    assert.equal(r.headers.authorization, `Bearer ${KEY}`);
  } finally {
    await fx.close();
  }
});

test("authStyle header sends X-API-Key instead of Authorization", async () => {
  const fx = await startFixture((req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true }));
  });
  try {
    const client = new AmdyClient({ apiKey: KEY, baseUrl: fx.baseUrl, authStyle: "header" });
    await client.listIps();
    const r = fx.requests[0];
    assert.equal(r.url, "/api/v1/ips");
    assert.equal(r.headers["x-api-key"], KEY);
    assert.equal(r.headers.authorization, undefined);
  } finally {
    await fx.close();
  }
});

test("registerIp() POSTs to the right path with no request body", async () => {
  const fx = await startFixture((req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ registered: true }));
  });
  try {
    const client = new AmdyClient({ apiKey: KEY, baseUrl: fx.baseUrl });
    const result = await client.registerIp();
    assert.deepEqual(result, { registered: true });
    const r = fx.requests[0];
    assert.equal(r.method, "POST");
    assert.equal(r.url, "/api/v1/ips/register");
    assert.equal(r.headers["content-type"], undefined);
    assert.equal(r.body, "");
  } finally {
    await fx.close();
  }
});

test("401 maps to UnauthorizedError with server message", async () => {
  const fx = await startFixture((req, res) => {
    res.statusCode = 401;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "Missing Authorization: Bearer <api_key>" }));
  });
  try {
    const client = new AmdyClient({ apiKey: KEY, baseUrl: fx.baseUrl });
    await assert.rejects(client.getClientSettings(), (err: unknown) => {
      assert.ok(err instanceof UnauthorizedError);
      assert.equal((err as UnauthorizedError).message, "Missing Authorization: Bearer <api_key>");
      assert.equal((err as UnauthorizedError).status, 401);
      return true;
    });
  } finally {
    await fx.close();
  }
});

test("404 maps to NotFoundError", async () => {
  const fx = await startFixture((req, res) => {
    res.statusCode = 404;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "Client not found" }));
  });
  try {
    const client = new AmdyClient({ apiKey: KEY, baseUrl: fx.baseUrl });
    await assert.rejects(client.getConfig(), (err: unknown) => {
      assert.ok(err instanceof NotFoundError);
      assert.equal((err as NotFoundError).status, 404);
      return true;
    });
  } finally {
    await fx.close();
  }
});

test("other error statuses map to AmdyError with status", async () => {
  const fx = await startFixture((req, res) => {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "boom" }));
  });
  try {
    const client = new AmdyClient({ apiKey: KEY, baseUrl: fx.baseUrl });
    await assert.rejects(client.listIps(), (err: unknown) => {
      assert.ok(err instanceof AmdyError);
      assert.equal((err as AmdyError).status, 500);
      assert.equal((err as AmdyError).message, "boom");
      return true;
    });
  } finally {
    await fx.close();
  }
});

test("missing apiKey is rejected at construction", () => {
  assert.throws(() => new AmdyClient({ apiKey: "" }), AmdyError);
});

test("trailing slashes in baseUrl are normalized", async () => {
  const fx = await startFixture((req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({}));
  });
  try {
    const client = new AmdyClient({ apiKey: KEY, baseUrl: `${fx.baseUrl}/` });
    await client.health();
    assert.equal(fx.requests[0].url, "/api/health");
  } finally {
    await fx.close();
  }
});
