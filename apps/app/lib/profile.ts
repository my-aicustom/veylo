'use client';

import { COUNTRIES, COUNTRY_LANGUAGE_HINTS } from './countries';
import type { Profile } from './types';

const KEY = 'veylo.profile.v1';

export function defaultLanguage(countryCode: string) {
  return COUNTRY_LANGUAGE_HINTS[countryCode]?.[0] || 'en';
}

export function countryName(countryCode: string) {
  return COUNTRIES.find((item) => item.code === countryCode)?.name || countryCode;
}

export function loadProfile(): Profile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Profile>;
    if (!parsed.name || !parsed.countryCode) return null;
    return {
      name: parsed.name,
      countryCode: parsed.countryCode,
      countryName: parsed.countryName || countryName(parsed.countryCode),
      preferredLanguage: parsed.preferredLanguage || defaultLanguage(parsed.countryCode),
    };
  } catch {
    return null;
  }
}

export function saveProfile(profile: Profile) {
  localStorage.setItem(KEY, JSON.stringify(profile));
}
