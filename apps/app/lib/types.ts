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

export interface ConnectionDetails {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
}
