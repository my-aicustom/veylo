'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  PreJoin,
  RoomContext,
  VideoConference,
  type LocalUserChoices,
} from '@livekit/components-react';
import {
  Room,
  RoomEvent,
  TrackPublishDefaults,
  VideoPresets,
  type RoomOptions,
} from 'livekit-client';
import { CallTopbar } from '@/components/CallTopbar';
import { BrandMark } from '@/components/BrandMark';
import { ProfileForm } from '@/components/ProfileForm';
import { InterpreterPanel } from '@/components/InterpreterPanel';
import { loadProfile } from '@/lib/profile';
import { apiUrl } from '@/lib/paths';
import type { ConnectionDetails, Profile } from '@/lib/types';

export function RoomPageClient({ roomName }: { roomName: string }) {
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [profileChecked, setProfileChecked] = React.useState(false);
  const [choices, setChoices] = React.useState<LocalUserChoices | null>(null);
  const [connection, setConnection] = React.useState<ConnectionDetails | null>(null);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setProfile(loadProfile());
    setProfileChecked(true);
  }, []);

  const join = React.useCallback(async (values: LocalUserChoices) => {
    if (!profile) return;
    setError('');
    setChoices(values);

    const inviteToken = typeof window !== 'undefined'
      ? new URL(window.location.href).searchParams.get('invite')
      : null;

    const response = await fetch(apiUrl('/api/connection-details'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName,
        inviteToken,
        participantName: values.username || profile.name,
        countryCode: profile.countryCode,
        countryName: profile.countryName,
        preferredLanguage: profile.preferredLanguage,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setChoices(null);
      setError(payload?.error || 'Could not join room');
      return;
    }
    setConnection(payload);
  }, [profile, roomName]);

  if (!profileChecked) return <div className="center-screen">Loading…</div>;
  if (!profile) {
    return (
      <main className="center-screen page-surface">
        <section className="join-card">
          <div className="eyebrow">VEYLO / LIVE INTERPRETER</div>
          <h1>Join conversation</h1>
          <p>One short profile. No account, password, or OTP.</p>
          <ProfileForm onDone={setProfile} />
        </section>
      </main>
    );
  }

  if (!connection || !choices) {
    return (
      <main className="prejoin-shell" data-lk-theme="default">
        <div className="prejoin-header">
          <BrandMark href="/app" />
          <div><span>{profile.name}</span><small>{profile.countryName} · {profile.preferredLanguage.toUpperCase()}</small></div>
        </div>
        <section className="prejoin-card">
          <div className="eyebrow">ROOM / {roomName}</div>
          <h1>Ready to join?</h1>
          <p>Check your camera and microphone. AI interpretation starts automatically after you enter.</p>
          {error && <div className="error-box">{error}</div>}
          <PreJoin
            defaults={{ username: profile.name, videoEnabled: true, audioEnabled: true }}
            onSubmit={join}
            onError={(e) => setError(e instanceof Error ? e.message : String(e))}
          />
        </section>
      </main>
    );
  }

  return <ConnectedRoom profile={profile} choices={choices} connection={connection} />;
}

function ConnectedRoom({ profile, choices, connection }: {
  profile: Profile;
  choices: LocalUserChoices;
  connection: ConnectionDetails;
}) {
  const router = useRouter();
  const roomOptions = React.useMemo<RoomOptions>(() => {
    const publishDefaults: TrackPublishDefaults = {
      dtx: true,
      red: true,
      videoCodec: 'vp9',
      videoSimulcastLayers: [VideoPresets.h540, VideoPresets.h216],
    };
    return {
      adaptiveStream: true,
      dynacast: true,
      publishDefaults,
      videoCaptureDefaults: {
        deviceId: choices.videoDeviceId || undefined,
        resolution: VideoPresets.h720,
      },
      audioCaptureDefaults: {
        deviceId: choices.audioDeviceId || undefined,
      },
    };
  }, [choices.audioDeviceId, choices.videoDeviceId]);

  const room = React.useMemo(() => new Room(roomOptions), [roomOptions]);
  const [connected, setConnected] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let mounted = true;
    let joined = false;
    let serverConnected = false;
    const onDisconnected = () => {
      if (mounted && joined) router.push('/');
    };
    room.on(RoomEvent.Disconnected, onDisconnected);
    let connectionStarted = false;
    const connectTimer = window.setTimeout(() => {
      if (!mounted) return;
      connectionStarted = true;
      room.connect(connection.serverUrl, connection.participantToken, { autoSubscribe: true })
        .then(async () => {
          if (!mounted) return;
          serverConnected = true;
          if (choices.videoEnabled) await room.localParticipant.setCameraEnabled(true);
          if (choices.audioEnabled) await room.localParticipant.setMicrophoneEnabled(true);
          if (mounted) {
            joined = true;
            setConnected(true);
          }
        })
        .catch(() => {
          if (!mounted) return;
          setError(serverConnected
            ? 'Connected to the room, but camera or microphone could not start. Check device permissions and try again.'
            : 'Could not connect to the Live Call server. Check that LiveKit is running, then try again.');
          void room.disconnect();
        });
    }, 0);

    return () => {
      mounted = false;
      window.clearTimeout(connectTimer);
      room.off(RoomEvent.Disconnected, onDisconnected);
      if (connectionStarted) void room.disconnect();
    };
  }, [choices.audioEnabled, choices.videoEnabled, connection.participantToken, connection.serverUrl, room, router]);

  if (error) return <div className="center-screen"><div className="join-card"><div className="error-box">{error}</div><button className="primary" onClick={() => window.location.reload()}>Try again</button></div></div>;
  if (!connected) return <div className="center-screen">Connecting securely…</div>;

  return (
    <main className="call-shell" data-lk-theme="default">
      <RoomContext.Provider value={room}>
        <CallTopbar room={room} roomName={connection.roomName} />
        <div className="video-stage">
          <VideoConference />
          <InterpreterPanel room={room} profile={profile} roomName={connection.roomName} />
        </div>
      </RoomContext.Provider>
    </main>
  );
}
