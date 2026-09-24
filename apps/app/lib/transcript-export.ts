'use client';

import type { TranscriptTurn } from './types';

function clock(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '--:--:--'
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function transcriptToText(turns: TranscriptTurn[]) {
  return turns.map((turn) => {
    const route = [
      turn.sourceLanguage?.toUpperCase(),
      turn.targetLanguage?.toUpperCase(),
    ].filter(Boolean).join(' → ');
    return [
      `[${clock(turn.at)}] ${turn.participantName || 'Participant'}${turn.isLocal ? ' · YOU' : ''}${route ? ` · ${route}` : ''}`,
      `Original: ${turn.sourceText}`,
      turn.translationState === 'failed'
        ? 'Translation: [temporarily unavailable — original text preserved]'
        : `Translation: ${turn.translatedText}`, 
    ].join('\n');
  }).join('\n\n');
}

export function downloadTranscript(turns: TranscriptTurn[], roomName?: string) {
  if (!turns.length) return;
  const header = [
    'VEYLO conversation transcript',
    roomName ? `Room: ${roomName}` : '',
    `Exported: ${new Date().toISOString()}`,
    '',
  ].filter(Boolean).join('\n');
  const blob = new Blob([`${header}\n${transcriptToText(turns)}\n`], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const safeRoom = (roomName || 'conversation').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
  anchor.href = url;
  anchor.download = `veylo-${safeRoom}-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
