import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/api-guard';
import { aiBudgetSnapshot } from '@/lib/ai-budget';
import { inviteProtectionEnabled } from '@/lib/invite-token';
import { VEYLO_VERSION } from '@/lib/version';

function present(value?: string) {
  return Boolean(value && value.trim());
}

function positive(value?: string) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0;
}

export async function GET(request: NextRequest) {
  const blocked = guardApi(request, 'ready', { limit: 60, windowMs: 60_000 });
  if (blocked) return blocked;

  const strict = process.env.VEYLO_STRICT_PRODUCTION === 'true';
  const appUrl = process.env.APP_URL || '';
  const livekitUrl = process.env.LIVEKIT_URL || '';

  const checks = {
    openrouterKey: present(process.env.OPENROUTER_API_KEY),
    livekitApiKey: present(process.env.LIVEKIT_API_KEY),
    livekitApiSecret: present(process.env.LIVEKIT_API_SECRET),
    livekitUrl: present(livekitUrl),
    secureAppUrl: !strict || appUrl.toLowerCase().startsWith('https://'),
    secureLivekitUrl: !strict || livekitUrl.toLowerCase().startsWith('wss://'),
    signedInvites: !strict || inviteProtectionEnabled(),
    aiRequestCap: !strict || positive(process.env.VEYLO_AI_MAX_REQUESTS_PER_HOUR),
    aiCostCap: !strict || positive(process.env.VEYLO_AI_MAX_TRACKED_COST_USD_PER_DAY),
  };

  const ready = Object.values(checks).every(Boolean);
  return NextResponse.json(
    {
      app: 'Veylo',
      version: VEYLO_VERSION,
      ready,
      strict,
      checks,
      aiBudget: aiBudgetSnapshot(),
      serverTime: new Date().toISOString(),
    },
    {
      status: ready ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
