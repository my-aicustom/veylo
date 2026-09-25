'use client';

import * as React from 'react';

export type PickerOption = {
  value: string;
  label: string;
  detail?: string;
  keywords?: string[];
};

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: PickerOption[];
  featured: string[];
  disabled?: boolean;
  placeholder: string;
  searchHint?: (query: string) => string | null;
};

function normalize(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function SearchPicker({ label, value, onChange, options, featured, disabled, placeholder, searchHint }: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const selected = options.find((item) => item.value === value);
  const featuredOrder = React.useMemo(() => new Map(featured.map((code, index) => [code, index])), [featured]);

  const results = React.useMemo(() => {
    const needle = normalize(query);
    return options.map((item, index) => {
      const labelText = normalize(item.label);
      const detailText = normalize(item.detail || '');
      const aliases = (item.keywords || []).map(normalize);
      const featuredRank = featuredOrder.get(item.value) ?? 999;
      let score = 0;
      if (needle) {
        if (normalize(item.value) === needle || labelText === needle || aliases.includes(needle)) score = 5;
        else if (labelText.startsWith(needle) || aliases.some((alias) => alias.startsWith(needle))) score = 4;
        else if (detailText.startsWith(needle)) score = 3;
        else if (labelText.includes(needle) || aliases.some((alias) => alias.includes(needle))) score = 2;
        else if (detailText.includes(needle)) score = 1;
      }
      return { item, index, score, featuredRank };
    }).filter((entry) => !needle || entry.score > 0)
      .sort((a, b) => needle
        ? b.score - a.score || a.featuredRank - b.featuredRank || a.index - b.index
        : a.featuredRank - b.featuredRank || a.index - b.index)
      .slice(0, needle ? 60 : undefined);
  }, [featuredOrder, options, query]);

  React.useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    setQuery('');
    setActive(0);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function choose(next: string) {
    onChange(next);
    close();
  }

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current) => Math.min(current + 1, Math.max(0, results.length - 1)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter' && results[active]) {
      event.preventDefault();
      choose(results[active].item.value);
    }
  }

  return (
    <div className="picker-field" data-open={open}>
      <span className="picker-label">{label}</span>
      <button ref={triggerRef} className="picker-trigger" type="button" disabled={disabled} aria-label={`${label}: ${selected?.label || 'Choose'}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setQuery(''); setActive(0); setOpen(true); }}>
        <span className="picker-trigger-copy"><strong>{selected?.label || 'Choose'}</strong>{selected?.detail && <small>{selected.detail}</small>}</span>
        <span className="picker-chevron" aria-hidden="true">⌄</span>
      </button>
      {open && <>
        <button className="picker-backdrop" type="button" aria-label={`Close ${label} options`} onClick={close} />
        <div className="picker-panel" role="dialog" aria-label={`Choose ${label}`}>
          <div className="picker-panel-head"><strong>{label}</strong><button type="button" className="picker-close" onClick={close} aria-label="Close choices">×</button></div>
          <input ref={searchRef} className="picker-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} onKeyDown={onSearchKeyDown} placeholder={placeholder} aria-label={`Search ${label}`} autoComplete="off" />
          {query && searchHint?.(query) && <p className="picker-hint">{searchHint(query)}</p>}
          <div className="picker-results" role="listbox" aria-label={`${label} results`}>
            {!results.length && <p className="picker-empty">No match. Try another name or spelling.</p>}
            {results.map(({ item, featuredRank }, index) => <React.Fragment key={item.value}>
              {!query && (index === 0 || (featuredRank === 999 && results[index - 1]?.featuredRank !== 999)) && <div className="picker-group-label">{featuredRank === 999 ? 'All options' : 'Quick picks'}</div>}
              <button type="button" role="option" aria-selected={item.value === value} className="picker-option" data-active={index === active} onMouseEnter={() => setActive(index)} onClick={() => choose(item.value)}>
                <span><strong>{item.label}</strong>{item.detail && <small>{item.detail}</small>}</span><em>{item.value.toUpperCase()}</em>
              </button>
            </React.Fragment>)}
          </div>
          <p className="picker-count">{query ? `${results.length} matches` : `${options.length} options`} · Type to narrow the list</p>
        </div>
      </>}
    </div>
  );
}
