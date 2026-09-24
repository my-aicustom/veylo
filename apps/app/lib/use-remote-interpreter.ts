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
import { mediate, playSpeech, transcribe, translate } from './client-ai';
import { clearTranscript, loadTranscript, saveTranscript } from './transcript-persistence';
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
  options?: { targetLanguage?: string; sessionId?: string },
) {
  const [turns, setTurns] = React.useState<TranscriptTurn[]>([]);
  const [status, setStatus] = React.useState('Interpreter off');
  const [mediatorNote, setMediatorNote] = React.useState<string | null>(null);
  const [latestLatency, setLatestLatency] = React.useState<LatencyTrace | null>(null);
  const turnsRef = React.useRef<TranscriptTurn[]>([]);
  const lanes = React.useRef(new Map<string, Lane>());
  const speechQueue = React.useRef<Promise<void>>(Promise.resolve());
  const stopped = React.useRef(false);

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
    const stt = await transcribe(bytes);
    const sttMs = performance.now() - sttStartedAt;

    const sourceText = (stt.text || '').trim();
    if (!sourceText || stopped.current || !enabled) return;

    const context = parseParticipantMetadata(participant.metadata);
    const sourceLanguage = (stt.language || '').split('-')[0] || undefined;
    const isSameLanguage = Boolean(
      sourceLanguage &&
      sourceLanguage.toLowerCase() === targetLanguage.toLowerCase()
    );

    let translatedText = sourceText;
    let translateMs: number | undefined;

    if (!isSameLanguage) {
      const translateStartedAt = performance.now();
      const result = await translate(sourceText, {
        sourceLanguage,
        targetLanguage,
        sourceCountry: context.countryName,
        targetCountry: profile.countryName,
      });
      translateMs = performance.now() - translateStartedAt;
      translatedText = result.text;
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
    };
    const nextTurns = [...turnsRef.current.slice(-79), turn];
    commitTurns(nextTurns);

    if (nextTurns.length >= 2 && nextTurns.length % 2 === 0) {
      void mediate(nextTurns.slice(-8)).then((result) => setMediatorNote(result.note)).catch(() => {});
    }

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

    if (isSameLanguage) {
      commitLatency({
        ...traceBase,
        totalTurnMs: performance.now() - phraseEndedAt,
        playbackMode: 'none',
      });
    } else {
      setStatus('Speaking translation…');
      const queuedAt = performance.now();

      speechQueue.current = speechQueue.current
        .then(async () => {
          const speechQueueMs = performance.now() - queuedAt;
          if (stopped.current || !enabled) return;

          try { track.setVolume(0.08); } catch {}
          const ttsStartedAt = performance.now();

          try {
            const playback = await playSpeech(translatedText);
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
        });

      await speechQueue.current;
    }

    if (!stopped.current && enabled) setStatus('Listening');
  }, [commitLatency, commitTurns, enabled, profile, targetLanguage]);

  React.useEffect(() => {
    stopped.current = !enabled;
    if (!enabled || !profile) {
      setStatus('Interpreter off');
      for (const lane of lanes.current.values()) {
        lane.recorder.stop();
        try { lane.track.setVolume(1); } catch {}
      }
      lanes.current.clear();
      return;
    }

    stopped.current = false;
    setStatus('Listening');

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
          silenceMs: 560,
          minSpeechMs: 260,
          maxPhraseMs: 4_600,
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
      stopped.current = true;
      for (const lane of lanes.current.values()) {
        lane.recorder.stop();
        try { lane.track.setVolume(1); } catch {}
      }
      lanes.current.clear();
    };
  }, [enabled, processPhrase, profile, room]);

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
