# Amdy.Client (.NET)

.NET client library for the AMDY API. Targets netstandard2.0.

## Install

```bash
dotnet add package Amdy.Client
```

## Quickstart

```csharp
using System;
using System.Threading.Tasks;
using Amdy.Client;

class Program
{
    static async Task Main()
    {
        using var client = new AmdyClient("amd_live_...", "https://amdy.io");

        JsonElement health = await client.HealthAsync();          // no auth sent
        DetectionConfig config = await client.GetConfigAsync();
        Console.WriteLine($"client {config.ClientId}, sensitivity {config.DetectionSensitivity}");

        JsonElement settings = await client.GetClientSettingsAsync();
        JsonElement ips = await client.ListIpsAsync();

        await client.RegisterIpAsync("203.0.113.9");
    }
}
```

## Authentication

All methods except `HealthAsync()` send `Authorization: Bearer <api_key>`.

## Errors

- `AmdyException` — base; carries `StatusCode` and `RawBody`.
- `AmdyAuthException` — 401, missing or invalid key.
- `AmdyNotFoundException` — 404, client not found for the key.

The exception message is the server's `error` field when present.

## Tests

```bash
dotnet test csharp/Amdy.sln
```

Tests run against a local HttpListener test double; no network access needed.

## API reference

https://amdy.io/docs/api/reference
