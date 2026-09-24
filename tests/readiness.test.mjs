import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { validateProductionEnv, validateRepository } from '../scripts/readiness-lib.mjs';

const goodEnv = {
  VEYLO_STRICT_PRODUCTION: 'true',
  APP_URL: 'https://veylo.example.com',
  LIVEKIT_URL: 'wss://rtc.example.com',
  LIVEKIT_API_KEY: 'prod-api-key-123',
  LIVEKIT_API_SECRET: 'a-strong-production-secret-123456',
  VEYLO_INVITE_SECRET: 'a-random-invite-secret-longer-than-32-characters',
  OPENROUTER_API_KEY: 'sk-or-v1-example-realistic-key',
  VEYLO_AI_MAX_REQUESTS_PER_HOUR: '1200',
  VEYLO_AI_MAX_TRACKED_COST_USD_PER_DAY: '10',
};

test('secure production environment passes validation', () => {
  assert.deepEqual(validateProductionEnv(goodEnv), []);
});

test('strict production mode is mandatory', () => {
  const errors = validateProductionEnv({ ...goodEnv, VEYLO_STRICT_PRODUCTION: 'false' });
  assert.ok(errors.some((error) => error.includes('VEYLO_STRICT_PRODUCTION')));
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

test('production invite secret is required and must be strong enough', () => {
  const missing = validateProductionEnv({ ...goodEnv, VEYLO_INVITE_SECRET: '' });
  assert.ok(missing.some((error) => error.includes('VEYLO_INVITE_SECRET is required')));

  const short = validateProductionEnv({ ...goodEnv, VEYLO_INVITE_SECRET: 'too-short' });
  assert.ok(short.some((error) => error.includes('at least 32 characters')));

  const placeholder = validateProductionEnv({ ...goodEnv, VEYLO_INVITE_SECRET: 'replace-me-with-a-long-random-invite-secret' });
  assert.ok(placeholder.some((error) => error.includes('placeholder')));
});

test('production AI budget caps are mandatory and positive', () => {
  const requestCap = validateProductionEnv({ ...goodEnv, VEYLO_AI_MAX_REQUESTS_PER_HOUR: '0' });
  assert.ok(requestCap.some((error) => error.includes('VEYLO_AI_MAX_REQUESTS_PER_HOUR')));

  const costCap = validateProductionEnv({ ...goodEnv, VEYLO_AI_MAX_TRACKED_COST_USD_PER_DAY: '-1' });
  assert.ok(costCap.some((error) => error.includes('VEYLO_AI_MAX_TRACKED_COST_USD_PER_DAY')));
});

test('repository production templates satisfy mandatory gates', () => {
  const root = path.resolve(import.meta.dirname, '..');
  assert.deepEqual(validateRepository(root), []);
});
