'use client';

import * as React from 'react';
import { ALL_LANGUAGE_CODES } from '@/lib/countries';
import { SearchPicker, type PickerOption } from './SearchPicker';

const COMMON_LANGUAGES = ['id', 'en', 'fr', 'es', 'zh', 'ja', 'ko', 'de', 'ar', 'pt', 'hi', 'ms'];
const ALIASES: Record<string, string[]> = {
  id: ['Bahasa Indonesia', 'Indonesia', 'Indonesian'],
  en: ['Inggris', 'English', 'Bahasa Inggris'],
  zh: ['Mandarin', 'Tionghoa', 'Chinese'],
  ja: ['Jepang', 'Japanese'],
  ko: ['Korea', 'Korean'],
  fr: ['Prancis', 'French'],
  de: ['Jerman', 'German'],
  es: ['Spanyol', 'Spanish'],
  ar: ['Arab', 'Arabic'],
  pt: ['Portugis', 'Portuguese'],
  ms: ['Melayu', 'Malay'],
};

const englishNames = new Intl.DisplayNames(['en'], { type: 'language' });
const indonesianNames = new Intl.DisplayNames(['id'], { type: 'language' });
const languageOptions: PickerOption[] = ALL_LANGUAGE_CODES.map((code) => {
  const label = englishNames.of(code) || code.toUpperCase();
  const localName = indonesianNames.of(code) || '';
  return { value: code, label, detail: localName !== label ? localName : undefined, keywords: ALIASES[code] };
});

export function LanguagePicker({ value, onChange, suggested = [], disabled, label = 'Language' }: { value: string; onChange: (code: string) => void; suggested?: string[]; disabled?: boolean; label?: string }) {
  const featured = React.useMemo(() => [...new Set([...suggested, ...COMMON_LANGUAGES])], [suggested]);
  return <SearchPicker label={label} value={value} onChange={onChange} disabled={disabled} options={languageOptions} featured={featured} placeholder="Search language, e.g. English or Inggris" />;
}
