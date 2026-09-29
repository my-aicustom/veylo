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
    "id": "singapore",
    "label": "Koridor A",
    "from": "Tanjung Priok",
    "fromLocode": "IDJKT",
    "to": "Port of Singapore",
    "toLocode": "SGSIN",
    "region": "Hub ASEAN / Global",
    "transitSea": "2-3 hari",
    "transitAir": "1.5 jam",
    "rate20": 420,
    "rate40": 690,
    "path": "M78 190 C165 138 254 116 380 132",
    "color": "#d9ff63",
    "milestones": [
      "Gate-in Priok",
      "Feeder Singapore",
      "Customs SFA hub"
    ]
  },
  {
    "id": "shanghai",
    "label": "Koridor B",
    "from": "Tanjung Priok",
    "fromLocode": "IDJKT",
    "to": "Port of Shanghai (Yangshan)",
    "toLocode": "CNSHA",
    "region": "East Asia Mega Hub",
    "transitSea": "8-12 hari",
    "transitAir": "6-8 jam",
    "rate20": 1100,
    "rate40": 1950,
    "path": "M78 190 C220 160 380 90 560 70",
    "color": "#00e5ff",
    "milestones": [
      "Priok loading",
      "South China Sea",
      "GACC Clearance"
    ]
  },
  {
    "id": "tokyo",
    "label": "Koridor C",
    "from": "Tanjung Priok",
    "fromLocode": "IDJKT",
    "to": "Port of Yokohama / Tokyo",
    "toLocode": "JPYOK",
    "region": "Jepang / Pasifik",
    "transitSea": "10-14 hari",
    "transitAir": "7-9 jam",
    "rate20": 1450,
    "rate40": 2500,
    "path": "M78 190 C260 140 440 60 640 55",
    "color": "#ff80ab",
    "milestones": [
      "Direct liner",
      "Okinawa transit",
      "MHLW Quarantine"
    ]
  },
  {
    "id": "los-angeles",
    "label": "Koridor D",
    "from": "Tanjung Priok",
    "fromLocode": "IDJKT",
    "to": "Port of Los Angeles (POLA)",
    "toLocode": "USLAX",
    "region": "Amerika Serikat / Pantai Barat",
    "transitSea": "22-28 hari",
    "transitAir": "19-24 jam",
    "rate20": 3800,
    "rate40": 5900,
    "path": "M78 190 C300 240 550 180 760 120",
    "color": "#b388ff",
    "milestones": [
      "Trans-Pacific Lane",
      "ISF Filing 24h",
      "US Customs FDA"
    ]
  },
  {
    "id": "rotterdam",
    "label": "Koridor E",
    "from": "Tanjung Perak / Priok",
    "fromLocode": "IDJKT",
    "to": "Port of Rotterdam",
    "toLocode": "NLRTM",
    "region": "Uni Eropa",
    "transitSea": "24-28 hari",
    "transitAir": "16-22 jam",
    "rate20": 3250,
    "rate40": 5300,
    "path": "M111 236 C236 260 349 58 482 78 C588 94 660 118 748 92",
    "color": "#9fd7ff",
    "milestones": [
      "Priok loading",
      "Suez Canal transit",
      "EU Port Entry"
    ]
  },
  {
    "id": "jebel-ali",
    "label": "Koridor F",
    "from": "Tanjung Priok",
    "fromLocode": "IDJKT",
    "to": "Port of Jebel Ali (Dubai)",
    "toLocode": "AEJEA",
    "region": "Timur Tengah / GCC Hub",
    "transitSea": "14-18 hari",
    "transitAir": "8-11 jam",
    "rate20": 1850,
    "rate40": 2950,
    "path": "M78 190 C196 202 292 177 407 128 C501 87 588 102 665 139",
    "color": "#ffe082",
    "milestones": [
      "Indian Ocean route",
      "Jebel Ali Free Zone",
      "ESMA Halal Hub"
    ]
  },
  {
    "id": "sydney",
    "label": "Koridor G",
    "from": "Tanjung Priok",
    "fromLocode": "IDJKT",
    "to": "Port Botany (Sydney)",
    "toLocode": "AUSYD",
    "region": "Australia / Oseania",
    "transitSea": "12-16 hari",
    "transitAir": "7-10 jam",
    "rate20": 1950,
    "rate40": 3100,
    "path": "M78 190 C180 250 320 310 520 340",
    "color": "#69f0ae",
    "milestones": [
      "Timor Sea route",
      "Sydney Gateway",
      "DAFF Biosecurity"
    ]
  },
  {
    "id": "douala",
    "label": "Koridor H",
    "from": "Tanjung Priok",
    "fromLocode": "IDJKT",
    "to": "Port of Douala",
    "toLocode": "CMDLA",
    "region": "Afrika Barat",
    "transitSea": "28-35 hari",
    "transitAir": "19-25 jam",
    "rate20": 4100,
    "rate40": 6600,
    "path": "M78 190 C176 84 278 86 432 202 C515 264 618 245 713 173",
    "color": "#f39a7c",
    "milestones": [
      "Singapore hub",
      "Colombo relay",
      "Gulf of Guinea"
    ]
  }
];

const tariffs = [
  {
    "hs": "0901.11",
    "label": "HS 0901.11 (Kopi Arabika/Robusta Biji Mentah)",
    "duty": 5,
    "vat": 11,
    "fta": "ATIGA / EPA 0%",
    "savingsRate": 0.05
  },
  {
    "hs": "1702.90",
    "label": "HS 1702.90 (Gula Aren Organik & Nektar Palma)",
    "duty": 5,
    "vat": 11,
    "fta": "ATIGA 0% / GSP EU 2%",
    "savingsRate": 0.05
  },
  {
    "hs": "1801.00",
    "label": "HS 1801.00 (Biji Kakao Fermentasi Pilihan)",
    "duty": 5,
    "vat": 11,
    "fta": "ATIGA 0% / ACFTA 0%",
    "savingsRate": 0.05
  },
  {
    "hs": "1513.11",
    "label": "HS 1513.11 (Virgin Coconut Oil / Minyak Kelapa Murni)",
    "duty": 8,
    "vat": 11,
    "fta": "ATIGA 0% / US GSP 0%",
    "savingsRate": 0.08
  },
  {
    "hs": "0804.50",
    "label": "HS 0804.50 (Buah Tropis Kering / Freeze Dried Mango)",
    "duty": 10,
    "vat": 11,
    "fta": "ATIGA 0% / CEPA 2.5%",
    "savingsRate": 0.1
  },
  {
    "hs": "6214.10",
    "label": "HS 6214.10 (Syal Sutra Batik Anggrek Vandoglas)",
    "duty": 12,
    "vat": 11,
    "fta": "EPA Japan 0% / IA-CEPA 0%",
    "savingsRate": 0.12
  },
  {
    "hs": "4419.12",
    "label": "HS 4419.12 (Peralatan Makan Bambu Ramah Lingkungan)",
    "duty": 6,
    "vat": 11,
    "fta": "EU REX 0% / US Duty Free",
    "savingsRate": 0.06
  },
  {
    "hs": "8481.80",
    "label": "HS 8481.80 (Fitting Katup Kuningan Presisi CNC)",
    "duty": 5,
    "vat": 11,
    "fta": "ATIGA 0% / ACFTA 0%",
    "savingsRate": 0.05
  },
  {
    "hs": "3301.29",
    "label": "HS 3301.29 (Minyak Atsiri Nilam Murni / Patchouli Oil)",
    "duty": 5,
    "vat": 11,
    "fta": "WTO MFN 0% / EU Free",
    "savingsRate": 0.05
  }
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
          <p>Data demonstrasi — tarif, harga, dan rute belum diverifikasi untuk transaksi.</p>
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
        <span className="locode-badge">{selected.fromLocode} → {selected.toLocode}</span>
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
        <g className="map-locode-pill" transform="translate(28 28)">
          <rect width="138" height="25" rx="7" />
          <text x="69" y="17" textAnchor="middle">{selected.fromLocode} → {selected.toLocode}</text>
        </g>
      </svg>

      <div className="route-stats">
        <div><span>UN/LOCODE</span><strong>{selected.fromLocode} → {selected.toLocode}</strong></div>
        <div><span>Transit</span><strong>{mode === 'sea' ? selected.transitSea : selected.transitAir}</strong></div>
        {mode === 'sea' && <div><span>20ft est.</span><strong>USD {selected.rate20.toLocaleString('en-US')}</strong></div>}
        {mode === 'sea' && <div><span>40ft est.</span><strong>USD {selected.rate40.toLocaleString('en-US')}</strong></div>}
        {mode === 'air' && <div><span>Air freight</span><strong>Quotation required</strong></div>}
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
  const [checked, setChecked] = React.useState<boolean[]>(() => checklist.map(() => false));
  const readiness = Math.round(checked.filter(Boolean).length / checklist.length * 100);
  return (
    <div className="compliance-radar">
      <p>Checklist mandiri; bukan sertifikasi Export Ready.</p>
      <div className="readiness-gauge" aria-label={`${readiness}% checklist completed`}>
        <div><strong>{readiness}%</strong><span>Checklist completed</span></div>
      </div>
      <div className="compliance-list">
        {checklist.map((item, index) => (
          <label key={item}>
            <input type="checkbox" checked={checked[index]} onChange={(event) => setChecked((current) => current.map((value, i) => i === index ? event.target.checked : value))} />
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
