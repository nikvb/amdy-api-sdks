using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace Amdy.Client
{
    /// <summary>
    /// Client for the AMDY API. Async methods, JSON over HTTPS.
    /// Authenticated calls send "Authorization: Bearer &lt;apiKey&gt;".
    /// </summary>
    public class AmdyClient : IDisposable
    {
        private static readonly JsonSerializerOptions JsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        private readonly HttpClient _http;
        private readonly string _apiKey;
        private readonly bool _ownsHttp;

        /// <summary>Creates a client with its own HttpClient pointed at baseUrl (default https://amdy.io).</summary>
        public AmdyClient(string apiKey, string baseUrl = "https://amdy.io")
            : this(apiKey, new HttpClient { BaseAddress = new Uri(baseUrl) }, ownsHttp: true)
        {
        }

        /// <summary>Creates a client over a supplied HttpClient (not disposed by this class; BaseAddress must be set).</summary>
        public AmdyClient(string apiKey, HttpClient httpClient)
            : this(apiKey, httpClient, ownsHttp: false)
        {
        }

        private AmdyClient(string apiKey, HttpClient httpClient, bool ownsHttp)
        {
            if (string.IsNullOrEmpty(apiKey))
                throw new ArgumentException("API key is required", nameof(apiKey));
            _apiKey = apiKey;
            _http = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
            _ownsHttp = ownsHttp;
        }

        /// <summary>GET /api/health — liveness check, no auth header sent.</summary>
        public async Task<JsonElement> HealthAsync()
        {
            return await SendJsonAsync(HttpMethod.Get, "/api/health", auth: false, requestBody: null);
        }

        /// <summary>GET /api/v1/config — typed detection configuration for the key's client.</summary>
        public async Task<DetectionConfig> GetConfigAsync()
        {
            JsonElement json = await SendJsonAsync(HttpMethod.Get, "/api/v1/config", auth: true, requestBody: null);
            return JsonSerializer.Deserialize<DetectionConfig>(json.GetRawText(), JsonOptions);
        }

        /// <summary>GET /api/v1/client-settings — arbitrary settings JSON for the key.</summary>
        public Task<JsonElement> GetClientSettingsAsync()
        {
            return SendJsonAsync(HttpMethod.Get, "/api/v1/client-settings", auth: true, requestBody: null);
        }

        /// <summary>GET /api/v1/ips — registered source IPs for the key.</summary>
        public Task<JsonElement> ListIpsAsync()
        {
            return SendJsonAsync(HttpMethod.Get, "/api/v1/ips", auth: true, requestBody: null);
        }

        /// <summary>POST /api/v1/ips/register — register a source IP. The spec defines no request body; the server infers the IP from the originating request.</summary>
        public Task<JsonElement> RegisterIpAsync()
        {
            return SendJsonAsync(HttpMethod.Post, "/api/v1/ips/register", auth: true, requestBody: null);
        }

        /// <summary>Disposes the underlying HttpClient when this client created it.</summary>
        public void Dispose()
        {
            if (_ownsHttp)
                _http.Dispose();
        }

        private async Task<JsonElement> SendJsonAsync(HttpMethod method, string path, bool auth, string requestBody)
        {
            using (var request = new HttpRequestMessage(method, path))
            {
                if (auth)
                    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);

                if (requestBody != null)
                    request.Content = new StringContent(requestBody, Encoding.UTF8, "application/json");

                HttpResponseMessage response = await _http.SendAsync(request).ConfigureAwait(false);
                string raw = await response.Content.ReadAsStringAsync().ConfigureAwait(false);

                if (!response.IsSuccessStatusCode)
                {
                    string message = ExtractError(raw) ?? "AMDY API returned " + (int)response.StatusCode + " " + response.ReasonPhrase;
                    switch ((int)response.StatusCode)
                    {
                        case 401:
                            throw new AmdyAuthException(message, raw);
                        case 404:
                            throw new AmdyNotFoundException(message, raw);
                        default:
                            throw new AmdyException((int)response.StatusCode, message, raw);
                    }
                }

                return JsonDocument.Parse(string.IsNullOrWhiteSpace(raw) ? "null" : raw).RootElement.Clone();
            }
        }

        private static string ExtractError(string raw)
        {
            try
            {
                using (JsonDocument doc = JsonDocument.Parse(raw))
                {
                    if (doc.RootElement.ValueKind == JsonValueKind.Object &&
                        doc.RootElement.TryGetProperty("error", out JsonElement err) &&
                        err.ValueKind == JsonValueKind.String)
                    {
                        return err.GetString();
                    }
                }
            }
            catch (JsonException)
            {
                // body was not JSON; fall through
            }
            return null;
        }
    }
}
