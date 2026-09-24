import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { validateProductionEnv, validateRepository } from '../scripts/readiness-lib.mjs';

const goodEnv = {
  APP_URL: 'https://veylo.example.com',
  LIVEKIT_URL: 'wss://rtc.example.com',
  LIVEKIT_API_KEY: 'prod-api-key-123',
  LIVEKIT_API_SECRET: 'a-strong-production-secret-123456',
  OPENROUTER_API_KEY: 'sk-or-v1-example-realistic-key',
};

test('secure production environment passes validation', () => {
  assert.deepEqual(validateProductionEnv(goodEnv), []);
});

test('production app URL must use HTTPS', () => {
  const errors = validateProductionEnv({ ...goodEnv, APP_URL: 'http://veylo.example.com' });
  assert.ok(errors.some((error) => error.includes('APP_URL must use https://')));
});

test('production LiveKit URL must use WSS', () => {
  const errors = validateProductionEnv({ ...goodEnv, LIVEKIT_URL: 'ws://rtc.example.com' });
  assert.ok(errors.some((error) => error.includes('LIVEKIT_URL must use wss://')));
});

test('localhost is rejected for production endpoints', () => {
  const errors = validateProductionEnv({
    ...goodEnv,
    APP_URL: 'https://localhost:8080',
    LIVEKIT_URL: 'wss://localhost:7880',
  });
  assert.ok(errors.some((error) => error.includes('APP_URL must not point to localhost')));
  assert.ok(errors.some((error) => error.includes('LIVEKIT_URL must not point to localhost')));
});

test('development LiveKit credentials are rejected', () => {
  const errors = validateProductionEnv({
    ...goodEnv,
    LIVEKIT_API_KEY: 'devkey',
    LIVEKIT_API_SECRET: 'devsecret',
  });
  assert.ok(errors.some((error) => error.includes('LIVEKIT_API_KEY')));
  assert.ok(errors.some((error) => error.includes('LIVEKIT_API_SECRET')));
});

test('repository production templates satisfy mandatory gates', () => {
  const root = path.resolve(import.meta.dirname, '..');
  assert.deepEqual(validateRepository(root), []);
});
