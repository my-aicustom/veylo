import { NextResponse } from 'next/server';
import { createClient } from 'redis';

type AiBudgetState = { hourKey: string; hourCount: number; dayKey: string; trackedCostUsd: number };
type RedisClient = ReturnType<typeof createBudgetClient>;

declare global {
  // eslint-disable-next-line no-var
  var __veyloAiBudget: AiBudgetState | undefined;
  // eslint-disable-next-line no-var
  var __veyloBudgetRedis: Promise<RedisClient> | undefined;
}

const reserveScript = `
local count = tonumber(redis.call('GET', KEYS[1]) or '0')
local cost = tonumber(redis.call('GET', KEYS[2]) or '0')
if tonumber(ARGV[1]) > 0 and count >= tonumber(ARGV[1]) then return 1 end
if tonumber(ARGV[2]) > 0 and cost >= tonumber(ARGV[2]) then return 2 end
redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], 7200)
return 0`;

function positiveNumber(name: string) {
  const value = Number(process.env[name] || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function keys(now = new Date()) {
  const iso = now.toISOString();
  return { hour: `veylo:ai:requests:${iso.slice(0, 13)}`, day: `veylo:ai:cost:${iso.slice(0, 10)}` };
}

function redisUrl() { return process.env.VEYLO_REDIS_URL?.trim(); }

function createBudgetClient(url: string) {
  return createClient({ url, socket: { connectTimeout: 3000, reconnectStrategy: false } });
}

async function redis() {
  const url = redisUrl();
  if (!url) throw new Error('VEYLO_REDIS_URL is not configured');
  if (!globalThis.__veyloBudgetRedis) {
    const client = createBudgetClient(url);
    client.on('error', () => {});
    client.on('end', () => { globalThis.__veyloBudgetRedis = undefined; });
    globalThis.__veyloBudgetRedis = client.connect().then(() => client).catch((error) => {
      globalThis.__veyloBudgetRedis = undefined;
      throw error;
    });
  }
  return globalThis.__veyloBudgetRedis!;
}

function localState() {
  const now = new Date();
  const hourKey = now.toISOString().slice(0, 13);
  const dayKey = now.toISOString().slice(0, 10);
  const current = globalThis.__veyloAiBudget ??= { hourKey, hourCount: 0, dayKey, trackedCostUsd: 0 };
  if (current.hourKey !== hourKey) { current.hourKey = hourKey; current.hourCount = 0; }
  if (current.dayKey !== dayKey) { current.dayKey = dayKey; current.trackedCostUsd = 0; }
  return current;
}

export async function guardAiBudget() {
  const maxRequests = positiveNumber('VEYLO_AI_MAX_REQUESTS_PER_HOUR');
  const maxCost = positiveNumber('VEYLO_AI_MAX_TRACKED_COST_USD_PER_DAY');
  let blocked = 0;
  if (redisUrl()) {
    try {
      const client = await redis();
      const { hour, day } = keys();
      blocked = Number(await client.eval(reserveScript, {
        keys: [hour, day], arguments: [String(maxRequests), String(maxCost)],
      }));
    } catch {
      return NextResponse.json({ error: 'AI budget store unavailable. Try again later.' }, { status: 503 });
    }
  } else if (process.env.VEYLO_STRICT_PRODUCTION === 'true') {
    return NextResponse.json({ error: 'AI budget store is not configured.' }, { status: 503 });
  } else {
    const state = localState();
    blocked = maxRequests > 0 && state.hourCount >= maxRequests ? 1 : maxCost > 0 && state.trackedCostUsd >= maxCost ? 2 : 0;
    if (!blocked) state.hourCount += 1;
  }
  if (blocked === 1) return NextResponse.json({ error: 'AI request budget reached for this hour.' }, { status: 429, headers: { 'Retry-After': '60' } });
  if (blocked === 2) return NextResponse.json({ error: 'Daily tracked AI cost budget reached.' }, { status: 429, headers: { 'Retry-After': '3600' } });
  return null;
}

export async function recordAiUsage(payload: any) {
  const cost = Number(payload?.usage?.cost);
  if (!Number.isFinite(cost) || cost <= 0) return;
  if (redisUrl()) {
    try {
      const client = await redis();
      const { day } = keys();
      await client.incrByFloat(day, cost);
      await client.expire(day, 172800);
    } catch {
      console.error('[ai-budget] Could not record provider cost');
    }
  } else {
    localState().trackedCostUsd += cost;
  }
}

export async function aiBudgetSnapshot() {
  let hourCount: number;
  let trackedCostUsd: number;
  let store: 'redis' | 'memory' | 'unavailable';
  if (redisUrl()) {
    try {
      const client = await redis();
      const { hour, day } = keys();
      const values = await client.mGet([hour, day]);
      hourCount = Number(values[0] || 0);
      trackedCostUsd = Number(values[1] || 0);
      store = 'redis';
    } catch {
      hourCount = 0; trackedCostUsd = 0; store = 'unavailable';
    }
  } else {
    const state = localState();
    hourCount = state.hourCount;
    trackedCostUsd = state.trackedCostUsd;
    store = process.env.VEYLO_STRICT_PRODUCTION === 'true' ? 'unavailable' : 'memory';
  }
  return {
    requestsThisHour: hourCount,
    maxRequestsPerHour: positiveNumber('VEYLO_AI_MAX_REQUESTS_PER_HOUR') || null,
    trackedCostUsdToday: Number(trackedCostUsd.toFixed(6)),
    maxTrackedCostUsdPerDay: positiveNumber('VEYLO_AI_MAX_TRACKED_COST_USD_PER_DAY') || null,
    store,
    note: 'Tracked cost includes provider responses that report usage.cost; request caps also protect endpoints where cost is not returned inline.',
  };
}
