import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Paperclip,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import { Attachment, ComputedLoan, PaymentMethod, Repayment } from '../types';
import {
  formatDateID,
  formatNumericDots,
  formatRupiah,
  generateTxNumber,
  parseNumericDots,
  todayISO,
} from '../utils/format';
import { AttachmentField } from './AttachmentField';
import { ConfirmModal } from './ConfirmModal';

interface RepaymentsViewProps {
  loans: ComputedLoan[];
  repayments: Repayment[];
  preselectedLoanId?: string | null;
  currentUserName: string;
  onAddRepayment: (data: Omit<Repayment, 'id' | 'createdAt'>) => Promise<void>;
  onDeleteRepayment: (id: string) => Promise<void>;
  onPreviewAttachment: (att: Attachment) => void;
}

export function RepaymentsView({
  loans,
  repayments,
  preselectedLoanId,
  currentUserName,
  onAddRepayment,
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
  const [date, setDate] = useState<string>(todayISO());
  const [txNumber, setTxNumber] = useState<string>('');
  const [amountText, setAmountText] = useState<string>('');
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
      setSuccessMsg('');
      setFormError('');
    }
  }, [preselectedLoanId, unpaidLoans]);

  const selectedLoan = useMemo(
    () => loans.find((l) => l.id === selectedLoanId) || null,
    [loans, selectedLoanId]
  );

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
    const numericAmount = parseNumericDots(amountText);
    if (numericAmount <= 0) {
      setFormError('Nominal pengembalian harus lebih dari Rp 0.');
      return;
    }
    if (numericAmount > selectedLoan.remainingAmount) {
      setFormError(
        `Nominal melebihi sisa tagihan (${formatRupiah(selectedLoan.remainingAmount)}).`
      );
      return;
    }

    const willBePaidOff = numericAmount === selectedLoan.remainingAmount;

    setSubmitting(true);
    try {
      await onAddRepayment({
        txNumber,
        loanId: selectedLoan.id,
        loanTxNumber: selectedLoan.txNumber,
        date,
        amount: numericAmount,
        paymentMethod,
        notes: notes.trim(),
        attachment,
        createdBy: currentUserName,
      });

      setAmountText('');
      setNotes('');
      setAttachment(undefined);
      if (willBePaidOff) {
        setSelectedLoanId('');
        setSuccessMsg(
          `Pembayaran ${formatRupiah(numericAmount)} berhasil. Pinjaman ${
            selectedLoan.txNumber
          } otomatis berstatus LUNAS dan saldo kas bertambah.`
        );
      } else {
        setSuccessMsg(
          `Cicilan ${formatRupiah(numericAmount)} untuk ${selectedLoan.txNumber} berhasil dicatat dan saldo kas otomatis bertambah.`
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0F1F17]">
          Pengembalian Dana
        </h1>
        <p className="mt-1 text-sm text-[#5C6E63]">
          Catat cicilan bertahap atau pelunasan pinjaman. Status pinjaman otomatis menjadi LUNAS saat sisa tagihan Rp 0 dan saldo kas langsung bertambah.
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
              Input Pengembalian / Cicilan
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
                  {l.txNumber} — {l.borrowerName} (Sisa: {formatRupiah(l.remainingAmount)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                Tanggal Pembayaran ({formatDateID(date)})
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-white px-3 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:outline-none"
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

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-semibold text-[#2A3B31]">
                Nominal Pembayaran (Rp)
              </label>
              {selectedLoan && selectedLoan.remainingAmount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setAmountText(formatNumericDots(selectedLoan.remainingAmount))
                  }
                  className="text-xs font-semibold text-[#0D4A2E] underline hover:text-[#083320]"
                >
                  Bayar Sisa Penuh ({formatRupiah(selectedLoan.remainingAmount)})
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
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
              Catatan Cicilan <span className="font-normal text-[#6C7E73]">(Opsional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Angsuran ke-1 / Pelunasan"
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
            <Plus className="h-4 w-4 text-[#DFB848]" />
            <span>{submitting ? 'Memproses...' : 'Simpan Pengembalian Dana'}</span>
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
                Pilih nomor transaksi pinjaman di formulir untuk menampilkan data peminjam, pokok pinjaman, riwayat cicilan, dan sisa tagihan otomatis.
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
                  <p className="text-[#5C6E63]">Total Tagihan (+Jasa)</p>
                  <p className="mt-1 font-mono font-bold text-[#0F1F17] tabular-nums">
                    {formatRupiah(selectedLoan.totalAmount)}
                  </p>
                </div>
                <div className="rounded-lg border border-[#DCE4DE] p-3">
                  <p className="text-[#5C6E63]">Total Sudah Dibayar</p>
                  <p className="mt-1 font-mono font-bold text-[#0D4A2E] tabular-nums">
                    {formatRupiah(selectedLoan.paidAmount)}
                  </p>
                </div>
                <div className="rounded-lg border border-[#C59B27]/50 bg-[#FEF9E7] p-3">
                  <p className="font-semibold text-[#7D5D0F]">Sisa Tagihan</p>
                  <p className="mt-1 font-mono text-sm font-bold text-[#0F1F17] tabular-nums">
                    {formatRupiah(selectedLoan.remainingAmount)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-[#2A3B31] mb-2">
                  Riwayat Cicilan Sebelumnya ({selectedLoan.repayments.length})
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
                          <p className="font-semibold text-[#0F1F17]">
                            #{idx + 1} · {formatDateID(rep.date)}
                          </p>
                          <p className="text-[11px] text-[#5C6E63]">{rep.txNumber}</p>
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
                    <th className="px-4 py-3">Catatan</th>
                    <th className="px-4 py-3 text-right">Nominal Bayar</th>
                    <th className="px-4 py-3 text-center">Bukti</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EBF0EC]">
                  {filteredRepayments.map((rep) => {
                    const parent = loanLookup.get(rep.loanId);
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
                          <div>{rep.notes || '-'}</div>
                          <div className="text-[11px] text-[#7B8B81]">{rep.paymentMethod}</div>
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
