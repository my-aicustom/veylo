import fs from 'node:fs';
import path from 'node:path';

const DEV_VALUES = new Set(['devkey', 'devsecret', 'changeme', 'change-me', 'replace-me']);

function present(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function devLike(value) {
  if (!present(value)) return false;
  const normalized = value.trim().toLowerCase();
  return DEV_VALUES.has(normalized) || normalized.includes('change_me') || normalized.includes('change-me') || normalized.includes('replace_me') || normalized.includes('replace-me');
}

function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isLocalHost(url) {
  if (!url) return false;
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
}

export function validateProductionEnv(env) {
  const errors = [];

  if (env.VEYLO_STRICT_PRODUCTION !== 'true') {
    errors.push('VEYLO_STRICT_PRODUCTION must be true in production.');
  }

  if (!present(env.APP_URL)) {
    errors.push('APP_URL is required.');
  } else {
    const appUrl = parseUrl(env.APP_URL);
    if (!appUrl || appUrl.protocol !== 'https:') errors.push('APP_URL must use https:// in production.');
    else if (isLocalHost(appUrl)) errors.push('APP_URL must not point to localhost in production.');
  }

  if (!present(env.LIVEKIT_URL)) {
    errors.push('LIVEKIT_URL is required.');
  } else {
    const livekitUrl = parseUrl(env.LIVEKIT_URL);
    if (!livekitUrl || livekitUrl.protocol !== 'wss:') errors.push('LIVEKIT_URL must use wss:// in production.');
    else if (isLocalHost(livekitUrl)) errors.push('LIVEKIT_URL must not point to localhost in production.');
  }

  if (!present(env.LIVEKIT_API_KEY)) errors.push('LIVEKIT_API_KEY is required.');
  else if (devLike(env.LIVEKIT_API_KEY)) errors.push('LIVEKIT_API_KEY still uses a development/placeholder value.');

  if (!present(env.LIVEKIT_API_SECRET)) errors.push('LIVEKIT_API_SECRET is required.');
  else if (devLike(env.LIVEKIT_API_SECRET)) errors.push('LIVEKIT_API_SECRET still uses a development/placeholder value.');
  else if (env.LIVEKIT_API_SECRET.trim().length < 16) errors.push('LIVEKIT_API_SECRET is unexpectedly short for production.');

  if (!present(env.VEYLO_INVITE_SECRET)) errors.push('VEYLO_INVITE_SECRET is required in production.');
  else if (devLike(env.VEYLO_INVITE_SECRET)) errors.push('VEYLO_INVITE_SECRET still uses a placeholder value.');
  else if (env.VEYLO_INVITE_SECRET.trim().length < 32) errors.push('VEYLO_INVITE_SECRET must be at least 32 characters.');

  if (!present(env.OPENROUTER_API_KEY)) errors.push('OPENROUTER_API_KEY is required.');
  else if (devLike(env.OPENROUTER_API_KEY)) errors.push('OPENROUTER_API_KEY still uses a placeholder value.');

  if (!positive(env.VEYLO_AI_MAX_REQUESTS_PER_HOUR)) {
    errors.push('VEYLO_AI_MAX_REQUESTS_PER_HOUR must be a positive number in production.');
  }
  if (!positive(env.VEYLO_AI_MAX_TRACKED_COST_USD_PER_DAY)) {
    errors.push('VEYLO_AI_MAX_TRACKED_COST_USD_PER_DAY must be a positive number in production.');
  }

  return errors;
}

export function validateRepository(rootDir) {
  const errors = [];
  const read = (relative) => fs.readFileSync(path.join(rootDir, relative), 'utf8');
  const exists = (relative) => fs.existsSync(path.join(rootDir, relative));

  const compose = read('docker-compose.yml');
  if (compose.includes('livekit/livekit-server:latest')) {
    errors.push('docker-compose.yml must not use livekit/livekit-server:latest.');
  }
  if (!compose.includes('livekit/livekit-server:v1.13.7')) {
    errors.push('docker-compose.yml must pin the approved LiveKit server version.');
  }

  const required = [
    'deploy/production/livekit.yaml.example',
    'deploy/production/env.production.example',
    'docs/DEPLOYMENT.md',
    'apps/app/lib/version.ts',
    'apps/app/lib/invite-token.ts',
    'apps/app/lib/ai-budget.ts',
    'apps/app/app/api/invite/route.ts',
    'apps/app/app/api/health/route.ts',
    'apps/app/app/api/ready/route.ts',
    'scripts/runtime-smoke.mjs',
  ];
  for (const relative of required) {
    if (!exists(relative)) errors.push(`Missing required production file: ${relative}`);
  }

  if (exists('deploy/production/livekit.yaml.example')) {
    const livekit = read('deploy/production/livekit.yaml.example');
    if (!livekit.includes('use_external_ip: true')) errors.push('Production LiveKit template must enable use_external_ip.');
    if (!livekit.includes('turn:') || !livekit.includes('enabled: true')) errors.push('Production LiveKit template must enable TURN.');
    if (!livekit.includes('tls_port: 443')) errors.push('Production LiveKit template must expose TURN/TLS on 443.');
  }

  const ci = read('.github/workflows/ci.yml');
  for (const check of ['pnpm test', 'pnpm readiness:template', 'docker compose config', 'pnpm typecheck', 'pnpm build', 'pnpm smoke:runtime']) {
    if (!ci.includes(check)) errors.push(`CI is missing required gate: ${check}`);
  }

  const health = read('apps/app/app/api/health/route.ts');
  if (!health.includes('VEYLO_VERSION')) errors.push('Health endpoint must use the centralized VEYLO_VERSION constant.');

  const connection = read('apps/app/app/api/connection-details/route.ts');
  if (!connection.includes('verifyInviteToken')) errors.push('Connection route must verify signed invite tokens.');

  return errors;
}
