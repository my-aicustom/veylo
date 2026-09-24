'use client';

import * as React from 'react';
import { Room } from 'livekit-client';
import { useRemoteInterpreter } from '@/lib/use-remote-interpreter';
import { analyzeMeeting } from '@/lib/client-ai';
import { downloadTranscript } from '@/lib/transcript-export';
import {
  clearMeetingIntelligence,
  downloadMeetingBrief,
  downloadMeetingJson,
  loadMeetingIntelligence,
  saveMeetingIntelligence,
} from '@/lib/meeting-intelligence';
import { listAudioDevices, type AudioDeviceChoice } from '@/lib/audio-devices';
import { ALL_LANGUAGE_CODES } from '@/lib/countries';
import { glossaryToInput, loadSessionGlossary, parseGlossary, saveSessionGlossary } from '@/lib/session-glossary';
import type { MeetingIntelligence, Profile } from '@/lib/types';

function formatLatency(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`;
}

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
  const [outputDeviceId, setOutputDeviceId] = React.useState('default');
  const [outputs, setOutputs] = React.useState<AudioDeviceChoice[]>([]);
  const [outputSelectionSupported, setOutputSelectionSupported] = React.useState(false);
  const [report, setReport] = React.useState<MeetingIntelligence | null>(null);
  const [reportBusy, setReportBusy] = React.useState(false);
  const [reportError, setReportError] = React.useState('');
  const [reportOpen, setReportOpen] = React.useState(false);
  const [glossaryInput, setGlossaryInput] = React.useState('');

  const sessionId = `live:${roomName}`;
  const languageStorageKey = React.useMemo(() => `veylo:room-language:${roomName}`, [roomName]);
  const outputStorageKey = React.useMemo(() => `veylo:room-output:${roomName}`, [roomName]);

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(languageStorageKey);
      if (saved && ALL_LANGUAGE_CODES.includes(saved)) setTargetLanguage(saved);
      const output = window.localStorage.getItem(outputStorageKey);
      if (output) setOutputDeviceId(output);
    } catch {}
    setReport(loadMeetingIntelligence(sessionId));
    setGlossaryInput(glossaryToInput(loadSessionGlossary(sessionId)));
  }, [languageStorageKey, outputStorageKey, sessionId]);

  const refreshOutputs = React.useCallback(async () => {
    try {
      const devices = await listAudioDevices();
      setOutputs(devices.outputs);
      setOutputSelectionSupported(devices.outputSelectionSupported);
    } catch {}
  }, []);

  React.useEffect(() => {
    void refreshOutputs();
    const handler = () => void refreshOutputs();
    navigator.mediaDevices?.addEventListener?.('devicechange', handler);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', handler);
  }, [refreshOutputs]);

  const changeTargetLanguage = React.useCallback((language: string) => {
    setTargetLanguage(language);
    try { window.localStorage.setItem(languageStorageKey, language); } catch {}
  }, [languageStorageKey]);

  const changeOutputDevice = React.useCallback((deviceId: string) => {
    setOutputDeviceId(deviceId);
    try { window.localStorage.setItem(outputStorageKey, deviceId); } catch {}
  }, [outputStorageKey]);

  const languageDisplay = React.useMemo(() => {
    try {
      const locale = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en';
      return new Intl.DisplayNames([locale], { type: 'language' });
    } catch {
      return null;
    }
  }, []);

  const glossaryTerms = React.useMemo(() => parseGlossary(glossaryInput), [glossaryInput]);

  const { turns, status, mediatorNote, latestLatency, clear } = useRemoteInterpreter(room, profile, enabled, {
    targetLanguage,
    sessionId,
    outputDeviceId,
    glossary: glossaryTerms,
  });

  const latest = turns[turns.length - 1];
  const source = latest?.sourceLanguage?.toUpperCase() || 'AUTO';
  const reportStale = Boolean(report && report.sourceTurnCount !== turns.length);

  const generateReport = React.useCallback(async () => {
    if (!turns.length || reportBusy) return;
    setReportBusy(true);
    setReportError('');
    try {
      const result = await analyzeMeeting(turns);
      setReport(result.report);
      saveMeetingIntelligence(sessionId, result.report);
      setReportOpen(true);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : 'Could not generate meeting brief');
    } finally {
      setReportBusy(false);
    }
  }, [reportBusy, sessionId, turns]);

  const clearAll = React.useCallback(() => {
    clear();
    setReport(null);
    setReportError('');
    clearMeetingIntelligence(sessionId);
  }, [clear, sessionId]);

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
                onChange={(event) => changeTargetLanguage(event.target.value)}
              >
                {ALL_LANGUAGE_CODES.map((code) => (
                  <option key={code} value={code}>
                    {languageDisplay?.of(code) || code.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="audio-route-control">
            <label>
              <span>Translated audio output</span>
              <select
                value={outputDeviceId}
                onChange={(event) => changeOutputDevice(event.target.value)}
                disabled={!outputSelectionSupported}
              >
                <option value="default">System default</option>
                {outputs.filter((item) => item.deviceId !== 'default').map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
                ))}
              </select>
            </label>
            <button className="text-button compact" onClick={refreshOutputs}>Refresh devices</button>
            {!outputSelectionSupported && <small>Browser uses the system-selected speaker/headset.</small>}
          </div>

          <div className="glossary-control">
            <label>
              <span>Protected terms / glossary</span>
              <input
                value={glossaryInput}
                placeholder="Brand, SKU, Incoterm, product term…"
                onChange={(event) => {
                  const value = event.target.value;
                  setGlossaryInput(value);
                  saveSessionGlossary(sessionId, parseGlossary(value));
                }}
              />
            </label>
            <small>Comma-separated terms are preserved during translation.</small>
          </div>

          <div className="caption-stack" aria-live="polite">
            {latest ? (
              <>
                <p className="speaker-label">{latest.participantName}</p>
                <p className="source-caption">{latest.sourceText}</p>
                <p className="translated-caption">{latest.translationState === 'failed' ? 'Translation temporarily unavailable · original preserved' : latest.translatedText}</p>
              </>
            ) : (
              <p className="empty-caption">Translation appears here when another participant speaks.</p>
            )}
          </div>

          {latestLatency && (
            <div className="latency-strip" title="Local browser timing from phrase capture through AI speech playback">
              <span><b>E2E</b>{formatLatency(latestLatency.endToEndPlaybackMs ?? latestLatency.totalTurnMs)}</span>
              <span><b>STT</b>{formatLatency(latestLatency.sttMs)}</span>
              <span><b>TR</b>{formatLatency(latestLatency.translateMs)}</span>
              <span><b>TTS</b>{formatLatency(latestLatency.ttsPlaybackStartMs)}</span>
              <em>{latestLatency.playbackMode}</em>
            </div>
          )}

          {mediatorNote && <div className="mediator-note"><span>AI Mediator</span><p>{mediatorNote}</p></div>}

          <div className="transcript-mini">
            {turns.slice(-5).map((turn) => (
              <div key={turn.id}>
                <span>{turn.participantName} · {(turn.sourceLanguage || 'auto').toUpperCase()} → {turn.targetLanguage.toUpperCase()}</span>
                <p>{turn.translatedText}</p>
              </div>
            ))}
          </div>

          {turns.length > 0 && (
            <div className="transcript-actions transcript-actions-wrap">
              <button className="text-button" onClick={() => downloadTranscript(turns, roomName)}>Download transcript</button>
              <button className="text-button" onClick={generateReport} disabled={reportBusy}>
                {reportBusy ? 'Building brief…' : report ? (reportStale ? 'Update meeting brief' : 'Refresh meeting brief') : 'Generate meeting brief'}
              </button>
              <button className="text-button" onClick={clearAll}>Clear</button>
            </div>
          )}

          {reportError && <div className="error-box compact-error">{reportError}</div>}

          {report && (
            <section className="meeting-intelligence-card">
              <button className="meeting-intelligence-head" onClick={() => setReportOpen((value) => !value)}>
                <span><b>Meeting intelligence</b><small>{reportStale ? 'Transcript changed · update recommended' : `${report.sourceTurnCount} turns analyzed`}</small></span>
                <em>{reportOpen ? 'Hide' : 'Open'}</em>
              </button>
              {reportOpen && (
                <div className="meeting-intelligence-body">
                  <h3>{report.meetingTitle}</h3>
                  <p>{report.summary}</p>

                  {report.parties.length > 0 && <ReportList title="Parties" items={report.parties.map((item) => [item.name, item.company, item.role, item.country].filter(Boolean).join(' · '))} />}
                  {report.commercialItems.length > 0 && <ReportList title="Commercial" items={report.commercialItems.map((item) => [item.product, item.quantity, item.unit, item.price, item.currency, item.incoterm, item.delivery, item.notes].filter(Boolean).join(' · '))} />}
                  {report.commitments.length > 0 && <ReportList title="Commitments" items={report.commitments.map((item) => `${item.party ? `${item.party}: ` : ''}${item.commitment}${item.due ? ` · ${item.due}` : ''}`)} />}
                  {report.actionItems.length > 0 && <ReportList title="Action items" items={report.actionItems.map((item) => `${item.owner ? `${item.owner}: ` : ''}${item.action}${item.due ? ` · ${item.due}` : ''}${item.status ? ` · ${item.status}` : ''}`)} />}
                  <ReportList title="Follow-ups" items={report.followUps} />
                  <ReportList title="Open questions" items={report.openQuestions} />
                  <ReportList title="Risks / ambiguities" items={report.risksOrAmbiguities} />

                  <div className="report-actions">
                    <button className="text-button" onClick={() => downloadMeetingBrief(report, roomName)}>Download brief</button>
                    <button className="text-button" onClick={() => downloadMeetingJson(report, roomName)}>Export JSON</button>
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </aside>
  );
}

function ReportList({ title, items }: { title: string; items: string[] }) {
  const clean = items.filter(Boolean);
  if (!clean.length) return null;
  return (
    <div className="report-section">
      <h4>{title}</h4>
      <ul>{clean.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}</ul>
    </div>
  );
}
