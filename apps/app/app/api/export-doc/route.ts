import { NextRequest, NextResponse } from 'next/server';
import { guardApi, cleanText } from '@/lib/api-guard';
import type { TradeDocData } from '@/lib/pdf/trade-docs';
import React from 'react';
// @ts-expect-error - pdfkit 0.20.2 does not publish declarations for this entrypoint.
import PDFDocument from 'pdfkit';

if (typeof (PDFDocument as any)?.prototype?.initFonts === 'function') {
  const proto = (PDFDocument as any).prototype;
  proto.initFonts = function (_defaultFont?: string, _defaultFontFamily?: string | null, defaultFontSize = 12) {
    this._fontFamilies = {};
    this._fontCount = 0;
    this._fontSource = null;
    this._fontFamily = null;
    this._fontSize = defaultFontSize;
    this._font = null;
    this._remSize = defaultFontSize;
    this._registeredFonts = {};
  };
  const origFont = proto.font;
  proto.font = function (src: any, family: any, size: any) {
    if (typeof src === 'string' && src.startsWith('Helvetica')) {
      return this;
    }
    return origFont ? origFont.call(this, src, family, size) : this;
  };
}

export const runtime = 'nodejs';


const DOC_TYPES = ['invoice', 'packing-list', 'ska-form-d'] as const;
type DocType = (typeof DOC_TYPES)[number];

const FILENAME: Record<DocType, string> = {
  'invoice': 'veylo-commercial-invoice',
  'packing-list': 'veylo-packing-list',
  'ska-form-d': 'veylo-ska-form-d',
};

const REACT_ELEMENT = Symbol.for('react.element');
const TRANSITIONAL_ELEMENT = Symbol.for('react.transitional.element');

function normalizeReactPdfElement(node: unknown): unknown {
  if (!node || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(normalizeReactPdfElement);

  const obj = node as Record<string, unknown>;
  const clone: Record<string, unknown> = { ...obj };

  if (clone.$$typeof === TRANSITIONAL_ELEMENT || clone.$$typeof) {
    clone.$$typeof = REACT_ELEMENT;
  }

  if (clone.props && typeof clone.props === 'object') {
    const props: Record<string, unknown> = { ...(clone.props as Record<string, unknown>) };
    if ('children' in props) {
      props.children = normalizeReactPdfElement(props.children);
    }
    clone.props = props;
  }

  return clone;
}

async function renderDoc(type: DocType, data: TradeDocData): Promise<Uint8Array> {
  const { renderToBuffer } = await import('@react-pdf/renderer');
  const { CommercialInvoice, PackingList, SKAFormD } = await import('@/lib/pdf/trade-docs');
  let el: React.ReactElement;
  if (type === 'invoice') el = CommercialInvoice({ data });
  else if (type === 'packing-list') el = PackingList({ data });
  else el = SKAFormD({ data });

  const normalized = normalizeReactPdfElement(el) as React.ReactElement;
  const buf = await renderToBuffer(normalized as any);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}



function sanitizeData(raw: unknown): TradeDocData {
  const d = (raw ?? {}) as Record<string, unknown>;
  const items = Array.isArray(d.items)
    ? d.items.slice(0, 50).map((item: unknown) => {
        const i = (item ?? {}) as Record<string, unknown>;
        return {
          description: cleanText(i.description, 200),
          hsCode: cleanText(i.hsCode, 20),
          qty: typeof i.qty === 'number' ? Math.max(0, i.qty) : 0,
          unit: cleanText(i.unit, 30) || 'kg',
          unitPrice: typeof i.unitPrice === 'number' ? Math.max(0, i.unitPrice) : 0,
          currency: cleanText(i.currency, 5) || 'USD',
          grossWeightKg: typeof i.grossWeightKg === 'number' ? i.grossWeightKg : undefined,
          netWeightKg: typeof i.netWeightKg === 'number' ? i.netWeightKg : undefined,
          cbm: typeof i.cbm === 'number' ? i.cbm : undefined,
          cartons: typeof i.cartons === 'number' ? i.cartons : undefined,
        };
      })
    : [];

  return {
    exporterName: cleanText(d.exporterName, 200) || 'PT. Eksportir Indonesia',
    exporterAddress: cleanText(d.exporterAddress, 500) || 'Jakarta, Indonesia',
    exporterNpwp: cleanText(d.exporterNpwp, 30) || undefined,
    importerName: cleanText(d.importerName, 200) || 'Importer',
    importerAddress: cleanText(d.importerAddress, 500) || '',
    importerCountry: cleanText(d.importerCountry, 100) || '',
    portOfLoading: cleanText(d.portOfLoading, 100) || 'Tanjung Priok, Jakarta',
    portOfDischarge: cleanText(d.portOfDischarge, 100) || '',
    vesselFlight: cleanText(d.vesselFlight, 100) || undefined,
    blNumber: cleanText(d.blNumber, 50) || undefined,
    invoiceNumber: cleanText(d.invoiceNumber, 50) || undefined,
    invoiceDate: cleanText(d.invoiceDate, 30) || undefined,
    incoterms: cleanText(d.incoterms, 20) || 'FOB',
    paymentTerms: cleanText(d.paymentTerms, 300) || undefined,
    countryOfOrigin: cleanText(d.countryOfOrigin, 50) || 'Indonesia',
    items: items.length > 0 ? items : [{
      description: 'Produk Ekspor Indonesia',
      hsCode: '0000.00',
      qty: 1,
      unit: 'kg',
      unitPrice: 0,
      currency: 'USD',
    }],
  };
}

export async function POST(request: NextRequest) {
  const guard = guardApi(request, 'export-doc', { limit: 10, windowMs: 60_000 });
  if (guard) return guard;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const type = cleanText(body.type, 20) as DocType;
  if (!DOC_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${DOC_TYPES.join(', ')}` },
      { status: 400 },
    );
  }

  const data = sanitizeData(body.data);

  try {
    const pdfBuffer = await renderDoc(type, data);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `${FILENAME[type]}-${date}.pdf`;

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[export-doc] PDF render error:', err);
    return NextResponse.json({ error: 'Failed to generate PDF document', details: err instanceof Error ? err.stack || err.message : String(err) }, { status: 500 });
  }
}
