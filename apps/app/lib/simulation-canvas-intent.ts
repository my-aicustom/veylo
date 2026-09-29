import type { VisualCanvasView } from '@/components/VisualCanvas';

export type VisualCanvasRoute = 'singapore' | 'douala' | 'rotterdam' | 'jebel-ali';

export interface SimulationCanvasIntent {
  view: VisualCanvasView;
  route?: VisualCanvasRoute;
}

const routeTerms: Array<{ route: VisualCanvasRoute; pattern: RegExp }> = [
  { route: 'jebel-ali', pattern: /\b(jebel\s*ali|dubai|timur\s*tengah|middle\s*east)\b/i },
  { route: 'rotterdam', pattern: /\b(rotterdam|eropa|europe|eu)\b/i },
  { route: 'douala', pattern: /\b(douala|kamerun|cameroon|afrika|africa)\b/i },
  { route: 'singapore', pattern: /\b(singapura|singapore)\b/i },
];

const intentPatterns: Array<{ view: VisualCanvasView; pattern: RegExp }> = [
  {
    view: 'tariff',
    pattern: /\b(tarif|bea\s*masuk|pajak|hs\s*code|hscode|duty|ppn|atiga)\b/i,
  },
  {
    view: 'compliance',
    pattern: /\b(sertifikasi|kepatuhan|bpom|halal|haccp|dokumen|barantan|izin|permit|certification|compliance)\b/i,
  },
  {
    view: 'market',
    pattern: /\b(harga\s*pasar|fob|benchmark|demand|komoditas|commodity|market)\b/i,
  },
];

const routePattern = /\b(rute|route|pelabuhan|port|transit|shipping|shipment|kapal|vessel|pesawat|air\s*freight|sea\s*freight|freight|logistik|logistics)\b/i;

export function detectSimulationCanvasIntent(text: string): SimulationCanvasIntent | null {
  const routeMatch = routeTerms.find(({ pattern }) => pattern.test(text));
  const routeMentioned = routePattern.test(text) || routeMatch !== undefined;

  if (routeMentioned) {
    return {
      view: 'routes',
      route: routeMatch?.route,
    };
  }

  const panelMatch = intentPatterns.find(({ pattern }) => pattern.test(text));
  if (!panelMatch) return null;
  return { view: panelMatch.view };
}

export function latestSimulationCanvasIntent(turns: Array<{ text: string }>): SimulationCanvasIntent | null {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const intent = detectSimulationCanvasIntent(turns[index].text);
    if (intent) return intent;
  }
  return null;
}
