/**
 * Error types for the AMDY API client.
 */

/** Base error carrying the HTTP status when the failure came from a response. */
export class AmdyError extends Error {
  /** HTTP status code, when the error originated from a response. */
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "AmdyError";
    this.status = status;
  }
}

/** Thrown when the server responds 401 (missing, invalid, or inactive API key). */
export class UnauthorizedError extends AmdyError {
  constructor(message: string) {
    super(message, 401);
    this.name = "UnauthorizedError";
  }
}

/** Thrown when the server responds 404 (no client matches the presented key). */
export class NotFoundError extends AmdyError {
  constructor(message: string) {
    super(message, 404);
    this.name = "NotFoundError";
  }
}
