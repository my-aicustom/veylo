/**
 * Veylo Trade Advisor — Export Document Templates
 * Server-side PDF generation using @react-pdf/renderer
 */
import React from 'react';
import {
  Document,
  Font,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';

Font.register({
  family: 'Roboto',
  fonts: [
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf',
      fontWeight: 'normal',
    },
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf',
      fontWeight: 'bold',
    },
  ],
});

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TradeItem {
  description: string;
  hsCode: string;
  qty: number;
  unit: string;
  unitPrice: number;
  currency: string;
  grossWeightKg?: number;
  netWeightKg?: number;
  cbm?: number;
  cartons?: number;
}

export interface TradeDocData {
  // Parties
  exporterName: string;
  exporterAddress: string;
  exporterNpwp?: string;
  importerName: string;
  importerAddress: string;
  importerCountry: string;
  // Shipment
  portOfLoading: string;
  portOfDischarge: string;
  vesselFlight?: string;
  blNumber?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  // Items
  items: TradeItem[];
  // Terms
  incoterms?: string;
  paymentTerms?: string;
  countryOfOrigin?: string;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const EMERALD = '#0D9488';
const SLATE = '#475569';
const BORDER = '#CBD5E1';
const WHITE = '#FFFFFF';
const LIGHT = '#F8FAFC';

const base = StyleSheet.create({
  page: { fontSize: 9, fontFamily: 'Roboto', padding: 36, color: '#1E293B' },
  header: { backgroundColor: EMERALD, padding: 16, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between' },
  headerTitle: { color: WHITE, fontSize: 16, fontFamily: 'Roboto', fontWeight: 'bold' },
  headerSub: { color: '#CCFBF1', fontSize: 8, marginTop: 2 },
  docType: { color: WHITE, fontSize: 11, fontFamily: 'Roboto', fontWeight: 'bold', textAlign: 'right' },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 8, fontFamily: 'Roboto', fontWeight: 'bold', color: EMERALD, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4, borderBottom: `1 solid ${EMERALD}`, paddingBottom: 2 },
  row: { flexDirection: 'row', gap: 16 },
  col: { flex: 1 },
  label: { color: SLATE, fontSize: 7.5, marginBottom: 1 },
  value: { fontSize: 8.5, fontFamily: 'Roboto', fontWeight: 'bold' },
  // Table
  table: { borderTop: `1 solid ${BORDER}`, marginTop: 4 },
  tableHeader: { flexDirection: 'row', backgroundColor: LIGHT, borderBottom: `1 solid ${BORDER}`, padding: '4 6' },
  tableHeaderCell: { fontFamily: 'Roboto', fontWeight: 'bold', fontSize: 7.5, color: SLATE, flex: 1 },
  tableRow: { flexDirection: 'row', borderBottom: `0.5 solid ${BORDER}`, padding: '4 6' },
  tableRowAlt: { flexDirection: 'row', backgroundColor: LIGHT, borderBottom: `0.5 solid ${BORDER}`, padding: '4 6' },
  tableCell: { fontSize: 8, flex: 1 },
  tableCellRight: { fontSize: 8, flex: 1, textAlign: 'right' },
  // Total row
  totalRow: { flexDirection: 'row', borderTop: `1.5 solid ${EMERALD}`, padding: '5 6', backgroundColor: '#F0FDF4' },
  totalLabel: { flex: 3, fontFamily: 'Roboto', fontWeight: 'bold', fontSize: 8.5, color: EMERALD },
  totalValue: { flex: 1, fontFamily: 'Roboto', fontWeight: 'bold', fontSize: 8.5, textAlign: 'right', color: EMERALD },
  // Footer
  footer: { position: 'absolute', bottom: 24, left: 36, right: 36, borderTop: `0.5 solid ${BORDER}`, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: SLATE },
  poweredBy: { fontSize: 7, color: EMERALD },
});

// ─── Shared components ───────────────────────────────────────────────────────

function DocHeader({ title, docType }: { title: string; docType: string }) {
  return (
    <View style={base.header}>
      <View>
        <Text style={base.headerTitle}>Veylo Trade Advisor</Text>
        <Text style={base.headerSub}>{title}</Text>
      </View>
      <Text style={base.docType}>{docType}</Text>
    </View>
  );
}

function Parties({ data }: { data: TradeDocData }) {
  return (
    <View style={[base.section, base.row]}>
      <View style={base.col}>
        <Text style={base.sectionTitle}>Exporter / Penjual</Text>
        <Text style={base.value}>{data.exporterName}</Text>
        <Text style={base.label}>{data.exporterAddress}</Text>
        {data.exporterNpwp && <Text style={base.label}>NPWP: {data.exporterNpwp}</Text>}
      </View>
      <View style={base.col}>
        <Text style={base.sectionTitle}>Importer / Pembeli</Text>
        <Text style={base.value}>{data.importerName}</Text>
        <Text style={base.label}>{data.importerAddress}</Text>
        <Text style={base.label}>{data.importerCountry}</Text>
      </View>
    </View>
  );
}

function ShipmentInfo({ data, invoiceNo }: { data: TradeDocData; invoiceNo?: string }) {
  const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  return (
    <View style={[base.section, base.row]}>
      <View style={base.col}>
        <Text style={base.sectionTitle}>Detail Pengiriman</Text>
        <Text style={base.label}>Port Muat: {data.portOfLoading}</Text>
        <Text style={base.label}>Port Bongkar: {data.portOfDischarge}</Text>
        {data.vesselFlight && <Text style={base.label}>Kapal/Flight: {data.vesselFlight}</Text>}
        {data.blNumber && <Text style={base.label}>B/L Number: {data.blNumber}</Text>}
      </View>
      <View style={base.col}>
        <Text style={base.sectionTitle}>Referensi Dokumen</Text>
        <Text style={base.label}>No. Invoice: {invoiceNo ?? data.invoiceNumber ?? 'VTR-' + Date.now().toString().slice(-6)}</Text>
        <Text style={base.label}>Tanggal: {data.invoiceDate ?? today}</Text>
        <Text style={base.label}>Incoterms: {data.incoterms ?? 'FOB'}</Text>
        <Text style={base.label}>Negara Asal: {data.countryOfOrigin ?? 'Indonesia'}</Text>
      </View>
    </View>
  );
}

function DocFooter() {
  return (
    <View style={base.footer} fixed>
      <Text style={base.footerText}>Generated by Veylo Trade Advisor — dokumen ini bukan pengganti dokumen resmi kepabeanan</Text>
      <Text style={base.poweredBy}>Powered by my-aicustom.com</Text>
    </View>
  );
}

// ─── 1. Commercial Invoice ───────────────────────────────────────────────────

export function CommercialInvoice({ data }: { data: TradeDocData }) {
  const currency = data.items[0]?.currency ?? 'USD';
  const total = data.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);

  return (
    <Document title="Commercial Invoice — Veylo Trade Advisor">
      <Page size="A4" style={base.page}>
        {DocHeader({ title: 'International Trade Document', docType: 'COMMERCIAL INVOICE' })}
        {Parties({ data })}
        {ShipmentInfo({ data })}

        <View style={base.section}>
          <Text style={base.sectionTitle}>Rincian Barang / Description of Goods</Text>
          <View style={base.table}>
            <View style={base.tableHeader}>
              <Text style={[base.tableHeaderCell, { flex: 3 }]}>Deskripsi Barang</Text>
              <Text style={base.tableHeaderCell}>HS Code</Text>
              <Text style={base.tableHeaderCell}>Qty</Text>
              <Text style={base.tableHeaderCell}>Satuan</Text>
              <Text style={[base.tableHeaderCell, { textAlign: 'right' }]}>Harga/Unit ({currency})</Text>
              <Text style={[base.tableHeaderCell, { textAlign: 'right' }]}>Total ({currency})</Text>
            </View>
            {data.items.map((item, i) => (
              <View key={i} style={i % 2 === 0 ? base.tableRow : base.tableRowAlt}>
                <Text style={[base.tableCell, { flex: 3 }]}>{item.description}</Text>
                <Text style={base.tableCell}>{item.hsCode}</Text>
                <Text style={base.tableCell}>{item.qty}</Text>
                <Text style={base.tableCell}>{item.unit}</Text>
                <Text style={base.tableCellRight}>{item.unitPrice.toFixed(2)}</Text>
                <Text style={base.tableCellRight}>{(item.qty * item.unitPrice).toFixed(2)}</Text>
              </View>
            ))}
            <View style={base.totalRow}>
              <Text style={base.totalLabel}>TOTAL FOB VALUE</Text>
              <Text style={base.totalValue}>{currency} {total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
            </View>
          </View>
        </View>

        {data.paymentTerms && (
          <View style={base.section}>
            <Text style={base.sectionTitle}>Terms & Conditions</Text>
            <Text style={base.label}>{data.paymentTerms}</Text>
          </View>
        )}

        {DocFooter()}
      </Page>
    </Document>
  );
}

// ─── 2. Packing List ─────────────────────────────────────────────────────────

export function PackingList({ data }: { data: TradeDocData }) {
  const totalGross = data.items.reduce((s, i) => s + (i.grossWeightKg ?? 0), 0);
  const totalNet = data.items.reduce((s, i) => s + (i.netWeightKg ?? 0), 0);
  const totalCbm = data.items.reduce((s, i) => s + (i.cbm ?? 0), 0);
  const totalCartons = data.items.reduce((s, i) => s + (i.cartons ?? 0), 0);

  return (
    <Document title="Packing List — Veylo Trade Advisor">
      <Page size="A4" style={base.page}>
        {DocHeader({ title: 'International Trade Document', docType: 'PACKING LIST' })}
        {Parties({ data })}
        {ShipmentInfo({ data })}

        <View style={base.section}>
          <Text style={base.sectionTitle}>Rincian Kemasan / Packing Details</Text>
          <View style={base.table}>
            <View style={base.tableHeader}>
              <Text style={[base.tableHeaderCell, { flex: 3 }]}>Deskripsi Barang</Text>
              <Text style={base.tableHeaderCell}>HS Code</Text>
              <Text style={base.tableHeaderCell}>Qty</Text>
              <Text style={[base.tableHeaderCell, { textAlign: 'right' }]}>Karton</Text>
              <Text style={[base.tableHeaderCell, { textAlign: 'right' }]}>Berat Kotor (Kg)</Text>
              <Text style={[base.tableHeaderCell, { textAlign: 'right' }]}>Berat Neto (Kg)</Text>
              <Text style={[base.tableHeaderCell, { textAlign: 'right' }]}>CBM</Text>
            </View>
            {data.items.map((item, i) => (
              <View key={i} style={i % 2 === 0 ? base.tableRow : base.tableRowAlt}>
                <Text style={[base.tableCell, { flex: 3 }]}>{item.description}</Text>
                <Text style={base.tableCell}>{item.hsCode}</Text>
                <Text style={base.tableCell}>{item.qty} {item.unit}</Text>
                <Text style={base.tableCellRight}>{item.cartons ?? '-'}</Text>
                <Text style={base.tableCellRight}>{item.grossWeightKg?.toFixed(2) ?? '-'}</Text>
                <Text style={base.tableCellRight}>{item.netWeightKg?.toFixed(2) ?? '-'}</Text>
                <Text style={base.tableCellRight}>{item.cbm?.toFixed(3) ?? '-'}</Text>
              </View>
            ))}
            <View style={base.totalRow}>
              <Text style={[base.totalLabel, { flex: 5 }]}>TOTAL</Text>
              <Text style={[base.totalValue]}>{totalCartons} Karton</Text>
              <Text style={[base.totalValue]}>{totalGross.toFixed(2)} Kg</Text>
              <Text style={[base.totalValue]}>{totalNet.toFixed(2)} Kg</Text>
              <Text style={[base.totalValue]}>{totalCbm.toFixed(3)} M³</Text>
            </View>
          </View>
        </View>

        {DocFooter()}
      </Page>
    </Document>
  );
}

// ─── 3. SKA Form D (Surat Keterangan Asal) ───────────────────────────────────

export function SKAFormD({ data }: { data: TradeDocData }) {
  const currency = data.items[0]?.currency ?? 'USD';
  const total = data.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);

  return (
    <Document title="SKA Form D — Veylo Trade Advisor">
      <Page size="A4" style={base.page}>
        {DocHeader({ title: 'Certificate of Origin (ATIGA/ASEAN Trade in Goods Agreement)', docType: 'FORM D — SKA' })}

        <View style={base.section}>
          <Text style={[base.sectionTitle, { color: EMERALD }]}>
            ⚠️ DOKUMEN DRAFT — Untuk diproses & ditandatangani oleh Dinas Perdagangan / BKPM yang berwenang
          </Text>
        </View>

        {Parties({ data })}
        {ShipmentInfo({ data })}

        <View style={base.section}>
          <Text style={base.sectionTitle}>Kriteria Asal Barang / Origin Criteria</Text>
          <Text style={{ fontSize: 8, marginBottom: 4 }}>
            Berdasarkan ATIGA (ASEAN Trade In Goods Agreement) Chapter 3, barang di bawah ini dinyatakan berasal dari Indonesia:
          </Text>
          <Text style={{ fontSize: 8, fontFamily: 'Roboto', fontWeight: 'bold', color: EMERALD }}>
            "The goods described herein originated in Indonesia and comply with the origin requirements specified for these goods in the ASEAN Trade in Goods Agreement (ATIGA)."
          </Text>
        </View>

        <View style={base.section}>
          <Text style={base.sectionTitle}>Daftar Barang / Goods Description</Text>
          <View style={base.table}>
            <View style={base.tableHeader}>
              <Text style={[base.tableHeaderCell, { flex: 3 }]}>Deskripsi Barang</Text>
              <Text style={base.tableHeaderCell}>HS Code</Text>
              <Text style={base.tableHeaderCell}>Qty</Text>
              <Text style={[base.tableHeaderCell, { textAlign: 'right' }]}>Nilai FOB ({currency})</Text>
            </View>
            {data.items.map((item, i) => (
              <View key={i} style={i % 2 === 0 ? base.tableRow : base.tableRowAlt}>
                <Text style={[base.tableCell, { flex: 3 }]}>{item.description}</Text>
                <Text style={base.tableCell}>{item.hsCode}</Text>
                <Text style={base.tableCell}>{item.qty} {item.unit}</Text>
                <Text style={base.tableCellRight}>{(item.qty * item.unitPrice).toFixed(2)}</Text>
              </View>
            ))}
            <View style={base.totalRow}>
              <Text style={base.totalLabel}>TOTAL FOB VALUE</Text>
              <Text style={base.totalValue}>{currency} {total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
            </View>
          </View>
        </View>

        <View style={[base.section, base.row]}>
          <View style={[base.col, { borderTop: `1 solid ${BORDER}`, paddingTop: 8 }]}>
            <Text style={base.sectionTitle}>Deklarasi Eksportir</Text>
            <Text style={{ fontSize: 8, color: SLATE, marginBottom: 12 }}>
              Saya menyatakan bahwa keterangan dalam dokumen ini adalah benar dan barang memenuhi syarat sebagai produk Indonesia.
            </Text>
            <Text style={{ fontSize: 8 }}>Nama & Tanda Tangan Eksportir: ________________________</Text>
            <Text style={{ fontSize: 8, marginTop: 8 }}>Tanggal & Stempel: ________________________</Text>
          </View>
          <View style={[base.col, { borderTop: `1 solid ${BORDER}`, paddingTop: 8 }]}>
            <Text style={base.sectionTitle}>Pengesahan Instansi Penerbit</Text>
            <Text style={{ fontSize: 8, color: SLATE, marginBottom: 12 }}>
              Dokumen ini disahkan oleh instansi penerbit SKA yang berwenang sesuai Permendag No. 53/2021.
            </Text>
            <Text style={{ fontSize: 8 }}>Pejabat Penerbit: ________________________</Text>
            <Text style={{ fontSize: 8, marginTop: 8 }}>Cap & Tanda Tangan Instansi: ________________________</Text>
          </View>
        </View>

        {DocFooter()}
      </Page>
    </Document>
  );
}
