'use client';

import * as React from 'react';
import { COUNTRIES } from '@/lib/countries';
import { SearchPicker, type PickerOption } from './SearchPicker';

const QUICK_COUNTRIES = ['ID', 'GB', 'US', 'AU', 'SG', 'MY', 'JP', 'KR', 'CN', 'IN', 'FR', 'DE', 'AE', 'SA'];
const EXTRA_NAMES: Record<string, string[]> = {
  GB: ['Inggris', 'Britania', 'Britania Raya', 'Britain', 'Great Britain', 'England', 'UK', 'English'],
  US: ['Amerika', 'Amerika Serikat', 'America', 'USA', 'United States of America', 'English'],
  AU: ['Australia', 'English'],
  CA: ['Kanada', 'Canada', 'English'],
  IE: ['Irlandia', 'Ireland', 'English'],
  NZ: ['Selandia Baru', 'New Zealand', 'English'],
  ID: ['Indonesia', 'Bahasa Indonesia', 'Indonesian'],
  SG: ['Singapura', 'Singapore', 'English'],
  MY: ['Malaysia', 'Malaya'],
  JP: ['Jepang', 'Japan'],
  KR: ['Korea Selatan', 'South Korea'],
  CN: ['Tiongkok', 'Cina', 'China'],
  AE: ['Uni Emirat Arab', 'UAE'],
};

const regionNames = new Intl.DisplayNames(['id'], { type: 'region' });
const countryOptions: PickerOption[] = COUNTRIES.map(({ code, name }) => {
  const localName = regionNames.of(code) || '';
  return {
    value: code,
    label: name,
    detail: localName.toLowerCase() !== name.toLowerCase() ? localName : undefined,
    keywords: EXTRA_NAMES[code],
  };
});

export function CountryPicker({ value, onChange, disabled, label = 'Country' }: { value: string; onChange: (code: string) => void; disabled?: boolean; label?: string }) {
  return <SearchPicker label={label} value={value} onChange={onChange} disabled={disabled} options={countryOptions} featured={QUICK_COUNTRIES} placeholder="Search country, e.g. Inggris, Britain, America" searchHint={(query) => /^(english|inggris)$/i.test(query.trim()) ? 'Looking for a country? United Kingdom is listed below. English is the language; you can set it separately.' : null} />;
}
