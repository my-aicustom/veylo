'use client';

import * as React from 'react';
import { ConnectionQuality, Room, RoomEvent } from 'livekit-client';

function qualityLabel(quality: ConnectionQuality) {
  switch (quality) {
    case ConnectionQuality.Excellent:
      return 'Excellent';
    case ConnectionQuality.Good:
      return 'Good';
    case ConnectionQuality.Poor:
      return 'Poor';
    case ConnectionQuality.Lost:
      return 'Lost';
    default:
      return 'Checking';
  }
}

export function CallHealth({ room }: { room: Room }) {
  const [quality, setQuality] = React.useState<ConnectionQuality>(
    room.localParticipant.connectionQuality || ConnectionQuality.Unknown,
  );
  const [reconnecting, setReconnecting] = React.useState(false);
  const [canPlayAudio, setCanPlayAudio] = React.useState(room.canPlaybackAudio);

  React.useEffect(() => {
    const onQuality = (next: ConnectionQuality, participant: { identity: string }) => {
      if (participant.identity === room.localParticipant.identity) setQuality(next);
    };
    const onReconnecting = () => setReconnecting(true);
    const onReconnected = () => setReconnecting(false);
    const onAudio = () => setCanPlayAudio(room.canPlaybackAudio);

    room.on(RoomEvent.ConnectionQualityChanged, onQuality as any);
    room.on(RoomEvent.Reconnecting, onReconnecting);
    room.on(RoomEvent.Reconnected, onReconnected);
    room.on(RoomEvent.AudioPlaybackStatusChanged, onAudio);

    setQuality(room.localParticipant.connectionQuality || ConnectionQuality.Unknown);
    setCanPlayAudio(room.canPlaybackAudio);

    return () => {
      room.off(RoomEvent.ConnectionQualityChanged, onQuality as any);
      room.off(RoomEvent.Reconnecting, onReconnecting);
      room.off(RoomEvent.Reconnected, onReconnected);
      room.off(RoomEvent.AudioPlaybackStatusChanged, onAudio);
    };
  }, [room]);

  async function enableAudio() {
    try {
      await room.startAudio();
      setCanPlayAudio(room.canPlaybackAudio);
    } catch {
      setCanPlayAudio(false);
    }
  }

  if (!canPlayAudio) {
    return (
      <button className="call-health call-health-action" data-state="attention" onClick={enableAudio}>
        Enable sound
      </button>
    );
  }

  const label = reconnecting ? 'Reconnecting…' : qualityLabel(quality);
  const state = reconnecting || quality === ConnectionQuality.Lost
    ? 'danger'
    : quality === ConnectionQuality.Poor
      ? 'attention'
      : quality === ConnectionQuality.Excellent || quality === ConnectionQuality.Good
        ? 'good'
        : 'neutral';

  return (
    <span
      className="call-health"
      data-state={state}
      aria-live="polite"
      title={reconnecting ? 'Veylo is restoring the realtime connection.' : `Connection quality: ${label}`}
    >
      <span className="health-dot" aria-hidden="true" />
      {label}
    </span>
  );
}
