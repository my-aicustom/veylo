import fs from 'node:fs';
import path from 'node:path';

const DEV_VALUES = new Set(['devkey', 'devsecret', 'changeme', 'change-me', 'replace-me']);

function present(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function devLike(value) {
  if (!present(value)) return false;
  const normalized = value.trim().toLowerCase();
  return DEV_VALUES.has(normalized) || normalized.includes('change_me') || normalized.includes('replace_me');
}

export function validateProductionEnv(env) {
  const errors = [];

  if (!present(env.APP_URL)) errors.push('APP_URL is required.');
  else if (!/^https:///i.test(env.APP_URL)) errors.push('APP_URL must use https:// in production.');
  else if (/localhost|127.0.0.1/i.test(env.APP_URL)) errors.push('APP_URL must not point to localhost in production.');

  if (!present(env.LIVEKIT_URL)) errors.push('LIVEKIT_URL is required.');
  else if (!/^wss:///i.test(env.LIVEKIT_URL)) errors.push('LIVEKIT_URL must use wss:// in production.');
  else if (/localhost|127.0.0.1/i.test(env.LIVEKIT_URL)) errors.push('LIVEKIT_URL must not point to localhost in production.');

  if (!present(env.LIVEKIT_API_KEY)) errors.push('LIVEKIT_API_KEY is required.');
  else if (devLike(env.LIVEKIT_API_KEY)) errors.push('LIVEKIT_API_KEY still uses a development/placeholder value.');

  if (!present(env.LIVEKIT_API_SECRET)) errors.push('LIVEKIT_API_SECRET is required.');
  else if (devLike(env.LIVEKIT_API_SECRET)) errors.push('LIVEKIT_API_SECRET still uses a development/placeholder value.');
  else if (env.LIVEKIT_API_SECRET.trim().length < 16) errors.push('LIVEKIT_API_SECRET is unexpectedly short for production.');

  if (!present(env.OPENROUTER_API_KEY)) errors.push('OPENROUTER_API_KEY is required.');
  else if (devLike(env.OPENROUTER_API_KEY)) errors.push('OPENROUTER_API_KEY still uses a placeholder value.');

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
  if (!/livekit/livekit-server:vd+.d+.d+/.test(compose)) {
    errors.push('docker-compose.yml must pin an explicit LiveKit server version.');
  }

  const required = [
    'deploy/production/livekit.yaml.example',
    'deploy/production/env.production.example',
    'docs/DEPLOYMENT.md',
    'apps/app/lib/version.ts',
    'apps/app/app/api/health/route.ts',
  ];
  for (const relative of required) {
    if (!exists(relative)) errors.push(`Missing required production file: ${relative}`);
  }

  if (exists('deploy/production/livekit.yaml.example')) {
    const livekit = read('deploy/production/livekit.yaml.example');
    if (!/use_external_ip:s*true/.test(livekit)) errors.push('Production LiveKit template must enable use_external_ip.');
    if (!/turn:s*[sS]*enabled:s*true/.test(livekit)) errors.push('Production LiveKit template must enable TURN.');
    if (!/tls_port:s*443/.test(livekit)) errors.push('Production LiveKit template must expose TURN/TLS on 443.');
  }

  const ci = read('.github/workflows/ci.yml');
  for (const check of ['pnpm test', 'pnpm readiness:template', 'docker compose config', 'pnpm typecheck', 'pnpm build']) {
    if (!ci.includes(check)) errors.push(`CI is missing required gate: ${check}`);
  }

  const health = read('apps/app/app/api/health/route.ts');
  if (!health.includes('VEYLO_VERSION')) errors.push('Health endpoint must use the centralized VEYLO_VERSION constant.');

  return errors;
}
