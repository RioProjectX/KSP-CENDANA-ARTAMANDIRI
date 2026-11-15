import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  BellRing,
  CheckCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Send,
  Wallet,
  X,
} from 'lucide-react';
import { DevicePermissionState } from '../hooks/useAppNotifications';
import { AppNotification, NotificationCategory } from '../utils/notifications';

interface NotificationBellButtonProps {
  unreadCount: number;
  urgentCount: number;
  variant?: 'dark' | 'light';
  onClick: () => void;
}

export function NotificationBellButton({
  unreadCount,
  urgentCount,
  variant = 'light',
  onClick,
}: NotificationBellButtonProps) {
  const isDark = variant === 'dark';

  return (
    <button
      type="button"
      onClick={onClick}
      title="Pusat Notifikasi & Pengingat"
      aria-label={`Pusat Notifikasi (${unreadCount} belum dibaca)`}
      className={`relative flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors ${
        isDark
          ? 'border border-white/20 bg-white/10 text-white hover:bg-white/15'
          : 'border border-[#DCE4DE] bg-white text-[#0F1F17] hover:bg-[#EFF5F1]'
      }`}
    >
      <Bell
        className={`h-4 w-4 ${
          urgentCount > 0
            ? isDark
              ? 'text-[#DFB848]'
              : 'text-amber-600'
            : isDark
            ? 'text-emerald-100'
            : 'text-[#0D4A2E]'
        }`}
      />
      <span className="hidden sm:inline">Notifikasi</span>
      {unreadCount > 0 && (
        <span
          className={`inline-flex min-w-[18px] items-center justify-center rounded-full px-1 py-0.5 font-mono text-[10px] font-bold leading-none tabular-nums ${
            urgentCount > 0
              ? 'bg-red-600 text-white'
              : 'bg-[#C59B27] text-[#083320]'
          }`}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}

interface NotificationDrawerProps {
  open: boolean;
  notifications: AppNotification[];
  readSet: Set<string>;
  unreadCount: number;
  permission: DevicePermissionState;
  deviceEnabled: boolean;
  onClose: () => void;
  onSelectNotification: (item: AppNotification) => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onRequestPermission: () => Promise<DevicePermissionState>;
  onToggleDeviceEnabled: (enabled: boolean) => void;
  onSendTestNow: () => Promise<boolean>;
}

export function NotificationDrawer({
  open,
  notifications,
  readSet,
  unreadCount,
  permission,
  deviceEnabled,
  onClose,
  onSelectNotification,
  onMarkAsRead,
  onMarkAllAsRead,
  onRequestPermission,
  onToggleDeviceEnabled,
  onSendTestNow,
}: NotificationDrawerProps) {
  const [filter, setFilter] = useState<'all' | NotificationCategory>('all');
  const [deviceFeedback, setDeviceFeedback] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications;
    return notifications.filter((n) => n.category === filter);
  }, [notifications, filter]);

  const countsByCategory = useMemo(() => {
    return {
      jatuhTempo: notifications.filter((n) => n.category === 'jatuh-tempo').length,
      visit: notifications.filter((n) => n.category === 'visit').length,
      kas: notifications.filter((n) => n.category === 'kas').length,
    };
  }, [notifications]);

  if (!open) return null;

  const handleEnableDevice = async () => {
    setDeviceFeedback('');
    const res = await onRequestPermission();
    if (res === 'granted') {
      setDeviceFeedback('Notifikasi aplikasi perangkat berhasil diaktifkan.');
    } else if (res === 'denied') {
      setDeviceFeedback(
        'Izin notifikasi diblokir browser. Aktifkan lewat ikon gembok di bilah alamat.'
      );
    } else if (res === 'unsupported') {
      setDeviceFeedback('Browser ini belum mendukung notifikasi sistem perangkat.');
    }
  };

  const handleSendTest = async () => {
    setDeviceFeedback('');
    setSendingTest(true);
    try {
      const ok = await onSendTestNow();
      setDeviceFeedback(
        ok
          ? 'Notifikasi pengingat berhasil dikirim ke perangkat Anda.'
          : 'Tidak dapat mengirim notifikasi. Periksa izin notifikasi pada browser.'
      );
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Pusat Notifikasi"
    >
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <div className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[#DCE4DE] bg-white shadow-2xl">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-[#EBF0EC] bg-[#083320] px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-[#DFB848]">
              <BellRing className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-white">
                Pusat Notifikasi
              </h2>
              <p className="text-xs text-emerald-100/75">
                {unreadCount > 0
                  ? `${unreadCount} pengingat belum dibaca`
                  : 'Semua pengingat sudah dibaca'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-emerald-100 hover:bg-white/10"
            aria-label="Tutup Notifikasi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Device / System Push Notification Controls */}
        <div className="border-b border-[#EBF0EC] bg-[#F8FAF8] px-5 py-3.5 space-y-2.5">
          {permission === 'granted' ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#0F1F17]">
                <input
                  type="checkbox"
                  checked={deviceEnabled}
                  onChange={(e) => onToggleDeviceEnabled(e.target.checked)}
                  className="h-4 w-4 accent-[#0D4A2E]"
                />
                <span>Notifikasi Perangkat Aktif</span>
              </label>
              <button
                type="button"
                disabled={sendingTest}
                onClick={() => void handleSendTest()}
                className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border border-[#DCE4DE] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0D4A2E] hover:bg-[#EFF5F1] disabled:opacity-60"
              >
                <Send className="h-3 w-3" />
                <span>{sendingTest ? 'Mengirim...' : 'Kirim Pengingat'}</span>
              </button>
            </div>
          ) : permission === 'denied' ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
              Izin notifikasi perangkat diblokir di pengaturan browser. Notifikasi dalam aplikasi tetap aktif di bawah ini.
            </div>
          ) : permission === 'default' ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#0F1F17]">
                  Aktifkan Notifikasi Perangkat
                </p>
                <p className="text-[11px] text-[#5C6E63]">
                  Munculkan pengingat jatuh tempo &amp; visit langsung di HP/Desktop.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleEnableDevice()}
                className="shrink-0 rounded-lg bg-[#0D4A2E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#083320]"
              >
                Aktifkan
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-[#5C6E63]">
              Browser tidak mendukung notifikasi OS; daftar pengingat tetap dipantau real-time di sini.
            </p>
          )}

          {deviceFeedback && (
            <p className="text-[11px] font-medium text-[#0D4A2E]">{deviceFeedback}</p>
          )}
        </div>

        {/* Category Filter Tabs & Mark All Read */}
        <div className="border-b border-[#EBF0EC] px-5 py-3 space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { key: 'all', label: `Semua (${notifications.length})` },
                {
                  key: 'jatuh-tempo',
                  label: `Jatuh Tempo (${countsByCategory.jatuhTempo})`,
                },
                { key: 'visit', label: `Visit (${countsByCategory.visit})` },
                { key: 'kas', label: `Kas (${countsByCategory.kas})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                  filter === tab.key
                    ? 'bg-[#083320] text-white'
                    : 'border border-[#DCE4DE] bg-[#F8FAF8] text-[#425449] hover:bg-[#EFF5F1]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {unreadCount > 0 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0D4A2E] hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Tandai Semua Sudah Dibaca</span>
              </button>
            </div>
          )}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#DCE4DE] bg-[#F8FAF8] px-4 py-12 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-[#0D4A2E]" />
              <p className="mt-2.5 font-display text-sm font-bold text-[#0F1F17]">
                Tidak Ada Pengingat Saat Ini
              </p>
              <p className="mt-1 text-xs text-[#5C6E63]">
                Seluruh pinjaman aman, tidak ada antrean visit mendesak, dan kondisi kas terpantau baik.
              </p>
            </div>
          ) : (
            filtered.map((item) => {
              const isRead = readSet.has(item.id);
              const styleBySeverity =
                item.severity === 'critical'
                  ? 'border-red-200 bg-red-50/60'
                  : item.severity === 'warning'
                  ? 'border-amber-200 bg-amber-50/60'
                  : item.severity === 'success'
                  ? 'border-emerald-200 bg-emerald-50/50'
                  : 'border-blue-200 bg-blue-50/40';

              const Icon =
                item.category === 'jatuh-tempo'
                  ? item.severity === 'critical'
                    ? AlertCircle
                    : Clock
                  : item.category === 'visit'
                  ? ClipboardCheck
                  : Wallet;

              const iconColor =
                item.severity === 'critical'
                  ? 'text-red-700'
                  : item.severity === 'warning'
                  ? 'text-amber-700'
                  : item.severity === 'success'
                  ? 'text-emerald-700'
                  : 'text-blue-700';

              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3.5 transition-opacity ${styleBySeverity} ${
                    isRead ? 'opacity-75' : ''
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-bold text-[#0F1F17] leading-snug">
                          {!isRead && (
                            <span
                              className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#0D4A2E] align-middle"
                              aria-label="Belum dibaca"
                            />
                          )}
                          {item.title}
                        </p>
                        <span className="shrink-0 rounded bg-white/90 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#425449] border border-[#DCE4DE]">
                          {item.dateLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-[#425449]">
                        {item.message}
                      </p>
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectNotification(item)}
                          className="rounded-lg bg-[#0D4A2E] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#083320]"
                        >
                          {item.actionLabel}
                        </button>
                        {!isRead && (
                          <button
                            type="button"
                            onClick={() => onMarkAsRead(item.id)}
                            className="text-[11px] font-medium text-[#5C6E63] hover:text-[#0F1F17] hover:underline"
                          >
                            Tandai dibaca
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

interface NotificationToastBannerProps {
  visible: boolean;
  urgentCount: number;
  totalUnread: number;
  onOpenDrawer: () => void;
  onDismiss: () => void;
}

export function NotificationToastBanner({
  visible,
  urgentCount,
  totalUnread,
  onOpenDrawer,
  onDismiss,
}: NotificationToastBannerProps) {
  if (!visible) return null;

  return (
    <div
      role="status"
      className="no-print fixed bottom-4 right-4 z-40 w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-[#C59B27]/60 bg-[#083320] p-4 text-white shadow-2xl"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#DFB848]/20 text-[#DFB848]">
          <BellRing className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold text-white">
            {urgentCount} Pengingat Penting Koperasi
          </p>
          <p className="mt-0.5 text-xs text-emerald-100/80">
            Ada {totalUnread} notifikasi aktif (pinjaman jatuh tempo, antrean visit lapangan, atau status kas).
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenDrawer}
              className="rounded-lg bg-[#DFB848] px-3 py-1.5 text-xs font-bold text-[#083320] hover:bg-[#e8c660]"
            >
              Lihat Notifikasi
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-emerald-100/80 hover:bg-white/10"
            >
              Nanti
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-emerald-100/70 hover:bg-white/10"
          aria-label="Tutup pengingat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
