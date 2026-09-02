#!/usr/bin/env node
// amdy-cli: minimal CLI for the AMDY Answering Machine Detection REST API.
// Node >= 20 (global fetch). No npm dependencies.
// Docs: https://amdy.io/docs/api/reference

const DEFAULT_BASE = 'https://amdy.io';

const USAGE = `amdy-cli - AMDY Answering Machine Detection API client

Usage:
  amdy-cli <command> [options]

Commands:
  health                              Service health (no auth required)
  get-config                          Detection settings for the authenticated client
  get-client-settings                 Client settings for the authenticated client
  list-ips                            List registered source IPs
  register-ip <ip>                    Register a source IP permitted to reach the detection service

Options:
  --base-url <url>   API base URL (default: ${DEFAULT_BASE}; env AMDY_BASE_URL)
  --api-key <key>    API key (env AMDY_API_KEY). Sent as Authorization: Bearer and X-API-Key.
  -h, --help         Show this help

Authentication is required for every command except "health".`;

function parseArgs(argv) {
  const opts = { base: process.env.AMDY_BASE_URL || DEFAULT_BASE, apiKey: process.env.AMDY_API_KEY || '', positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base-url') opts.base = argv[++i];
    else if (a === '--api-key') opts.apiKey = argv[++i];
    else if (a === '-h' || a === '--help') opts.help = true;
    else opts.positional.push(a);
  }
  return opts;
}

async function request(base, path, { method = 'GET', apiKey, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['X-API-Key'] = apiKey;
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(base.replace(/\/$/, '') + path, { method, headers, body });
  } catch (err) {
    console.error(`error: request to ${base}${path} failed: ${err.cause ? err.cause.message : err.message}`);
    process.exit(2);
  }
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    console.error(`error: HTTP ${res.status} ${res.statusText}`);
    if (data !== undefined) console.error(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
    process.exit(1);
  }
  console.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const [cmd, ...rest] = opts.positional;

  if (!cmd || opts.help) {
    console.log(USAGE);
    process.exit(opts.help ? 0 : !cmd ? 2 : 0);
  }

  switch (cmd) {
    case 'health':
      await request(opts.base, '/api/health');
      break;
    case 'get-config':
      requireKey(opts);
      await request(opts.base, '/api/v1/config', opts);
      break;
    case 'get-client-settings':
      requireKey(opts);
      await request(opts.base, '/api/v1/client-settings', opts);
      break;
    case 'list-ips':
      requireKey(opts);
      await request(opts.base, '/api/v1/ips', opts);
      break;
    case 'register-ip': {
      requireKey(opts);
      const ip = rest[0];
      if (!ip) {
        console.error('error: register-ip requires an IP argument, e.g. amdy-cli register-ip 203.0.113.10');
        process.exit(2);
      }
      await request(opts.base, '/api/v1/ips/register', { ...opts, method: 'POST', body: JSON.stringify({ ip }) });
      break;
    }
    default:
      console.error(`error: unknown command "${cmd}"`);
      console.log(USAGE);
      process.exit(2);
  }
}

function requireKey(opts) {
  if (!opts.apiKey) {
    console.error('error: this command requires an API key. Set AMDY_API_KEY or pass --api-key <key>.');
    process.exit(2);
  }
}

main();
