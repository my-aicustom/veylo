import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(resolve('apps/app/package.json'));
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');
function route(name, env = {}) {
  const exports = {};
  const intervals = new Set();
  const code = ts.transpileModule(readFileSync(`apps/app/app/api/${name}/route.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    exports, process: { env }, Buffer, ReadableStream, TextEncoder, console,
    setInterval: (fn) => { intervals.add(fn); return fn; },
    clearInterval: (fn) => intervals.delete(fn),
    require: (id) => {
      if (id === '@/lib/api-guard') return { guardApi: () => null, cleanText: (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '' };
      if (id === '@/lib/invite-token') return { inviteProtectionEnabled: () => true, verifyInviteToken: () => ({ valid: false }) };
      if (id === '@/lib/ai-budget') return { guardAiBudget: async () => null, recordAiUsage: () => {} };
      if (id === '@/lib/ai/openrouter') return { chat: async () => ({ choices: [{ message: { content: '{"reply":"OK","recommendedView":"routes"}' } }] }) };
      if (id === '@/lib/ai/prompts') return { tradeAdvisorVoiceSystem: 'test' };
      return require(id);
    },
  });
  return { ...exports, intervals };
}
function request(path, body, headers = {}, signal) {
  return new NextRequest(`http://localhost/app/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), headers, signal,
  });
}

test('trade SSE authenticates push, rejects duplicate subscriber, delivers and cleans up cancellation', async () => {
  const api = route('trade-events', { VEYLO_TRADE_WEBHOOK_SECRET: 'test-only-webhook-secret' });
  const body = { sessionId: 'test-session', panel: 'route-map' };
  assert.equal((await api.POST(request('trade-events', body))).status, 401);
  const auth = { authorization: 'Bearer test-only-webhook-secret' };
  const stream = await api.GET(request('trade-events?sessionId=test-session'));
  assert.equal(stream.status, 200);
  const reader = stream.body.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value), /event: connected/);
  assert.equal((await api.GET(request('trade-events?sessionId=test-session'))).status, 409);
  assert.equal((await api.POST(request('trade-events', body, auth))).status, 200);
  assert.match(new TextDecoder().decode((await reader.read()).value), /route-map/);
  await reader.cancel();
  assert.equal(api.intervals.size, 0);
  assert.equal((await api.POST(request('trade-events', body, auth))).status, 404);
  assert.equal((await api.POST(request('trade-events', null, auth))).status, 400);
});

test('trade push fails closed without webhook configuration', async () => {
  const api = route('trade-events');
  assert.equal((await api.POST(request('trade-events', {}))).status, 503);
});

test('room token rejects null body and unsigned invitations with configured LiveKit', async () => {
  const api = route('connection-details', { LIVEKIT_URL: 'wss://example.invalid', LIVEKIT_API_KEY: 'test', LIVEKIT_API_SECRET: 'test-only' });
  assert.equal((await api.POST(request('connection-details', null))).status, 400);
  assert.equal((await api.POST(request('connection-details', { roomName: 'room123', participantName: 'Test' }))).status, 403);
});

test('PDF route rejects null and mixed currencies before rendering', async () => {
  const api = route('export-doc');
  assert.equal((await api.POST(request('export-doc', null))).status, 400);
  assert.equal((await api.POST(request('export-doc', { type: 'invalid' }))).status, 400);
  assert.equal((await api.POST(request('export-doc', { type: 'invoice', data: { items: [{ currency: 'USD' }, { currency: 'EUR' }] } }))).status, 400);
});

test('trade-chat route rejects null body and empty messages', async () => {
  const api = route('trade-chat');
  assert.equal((await api.POST(request('trade-chat', null))).status, 400);
  assert.equal((await api.POST(request('trade-chat', { message: '   ' }))).status, 400);
});

