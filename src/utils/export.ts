import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { KoperasiDatabase, UnifiedLedgerRow } from '../types';
import { formatDateID, formatRupiah, todayISO } from './format';

export interface ReportExportMeta {
  periodLabel: string;
  totalDebit: number;
  totalCredit: number;
  netChange: number;
  closingCashBalance: number;
  printedBy: string;
}

export function exportLedgerToCSV(rows: UnifiedLedgerRow[], meta: ReportExportMeta) {
  const headers = [
    'No',
    'Tanggal',
    'Nomor Transaksi',
    'Jenis Transaksi',
    'Kategori / Keterangan Singkat',
    'Nama Anggota / Pihak',
    'Uraian',
    'Metode',
    'Uang Masuk (Debit)',
    'Uang Keluar (Kredit)',
  ];

  const escapeCSV = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes(';')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines: string[] = [];
  lines.push(`"KOPERASI SIMPAN PINJAM CENDANA ARTHA MANDIRI"`);
  lines.push(`"Laporan Keuangan Terpadu — Periode: ${meta.periodLabel}"`);
  lines.push(`"Dicetak pada: ${formatDateID(todayISO())} oleh ${meta.printedBy}"`);
  lines.push('');
  lines.push(headers.map(escapeCSV).join(','));

  rows.forEach((row, index) => {
    lines.push(
      [
        index + 1,
        formatDateID(row.date),
        row.txNumber,
        row.kind,
        row.category,
        row.party,
        row.description,
        row.paymentMethod,
        row.debit,
        row.credit,
      ]
        .map(escapeCSV)
        .join(',')
    );
  });

  lines.push('');
  lines.push(`"Total Pemasukan Periode",,,,,,,,${meta.totalDebit},`);
  lines.push(`"Total Pengeluaran & Pencairan Periode",,,,,,,,,${meta.totalCredit}`);
  lines.push(`"Selisih Bersih Periode",,,,,,,,${meta.netChange},`);
  lines.push(`"Saldo Kas Tersedia Saat Ini",,,,,,,,${meta.closingCashBalance},`);

  // Add UTF-8 BOM for clean Excel compatibility on Windows/macOS
  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Laporan-KSP-Cendana-${todayISO().replace(/-/g, '')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportLedgerToPDF(rows: UnifiedLedgerRow[], meta: ReportExportMeta) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Top Header Bar (Dark Forest Green + Gold Accent)
  doc.setFillColor(8, 51, 32);
  doc.rect(0, 0, 297, 26, 'F');
  doc.setFillColor(197, 155, 39);
  doc.rect(0, 26, 297, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('KOPERASI SIMPAN PINJAM CENDANA ARTHA MANDIRI', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(220, 235, 226);
  doc.text(`Laporan Keuangan & Buku Kas Terpadu  |  Periode: ${meta.periodLabel}`, 14, 18.5);
  doc.text(`Tanggal Cetak: ${formatDateID(todayISO())}  |  Petugas: ${meta.printedBy}`, 283, 18.5, {
    align: 'right',
  });

  // Summary Strip
  doc.setTextColor(15, 31, 23);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Masuk: ${formatRupiah(meta.totalDebit)}`, 14, 35);
  doc.text(`Total Keluar / Pencairan: ${formatRupiah(meta.totalCredit)}`, 92, 35);
  doc.text(`Surplus / Defisit Periode: ${formatRupiah(meta.netChange)}`, 178, 35);
  doc.text(`Saldo Kas: ${formatRupiah(meta.closingCashBalance)}`, 283, 35, { align: 'right' });

  const tableRows = rows.map((row, idx) => [
    String(idx + 1),
    formatDateID(row.date),
    row.txNumber,
    row.kind,
    row.party,
    row.description,
    row.debit > 0 ? formatRupiah(row.debit) : '-',
    row.credit > 0 ? formatRupiah(row.credit) : '-',
  ]);

  autoTable(doc, {
    startY: 40,
    head: [
      [
        'No',
        'Tanggal',
        'No. Transaksi',
        'Jenis',
        'Anggota / Pihak',
        'Keterangan',
        'Masuk (Debit)',
        'Keluar (Kredit)',
      ],
    ],
    body:
      tableRows.length > 0
        ? tableRows
        : [['-', '-', '-', 'Belum ada data transaksi pada periode ini', '-', '-', '-', '-']],
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [20, 35, 25],
      lineColor: [215, 224, 218],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [13, 74, 46],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [247, 250, 248],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 23 },
      2: { cellWidth: 33 },
      3: { cellWidth: 34 },
      4: { cellWidth: 42 },
      5: { cellWidth: 'auto' },
      6: { halign: 'right', cellWidth: 34 },
      7: { halign: 'right', cellWidth: 34 },
    },
    margin: { left: 14, right: 14 },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 55;
  if (finalY < 170) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Disetujui oleh,', 245, finalY + 14, { align: 'center' });
    doc.text('Pengurus KSP Cendana Artha Mandiri', 245, finalY + 32, { align: 'center' });
  }

  doc.save(`Laporan-KSP-Cendana-${todayISO().replace(/-/g, '')}.pdf`);
}

export function downloadBackupJSON(db: KoperasiDatabase) {
  const payload = JSON.stringify(db, null, 2);
  const blob = new Blob([payload], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Backup-KSP-Cendana-${todayISO().replace(/-/g, '')}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
