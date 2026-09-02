# frozen_string_literal: true

module Amdy
  # Base class for all Amdy errors.
  class Error < StandardError; end

  # Raised when the API returns a non-2xx response.
  #   status  - Integer HTTP status code
  #   message - human readable message (from the body's "error" field when present)
  #   body    - raw response body String
  class ApiError < Error
    attr_reader :status, :body

    def initialize(status:, message: nil, body: nil)
      @status = status
      @message = message || "HTTP #{status}"
      @body = body
      super(@message)
    end
    attr_reader :message
  end

  # Raised on 401 responses (bad or missing API key).
  class AuthError < ApiError; end

  # Raised on 404 responses (client not found).
  class NotFoundError < ApiError; end

  # Raised when the request fails at the network level.
  class ConnectionError < Error; end
end
