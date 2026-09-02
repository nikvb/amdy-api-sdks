"""Exceptions raised by the AMDY SDK."""

from __future__ import annotations

from typing import Any, Optional


class AmdyError(Exception):
    """Base class for all AMDY SDK errors."""


class AmdyApiError(AmdyError):
    """The API returned a non-2xx response.

    Attributes:
        status_code: HTTP status code of the response.
        message: Human-readable reason from the response body (``error`` field)
            when present, otherwise a generic description.
        body: The parsed JSON body when available.
    """

    def __init__(self, status_code: int, message: str, body: Optional[Any] = None) -> None:
        super().__init__(f"[{status_code}] {message}")
        self.status_code = status_code
        self.message = message
        self.body = body


class AmdyAuthError(AmdyApiError):
    """The API key was missing, invalid, or inactive (HTTP 401)."""


class AmdyNotFoundError(AmdyApiError):
    """No client matches the presented key (HTTP 404)."""


class AmdyConnectionError(AmdyError):
    """A network-level failure occurred while contacting the API."""
