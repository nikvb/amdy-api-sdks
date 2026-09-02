using System;
using System.Text.Json;
using System.Threading.Tasks;
using Xunit;

namespace Amdy.Client.Tests
{
    public class AmdyClientTests : IDisposable
    {
        private readonly TestServerFixture _server;
        private readonly AmdyClient _client;

        public AmdyClientTests()
        {
            _server = new TestServerFixture();
            _client = new AmdyClient("amd_live_test_key", _server.BaseUrl);
        }

        public void Dispose()
        {
            _client.Dispose();
            _server.Dispose();
        }

        [Fact]
        public async Task Health_SendsNoAuthHeader()
        {
            JsonElement result = await _client.HealthAsync();

            Assert.Equal(JsonValueKind.Object, result.ValueKind);
            Assert.Equal("ok", result.GetProperty("status").GetString());

            var req = Assert.Single(_server.Requests);
            Assert.Equal("GET", req.Method);
            Assert.Equal("/api/health", req.Path);
            Assert.Null(req.Authorization);
            Assert.Null(req.ApiKeyHeader);
        }

        [Fact]
        public async Task GetConfig_DeserializesTypedConfig()
        {
            DetectionConfig config = await _client.GetConfigAsync();

            Assert.Equal(1042, config.ClientId);
            Assert.Equal(3, config.DetectionSensitivity);
            Assert.Equal(8000, config.MaxDetectionMs);
            Assert.Equal(DateTimeOffset.Parse("2026-08-28T14:02:11.000Z"), config.UpdatedAt);

            var req = Assert.Single(_server.Requests);
            Assert.Equal("GET", req.Method);
            Assert.Equal("/api/v1/config", req.Path);
            Assert.Equal("Bearer amd_live_test_key", req.Authorization);
        }

        [Fact]
        public async Task GetClientSettings_PassesThroughJson()
        {
            JsonElement settings = await _client.GetClientSettingsAsync();

            Assert.True(settings.GetProperty("amdEnabled").GetBoolean());
            Assert.Equal("pro", settings.GetProperty("notes").GetProperty("tier").GetString());

            var req = Assert.Single(_server.Requests);
            Assert.Equal("GET", req.Method);
            Assert.Equal("/api/v1/client-settings", req.Path);
            Assert.Equal("Bearer amd_live_test_key", req.Authorization);
        }

        [Fact]
        public async Task ListIps_PassesThroughJson()
        {
            JsonElement ips = await _client.ListIpsAsync();

            Assert.Equal(2, ips.GetProperty("ips").GetArrayLength());
            Assert.Equal("1.2.3.4", ips.GetProperty("ips")[0].GetString());

            var req = Assert.Single(_server.Requests);
            Assert.Equal("GET", req.Method);
            Assert.Equal("/api/v1/ips", req.Path);
            Assert.Equal("Bearer amd_live_test_key", req.Authorization);
        }

        [Fact]
        public async Task RegisterIp_PostsWithoutBodyToCorrectPath()
        {
            JsonElement result = await _client.RegisterIpAsync();

            Assert.True(result.GetProperty("registered").GetBoolean());

            var req = Assert.Single(_server.Requests);
            Assert.Equal("POST", req.Method);
            Assert.Equal("/api/v1/ips/register", req.Path);
            Assert.Equal("Bearer amd_live_test_key", req.Authorization);
            Assert.Equal("", req.Body);
        }

        [Fact]
        public async Task Unauthorized_ThrowsAmdyAuthException_WithServerMessage()
        {
            _server.StatusOverrides["/api/v1/config"] = 401;

            AmdyAuthException ex = await Assert.ThrowsAsync<AmdyAuthException>(
                () => _client.GetConfigAsync());

            Assert.Equal(401, ex.StatusCode);
            Assert.Equal("Missing Authorization: Bearer <api_key>", ex.Message);
        }

        [Fact]
        public async Task NotFound_ThrowsAmdyNotFoundException_WithServerMessage()
        {
            _server.StatusOverrides["/api/v1/config"] = 404;

            AmdyNotFoundException ex = await Assert.ThrowsAsync<AmdyNotFoundException>(
                () => _client.GetConfigAsync());

            Assert.Equal(404, ex.StatusCode);
            Assert.Equal("client not found", ex.Message);
        }

        [Fact]
        public async Task NullUpdatedAt_IsHandled()
        {
            _server.ConfigJson = "{\"clientId\":7,\"detectionSensitivity\":2,\"maxDetectionMs\":4000,\"updatedAt\":null}";
            DetectionConfig config = await _client.GetConfigAsync();

            Assert.Equal(7, config.ClientId);
            Assert.Null(config.UpdatedAt);
        }
    }
}
