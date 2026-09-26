import { NextRequest, NextResponse } from 'next/server';
import { AccessToken, type VideoGrant } from 'livekit-server-sdk';
import type { ConnectionDetails } from '@/lib/types';
import { cleanText, guardApi } from '@/lib/api-guard';
import { inviteProtectionEnabled, verifyInviteToken } from '@/lib/invite-token';

const LIVEKIT_URL = process.env.LIVEKIT_URL;
const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const ROOM_PATTERN = /^[A-Za-z0-9_-]{3,80}$/;

export async function POST(request: NextRequest) {
  const blocked = guardApi(request, 'join', { limit: 40, windowMs: 5 * 60_000 });
  if (blocked) return blocked;

  try {
    if (!LIVEKIT_URL || !API_KEY || !API_SECRET) {
      return NextResponse.json(
        {
          error: 'LiveKit SFU Server belum dikonfigurasi di environment ini.',
          configured: false,
          code: 'LIVEKIT_NOT_CONFIGURED',
          message: 'Fitur 1-on-1 Video Call memerlukan server LiveKit (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET). Di Vercel, tambahkan variabel ini atau gunakan LiveKit Cloud gratis.',
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const roomName = cleanText(body.roomName, 80);
    const participantName = cleanText(body.participantName, 80);
    if (!roomName || !participantName) {
      return NextResponse.json({ error: 'roomName and participantName are required.' }, { status: 400 });
    }
    if (!ROOM_PATTERN.test(roomName)) {
      return NextResponse.json(
        { error: 'Invalid room name. Use 3-80 letters, numbers, dashes, or underscores.' },
        { status: 400 },
      );
    }

    if (inviteProtectionEnabled()) {
      const invite = verifyInviteToken(roomName, body.inviteToken);
      if (!invite.valid) {
        const message =
          invite.reason === 'expired'
            ? 'This invite link has expired. Ask the room creator for a new link.'
            : 'A valid Veylo invite link is required for this room.';
        return NextResponse.json({ error: message }, { status: 403 });
      }
    }

    const countryCode = cleanText(body.countryCode, 3).toUpperCase();
    const preferredLanguage = cleanText(body.preferredLanguage, 12).toLowerCase();

    const metadata = JSON.stringify({
      countryCode,
      countryName: cleanText(body.countryName, 90),
      preferredLanguage,
      app: 'veylo',
    });

    const identity = crypto.randomUUID();
    const token = new AccessToken(API_KEY, API_SECRET, {
      identity,
      name: participantName,
      metadata,
    });
    token.ttl = '2h';

    const grant: VideoGrant = {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    };
    token.addGrant(grant);

    const data: ConnectionDetails = {
      serverUrl: LIVEKIT_URL,
      roomName,
      participantName,
      participantToken: await token.toJwt(),
    };
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Token creation failed' }, { status: 500 });
  }
}
