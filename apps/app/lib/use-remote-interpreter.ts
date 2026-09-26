'use client';

import * as React from 'react';
import {
  RemoteAudioTrack,
  RemoteParticipant,
  RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
} from 'livekit-client';
import { PhraseRecorder } from './wav-recorder';
import { parseParticipantMetadata } from './participant-context';
import { normalizeDetectedLanguage } from './countries';
import { mediate, playSpeech, transcribe, translate } from './client-ai';
import { clearTranscript, loadTranscript, saveTranscript, trimTranscript } from './transcript-persistence';
import { recordLatencyTrace } from './latency-telemetry';
import type { LatencyTrace, Profile, TranscriptTurn } from './types';

type Lane = {
  recorder: PhraseRecorder;
  queue: Promise<void>;
  track: RemoteAudioTrack;
};

export function useRemoteInterpreter(
  room: Room,
  profile: Profile | null,
  enabled: boolean,
  options?: { targetLanguage?: string; sessionId?: string; outputDeviceId?: string; glossary?: string[] },
) {
  const [turns, setTurns] = React.useState<TranscriptTurn[]>([]);
  const [status, setStatus] = React.useState('Interpreter off');
  const [mediatorNote, setMediatorNote] = React.useState<string | null>(null);
  const [latestLatency, setLatestLatency] = React.useState<LatencyTrace | null>(null);
  const turnsRef = React.useRef<TranscriptTurn[]>([]);
  const lanes = React.useRef(new Map<string, Lane>());
  const localRecorder = React.useRef<PhraseRecorder | null>(null);
  const localQueue = React.useRef<Promise<void>>(Promise.resolve());
  const speechQueue = React.useRef<Promise<void>>(Promise.resolve());
  const speechPending = React.useRef(0);
  const mediatorBusy = React.useRef(false);
  const mediatorLastAt = React.useRef(0);
  const stopped = React.useRef(false);
  const glossaryRef = React.useRef<string[]>(options?.glossary || []);

  React.useEffect(() => {
    glossaryRef.current = options?.glossary || [];
  }, [options?.glossary]);

  const targetLanguage = options?.targetLanguage || profile?.preferredLanguage || 'en';
  const sessionId = options?.sessionId;

  React.useEffect(() => {
    if (!sessionId) return;
    const restored = loadTranscript(sessionId);
    turnsRef.current = restored;
    setTurns(restored);
  }, [sessionId]);

  const commitTurns = React.useCallback((nextTurns: TranscriptTurn[]) => {
    turnsRef.current = nextTurns;
    setTurns(nextTurns);
    if (sessionId) saveTranscript(sessionId, nextTurns);
  }, [sessionId]);

  const commitLatency = React.useCallback((trace: LatencyTrace) => {
    setLatestLatency(trace);
    recordLatencyTrace(trace);
  }, []);

  const maybeMediate = React.useCallback((nextTurns: TranscriptTurn[]) => {
    const now = Date.now();
    if (nextTurns.length < 4 || nextTurns.length % 4 !== 0) return;
    if (mediatorBusy.current || now - mediatorLastAt.current < 15_000) return;

    mediatorBusy.current = true;
    mediatorLastAt.current = now;
    void mediate(nextTurns.slice(-10))
      .then((result) => setMediatorNote(result.note))
      .catch(() => {})
      .finally(() => { mediatorBusy.current = false; });
  }, []);

  const processPhrase = React.useCallback(async (
    bytes: Uint8Array,
    participant: RemoteParticipant,
    track: RemoteAudioTrack,
    phraseEndedAt: number,
  ) => {
    if (!profile || stopped.current || !enabled) return;

    const processStartedAt = performance.now();
    const captureQueueMs = processStartedAt - phraseEndedAt;

    setStatus(`Understanding ${participant.name || 'participant'}…`);
    const sttStartedAt = performance.now();
    const stt = await transcribe(bytes, undefined, glossaryRef.current);
    const sttMs = performance.now() - sttStartedAt;

    const sourceText = (stt.text || '').trim();
    if (!sourceText || stopped.current || !enabled) return;

    const context = parseParticipantMetadata(participant.metadata);
    const sourceLanguage = normalizeDetectedLanguage(stt.language);
    const isSameLanguage = Boolean(
      sourceLanguage &&
      sourceLanguage.toLowerCase() === targetLanguage.toLowerCase()
    );

    let translatedText = sourceText;
    let translateMs: number | undefined;
    let translationState: TranscriptTurn['translationState'] = isSameLanguage ? 'same-language' : 'translated';

    if (!isSameLanguage) {
      const translateStartedAt = performance.now();
      try {
        const result = await translate(sourceText, {
          sourceLanguage,
          targetLanguage,
          sourceCountry: context.countryName,
          targetCountry: profile.countryName,
          glossary: glossaryRef.current,
        });
        translatedText = result.text;
      } catch (error) {
        translationState = 'failed';
        translatedText = sourceText;
        console.warn('[interpreter] translation failed; preserving source transcript', error);
      } finally {
        translateMs = performance.now() - translateStartedAt;
      }
    }
    if (stopped.current || !enabled) return;

    const turn: TranscriptTurn = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      participantIdentity: participant.identity,
      participantName: participant.name || 'Participant',
      sourceText,
      translatedText,
      sourceLanguage,
      targetLanguage,
      translationState,
    };
    const nextTurns = trimTranscript([...turnsRef.current, turn]);
    commitTurns(nextTurns);

    maybeMediate(nextTurns);

    const traceBase = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      participantName: participant.name || 'Participant',
      sourceLanguage,
      targetLanguage,
      captureQueueMs,
      sttMs,
      translateMs,
    };

    if (isSameLanguage || translationState === 'failed') {
      commitLatency({
        ...traceBase,
        totalTurnMs: performance.now() - phraseEndedAt,
        playbackMode: 'none',
      });
    } else {
      const queuedAt = performance.now();
      const maxSpeechQueue = 2;
      const maxPlaybackAgeMs = 7_000;

      if (speechPending.current >= maxSpeechQueue) {
        commitLatency({
          ...traceBase,
          speechQueueMs: 0,
          totalTurnMs: performance.now() - phraseEndedAt,
          playbackMode: 'none',
        });
        setStatus('Translation ready · audio skipped to stay realtime');
      } else {
        speechPending.current += 1;
        speechQueue.current = speechQueue.current
          .then(async () => {
            const speechQueueMs = performance.now() - queuedAt;
            if (stopped.current || !enabled) return;

            // A delayed synthesized sentence should never duck speech that is happening
            // several seconds later. Keep its subtitle/transcript and skip stale audio.
            if (performance.now() - phraseEndedAt > maxPlaybackAgeMs) {
              commitLatency({
                ...traceBase,
                speechQueueMs,
                totalTurnMs: performance.now() - phraseEndedAt,
                playbackMode: 'none',
              });
              return;
            }

            setStatus('Speaking translation…');
            try { track.setVolume(0.08); } catch {}
            const ttsStartedAt = performance.now();

            try {
              const playback = await playSpeech(translatedText, options?.outputDeviceId);
              commitLatency({
                ...traceBase,
                speechQueueMs,
                ttsResponseMs: playback.responseMs,
                ttsFirstChunkMs: playback.firstChunkMs,
                ttsPlaybackStartMs: playback.playbackStartMs,
                ttsTotalMs: playback.totalMs,
                endToEndPlaybackMs: (ttsStartedAt - phraseEndedAt) + playback.playbackStartMs,
                totalTurnMs: performance.now() - phraseEndedAt,
                playbackMode: playback.mode,
              });
            } finally {
              try { track.setVolume(1); } catch {}
            }
          })
          .catch((error) => {
            try { track.setVolume(1); } catch {}
            console.warn('[interpreter] TTS failed', error);
          })
          .finally(() => {
            speechPending.current = Math.max(0, speechPending.current - 1);
            if (!stopped.current && enabled) setStatus('Listening');
          });
      }
    }

    if (!stopped.current && enabled && speechPending.current === 0) setStatus('Listening');
  }, [commitLatency, commitTurns, enabled, maybeMediate, options?.outputDeviceId, profile, targetLanguage]);

  const processLocalPhrase = React.useCallback(async (
    bytes: Uint8Array,
    phraseEndedAt: number,
  ) => {
    if (!profile || stopped.current || !enabled) return;

    const processStartedAt = performance.now();
    const captureQueueMs = processStartedAt - phraseEndedAt;
    const sttStartedAt = performance.now();
    const stt = await transcribe(bytes, undefined, glossaryRef.current);
    const sttMs = performance.now() - sttStartedAt;
    const sourceText = (stt.text || '').trim();
    if (!sourceText || stopped.current || !enabled) return;

    const sourceLanguage = normalizeDetectedLanguage(stt.language);
    const turn: TranscriptTurn = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      participantIdentity: room.localParticipant.identity,
      participantName: profile.name,
      isLocal: true,
      sourceText,
      translatedText: sourceText,
      sourceLanguage,
      targetLanguage: sourceLanguage || profile.preferredLanguage,
      translationState: 'source-only',
    };
    const nextTurns = trimTranscript([...turnsRef.current, turn]);
    commitTurns(nextTurns);

    maybeMediate(nextTurns);

    commitLatency({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      participantName: profile.name,
      sourceLanguage,
      targetLanguage: sourceLanguage || profile.preferredLanguage,
      captureQueueMs,
      sttMs,
      totalTurnMs: performance.now() - phraseEndedAt,
      playbackMode: 'none',
    });
  }, [commitLatency, commitTurns, enabled, maybeMediate, profile, room.localParticipant]);

  React.useEffect(() => {
    stopped.current = !enabled;
    if (!enabled || !profile) {
      setStatus('Interpreter off');
      for (const lane of lanes.current.values()) {
        lane.recorder.stop();
        try { lane.track.setVolume(1); } catch {}
      }
      lanes.current.clear();
      localRecorder.current?.stop();
      localRecorder.current = null;
      localQueue.current = Promise.resolve();
      return;
    }

    stopped.current = false;
    setStatus('Listening');

    const startLocalLane = async (track: any) => {
      if (localRecorder.current || !track?.mediaStreamTrack) return;
      const clone = track.mediaStreamTrack.clone();
      const stream = new MediaStream([clone]);
      const recorder = new PhraseRecorder(stream, {
        silenceMs: 1_100,
        minSpeechMs: 260,
        maxPhraseMs: 20_000,
        threshold: 0.012,
        preRollMs: 180,
        onPhrase: (phrase) => {
          const phraseEndedAt = performance.now();
          localQueue.current = localQueue.current
            .then(() => processLocalPhrase(phrase.bytes, phraseEndedAt))
            .catch((error) => console.warn('[interpreter] local transcript failed', error));
        },
      });
      localRecorder.current = recorder;
      try {
        await recorder.start();
      } catch (error) {
        recorder.stop();
        if (localRecorder.current === recorder) localRecorder.current = null;
        console.warn('[interpreter] local recorder start failed', error);
      }
    };

    const stopLocalLane = () => {
      localRecorder.current?.stop();
      localRecorder.current = null;
      localQueue.current = Promise.resolve();
    };

    const onLocalPublished = (publication: any) => {
      if (publication?.source === Track.Source.Microphone && publication.track) {
        void startLocalLane(publication.track);
      }
    };
    const onLocalUnpublished = (publication: any) => {
      if (publication?.source === Track.Source.Microphone) stopLocalLane();
    };

    room.on(RoomEvent.LocalTrackPublished, onLocalPublished);
    room.on(RoomEvent.LocalTrackUnpublished, onLocalUnpublished);
    const localMic = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
    if (localMic) void startLocalLane(localMic);

    const startLane = async (
      track: RemoteAudioTrack,
      publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      const key = publication.trackSid || track.mediaStreamTrack.id;
      if (lanes.current.has(key)) return;

      try { track.setVolume(1); } catch {}
      const clone = track.mediaStreamTrack.clone();
      const stream = new MediaStream([clone]);
      const lane: Lane = {
        track,
        queue: Promise.resolve(),
        recorder: new PhraseRecorder(stream, {
          silenceMs: 1_100,
          minSpeechMs: 260,
          maxPhraseMs: 20_000,
          threshold: 0.012,
          preRollMs: 180,
          onPhrase: (phrase) => {
            const phraseEndedAt = performance.now();
            lane.queue = lane.queue
              .then(() => processPhrase(phrase.bytes, participant, lane.track, phraseEndedAt))
              .catch((error) => {
                console.warn('[interpreter] phrase failed', error);
                try { lane.track.setVolume(1); } catch {}
                setStatus('AI temporarily unavailable · original audio remains audible');
              });
          },
        }),
      };
      lanes.current.set(key, lane);
      try {
        await lane.recorder.start();
      } catch (error) {
        lanes.current.delete(key);
        try { track.setVolume(1); } catch {}
        console.warn('[interpreter] recorder start failed', error);
      }
    };

    const stopLane = (track: RemoteAudioTrack, publication: RemoteTrackPublication) => {
      const key = publication.trackSid || track.mediaStreamTrack.id;
      const lane = lanes.current.get(key);
      if (!lane) return;
      lane.recorder.stop();
      try { lane.track.setVolume(1); } catch {}
      lanes.current.delete(key);
    };

    const onSubscribed = (
      track: any,
      publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      if (track.kind === Track.Kind.Audio) void startLane(track as RemoteAudioTrack, publication, participant);
    };
    const onUnsubscribed = (
      track: any,
      publication: RemoteTrackPublication,
    ) => {
      if (track.kind === Track.Kind.Audio) stopLane(track as RemoteAudioTrack, publication);
    };

    room.on(RoomEvent.TrackSubscribed, onSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onUnsubscribed);

    room.remoteParticipants.forEach((participant) => {
      participant.trackPublications.forEach((publication) => {
        const track = publication.track;
        if (track?.kind === Track.Kind.Audio) {
          void startLane(track as RemoteAudioTrack, publication as RemoteTrackPublication, participant);
        }
      });
    });

    return () => {
      room.off(RoomEvent.TrackSubscribed, onSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, onUnsubscribed);
      room.off(RoomEvent.LocalTrackPublished, onLocalPublished);
      room.off(RoomEvent.LocalTrackUnpublished, onLocalUnpublished);
      stopLocalLane();
      stopped.current = true;
      for (const lane of lanes.current.values()) {
        lane.recorder.stop();
        try { lane.track.setVolume(1); } catch {}
      }
      lanes.current.clear();
    };
  }, [enabled, processLocalPhrase, processPhrase, profile, room]);

  return {
    turns,
    status,
    mediatorNote,
    latestLatency,
    clear: () => {
      turnsRef.current = [];
      setTurns([]);
      setMediatorNote(null);
      if (sessionId) clearTranscript(sessionId);
    },
  };
}
