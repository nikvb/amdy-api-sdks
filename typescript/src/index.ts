/**
 * amdy — TypeScript SDK for the AMDY Answering Machine Detection API.
 *
 * Docs: https://amdy.io/docs/api/reference
 * Spec: https://amdy.io/openapi.json
 */

export {
  AmdyClient,
  DEFAULT_BASE_URL,
  type AmdyClientOptions,
  type AuthStyle,
  type DetectionConfig,
  type Health,
  type ClientSettings,
  type IpsList,
  type RegisterIpResult,
} from "./client";

export {
  detect,
  encodeFrame,
  chunkFrames,
  FRAME_SAMPLES,
  DEFAULT_WS_URL,
  type AmdyVerdict,
  type DetectOptions,
} from "./ws";

export { AmdyError, UnauthorizedError, NotFoundError } from "./errors";
