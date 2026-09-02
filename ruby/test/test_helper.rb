# frozen_string_literal: true

require "webrick"
require "json"
require "socket"
require_relative "../lib/amdy"

# Test fixture: a WEBrick server on 127.0.0.1 serving canned JSON per path and
# recording every request it receives.
class FixtureServer
  CANNED = {
    "/api/health" => { "status" => "ok" },
    "/api/v1/config" => {
      "clientId" => 1042,
      "detectionSensitivity" => 3,
      "maxDetectionMs" => 8000,
      "updatedAt" => "2026-08-28T14:02:11.000Z"
    },
    "/api/v1/client-settings" => { "webhookUrl" => "https://example.test/hook", "timezone" => "UTC" },
    "/api/v1/ips" => { "ips" => ["203.0.113.7", "198.51.100.9"] },
    "/api/v1/ips/register" => { "registered" => true }
  }.freeze

  StatusRoutes = Struct.new(:status, :body)

  attr_reader :port, :requests

  def initialize
    @requests = []
    @error_routes = {}
    @server = WEBrick::HTTPServer.new(
      Port: 0,
      BindAddress: "127.0.0.1",
      Logger: WEBrick::Log.new(File::NULL),
      AccessLog: [],
      StartCallback: -> { @started = true }
    )
    mount_servlet
    @thread = Thread.new { @server.start }
    @port = @server.config[:Port]
  end

  def started?
    @started
  end

  def record(req)
    @requests << { method: req.request_method, path: req.path,
                   authorization: req["authorization"], api_key_header: req["x-api-key"],
                   content_type: req["content-type"], body: req.body }
  end

  # Force the fixture to return a given status/body for a path (nil restores canned behavior).
  def stub_status(path, status:, body: {})
    @error_routes[path] = status && StatusRoutes.new(status, JSON.generate(body))
  end

  def stop
    @server.shutdown
    @thread.join
  end

  def client(**opts)
    opts = { api_key: "amd_live_test_key", base_url: "http://127.0.0.1:#{port}", open_timeout: 2, read_timeout: 2 }.merge(opts)
    Amdy::Client.new(**opts)
  end

  private

  def mount_servlet
    fixture = self
    @server.mount_proc "/" do |req, res|
      fixture.record(req)
      if (route = fixture.instance_variable_get(:@error_routes)[req.path])
        res.status = route.status
        res["Content-Type"] = "application/json"
        res.body = route.body
        next
      end
      canned = CANNED[req.path]
      res.status = canned ? 200 : 404
      res["Content-Type"] = "application/json"
      res.body = JSON.generate(canned || { "error" => "not found" })
    end
  end
end
