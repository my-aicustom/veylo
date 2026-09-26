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
    'apps/app/app/api/intelligence/route.ts',
    'apps/app/app/api/invite/route.ts',
    'apps/app/app/api/mediate/route.ts',
    'apps/app/app/api/ready/route.ts',
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

  assert.equal(rootPackage.version, '1.3.0');
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

test('room access has both validation and signed-invite enforcement', () => {
  const route = read('apps/app/app/api/connection-details/route.ts');
  const inviteRoute = read('apps/app/app/api/invite/route.ts');
  const inviteLib = read('apps/app/lib/invite-token.ts');

  assert.ok(route.includes('ROOM_PATTERN'));
  assert.ok(route.includes('verifyInviteToken'));
  assert.ok(route.includes('A valid Veylo invite link is required'));
  assert.ok(inviteRoute.includes('createInviteToken'));
  assert.ok(inviteLib.includes('createHmac'));
  assert.ok(inviteLib.includes('timingSafeEqual'));
});

test('AI routes use the global request budget guard', () => {
  for (const file of [
    'apps/app/app/api/stt/route.ts',
    'apps/app/app/api/translate/route.ts',
    'apps/app/app/api/tts/route.ts',
    'apps/app/app/api/simulate/route.ts',
    'apps/app/app/api/mediate/route.ts',
    'apps/app/app/api/intelligence/route.ts',
  ]) {
    assert.ok(read(file).includes('guardAiBudget'), file);
  }
});

test('runtime readiness and smoke test exist', () => {
  assert.ok(read('apps/app/app/api/ready/route.ts').includes('ready'));
  assert.ok(read('scripts/runtime-smoke.mjs').includes('RUNTIME SMOKE PASSED'));
});

test('app and reverse proxy enforce the production security-header baseline', () => {
  const nginx = read('deploy/nginx.conf');
  const nextConfig = read('apps/app/next.config.mjs');
  const tlsTemplate = read('deploy/production/nginx-tls.conf.example');

  for (const header of [
    'Content-Security-Policy',
    'Strict-Transport-Security',
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Referrer-Policy',
    'Permissions-Policy',
  ]) {
    assert.ok(nginx.includes(header), `nginx: ${header}`);
    assert.ok(nextConfig.includes(header), `next: ${header}`);
    assert.ok(tlsTemplate.includes(header), `tls template: ${header}`);
  }

  assert.ok(nginx.includes('server_tokens off'));
  assert.ok(nextConfig.includes('poweredByHeader: false'));
  assert.ok(nginx.includes('X-Frame-Options "DENY"'));
});

test('release handoff documents exist', () => {
  for (const file of ['RELEASE_STATUS.md', 'docs/LOCAL_TEST.md', 'docs/ACCEPTANCE.md', 'docs/DEPLOYMENT.md', 'docs/FIELD_ACCEPTANCE.md']) {
    assert.ok(fs.existsSync(path.join(root, file)), file);
  }
});

test('public homepage still exposes all three conversation modes', () => {
  const homepage = read('apps/site/src/pages/index.astro');
  for (const label of ['Live Call', 'Face-to-Face', 'AI Simulation']) assert.ok(homepage.includes(label));
});

test('trade advisor dual-entry, voice consultation, and my-aicustom branding are wired', () => {
  assert.ok(fs.existsSync(path.join(root, 'apps/app/public/my-aicustom-logo.webp')));

  const brand = read('apps/app/components/BrandMark.tsx');
  const home = read('apps/app/app/page.tsx');
  const voiceOrb = read('apps/app/components/VoiceOrb.tsx');
  const visualCanvas = read('apps/app/components/VisualCanvas.tsx');
  const consultation = read('apps/app/app/consultation/page.tsx');

  assert.ok(brand.includes('Powered by my-aicustom'));
  assert.ok(brand.includes('https://my-aicustom.com'));
  assert.ok(home.includes('Konsultasi Suara Interaktif'));
  assert.ok(home.includes('/consultation'));
  assert.ok(home.includes('https://wa.me/6289660152525'));
  assert.ok(home.includes('Live Call'));
  assert.ok(voiceOrb.includes("status: 'idle' | 'listening' | 'thinking' | 'speaking'"));
  assert.ok(visualCanvas.includes('Tanjung Priok'));
  assert.ok(visualCanvas.includes('HS 0901.11'));
  assert.ok(visualCanvas.includes('Export Ready'));
  assert.ok(consultation.includes('PhraseRecorder'));
  assert.ok(consultation.includes('Chat via WhatsApp'));
  assert.ok(consultation.includes('VisualCanvas'));
});


test('original business-meeting intelligence scope is implemented', () => {
  const route = read('apps/app/app/api/intelligence/route.ts');
  const prompts = read('apps/app/lib/ai/prompts.ts');
  const panel = read('apps/app/components/InterpreterPanel.tsx');
  const faceToFace = read('apps/app/app/face-to-face/page.tsx');

  for (const field of ['commercialItems', 'commitments', 'actionItems', 'followUps', 'openQuestions', 'risksOrAmbiguities']) {
    assert.ok(route.includes(field), `intelligence route: ${field}`);
  }
  assert.ok(prompts.includes('meetingIntelligenceSystem'));
  assert.ok(prompts.includes('prices, currencies'));
  assert.ok(panel.includes('Generate meeting brief'));
  assert.ok(faceToFace.includes('Meeting brief'));
});

test('spoken language remains auto-detected instead of being hard-mapped from country', () => {
  const remote = read('apps/app/lib/use-remote-interpreter.ts');
  const faceToFace = read('apps/app/app/face-to-face/page.tsx');
  const profile = read('apps/app/components/ProfileForm.tsx');
  assert.ok(remote.includes('normalizeDetectedLanguage(stt.language)'));
  assert.ok(faceToFace.includes('normalizeDetectedLanguage(stt.language)'));
  assert.ok(profile.includes('Country is only a language hint'));
});

test('external mic and translated-audio output routing are present', () => {
  const faceToFace = read('apps/app/app/face-to-face/page.tsx');
  const clientAi = read('apps/app/lib/client-ai.ts');
  const audioDevices = read('apps/app/lib/audio-devices.ts');
  assert.ok(faceToFace.includes('Microphone input'));
  assert.ok(faceToFace.includes('Translated audio output'));
  assert.ok(faceToFace.includes('deviceId: { exact: inputDeviceId }'));
  assert.ok(clientAi.includes('setSinkId'));
  assert.ok(audioDevices.includes('audiooutput'));
});


test('country and language context covers the full international dataset', () => {
  const countries = read('apps/app/lib/countries.ts');
  const countryCount = (countries.match(/\{"code":/g) || []).length;
  const languageHintCount = (countries.match(/^  "[A-Z][A-Z]": \[/gm) || []).length;
  assert.ok(countryCount >= 240, `country count ${countryCount}`);
  assert.ok(languageHintCount >= 240, `language hint country count ${languageHintCount}`);
  assert.ok(countries.includes('normalizeDetectedLanguage'));
});

test('runtime inference stays OpenRouter-only', () => {
  const runtime = [
    read('apps/app/lib/ai/openrouter.ts'),
    read('apps/app/app/api/stt/route.ts'),
    read('apps/app/app/api/translate/route.ts'),
    read('apps/app/app/api/tts/route.ts'),
    read('apps/app/app/api/simulate/route.ts'),
    read('apps/app/app/api/intelligence/route.ts'),
  ].join('\n').toLowerCase();
  for (const forbidden of ['ollama', 'nllb', 'piper tts', 'local model']) {
    assert.equal(runtime.includes(forbidden), false, forbidden);
  }
  assert.ok(runtime.includes('openrouter'));
});


test('live-call transcript includes the local microphone side', () => {
  const remote = read('apps/app/lib/use-remote-interpreter.ts');
  assert.ok(remote.includes('processLocalPhrase'));
  assert.ok(remote.includes('RoomEvent.LocalTrackPublished'));
  assert.ok(remote.includes('Track.Source.Microphone'));
  assert.ok(remote.includes('isLocal: true'));
});


test('long business meetings retain substantially more than the original 80-turn window', () => {
  const persistence = read('apps/app/lib/transcript-persistence.ts');
  const intelligence = read('apps/app/app/api/intelligence/route.ts');
  const remote = read('apps/app/lib/use-remote-interpreter.ts');
  const faceToFace = read('apps/app/app/face-to-face/page.tsx');
  assert.ok(persistence.includes('MAX_TRANSCRIPT_TURNS = 500'));
  assert.ok(intelligence.includes('slice(-500)'));
  assert.ok(remote.includes('trimTranscript([...turnsRef.current, turn])'));
  assert.ok(faceToFace.includes('trimTranscript(update(current))'));
});

test('protected glossary is wired from both interpreter UIs into translation requests', () => {
  const glossary = read('apps/app/lib/session-glossary.ts');
  const client = read('apps/app/lib/client-ai.ts');
  const route = read('apps/app/app/api/translate/route.ts');
  const panel = read('apps/app/components/InterpreterPanel.tsx');
  const faceToFace = read('apps/app/app/face-to-face/page.tsx');
  assert.ok(glossary.includes('MAX_TERMS = 40'));
  assert.ok(client.includes('glossary?: string[]'));
  assert.ok(route.includes('body.glossary'));
  assert.ok(panel.includes('Protected terms / glossary'));
  assert.ok(faceToFace.includes('Protected terms / glossary'));
});

test('realtime interpretation preserves transcript on translation failure and prevents stale TTS backlog', () => {
  const remote = read('apps/app/lib/use-remote-interpreter.ts');
  const types = read('apps/app/lib/types.ts');
  assert.ok(types.includes("translationState?: 'translated' | 'same-language' | 'failed' | 'source-only'"));
  assert.ok(remote.includes("translationState = 'failed'"));
  assert.ok(remote.includes('maxSpeechQueue = 2'));
  assert.ok(remote.includes('maxPlaybackAgeMs = 7_000'));
  assert.equal(remote.includes('await speechQueue.current'), false);
});

test('Face-to-Face supports manual speaker attribution for same-language conversations', () => {
  const faceToFace = read('apps/app/app/face-to-face/page.tsx');
  assert.ok(faceToFace.includes("speakerMode !== 'auto'"));
  assert.ok(faceToFace.includes('Speaker attribution'));
  assert.ok(faceToFace.includes('Auto by language'));
});

test('AI Simulation persists practice history and supports explicit audio devices', () => {
  const page = read('apps/app/app/simulation/page.tsx');
  const persistence = read('apps/app/lib/simulation-persistence.ts');
  assert.ok(page.includes('loadSimulation(sessionId)'));
  assert.ok(page.includes('downloadSimulation'));
  assert.ok(page.includes('Microphone input'));
  assert.ok(page.includes('AI voice output'));
  assert.ok(page.includes('await transcribe(bytes, undefined,'));
  assert.ok(persistence.includes('MAX_TURNS = 160'));
});

test('browser API retry distinguishes transient failures from deterministic client errors', () => {
  const client = read('apps/app/lib/client-ai.ts');
  assert.ok(client.includes('ClientRequestError'));
  assert.ok(client.includes('response.status === 408'));
  assert.ok(client.includes('response.status === 429'));
  assert.ok(client.includes('response.status >= 500'));
  assert.ok(client.includes('if (!retryable || attempt === attempts - 1) throw error'));
});


test('AI mediator is throttled instead of firing on every pair of turns', () => {
  const remote = read('apps/app/lib/use-remote-interpreter.ts');
  assert.ok(remote.includes('nextTurns.length % 4 !== 0'));
  assert.ok(remote.includes('15_000'));
  assert.ok(remote.includes('mediatorBusy.current'));
  assert.ok(remote.includes('mediatorLastAt.current'));
});


test('production acceptance validates deployed hardening beyond basic reachability', () => {
  const acceptance = read('scripts/production-acceptance.mjs');
  assert.ok(acceptance.includes('--expected-version'));
  assert.ok(acceptance.includes('Cross-origin API rejection'));
  assert.ok(acceptance.includes('Invalid invite payload rejection'));
  assert.ok(acceptance.includes('CSP blocks framing'));
  assert.ok(acceptance.includes('Permissions policy scopes camera/mic'));
  assert.ok(acceptance.includes('Runtime version consistency'));
});

test('safe HTTP capacity probe exists without paid AI or room creation', () => {
  const probe = read('scripts/capacity-probe.mjs');
  const rootPackage = JSON.parse(read('package.json'));
  assert.equal(rootPackage.scripts['capacity:probe'], 'node scripts/capacity-probe.mjs');
  assert.ok(probe.includes('p95'));
  assert.ok(probe.includes('requestsPerSecond'));
  assert.ok(probe.includes('maxErrorRate'));
  assert.equal(probe.includes('/api/stt'), false);
  assert.equal(probe.includes('/api/translate'), false);
  assert.equal(probe.includes('/api/tts'), false);
  assert.equal(probe.includes('/api/invite'), false);
});

test('diagnostics exports privacy-safe field evidence and browser capability checks', () => {
  const diagnostics = read('apps/app/app/diagnostics/page.tsx');
  assert.ok(diagnostics.includes('Export field report'));
  assert.ok(diagnostics.includes('outputRouting'));
  assert.ok(diagnostics.includes('AudioWorkletNode'));
  assert.ok(diagnostics.includes('networkType'));
  assert.ok(diagnostics.includes('networkEvents'));
  assert.ok(diagnostics.includes('No transcript text, microphone audio, API key, LiveKit secret, or invite secret is included.'));
});

test('live-call network resilience events are retained for field diagnostics', () => {
  const health = read('apps/app/components/CallHealth.tsx');
  const telemetry = read('apps/app/lib/network-telemetry.ts');
  for (const event of ['reconnecting', 'reconnected', 'offline', 'online', 'quality-poor', 'quality-lost']) {
    assert.ok(health.includes(`'${event}'`) || telemetry.includes(`'${event}'`), event);
  }
  assert.ok(telemetry.includes('MAX_EVENTS = 120'));
  assert.ok(telemetry.includes('localStorage'));
});

test('CI checks deployment tooling and names artifacts from the current version', () => {
  const ci = read('.github/workflows/ci.yml');
  assert.ok(ci.includes('pnpm capacity:probe -- --help'));
  assert.ok(ci.includes('RELEASE_NAME=veylo-v${VERSION}-${GITHUB_SHA}'));
  assert.ok(ci.includes('name: ${{ env.RELEASE_NAME }}'));
  assert.equal(ci.includes('name: veylo-v1.1.0-${{ github.sha }}'), false);
});

test('production infrastructure has a static validator gate', () => {
  const infra = read('scripts/infrastructure-check.mjs');
  const rootPackage = JSON.parse(read('package.json'));
  const ci = read('.github/workflows/ci.yml');
  assert.equal(rootPackage.scripts['infra:check'], 'node scripts/infrastructure-check.mjs');
  assert.equal(rootPackage.scripts['infra:check:template'], 'node scripts/infrastructure-check.mjs --template');
  assert.ok(infra.includes('use_external_ip'));
  assert.ok(infra.includes('TURN enabled'));
  assert.ok(infra.includes('Real IP overwritten from socket peer'));
  assert.ok(ci.includes('pnpm infra:check:template'));
});
