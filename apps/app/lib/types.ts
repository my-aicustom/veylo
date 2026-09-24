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
  isLocal?: boolean;
  sourceText: string;
  translatedText: string;
  sourceLanguage?: string;
  targetLanguage: string;
  translationState?: 'translated' | 'same-language' | 'failed' | 'source-only';
}

export interface MeetingParty {
  name?: string;
  company?: string;
  role?: string;
  country?: string;
  contact?: string;
}

export interface MeetingCommercialItem {
  product: string;
  quantity?: string;
  unit?: string;
  price?: string;
  currency?: string;
  incoterm?: string;
  delivery?: string;
  notes?: string;
}

export interface MeetingActionItem {
  owner?: string;
  action: string;
  due?: string;
  status?: 'open' | 'agreed' | 'tentative' | 'unknown';
}

export interface MeetingCommitment {
  party?: string;
  commitment: string;
  due?: string;
}

export interface MeetingIntelligence {
  generatedAt: string;
  meetingTitle: string;
  summary: string;
  parties: MeetingParty[];
  commercialItems: MeetingCommercialItem[];
  commitments: MeetingCommitment[];
  actionItems: MeetingActionItem[];
  followUps: string[];
  openQuestions: string[];
  risksOrAmbiguities: string[];
  languages: string[];
  sourceTurnCount: number;
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
