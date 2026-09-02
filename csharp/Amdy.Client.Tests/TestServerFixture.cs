using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Amdy.Client.Tests
{
    /// <summary>
    /// Local HTTP test double on 127.0.0.1 (random free port). Serves canned JSON per
    /// endpoint and records each request (method, path, headers, body).
    /// </summary>
    public sealed class TestServerFixture : IDisposable
    {
        public sealed class RecordedRequest
        {
            public string Method;
            public string Path;
            public string Authorization;
            public string ApiKeyHeader;
            public string Body;
        }

        private readonly HttpListener _listener;
        private readonly CancellationTokenSource _cts = new CancellationTokenSource();
        private readonly Task _loop;

        /// <summary>Per-path status override; when a path is present it is served with that status and the matching error body.</summary>
        public readonly Dictionary<string, int> StatusOverrides = new Dictionary<string, int>();

        public ConcurrentQueue<RecordedRequest> Requests { get; } = new ConcurrentQueue<RecordedRequest>();

        public string BaseUrl { get; }

        public string HealthJson { get; set; } = "{\"status\":\"ok\"}";
        public string ConfigJson { get; set; } =
            "{\"clientId\":1042,\"detectionSensitivity\":3,\"maxDetectionMs\":8000,\"updatedAt\":\"2026-08-28T14:02:11.000Z\"}";
        public string ClientSettingsJson { get; set; } = "{\"amdEnabled\":true,\"notes\":{\"tier\":\"pro\"}}";
        public string ListIpsJson { get; set; } = "{\"ips\":[\"1.2.3.4\",\"5.6.7.8\"]}";
        public string RegisterIpJson { get; set; } = "{\"registered\":true,\"ip\":\"203.0.113.9\"}";
        public string Error401Json { get; set; } = "{\"error\":\"Missing Authorization: Bearer <api_key>\"}";
        public string Error404Json { get; set; } = "{\"error\":\"client not found\"}";

        public TestServerFixture()
        {
            // Ask the OS for a free port.
            var portProbe = new System.Net.Sockets.TcpListener(IPAddress.Loopback, 0);
            portProbe.Start();
            int port = ((IPEndPoint)portProbe.LocalEndpoint).Port;
            portProbe.Stop();

            BaseUrl = $"http://127.0.0.1:{port}/";
            _listener = new HttpListener();
            _listener.Prefixes.Add(BaseUrl);
            _listener.Start();
            _loop = Task.Run(() => ListenLoop(_cts.Token));
        }

        private async Task ListenLoop(CancellationToken ct)
        {
            while (!ct.IsCancellationRequested)
            {
                HttpListenerContext ctx;
                try
                {
                    var pending = _listener.GetContextAsync();
                    var finished = await Task.WhenAny(pending, Task.Delay(Timeout.Infinite, ct));
                    if (finished != pending)
                        break;
                    ctx = await pending;
                }
                catch (Exception)
                {
                    if (ct.IsCancellationRequested)
                        break;
                    throw;
                }

                try
                {
                    Handle(ctx);
                }
                catch (Exception)
                {
                    // keep serving even if one request fails
                }
            }
        }

        private void Handle(HttpListenerContext ctx)
        {
            HttpListenerRequest req = ctx.Request;
            string body;
            using (var sr = new StreamReader(req.InputStream, Encoding.UTF8))
                body = sr.ReadToEnd();

            Requests.Enqueue(new RecordedRequest
            {
                Method = req.HttpMethod,
                Path = req.Url.AbsolutePath,
                Authorization = req.Headers["Authorization"],
                ApiKeyHeader = req.Headers["X-API-Key"],
                Body = body
            });

            string path = req.Url.AbsolutePath;
            string responseJson;
            int status;

            if (StatusOverrides.TryGetValue(path, out int overrideStatus))
            {
                status = overrideStatus;
                responseJson = status == 401 ? Error401Json : Error404Json;
            }
            else
            {
                switch (path)
                {
                    case "/api/health":
                        responseJson = HealthJson;
                        status = 200;
                        break;
                    case "/api/v1/config":
                        responseJson = ConfigJson;
                        status = 200;
                        break;
                    case "/api/v1/client-settings":
                        responseJson = ClientSettingsJson;
                        status = 200;
                        break;
                    case "/api/v1/ips":
                        responseJson = ListIpsJson;
                        status = 200;
                        break;
                    case "/api/v1/ips/register":
                        responseJson = RegisterIpJson;
                        status = 200;
                        break;
                    default:
                        responseJson = Error404Json;
                        status = 404;
                        break;
                }
            }

            byte[] bytes = Encoding.UTF8.GetBytes(responseJson);
            ctx.Response.StatusCode = status;
            ctx.Response.ContentType = "application/json";
            ctx.Response.ContentLength64 = bytes.Length;
            ctx.Response.OutputStream.Write(bytes, 0, bytes.Length);
            ctx.Response.OutputStream.Close();
        }

        public void Dispose()
        {
            _cts.Cancel();
            try { _listener.Stop(); } catch { }
            _cts.Dispose();
        }
    }
}
