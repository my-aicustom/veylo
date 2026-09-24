import { NextResponse } from 'next/server';

type AiBudgetState = {
  hourKey: string;
  hourCount: number;
  dayKey: string;
  trackedCostUsd: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __veyloAiBudget: AiBudgetState | undefined;
}

function hourKey(now = new Date()) {
  return now.toISOString().slice(0, 13);
}

function dayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function positiveNumber(name: string) {
  const value = Number(process.env[name] || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function state() {
  const now = new Date();
  const currentHour = hourKey(now);
  const currentDay = dayKey(now);
  const existing = globalThis.__veyloAiBudget;

  if (!existing) {
    globalThis.__veyloAiBudget = {
      hourKey: currentHour,
      hourCount: 0,
      dayKey: currentDay,
      trackedCostUsd: 0,
    };
  } else {
    if (existing.hourKey !== currentHour) {
      existing.hourKey = currentHour;
      existing.hourCount = 0;
    }
    if (existing.dayKey !== currentDay) {
      existing.dayKey = currentDay;
      existing.trackedCostUsd = 0;
    }
  }

  return globalThis.__veyloAiBudget!;
}

export function guardAiBudget() {
  const current = state();
  const maxRequestsPerHour = positiveNumber('VEYLO_AI_MAX_REQUESTS_PER_HOUR');
  const maxTrackedCostUsdPerDay = positiveNumber('VEYLO_AI_MAX_TRACKED_COST_USD_PER_DAY');

  if (maxRequestsPerHour > 0 && current.hourCount >= maxRequestsPerHour) {
    return NextResponse.json(
      { error: 'AI request budget reached for this hour. Try again later.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  if (maxTrackedCostUsdPerDay > 0 && current.trackedCostUsd >= maxTrackedCostUsdPerDay) {
    return NextResponse.json(
      { error: 'Daily tracked AI cost budget reached.' },
      { status: 429, headers: { 'Retry-After': '3600' } },
    );
  }

  current.hourCount += 1;
  return null;
}

export function recordAiUsage(payload: any) {
  const cost = Number(payload?.usage?.cost);
  if (!Number.isFinite(cost) || cost <= 0) return;
  state().trackedCostUsd += cost;
}

export function aiBudgetSnapshot() {
  const current = state();
  return {
    requestsThisHour: current.hourCount,
    maxRequestsPerHour: positiveNumber('VEYLO_AI_MAX_REQUESTS_PER_HOUR') || null,
    trackedCostUsdToday: Number(current.trackedCostUsd.toFixed(6)),
    maxTrackedCostUsdPerDay: positiveNumber('VEYLO_AI_MAX_TRACKED_COST_USD_PER_DAY') || null,
    note: 'Tracked cost includes provider responses that report usage.cost; request caps also protect endpoints where cost is not returned inline.',
  };
}
