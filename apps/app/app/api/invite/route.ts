import { NextRequest, NextResponse } from 'next/server';
import { cleanText, guardApi } from '@/lib/api-guard';
import { createInviteToken, inviteProtectionEnabled } from '@/lib/invite-token';

const ROOM_PATTERN = /^[A-Za-z0-9_-]{3,80}$/;

export async function POST(request: NextRequest) {
  const blocked = guardApi(request, 'invite', { limit: 20, windowMs: 5 * 60_000 });
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const roomName = cleanText(body.roomName, 80);
    if (!ROOM_PATTERN.test(roomName)) {
      return NextResponse.json(
        { error: 'Invalid room name. Use 3-80 letters, numbers, dashes, or underscores.' },
        { status: 400 },
      );
    }

    if (!inviteProtectionEnabled()) {
      return NextResponse.json(
        { token: null, expiresAt: null, protected: false },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const invite = createInviteToken(roomName);
    if (!invite) {
      return NextResponse.json({ error: 'Invite signing is unavailable.' }, { status: 500 });
    }

    return NextResponse.json(
      { ...invite, protected: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not create invite' },
      { status: 500 },
    );
  }
}
