import { NextRequest, NextResponse } from 'next/server';
import { AccessToken, type VideoGrant } from 'livekit-server-sdk';
import type { ConnectionDetails } from '@/lib/types';

const LIVEKIT_URL = process.env.LIVEKIT_URL;
const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;

function clean(value: string | null, max = 100) {
  return (value || '').trim().replace(/[\u0000-\u001f]/g, '').slice(0, max);
}

export async function POST(request: NextRequest) {
  try {
    if (!LIVEKIT_URL || !API_KEY || !API_SECRET) {
      return NextResponse.json({ error: 'LiveKit server configuration is incomplete.' }, { status: 500 });
    }

    const body = await request.json();
    const roomName = clean(body.roomName, 80);
    const participantName = clean(body.participantName, 80);
    if (!roomName || !participantName) {
      return NextResponse.json({ error: 'roomName and participantName are required.' }, { status: 400 });
    }

    const metadata = JSON.stringify({
      countryCode: clean(body.countryCode, 3),
      countryName: clean(body.countryName, 90),
      preferredLanguage: clean(body.preferredLanguage, 12),
      app: 'veylo',
    });

    // Keep personally-readable names out of the LiveKit identity field.
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
