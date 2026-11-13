import { useState } from 'react';
import { Edit2, KeyRound, Plus, Shield, Trash2, UserPlus, X } from 'lucide-react';
import { StaffAccount, UserRole } from '../types';
import { formatDateTimeID } from '../utils/format';
import { ConfirmModal } from './ConfirmModal';

interface AccountsPinViewProps {
  currentUser: StaffAccount;
  accounts: StaffAccount[];
  onChangeOwnPin: (oldPin: string, newPin: string) => Promise<void>;
  onCreateAccount: (data: {
    name: string;
    role: UserRole;
    pin: string;
    active: boolean;
  }) => Promise<void>;
  onUpdateAccount: (
    id: string,
    data: { name?: string; role?: UserRole; pin?: string; active?: boolean }
  ) => Promise<void>;
  onDeleteAccount: (id: string) => Promise<void>;
}

export function AccountsPinView({
  currentUser,
  accounts,
  onChangeOwnPin,
  onCreateAccount,
  onUpdateAccount,
  onDeleteAccount,
}: AccountsPinViewProps) {
  // Change own PIN
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMsg, setPinMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [savingPin, setSavingPin] = useState(false);

  // Account modal (Admin only)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAcc, setEditingAcc] = useState<StaffAccount | null>(null);
  const [accName, setAccName] = useState('');
  const [accRole, setAccRole] = useState<UserRole>('Staf');
  const [accPin, setAccPin] = useState('');
  const [accActive, setAccActive] = useState(true);
  const [accError, setAccError] = useState('');
  const [savingAcc, setSavingAcc] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<StaffAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMsg(null);
    if (!/^\d{4,6}$/.test(newPin)) {
      setPinMsg({ type: 'err', text: 'PIN baru harus 4 hingga 6 digit angka.' });
      return;
    }
    if (newPin !== confirmPin) {
      setPinMsg({ type: 'err', text: 'Konfirmasi PIN baru tidak cocok.' });
      return;
    }
    setSavingPin(true);
    try {
      await onChangeOwnPin(oldPin, newPin);
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
      setPinMsg({ type: 'ok', text: 'PIN Anda berhasil diperbarui.' });
    } catch (err) {
      setPinMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal mengubah PIN.',
      });
    } finally {
      setSavingPin(false);
    }
  };

  const openAddAccount = () => {
    setEditingAcc(null);
    setAccName('');
    setAccRole('Staf');
    setAccPin('');
    setAccActive(true);
    setAccError('');
    setModalOpen(true);
  };

  const openEditAccount = (acc: StaffAccount) => {
    setEditingAcc(acc);
    setAccName(acc.name);
    setAccRole(acc.role);
    setAccPin('');
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
    if (!editingAcc && !/^\d{4,6}$/.test(accPin)) {
      setAccError('PIN awal harus 4 hingga 6 digit angka.');
      return;
    }
    if (editingAcc && accPin && !/^\d{4,6}$/.test(accPin)) {
      setAccError('PIN baru harus 4 hingga 6 digit angka.');
      return;
    }

    setSavingAcc(true);
    try {
      if (editingAcc) {
        await onUpdateAccount(editingAcc.id, {
          name: accName.trim(),
          role: accRole,
          active: accActive,
          pin: accPin || undefined,
        });
      } else {
        await onCreateAccount({
          name: accName.trim(),
          role: accRole,
          pin: accPin,
          active: accActive,
        });
      }
      setModalOpen(false);
    } catch (err) {
      setAccError(err instanceof Error ? err.message : 'Gagal menyimpan akun.');
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
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0F1F17]">
          Akun Pengurus &amp; Keamanan PIN
        </h1>
        <p className="mt-1 text-sm text-[#5C6E63]">
          Ubah PIN akses pribadi Anda dan kelola akun Admin maupun Staf koperasi.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Change Own PIN Card */}
        <form
          onSubmit={handlePinSubmit}
          className="rounded-xl border border-[#DCE4DE] bg-white p-5 sm:p-6 space-y-4 lg:col-span-5"
        >
          <div className="flex items-center gap-2.5 border-b border-[#EBF0EC] pb-3">
            <KeyRound className="h-5 w-5 text-[#0D4A2E]" />
            <div>
              <h2 className="font-display text-base font-bold text-[#0F1F17]">
                Ubah PIN Saya
              </h2>
              <p className="text-xs text-[#5C6E63]">
                Masuk sebagai {currentUser.name} ({currentUser.role})
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
              PIN Saat Ini
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={oldPin}
              onChange={(e) => setOldPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Masukkan PIN lama"
              required
              className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] px-3 font-mono text-sm tracking-widest focus:border-[#0D4A2E] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
              PIN Baru (4–6 digit angka)
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Contoh: 4829"
              required
              className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] px-3 font-mono text-sm tracking-widest focus:border-[#0D4A2E] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
              Ulangi PIN Baru
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Ulangi PIN baru"
              required
              className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] px-3 font-mono text-sm tracking-widest focus:border-[#0D4A2E] focus:outline-none"
            />
          </div>

          {pinMsg && (
            <p
              className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                pinMsg.type === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {pinMsg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={savingPin}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#0D4A2E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#083320] disabled:opacity-60"
          >
            <KeyRound className="h-4 w-4 text-[#DFB848]" />
            <span>{savingPin ? 'Menyimpan...' : 'Simpan PIN Baru'}</span>
          </button>
        </form>

        {/* Staff & Admin Accounts Management */}
        <div className="rounded-xl border border-[#DCE4DE] bg-white p-5 sm:p-6 lg:col-span-7 space-y-4">
          <div className="flex flex-col gap-3 border-b border-[#EBF0EC] pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <Shield className="h-5 w-5 text-[#0D4A2E]" />
              <div>
                <h2 className="font-display text-base font-bold text-[#0F1F17]">
                  Daftar Akun Admin &amp; Staf ({accounts.length})
                </h2>
                <p className="text-xs text-[#5C6E63]">
                  Setiap akun memiliki PIN login unik tersendiri.
                </p>
              </div>
            </div>

            {currentUser.role === 'Admin' && (
              <button
                type="button"
                onClick={openAddAccount}
                className="flex min-h-[40px] items-center gap-1.5 self-start rounded-lg bg-[#0D4A2E] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#083320] whitespace-nowrap"
              >
                <UserPlus className="h-3.5 w-3.5 text-[#DFB848]" />
                <span>Tambah Akun</span>
              </button>
            )}
          </div>

          {currentUser.role !== 'Admin' && (
            <div className="rounded-lg border border-amber-200 bg-[#FFFDF5] px-4 py-3 text-xs text-amber-900">
              Anda masuk dengan peran Staf. Hanya akun Admin yang dapat menambah, mengubah, atau menghapus akun pengguna lain.
            </div>
          )}

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
                        <span className="text-[11px] font-medium text-[#0D4A2E]">
                          (Akun Anda)
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[#6C7E73]">
                      Dibuat: {formatDateTimeID(acc.createdAt)}
                    </p>
                  </div>

                  {currentUser.role === 'Admin' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditAccount(acc)}
                        className="flex min-h-[36px] items-center gap-1 rounded-lg border border-[#DCE4DE] px-3 text-xs font-medium text-[#2A3B31] hover:bg-[#F6F8F6]"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        <span>Edit / Reset PIN</span>
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
                  )}
                </div>
              );
            })}
          </div>
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
                {editingAcc ? 'Ubah Akun Pengurus / Staf' : 'Tambah Akun Baru'}
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
                  <option value="Admin">Admin (Akses Penuh &amp; Kelola Akun)</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                  {editingAcc
                    ? 'Reset PIN Baru (Kosongkan jika tidak ingin mengubah)'
                    : 'PIN Awal (4–6 digit angka unik)'}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={accPin}
                  onChange={(e) => setAccPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={editingAcc ? 'Biarkan kosong jika tetap' : 'Contoh: 5678'}
                  required={!editingAcc}
                  className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] px-3 font-mono text-sm tracking-widest focus:border-[#0D4A2E] focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2.5 text-sm text-[#2A3B31] cursor-pointer">
                <input
                  type="checkbox"
                  checked={accActive}
                  onChange={(e) => setAccActive(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#0D4A2E]"
                />
                <span>Akun Aktif (dapat login dengan PIN)</span>
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
                  <span>{savingAcc ? 'Menyimpan...' : 'Simpan Akun'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Hapus Akun Pengurus / Staf?"
        message={`Akun "${deleteTarget?.name}" (${deleteTarget?.role}) akan dihapus dan tidak dapat lagi masuk menggunakan PIN-nya.`}
        confirmLabel="Ya, Hapus Akun"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
