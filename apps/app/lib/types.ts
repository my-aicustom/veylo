export interface Profile {
  name: string;
  countryCode: string;
  countryName: string;
  preferredLanguage: string;
}

export interface ParticipantContext {
  countryCode?: string;
  countryName?: string;
  preferredLanguage?: string;
}

export interface TranscriptTurn {
  id: string;
  at: string;
  participantIdentity?: string;
  participantName?: string;
  sourceText: string;
  translatedText: string;
  sourceLanguage?: string;
  targetLanguage: string;
}

export interface SpeechPlaybackTiming {
  mode: 'progressive' | 'buffered';
  responseMs: number;
  firstChunkMs?: number;
  playbackStartMs: number;
  totalMs: number;
}

export interface LatencyTrace {
  id: string;
  at: string;
  participantName?: string;
  sourceLanguage?: string;
  targetLanguage: string;
  captureQueueMs: number;
  sttMs: number;
  translateMs?: number;
  speechQueueMs?: number;
  ttsResponseMs?: number;
  ttsFirstChunkMs?: number;
  ttsPlaybackStartMs?: number;
  ttsTotalMs?: number;
  endToEndPlaybackMs?: number;
  totalTurnMs: number;
  playbackMode: 'progressive' | 'buffered' | 'none';
}

export interface ConnectionDetails {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
}
