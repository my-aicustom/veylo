import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('all runtime API routes exist', () => {
  const routes = [
    'apps/app/app/api/connection-details/route.ts',
    'apps/app/app/api/health/route.ts',
    'apps/app/app/api/mediate/route.ts',
    'apps/app/app/api/simulate/route.ts',
    'apps/app/app/api/stt/route.ts',
    'apps/app/app/api/translate/route.ts',
    'apps/app/app/api/tts/route.ts',
  ];
  for (const route of routes) assert.ok(fs.existsSync(path.join(root, route)), route);
});

test('OpenRouter secret remains server-side', () => {
  const browserFiles = [
    'apps/app/app/page.tsx',
    'apps/app/components/ProfileForm.tsx',
    'apps/app/lib/client-ai.ts',
  ];
  for (const file of browserFiles) {
    const source = read(file);
    assert.equal(source.includes('OPENROUTER_API_KEY'), false, file);
    assert.equal(source.includes('openrouter.ai'), false, file);
  }
});

test('health endpoint version is centralized', () => {
  const health = read('apps/app/app/api/health/route.ts');
  const version = read('apps/app/lib/version.ts');
  assert.ok(health.includes('VEYLO_VERSION'));
  assert.ok(version.includes("'0.5.0'"));
});

test('LiveKit runtime image is pinned', () => {
  const compose = read('docker-compose.yml');
  assert.ok(compose.includes('livekit/livekit-server:v1.13.7'));
  assert.equal(compose.includes('livekit/livekit-server:latest'), false);
});

test('public homepage still exposes all three conversation modes', () => {
  const homepage = read('apps/site/src/pages/index.astro');
  for (const label of ['Live Call', 'Face-to-Face', 'AI Simulation']) assert.ok(homepage.includes(label));
});
