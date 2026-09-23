import type { ParticipantContext } from './types';

export function parseParticipantMetadata(metadata?: string): ParticipantContext {
  if (!metadata) return {};
  try {
    const value = JSON.parse(metadata);
    return {
      countryCode: typeof value.countryCode === 'string' ? value.countryCode : undefined,
      countryName: typeof value.countryName === 'string' ? value.countryName : undefined,
      preferredLanguage: typeof value.preferredLanguage === 'string' ? value.preferredLanguage : undefined,
    };
  } catch {
    return {};
  }
}
