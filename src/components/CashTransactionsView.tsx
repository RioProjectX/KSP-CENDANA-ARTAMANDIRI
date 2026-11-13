import { useMemo, useState } from 'react';
import {
  Edit2,
  Paperclip,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  Attachment,
  CashTransaction,
  CashTransactionType,
  PaymentMethod,
} from '../types';
import {
  CASH_IN_CATEGORIES,
  CASH_OUT_CATEGORIES,
  formatDateID,
  formatNumericDots,
  formatRupiah,
  generateTxNumber,
  parseNumericDots,
  todayISO,
} from '../utils/format';
import { AttachmentField } from './AttachmentField';
import { ConfirmModal } from './ConfirmModal';

interface CashTransactionsViewProps {
  mode: CashTransactionType;
  transactions: CashTransaction[];
  currentCashBalance: number;
  currentUserName: string;
  onSaveTransaction: (
    data: Omit<CashTransaction, 'id' | 'createdAt' | 'updatedAt'>,
    editingId?: string
  ) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onPreviewAttachment: (att: Attachment) => void;
}

export function CashTransactionsView({
  mode,
  transactions,
  currentCashBalance,
  currentUserName,
  onSaveTransaction,
  onDeleteTransaction,
  onPreviewAttachment,
}: CashTransactionsViewProps) {
  const isMasuk = mode === 'masuk';
  const categories = isMasuk ? CASH_IN_CATEGORIES : CASH_OUT_CATEGORIES;
  const prefix = isMasuk ? 'KM' : 'KK';

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modal Form state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<CashTransaction | null>(null);
  const [txDate, setTxDate] = useState(todayISO());
  const [txNumber, setTxNumber] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [amountText, setAmountText] = useState('');
  const [partyName, setPartyName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Tunai');
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState<Attachment | undefined>(undefined);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<CashTransaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  const modeTransactions = useMemo(
    () =>
      transactions
        .filter((t) => t.type === mode)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [transactions, mode]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return modeTransactions.filter((t) => {
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (dateFrom && t.date < dateFrom) return false;
      if (dateTo && t.date > dateTo) return false;
      if (q) {
        const hay = `${t.txNumber} ${t.partyName} ${t.category} ${t.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [modeTransactions, search, categoryFilter, dateFrom, dateTo]);

  const filteredTotal = useMemo(
    () => filtered.reduce((sum, t) => sum + t.amount, 0),
    [filtered]
  );

  const openAddModal = () => {
    const today = todayISO();
    const existingNums = transactions.map((t) => t.txNumber);
    setEditingTx(null);
    setTxDate(today);
    setTxNumber(generateTxNumber(prefix, today, existingNums));
    setCategory(categories[0]);
    setAmountText('');
    setPartyName('');
    setPaymentMethod('Tunai');
    setDescription('');
    setAttachment(undefined);
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (tx: CashTransaction) => {
    setEditingTx(tx);
    setTxDate(tx.date);
    setTxNumber(tx.txNumber);
    setCategory(tx.category);
    setAmountText(formatNumericDots(tx.amount));
    setPartyName(tx.partyName);
    setPaymentMethod(tx.paymentMethod);
    setDescription(tx.description);
    setAttachment(tx.attachment);
    setFormError('');
    setModalOpen(true);
  };

  const handleDateChangeInForm = (newDate: string) => {
    setTxDate(newDate);
    if (!editingTx) {
      const existingNums = transactions.map((t) => t.txNumber);
      setTxNumber(generateTxNumber(prefix, newDate, existingNums));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const numericAmount = parseNumericDots(amountText);
    if (!txDate) {
      setFormError('Tanggal transaksi wajib diisi.');
      return;
    }
    if (numericAmount <= 0) {
      setFormError('Nominal harus lebih dari Rp 0.');
      return;
    }
    if (!partyName.trim()) {
      setFormError(isMasuk ? 'Nama penyetor / anggota wajib diisi.' : 'Nama penerima wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      await onSaveTransaction(
        {
          txNumber,
          type: mode,
          date: txDate,
          category,
          amount: numericAmount,
          partyName: partyName.trim(),
          paymentMethod,
          description: description.trim(),
          attachment,
          createdBy: editingTx?.createdBy || currentUserName,
        },
        editingTx?.id
      );
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan transaksi.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await onDeleteTransaction(deleteTarget.id);
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
            {isMasuk ? 'Uang Masuk' : 'Uang Keluar'}
          </h1>
          <p className="mt-1 text-sm text-[#5C6E63]">
            {isMasuk
              ? 'Catat simpanan anggota, modal, dan seluruh pemasukan kas koperasi.'
              : 'Catat biaya operasional, penarikan simpanan, dan pengeluaran kas lainnya.'}
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#0D4A2E] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#083320] whitespace-nowrap"
        >
          <Plus className="h-4 w-4 text-[#DFB848]" />
          <span>{isMasuk ? 'Tambah Uang Masuk' : 'Tambah Uang Keluar'}</span>
        </button>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#DCE4DE] bg-white px-4 py-3.5">
          <p className="text-xs font-medium text-[#5C6E63]">
            {isMasuk ? 'Total Uang Masuk (Filter)' : 'Total Uang Keluar (Filter)'}
          </p>
          <p
            className={`mt-1 font-display text-xl font-bold tabular-nums ${
              isMasuk ? 'text-[#0D4A2E]' : 'text-red-700'
            }`}
          >
            {formatRupiah(filteredTotal)}
          </p>
        </div>
        <div className="rounded-xl border border-[#DCE4DE] bg-white px-4 py-3.5">
          <p className="text-xs font-medium text-[#5C6E63]">Jumlah Catatan Ditampilkan</p>
          <p className="mt-1 font-display text-xl font-bold text-[#0F1F17] tabular-nums">
            {filtered.length} Transaksi
          </p>
        </div>
        <div className="rounded-xl border border-[#DCE4DE] bg-white px-4 py-3.5">
          <p className="text-xs font-medium text-[#5C6E63]">Saldo Kas Tersedia Saat Ini</p>
          <p className="mt-1 font-display text-xl font-bold text-[#0F1F17] tabular-nums">
            {formatRupiah(currentCashBalance)}
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="rounded-xl border border-[#DCE4DE] bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6C7E73]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nomor, nama, keterangan..."
              className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-[#F8FAF8] pl-9 pr-3 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-[#F8FAF8] px-3 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:bg-white focus:outline-none"
            >
              <option value="all">Semua Kategori</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="Dari Tanggal"
              className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-[#F8FAF8] px-3 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="Sampai Tanggal"
              className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-[#F8FAF8] px-3 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="md:col-span-1 flex items-center">
            {(search || categoryFilter !== 'all' || dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setCategoryFilter('all');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] px-2 text-xs font-medium text-[#425449] hover:bg-[#F1F5F2]"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Data Display: Empty / Desktop Table / Mobile Cards */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#C7D4CC] bg-white px-6 py-12 text-center">
          <p className="font-display text-base font-semibold text-[#0F1F17]">
            {modeTransactions.length === 0
              ? `Belum ada catatan ${isMasuk ? 'uang masuk' : 'uang keluar'}`
              : 'Tidak ada transaksi yang cocok dengan filter'}
          </p>
          <p className="mt-1 text-sm text-[#5C6E63]">
            {modeTransactions.length === 0
              ? 'Tambahkan transaksi pertama agar saldo kas dan grafik terhitung otomatis.'
              : 'Ubah kata kunci pencarian atau rentang tanggal filter Anda.'}
          </p>
          {modeTransactions.length === 0 && (
            <button
              type="button"
              onClick={openAddModal}
              className="mt-4 inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#0D4A2E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#083320]"
            >
              <Plus className="h-4 w-4 text-[#DFB848]" />
              <span>{isMasuk ? 'Catat Uang Masuk Pertama' : 'Catat Uang Keluar Pertama'}</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-[#DCE4DE] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#DCE4DE] bg-[#F8FAF8] text-xs font-semibold text-[#425449]">
                  <tr>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">No. Transaksi</th>
                    <th className="px-4 py-3">Kategori</th>
                    <th className="px-4 py-3">{isMasuk ? 'Penyetor' : 'Penerima'}</th>
                    <th className="px-4 py-3">Keterangan</th>
                    <th className="px-4 py-3 text-right">Nominal</th>
                    <th className="px-4 py-3 text-center">Bukti</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EBF0EC]">
                  {filtered.map((tx) => (
                    <tr key={tx.id} className="hover:bg-[#F9FBF9]">
                      <td className="px-4 py-3 font-mono text-xs text-[#2A3B31] whitespace-nowrap tabular-nums">
                        {formatDateID(tx.date)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[#0F1F17] whitespace-nowrap">
                        {tx.txNumber}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#2A3B31]">
                        <div>{tx.category}</div>
                        <div className="text-[11px] text-[#6C7E73]">{tx.paymentMethod}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-[#0F1F17]">{tx.partyName}</td>
                      <td className="px-4 py-3 text-xs text-[#5C6E63] max-w-[240px] truncate">
                        {tx.description || '-'}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono font-semibold whitespace-nowrap tabular-nums ${
                          isMasuk ? 'text-[#0D4A2E]' : 'text-red-700'
                        }`}
                      >
                        {formatRupiah(tx.amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {tx.attachment ? (
                          <button
                            type="button"
                            onClick={() => onPreviewAttachment(tx.attachment!)}
                            className="inline-flex items-center gap-1 rounded-md border border-[#DCE4DE] bg-[#F8FAF8] px-2 py-1 text-xs font-medium text-[#0D4A2E] hover:bg-[#EFF5F1]"
                          >
                            <Paperclip className="h-3 w-3" />
                            <span>Lihat</span>
                          </button>
                        ) : (
                          <span className="text-xs text-[#9AA9A0]">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(tx)}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-[#2A3B31] hover:bg-[#EFF5F1] hover:text-[#0D4A2E]"
                            title="Ubah Transaksi"
                            aria-label="Ubah Transaksi"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(tx)}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-red-700 hover:bg-red-50"
                            title="Hapus Transaksi"
                            aria-label="Hapus Transaksi"
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

          {/* Mobile Card List */}
          <div className="space-y-3 md:hidden">
            {filtered.map((tx) => (
              <div
                key={tx.id}
                className="rounded-xl border border-[#DCE4DE] bg-white p-4 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs font-semibold text-[#5C6E63]">
                      {tx.txNumber} · {formatDateID(tx.date)}
                    </p>
                    <p className="mt-0.5 font-display text-base font-bold text-[#0F1F17]">
                      {tx.partyName}
                    </p>
                  </div>
                  <p
                    className={`font-mono text-base font-bold tabular-nums ${
                      isMasuk ? 'text-[#0D4A2E]' : 'text-red-700'
                    }`}
                  >
                    {formatRupiah(tx.amount)}
                  </p>
                </div>

                <div className="text-xs text-[#425449]">
                  <span>{tx.category}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{tx.paymentMethod}</span>
                  {tx.description && <p className="mt-1 text-[#5C6E63]">{tx.description}</p>}
                </div>

                <div className="flex items-center justify-between border-t border-[#EBF0EC] pt-2.5">
                  <div>
                    {tx.attachment && (
                      <button
                        type="button"
                        onClick={() => onPreviewAttachment(tx.attachment!)}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#DCE4DE] bg-[#F8FAF8] px-3 text-xs font-medium text-[#0D4A2E]"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        <span>Lihat Bukti</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(tx)}
                      className="flex min-h-[36px] items-center gap-1 rounded-lg border border-[#DCE4DE] px-3 text-xs font-medium text-[#2A3B31]"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(tx)}
                      className="flex min-h-[36px] items-center gap-1 rounded-lg border border-red-200 px-3 text-xs font-medium text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-[#DCE4DE] bg-white p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#EBF0EC] pb-3.5">
              <h2 className="font-display text-lg font-bold text-[#0F1F17]">
                {editingTx
                  ? `Ubah ${isMasuk ? 'Uang Masuk' : 'Uang Keluar'}`
                  : `Tambah ${isMasuk ? 'Uang Masuk' : 'Uang Keluar'}`}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#5C6E63] hover:bg-[#F1F5F2]"
                aria-label="Tutup Form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    Nomor Transaksi (Otomatis)
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
                    Tanggal Transaksi ({formatDateID(txDate)})
                  </label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => handleDateChangeInForm(e.target.value)}
                    required
                    className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-white px-3 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    Kategori
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-white px-3 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:outline-none"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    {isMasuk ? 'Nama Penyetor / Anggota' : 'Nama Penerima / Vendor'}
                  </label>
                  <input
                    type="text"
                    value={partyName}
                    onChange={(e) => setPartyName(e.target.value)}
                    placeholder={isMasuk ? 'Contoh: Budi Santoso' : 'Contoh: PLN / Pengurus'}
                    required
                    className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-white px-3 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    Nominal (Rp)
                  </label>
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
                      required
                      className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-white pl-10 pr-3 font-mono text-sm font-bold text-[#0F1F17] tabular-nums focus:border-[#0D4A2E] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                  Keterangan / Uraian
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Catatan detail transaksi..."
                  className="w-full rounded-lg border border-[#DCE4DE] bg-white px-3 py-2 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:outline-none"
                />
              </div>

              <AttachmentField
                value={attachment}
                onChange={setAttachment}
                onPreview={onPreviewAttachment}
              />

              {formError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {formError}
                </p>
              )}

              <div className="flex flex-col-reverse gap-2 border-t border-[#EBF0EC] pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-[42px] rounded-lg border border-[#DCE4DE] px-4 py-2 text-sm font-medium text-[#2A3B31] hover:bg-[#F6F8F6]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[42px] rounded-lg bg-[#0D4A2E] px-5 py-2 text-sm font-semibold text-white hover:bg-[#083320] disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : editingTx ? 'Simpan Perubahan' : 'Simpan Transaksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Hapus Transaksi Kas?"
        message={`Transaksi ${deleteTarget?.txNumber} sebesar ${formatRupiah(
          deleteTarget?.amount || 0
        )} akan dihapus permanen dan saldo kas akan dihitung ulang otomatis.`}
        confirmLabel="Ya, Hapus"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
