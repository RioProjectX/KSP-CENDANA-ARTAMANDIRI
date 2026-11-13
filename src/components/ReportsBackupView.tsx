import { useMemo, useRef, useState } from 'react';
import {
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  DashboardSummary,
  KoperasiDatabase,
  UnifiedLedgerRow,
  UserRole,
} from '../types';
import { downloadBackupJSON, exportLedgerToCSV, exportLedgerToPDF } from '../utils/export';
import { formatDateID, formatRupiah, todayISO } from '../utils/format';
import { ConfirmModal } from './ConfirmModal';

interface ReportsBackupViewProps {
  db: KoperasiDatabase;
  ledger: UnifiedLedgerRow[];
  summary: DashboardSummary;
  currentUserName: string;
  currentUserRole: UserRole;
  onFetchBackup: () => Promise<KoperasiDatabase>;
  onRestoreBackup: (data: KoperasiDatabase) => Promise<void>;
  onResetLedger: () => Promise<void>;
}

type PeriodMode = 'harian' | 'bulanan' | 'tahunan' | 'rentang' | 'semua';

export function ReportsBackupView({
  db,
  ledger,
  summary,
  currentUserName,
  currentUserRole,
  onFetchBackup,
  onRestoreBackup,
  onResetLedger,
}: ReportsBackupViewProps) {
  const today = todayISO();
  const [periodMode, setPeriodMode] = useState<PeriodMode>('bulanan');
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [selectedMonth, setSelectedMonth] = useState<string>(today.slice(0, 7));
  const [selectedYear, setSelectedYear] = useState<string>(today.slice(0, 4));
  const [rangeStart, setRangeStart] = useState<string>(today.slice(0, 8) + '01');
  const [rangeEnd, setRangeEnd] = useState<string>(today);
  const [kindFilter, setKindFilter] = useState<string>('all');

  // Restore JSON states
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [pendingRestore, setPendingRestore] = useState<KoperasiDatabase | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [backupMessage, setBackupMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  // Reset Ledger states
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetting, setResetting] = useState(false);

  const periodLabel = useMemo(() => {
    if (periodMode === 'harian') return `Harian (${formatDateID(selectedDate)})`;
    if (periodMode === 'bulanan') {
      const [y, m] = selectedMonth.split('-');
      return `Bulanan (${m}/${y})`;
    }
    if (periodMode === 'tahunan') return `Tahunan (${selectedYear})`;
    if (periodMode === 'rentang')
      return `Rentang (${formatDateID(rangeStart)} - ${formatDateID(rangeEnd)})`;
    return 'Semua Periode';
  }, [periodMode, selectedDate, selectedMonth, selectedYear, rangeStart, rangeEnd]);

  const filteredRows = useMemo(() => {
    return ledger.filter((row) => {
      if (kindFilter !== 'all' && row.kind !== kindFilter) return false;
      if (periodMode === 'harian' && row.date !== selectedDate) return false;
      if (periodMode === 'bulanan' && !row.date.startsWith(selectedMonth)) return false;
      if (periodMode === 'tahunan' && !row.date.startsWith(selectedYear)) return false;
      if (periodMode === 'rentang') {
        if (rangeStart && row.date < rangeStart) return false;
        if (rangeEnd && row.date > rangeEnd) return false;
      }
      return true;
    });
  }, [ledger, kindFilter, periodMode, selectedDate, selectedMonth, selectedYear, rangeStart, rangeEnd]);

  const periodTotals = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    for (const r of filteredRows) {
      totalDebit += r.debit;
      totalCredit += r.credit;
    }
    return {
      totalDebit,
      totalCredit,
      netChange: totalDebit - totalCredit,
    };
  }, [filteredRows]);

  const exportMeta = {
    periodLabel,
    totalDebit: periodTotals.totalDebit,
    totalCredit: periodTotals.totalCredit,
    netChange: periodTotals.netChange,
    closingCashBalance: summary.saldoKasTersedia,
    printedBy: currentUserName,
  };

  const handleDownloadBackup = async () => {
    setBackupMessage(null);
    try {
      const fullDb = await onFetchBackup();
      downloadBackupJSON(fullDb);
      setBackupMessage({
        type: 'ok',
        text: 'File backup JSON berhasil diunduh.',
      });
    } catch (err) {
      setBackupMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal mengunduh backup.',
      });
    }
  };

  const handleSelectRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBackupMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as KoperasiDatabase;
        if (
          !parsed ||
          !Array.isArray(parsed.transactions) ||
          !Array.isArray(parsed.loans) ||
          !Array.isArray(parsed.repayments)
        ) {
          setBackupMessage({
            type: 'err',
            text: 'Struktur file JSON tidak valid. Pilih file backup dari aplikasi ini.',
          });
          return;
        }
        setPendingRestore(parsed);
      } catch {
        setBackupMessage({
          type: 'err',
          text: 'File JSON rusak atau tidak dapat dibaca.',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmRestore = async () => {
    if (!pendingRestore) return;
    setRestoring(true);
    try {
      await onRestoreBackup(pendingRestore);
      setPendingRestore(null);
      setBackupMessage({
        type: 'ok',
        text: 'Data berhasil dipulihkan (restore) dari file JSON.',
      });
    } catch (err) {
      setBackupMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal memulihkan data.',
      });
      setPendingRestore(null);
    } finally {
      setRestoring(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    if (!resetConfirmed) {
      setResetError('Centang kotak konfirmasi terlebih dahulu.');
      return;
    }
    setResetting(true);
    try {
      await onResetLedger();
      setResetModalOpen(false);
      setResetConfirmed(false);
      setBackupMessage({
        type: 'ok',
        text: 'Seluruh transaksi pembukuan berhasil dikosongkan.',
      });
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Gagal mengosongkan pembukuan.');
    } finally {
      setResetting(false);
    }
  };

  // Years selector options
  const availableYears = useMemo(() => {
    const yrs = new Set<string>([today.slice(0, 4)]);
    for (const r of ledger) yrs.add(r.date.slice(0, 4));
    return [...yrs].sort((a, b) => b.localeCompare(a));
  }, [ledger, today]);

  return (
    <div className="space-y-6">
      {/* Official Print-Only Letterhead */}
      <div className="print-only hidden border-b-2 border-[#083320] pb-4 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-[#083320]">
              KOPERASI SIMPAN PINJAM CENDANA ARTHA MANDIRI
            </h1>
            <p className="text-xs text-[#425449]">
              Laporan Keuangan &amp; Buku Kas Terpadu · Periode: {periodLabel}
            </p>
          </div>
          <div className="text-right text-xs text-[#425449]">
            <p>Tanggal Cetak: {formatDateID(today)}</p>
            <p>Petugas: {currentUserName}</p>
          </div>
        </div>
      </div>

      {/* Screen Header */}
      <div className="no-print flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F1F17]">
            Laporan Keuangan, Database Terpadu &amp; Backup
          </h1>
          <p className="mt-1 text-sm text-[#5C6E63]">
            Filter periode harian, bulanan, tahunan, ekspor Excel (.csv), PDF, cetak langsung, serta backup/restore JSON.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportLedgerToCSV(filteredRows, exportMeta)}
            className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#DCE4DE] bg-white px-3.5 py-2 text-xs font-semibold text-[#0F1F17] hover:bg-[#F1F5F2] whitespace-nowrap"
          >
            <FileSpreadsheet className="h-4 w-4 text-[#0D4A2E]" />
            <span>Ekspor Excel (.csv)</span>
          </button>

          <button
            type="button"
            onClick={() => exportLedgerToPDF(filteredRows, exportMeta)}
            className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#DCE4DE] bg-white px-3.5 py-2 text-xs font-semibold text-[#0F1F17] hover:bg-[#F1F5F2] whitespace-nowrap"
          >
            <FileText className="h-4 w-4 text-red-700" />
            <span>Ekspor PDF</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#0D4A2E] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#083320] whitespace-nowrap"
          >
            <Printer className="h-4 w-4 text-[#DFB848]" />
            <span>Cetak Langsung</span>
          </button>
        </div>
      </div>

      {/* Period Filter Controls */}
      <div className="no-print rounded-xl border border-[#DCE4DE] bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ['harian', 'Harian'],
              ['bulanan', 'Bulanan'],
              ['tahunan', 'Tahunan'],
              ['rentang', 'Rentang Tanggal'],
              ['semua', 'Semua Data'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPeriodMode(id)}
              className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                periodMode === id
                  ? 'bg-[#0D4A2E] text-white'
                  : 'bg-[#F3F6F4] text-[#425449] hover:bg-[#E7EDE9]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {periodMode === 'harian' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-[#5C6E63]">
                Pilih Tanggal ({formatDateID(selectedDate)})
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="min-h-[40px] w-full rounded-lg border border-[#DCE4DE] bg-[#F8FAF8] px-3 text-sm text-[#0F1F17]"
              />
            </div>
          )}

          {periodMode === 'bulanan' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-[#5C6E63]">
                Pilih Bulan
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="min-h-[40px] w-full rounded-lg border border-[#DCE4DE] bg-[#F8FAF8] px-3 text-sm text-[#0F1F17]"
              />
            </div>
          )}

          {periodMode === 'tahunan' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-[#5C6E63]">
                Pilih Tahun
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="min-h-[40px] w-full rounded-lg border border-[#DCE4DE] bg-[#F8FAF8] px-3 text-sm text-[#0F1F17]"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          )}

          {periodMode === 'rentang' && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#5C6E63]">
                  Dari ({formatDateID(rangeStart)})
                </label>
                <input
                  type="date"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  className="min-h-[40px] w-full rounded-lg border border-[#DCE4DE] bg-[#F8FAF8] px-3 text-sm text-[#0F1F17]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#5C6E63]">
                  Sampai ({formatDateID(rangeEnd)})
                </label>
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  className="min-h-[40px] w-full rounded-lg border border-[#DCE4DE] bg-[#F8FAF8] px-3 text-sm text-[#0F1F17]"
                />
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-[#5C6E63]">
              Jenis Mutasi
            </label>
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
              className="min-h-[40px] w-full rounded-lg border border-[#DCE4DE] bg-[#F8FAF8] px-3 text-sm text-[#0F1F17]"
            >
              <option value="all">Semua Mutasi</option>
              <option value="Uang Masuk">Uang Masuk</option>
              <option value="Uang Keluar">Uang Keluar</option>
              <option value="Pencairan Pinjaman">Pencairan Pinjaman</option>
              <option value="Pengembalian Dana">Pengembalian Dana</option>
            </select>
          </div>
        </div>
      </div>

      {/* Period Summary Strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-[#DCE4DE] bg-white p-4">
          <p className="text-xs font-medium text-[#5C6E63]">Total Debit (Kas Masuk Periode)</p>
          <p className="mt-1 font-display text-lg font-bold text-[#0D4A2E] tabular-nums">
            {formatRupiah(periodTotals.totalDebit)}
          </p>
        </div>
        <div className="rounded-xl border border-[#DCE4DE] bg-white p-4">
          <p className="text-xs font-medium text-[#5C6E63]">
            Total Kredit (Keluar &amp; Pinjaman Periode)
          </p>
          <p className="mt-1 font-display text-lg font-bold text-red-700 tabular-nums">
            {formatRupiah(periodTotals.totalCredit)}
          </p>
        </div>
        <div className="rounded-xl border border-[#DCE4DE] bg-white p-4">
          <p className="text-xs font-medium text-[#5C6E63]">Selisih Arus Kas Periode</p>
          <p className="mt-1 font-display text-lg font-bold text-[#0F1F17] tabular-nums">
            {formatRupiah(periodTotals.netChange)}
          </p>
        </div>
        <div className="rounded-xl border border-[#0D4A2E] bg-[#083320] p-4 text-white">
          <p className="text-xs font-medium text-[#DFB848]">Saldo Kas Tersedia (Keseluruhan)</p>
          <p className="mt-1 font-display text-lg font-bold tabular-nums">
            {formatRupiah(summary.saldoKasTersedia)}
          </p>
        </div>
      </div>

      {/* Unified Database Ledger Table */}
      <div className="overflow-hidden rounded-xl border border-[#DCE4DE] bg-white">
        <div className="flex items-center justify-between border-b border-[#DCE4DE] bg-[#F8FAF8] px-4 py-3">
          <h2 className="font-display text-sm font-bold text-[#0F1F17]">
            Buku Kas &amp; Database Terpadu ({filteredRows.length} Entri)
          </h2>
          <span className="text-xs text-[#5C6E63]">{periodLabel}</span>
        </div>

        {filteredRows.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-[#5C6E63]">
            Tidak ada transaksi pada periode atau filter yang dipilih.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-[#DCE4DE] bg-[#F8FAF8] text-xs font-semibold text-[#425449]">
                <tr>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">No. Transaksi</th>
                  <th className="px-4 py-3">Jenis</th>
                  <th className="px-4 py-3">Anggota / Pihak</th>
                  <th className="px-4 py-3">Keterangan</th>
                  <th className="px-4 py-3 text-right">Masuk (Debit)</th>
                  <th className="px-4 py-3 text-right">Keluar (Kredit)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EBF0EC]">
                {filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-[#F9FBF9]">
                    <td className="px-4 py-2.5 font-mono text-xs text-[#2A3B31] tabular-nums whitespace-nowrap">
                      {formatDateID(row.date)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-[#0F1F17] whitespace-nowrap">
                      {row.txNumber}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium text-[#2A3B31] whitespace-nowrap">
                      {row.kind}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-[#0F1F17]">{row.party}</td>
                    <td className="px-4 py-2.5 text-xs text-[#5C6E63] max-w-[260px] truncate">
                      {row.description}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-[#0D4A2E] tabular-nums whitespace-nowrap">
                      {row.debit > 0 ? formatRupiah(row.debit) : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-red-700 tabular-nums whitespace-nowrap">
                      {row.credit > 0 ? formatRupiah(row.credit) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Print-Only Signature Footer */}
      <div className="print-only hidden pt-8 text-xs text-[#0F1F17] print-break-inside-avoid">
        <div className="flex justify-end">
          <div className="w-64 text-center">
            <p>Mengetahui,</p>
            <p className="font-semibold">Pengurus KSP Cendana Artha Mandiri</p>
            <div className="h-16" />
            <p className="border-t border-[#0F1F17] pt-1 font-semibold">{currentUserName}</p>
          </div>
        </div>
      </div>

      {/* Backup & Restore JSON Section */}
      <section className="no-print rounded-xl border border-[#DCE4DE] bg-white p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0D4A2E]/10 text-[#0D4A2E]">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-[#0F1F17]">
              Backup &amp; Restore Database (JSON)
            </h2>
            <p className="mt-0.5 text-xs text-[#5C6E63]">
              Simpan cadangan lengkap seluruh transaksi, pinjaman, cicilan, lampiran, dan akun dalam satu file `.json` untuk keamanan data berkala.
            </p>
          </div>
        </div>

        {backupMessage && (
          <div
            className={`rounded-lg border px-4 py-2.5 text-xs font-medium ${
              backupMessage.type === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {backupMessage.text}
          </div>
        )}

        <input
          ref={restoreInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleSelectRestoreFile}
          className="hidden"
        />

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleDownloadBackup()}
            className="flex min-h-[42px] items-center gap-2 rounded-lg bg-[#0D4A2E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#083320]"
          >
            <Download className="h-4 w-4 text-[#DFB848]" />
            <span>Unduh Backup (.json)</span>
          </button>

          <button
            type="button"
            onClick={() => restoreInputRef.current?.click()}
            className="flex min-h-[42px] items-center gap-2 rounded-lg border border-[#C59B27] bg-[#FEF9E7] px-4 py-2 text-xs font-semibold text-[#7D5D0F] hover:bg-[#FDF3CC]"
          >
            <Upload className="h-4 w-4" />
            <span>Restore dari File (.json)</span>
          </button>

          {currentUserRole === 'Admin' && (
            <button
              type="button"
              onClick={() => {
                setResetConfirmed(false);
                setResetError('');
                setResetModalOpen(true);
              }}
              className="flex min-h-[42px] items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 sm:ml-auto"
            >
              <Trash2 className="h-4 w-4" />
              <span>Kosongkan Pembukuan</span>
            </button>
          )}
        </div>
      </section>

      {/* Restore Confirmation Modal */}
      <ConfirmModal
        open={!!pendingRestore}
        title="Pulihkan Data dari Backup JSON?"
        message={
          pendingRestore
            ? `File backup berisi ${pendingRestore.transactions.length} transaksi kas, ${pendingRestore.loans.length} pinjaman, dan ${pendingRestore.repayments.length} pengembalian. Data saat ini akan digantikan oleh isi file backup tersebut.`
            : ''
        }
        confirmLabel="Ya, Pulihkan Data"
        danger={false}
        loading={restoring}
        onConfirm={() => void confirmRestore()}
        onCancel={() => setPendingRestore(null)}
      />

      {/* Admin Reset Modal */}
      {resetModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-[#DCE4DE] bg-white p-6 shadow-xl">
            <div className="flex items-center gap-2.5 text-red-700">
              <RotateCcw className="h-5 w-5" />
              <h3 className="font-display text-lg font-bold text-[#0F1F17]">
                Kosongkan Data Pembukuan
              </h3>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#5C6E63]">
              Tindakan ini akan menghapus seluruh transaksi kas, data pinjaman, dan pengembalian dana sehingga pembukuan kembali ke Rp 0. Akun Admin &amp; Staf tetap dipertahankan. Unduh backup JSON terlebih dahulu jika diperlukan.
            </p>
            <form onSubmit={handleResetSubmit} className="mt-4 space-y-3">
              <label className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50/70 p-3 text-xs text-red-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={resetConfirmed}
                  onChange={(e) => setResetConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-red-700"
                />
                <span>
                  Saya yakin ingin mengosongkan seluruh data transaksi kas, pinjaman, dan pengembalian ke Rp 0.
                </span>
              </label>
              {resetError && <p className="text-xs font-medium text-red-700">{resetError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalOpen(false)}
                  className="min-h-[40px] rounded-lg border border-[#DCE4DE] px-4 text-xs font-semibold text-[#2A3B31]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={resetting}
                  className="min-h-[40px] rounded-lg bg-red-700 px-4 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-60"
                >
                  {resetting ? 'Menghapus...' : 'Ya, Kosongkan Semua'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
