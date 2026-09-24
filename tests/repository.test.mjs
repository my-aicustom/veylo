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

test('workspace, app, site, and health version stay synchronized', () => {
  const rootPackage = JSON.parse(read('package.json'));
  const appPackage = JSON.parse(read('apps/app/package.json'));
  const sitePackage = JSON.parse(read('apps/site/package.json'));
  const versionSource = read('apps/app/lib/version.ts');

  assert.equal(rootPackage.version, '0.5.0');
  assert.equal(appPackage.version, rootPackage.version);
  assert.equal(sitePackage.version, rootPackage.version);
  assert.ok(versionSource.includes(`'${rootPackage.version}'`));
  assert.ok(read('apps/app/app/api/health/route.ts').includes('VEYLO_VERSION'));
});

test('LiveKit runtime image is pinned', () => {
  const compose = read('docker-compose.yml');
  assert.ok(compose.includes('livekit/livekit-server:v1.13.7'));
  assert.equal(compose.includes('livekit/livekit-server:latest'), false);
});

test('room token endpoint validates room names', () => {
  const route = read('apps/app/app/api/connection-details/route.ts');
  assert.ok(route.includes('ROOM_PATTERN'));
  assert.ok(route.includes('Invalid room name'));
});

test('reverse proxy includes baseline browser security headers', () => {
  const nginx = read('deploy/nginx.conf');
  for (const header of ['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy']) {
    assert.ok(nginx.includes(header), header);
  }
});

test('public homepage still exposes all three conversation modes', () => {
  const homepage = read('apps/site/src/pages/index.astro');
  for (const label of ['Live Call', 'Face-to-Face', 'AI Simulation']) assert.ok(homepage.includes(label));
});
