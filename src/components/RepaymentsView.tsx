import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Paperclip,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import {
  Attachment,
  ComputedLoan,
  PaymentMethod,
  Repayment,
  RepaymentKind,
} from '../types';
import {
  addMonthsISO,
  calculateLatePenalty,
  formatDateID,
  formatNumericDots,
  formatRupiah,
  generateTxNumber,
  parseNumericDots,
  todayISO,
} from '../utils/format';
import { AttachmentField } from './AttachmentField';
import { ConfirmModal } from './ConfirmModal';
import { DateInputID } from './DateInputID';

interface RepaymentsViewProps {
  loans: ComputedLoan[];
  repayments: Repayment[];
  preselectedLoanId?: string | null;
  preselectedMode?: RepaymentKind;
  currentUserName: string;
  onAddRepayment: (data: Omit<Repayment, 'id' | 'createdAt'>) => Promise<void>;
  onExtendLoan: (params: {
    loanId: string;
    txNumber: string;
    date: string;
    newDueDate: string;
    extensionInterest: number;
    paymentMethod: PaymentMethod;
    notes: string;
    attachment?: Attachment;
    createdBy: string;
  }) => Promise<void>;
  onDeleteRepayment: (id: string) => Promise<void>;
  onPreviewAttachment: (att: Attachment) => void;
}

export function RepaymentsView({
  loans,
  repayments,
  preselectedLoanId,
  preselectedMode = 'cicilan',
  currentUserName,
  onAddRepayment,
  onExtendLoan,
  onDeleteRepayment,
  onPreviewAttachment,
}: RepaymentsViewProps) {
  const unpaidLoans = useMemo(
    () =>
      loans
        .filter((l) => l.status !== 'LUNAS')
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [loans]
  );

  const [selectedLoanId, setSelectedLoanId] = useState<string>('');
  const [mode, setMode] = useState<RepaymentKind>('cicilan');
  const [date, setDate] = useState<string>(todayISO());
  const [txNumber, setTxNumber] = useState<string>('');
  const [amountText, setAmountText] = useState<string>('');
  const [includePenalty, setIncludePenalty] = useState<boolean>(true);
  const [extensionMonths, setExtensionMonths] = useState<number>(1);
  const [extensionDueDate, setExtensionDueDate] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Tunai');
  const [notes, setNotes] = useState<string>('');
  const [attachment, setAttachment] = useState<Attachment | undefined>(undefined);
  const [formError, setFormError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // History filter
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Repayment | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setTxNumber(
      generateTxNumber(
        'PB',
        date,
        repayments.map((r) => r.txNumber)
      )
    );
  }, [date, repayments]);

  useEffect(() => {
    if (preselectedLoanId && unpaidLoans.some((l) => l.id === preselectedLoanId)) {
      setSelectedLoanId(preselectedLoanId);
      setMode(preselectedMode === 'perpanjangan' ? 'perpanjangan' : 'cicilan');
      setIncludePenalty(true);
      setSuccessMsg('');
      setFormError('');
    }
  }, [preselectedLoanId, preselectedMode, unpaidLoans]);

  const selectedLoan = useMemo(
    () => loans.find((l) => l.id === selectedLoanId) || null,
    [loans, selectedLoanId]
  );

  // Sync default extension due date whenever loan or extensionMonths changes
  useEffect(() => {
    if (!selectedLoan) {
      setExtensionDueDate('');
      return;
    }
    setExtensionDueDate(addMonthsISO(selectedLoan.dueDate, extensionMonths));
  }, [selectedLoan, extensionMonths]);

  // Late penalty calculation as of selected payment `date`
  const lateCalc = useMemo(() => {
    if (!selectedLoan) return { daysLate: 0, dailyRate: 0, penaltyAmount: 0 };
    return calculateLatePenalty(selectedLoan, date, selectedLoan.remainingAmount);
  }, [selectedLoan, date]);

  const appliedPenalty =
    mode === 'cicilan' && lateCalc.daysLate > 0 && includePenalty ? lateCalc.penaltyAmount : 0;

  const numericAmount = parseNumericDots(amountText);
  const penaltyPaidPortion =
    appliedPenalty > 0 ? Math.min(numericAmount, appliedPenalty) : 0;
  const loanPrincipalReduction = Math.max(0, numericAmount - penaltyPaidPortion);

  const extensionInterest = selectedLoan
    ? Math.round(selectedLoan.principalAmount * 0.2 * extensionMonths)
    : 0;

  const loanLookup = useMemo(() => new Map(loans.map((l) => [l.id, l])), [loans]);

  const filteredRepayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...repayments]
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
      .filter((r) => {
        if (dateFrom && r.date < dateFrom) return false;
        if (dateTo && r.date > dateTo) return false;
        if (q) {
          const parent = loanLookup.get(r.loanId);
          const hay = `${r.txNumber} ${r.loanTxNumber} ${parent?.borrowerName || ''} ${
            r.notes
          }`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }, [repayments, search, dateFrom, dateTo, loanLookup]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSuccessMsg('');

    if (!selectedLoan) {
      setFormError('Pilih nomor transaksi pinjaman terlebih dahulu.');
      return;
    }

    if (mode === 'perpanjangan') {
      if (!extensionDueDate || extensionDueDate <= selectedLoan.dueDate) {
        setFormError('Tanggal jatuh tempo baru harus lebih lambat dari jatuh tempo sebelumnya.');
        return;
      }
      if (extensionInterest <= 0) {
        setFormError('Nominal bunga perpanjangan harus lebih dari Rp 0.');
        return;
      }

      const defaultExtNote = `Perpanjangan ${extensionMonths} bln s.d. ${formatDateID(
        extensionDueDate
      )} (Bunga 20%/bln, bebas denda)`;

      setSubmitting(true);
      try {
        await onExtendLoan({
          loanId: selectedLoan.id,
          txNumber,
          date,
          newDueDate: extensionDueDate,
          extensionInterest,
          paymentMethod,
          notes: notes.trim() || defaultExtNote,
          attachment,
          createdBy: currentUserName,
        });

        setNotes('');
        setAttachment(undefined);
        setExtensionMonths(1);
        setMode('cicilan');
        setSuccessMsg(
          `Perpanjangan pinjaman ${selectedLoan.txNumber} (${extensionMonths} bulan) berhasil dicatat. Bunga ${formatRupiah(
            extensionInterest
          )} masuk ke kas dan jatuh tempo diperpanjang ke ${formatDateID(
            extensionDueDate
          )} tanpa denda harian.`
        );
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Gagal memperpanjang pinjaman.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Standard installment / payoff mode (with optional auto late penalty when lateCalc.daysLate > 0)
    if (numericAmount <= 0) {
      setFormError('Nominal pengembalian harus lebih dari Rp 0.');
      return;
    }

    const maxAllowed = selectedLoan.remainingAmount + appliedPenalty;
    if (numericAmount > maxAllowed) {
      setFormError(
        `Nominal melebihi batas tagihan (${formatRupiah(maxAllowed)}${
          appliedPenalty > 0 ? ' sudah termasuk denda' : ''
        }).`
      );
      return;
    }

    const willBePaidOff = loanPrincipalReduction >= selectedLoan.remainingAmount;

    setSubmitting(true);
    try {
      await onAddRepayment({
        txNumber,
        loanId: selectedLoan.id,
        loanTxNumber: selectedLoan.txNumber,
        date,
        amount: numericAmount,
        repaymentType: 'cicilan',
        penaltyAmount: penaltyPaidPortion > 0 ? penaltyPaidPortion : undefined,
        paymentMethod,
        notes:
          notes.trim() ||
          (penaltyPaidPortion > 0
            ? `${willBePaidOff ? 'Pelunasan' : 'Cicilan'} + Denda ${lateCalc.daysLate} hari (${formatRupiah(
                penaltyPaidPortion
              )})`
            : ''),
        attachment,
        createdBy: currentUserName,
      });

      setAmountText('');
      setNotes('');
      setAttachment(undefined);
      if (willBePaidOff) {
        setSelectedLoanId('');
        setSuccessMsg(
          `Pembayaran ${formatRupiah(numericAmount)}${
            penaltyPaidPortion > 0
              ? ` (termasuk denda ${formatRupiah(penaltyPaidPortion)})`
              : ''
          } berhasil. Pinjaman ${
            selectedLoan.txNumber
          } otomatis berstatus LUNAS dan saldo kas bertambah.`
        );
      } else {
        setSuccessMsg(
          `Cicilan ${formatRupiah(numericAmount)}${
            penaltyPaidPortion > 0
              ? ` (termasuk denda ${formatRupiah(penaltyPaidPortion)})`
              : ''
          } untuk ${selectedLoan.txNumber} berhasil dicatat dan saldo kas otomatis bertambah.`
        );
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan pengembalian.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await onDeleteRepayment(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const maxPayableNow = selectedLoan ? selectedLoan.remainingAmount + appliedPenalty : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0F1F17]">
          Pengembalian Dana
        </h1>
        <p className="mt-1 text-sm text-[#5C6E63]">
          Catat cicilan/pelunasan (dengan hitung denda otomatis jika melewati jatuh tempo) atau perpanjangan pinjaman (cukup bayar bunga bulanan 20% tanpa denda).
        </p>
      </div>

      {/* Main Repayment Entry Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-[#DCE4DE] bg-white p-5 sm:p-6 space-y-4 lg:col-span-7"
        >
          <div className="flex items-center justify-between border-b border-[#EBF0EC] pb-3">
            <h2 className="font-display text-base font-bold text-[#0F1F17]">
              Input Pengembalian / Perpanjangan
            </h2>
            <span className="font-mono text-xs font-semibold text-[#0D4A2E]">{txNumber}</span>
          </div>

          {successMsg && (
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
              Pilih Nomor Transaksi Pinjaman Aktif
            </label>
            <select
              value={selectedLoanId}
              onChange={(e) => {
                setSelectedLoanId(e.target.value);
                setAmountText('');
                setIncludePenalty(true);
                setExtensionMonths(1);
                setFormError('');
                setSuccessMsg('');
              }}
              className="min-h-[44px] w-full rounded-lg border border-[#DCE4DE] bg-white px-3 text-sm font-medium text-[#0F1F17] focus:border-[#0D4A2E] focus:outline-none"
            >
              <option value="">
                {unpaidLoans.length === 0
                  ? '-- Tidak ada pinjaman aktif yang belum lunas --'
                  : '-- Pilih Nomor Transaksi Pinjaman --'}
              </option>
              {unpaidLoans.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.txNumber} — {l.borrowerName} (Sisa: {formatRupiah(l.remainingAmount)}
                  {l.daysLate > 0 ? ` · Terlambat ${l.daysLate} hr` : ''})
                </option>
              ))}
            </select>
          </div>

          {/* Mode Selector (Cicilan/Pelunasan vs Perpanjang Jatuh Tempo) */}
          {selectedLoan && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                Jenis Pembayaran
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('cicilan');
                    setFormError('');
                  }}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors ${
                    mode === 'cicilan'
                      ? 'border-[#0D4A2E] bg-[#0D4A2E] text-white'
                      : 'border-[#DCE4DE] bg-[#F8FAF8] text-[#2A3B31] hover:bg-[#EFF5F1]'
                  }`}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Bayar Cicilan / Pelunasan</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('perpanjangan');
                    setFormError('');
                  }}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors ${
                    mode === 'perpanjangan'
                      ? 'border-[#C59B27] bg-[#FEF9E7] text-[#6E5108] ring-1 ring-[#C59B27]'
                      : 'border-[#DCE4DE] bg-[#F8FAF8] text-[#2A3B31] hover:bg-[#EFF5F1]'
                  }`}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Perpanjang (Bayar Bunga Bulanan)</span>
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                Tanggal Pembayaran{' '}
                <span className="font-normal text-[#5C6E63]">(Tgl/Bln/Thn)</span>
              </label>
              <DateInputID
                value={date}
                onChange={(val) => {
                  setDate(val);
                  setFormError('');
                }}
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                Metode Pembayaran
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-white px-3 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:outline-none"
              >
                <option value="Tunai">Tunai</option>
                <option value="Transfer Bank">Transfer Bank</option>
              </select>
            </div>
          </div>

          {/* AUTOMATIC LATE PENALTY CALCULATOR — ONLY SHOWN WHEN OVERDUE AND NOT EXTENDING */}
          {selectedLoan && mode === 'cicilan' && lateCalc.daysLate > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-700 shrink-0" />
                  <p className="text-xs font-bold text-red-900">
                    Penghitung Denda Keterlambatan Otomatis
                  </p>
                </div>
                <span className="rounded bg-red-700 px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                  Terlambat {lateCalc.daysLate} Hari
                </span>
              </div>

              <p className="text-[11px] text-red-800 leading-relaxed">
                Tanggal pembayaran ({formatDateID(date)}) melewati jatuh tempo (
                {formatDateID(selectedLoan.dueDate)}). Tarif denda{' '}
                <strong>1% per hari</strong> dari pokok pinjaman (minimal{' '}
                <strong>Rp 10.000/hari</strong>).
              </p>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-red-200/80 bg-white px-3 py-2">
                  <p className="text-[10px] font-medium text-red-700">Denda per Hari</p>
                  <p className="mt-0.5 font-mono text-xs font-bold text-red-950 tabular-nums">
                    {formatRupiah(lateCalc.dailyRate)}
                  </p>
                  <p className="text-[10px] text-[#5C6E63]">
                    {selectedLoan.principalAmount * 0.01 < 10000
                      ? `1% = ${formatRupiah(selectedLoan.principalAmount * 0.01)} → min Rp 10.000`
                      : `1% × ${formatRupiah(selectedLoan.principalAmount)}`}
                  </p>
                </div>

                <div className="rounded-lg border border-red-200/80 bg-white px-3 py-2">
                  <p className="text-[10px] font-medium text-red-700">Keterlambatan</p>
                  <p className="mt-0.5 font-mono text-xs font-bold text-red-950 tabular-nums">
                    {lateCalc.daysLate} hari
                  </p>
                  <p className="text-[10px] text-[#5C6E63]">Dari jatuh tempo</p>
                </div>

                <div className="rounded-lg border border-red-300 bg-white px-3 py-2">
                  <p className="text-[10px] font-semibold text-red-800">Total Denda</p>
                  <p className="mt-0.5 font-mono text-sm font-bold text-red-700 tabular-nums">
                    {formatRupiah(lateCalc.penaltyAmount)}
                  </p>
                  <p className="text-[10px] text-[#5C6E63]">
                    {lateCalc.daysLate} hr × {formatRupiah(lateCalc.dailyRate)}
                  </p>
                </div>
              </div>

              <label className="flex items-start gap-2 pt-0.5 cursor-pointer text-xs text-red-950">
                <input
                  type="checkbox"
                  checked={includePenalty}
                  onChange={(e) => setIncludePenalty(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-red-300 text-red-700 focus:ring-red-700"
                />
                <span>
                  Terapkan denda keterlambatan sebesar{' '}
                  <strong>{formatRupiah(lateCalc.penaltyAmount)}</strong> ke tagihan pembayaran
                  ini.{' '}
                  <span className="text-red-800">
                    (Jika peminjam memilih <strong>memperpanjang jatuh tempo</strong>, pilih mode{' '}
                    <strong>Perpanjang</strong> di atas agar cukup membayar bunga bulanan tanpa denda.)
                  </span>
                </span>
              </label>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-red-200 pt-2.5 text-xs">
                <span className="font-semibold text-red-900">
                  Total Pelunasan ({formatRupiah(selectedLoan.remainingAmount)} + Denda{' '}
                  {formatRupiah(appliedPenalty)})
                </span>
                <span className="font-mono text-sm font-bold text-red-900 tabular-nums">
                  {formatRupiah(selectedLoan.remainingAmount + appliedPenalty)}
                </span>
              </div>
            </div>
          )}

          {/* CONDITIONAL BODY: INSTALLMENT / PAYOFF vs EXTENSION */}
          {selectedLoan && mode === 'perpanjangan' ? (
            <div className="rounded-xl border border-[#C59B27]/50 bg-[#FEF9E7]/70 p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-[#8A6810]" />
                  <p className="text-xs font-bold text-[#6E5108]">
                    Perpanjang Jatuh Tempo — Hanya Bayar Bunga Bulanan (Tanpa Denda)
                  </p>
                </div>
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  Denda Rp 0
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    Lama Perpanjangan (Bulan)
                  </label>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 6].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setExtensionMonths(m)}
                        className={`min-h-[38px] flex-1 rounded-lg border text-xs font-bold transition-colors ${
                          extensionMonths === m
                            ? 'border-[#0D4A2E] bg-[#0D4A2E] text-white'
                            : 'border-[#DCE4DE] bg-white text-[#2A3B31] hover:bg-[#F6F8F6]'
                        }`}
                      >
                        {m} Bln
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={extensionMonths}
                      onChange={(e) => {
                        const v = Math.max(1, Math.min(24, Number(e.target.value) || 1));
                        setExtensionMonths(v);
                      }}
                      aria-label="Jumlah bulan perpanjangan"
                      className="min-h-[38px] w-16 rounded-lg border border-[#DCE4DE] bg-white px-2 text-center font-mono text-xs font-bold text-[#0F1F17] focus:border-[#0D4A2E] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    Jatuh Tempo Baru{' '}
                    <span className="font-normal text-[#5C6E63]">(Tgl/Bln/Thn)</span>
                  </label>
                  <DateInputID
                    value={extensionDueDate}
                    onChange={setExtensionDueDate}
                    required
                  />
                </div>
              </div>

              <div className="rounded-lg border border-[#E6D69E] bg-white p-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-[#425449]">
                  <span>Pokok Pinjaman Tetap</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {formatRupiah(selectedLoan.principalAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#425449]">
                  <span>Jatuh Tempo Diperpanjang</span>
                  <span className="font-mono font-semibold text-[#0D4A2E]">
                    {formatDateID(selectedLoan.dueDate)} → {formatDateID(extensionDueDate)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-emerald-700">
                  <span>Denda Keterlambatan (Karena Memperpanjang)</span>
                  <span className="font-mono font-bold">Rp 0 (Bebas Denda)</span>
                </div>
                <div className="flex items-center justify-between border-t border-[#EBF0EC] pt-2 text-sm font-bold text-[#0F1F17]">
                  <span>Bunga Perpanjangan (20%/bln × {extensionMonths} bln)</span>
                  <span className="font-mono text-[#0D4A2E] tabular-nums">
                    {formatRupiah(extensionInterest)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-[#2A3B31]">
                  Nominal Pembayaran (Rp)
                </label>
                {selectedLoan && selectedLoan.remainingAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmountText(formatNumericDots(maxPayableNow))}
                    className="text-xs font-semibold text-[#0D4A2E] underline hover:text-[#083320]"
                  >
                    {appliedPenalty > 0
                      ? `Bayar Lunas + Denda (${formatRupiah(maxPayableNow)})`
                      : `Bayar Sisa Penuh (${formatRupiah(maxPayableNow)})`}
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm font-semibold text-[#5C6E63]">
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amountText}
                  onChange={(e) => setAmountText(formatNumericDots(e.target.value))}
                  placeholder="0"
                  disabled={!selectedLoan}
                  className="min-h-[44px] w-full rounded-lg border border-[#DCE4DE] bg-white pl-10 pr-3 font-mono text-base font-bold text-[#0F1F17] tabular-nums focus:border-[#0D4A2E] focus:outline-none disabled:bg-[#F8FAF8]"
                />
              </div>

              {selectedLoan && appliedPenalty > 0 && numericAmount > 0 && (
                <div className="mt-2 rounded-lg border border-[#DCE4DE] bg-[#F8FAF8] px-3 py-2 text-[11px] text-[#425449] space-y-1">
                  <div className="flex justify-between">
                    <span>Porsi Denda Keterlambatan ({lateCalc.daysLate} hr):</span>
                    <span className="font-mono font-semibold text-red-700 tabular-nums">
                      {formatRupiah(penaltyPaidPortion)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mengurangi Tagihan Pinjaman:</span>
                    <span className="font-mono font-semibold text-[#0D4A2E] tabular-nums">
                      {formatRupiah(loanPrincipalReduction)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-[#E5ECE7] pt-1 font-semibold text-[#0F1F17]">
                    <span>Sisa Tagihan Setelah Bayar:</span>
                    <span className="font-mono tabular-nums">
                      {formatRupiah(
                        Math.max(0, selectedLoan.remainingAmount - loanPrincipalReduction)
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
              Catatan {mode === 'perpanjangan' ? 'Perpanjangan' : 'Cicilan'}{' '}
              <span className="font-normal text-[#6C7E73]">(Opsional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                mode === 'perpanjangan'
                  ? `Contoh: Perpanjang ${extensionMonths} bulan, bayar bunga saja`
                  : 'Contoh: Angsuran ke-1 / Pelunasan'
              }
              className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-white px-3 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:outline-none"
            />
          </div>

          <AttachmentField
            value={attachment}
            onChange={setAttachment}
            onPreview={onPreviewAttachment}
            label="Lampiran Bukti Pembayaran (Foto / PDF)"
          />

          {formError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !selectedLoan}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#0D4A2E] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#083320] disabled:cursor-not-allowed disabled:bg-[#9BB3A6]"
          >
            {mode === 'perpanjangan' ? (
              <RefreshCw className="h-4 w-4 text-[#DFB848]" />
            ) : (
              <Plus className="h-4 w-4 text-[#DFB848]" />
            )}
            <span>
              {submitting
                ? 'Memproses...'
                : mode === 'perpanjangan'
                ? `Perpanjang Jatuh Tempo & Simpan Bunga (${formatRupiah(extensionInterest)})`
                : 'Simpan Pengembalian Dana'}
            </span>
          </button>
        </form>

        {/* Auto-Loaded Loan Details Panel */}
        <div className="rounded-xl border border-[#DCE4DE] bg-white p-5 sm:p-6 lg:col-span-5 flex flex-col">
          <h2 className="font-display text-base font-bold text-[#0F1F17] border-b border-[#EBF0EC] pb-3">
            Informasi Pinjaman Terpilih
          </h2>

          {!selectedLoan ? (
            <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
              <RotateCcw className="h-8 w-8 text-[#B5C4BB]" />
              <p className="mt-3 text-sm font-medium text-[#425449]">
                Belum ada nomor pinjaman yang dipilih
              </p>
              <p className="mt-1 max-w-xs text-xs text-[#6C7E73]">
                Pilih nomor transaksi pinjaman di formulir untuk menampilkan data peminjam, pokok pinjaman, denda keterlambatan (jika lewat jatuh tempo), dan sisa tagihan otomatis.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg bg-[#083320] p-4 text-white">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-[#DFB848]">
                      {selectedLoan.txNumber}
                    </p>
                    <p className="mt-0.5 font-display text-lg font-bold">
                      {selectedLoan.borrowerName}
                    </p>
                  </div>
                  <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-100">
                    {selectedLoan.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-emerald-100/80">
                  Tgl Pinjam: {formatDateID(selectedLoan.loanDate)} · Jatuh Tempo:{' '}
                  {formatDateID(selectedLoan.dueDate)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="rounded-lg border border-[#DCE4DE] p-3">
                  <p className="text-[#5C6E63]">Pokok Pinjaman</p>
                  <p className="mt-1 font-mono font-bold text-[#0F1F17] tabular-nums">
                    {formatRupiah(selectedLoan.principalAmount)}
                  </p>
                </div>
                <div className="rounded-lg border border-[#DCE4DE] p-3">
                  <p className="text-[#5C6E63]">Total Tagihan (+Bunga)</p>
                  <p className="mt-1 font-mono font-bold text-[#0F1F17] tabular-nums">
                    {formatRupiah(selectedLoan.totalAmount)}
                  </p>
                </div>
                <div className="rounded-lg border border-[#DCE4DE] p-3">
                  <p className="text-[#5C6E63]">Sudah Dibayar (Tagihan)</p>
                  <p className="mt-1 font-mono font-bold text-[#0D4A2E] tabular-nums">
                    {formatRupiah(selectedLoan.paidAmount)}
                  </p>
                  {selectedLoan.totalPenaltyPaid > 0 && (
                    <p className="mt-0.5 text-[10px] text-red-700 tabular-nums">
                      + Denda: {formatRupiah(selectedLoan.totalPenaltyPaid)}
                    </p>
                  )}
                </div>
                <div className="rounded-lg border border-[#C59B27]/50 bg-[#FEF9E7] p-3">
                  <p className="font-semibold text-[#7D5D0F]">Sisa Tagihan</p>
                  <p className="mt-1 font-mono text-sm font-bold text-[#0F1F17] tabular-nums">
                    {formatRupiah(selectedLoan.remainingAmount)}
                  </p>
                </div>
              </div>

              {mode === 'cicilan' && lateCalc.daysLate > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-900">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      Denda Lewat Tempo ({lateCalc.daysLate} hr)
                    </span>
                    <span className="font-mono font-bold tabular-nums">
                      {formatRupiah(lateCalc.penaltyAmount)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-red-700">
                    Tarif: {formatRupiah(lateCalc.dailyRate)}/hari · Tidak berlaku jika memilih
                    Perpanjang Jatuh Tempo.
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-[#2A3B31] mb-2">
                  Riwayat Pembayaran Sebelumnya ({selectedLoan.repayments.length})
                </p>
                {selectedLoan.repayments.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#DCE4DE] bg-[#F8FAF8] px-3 py-4 text-center text-xs text-[#6C7E73]">
                    Belum ada cicilan sebelumnya.
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto divide-y divide-[#EBF0EC] rounded-lg border border-[#DCE4DE]">
                    {selectedLoan.repayments.map((rep, idx) => (
                      <div
                        key={rep.id}
                        className="flex items-center justify-between px-3 py-2 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-[#0F1F17]">
                              #{idx + 1} · {formatDateID(rep.date)}
                            </p>
                            {rep.repaymentType === 'perpanjangan' && (
                              <span className="rounded bg-[#FEF9E7] border border-[#C59B27]/50 px-1.5 py-0.5 text-[10px] font-bold text-[#7D5D0F]">
                                Perpanjang
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#5C6E63]">
                            {rep.txNumber}
                            {(rep.penaltyAmount || 0) > 0 && (
                              <span className="ml-1.5 text-red-700 font-medium">
                                · Termasuk denda {formatRupiah(rep.penaltyAmount!)}
                              </span>
                            )}
                          </p>
                        </div>
                        <p className="font-mono font-bold text-[#0D4A2E] tabular-nums">
                          {formatRupiah(rep.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Repayment History Table */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-lg font-bold text-[#0F1F17]">
            Riwayat Seluruh Pengembalian Dana ({filteredRepayments.length})
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6C7E73]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari no. bayar / pinjaman / nama..."
                className="min-h-[38px] rounded-lg border border-[#DCE4DE] bg-white pl-9 pr-3 text-xs text-[#0F1F17] focus:border-[#0D4A2E] focus:outline-none"
              />
            </div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="Dari Tanggal"
              className="min-h-[38px] rounded-lg border border-[#DCE4DE] bg-white px-2.5 text-xs text-[#0F1F17]"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="Sampai Tanggal"
              className="min-h-[38px] rounded-lg border border-[#DCE4DE] bg-white px-2.5 text-xs text-[#0F1F17]"
            />
          </div>
        </div>

        {filteredRepayments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#C7D4CC] bg-white px-6 py-10 text-center text-sm text-[#5C6E63]">
            Belum ada riwayat pengembalian dana yang tercatat.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#DCE4DE] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#DCE4DE] bg-[#F8FAF8] text-xs font-semibold text-[#425449]">
                  <tr>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">No. Pengembalian</th>
                    <th className="px-4 py-3">No. Pinjaman</th>
                    <th className="px-4 py-3">Peminjam</th>
                    <th className="px-4 py-3">Catatan / Jenis</th>
                    <th className="px-4 py-3 text-right">Nominal Bayar</th>
                    <th className="px-4 py-3 text-center">Bukti</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EBF0EC]">
                  {filteredRepayments.map((rep) => {
                    const parent = loanLookup.get(rep.loanId);
                    const isExtension = rep.repaymentType === 'perpanjangan';
                    const penalty = rep.penaltyAmount || 0;
                    return (
                      <tr key={rep.id} className="hover:bg-[#F9FBF9]">
                        <td className="px-4 py-3 font-mono text-xs text-[#2A3B31] tabular-nums whitespace-nowrap">
                          {formatDateID(rep.date)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-[#0D4A2E] whitespace-nowrap">
                          {rep.txNumber}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#425449] whitespace-nowrap">
                          {rep.loanTxNumber}
                        </td>
                        <td className="px-4 py-3 font-medium text-[#0F1F17]">
                          {parent?.borrowerName || '-'}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#5C6E63]">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {isExtension && (
                              <span className="rounded bg-[#FEF9E7] border border-[#C59B27]/50 px-1.5 py-0.5 text-[10px] font-bold text-[#7D5D0F]">
                                Perpanjang (Bunga)
                              </span>
                            )}
                            {penalty > 0 && (
                              <span className="rounded bg-red-50 border border-red-200 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                                + Denda {formatRupiah(penalty)}
                              </span>
                            )}
                            <span>{rep.notes || '-'}</span>
                          </div>
                          <div className="text-[11px] text-[#7B8B81] mt-0.5">
                            {rep.paymentMethod}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-[#0D4A2E] tabular-nums whitespace-nowrap">
                          {formatRupiah(rep.amount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {rep.attachment ? (
                            <button
                              type="button"
                              onClick={() => onPreviewAttachment(rep.attachment!)}
                              className="inline-flex items-center gap-1 rounded-md border border-[#DCE4DE] bg-[#F8FAF8] px-2 py-1 text-xs font-medium text-[#0D4A2E]"
                            >
                              <Paperclip className="h-3 w-3" />
                              <span>Lihat</span>
                            </button>
                          ) : (
                            <span className="text-xs text-[#9AA9A0]">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(rep)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-700 hover:bg-red-50"
                            title="Batalkan / Hapus Pembayaran"
                            aria-label="Hapus Pembayaran"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Hapus Catatan Pengembalian?"
        message={`Pembayaran ${deleteTarget?.txNumber} sebesar ${formatRupiah(
          deleteTarget?.amount || 0
        )} akan dihapus. Status pinjaman terkait dan saldo kas akan otomatis dihitung ulang.`}
        confirmLabel="Ya, Hapus"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
