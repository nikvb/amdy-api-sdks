# frozen_string_literal: true

require "net/http"
require "json"

module Amdy
  # Client for the AMDY AMD (Answering Machine Detection) API.
  #
  #   client = Amdy::Client.new(api_key: "amd_live_...")
  #   client.config  # => {"clientId"=>1042, ...}
  class Client
    DEFAULT_BASE_URL = "https://amdy.io"

    attr_reader :api_key, :base_url, :open_timeout, :read_timeout

    def initialize(api_key:, base_url: DEFAULT_BASE_URL, open_timeout: 10, read_timeout: 30)
      raise ArgumentError, "api_key is required" if api_key.nil? || api_key.to_s.empty?

      @api_key = api_key
      @base_url = base_url.to_s.sub(%r{/+\z}, "")
      @open_timeout = open_timeout
      @read_timeout = read_timeout
    end

    # GET /api/health - liveness probe. Sent without authentication.
    def health
      get("/api/health", auth: false)
    end

    # GET /api/v1/config - current detection configuration.
    def config
      get("/api/v1/config")
    end

    # GET /api/v1/client-settings - arbitrary client settings JSON.
    def client_settings
      get("/api/v1/client-settings")
    end

    # GET /api/v1/ips - registered source IPs.
    def ips
      get("/api/v1/ips")
    end

    # POST /api/v1/ips/register - register a source IP.
    def register_ip(ip)
      post("/api/v1/ips/register", { "ip" => ip })
    end

    private

    def get(path, auth: true)
      request(Net::HTTP::Get.new(path), auth: auth)
    end

    def post(path, payload)
      req = Net::HTTP::Post.new(path)
      req["Content-Type"] = "application/json"
      req.body = JSON.generate(payload)
      request(req, auth: true)
    end

    def request(req, auth:)
      req["Accept"] = "application/json"
      req["Authorization"] = "Bearer #{@api_key}" if auth

      uri = URI.parse(@base_url)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = uri.scheme == "https"
      http.open_timeout = @open_timeout
      http.read_timeout = @read_timeout

      begin
        response = http.request(req)
      rescue SystemCallError, SocketError, Timeout::Error, OpenSSL::SSL::SSLError, Net::HTTPExceptions => e
        raise ConnectionError, "#{e.class}: #{e.message}"
      end

      parse(response)
    end

    def parse(response)
      status = response.code.to_i
      body = response.body.to_s

      return JSON.parse(body) if (200..299).cover?(status)

      message = begin
        parsed = JSON.parse(body)
        parsed["error"] if parsed.is_a?(Hash)
      rescue JSON::ParserError
        nil
      end

      klass = case status
              when 401 then AuthError
              when 404 then NotFoundError
              else ApiError
              end

      raise klass.new(status: status, message: message, body: body)
    end
  end
end
