import { useEffect, useState } from 'react';
import { BrandLogo } from './BrandLogo';

interface WaveLoadingScreenProps {
  dataReady: boolean;
  onFinished: () => void;
}

export function WaveLoadingScreen({ dataReady, onFinished }: WaveLoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    let rafId = 0;
    const startTime = performance.now();
    const minDuration = 2200; // 2.2 detik animasi halus 0 -> 100%

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const linear = Math.min(1, elapsed / minDuration);
      // Ease out cubic for smooth acceleration & polished finish
      const eased = 1 - Math.pow(1 - linear, 2.2);
      const targetMax = dataReady ? 100 : 94;
      const nextValue = Math.min(targetMax, Math.round(eased * 100));

      setProgress((prev) => (nextValue > prev ? nextValue : prev));

      if (nextValue < 100) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [dataReady]);

  useEffect(() => {
    if (progress < 100) return;

    const exitTimer = window.setTimeout(() => {
      setExiting(true);
    }, 280);

    const finishTimer = window.setTimeout(() => {
      onFinished();
    }, 980);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(finishTimer);
    };
  }, [progress, onFinished]);

  const statusText =
    progress < 30
      ? 'Menyiapkan ruang kerja keuangan...'
      : progress < 65
        ? 'Menghubungkan database cloud koperasi...'
        : progress < 95
          ? 'Menghitung kas & portofolio pinjaman...'
          : 'Memasuki aplikasi...';

  // Wave rises from bottom (100% offset) to top (-15% offset) as progress moves 0 -> 100
  const waveTopPercent = 96 - progress * 1.12;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#062617] text-white transition-all duration-700 ease-in-out ${
        exiting ? 'wave-curtain-exit pointer-events-none' : 'opacity-100'
      }`}
      role="status"
      aria-live="polite"
      aria-label={`Memuat aplikasi ${progress} persen`}
    >
      {/* Subtle Radial Glow Backdrop */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 38%, rgba(223, 184, 72, 0.14) 0%, rgba(13, 74, 46, 0.25) 45%, rgba(6, 38, 23, 0.96) 100%)',
        }}
      />

      {/* Rising Multi-Layer Animated Waves */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 transition-[top] duration-150 ease-out"
        style={{ top: `${waveTopPercent}%` }}
      >
        {/* Wave Layer 1 - Gold Accent Shimmer */}
        <div className="wave-track wave-animate-slow absolute -top-14 left-0 flex h-24 w-[200%] opacity-45">
          <svg
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            className="h-full w-1/2 fill-[#DFB848]"
          >
            <path d="M0,64 C180,115 360,10 600,64 C840,118 1020,14 1200,64 L1200,120 L0,120 Z" />
          </svg>
          <svg
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            className="h-full w-1/2 fill-[#DFB848]"
          >
            <path d="M0,64 C180,115 360,10 600,64 C840,118 1020,14 1200,64 L1200,120 L0,120 Z" />
          </svg>
        </div>

        {/* Wave Layer 2 - Mid Emerald */}
        <div className="wave-track wave-animate-reverse absolute -top-11 left-0 flex h-24 w-[200%] opacity-75">
          <svg
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            className="h-full w-1/2 fill-[#13603C]"
          >
            <path d="M0,52 C210,5 410,110 600,52 C790,-6 990,105 1200,52 L1200,120 L0,120 Z" />
          </svg>
          <svg
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            className="h-full w-1/2 fill-[#13603C]"
          >
            <path d="M0,52 C210,5 410,110 600,52 C790,-6 990,105 1200,52 L1200,120 L0,120 Z" />
          </svg>
        </div>

        {/* Wave Layer 3 - Deep Forest Green Fill */}
        <div className="wave-track wave-animate-fast absolute -top-8 left-0 flex h-20 w-[200%]">
          <svg
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            className="h-full w-1/2 fill-[#0D4A2E]"
          >
            <path d="M0,60 C240,115 420,12 600,60 C780,108 960,12 1200,60 L1200,120 L0,120 Z" />
          </svg>
          <svg
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            className="h-full w-1/2 fill-[#0D4A2E]"
          >
            <path d="M0,60 C240,115 420,12 600,60 C780,108 960,12 1200,60 L1200,120 L0,120 Z" />
          </svg>
        </div>

        {/* Solid Liquid Body Below Crest */}
        <div className="h-[140vh] w-full bg-[#0D4A2E]" />
      </div>

      {/* Center Content */}
      <div className="relative z-10 flex w-full max-w-xl flex-col items-center px-6 text-center">
        {/* Emblem with gentle wave halo */}
        <div className="relative mb-6 flex items-center justify-center">
          <div className="absolute h-28 w-28 animate-ping rounded-full border border-[#DFB848]/25 [animation-duration:2.6s]" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl border border-[#DFB848]/40 bg-[#083320]/90 shadow-2xl backdrop-blur-xs">
            <BrandLogo size={58} variant="gold-on-dark" />
          </div>
        </div>

        {/* Institution Title */}
        <p className="text-[11px] sm:text-xs font-semibold tracking-[0.28em] text-[#DFB848] uppercase">
          Sistem Pembukuan &amp; Simpan Pinjam
        </p>

        <h1 className="mt-3 font-display text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight drop-shadow-xs">
          KOPERASI SIMPAN PINJAM
          <span className="mt-1 block text-[#DFB848]">ARTHA MANDIRI</span>
        </h1>

        <p className="mt-2 text-xs sm:text-sm font-medium text-emerald-100/75">
          KSP Cendana Artha Mandiri
        </p>

        {/* Percentage Readout 0 - 100% */}
        <div className="mt-8 flex flex-col items-center w-full max-w-xs">
          <div className="font-mono text-4xl sm:text-5xl font-bold tracking-tight text-[#DFB848] tabular-nums drop-shadow-xs">
            {progress}%
          </div>

          {/* Slim Institutional Progress Bar */}
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/15 p-0.5 ring-1 ring-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#C59B27] via-[#DFB848] to-[#F5DC84] transition-[width] duration-100 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="mt-3 text-xs font-medium text-emerald-100/85">
            {statusText}
          </p>
        </div>
      </div>
    </div>
  );
}
