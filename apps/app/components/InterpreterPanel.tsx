'use client';

import * as React from 'react';
import { Room } from 'livekit-client';
import { useRemoteInterpreter } from '@/lib/use-remote-interpreter';
import { downloadTranscript } from '@/lib/transcript-export';
import { ALL_LANGUAGE_CODES } from '@/lib/countries';
import type { Profile } from '@/lib/types';

export function InterpreterPanel({
  room,
  profile,
  roomName,
}: {
  room: Room;
  profile: Profile;
  roomName: string;
}) {
  const [enabled, setEnabled] = React.useState(true);
  const [open, setOpen] = React.useState(true);
  const [targetLanguage, setTargetLanguage] = React.useState(profile.preferredLanguage);

  const languageDisplay = React.useMemo(() => {
    try {
      const locale = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en';
      return new Intl.DisplayNames([locale], { type: 'language' });
    } catch {
      return null;
    }
  }, []);

  const { turns, status, mediatorNote, clear } = useRemoteInterpreter(room, profile, enabled, {
    targetLanguage,
    sessionId: `live:${roomName}`,
  });

  const latest = turns[turns.length - 1];
  const source = latest?.sourceLanguage?.toUpperCase() || 'AUTO';

  return (
    <aside className={`interpreter-panel ${open ? 'open' : 'closed'}`}>
      <div className="interpreter-head">
        <div>
          <strong>Interpreter</strong>
          <span className="status-dot" data-active={enabled} />
          <small aria-live="polite">{status}</small>
        </div>
        <div className="row-actions">
          <button className="ghost small" onClick={() => setEnabled((v) => !v)}>{enabled ? 'AI on' : 'AI off'}</button>
          <button className="ghost small" onClick={() => setOpen((v) => !v)}>{open ? 'Hide' : 'Show'}</button>
        </div>
      </div>

      {open && (
        <>
          <div className="language-route language-control">
            <span>{source} →</span>
            <label>
              <span className="sr-only">Translation language</span>
              <select
                aria-label="Translation language"
                value={targetLanguage}
                onChange={(event) => setTargetLanguage(event.target.value)}
              >
                {ALL_LANGUAGE_CODES.map((code) => (
                  <option key={code} value={code}>
                    {languageDisplay?.of(code) || code.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="caption-stack" aria-live="polite">
            {latest ? (
              <>
                <p className="speaker-label">{latest.participantName}</p>
                <p className="source-caption">{latest.sourceText}</p>
                <p className="translated-caption">{latest.translatedText}</p>
              </>
            ) : (
              <p className="empty-caption">Translation appears here when another participant speaks.</p>
            )}
          </div>

          {mediatorNote && <div className="mediator-note"><span>AI Mediator</span><p>{mediatorNote}</p></div>}

          <div className="transcript-mini">
            {turns.slice(-5).map((turn) => (
              <div key={turn.id}>
                <span>{turn.participantName} · {turn.targetLanguage.toUpperCase()}</span>
                <p>{turn.translatedText}</p>
              </div>
            ))}
          </div>

          {turns.length > 0 && (
            <div className="transcript-actions">
              <button className="text-button" onClick={() => downloadTranscript(turns, roomName)}>Download transcript</button>
              <button className="text-button" onClick={clear}>Clear</button>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
