import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const appRequire = createRequire(resolve('apps/app/package.json'));
const ts = appRequire('typescript');

test('streamed speech keeps reading when the first MP3 chunk cannot start playback', async () => {
  let activeAudio;
  let activeMediaSource;
  let chunksRead = 0;
  let chunksAppended = 0;

  class FakeAudio extends EventTarget {
    constructor() {
      super();
      activeAudio = this;
      this.playPromise = new Promise((resolvePlay) => { this.resolvePlay = resolvePlay; });
    }
    play() { return this.playPromise; }
    pause() {}
    removeAttribute() {}
  }

  class FakeSourceBuffer extends EventTarget {
    updating = false;
    set mode(value) { this.bufferMode = value; }
    appendBuffer() {
      chunksAppended += 1;
      this.updating = true;
      setTimeout(() => {
        this.updating = false;
        this.dispatchEvent(new Event('updateend'));
        if (chunksAppended >= 2) activeAudio.resolvePlay();
      }, 0);
    }
  }

  class FakeMediaSource extends EventTarget {
    static isTypeSupported() { return true; }
    readyState = 'closed';
    constructor() {
      super();
      activeMediaSource = this;
    }
    addSourceBuffer() { return new FakeSourceBuffer(); }
    endOfStream() {
      this.readyState = 'ended';
      setTimeout(() => activeAudio.dispatchEvent(new Event('ended')), 0);
    }
  }

  const source = readFileSync(resolve('apps/app/lib/client-ai.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const browser = {
    exports,
    require: (name) => {
      if (name === './paths') return { apiUrl: (path) => path };
      throw new Error(`Unexpected import: ${name}`);
    },
    window: { setTimeout, clearTimeout },
    setTimeout,
    clearTimeout,
    performance,
    AbortController,
    MediaSource: FakeMediaSource,
    Audio: FakeAudio,
    URL: {
      createObjectURL: () => {
        setTimeout(() => {
          activeMediaSource.readyState = 'open';
          activeMediaSource.dispatchEvent(new Event('sourceopen'));
        }, 0);
        return 'blob:fake-audio';
      },
      revokeObjectURL() {},
    },
    fetch: async () => ({
      ok: true,
      headers: { get: (name) => name === 'content-type' ? 'audio/mpeg' : null },
      body: {
        getReader: () => ({
          read: async () => {
            chunksRead += 1;
            if (chunksRead <= 2) return { done: false, value: new Uint8Array(384) };
            return { done: true };
          },
          releaseLock() {},
        }),
      },
    }),
  };
  vm.runInNewContext(compiled, browser, { filename: 'client-ai.js' });

  const result = await Promise.race([
    exports.playSpeech('Halo').then(() => 'completed'),
    new Promise((resolveTimeout) => setTimeout(() => resolveTimeout('stalled'), 250)),
  ]);

  assert.equal(result, 'completed');
  assert.equal(chunksRead, 3);
});

test('speech retries buffered playback if MediaSource rejects the codec', async () => {
  let requests = 0;
  class FakeAudio extends EventTarget {
    play() {
      setTimeout(() => this.dispatchEvent(new Event('ended')), 0);
      return Promise.resolve();
    }
    pause() {}
    removeAttribute() {}
  }
  class FakeMediaSource extends EventTarget {
    static isTypeSupported() { return true; }
    readyState = 'closed';
    constructor() { super(); active = this; }
    addSourceBuffer() { throw new Error('NotSupportedError'); }
    endOfStream() {}
  }
  let active;
  const source = readFileSync(resolve('apps/app/lib/client-ai.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => name === './paths' ? { apiUrl: (path) => path } : undefined,
    window: { setTimeout, clearTimeout }, performance, AbortController,
    MediaSource: FakeMediaSource, Audio: FakeAudio,
    URL: {
      createObjectURL: () => {
        setTimeout(() => { active.readyState = 'open'; active.dispatchEvent(new Event('sourceopen')); }, 0);
        return 'blob:fake';
      },
      revokeObjectURL() {},
    },
    console: { warn() {} },
    fetch: async () => {
      requests += 1;
      return {
        ok: true,
        headers: { get: () => 'audio/mpeg' },
        body: {},
        blob: async () => new Blob(['audio']),
      };
    },
  }, { filename: 'client-ai.js' });
  const result = await exports.playSpeech('Hello');
  assert.equal(result.mode, 'buffered');
  assert.equal(requests, 2);
});
