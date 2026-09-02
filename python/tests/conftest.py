"""Shared test fixtures: a local threaded http.server standing in for the API."""

from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from amdy import AmdyClient

API_KEY = "amd_live_test_key_12345"


class FakeApiHandler(BaseHTTPRequestHandler):
    """Implements the endpoints from https://amdy.io/openapi.json."""

    # test state, populated by fixtures
    auth_mode = "valid"  # valid | missing | invalid | not_found
    last_request = {}

    def _respond(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _check_auth(self):
        """Return (status, payload) for the auth outcome configured per test."""
        mode = type(self).auth_mode
        auth = self.headers.get("Authorization")
        key = self.headers.get("X-API-Key")
        has_bearer = auth == f"Bearer {API_KEY}"
        has_header = key == API_KEY
        if mode == "missing" and not auth and not key:
            return 401, {"error": "Missing Authorization: Bearer <api_key>"}
        if mode == "invalid":
            return 401, {"error": "Invalid or inactive API key"}
        if mode == "not_found":
            return 404, {"error": "Client not found"}
        if mode == "valid" and (has_bearer or has_header):
            return None, None
        return 401, {"error": "Missing Authorization: Bearer <api_key>"}

    def _record(self):
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b""
        type(self).last_request.clear()
        type(self).last_request.update({
            "method": self.command,
            "path": self.path,
            "headers": {k.lower(): v for k, v in self.headers.items()},
            "body": raw,
        })

    def do_GET(self):
        self._record()
        # /api/health requires no authentication per the spec
        if self.path == "/api/health":
            self._respond(200, {"status": "ok"})
            return
        status, payload = self._check_auth()
        if status:
            self._respond(status, payload)
            return
        if self.path == "/api/v1/config":
            self._respond(200, {
                "clientId": 1042,
                "detectionSensitivity": 3,
                "maxDetectionMs": 8000,
                "updatedAt": "2026-08-28T14:02:11.000Z",
            })
        elif self.path == "/api/v1/client-settings":
            self._respond(200, {"clientId": 1042, "settings": {"autoRegisterIps": True}})
        elif self.path == "/api/v1/ips":
            self._respond(200, {"ips": ["203.0.113.10"]})
        else:
            self._respond(404, {"error": "Not found"})

    def do_POST(self):
        self._record()
        status, payload = self._check_auth()
        if status:
            self._respond(status, payload)
            return
        if self.path == "/api/v1/ips/register":
            self._respond(200, {"registered": "203.0.113.10"})
        else:
            self._respond(404, {"error": "Not found"})

    def log_message(self, *args):  # silence test output
        pass


@pytest.fixture()
def api_server():
    """Yield (base_url, handler class); reset per-test state."""
    server = ThreadingHTTPServer(("127.0.0.1", 0), FakeApiHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    FakeApiHandler.auth_mode = "valid"
    FakeApiHandler.last_request = {}
    yield f"http://127.0.0.1:{server.server_address[1]}", FakeApiHandler
    server.shutdown()
    server.server_close()


@pytest.fixture()
def client(api_server):
    base_url, _ = api_server
    return AmdyClient(api_key=API_KEY, base_url=base_url, auth_scheme="bearer")


@pytest.fixture()
def last_request(api_server):
    _, handler = api_server
    return handler.last_request


@pytest.fixture()
def set_auth_mode(api_server):
    _, handler = api_server
    def _set(mode: str) -> None:
        handler.auth_mode = mode
    return _set
