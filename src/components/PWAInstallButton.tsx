import { useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { BrandLogo } from './BrandLogo';

interface PWAInstallButtonProps {
  className?: string;
}

export function PWAInstallButton({ className = '' }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // Sembunyikan tombol jika aplikasi sudah berjalan dalam mode terinstal (standalone)
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) return;
      return;
    }
    setShowGuide(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        title="Unduh Aplikasi KSP CAM"
        aria-label="Unduh Aplikasi KSP CAM"
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#DFB848]/40 bg-[#DFB848]/15 text-[#DFB848] transition-colors hover:bg-[#DFB848] hover:text-[#083320] active:scale-95 ${className}`}
      >
        <Download className="h-4 w-4" />
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-guide-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-[#DCE4DE] bg-white p-6 text-[#0F1F17] shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <BrandLogo size={42} variant="emerald-on-light" />
                <div>
                  <h3
                    id="pwa-guide-title"
                    className="font-display text-base font-bold text-[#0F1F17]"
                  >
                    Unduh Aplikasi KSP CAM
                  </h3>
                  <p className="text-xs text-[#5C6E63]">
                    Pasang di layar utama perangkat Anda
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#5C6E63] hover:bg-[#F1F5F2]"
                aria-label="Tutup panduan instalasi"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="mt-4 space-y-2.5 rounded-xl border border-[#DCE4DE] bg-[#F8FAF8] p-4 text-xs leading-relaxed text-[#2A3B31]">
                <p className="flex items-center gap-2 font-semibold text-[#083320]">
                  <Share className="h-4 w-4 text-[#0D4A2E]" />
                  <span>Cara Pasang di iPhone / iPad (Safari):</span>
                </p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>
                    Ketuk ikon <strong>Bagikan (Share)</strong> pada bilah Safari.
                  </li>
                  <li>
                    Gulir ke bawah lalu pilih <strong>Tambah ke Layar Utama (Add to Home Screen)</strong>.
                  </li>
                  <li>
                    Ketuk <strong>Tambah (Add)</strong> untuk menyimpan aplikasi <strong>KSP CAM</strong>.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="mt-4 space-y-2.5 rounded-xl border border-[#DCE4DE] bg-[#F8FAF8] p-4 text-xs leading-relaxed text-[#2A3B31]">
                <p className="flex items-center gap-2 font-semibold text-[#083320]">
                  <Smartphone className="h-4 w-4 text-[#0D4A2E]" />
                  <span>Cara Pasang di Desktop / Android:</span>
                </p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>
                    Buka menu browser (ikon titik tiga di pojok kanan atas atau ikon instal di bilah alamat).
                  </li>
                  <li>
                    Pilih <strong>Instal KSP CAM</strong> atau <strong>Tambahkan ke Layar Utama</strong>.
                  </li>
                  <li>
                    Ikon <strong>KSP CAM</strong> akan otomatis muncul seperti aplikasi bawaan.
                  </li>
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-4 min-h-[42px] w-full rounded-xl bg-[#0D4A2E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#083320]"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
}
