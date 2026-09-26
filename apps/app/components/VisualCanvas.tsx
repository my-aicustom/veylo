'use client';

import * as React from 'react';

export type VisualCanvasView = 'routes' | 'tariff' | 'compliance' | 'market';
type FreightMode = 'sea' | 'air';

interface VisualCanvasProps {
  activeView?: VisualCanvasView;
  activeRoute?: string;
  onViewChange?: (view: VisualCanvasView) => void;
}

const routes = [
  {
    id: 'singapore',
    label: 'Route A',
    from: 'Tanjung Priok',
    to: 'Port of Singapore',
    region: 'Hub Asia/Global',
    transitSea: '2-3 hari',
    transitAir: '1.5 jam',
    rate20: 420,
    rate40: 690,
    path: 'M78 190 C165 138 254 116 380 132',
    color: '#d9ff63',
    milestones: ['Gate-in Jakarta', 'Feeder Singapore', 'Customs hub'],
  },
  {
    id: 'douala',
    label: 'Route B',
    from: 'Tanjung Priok',
    to: 'Port of Douala',
    region: 'Kamerun/Afrika',
    transitSea: '28-35 hari',
    transitAir: '19-25 jam',
    rate20: 4100,
    rate40: 6600,
    path: 'M78 190 C176 84 278 86 432 202 C515 264 618 245 713 173',
    color: '#f39a7c',
    milestones: ['Singapore hub', 'Colombo relay', 'Gulf of Guinea'],
  },
  {
    id: 'rotterdam',
    label: 'Route C',
    from: 'Tanjung Perak',
    to: 'Port of Rotterdam',
    region: 'Eropa',
    transitSea: '24-28 hari',
    transitAir: '16-22 jam',
    rate20: 3250,
    rate40: 5300,
    path: 'M111 236 C236 260 349 58 482 78 C588 94 660 118 748 92',
    color: '#9fd7ff',
    milestones: ['Surabaya loading', 'Suez lane', 'EU port entry'],
  },
  {
    id: 'jebel-ali',
    label: 'Route D',
    from: 'Tanjung Priok',
    to: 'Port of Jebel Ali',
    region: 'Dubai/Timur Tengah',
    transitSea: '14-18 hari',
    transitAir: '8-11 jam',
    rate20: 1850,
    rate40: 2950,
    path: 'M78 190 C196 202 292 177 407 128 C501 87 588 102 665 139',
    color: '#ffe082',
    milestones: ['Jakarta clearance', 'Indian Ocean', 'Jebel Ali free zone'],
  },
];

const tariffs = [
  { hs: '0901.11', label: 'HS 0901.11 (Kopi Arabika/Robusta Biji Mentah)', duty: 5, vat: 11, fta: 'ATIGA 0%', savingsRate: 0.05 },
  { hs: '1801.00', label: 'HS 1801.00 (Biji Kakao / Cocoa Beans)', duty: 5, vat: 11, fta: 'ATIGA 0%', savingsRate: 0.05 },
  { hs: '1513.11', label: 'HS 1513.11 (Virgin Coconut Oil / Kelapa)', duty: 8, vat: 11, fta: 'ATIGA 0%', savingsRate: 0.08 },
  { hs: '0804.50', label: 'HS 0804.50 (Buah Tropis Segar & Kering)', duty: 10, vat: 11, fta: 'ATIGA 0%', savingsRate: 0.1 },
];

const checklist = [
  'Sertifikasi Halal BPJPH',
  'Sertifikat Fitosanitari (Barantan RI)',
  'HACCP & ISO 22000',
  'Standard SFA (Singapura) / ANOR (Kamerun)',
  'Dokumen Ekspor (PEB, SKA Form D/AK, Bill of Lading, Packing List)',
];

const marketRows = [
  { commodity: 'Kopi robusta green bean', price: 'USD 3.7-4.4/kg FOB', signal: 'Ramadan & Q4 roastery demand', buyer: 'Roaster, importer, distributor' },
  { commodity: 'Cocoa beans fermented', price: 'USD 8.5-10.2/kg FOB', signal: 'High replacement demand', buyer: 'Processor, chocolate maker' },
  { commodity: 'Virgin coconut oil', price: 'USD 1,600-1,950/MT FOB', signal: 'Wellness and food service', buyer: 'FMCG, private label' },
  { commodity: 'Dried tropical fruit', price: 'USD 5.8-8.4/kg FOB', signal: 'Snack and hotel supply', buyer: 'Retail importer, HORECA' },
];

const quickChips: Array<{ label: string; view: VisualCanvasView; route?: string }> = [
  { label: 'Rute Tanjung Priok -> Singapura', view: 'routes', route: 'singapore' },
  { label: 'Rute Tanjung Priok -> Douala Kamerun', view: 'routes', route: 'douala' },
  { label: 'Cek HS Code Kopi 0901', view: 'tariff' },
  { label: 'Syarat Ekspor Kakao ke Afrika', view: 'compliance' },
  { label: 'Audit Kesiapan Sertifikasi', view: 'compliance' },
];

export function VisualCanvas({ activeView, activeRoute, onViewChange }: VisualCanvasProps) {
  const [view, setView] = React.useState<VisualCanvasView>(activeView ?? 'routes');
  const [routeId, setRouteId] = React.useState(activeRoute ?? 'singapore');

  React.useEffect(() => { if (activeView) setView(activeView); }, [activeView]);
  React.useEffect(() => { if (activeRoute) setRouteId(activeRoute); }, [activeRoute]);

  function switchView(nextView: VisualCanvasView, nextRoute?: string) {
    setView(nextView);
    if (nextRoute) setRouteId(nextRoute);
    onViewChange?.(nextView);
  }

  return (
    <section className="visual-canvas" aria-label="Trade intelligence visual canvas">
      <div className="canvas-head">
        <div>
          <span className="eyebrow">VISUAL CANVAS</span>
          <h2>Trade Intelligence Board</h2>
        </div>
        <div className="canvas-tabs" role="tablist" aria-label="Canvas views">
          {(['routes', 'tariff', 'compliance', 'market'] as VisualCanvasView[]).map((item) => (
            <button key={item} type="button" role="tab" aria-selected={view === item} onClick={() => switchView(item)}>
              {item}
            </button>
          ))}
        </div>
      </div>

      {view === 'routes' && <RouteVisualizer routeId={routeId} onRouteChange={setRouteId} />}
      {view === 'tariff' && <TariffCard />}
      {view === 'compliance' && <ComplianceRadar />}
      {view === 'market' && <MarketDemandCard />}

      <div className="quick-chip-row" aria-label="Quick trade prompts">
        {quickChips.map((chip) => (
          <button key={chip.label} type="button" onClick={() => switchView(chip.view, chip.route)}>
            {chip.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function RouteVisualizer({ routeId, onRouteChange }: { routeId: string; onRouteChange: (routeId: string) => void }) {
  const [mode, setMode] = React.useState<FreightMode>('sea');
  const selected = routes.find((route) => route.id === routeId) ?? routes[0];

  return (
    <div className="route-visualizer">
      <div className="canvas-control-row">
        <div className="segmented-control" aria-label="Freight mode">
          <button type="button" aria-pressed={mode === 'sea'} onClick={() => setMode('sea')}>Sea Freight</button>
          <button type="button" aria-pressed={mode === 'air'} onClick={() => setMode('air')}>Air Freight</button>
        </div>
        <select aria-label="Select cargo route" value={routeId} onChange={(event) => onRouteChange(event.target.value)}>
          {routes.map((route) => <option key={route.id} value={route.id}>{route.label} - {route.to}</option>)}
        </select>
      </div>

      <svg className="cargo-map" viewBox="0 0 820 320" role="img" aria-label={`${selected.from} to ${selected.to}`}>
        <defs>
          <radialGradient id="mapGlow" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#d9ff63" stopOpacity=".22" />
            <stop offset="100%" stopColor="#0d1010" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="820" height="320" rx="10" fill="url(#mapGlow)" />
        <path d="M60 238 C166 180 252 280 360 220 C470 158 580 202 760 118" fill="none" stroke="#303535" strokeWidth="1" />
        {routes.map((route) => (
          <path
            key={route.id}
            d={route.path}
            fill="none"
            stroke={route.id === selected.id ? route.color : '#3d4743'}
            strokeWidth={route.id === selected.id ? 4 : 1.5}
            strokeDasharray={mode === 'air' ? '9 12' : '0'}
            strokeLinecap="round"
          />
        ))}
        <MapMarker x={78} y={190} label="Jakarta" active={selected.from === 'Tanjung Priok'} />
        <MapMarker x={111} y={236} label="Surabaya" active={selected.from === 'Tanjung Perak'} />
        <MapMarker x={380} y={132} label="Singapore" active={selected.id === 'singapore'} />
        <MapMarker x={713} y={173} label="Douala" active={selected.id === 'douala'} />
        <MapMarker x={748} y={92} label="Rotterdam" active={selected.id === 'rotterdam'} />
        <MapMarker x={665} y={139} label="Jebel Ali" active={selected.id === 'jebel-ali'} />
      </svg>

      <div className="route-stats">
        <div><span>Transit</span><strong>{mode === 'sea' ? selected.transitSea : selected.transitAir}</strong></div>
        <div><span>20ft est.</span><strong>USD {selected.rate20.toLocaleString('en-US')}</strong></div>
        <div><span>40ft est.</span><strong>USD {selected.rate40.toLocaleString('en-US')}</strong></div>
      </div>
      <div className="milestone-strip">
        {selected.milestones.map((milestone) => <span key={milestone}>{milestone}</span>)}
      </div>
    </div>
  );
}

function MapMarker({ x, y, label, active }: { x: number; y: number; label: string; active: boolean }) {
  const alignLeft = x < 650;
  return (
    <g className="map-marker" data-active={active} transform={`translate(${x} ${y})`}>
      <circle r={active ? 8 : 5} />
      <text x={alignLeft ? 12 : -12} y="4" textAnchor={alignLeft ? 'start' : 'end'}>{label}</text>
    </g>
  );
}

function TariffCard() {
  const [selectedHs, setSelectedHs] = React.useState(tariffs[0].hs);
  const [invoice, setInvoice] = React.useState(25_000);
  const item = tariffs.find((tariff) => tariff.hs === selectedHs) ?? tariffs[0];
  const savings = Math.round(invoice * item.savingsRate);
  const vat = Math.round(invoice * item.vat / 100);

  return (
    <div className="tariff-card">
      <div className="canvas-control-row">
        <select aria-label="Select HS code" value={selectedHs} onChange={(event) => setSelectedHs(event.target.value)}>
          {tariffs.map((tariff) => <option key={tariff.hs} value={tariff.hs}>{tariff.label}</option>)}
        </select>
        <label className="invoice-input">
          Invoice USD
          <input type="number" min="1000" step="500" value={invoice} onChange={(event) => setInvoice(Number(event.target.value) || 0)} />
        </label>
      </div>
      <input className="invoice-slider" aria-label="Invoice value" type="range" min="5000" max="150000" step="2500" value={invoice} onChange={(event) => setInvoice(Number(event.target.value))} />
      <div className="tariff-grid">
        <div><span>Bea Masuk</span><strong>{item.duty}%</strong></div>
        <div><span>FTA Benefit</span><strong>{item.fta}</strong></div>
        <div><span>VAT / PPN</span><strong>{item.vat}% / USD {vat.toLocaleString('en-US')}</strong></div>
        <div><span>Est. duty savings</span><strong>USD {savings.toLocaleString('en-US')}</strong></div>
      </div>
    </div>
  );
}

function ComplianceRadar() {
  return (
    <div className="compliance-radar">
      <div className="readiness-gauge" aria-label="92% Export Ready">
        <div><strong>92%</strong><span>Export Ready</span></div>
      </div>
      <div className="compliance-list">
        {checklist.map((item, index) => (
          <label key={item}>
            <input type="checkbox" defaultChecked={index < 4} />
            <span>{item}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function MarketDemandCard() {
  return (
    <div className="market-card">
      {marketRows.map((row) => (
        <article key={row.commodity}>
          <span>{row.commodity}</span>
          <strong>{row.price}</strong>
          <p>{row.signal}</p>
          <small>{row.buyer}</small>
        </article>
      ))}
    </div>
  );
}
