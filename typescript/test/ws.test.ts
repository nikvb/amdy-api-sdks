import { test } from "node:test";
import assert from "node:assert/strict";
import { detect, chunkFrames, encodeFrame, FRAME_SAMPLES } from "../src/ws";

/** Minimal fake WebSocket that records sent frames and replies with a verdict. */
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static READY = 1;
  url: string;
  sent: Buffer[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  verdict: unknown;
  binary = true;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: Buffer) {
    this.sent.push(Buffer.from(data));
  }

  close() {}

  // Test helpers
  open() {
    this.onopen?.();
  }

  reply(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}

test("detect() opens the spec URL and sends 320-sample frames", async () => {
  FakeWebSocket.instances = [];
  // 2.5 frames worth: only full frames are sent (2 frames).
  const pcm = Buffer.alloc(FRAME_SAMPLES * 2 * 2 + 100, 0);

  const pending = detect(pcm, {
    url: "wss://api.amdy.io:2700",
    WebSocketImpl: FakeWebSocket,
  });

  const ws = FakeWebSocket.instances[0];
  assert.equal(ws.url, "wss://api.amdy.io:2700");
  ws.open();
  assert.equal(ws.sent.length, 2);
  for (const frame of ws.sent) {
    assert.equal(frame.length, FRAME_SAMPLES * 2); // 16-bit LE
  }

  ws.reply({ result: "machine", duration: 0.6, confidence: 0.93 });
  const verdict = await pending;
  assert.equal(verdict.result, "machine");
  assert.equal(verdict.confidence, 0.93);
});

test("chunkFrames() splits on 320-sample boundaries and drops partials", () => {
  const pcm = Buffer.alloc(FRAME_SAMPLES * 3 * 2 + 10, 0);
  const frames = chunkFrames(pcm);
  assert.equal(frames.length, 3);
  for (const f of frames) assert.equal(f.length, FRAME_SAMPLES * 2);
});

test("encodeFrame() preserves 16-bit little-endian bytes", () => {
  const samples = new Int16Array([1, -1, 32767, -32768]);
  const buf = encodeFrame(samples);
  assert.deepEqual([...buf], [...Buffer.from([0x01, 0x00, 0xff, 0xff, 0xff, 0x7f, 0x00, 0x80])]);
});

test("detect() rejects if the socket errors before a verdict", async () => {
  FakeWebSocket.instances = [];
  const pending = detect(Buffer.alloc(FRAME_SAMPLES * 2), {
    WebSocketImpl: FakeWebSocket,
  });
  const ws = FakeWebSocket.instances[0];
  ws.open();
  ws.onerror?.();
  await assert.rejects(pending, /WebSocket error/);
});
