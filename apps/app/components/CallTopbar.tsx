'use client';

import * as React from 'react';
import { useParticipants } from '@livekit/components-react';
import type { Room } from 'livekit-client';
import { CallHealth } from './CallHealth';
import { BrandMark } from './BrandMark';

export function CallTopbar({ room, roomName }: { room: Room; roomName: string }) {
  const participants = useParticipants({ room });
  const [notice, setNotice] = React.useState('');

  const inviteUrl = typeof window === 'undefined' ? '' : window.location.href;

  async function shareInvite() {
    if (!inviteUrl) return;
    try {
      const payload = {
        title: 'Join my Veylo conversation',
        text: `Join room ${roomName} on Veylo.`,
        url: inviteUrl,
      };
      if (navigator.share && (!navigator.canShare || navigator.canShare(payload))) {
        await navigator.share(payload);
        setNotice('Invite shared');
      } else {
        await navigator.clipboard.writeText(inviteUrl);
        setNotice('Invite link copied');
      }
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(inviteUrl);
          setNotice('Invite link copied');
        } catch {
          setNotice('Could not share link');
        }
      }
    }
    window.setTimeout(() => setNotice(''), 2200);
  }

  return (
    <div className="call-topbar">
      <div className="call-brand"><BrandMark /><span>Live Interpreter</span></div>

      <div className="call-presence" aria-label={`${participants.length} participants in room`}>
        <span className="presence-dot" aria-hidden="true" />
        {participants.length} {participants.length === 1 ? 'person' : 'people'}
      </div>

      <div className="room-code">{roomName}</div>

      <div className="call-actions">
        <CallHealth room={room} />
        <span className="share-notice" aria-live="polite">{notice}</span>
        <button className="ghost small" onClick={shareInvite}>Share invite</button>
      </div>
    </div>
  );
}
