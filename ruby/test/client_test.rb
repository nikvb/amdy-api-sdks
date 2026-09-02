# frozen_string_literal: true

require_relative "test_helper"
require "minitest/autorun"

class ClientTest < Minitest::Test
  def setup
    @server = FixtureServer.new
    until @server.started?
      raise "fixture failed to start" unless @server.started? || sleep(0.05)
    end
  end

  def teardown
    @server.stop
  end

  def test_health_returns_parsed_json_without_auth_header
    result = @server.client.health
    assert_equal({ "status" => "ok" }, result)
    last = @server.requests.last
    assert_equal "GET", last[:method]
    assert_equal "/api/health", last[:path]
    assert_nil last[:authorization], "health must not send auth header"
  end

  def test_config_returns_hash_values
    config = @server.client.config
    assert_equal 1042, config["clientId"]
    assert_equal 3, config["detectionSensitivity"]
    assert_equal 8000, config["maxDetectionMs"]
    assert_equal "2026-08-28T14:02:11.000Z", config["updatedAt"]
    assert_equal "Bearer amd_live_test_key", @server.requests.last[:authorization]
  end

  def test_client_settings_passthrough
    settings = @server.client.client_settings
    assert_equal({ "webhookUrl" => "https://example.test/hook", "timezone" => "UTC" }, settings)
  end

  def test_ips_passthrough
    ips = @server.client.ips
    assert_equal({ "ips" => ["203.0.113.7", "198.51.100.9"] }, ips)
  end

  def test_register_ip_posts_to_correct_path_without_body
    result = @server.client.register_ip
    assert_equal({ "registered" => true }, result)
    last = @server.requests.last
    assert_equal "POST", last[:method]
    assert_equal "/api/v1/ips/register", last[:path]
    # Net::HTTP stamps a default content type on POST; the important part is the empty body.
    assert_equal "", last[:body].to_s
  end

  def test_401_raises_auth_error_with_server_message
    @server.stub_status("/api/v1/config", status: 401, body: { "error" => "Invalid API key" })
    error = assert_raises(Amdy::AuthError) { @server.client.config }
    assert_equal 401, error.status
    assert_equal "Invalid API key", error.message
  end

  def test_404_raises_not_found_error
    @server.stub_status("/api/v1/config", status: 404, body: { "error" => "Client not found" })
    error = assert_raises(Amdy::NotFoundError) { @server.client.config }
    assert_equal 404, error.status
    assert_equal "Client not found", error.message
  end

  def test_other_error_raises_api_error_and_extracts_message
    @server.stub_status("/api/v1/config", status: 429, body: { "error" => "Rate limit exceeded" })
    error = assert_raises(Amdy::ApiError) { @server.client.config }
    assert_equal 429, error.status
    assert_equal "Rate limit exceeded", error.message
    refute_kind_of Amdy::AuthError, error
    refute_kind_of Amdy::NotFoundError, error
  end

  def test_error_without_message_falls_back_to_status_message
    @server.stub_status("/api/v1/config", status: 500, body: {})
    error = assert_raises(Amdy::ApiError) { @server.client.config }
    assert_equal "HTTP 500", error.message
  end

  def test_connection_error_on_unreachable_server
    # Port 1 on localhost is unassigned; connection is refused.
    client = Amdy::Client.new(api_key: "amd_live_test_key", base_url: "http://127.0.0.1:1", open_timeout: 1, read_timeout: 1)
    assert_raises(Amdy::ConnectionError) { client.health }
  end

  def test_client_requires_api_key
    assert_raises(ArgumentError) { Amdy::Client.new(api_key: nil) }
    assert_raises(ArgumentError) { Amdy::Client.new(api_key: "") }
  end
end
