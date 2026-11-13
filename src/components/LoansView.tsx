import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Edit2,
  Paperclip,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { Attachment, ComputedLoan, Loan, LoanStatus } from '../types';
import {
  formatDateID,
  formatNumericDots,
  formatRupiah,
  generateTxNumber,
  getDueReminderLabel,
  parseNumericDots,
  todayISO,
} from '../utils/format';
import { AttachmentField } from './AttachmentField';
import { ConfirmModal } from './ConfirmModal';

interface LoansViewProps {
  loans: ComputedLoan[];
  currentCashBalance: number;
  currentUserName: string;
  onSaveLoan: (
    data: Omit<Loan, 'id' | 'createdAt' | 'updatedAt'>,
    editingId?: string
  ) => Promise<void>;
  onDeleteLoan: (id: string) => Promise<void>;
  onPreviewAttachment: (att: Attachment) => void;
  onGoToRepayment: (loanId: string) => void;
}

const STATUS_STYLE: Record<LoanStatus, string> = {
  DIPINJAM: 'bg-blue-50 text-blue-700 border border-blue-200',
  'DIBAYAR SEBAGIAN': 'bg-amber-50 text-amber-800 border border-amber-200',
  LUNAS: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  TERLAMBAT: 'bg-red-50 text-red-700 border border-red-200',
};

export function LoansView({
  loans,
  currentCashBalance,
  currentUserName,
  onSaveLoan,
  onDeleteLoan,
  onPreviewAttachment,
  onGoToRepayment,
}: LoansViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LoanStatus>('all');
  const [reminderFilter, setReminderFilter] = useState<
    'all' | 'terlambat' | 'h1' | 'h3' | 'h7'
  >('all');

  // Detail modal
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const selectedLoan = useMemo(
    () => loans.find((l) => l.id === selectedLoanId) || null,
    [loans, selectedLoanId]
  );

  // Form modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<ComputedLoan | null>(null);
  const [txNumber, setTxNumber] = useState('');
  const [borrowerName, setBorrowerName] = useState('');
  const [memberId, setMemberId] = useState('');
  const [phone, setPhone] = useState('');
  const [loanDate, setLoanDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState('');
  const [principalText, setPrincipalText] = useState('');
  const [interestText, setInterestText] = useState('0');
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState<Attachment | undefined>(undefined);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<ComputedLoan | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sortedLoans = useMemo(() => {
    return [...loans].sort((a, b) => {
      // Prioritize overdue / active loans, then by date desc
      if (a.status === 'TERLAMBAT' && b.status !== 'TERLAMBAT') return -1;
      if (b.status === 'TERLAMBAT' && a.status !== 'TERLAMBAT') return 1;
      return b.loanDate.localeCompare(a.loanDate) || b.createdAt.localeCompare(a.createdAt);
    });
  }, [loans]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortedLoans.filter((l) => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (reminderFilter !== 'all') {
        if (reminderFilter === 'terlambat' && l.dueReminderLevel !== 'terlambat') return false;
        if (reminderFilter === 'h1' && l.dueReminderLevel !== 'h1') return false;
        if (reminderFilter === 'h3' && !['h1', 'h3'].includes(l.dueReminderLevel)) return false;
        if (reminderFilter === 'h7' && !['h1', 'h3', 'h7'].includes(l.dueReminderLevel))
          return false;
      }
      if (q) {
        const hay = `${l.txNumber} ${l.borrowerName} ${l.memberId} ${l.phone} ${l.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sortedLoans, search, statusFilter, reminderFilter]);

  const counts = useMemo(() => {
    return {
      terlambat: loans.filter((l) => l.dueReminderLevel === 'terlambat').length,
      h1: loans.filter((l) => l.dueReminderLevel === 'h1').length,
      h3: loans.filter((l) => l.dueReminderLevel === 'h3').length,
      h7: loans.filter((l) => l.dueReminderLevel === 'h7').length,
      totalSisaAktif: loans
        .filter((l) => l.status !== 'LUNAS')
        .reduce((s, l) => s + l.remainingAmount, 0),
    };
  }, [loans]);

  const defaultDueDate = (fromISO: string) => {
    const dt = new Date(`${fromISO}T00:00:00`);
    dt.setDate(dt.getDate() + 30);
    return dt.toISOString().slice(0, 10);
  };

  const openAddModal = () => {
    const today = todayISO();
    const nums = loans.map((l) => l.txNumber);
    setEditingLoan(null);
    setTxNumber(generateTxNumber('PJ', today, nums));
    setBorrowerName('');
    setMemberId('');
    setPhone('');
    setLoanDate(today);
    setDueDate(defaultDueDate(today));
    setPrincipalText('');
    setInterestText('0');
    setDescription('');
    setAttachment(undefined);
    setFormError('');
    setFormOpen(true);
  };

  const openEditModal = (loan: ComputedLoan) => {
    setEditingLoan(loan);
    setTxNumber(loan.txNumber);
    setBorrowerName(loan.borrowerName);
    setMemberId(loan.memberId);
    setPhone(loan.phone);
    setLoanDate(loan.loanDate);
    setDueDate(loan.dueDate);
    setPrincipalText(formatNumericDots(loan.principalAmount));
    setInterestText(formatNumericDots(loan.interestAmount));
    setDescription(loan.description);
    setAttachment(loan.attachment);
    setFormError('');
    setFormOpen(true);
  };

  const principalVal = parseNumericDots(principalText);
  const interestVal = parseNumericDots(interestText);
  const totalCalculated = principalVal + interestVal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!borrowerName.trim()) {
      setFormError('Nama peminjam wajib diisi.');
      return;
    }
    if (!loanDate || !dueDate) {
      setFormError('Tanggal pinjam dan jatuh tempo wajib diisi.');
      return;
    }
    if (dueDate < loanDate) {
      setFormError('Tanggal jatuh tempo tidak boleh lebih awal dari tanggal pinjam.');
      return;
    }
    if (principalVal <= 0) {
      setFormError('Pokok pinjaman harus lebih dari Rp 0.');
      return;
    }
    if (editingLoan && totalCalculated < editingLoan.paidAmount) {
      setFormError(
        `Total pinjaman tidak boleh lebih kecil dari jumlah yang sudah dibayar (${formatRupiah(
          editingLoan.paidAmount
        )}).`
      );
      return;
    }

    setSaving(true);
    try {
      await onSaveLoan(
        {
          txNumber,
          borrowerName: borrowerName.trim(),
          memberId: memberId.trim(),
          phone: phone.trim(),
          loanDate,
          dueDate,
          principalAmount: principalVal,
          interestAmount: interestVal,
          totalAmount: totalCalculated,
          description: description.trim(),
          attachment,
          createdBy: editingLoan?.createdBy || currentUserName,
        },
        editingLoan?.id
      );
      setFormOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan data pinjaman.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await onDeleteLoan(deleteTarget.id);
      if (selectedLoanId === deleteTarget.id) {
        setSelectedLoanId(null);
      }
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F1F17]">
            Dana Sedang Dipinjam
          </h1>
          <p className="mt-1 text-sm text-[#5C6E63]">
            Pemantauan status pinjaman, jatuh tempo (H-7, H-3, H-1, Terlambat), dan detail riwayat cicilan.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#0D4A2E] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#083320] whitespace-nowrap"
        >
          <Plus className="h-4 w-4 text-[#DFB848]" />
          <span>Tambah Pinjaman Baru</span>
        </button>
      </div>

      {/* Summary & Due Reminders Quick Chips */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-[#DCE4DE] bg-white px-4 py-3.5 sm:col-span-2 xl:col-span-1">
          <p className="text-xs font-medium text-[#5C6E63]">Total Sisa Dipinjam</p>
          <p className="mt-1 font-display text-lg font-bold text-[#0F1F17] tabular-nums">
            {formatRupiah(counts.totalSisaAktif)}
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setReminderFilter(reminderFilter === 'terlambat' ? 'all' : 'terlambat')
          }
          className={`rounded-xl border px-4 py-3.5 text-left transition-colors ${
            reminderFilter === 'terlambat'
              ? 'border-red-600 bg-red-50'
              : 'border-[#DCE4DE] bg-white hover:bg-red-50/40'
          }`}
        >
          <p className="text-xs font-semibold text-red-700">Terlambat</p>
          <p className="mt-1 font-display text-lg font-bold text-red-800 tabular-nums">
            {counts.terlambat} Pinjaman
          </p>
        </button>

        <button
          type="button"
          onClick={() => setReminderFilter(reminderFilter === 'h1' ? 'all' : 'h1')}
          className={`rounded-xl border px-4 py-3.5 text-left transition-colors ${
            reminderFilter === 'h1'
              ? 'border-orange-500 bg-orange-50'
              : 'border-[#DCE4DE] bg-white hover:bg-orange-50/40'
          }`}
        >
          <p className="text-xs font-semibold text-orange-700">Jatuh Tempo H-1 / Hari Ini</p>
          <p className="mt-1 font-display text-lg font-bold text-orange-800 tabular-nums">
            {counts.h1} Pinjaman
          </p>
        </button>

        <button
          type="button"
          onClick={() => setReminderFilter(reminderFilter === 'h3' ? 'all' : 'h3')}
          className={`rounded-xl border px-4 py-3.5 text-left transition-colors ${
            reminderFilter === 'h3'
              ? 'border-amber-500 bg-amber-50'
              : 'border-[#DCE4DE] bg-white hover:bg-amber-50/40'
          }`}
        >
          <p className="text-xs font-semibold text-amber-800">Pengingat H-3</p>
          <p className="mt-1 font-display text-lg font-bold text-amber-900 tabular-nums">
            {counts.h3 + counts.h1} Pinjaman
          </p>
        </button>

        <button
          type="button"
          onClick={() => setReminderFilter(reminderFilter === 'h7' ? 'all' : 'h7')}
          className={`rounded-xl border px-4 py-3.5 text-left transition-colors ${
            reminderFilter === 'h7'
              ? 'border-[#C59B27] bg-[#FEF9E7]'
              : 'border-[#DCE4DE] bg-white hover:bg-[#FEF9E7]/50'
          }`}
        >
          <p className="text-xs font-semibold text-[#8A6810]">Pengingat H-7</p>
          <p className="mt-1 font-display text-lg font-bold text-[#6E5108] tabular-nums">
            {counts.h7 + counts.h3 + counts.h1} Pinjaman
          </p>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="rounded-xl border border-[#DCE4DE] bg-white p-4 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6C7E73]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari no. pinjaman, nama peminjam, ID anggota, atau HP..."
              className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-[#F8FAF8] pl-9 pr-3 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', 'DIPINJAM', 'DIBAYAR SEBAGIAN', 'TERLAMBAT', 'LUNAS'] as const).map(
              (st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-[#0D4A2E] text-white'
                      : 'bg-[#F3F6F4] text-[#425449] hover:bg-[#E7EDE9]'
                  }`}
                >
                  {st === 'all' ? 'Semua Status' : st}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Table / Empty State */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#C7D4CC] bg-white px-6 py-12 text-center">
          <p className="font-display text-base font-semibold text-[#0F1F17]">
            {loans.length === 0
              ? 'Belum ada data pinjaman tercatat'
              : 'Tidak ada pinjaman yang cocok dengan filter'}
          </p>
          <p className="mt-1 text-sm text-[#5C6E63]">
            {loans.length === 0
              ? 'Tambahkan pinjaman anggota untuk memantau jatuh tempo dan cicilan secara otomatis.'
              : 'Coba ubah filter status, pengingat, atau kata kunci pencarian.'}
          </p>
          {loans.length === 0 && (
            <button
              type="button"
              onClick={openAddModal}
              className="mt-4 inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#0D4A2E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#083320]"
            >
              <Plus className="h-4 w-4 text-[#DFB848]" />
              <span>Catat Pinjaman Pertama</span>
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-[#5C6E63]">
            Klik baris pinjaman mana saja untuk melihat rincian lengkap &amp; riwayat pengembalian.
          </p>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-[#DCE4DE] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#DCE4DE] bg-[#F8FAF8] text-xs font-semibold text-[#425449]">
                  <tr>
                    <th className="px-4 py-3">No. Pinjaman</th>
                    <th className="px-4 py-3">Peminjam</th>
                    <th className="px-4 py-3">Tgl Pinjam / Jatuh Tempo</th>
                    <th className="px-4 py-3 text-right">Total Pinjaman</th>
                    <th className="px-4 py-3 text-right">Sisa Tagihan</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Pengingat</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EBF0EC]">
                  {filtered.map((loan) => (
                    <tr
                      key={loan.id}
                      onClick={() => setSelectedLoanId(loan.id)}
                      className="cursor-pointer transition-colors hover:bg-[#F4F8F5]"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[#0D4A2E] whitespace-nowrap">
                        {loan.txNumber}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#0F1F17]">{loan.borrowerName}</p>
                        <p className="text-xs text-[#5C6E63]">
                          {loan.memberId ? `ID: ${loan.memberId}` : 'Anggota'}
                          {loan.phone ? ` · ${loan.phone}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#2A3B31] tabular-nums whitespace-nowrap">
                        <div>Pinjam: {formatDateID(loan.loanDate)}</div>
                        <div className="text-[#5C6E63]">Tempo: {formatDateID(loan.dueDate)}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-[#2A3B31] tabular-nums whitespace-nowrap">
                        <div>{formatRupiah(loan.totalAmount)}</div>
                        {loan.paidAmount > 0 && (
                          <div className="text-[11px] text-[#0D4A2E]">
                            Masuk: {formatRupiah(loan.paidAmount)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-bold text-[#0F1F17] tabular-nums whitespace-nowrap">
                        {formatRupiah(loan.remainingAmount)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wide ${
                            STATUS_STYLE[loan.status]
                          }`}
                        >
                          {loan.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium whitespace-nowrap">
                        <span
                          className={
                            loan.dueReminderLevel === 'terlambat'
                              ? 'text-red-700 font-semibold'
                              : loan.dueReminderLevel === 'h1'
                              ? 'text-orange-700 font-semibold'
                              : loan.dueReminderLevel === 'h3' || loan.dueReminderLevel === 'h7'
                              ? 'text-amber-800 font-semibold'
                              : 'text-[#5C6E63]'
                          }
                        >
                          {getDueReminderLabel(loan)}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          {loan.status !== 'LUNAS' && (
                            <button
                              type="button"
                              onClick={() => onGoToRepayment(loan.id)}
                              className="flex h-8 items-center gap-1 rounded-md bg-[#0D4A2E]/10 px-2.5 text-xs font-semibold text-[#0D4A2E] hover:bg-[#0D4A2E] hover:text-white"
                              title="Catat Pengembalian"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>Bayar</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditModal(loan)}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-[#2A3B31] hover:bg-[#EFF5F1]"
                            title="Edit Pinjaman"
                            aria-label="Edit Pinjaman"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(loan)}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-red-700 hover:bg-red-50"
                            title="Hapus Pinjaman"
                            aria-label="Hapus Pinjaman"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((loan) => (
              <div
                key={loan.id}
                onClick={() => setSelectedLoanId(loan.id)}
                className="cursor-pointer rounded-xl border border-[#DCE4DE] bg-white p-4 space-y-2.5 active:bg-[#F8FAF8]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs font-semibold text-[#0D4A2E]">
                      {loan.txNumber}
                    </p>
                    <p className="mt-0.5 font-display text-base font-bold text-[#0F1F17]">
                      {loan.borrowerName}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                      STATUS_STYLE[loan.status]
                    }`}
                  >
                    {loan.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[#5C6E63]">Sisa Tagihan:</span>
                    <p className="font-mono font-bold text-[#0F1F17] tabular-nums">
                      {formatRupiah(loan.remainingAmount)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[#5C6E63]">Jatuh Tempo:</span>
                    <p className="font-mono font-semibold text-[#0F1F17] tabular-nums">
                      {formatDateID(loan.dueDate)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-[#EBF0EC] pt-2.5 text-xs">
                  <span
                    className={
                      loan.dueReminderLevel === 'terlambat'
                        ? 'font-semibold text-red-700'
                        : 'font-medium text-[#5C6E63]'
                    }
                  >
                    {getDueReminderLabel(loan)}
                  </span>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {loan.status !== 'LUNAS' && (
                      <button
                        type="button"
                        onClick={() => onGoToRepayment(loan.id)}
                        className="min-h-[34px] rounded-lg bg-[#0D4A2E] px-3 text-xs font-semibold text-white"
                      >
                        Bayar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEditModal(loan)}
                      className="min-h-[34px] rounded-lg border border-[#DCE4DE] px-2.5 text-xs font-medium text-[#2A3B31]"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Detail Pinjaman Modal */}
      {selectedLoan && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-[#DCE4DE] bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#DCE4DE] bg-[#083320] px-5 py-4 text-white">
              <div>
                <p className="font-mono text-xs text-[#DFB848]">{selectedLoan.txNumber}</p>
                <h2 className="font-display text-lg font-bold">
                  Detail Pinjaman — {selectedLoan.borrowerName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLoanId(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
                aria-label="Tutup Detail"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              {/* Status & Reminder Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#DCE4DE] bg-[#F8FAF8] p-4">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`rounded-md px-3 py-1 text-xs font-bold ${
                      STATUS_STYLE[selectedLoan.status]
                    }`}
                  >
                    {selectedLoan.status}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-[#425449]">
                    <CalendarClock className="h-4 w-4 text-[#0D4A2E]" />
                    <span>{getDueReminderLabel(selectedLoan)}</span>
                  </span>
                </div>

                {selectedLoan.status !== 'LUNAS' && (
                  <button
                    type="button"
                    onClick={() => {
                      const id = selectedLoan.id;
                      setSelectedLoanId(null);
                      onGoToRepayment(id);
                    }}
                    className="flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#0D4A2E] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#083320]"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-[#DFB848]" />
                    <span>Catat Pengembalian</span>
                  </button>
                )}
              </div>

              {/* Financial Breakdown */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-[#DCE4DE] p-3">
                  <p className="text-[11px] text-[#5C6E63]">Pokok Pinjaman</p>
                  <p className="mt-1 font-mono text-sm font-bold text-[#0F1F17] tabular-nums">
                    {formatRupiah(selectedLoan.principalAmount)}
                  </p>
                </div>
                <div className="rounded-lg border border-[#DCE4DE] p-3">
                  <p className="text-[11px] text-[#5C6E63]">Jasa / Admin</p>
                  <p className="mt-1 font-mono text-sm font-bold text-[#0F1F17] tabular-nums">
                    {formatRupiah(selectedLoan.interestAmount)}
                  </p>
                </div>
                <div className="rounded-lg border border-[#DCE4DE] p-3">
                  <p className="text-[11px] text-[#5C6E63]">Sudah Dibayar</p>
                  <p className="mt-1 font-mono text-sm font-bold text-[#0D4A2E] tabular-nums">
                    {formatRupiah(selectedLoan.paidAmount)}
                  </p>
                </div>
                <div className="rounded-lg border border-[#C59B27]/50 bg-[#FEF9E7] p-3">
                  <p className="text-[11px] font-medium text-[#7D5D0F]">Sisa Tagihan</p>
                  <p className="mt-1 font-mono text-sm font-bold text-[#0F1F17] tabular-nums">
                    {formatRupiah(selectedLoan.remainingAmount)}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-xs text-[#425449] mb-1.5">
                  <span>Progres Pelunasan</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {selectedLoan.totalAmount > 0
                      ? Math.min(
                          100,
                          Math.round((selectedLoan.paidAmount / selectedLoan.totalAmount) * 100)
                        )
                      : 0}
                    %
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#E5ECE7]">
                  <div
                    className="h-full rounded-full bg-[#0D4A2E] transition-all"
                    style={{
                      width: `${
                        selectedLoan.totalAmount > 0
                          ? Math.min(
                              100,
                              (selectedLoan.paidAmount / selectedLoan.totalAmount) * 100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Borrower Info */}
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-[#DCE4DE] p-4 text-sm sm:grid-cols-2">
                <div className="flex items-center gap-2.5">
                  <User className="h-4 w-4 text-[#0D4A2E]" />
                  <div>
                    <p className="text-xs text-[#5C6E63]">ID / NIK Anggota</p>
                    <p className="font-medium text-[#0F1F17]">{selectedLoan.memberId || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone className="h-4 w-4 text-[#0D4A2E]" />
                  <div>
                    <p className="text-xs text-[#5C6E63]">No. Telepon / WhatsApp</p>
                    <p className="font-medium text-[#0F1F17]">{selectedLoan.phone || '-'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-[#5C6E63]">Tanggal Pinjam</p>
                  <p className="font-mono text-xs font-semibold text-[#0F1F17]">
                    {formatDateID(selectedLoan.loanDate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#5C6E63]">Tanggal Jatuh Tempo</p>
                  <p className="font-mono text-xs font-semibold text-[#0F1F17]">
                    {formatDateID(selectedLoan.dueDate)}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-[#5C6E63]">Keterangan / Keperluan</p>
                  <p className="mt-0.5 text-sm text-[#2A3B31]">
                    {selectedLoan.description || '-'}
                  </p>
                </div>
                {selectedLoan.attachment && (
                  <div className="sm:col-span-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onPreviewAttachment(selectedLoan.attachment!)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCE4DE] bg-[#F8FAF8] px-3 py-2 text-xs font-semibold text-[#0D4A2E] hover:bg-[#EFF5F1]"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      <span>Lihat Dokumen Lampiran ({selectedLoan.attachment.name})</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Repayment History */}
              <div>
                <h3 className="font-display text-sm font-bold text-[#0F1F17] mb-2.5">
                  Riwayat Pengembalian / Cicilan ({selectedLoan.repayments.length})
                </h3>
                {selectedLoan.repayments.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#DCE4DE] bg-[#F8FAF8] px-4 py-5 text-center text-xs text-[#5C6E63]">
                    Belum ada cicilan pengembalian untuk pinjaman ini.
                  </p>
                ) : (
                  <div className="divide-y divide-[#EBF0EC] rounded-xl border border-[#DCE4DE]">
                    {selectedLoan.repayments.map((rep, idx) => (
                      <div
                        key={rep.id}
                        className="flex items-center justify-between gap-3 px-4 py-3 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-[#0F1F17]">
                            Cicilan #{idx + 1} ·{' '}
                            <span className="font-mono text-[#0D4A2E]">{rep.txNumber}</span>
                          </p>
                          <p className="mt-0.5 text-[#5C6E63]">
                            {formatDateID(rep.date)} · {rep.paymentMethod}
                            {rep.notes ? ` · ${rep.notes}` : ''}
                          </p>
                        </div>
                        <p className="font-mono text-sm font-bold text-[#0D4A2E] tabular-nums">
                          {formatRupiah(rep.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EBF0EC] pt-4">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(selectedLoan)}
                  className="min-h-[40px] rounded-lg border border-red-200 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  Hapus Pinjaman
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const target = selectedLoan;
                      setSelectedLoanId(null);
                      openEditModal(target);
                    }}
                    className="min-h-[40px] rounded-lg border border-[#DCE4DE] px-4 py-2 text-xs font-semibold text-[#2A3B31] hover:bg-[#F6F8F6]"
                  >
                    Ubah Data
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLoanId(null)}
                    className="min-h-[40px] rounded-lg bg-[#0D4A2E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#083320]"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Loan Modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-[#DCE4DE] bg-white p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#EBF0EC] pb-3.5">
              <h2 className="font-display text-lg font-bold text-[#0F1F17]">
                {editingLoan ? 'Ubah Data Pinjaman' : 'Tambah Pinjaman Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#5C6E63] hover:bg-[#F1F5F2]"
                aria-label="Tutup Form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {!editingLoan && currentCashBalance <= 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
                  <span>
                    Saldo kas tersedia saat ini {formatRupiah(currentCashBalance)}. Anda tetap dapat mencatat pinjaman, dan saldo kas akan otomatis berkurang sesuai pokok pinjaman.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    Nomor Pinjaman (Otomatis)
                  </label>
                  <input
                    type="text"
                    value={txNumber}
                    onChange={(e) => setTxNumber(e.target.value)}
                    required
                    className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-[#F8FAF8] px-3 font-mono text-sm font-semibold text-[#0D4A2E] focus:border-[#0D4A2E] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    Nama Peminjam
                  </label>
                  <input
                    type="text"
                    value={borrowerName}
                    onChange={(e) => setBorrowerName(e.target.value)}
                    placeholder="Nama lengkap anggota"
                    required
                    className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-white px-3 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    No. Anggota / NIK <span className="font-normal text-[#6C7E73]">(Opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={memberId}
                    onChange={(e) => setMemberId(e.target.value)}
                    placeholder="Contoh: AGT-012"
                    className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-white px-3 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    No. HP / WhatsApp <span className="font-normal text-[#6C7E73]">(Opsional)</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-white px-3 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    Tanggal Pinjam ({formatDateID(loanDate)})
                  </label>
                  <input
                    type="date"
                    value={loanDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLoanDate(val);
                      if (!editingLoan && val) {
                        setTxNumber(
                          generateTxNumber(
                            'PJ',
                            val,
                            loans.map((l) => l.txNumber)
                          )
                        );
                        setDueDate(defaultDueDate(val));
                      }
                    }}
                    required
                    className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-white px-3 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    Jatuh Tempo ({formatDateID(dueDate)})
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                    className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-white px-3 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    Pokok Pinjaman (Rp)
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm font-semibold text-[#5C6E63]">
                      Rp
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={principalText}
                      onChange={(e) => setPrincipalText(formatNumericDots(e.target.value))}
                      placeholder="0"
                      required
                      className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-white pl-10 pr-3 font-mono text-sm font-bold text-[#0F1F17] tabular-nums focus:border-[#0D4A2E] focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    Jasa / Bunga / Admin (Rp)
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm font-semibold text-[#5C6E63]">
                      Rp
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={interestText}
                      onChange={(e) => setInterestText(formatNumericDots(e.target.value))}
                      placeholder="0"
                      className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-white pl-10 pr-3 font-mono text-sm font-bold text-[#0F1F17] tabular-nums focus:border-[#0D4A2E] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-[#DCE4DE] bg-[#F8FAF8] px-4 py-3 text-sm">
                <span className="font-medium text-[#425449]">Total Tagihan Pinjaman</span>
                <span className="font-mono text-base font-bold text-[#0D4A2E] tabular-nums">
                  {formatRupiah(totalCalculated)}
                </span>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                  Keterangan / Jaminan / Keperluan
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Catatan akad atau keperluan pinjaman..."
                  className="w-full rounded-lg border border-[#DCE4DE] bg-white px-3 py-2 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:outline-none"
                />
              </div>

              <AttachmentField
                value={attachment}
                onChange={setAttachment}
                onPreview={onPreviewAttachment}
                label="Lampiran Akad / Identitas (Foto / PDF)"
              />

              {formError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {formError}
                </p>
              )}

              <div className="flex flex-col-reverse gap-2 border-t border-[#EBF0EC] pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="min-h-[42px] rounded-lg border border-[#DCE4DE] px-4 py-2 text-sm font-medium text-[#2A3B31] hover:bg-[#F6F8F6]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[42px] rounded-lg bg-[#0D4A2E] px-5 py-2 text-sm font-semibold text-white hover:bg-[#083320] disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : editingLoan ? 'Simpan Perubahan' : 'Cairkan & Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Hapus Data Pinjaman?"
        message={`Pinjaman ${deleteTarget?.txNumber} atas nama ${deleteTarget?.borrowerName} beserta seluruh riwayat cicilannya (${deleteTarget?.repayments.length || 0} transaksi) akan dihapus permanen.`}
        confirmLabel="Ya, Hapus Pinjaman"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
