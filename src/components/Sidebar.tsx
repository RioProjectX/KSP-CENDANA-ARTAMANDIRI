import {
  ArrowDownLeft,
  ArrowUpRight,
  FileSpreadsheet,
  HandCoins,
  LayoutDashboard,
  Menu,
  RotateCcw,
  Users,
  X,
} from 'lucide-react';
import { ActivePage, StaffAccount } from '../types';
import { BrandLogo } from './BrandLogo';
import { PWAInstallButton } from './PWAInstallButton';

interface SidebarProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
  currentUser: StaffAccount;
  mobileOpen: boolean;
  onSetMobileOpen: (open: boolean) => void;
  dueAlertCount: number;
}

const NAV_ITEMS: {
  id: ActivePage;
  label: string;
  icon: typeof LayoutDashboard;
}[] = [
  { id: 'dashboard', label: 'Dashboard Utama', icon: LayoutDashboard },
  { id: 'uang-masuk', label: 'Uang Masuk', icon: ArrowDownLeft },
  { id: 'uang-keluar', label: 'Uang Keluar', icon: ArrowUpRight },
  { id: 'pinjaman', label: 'Dana Sedang Dipinjam', icon: HandCoins },
  { id: 'pengembalian', label: 'Pengembalian Dana', icon: RotateCcw },
  { id: 'laporan', label: 'Laporan & Backup', icon: FileSpreadsheet },
  { id: 'akun', label: 'Pengurus & Staf', icon: Users },
];

export function Sidebar({
  activePage,
  onNavigate,
  currentUser,
  mobileOpen,
  onSetMobileOpen,
  dueAlertCount,
}: SidebarProps) {
  const handleSelect = (page: ActivePage) => {
    onNavigate(page);
    onSetMobileOpen(false);
  };

  const navContent = (
    <div className="flex h-full flex-col bg-[#083320] text-white">
      {/* Brand Block */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-3 min-w-0">
          <BrandLogo size={38} variant="gold-on-dark" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-wider text-[#DFB848] uppercase truncate">
              KSP Cendana
            </p>
            <p className="font-display text-sm font-bold text-white truncate">
              Artha Mandiri
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <PWAInstallButton />
          <button
            type="button"
            onClick={() => onSetMobileOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-emerald-100 hover:bg-white/10 lg:hidden"
            aria-label="Tutup Menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Menu Utama">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={`flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'bg-[#0D4A2E] text-white ring-1 ring-[#C59B27]/60'
                  : 'text-emerald-100/80 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    active ? 'text-[#DFB848]' : 'text-emerald-200/70'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </span>

              {item.id === 'pinjaman' && dueAlertCount > 0 && (
                <span className="shrink-0 rounded-md bg-[#C59B27] px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#083320] tabular-nums">
                  {dueAlertCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Active Operator Card */}
      <div className="border-t border-white/10 p-4 pb-safe">
        <button
          type="button"
          onClick={() => handleSelect('akun')}
          className="w-full rounded-xl bg-white/[0.05] px-3.5 py-3 text-left transition-colors hover:bg-white/[0.09]"
        >
          <p className="text-[10px] font-semibold tracking-wider text-emerald-200/70 uppercase">
            Petugas Aktif
          </p>
          <p className="mt-0.5 truncate font-display text-sm font-semibold text-white">
            {currentUser.name}
          </p>
          <p className="mt-0.5 text-xs text-[#DFB848]">
            Peran: {currentUser.role} · Ketuk untuk ganti
          </p>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Static Sidebar */}
      <aside className="no-print hidden lg:flex lg:w-[264px] lg:shrink-0 lg:flex-col lg:sticky lg:top-0 lg:h-screen">
        {navContent}
      </aside>

      {/* Mobile Compact Top Bar */}
      <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#0D4A2E] bg-[#083320] px-4 text-white lg:hidden">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => onSetMobileOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/15"
            aria-label="Buka Menu Navigasi"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold text-white">
              KSP Cendana Artha Mandiri
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton />
          <button
            type="button"
            onClick={() => handleSelect('akun')}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-white/20 px-2.5 text-xs font-medium text-[#DFB848] hover:bg-white/10 whitespace-nowrap"
          >
            <Users className="h-3.5 w-3.5" />
            <span>{currentUser.role}</span>
          </button>
        </div>
      </header>

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/55 backdrop-blur-[1px]"
            onClick={() => onSetMobileOpen(false)}
          />
          <aside className="relative z-10 h-full w-[280px] max-w-[85vw] shadow-2xl">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
