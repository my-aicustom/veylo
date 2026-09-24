import process from 'node:process';

const HELP = `
Veylo production acceptance runner

Usage:
  pnpm acceptance:prod -- --url https://veylo.example.com [options]

Options:
  --url <url>          Public Veylo site origin (required)
  --base-path <path>   Next.js base path (default: /app)
  --deep               Check OpenRouter catalogue and LiveKit reachability
  --allow-http         Permit http:// targets for local/staging checks
  --json               Print the machine-readable result JSON
  --help               Show this help without making network requests

This runner does not send conversation audio/text and does not invoke paid AI inference.
`.trim();

function parseArgs(argv) {
  const options = {
    url: '',
    basePath: '/app',
    deep: false,
    allowHttp: false,
    json: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--url') options.url = argv[++index] || '';
    else if (arg === '--base-path') options.basePath = argv[++index] || '';
    else if (arg === '--deep') options.deep = true;
    else if (arg === '--allow-http') options.allowHttp = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function normalizeBasePath(value) {
  const clean = String(value || '/app').trim();
  if (!clean || clean === '/') return '';
  return `/${clean.replace(/^\\/+|\\/+$/g, '')}`;
}

function joinUrl(origin, path) {
  return new URL(path || '/', origin).toString();
}

function detailFrom(error) {
  return error instanceof Error ? error.message : String(error);
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(detailFrom(error));
    console.error(HELP);
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    console.log(HELP);
    return;
  }

  if (!options.url) {
    console.error('Missing required --url.');
    console.error(HELP);
    process.exitCode = 2;
    return;
  }

  let target;
  try {
    target = new URL(options.url);
  } catch {
    console.error(`Invalid --url: ${options.url}`);
    process.exitCode = 2;
    return;
  }

  if (!['http:', 'https:'].includes(target.protocol)) {
    console.error('Target URL must use http:// or https://.');
    process.exitCode = 2;
    return;
  }
  if (target.protocol !== 'https:' && !options.allowHttp) {
    console.error('Production acceptance requires HTTPS. Use --allow-http only for local/staging checks.');
    process.exitCode = 2;
    return;
  }

  const origin = target.origin;
  const basePath = normalizeBasePath(options.basePath);
  const appUrl = joinUrl(origin, basePath || '/');
  const readyUrl = joinUrl(origin, `${basePath}/api/ready`);
  const healthUrl = joinUrl(origin, `${basePath}/api/health`);
  const inviteUrl = joinUrl(origin, `${basePath}/api/invite`);
  const connectionUrl = joinUrl(origin, `${basePath}/api/connection-details`);
  const diagnosticsUrl = joinUrl(origin, `${basePath}/diagnostics`);

  const results = [];
  const startedAt = new Date().toISOString();

  function record(name, ok, detail, level = 'fail') {
    const status = ok ? 'PASS' : level === 'warn' ? 'WARN' : 'FAIL';
    results.push({ name, status, detail: detail || '' });
  }

  async function safe(name, operation) {
    try {
      await operation();
    } catch (error) {
      record(name, false, detailFrom(error));
    }
  }

  async function fetchWithTimeout(url, init = {}) {
    const headers = new Headers(init.headers || {});
    headers.set('Accept', headers.get('Accept') || 'application/json, text/html;q=0.9');
    headers.set('Origin', origin);
    return fetch(url, {
      ...init,
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    });
  }

  async function readJson(response) {
    return response.json().catch(() => ({}));
  }

  await safe('Public homepage', async () => {
    const response = await fetchWithTimeout(joinUrl(origin, '/'));
    record('Public homepage', response.ok, `HTTP ${response.status}`);
  });

  let appResponse;
  await safe('Application page', async () => {
    appResponse = await fetchWithTimeout(appUrl);
    record('Application page', appResponse.ok, `HTTP ${appResponse.status}`);
  });

  if (appResponse) {
    const requiredHeaders = [
      ['content-security-policy', 'Content-Security-Policy'],
      ['x-content-type-options', 'X-Content-Type-Options'],
      ['x-frame-options', 'X-Frame-Options'],
      ['referrer-policy', 'Referrer-Policy'],
      ['permissions-policy', 'Permissions-Policy'],
    ];
    if (target.protocol === 'https:') {
      requiredHeaders.push(['strict-transport-security', 'Strict-Transport-Security']);
    }

    for (const [header, label] of requiredHeaders) {
      const value = appResponse.headers.get(header);
      record(`Security header: ${label}`, Boolean(value), value || 'missing');
    }
    record(
      'Server fingerprint',
      !appResponse.headers.get('x-powered-by'),
      appResponse.headers.get('x-powered-by') ? 'X-Powered-By is exposed' : 'X-Powered-By absent',
    );
  }

  let readyBody;
  await safe('Readiness endpoint', async () => {
    const response = await fetchWithTimeout(readyUrl);
    readyBody = await readJson(response);
    record(
      'Readiness endpoint',
      response.status === 200 && readyBody?.ready === true,
      `HTTP ${response.status}; ready=${String(readyBody?.ready)}`,
    );
    record('Strict production mode', readyBody?.strict === true, `strict=${String(readyBody?.strict)}`);
    if (readyBody?.checks && typeof readyBody.checks === 'object') {
      for (const [key, value] of Object.entries(readyBody.checks)) {
        record(`Readiness check: ${key}`, value === true, String(value));
      }
    }
  });

  let healthBody;
  await safe('Health endpoint', async () => {
    const response = await fetchWithTimeout(healthUrl);
    healthBody = await readJson(response);
    record('Health endpoint', response.status === 200 && healthBody?.app === 'Veylo', `HTTP ${response.status}`);
    record(
      'Signed invite protection',
      healthBody?.config?.inviteProtection === true,
      `inviteProtection=${String(healthBody?.config?.inviteProtection)}`,
    );
    record(
      'Secure LiveKit configuration',
      healthBody?.config?.livekitSecure === true,
      `livekitSecure=${String(healthBody?.config?.livekitSecure)}`,
    );
    record(
      'Runtime strict production',
      healthBody?.config?.strictProduction === true,
      `strictProduction=${String(healthBody?.config?.strictProduction)}`,
    );
  });

  await safe('Diagnostics page', async () => {
    const response = await fetchWithTimeout(diagnosticsUrl, { headers: { Accept: 'text/html' } });
    record('Diagnostics page', response.ok, `HTTP ${response.status}`);
  });

  if (options.deep) {
    await safe('Deep provider health', async () => {
      const response = await fetchWithTimeout(`${healthUrl}?deep=1`);
      const body = await readJson(response);
      record('Deep health endpoint', response.status === 200, `HTTP ${response.status}`);
      record(
        'OpenRouter reachability',
        body?.checks?.openrouter?.reachable === true,
        body?.checks?.openrouter?.error || `latencyMs=${body?.checks?.openrouter?.latencyMs ?? 'n/a'}`,
      );
      record(
        'LiveKit reachability',
        body?.checks?.livekit?.reachable === true,
        body?.checks?.livekit?.error || `latencyMs=${body?.checks?.livekit?.latencyMs ?? 'n/a'}`,
      );

      const models = body?.checks?.openrouter?.models || {};
      for (const [kind, model] of Object.entries(models)) {
        if (model && typeof model === 'object') {
          record(
            `OpenRouter model listed: ${kind}`,
            model.listed === true,
            `${model.id || 'unknown'} listed=${String(model.listed)}`,
            'warn',
          );
        }
      }
    });
  }

  let inviteToken = '';
  const roomName = `REMOTE_${Date.now().toString(36).toUpperCase()}`;
  await safe('Signed invite creation', async () => {
    const response = await fetchWithTimeout(inviteUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName }),
    });
    const body = await readJson(response);
    inviteToken = typeof body?.token === 'string' ? body.token : '';
    record(
      'Signed invite creation',
      response.status === 200 && body?.protected === true && inviteToken.length > 20,
      `HTTP ${response.status}; protected=${String(body?.protected)}`,
    );
  });

  const joinBody = {
    roomName,
    participantName: 'Production Acceptance',
    countryCode: 'ID',
    countryName: 'Indonesia',
    preferredLanguage: 'id',
  };

  await safe('Unsigned room join rejection', async () => {
    const response = await fetchWithTimeout(connectionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(joinBody),
    });
    record('Unsigned room join rejection', response.status === 403, `HTTP ${response.status}`);
  });

  if (inviteToken) {
    await safe('Tampered invite rejection', async () => {
      const response = await fetchWithTimeout(connectionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...joinBody, inviteToken: `${inviteToken}x` }),
      });
      record('Tampered invite rejection', response.status === 403, `HTTP ${response.status}`);
    });

    await safe('Valid invite token issuance', async () => {
      const response = await fetchWithTimeout(connectionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...joinBody, inviteToken }),
      });
      const body = await readJson(response);
      const tokenOk = typeof body?.participantToken === 'string' && body.participantToken.length > 20;
      const serverSecure = typeof body?.serverUrl === 'string' && body.serverUrl.startsWith('wss://');
      record(
        'Valid invite token issuance',
        response.status === 200 && tokenOk,
        `HTTP ${response.status}; participantToken=${tokenOk ? 'present' : 'missing'}`,
      );
      record('Issued LiveKit URL is WSS', serverSecure, body?.serverUrl || 'missing');
    });
  } else {
    record('Tampered invite rejection', false, 'Skipped because invite creation failed');
    record('Valid invite token issuance', false, 'Skipped because invite creation failed');
    record('Issued LiveKit URL is WSS', false, 'Skipped because invite creation failed');
  }

  const finishedAt = new Date().toISOString();
  const summary = {
    target: origin,
    basePath,
    deep: options.deep,
    startedAt,
    finishedAt,
    pass: results.filter((item) => item.status === 'PASS').length,
    warn: results.filter((item) => item.status === 'WARN').length,
    fail: results.filter((item) => item.status === 'FAIL').length,
    results,
  };

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`\nVeylo production acceptance: ${origin}${basePath}`);
    for (const item of results) {
      console.log(`[${item.status}] ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
    }
    console.log(`\nSummary: ${summary.pass} passed, ${summary.warn} warnings, ${summary.fail} failed.`);
  }

  if (summary.fail > 0) process.exitCode = 1;
}

await main();
