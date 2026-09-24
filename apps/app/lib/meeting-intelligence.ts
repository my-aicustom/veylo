'use client';

import type { MeetingIntelligence } from './types';

const PREFIX = 'veylo:meeting-intelligence:';

function storageKey(sessionId: string) {
  return `${PREFIX}${sessionId.replace(/[^a-z0-9:_-]/gi, '-').slice(0, 120)}`;
}

export function loadMeetingIntelligence(sessionId: string): MeetingIntelligence | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.summary !== 'string' || !Array.isArray(parsed.actionItems)) return null;
    return parsed as MeetingIntelligence;
  } catch {
    return null;
  }
}

export function saveMeetingIntelligence(sessionId: string, report: MeetingIntelligence) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(storageKey(sessionId), JSON.stringify(report)); } catch {}
}

export function clearMeetingIntelligence(sessionId: string) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(storageKey(sessionId)); } catch {}
}

function safe(value?: string) {
  return value?.trim() || '—';
}

export function meetingIntelligenceToMarkdown(report: MeetingIntelligence, roomName?: string) {
  const lines: string[] = [
    `# ${report.meetingTitle || 'VEYLO Conversation Brief'}`,
    '',
    roomName ? `**Room:** ${roomName}` : '',
    `**Generated:** ${report.generatedAt}`,
    `**Transcript turns analyzed:** ${report.sourceTurnCount}`,
    report.languages.length ? `**Languages:** ${report.languages.join(', ')}` : '',
    '',
    '## Summary',
    report.summary,
    '',
  ].filter(Boolean);

  if (report.parties.length) {
    lines.push('## Parties');
    for (const party of report.parties) {
      lines.push(`- ${safe(party.name)}${party.company ? ` — ${party.company}` : ''}${party.role ? ` (${party.role})` : ''}${party.country ? ` · ${party.country}` : ''}${party.contact ? ` · ${party.contact}` : ''}`);
    }
    lines.push('');
  }

  if (report.commercialItems.length) {
    lines.push('## Commercial items');
    for (const item of report.commercialItems) {
      const details = [item.quantity, item.unit, item.price, item.currency, item.incoterm, item.delivery].filter(Boolean).join(' · ');
      lines.push(`- **${item.product || 'Item'}**${details ? ` — ${details}` : ''}${item.notes ? ` — ${item.notes}` : ''}`);
    }
    lines.push('');
  }

  if (report.commitments.length) {
    lines.push('## Commitments');
    for (const item of report.commitments) lines.push(`- ${item.party ? `${item.party}: ` : ''}${item.commitment}${item.due ? ` · Due: ${item.due}` : ''}`);
    lines.push('');
  }

  if (report.actionItems.length) {
    lines.push('## Action items');
    for (const item of report.actionItems) lines.push(`- [ ] ${item.owner ? `${item.owner}: ` : ''}${item.action}${item.due ? ` · Due: ${item.due}` : ''}${item.status ? ` · ${item.status}` : ''}`);
    lines.push('');
  }

  const sections: Array<[string, string[]]> = [
    ['Follow-ups', report.followUps],
    ['Open questions', report.openQuestions],
    ['Risks / ambiguities', report.risksOrAmbiguities],
  ];
  for (const [title, items] of sections) {
    if (!items.length) continue;
    lines.push(`## ${title}`);
    for (const item of items) lines.push(`- ${item}`);
    lines.push('');
  }

  return `${lines.join('\n').trim()}\n`;
}

function download(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadMeetingBrief(report: MeetingIntelligence, roomName?: string) {
  const safeRoom = (roomName || 'conversation').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
  download(
    meetingIntelligenceToMarkdown(report, roomName),
    `veylo-${safeRoom}-brief-${new Date().toISOString().slice(0, 10)}.md`,
    'text/markdown;charset=utf-8',
  );
}

export function downloadMeetingJson(report: MeetingIntelligence, roomName?: string) {
  const safeRoom = (roomName || 'conversation').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
  download(
    `${JSON.stringify(report, null, 2)}\n`,
    `veylo-${safeRoom}-brief-${new Date().toISOString().slice(0, 10)}.json`,
    'application/json;charset=utf-8',
  );
}
