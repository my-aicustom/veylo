'use client';

import * as React from 'react';
import { COUNTRY_LANGUAGE_HINTS } from '@/lib/countries';
import { CountryPicker } from './CountryPicker';
import { LanguagePicker } from './LanguagePicker';
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
      <CountryPicker value={countryCode} onChange={setCountryCode} />
      <LanguagePicker label="Preferred language" value={language} onChange={setLanguage} suggested={hints} />
      <button className="primary" type="submit">Continue</button>
      <p className="fineprint">Country is only a language hint. Choose your preferred language separately; speech is detected while you talk.</p>
    </form>
  );
}
