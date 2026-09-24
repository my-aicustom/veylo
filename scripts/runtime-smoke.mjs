import { spawn } from 'node:child_process';
import process from 'node:process';

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const appBase = 'http://127.0.0.1:3100';
const siteBase = 'http://127.0.0.1:4322';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function start(args, env = {}) {
  const child = spawn(pnpm, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let logs = '';
  const capture = (chunk) => {
    logs = (logs + chunk.toString()).slice(-12000);
  };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  child.__logs = () => logs;
  return child;
}

async function waitFor(url, child, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early with code ${child.exitCode}\n${child.__logs()}`);
    }
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status < 500) return response;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Timed out waiting for ${url}\n${child.__logs()}`);
}

async function json(response) {
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

let app;
let site;

try {
  app = start(
    ['--filter', '@veylo/app', 'exec', 'next', 'start', '-H', '127.0.0.1', '-p', '3100'],
    {
      APP_URL: appBase,
      NEXT_PUBLIC_BASE_PATH: '/app',
      LIVEKIT_URL: 'ws://127.0.0.1:7880',
      LIVEKIT_API_KEY: 'runtime-smoke-key',
      LIVEKIT_API_SECRET: 'runtime-smoke-secret-that-is-long-enough',
      OPENROUTER_API_KEY: 'runtime-smoke-openrouter-key',
      VEYLO_INVITE_SECRET: 'runtime-smoke-invite-secret-that-is-more-than-32-characters',
      VEYLO_STRICT_PRODUCTION: 'false',
      VEYLO_AI_MAX_REQUESTS_PER_HOUR: '100',
      VEYLO_AI_MAX_TRACKED_COST_USD_PER_DAY: '5',
    },
  );

  await waitFor(`${appBase}/app/api/ready`, app);

  const ready = await json(await fetch(`${appBase}/app/api/ready`));
  assert(ready.response.status === 200 && ready.body.ready === true, 'App readiness endpoint is not ready.');

  const health = await json(await fetch(`${appBase}/app/api/health`));
  assert(health.response.status === 200 && health.body.app === 'Veylo', 'Health endpoint failed.');
  assert(health.body.config?.inviteProtection === true, 'Signed invite protection is not enabled in runtime smoke.');

  const home = await fetch(`${appBase}/app`);
  assert(
    home.status === 200 && (home.headers.get('content-type') || '').includes('text/html'),
    'App homepage failed runtime smoke.',
  );

  const diagnostics = await fetch(`${appBase}/app/diagnostics`);
  assert(diagnostics.status === 200, 'Diagnostics page failed runtime smoke.');

  const roomName = 'SMOKE123';
  const invite = await json(await fetch(`${appBase}/app/api/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomName }),
  }));
  assert(invite.response.status === 200 && typeof invite.body.token === 'string', 'Signed invite creation failed.');

  const baseJoinBody = {
    roomName,
    participantName: 'Runtime Smoke',
    countryCode: 'ID',
    countryName: 'Indonesia',
    preferredLanguage: 'id',
  };

  const denied = await fetch(`${appBase}/app/api/connection-details`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(baseJoinBody),
  });
  assert(denied.status === 403, 'Room join without signed invite should be rejected.');

  const tampered = await fetch(`${appBase}/app/api/connection-details`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...baseJoinBody, inviteToken: `${invite.body.token}x` }),
  });
  assert(tampered.status === 403, 'Tampered signed invite should be rejected.');

  const allowed = await json(await fetch(`${appBase}/app/api/connection-details`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...baseJoinBody, inviteToken: invite.body.token }),
  }));
  assert(
    allowed.response.status === 200 &&
    typeof allowed.body.participantToken === 'string' &&
    allowed.body.participantToken.length > 20,
    'Valid signed invite did not produce a LiveKit participant token.',
  );

  await stop(app);
  app = null;

  site = start(['--filter', '@veylo/site', 'exec', 'astro', 'preview', '--host', '127.0.0.1', '--port', '4322']);
  const siteResponse = await waitFor(siteBase, site);
  const siteHtml = await siteResponse.text();
  assert(siteResponse.status === 200 && siteHtml.toUpperCase().includes('VEYLO'), 'Astro homepage failed runtime smoke.');

  console.log('RUNTIME SMOKE PASSED');
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  if (app) console.error(app.__logs());
  if (site) console.error(site.__logs());
  process.exitCode = 1;
} finally {
  await stop(app);
  await stop(site);
}
