import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(resolve('apps/app/package.json'));
const ts = require('typescript');
const code = ts.transpileModule(readFileSync(resolve('apps/app/lib/echo-guard.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
vm.runInNewContext(code, { exports }, { filename: 'echo-guard.js' });

test('echo guard recognizes Unicode, transcription variation, and expiry', () => {
  const at = 100_000;
  const spoken = [{ text: 'こんにちは、ありがとうございます。', at }];
  assert.equal(exports.isRecentSpeechEcho('こんにちは ありがとうございます', spoken, at + 900), true);
  assert.equal(exports.isRecentSpeechEcho('こんにちは ありがとう', spoken, at + 900), true);
  assert.equal(exports.isRecentSpeechEcho('別の話を始めましょう', spoken, at + 900), false);
  assert.equal(exports.isRecentSpeechEcho('こんにちは、ありがとうございます。', spoken, at + 7_000), false);
});

test('echo guard does not discard unrelated nearby speech', () => {
  const spoken = [{ text: 'Please send fifty industrial lamps to Jakarta', at: 10 }];
  assert.equal(exports.isRecentSpeechEcho('What is the delivery date?', spoken, 500), false);
  assert.equal(exports.isRecentSpeechEcho('Please send fifty industrial lamps to Jakarta', spoken, 500), true);
});
