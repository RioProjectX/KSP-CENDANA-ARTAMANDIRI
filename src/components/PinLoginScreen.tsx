import { useEffect, useState } from 'react';
import { Delete, KeyRound, LockKeyhole, ShieldCheck, UserCheck } from 'lucide-react';
import { StaffAccount } from '../types';
import { BrandLogo } from './BrandLogo';

interface PinLoginScreenProps {
  accounts: Pick<StaffAccount, 'id' | 'name' | 'role'>[];
  hasDefaultPin: boolean;
  onLoginSuccess: (user: StaffAccount, token: string) => void;
}

export function PinLoginScreen({
  accounts,
  hasDefaultPin,
  onLoginSuccess,
}: PinLoginScreenProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const attemptLogin = async (pinValue: string) => {
    if (pinValue.length < 4) {
      setError('Masukkan minimal 4 digit PIN.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: pinValue,
          accountId: selectedAccountId || undefined,
        }),
      });
      const rawText = await res.text();
      let data: { user?: StaffAccount; token?: string; error?: string } = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        setError(`Server mengembalikan respons tidak valid (HTTP ${res.status}).`);
        return;
      }
      if (!res.ok || !data.user || !data.token) {
        setError(data.error || `PIN tidak valid (HTTP ${res.status}).`);
        setPin('');
      } else {
        onLoginSuccess(data.user, data.token);
      }
    } catch {
      setError('Gagal terhubung ke server. Periksa koneksi Anda.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDigit = (digit: string) => {
    if (submitting) return;
    setError('');
    if (pin.length >= 6) return;
    const next = pin + digit;
    setPin(next);
    // Auto-submit on 4 digits only if no ambiguity, or let user tap Masuk / auto-check on 4 digits when PIN length is 4
    if (next.length === 4 && accounts.length <= 1 && hasDefaultPin && next === '1234') {
      void attemptLogin(next);
    }
  };

  const handleBackspace = () => {
    if (submitting) return;
    setError('');
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (submitting) return;
    setError('');
    setPin('');
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (pin.length >= 4) {
          void attemptLogin(pin);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="min-h-screen bg-[#083320] flex flex-col lg:flex-row">
      {/* Left Institutional Panel (Desktop) / Top Compact Banner (Mobile) */}
      <div className="relative flex flex-col justify-between px-6 py-8 lg:w-[46%] lg:px-14 lg:py-12 border-b lg:border-b-0 lg:border-r border-white/10">
        <div className="flex items-center gap-3.5">
          <BrandLogo size={46} variant="gold-on-dark" />
          <div>
            <p className="font-display text-sm font-bold tracking-wide text-[#DFB848] uppercase">
              Koperasi Simpan Pinjam
            </p>
            <h1 className="font-display text-lg sm:text-xl font-bold text-white leading-tight">
              Cendana Artha Mandiri
            </h1>
          </div>
        </div>

        <div className="my-6 lg:my-auto max-w-md">
          <p className="text-xs font-medium tracking-wider text-[#DFB848] uppercase mb-2">
            Sistem Pembukuan &amp; Manajemen Pinjaman
          </p>
          <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-snug text-balance">
            Transparansi Kas &amp; Pemantauan Pinjaman Anggota
          </h2>
          <p className="mt-3 text-sm sm:text-base text-emerald-100/80 leading-relaxed">
            Akses langsung menggunakan PIN pengurus atau staf resmi. Seluruh mutasi kas, jadwal jatuh tempo, cicilan pengembalian, dan laporan keuangan dihitung otomatis secara real-time.
          </p>

          <div className="mt-6 hidden sm:grid grid-cols-2 gap-3 text-xs text-emerald-100/85">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3.5">
              <p className="font-semibold text-[#DFB848]">Buku Kas &amp; Pinjaman</p>
              <p className="mt-1 text-emerald-100/75">
                Pencatatan otomatis dengan nomor transaksi &amp; bukti lampiran foto/PDF.
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3.5">
              <p className="font-semibold text-[#DFB848]">Laporan &amp; Backup</p>
              <p className="mt-1 text-emerald-100/75">
                Ekspor Excel (.csv), PDF, cetak langsung, dan backup/restore JSON.
              </p>
            </div>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 text-xs text-emerald-100/60">
          <ShieldCheck className="h-4 w-4 text-[#DFB848]" />
          <span>Akses terlindungi PIN · Format Rupiah (Rp) &amp; Tanggal DD/MM/YYYY</span>
        </div>
      </div>

      {/* Right PIN Pad Panel */}
      <div className="flex flex-1 items-center justify-center bg-[#F6F8F6] px-4 py-8 sm:px-8">
        <div className="w-full max-w-[400px] rounded-2xl border border-[#DCE4DE] bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-xl font-bold text-[#0F1F17]">
                Masuk dengan PIN
              </h3>
              <p className="mt-0.5 text-xs text-[#5C6E63]">
                Ketuk papan angka atau gunakan keyboard (4–6 digit)
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0D4A2E]/10 text-[#0D4A2E]">
              <LockKeyhole className="h-5 w-5" />
            </div>
          </div>

          {accounts.length > 1 && (
            <div className="mt-5">
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#2A3B31]">
                <UserCheck className="h-3.5 w-3.5 text-[#0D4A2E]" />
                <span>Pilih Akun (Opsional)</span>
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => {
                  setSelectedAccountId(e.target.value);
                  setError('');
                }}
                className="w-full rounded-lg border border-[#DCE4DE] bg-[#F8FAF8] px-3 py-2.5 text-sm font-medium text-[#0F1F17] focus:border-[#0D4A2E] focus:bg-white focus:outline-none"
              >
                <option value="">Otomatis cocokkan PIN</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* PIN Dots Display */}
          <div className="mt-6 rounded-xl border border-[#DCE4DE] bg-[#F8FAF8] px-4 py-4">
            <div className="flex items-center justify-center gap-3">
              {[0, 1, 2, 3, 4, 5].map((idx) => {
                const filled = idx < pin.length;
                const activeSlot = idx < 4 || filled;
                if (!activeSlot) return null;
                return (
                  <div
                    key={idx}
                    className={`flex h-11 w-11 items-center justify-center rounded-lg border text-lg font-bold transition-all ${
                      filled
                        ? 'border-[#0D4A2E] bg-[#0D4A2E] text-[#DFB848] shadow-xs'
                        : 'border-[#CFDAD3] bg-white text-transparent'
                    }`}
                  >
                    {filled ? '•' : ''}
                  </div>
                );
              })}
            </div>
            <p className="mt-2.5 text-center font-mono text-xs text-[#5C6E63] tabular-nums">
              {pin.length === 0 ? 'Masukkan 4–6 digit PIN' : `${pin.length} digit terisi`}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-xs font-medium text-red-700"
            >
              {error}
            </div>
          )}

          {/* Numeric Keypad */}
          <div className="mt-5 grid grid-cols-3 gap-2.5">
            {keys.map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigit(digit)}
                disabled={submitting}
                className="flex h-14 items-center justify-center rounded-xl border border-[#DCE4DE] bg-white font-mono text-xl font-semibold text-[#0F1F17] transition-all hover:border-[#0D4A2E] hover:bg-[#F3F8F5] active:scale-[0.97] active:bg-[#E7F0EA]"
              >
                {digit}
              </button>
            ))}

            <button
              type="button"
              onClick={handleClear}
              disabled={submitting || pin.length === 0}
              className="flex h-14 items-center justify-center rounded-xl border border-[#DCE4DE] bg-[#F8FAF8] text-xs font-semibold text-[#5C6E63] transition-colors hover:bg-[#EDF2EE] disabled:opacity-45"
            >
              Bersihkan
            </button>

            <button
              type="button"
              onClick={() => handleDigit('0')}
              disabled={submitting}
              className="flex h-14 items-center justify-center rounded-xl border border-[#DCE4DE] bg-white font-mono text-xl font-semibold text-[#0F1F17] transition-all hover:border-[#0D4A2E] hover:bg-[#F3F8F5] active:scale-[0.97] active:bg-[#E7F0EA]"
            >
              0
            </button>

            <button
              type="button"
              onClick={handleBackspace}
              disabled={submitting || pin.length === 0}
              className="flex h-14 items-center justify-center rounded-xl border border-[#DCE4DE] bg-[#F8FAF8] text-[#2A3B31] transition-colors hover:bg-[#EDF2EE] disabled:opacity-45"
              aria-label="Hapus satu digit"
            >
              <Delete className="h-5 w-5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => void attemptLogin(pin)}
            disabled={submitting || pin.length < 4}
            className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#0D4A2E] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#083320] disabled:cursor-not-allowed disabled:bg-[#9BB3A6]"
          >
            <KeyRound className="h-4 w-4 text-[#DFB848]" />
            <span>{submitting ? 'Memeriksa PIN...' : 'Masuk ke Sistem'}</span>
          </button>

          {hasDefaultPin && (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-[#E6D6A2] bg-[#FEF9E7] px-3 py-2 text-xs text-[#7D5D0F]">
              <span>PIN Awal Default:</span>
              <span className="font-mono font-bold tracking-widest">1234</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
