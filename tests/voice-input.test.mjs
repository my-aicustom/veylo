import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(resolve('apps/app/package.json'));
const ts = require('typescript');
function load(file, dependencies = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(resolve(`apps/app/lib/${file}.ts`), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, require: (name) => dependencies[name], Float32Array, Uint8Array, ...globals });
  return exports;
}

const { sttVocabulary } = load('stt-vocabulary');
test('vocabulary preserves multilingual spelling, deduplicates and bounds untrusted input', () => {
  assert.deepEqual(Array.from(sttVocabulary([' Veylo ', 'veylo', null, '東京', 'FOB\nJakarta'])), ['Veylo', '東京', 'FOB Jakarta']);
  assert.equal(sttVocabulary('not an array').length, 0);
  const bounded = sttVocabulary(Array.from({ length: 200 }, (_, i) => `${i}${'x'.repeat(200)}`));
  assert.ok(bounded.length <= 40);
  assert.ok(bounded.every((term) => term.length <= 80));
  assert.ok(bounded.join('').length <= 800);
});

const { PhraseRecorder } = load('wav-recorder', { './paths': { assetUrl: (path) => path } });
function capture(options = {}) {
  const phrases = [];
  const recorder = new PhraseRecorder({ getTracks: () => [] }, { onPhrase: (phrase) => phrases.push(phrase), ...options });
  recorder.active = true;
  recorder.context = { sampleRate: 16000 };
  const feed = (amplitude, frames) => {
    for (let i = 0; i < frames; i++) recorder.handle(new Float32Array(160).fill(amplitude), 16000);
  };
  return { recorder, phrases, feed };
}

test('phrase endpoint uses audio duration even when callbacks arrive in a burst', () => {
  const { feed, phrases } = capture({ silenceMs: 650 });
  feed(0.1, 40);
  feed(0, 64);
  assert.equal(phrases.length, 0);
  feed(0, 1);
  assert.equal(phrases.length, 1);
  assert.equal(phrases[0].durationMs, 1050);
  assert.equal(String.fromCharCode(...phrases[0].bytes.slice(0, 4)), 'RIFF');
});

test('short noise plus silence is discarded, and next speech still works', () => {
  const { feed, phrases } = capture();
  feed(0.1, 2);
  feed(0, 120);
  assert.equal(phrases.length, 0);
  feed(0.1, 35);
  feed(0, 110);
  assert.equal(phrases.length, 1);
});

test('brief conversational pauses stay in one phrase and playback pause clears capture', () => {
  const { recorder, feed, phrases } = capture();
  feed(0.1, 30);
  feed(0, 30);
  feed(0.1, 30);
  feed(0, 110);
  assert.equal(phrases.length, 1);
  feed(0.1, 30);
  recorder.pause();
  feed(0.1, 100);
  recorder.resume();
  feed(0, 70);
  assert.equal(phrases.length, 1);
});

test('continuous speech is bounded and manual flush rejects a click', () => {
  const { recorder, feed, phrases } = capture({ maxPhraseMs: 1000 });
  feed(0.1, 105);
  assert.equal(phrases.length, 1);
  recorder.reset();
  feed(0.1, 1);
  recorder.flush();
  assert.equal(phrases.length, 1);
});

test('provider receives vocabulary with auto language detection and retains it on format fallback', async () => {
  const requests = [];
  const { stt } = load('ai/openrouter', { '../stt-vocabulary': { sttVocabulary } }, {
    process: { env: { OPENROUTER_API_KEY: 'test-only', STT_MODEL: 'openai/whisper-large-v3-turbo' } },
    crypto: { randomUUID: () => 'test-id' },
    console: { info() {} },
    AbortSignal: { timeout: () => undefined },
    fetch: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return requests.length === 1
        ? { ok: false, status: 400, headers: new Headers(), text: async () => 'Unsupported response_format' }
        : { ok: true, headers: new Headers(), json: async () => ({ text: 'Veylo' }) };
    },
  });
  assert.equal((await stt('audio', 'wav', undefined, ['Veylo'])).text, 'Veylo');
  assert.equal(requests.length, 2);
  for (const body of requests) {
    assert.equal(body.provider.options.groq.prompt, 'Expected vocabulary: Veylo');
    assert.equal('language' in body, false);
  }
  assert.equal('response_format' in requests[1], false);
});

function nativeProvider(content, finishReason = 'stop') {
  const requests = [];
  const { stt } = load('ai/openrouter', { '../stt-vocabulary': { sttVocabulary } }, {
    process: { env: { OPENROUTER_API_KEY: 'test-only' } },
    crypto: { randomUUID: () => 'test-id' }, console: { info() {} },
    AbortSignal: { timeout: () => undefined },
    fetch: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      return { ok: true, headers: new Headers(), json: async () => ({
        choices: [{ finish_reason: finishReason, message: { content } }], usage: { cost: 0.001 },
      }) };
    },
  });
  return { stt, requests };
}

test('native Gemini receives actual audio and returns the existing transcript contract with usage', async () => {
  const { stt, requests } = nativeProvider('{"text":"Halo Veylo 東京","language":"id"}');
  const result = await stt('UklGRg==', 'wav', undefined, ['Veylo', '東京']);
  assert.equal(result.text, 'Halo Veylo 東京');
  assert.equal(result.language, 'id');
  assert.equal(result.usage.cost, 0.001);
  assert.equal(requests[0].url, 'https://openrouter.ai/api/v1/chat/completions');
  const body = requests[0].body;
  assert.equal(body.model, 'google/gemini-2.5-flash');
  assert.equal(body.messages[1].content[1].input_audio.data, 'UklGRg==');
  assert.match(body.messages[1].content[0].text, /東京/);
  assert.equal(body.response_format.type, 'json_schema');
});

test('native response handles fenced JSON and content blocks; silence stays empty', async () => {
  const { stt } = nativeProvider([{ type: 'text', text: '```json\n{"text":"","language":null}\n```' }]);
  assert.equal((await stt('UklGRg==', 'wav')).text, '');
});

test('malformed, incomplete, or refused responses never become spoken transcripts', async () => {
  for (const content of ['Hello there', '{"text":42,"language":"en"}', '{"text":"hi","language":"English"}', null]) {
    await assert.rejects(() => nativeProvider(content).stt('UklGRg==', 'wav'), /transcription/i);
  }
  await assert.rejects(() => nativeProvider('{"text":"cut off","language":"en"}', 'length').stt('UklGRg==', 'wav'), /transcription/i);
});

test('natural VAD retains a 900ms thinking pause and a sentence longer than five seconds', () => {
  const { feed, phrases } = capture();
  feed(0.1, 300);
  feed(0, 90);
  feed(0.1, 300);
  assert.equal(phrases.length, 0);
  feed(0, 110);
  assert.equal(phrases.length, 1);
});

test('VAD follows quiet trailing speech using hysteresis and suppresses isolated clicks', () => {
  const { feed, phrases } = capture();
  feed(0.1, 30);
  feed(0.013, 140);
  assert.equal(phrases.length, 0);
  feed(0, 110);
  assert.equal(phrases.length, 1);
  for (let i = 0; i < 20; i++) { feed(0.1, 1); feed(0, 10); }
  feed(0, 110);
  assert.equal(phrases.length, 1);
});

test('stop during worklet initialization cannot resurrect capture or attach callbacks', async () => {
  let resolveModule;
  let nodes = 0;
  let stopped = 0;
  class Context {
    state = 'running'; sampleRate = 48000;
    audioWorklet = { addModule: () => new Promise((resolve) => { resolveModule = resolve; }) };
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    close() { this.state = 'closed'; return Promise.resolve(); }
  }
  const { PhraseRecorder: Recorder } = load('wav-recorder', { './paths': { assetUrl: (path) => path } }, {
    AudioContext: Context, AudioWorkletNode: class { constructor() { nodes++; } }, console,
  });
  const recorder = new Recorder({ getTracks: () => [{ stop() { stopped++; } }] }, { onPhrase() {} });
  const start = recorder.start();
  recorder.stop();
  resolveModule();
  await start;
  assert.equal(nodes, 0);
  assert.equal(stopped, 1);
});

test('browser never duplicates a failed audio job, but still retries transient text failures', async () => {
  let calls = 0;
  const { transcribe, translate } = load('client-ai', { './paths': { apiUrl: (path) => path } }, {
    window: { setTimeout, clearTimeout }, AbortController, btoa,
    fetch: async () => { calls++; return { ok: false, status: 503, json: async () => ({ error: 'Unavailable' }) }; },
  });
  await assert.rejects(() => transcribe(new Uint8Array([1, 2, 3])), /Unavailable/);
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(() => translate('Hello', { targetLanguage: 'id' }), /Unavailable/);
  assert.equal(calls, 2);
});

test('provider retries only transient failures and honors cancellation', async () => {
  let calls = 0;
  let status = 503;
  const { stt } = load('ai/openrouter', { '../stt-vocabulary': { sttVocabulary } }, {
    process: { env: { OPENROUTER_API_KEY: 'test-only' } }, crypto: { randomUUID: () => 'test-id' },
    console: { info() {} }, AbortSignal, setTimeout: (fn) => { fn(); },
    fetch: async () => { calls++; return { ok: false, status, headers: new Headers() }; },
  });
  await assert.rejects(() => stt('UklGRg==', 'wav'), /503/);
  assert.equal(calls, 3);
  calls = 0; status = 401;
  await assert.rejects(() => stt('UklGRg==', 'wav'), /401/);
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(() => stt('UklGRg==', 'wav', undefined, [], AbortSignal.abort()), /abort/i);
  assert.equal(calls, 0);
});
