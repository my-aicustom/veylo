import { promises as fs } from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { cleanText, guardApi } from '@/lib/api-guard';

export const runtime = 'nodejs';

type StoredDeal = {
  id: string;
  createdAt: string;
  roomName?: string;
  docType?: string;
  source?: string;
  deal: Record<string, unknown>;
};

declare global {
  // eslint-disable-next-line no-var
  var __veyloDealsStore: StoredDeal[] | undefined;
}

const memoryDeals = globalThis.__veyloDealsStore ?? [];
globalThis.__veyloDealsStore = memoryDeals;

const STORE_PATH = path.join(process.cwd(), 'deals_store.json');

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return undefined;
  if (typeof value === 'string') return cleanText(value, 1000);
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'boolean' || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 80)
        .map(([key, item]) => [cleanText(key, 80), sanitizeValue(item, depth + 1)])
        .filter(([key, item]) => key && item !== undefined),
    );
  }
  return undefined;
}

async function readDeals(): Promise<StoredDeal[]> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return memoryDeals;
    memoryDeals.splice(0, memoryDeals.length, ...parsed.slice(-500));
  } catch {
    // Keep the API usable on read-only deployments.
  }
  return memoryDeals;
}

async function persistDeals(deals: StoredDeal[]) {
  memoryDeals.splice(0, memoryDeals.length, ...deals.slice(-500));
  try {
    await fs.writeFile(STORE_PATH, JSON.stringify(memoryDeals, null, 2), 'utf8');
  } catch {
    // In-memory fallback is intentionally non-fatal.
  }
}

export async function GET(req: NextRequest) {
  const blocked = guardApi(req, 'deals-api', { limit: 60 });
  if (blocked) return blocked;

  const deals = await readDeals();
  return NextResponse.json({ deals });
}

export async function POST(req: NextRequest) {
  const blocked = guardApi(req, 'deals-api', { limit: 60 });
  if (blocked) return blocked;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const safeDeal = sanitizeValue(body.deal ?? body.data ?? body) as Record<string, unknown> | undefined;
  if (!safeDeal || typeof safeDeal !== 'object') {
    return NextResponse.json({ error: 'Invalid deal payload' }, { status: 400 });
  }

  const deals = await readDeals();
  const stored: StoredDeal = {
    id: cleanText(body.id, 100) || `deal-${Date.now()}`,
    createdAt: new Date().toISOString(),
    roomName: cleanText(body.roomName, 120) || undefined,
    docType: cleanText(body.docType, 40) || undefined,
    source: cleanText(body.source, 80) || 'veylo',
    deal: safeDeal,
  };

  await persistDeals([...deals, stored]);
  return NextResponse.json({ deal: stored }, { status: 201 });
}
