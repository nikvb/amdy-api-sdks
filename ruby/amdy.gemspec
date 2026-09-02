# frozen_string_literal: true

require_relative "lib/amdy/version"

Gem::Specification.new do |spec|
  spec.name = "amdy"
  spec.version = Amdy::VERSION
  spec.authors = ["AMDY"]
  spec.email = ["support@amdy.io"]

  spec.summary = "Ruby client for the AMDY AMD (Answering Machine Detection) API"
  spec.description = "A dependency-free Ruby client for the AMDY Answering Machine Detection API. " \
                     "Manage API keys, inspect detection config, and register source IPs over HTTPS."
  spec.homepage = "https://amdy.io"
  spec.license = "MIT"
  spec.required_ruby_version = ">= 2.6"

  spec.metadata["homepage_uri"] = spec.homepage
  spec.metadata["source_code_uri"] = "https://github.com/nikvb/amdy-api-sdks"
  spec.metadata["documentation_uri"] = "https://amdy.io/docs/api/reference"
  spec.metadata["rubygems_mfa_required"] = "true"

  spec.files = Dir["lib/**/*.rb"]

  spec.bindir = "exe"
  spec.executables = []
  spec.require_paths = ["lib"]
end
