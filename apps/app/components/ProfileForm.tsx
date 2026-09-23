'use client';

import * as React from 'react';
import { ALL_LANGUAGE_CODES, COUNTRIES, COUNTRY_LANGUAGE_HINTS } from '@/lib/countries';
import { countryName, defaultLanguage, saveProfile } from '@/lib/profile';
import type { Profile } from '@/lib/types';

export function ProfileForm({ onDone, compact = false }: { onDone: (profile: Profile) => void; compact?: boolean }) {
  const [name, setName] = React.useState('');
  const [countryCode, setCountryCode] = React.useState('ID');
  const [language, setLanguage] = React.useState(defaultLanguage('ID'));

  React.useEffect(() => setLanguage(defaultLanguage(countryCode)), [countryCode]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    const profile: Profile = {
      name: clean,
      countryCode,
      countryName: countryName(countryCode),
      preferredLanguage: language,
    };
    saveProfile(profile);
    onDone(profile);
  }

  const hints = COUNTRY_LANGUAGE_HINTS[countryCode] || ['en'];
  return (
    <form className={compact ? 'profile-form compact' : 'profile-form'} onSubmit={submit}>
      <label>
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoFocus required />
      </label>
      <label>
        <span>Country</span>
        <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
          {COUNTRIES.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
        </select>
      </label>
      <label>
        <span>Preferred language</span>
        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          <optgroup label="Suggested for this country">
            {hints.map((code) => <option key={`hint-${code}`} value={code}>{languageLabel(code)} ({code})</option>)}
          </optgroup>
          <optgroup label="All available language hints">
            {ALL_LANGUAGE_CODES.filter((code) => !hints.includes(code)).map((code) => <option key={code} value={code}>{languageLabel(code)} ({code})</option>)}
          </optgroup>
        </select>
      </label>
      <button className="primary" type="submit">Continue</button>
      <p className="fineprint">Country is only a language hint. Spoken language is detected during interpretation.</p>
    </form>
  );
}

function languageLabel(code: string) {
  try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code; }
  catch { return code; }
}
