"""Tests for the AMDY REST client against a local HTTP fixture."""

import pytest

from amdy import (
    AmdyApiError,
    AmdyAuthError,
    AmdyClient,
    AmdyNotFoundError,
)


class TestAuthHeaders:
    def test_bearer_scheme_sends_authorization_header(self, client, last_request):
        client.health()
        # health is unauthenticated; use an authenticated endpoint
        client.get_config()
        assert last_request["headers"]["authorization"] == "Bearer amd_live_test_key_12345"
        assert "x-api-key" not in last_request["headers"]

    def test_api_key_scheme_sends_x_api_key_header(self, api_server):
        base_url, _ = api_server
        client = AmdyClient(api_key="amd_live_test_key_12345", base_url=base_url, auth_scheme="api_key")
        client.get_config()
        request = api_server[1].last_request
        assert request["headers"]["x-api-key"] == "amd_live_test_key_12345"
        assert "authorization" not in request["headers"]

    def test_empty_api_key_rejected(self):
        with pytest.raises(ValueError):
            AmdyClient(api_key="")

    def test_invalid_auth_scheme_rejected(self):
        with pytest.raises(ValueError):
            AmdyClient(api_key="amd_live_test_key_12345", auth_scheme="cookie")


class TestEndpoints:
    def test_health_path_and_no_auth(self, client, last_request):
        result = client.health()
        assert result == {"status": "ok"}
        assert last_request["method"] == "GET"
        assert last_request["path"] == "/api/health"
        assert "authorization" not in last_request["headers"]

    def test_get_config(self, client, last_request):
        result = client.get_config()
        assert last_request["path"] == "/api/v1/config"
        assert result["clientId"] == 1042
        assert result["detectionSensitivity"] == 3
        assert result["maxDetectionMs"] == 8000

    def test_get_client_settings(self, client, last_request):
        result = client.get_client_settings()
        assert last_request["path"] == "/api/v1/client-settings"
        assert result["clientId"] == 1042

    def test_list_ips(self, client, last_request):
        result = client.list_ips()
        assert last_request["method"] == "GET"
        assert last_request["path"] == "/api/v1/ips"
        assert result["ips"] == ["203.0.113.10"]

    def test_register_ip(self, client, last_request):
        result = client.register_ip()
        assert last_request["method"] == "POST"
        assert last_request["path"] == "/api/v1/ips/register"
        assert last_request["body"] == b""  # spec documents no request body
        assert result["registered"] == "203.0.113.10"


class TestErrorPaths:
    def test_401_raises_auth_error(self, client, set_auth_mode):
        set_auth_mode("invalid")
        with pytest.raises(AmdyAuthError) as excinfo:
            client.get_config()
        assert excinfo.value.status_code == 401
        assert excinfo.value.message == "Invalid or inactive API key"

    def test_missing_key_raises_auth_error(self, client, set_auth_mode):
        set_auth_mode("missing")
        with pytest.raises(AmdyAuthError):
            client.list_ips()

    def test_404_raises_not_found_error(self, client, set_auth_mode):
        set_auth_mode("not_found")
        with pytest.raises(AmdyNotFoundError) as excinfo:
            client.get_config()
        assert excinfo.value.status_code == 404
        assert excinfo.value.message == "Client not found"

    def test_unknown_path_raises_api_error(self, client):
        # force a request to an unrouted path via the private helper
        with pytest.raises(AmdyApiError) as excinfo:
            client._request("GET", "/api/v1/nope")
        assert excinfo.value.status_code == 404

    def test_error_hierarchy(self):
        assert issubclass(AmdyAuthError, AmdyApiError)
        assert issubclass(AmdyNotFoundError, AmdyApiError)


class TestConnectionErrors:
    def test_unreachable_server_raises_connection_error(self):
        from amdy import AmdyConnectionError

        client = AmdyClient(
            api_key="amd_live_test_key_12345",
            base_url="http://127.0.0.1:1",  # nothing listens here
            timeout=1.0,
        )
        with pytest.raises(AmdyConnectionError):
            client.health()
