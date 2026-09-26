'use client';

import * as React from 'react';

export interface VoiceOrbProps {
  status: 'idle' | 'listening' | 'thinking' | 'speaking';
  amplitude?: number;
  onClick?: () => void;
}

const statusLabel: Record<VoiceOrbProps['status'], string> = {
  idle: 'Tap to start',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
};

export function VoiceOrb({ status, amplitude = 0, onClick }: VoiceOrbProps) {
  const intensity = Math.max(0, Math.min(1, amplitude));

  return (
    <button
      className="voice-orb"
      data-status={status}
      type="button"
      onClick={onClick}
      aria-label={`Voice assistant ${statusLabel[status]}`}
      style={{ '--orb-amp': intensity } as React.CSSProperties}
    >
      <span className="voice-orb-ring" aria-hidden="true" />
      <span className="voice-orb-core" aria-hidden="true">
        <span />
      </span>
      <span className="voice-orb-label">{statusLabel[status]}</span>
    </button>
  );
}
