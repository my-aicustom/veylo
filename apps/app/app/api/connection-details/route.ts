import { NextRequest, NextResponse } from 'next/server';
import { AccessToken, type VideoGrant } from 'livekit-server-sdk';
import type { ConnectionDetails } from '@/lib/types';
import { cleanText, guardApi } from '@/lib/api-guard';

const LIVEKIT_URL = process.env.LIVEKIT_URL;
const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;

export async function POST(request: NextRequest) {
  const blocked = guardApi(request, 'join', { limit: 40, windowMs: 5 * 60_000 });
  if (blocked) return blocked;

  try {
    if (!LIVEKIT_URL || !API_KEY || !API_SECRET) {
      return NextResponse.json({ error: 'LiveKit server configuration is incomplete.' }, { status: 500 });
    }

    const body = await request.json();
    const roomName = cleanText(body.roomName, 80);
    const participantName = cleanText(body.participantName, 80);
    if (!roomName || !participantName) {
      return NextResponse.json({ error: 'roomName and participantName are required.' }, { status: 400 });
    }

    const metadata = JSON.stringify({
      countryCode: cleanText(body.countryCode, 3).toUpperCase(),
      countryName: cleanText(body.countryName, 90),
      preferredLanguage: cleanText(body.preferredLanguage, 12).toLowerCase(),
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
