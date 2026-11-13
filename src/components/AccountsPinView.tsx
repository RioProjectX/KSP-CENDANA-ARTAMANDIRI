import { useState } from 'react';
import { CheckCircle2, Edit2, Plus, Trash2, UserCheck, UserPlus, Users, X } from 'lucide-react';
import { StaffAccount, UserRole } from '../types';
import { formatDateTimeID } from '../utils/format';
import { ConfirmModal } from './ConfirmModal';

interface AccountsPinViewProps {
  currentUser: StaffAccount;
  accounts: StaffAccount[];
  onSwitchOperator: (acc: StaffAccount) => void;
  onCreateAccount: (data: {
    name: string;
    role: UserRole;
    active: boolean;
  }) => Promise<void>;
  onUpdateAccount: (
    id: string,
    data: { name?: string; role?: UserRole; active?: boolean }
  ) => Promise<void>;
  onDeleteAccount: (id: string) => Promise<void>;
}

export function AccountsPinView({
  currentUser,
  accounts,
  onSwitchOperator,
  onCreateAccount,
  onUpdateAccount,
  onDeleteAccount,
}: AccountsPinViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAcc, setEditingAcc] = useState<StaffAccount | null>(null);
  const [accName, setAccName] = useState('');
  const [accRole, setAccRole] = useState<UserRole>('Staf');
  const [accActive, setAccActive] = useState(true);
  const [accError, setAccError] = useState('');
  const [savingAcc, setSavingAcc] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<StaffAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openAddAccount = () => {
    setEditingAcc(null);
    setAccName('');
    setAccRole('Staf');
    setAccActive(true);
    setAccError('');
    setModalOpen(true);
  };

  const openEditAccount = (acc: StaffAccount) => {
    setEditingAcc(acc);
    setAccName(acc.name);
    setAccRole(acc.role);
    setAccActive(acc.active);
    setAccError('');
    setModalOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccError('');
    if (!accName.trim()) {
      setAccError('Nama lengkap wajib diisi.');
      return;
    }

    setSavingAcc(true);
    try {
      if (editingAcc) {
        await onUpdateAccount(editingAcc.id, {
          name: accName.trim(),
          role: accRole,
          active: accActive,
        });
      } else {
        await onCreateAccount({
          name: accName.trim(),
          role: accRole,
          active: accActive,
        });
      }
      setModalOpen(false);
    } catch (err) {
      setAccError(err instanceof Error ? err.message : 'Gagal menyimpan data petugas.');
    } finally {
      setSavingAcc(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await onDeleteAccount(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setAccError(err instanceof Error ? err.message : 'Gagal menghapus akun.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F1F17]">
            Pengurus &amp; Staf Koperasi
          </h1>
          <p className="mt-1 text-sm text-[#5C6E63]">
            Kelola daftar Admin dan Staf pencatat transaksi tanpa perlu PIN login. Pilih petugas aktif untuk setiap sesi pencatatan.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddAccount}
          className="flex min-h-[42px] items-center gap-1.5 self-start rounded-xl bg-[#0D4A2E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#083320] whitespace-nowrap"
        >
          <UserPlus className="h-4 w-4 text-[#DFB848]" />
          <span>Tambah Pengurus / Staf</span>
        </button>
      </div>

      {/* Active Operator Highlight Card */}
      <div className="rounded-xl border border-[#C59B27]/40 bg-[#FFFDF5] p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#083320] text-[#DFB848]">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#7D5D0F] uppercase tracking-wide">
              Petugas Pencatat Aktif Saat Ini
            </p>
            <p className="font-display text-base font-bold text-[#0F1F17]">
              {currentUser.name}{' '}
              <span className="ml-1.5 rounded bg-[#083320] px-2 py-0.5 text-[11px] font-semibold text-[#DFB848]">
                {currentUser.role}
              </span>
            </p>
          </div>
        </div>
        <p className="text-xs text-[#5C6E63]">
          Nama petugas ini akan otomatis tercatat di setiap transaksi baru dan cetak laporan.
        </p>
      </div>

      {/* Accounts List */}
      <div className="rounded-xl border border-[#DCE4DE] bg-white p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5 border-b border-[#EBF0EC] pb-3">
          <Users className="h-5 w-5 text-[#0D4A2E]" />
          <div>
            <h2 className="font-display text-base font-bold text-[#0F1F17]">
              Daftar Pengurus &amp; Staf ({accounts.length})
            </h2>
            <p className="text-xs text-[#5C6E63]">
              Seluruh perubahan langsung tersinkronisasi ke database cloud koperasi.
            </p>
          </div>
        </div>

        <div className="divide-y divide-[#EBF0EC] rounded-xl border border-[#DCE4DE]">
          {accounts.map((acc) => {
            const isSelf = acc.id === currentUser.id;
            return (
              <div
                key={acc.id}
                className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-sm font-bold text-[#0F1F17]">
                      {acc.name}
                    </p>
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                        acc.role === 'Admin'
                          ? 'bg-[#083320] text-[#DFB848]'
                          : 'bg-[#F1F5F2] text-[#2A3B31]'
                      }`}
                    >
                      {acc.role}
                    </span>
                    {!acc.active && (
                      <span className="rounded bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 border border-red-200">
                        Nonaktif
                      </span>
                    )}
                    {isSelf && (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-[#0D4A2E] border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Sedang Aktif</span>
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-[#6C7E73]">
                    Ditambahkan: {formatDateTimeID(acc.createdAt)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {!isSelf && acc.active && (
                    <button
                      type="button"
                      onClick={() => onSwitchOperator(acc)}
                      className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#0D4A2E] bg-[#0D4A2E]/5 px-3 text-xs font-semibold text-[#0D4A2E] hover:bg-[#0D4A2E] hover:text-white transition-colors"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      <span>Gunakan Akun Ini</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => openEditAccount(acc)}
                    className="flex min-h-[36px] items-center gap-1 rounded-lg border border-[#DCE4DE] px-3 text-xs font-medium text-[#2A3B31] hover:bg-[#F6F8F6]"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </button>

                  {!isSelf && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(acc)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                      title="Hapus Akun"
                      aria-label="Hapus Akun"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add / Edit Account Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#DCE4DE] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#EBF0EC] pb-3">
              <h3 className="font-display text-lg font-bold text-[#0F1F17]">
                {editingAcc ? 'Ubah Data Pengurus / Staf' : 'Tambah Pengurus / Staf Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#5C6E63] hover:bg-[#F1F5F2]"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  placeholder="Contoh: Siti Rahmawati"
                  required
                  className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] px-3 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                  Peran Akses
                </label>
                <select
                  value={accRole}
                  onChange={(e) => setAccRole(e.target.value as UserRole)}
                  className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-white px-3 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:outline-none"
                >
                  <option value="Staf">Staf (Operasional &amp; Transaksi)</option>
                  <option value="Admin">Admin (Akses Penuh &amp; Kelola Pembukuan)</option>
                </select>
              </div>

              <label className="flex items-center gap-2.5 text-sm text-[#2A3B31] cursor-pointer">
                <input
                  type="checkbox"
                  checked={accActive}
                  onChange={(e) => setAccActive(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#0D4A2E]"
                />
                <span>Status Aktif</span>
              </label>

              {accError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {accError}
                </p>
              )}

              <div className="flex justify-end gap-2 border-t border-[#EBF0EC] pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-[40px] rounded-lg border border-[#DCE4DE] px-4 text-xs font-semibold text-[#2A3B31]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingAcc}
                  className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#0D4A2E] px-4 text-xs font-semibold text-white hover:bg-[#083320] disabled:opacity-60"
                >
                  <Plus className="h-3.5 w-3.5 text-[#DFB848]" />
                  <span>{savingAcc ? 'Menyimpan...' : 'Simpan Data'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Hapus Data Pengurus / Staf?"
        message={`Data "${deleteTarget?.name}" (${deleteTarget?.role}) akan dihapus dari daftar petugas koperasi.`}
        confirmLabel="Ya, Hapus"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
