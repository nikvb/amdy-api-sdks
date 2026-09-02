"""Synchronous AMDY API client built on urllib.request (no dependencies)."""

from __future__ import annotations

import json
import ssl
import urllib.error
import urllib.request
from typing import Any, Dict, Optional

from .exceptions import (
    AmdyApiError,
    AmdyAuthError,
    AmdyConnectionError,
    AmdyNotFoundError,
)

DEFAULT_BASE_URL = "https://amdy.io"
DEFAULT_TIMEOUT = 30.0


class AmdyClient:
    """Client for the AMDY Answering Machine Detection REST API.

    Authentication uses one of the two forms documented by the API:
    ``Authorization: Bearer <api_key>`` or ``X-API-Key: <api_key>``.
    Choose the header via ``auth_scheme`` (default: ``"bearer"``).

    Args:
        api_key: API key beginning with ``amd_live_``.
        base_url: API base URL. Defaults to ``https://amdy.io``.
        timeout: Request timeout in seconds.
        auth_scheme: ``"bearer"`` or ``"api_key"``.
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
        auth_scheme: str = "bearer",
    ) -> None:
        if not api_key:
            raise ValueError("api_key is required")
        if auth_scheme not in ("bearer", "api_key"):
            raise ValueError("auth_scheme must be 'bearer' or 'api_key'")
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.auth_scheme = auth_scheme
        self._ssl_context = ssl.create_default_context()

    # -- public endpoints ---------------------------------------------------

    def health(self) -> Dict[str, Any]:
        """GET /api/health - liveness probe, requires no authentication."""
        return self._request("GET", "/api/health", auth=False)

    def get_config(self) -> Dict[str, Any]:
        """GET /api/v1/config - detection settings for the authenticated client.

        Returns an object with ``clientId``, ``detectionSensitivity``,
        ``maxDetectionMs`` and optionally ``updatedAt``.
        """
        return self._request("GET", "/api/v1/config")

    def get_client_settings(self) -> Dict[str, Any]:
        """GET /api/v1/client-settings - settings for the presented API key."""
        return self._request("GET", "/api/v1/client-settings")

    def list_ips(self) -> Dict[str, Any]:
        """GET /api/v1/ips - source IPs permitted to reach the detection service."""
        return self._request("GET", "/api/v1/ips")

    def register_ip(self) -> Dict[str, Any]:
        """POST /api/v1/ips/register - register the calling host's source IP.

        The API documents no request body; the source IP is inferred by the
        server from the originating request.
        """
        return self._request("POST", "/api/v1/ips/register")

    # -- internals ----------------------------------------------------------

    def _auth_headers(self) -> Dict[str, str]:
        if self.auth_scheme == "bearer":
            return {"Authorization": f"Bearer {self.api_key}"}
        return {"X-API-Key": self.api_key}

    def _request(self, method: str, path: str, auth: bool = True) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        headers = {"Accept": "application/json"}
        if auth:
            headers.update(self._auth_headers())
        req = urllib.request.Request(url, data=None, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout, context=self._ssl_context) as resp:
                raw = resp.read()
        except urllib.error.HTTPError as exc:
            raw = exc.read()
            body: Optional[Any] = None
            message = exc.reason if isinstance(exc.reason, str) else "request failed"
            try:
                body = json.loads(raw.decode("utf-8"))
                if isinstance(body, dict) and "error" in body:
                    message = str(body["error"])
            except (ValueError, UnicodeDecodeError):
                pass
            if exc.code == 401:
                raise AmdyAuthError(exc.code, message, body) from None
            if exc.code == 404:
                raise AmdyNotFoundError(exc.code, message, body) from None
            raise AmdyApiError(exc.code, message, body) from None
        except (urllib.error.URLError, OSError) as exc:
            raise AmdyConnectionError(f"request to {url} failed: {exc}") from exc
        try:
            return json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            raise AmdyApiError(200, "response was not valid JSON") from None
