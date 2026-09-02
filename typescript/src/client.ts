/**
 * AMDY REST API client.
 *
 * Implements the endpoints documented in https://amdy.io/openapi.json:
 *   GET  /api/health
 *   GET  /api/v1/config
 *   GET  /api/v1/client-settings
 *   GET  /api/v1/ips
 *   POST /api/v1/ips/register
 *
 * Auth: `Authorization: Bearer <key>` by default, or `X-API-Key: <key>` when
 * `authStyle: "header"` is set. Zero runtime dependencies; requires Node >= 18
 * (global fetch).
 */

import { AmdyError, NotFoundError, UnauthorizedError } from "./errors";

export { AmdyError, NotFoundError, UnauthorizedError };

export const DEFAULT_BASE_URL = "https://amdy.io";

export type AuthStyle = "bearer" | "header";

export interface AmdyClientOptions {
  /** API key (`amd_live_...`). Required. */
  apiKey: string;
  /** Base URL of the AMDY API. Default: https://amdy.io */
  baseUrl?: string;
  /** How the API key is presented. Default: "bearer". */
  authStyle?: AuthStyle;
  /** Request timeout in milliseconds. Default: 15000. */
  timeoutMs?: number;
  /** Override fetch (used by tests). */
  fetchImpl?: typeof fetch;
}

/** GET /api/v1/config response (DetectionConfig schema). */
export interface DetectionConfig {
  clientId: number;
  detectionSensitivity: number;
  maxDetectionMs: number;
  updatedAt: string | null;
}

/** GET /api/health response. Unauthenticated liveness probe. */
export type Health = Record<string, unknown>;

/** GET /api/v1/client-settings response. */
export type ClientSettings = Record<string, unknown>;

/** GET /api/v1/ips response. */
export type IpsList = Record<string, unknown>;

/** POST /api/v1/ips/register response. */
export type RegisterIpResult = Record<string, unknown>;

interface RequestLogEntry {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: unknown;
}

/**
 * Wraps fetch so tests can inspect the exact request that was sent while the
 * public API of the client stays unchanged.
 */
export class AmdyClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly authStyle: AuthStyle;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  /** Captures the last request issued. Exported for test instrumentation. */
  lastRequest?: RequestLogEntry;

  constructor(options: AmdyClientOptions) {
    if (!options.apiKey) {
      throw new AmdyError("apiKey is required");
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.authStyle = options.authStyle ?? "bearer";
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /** GET /api/health — liveness probe, no authentication. */
  async health(): Promise<Health> {
    return this.request<Health>("GET", "/api/health", { auth: false });
  }

  /** GET /api/v1/config — detection tuning for this client. */
  async getConfig(): Promise<DetectionConfig> {
    return this.request<DetectionConfig>("GET", "/api/v1/config");
  }

  /** GET /api/v1/client-settings — settings for the presented key. */
  async getClientSettings(): Promise<ClientSettings> {
    return this.request<ClientSettings>("GET", "/api/v1/client-settings");
  }

  /** GET /api/v1/ips — source IPs permitted to reach the detection service. */
  async listIps(): Promise<IpsList> {
    return this.request<IpsList>("GET", "/api/v1/ips");
  }

  /** POST /api/v1/ips/register — register a source IP. */
  async registerIp(ip: string): Promise<RegisterIpResult> {
    return this.request<RegisterIpResult>("POST", "/api/v1/ips/register", {
      body: { ip },
    });
  }

  private authHeaders(): Record<string, string> {
    if (this.authStyle === "header") {
      return { "X-API-Key": this.apiKey };
    }
    return { Authorization: `Bearer ${this.apiKey}` };
  }

  private async request<T>(
    method: string,
    path: string,
    opts: { auth?: boolean; body?: unknown } = {}
  ): Promise<T> {
    const auth = opts.auth ?? true;
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(auth ? this.authHeaders() : {}),
    };
    let body: string | undefined;
    if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    this.lastRequest = { method, path, headers, body: opts.body };

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let message = `${method} ${path} failed with status ${res.status}`;
      try {
        const parsed = JSON.parse(text) as { error?: string };
        if (parsed && typeof parsed.error === "string") {
          message = parsed.error;
        }
      } catch {
        if (text) message = text;
      }
      if (res.status === 401) throw new UnauthorizedError(message);
      if (res.status === 404) throw new NotFoundError(message);
      throw new AmdyError(message, res.status);
    }

    return (await res.json()) as T;
  }
}
