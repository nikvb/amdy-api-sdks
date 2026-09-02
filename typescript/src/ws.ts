/**
 * Minimal WebSocket detection client for the AMDY detection stream.
 *
 * Per the OpenAPI spec's `x-websocket` extension:
 *   URL:    wss://api.amdy.io:2700
 *   Input:  raw 8 kHz 16-bit signed little-endian mono PCM, sent in
 *           320-sample (20 ms) frames.
 *   Reply:  a single JSON verdict carrying the detection result, the audio
 *           duration consumed, and a confidence score.
 *
 * Uses the global WebSocket available in Node >= 22, and falls back to the
 * `ws` package if it is installed. Zero hard runtime dependencies.
 */

/** A JSON verdict returned by the detection server. */
export interface AmdyVerdict {
  /** Detection result, e.g. "human" | "machine". */
  result: string;
  /** Audio duration consumed, in seconds. */
  duration: number;
  /** Confidence score. */
  confidence: number;
  [key: string]: unknown;
}

/** Number of samples per frame (20 ms at 8 kHz). */
export const FRAME_SAMPLES = 320;

/** Default detection endpoint from the spec. */
export const DEFAULT_WS_URL = "wss://api.amdy.io:2700";

export interface DetectOptions {
  /** Detection endpoint. Default: wss://api.amdy.io:2700 */
  url?: string;
  /** Milliseconds to wait for a verdict before giving up. Default: 30000. */
  timeoutMs?: number;
  /** WebSocket factory override (used by tests). */
  WebSocketImpl?: unknown;
}

/**
 * Encode 16-bit signed little-endian PCM samples into the wire format
 * expected by the stream (a Buffer is itself a valid frame).
 */
export function encodeFrame(samples: Int16Array): Buffer {
  if (samples.length === 0) {
    throw new Error("encodeFrame: empty sample buffer");
  }
  return Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
}

/** Split a PCM buffer into 320-sample (20 ms) frames. */
export function chunkFrames(pcm: Buffer): Buffer[] {
  const bytesPerFrame = FRAME_SAMPLES * 2;
  const frames: Buffer[] = [];
  for (let offset = 0; offset + bytesPerFrame <= pcm.length; offset += bytesPerFrame) {
    frames.push(pcm.subarray(offset, offset + bytesPerFrame));
  }
  return frames;
}

function loadWebSocket(override?: unknown): any {
  if (override) return override;
  const g = globalThis as any;
  if (typeof g.WebSocket === "function") return g.WebSocket;
  try {
    // Optional peer dependency; only needed on Node < 22.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("ws");
  } catch {
    throw new Error(
      "No WebSocket implementation available. Use Node >= 22 or install the 'ws' package."
    );
  }
}

/**
 * Stream PCM to the detection service and resolve with the JSON verdict.
 * Sends the audio in 320-sample frames and waits for one JSON reply.
 */
export function detect(pcm: Buffer, options: DetectOptions = {}): Promise<AmdyVerdict> {
  const WS = loadWebSocket(options.WebSocketImpl);
  const url = options.url ?? DEFAULT_WS_URL;
  const timeoutMs = options.timeoutMs ?? 30000;

  return new Promise<AmdyVerdict>((resolve, reject) => {
    const ws = new WS(url);
    const timer = setTimeout(() => {
      try { ws.close(); } catch { /* already closed */ }
      reject(new Error(`Detection timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    ws.onopen = () => {
      for (const frame of chunkFrames(pcm)) {
        ws.send(frame);
      }
    };

    ws.onmessage = (event: any) => {
      clearTimeout(timer);
      const raw = typeof event.data === "string" ? event.data : String(event.data);
      try {
        resolve(JSON.parse(raw) as AmdyVerdict);
      } catch (err) {
        reject(new Error(`Invalid verdict JSON: ${raw}`));
      } finally {
        try { ws.close(); } catch { /* already closed */ }
      }
    };

    ws.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Detection WebSocket error"));
    };

    ws.onclose = (event: any) => {
      // If we never resolved, the socket closed before a verdict arrived.
      clearTimeout(timer);
      reject(new Error(`Detection WebSocket closed before verdict (code ${event?.code ?? "unknown"})`));
    };
  });
}
