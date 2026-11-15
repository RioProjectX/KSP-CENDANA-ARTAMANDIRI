import { useCallback, useEffect, useMemo, useState } from 'react';
import { ComputedLoan, DashboardSummary, KoperasiDatabase } from '../types';
import { todayISO } from '../utils/format';
import { AppNotification, buildAppNotifications } from '../utils/notifications';

const READ_STORAGE_KEY = 'ksp_cam_read_notifications_v1';
const DEVICE_ENABLED_KEY = 'ksp_cam_device_notif_enabled_v1';
const LAST_DIGEST_KEY = 'ksp_cam_last_notif_digest_v1';

export type DevicePermissionState = NotificationPermission | 'unsupported';

function loadReadIds(): string[] {
  try {
    const raw = localStorage.getItem(READ_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-300) : [];
  } catch {
    return [];
  }
}

function saveReadIds(ids: string[]) {
  try {
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(ids.slice(-300)));
  } catch {
    // ignore storage failures
  }
}

async function dispatchSystemNotification(title: string, body: string, tag: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  const options: NotificationOptions = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag,
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200)),
      ]);
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, options);
        return true;
      }
    }
    new Notification(title, options);
    return true;
  } catch {
    try {
      new Notification(title, options);
      return true;
    } catch {
      return false;
    }
  }
}

export function useAppNotifications({
  db,
  computedLoans,
  summary,
  dataReady,
  splashActive,
}: {
  db: KoperasiDatabase;
  computedLoans: ComputedLoan[];
  summary: DashboardSummary;
  dataReady: boolean;
  splashActive: boolean;
}) {
  const notifications = useMemo(
    () => buildAppNotifications(db, computedLoans, summary),
    [db, computedLoans, summary]
  );

  const [readIds, setReadIds] = useState<string[]>(() => loadReadIds());
  const [permission, setPermission] = useState<DevicePermissionState>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  });
  const [deviceEnabled, setDeviceEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DEVICE_ENABLED_KEY) !== 'false';
    } catch {
      return true;
    }
  });
  const [toastDismissed, setToastDismissed] = useState(false);

  const readSet = useMemo(() => new Set(readIds), [readIds]);

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !readSet.has(n.id)),
    [notifications, readSet]
  );

  const urgentUnreadCount = useMemo(
    () =>
      unreadNotifications.filter(
        (n) => n.severity === 'critical' || n.severity === 'warning'
      ).length,
    [unreadNotifications]
  );

  const markAsRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      saveReadIds(next);
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    const allIds = notifications.map((n) => n.id);
    setReadIds((prev) => {
      const merged = Array.from(new Set([...prev, ...allIds]));
      saveReadIds(merged);
      return merged;
    });
  }, [notifications]);

  const toggleDeviceEnabled = useCallback((enabled: boolean) => {
    setDeviceEnabled(enabled);
    try {
      localStorage.setItem(DEVICE_ENABLED_KEY, String(enabled));
    } catch {
      // ignore
    }
  }, []);

  const buildDigestText = useCallback((): { title: string; body: string } | null => {
    const overdue = notifications.filter((n) =>
      n.id.startsWith('loan-overdue-')
    ).length;
    const dueSoon = notifications.filter((n) => n.id.startsWith('loan-due-')).length;
    const visit = notifications.filter((n) => n.id.startsWith('app-visit-')).length;
    const finalization = notifications.filter((n) =>
      n.id.startsWith('app-final-')
    ).length;

    const parts: string[] = [];
    if (overdue > 0) parts.push(`${overdue} pinjaman terlambat`);
    if (dueSoon > 0) parts.push(`${dueSoon} pinjaman mendekati jatuh tempo`);
    if (visit > 0) parts.push(`${visit} nasabah perlu visit lapangan`);
    if (finalization > 0) parts.push(`${finalization} menunggu finalisasi`);

    if (parts.length === 0) return null;

    return {
      title: 'Pengingat KSP Cendana Artha Mandiri',
      body: `Terdapat ${parts.join(', ')}. Ketuk untuk melihat rincian.`,
    };
  }, [notifications]);

  const requestDevicePermission = useCallback(async (): Promise<DevicePermissionState> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      return 'unsupported';
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      toggleDeviceEnabled(true);
      const digest = buildDigestText();
      await dispatchSystemNotification(
        digest ? digest.title : 'Notifikasi KSP CAM Aktif',
        digest
          ? digest.body
          : 'Pengingat jatuh tempo pinjaman dan antrean visit lapangan kini aktif di perangkat Anda.',
        'ksp-cam-permission-welcome'
      );
    }
    return result;
  }, [buildDigestText, toggleDeviceEnabled]);

  const sendTestOrDigestNow = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission !== 'granted') {
      const next = await requestDevicePermission();
      return next === 'granted';
    }
    const digest = buildDigestText();
    return dispatchSystemNotification(
      digest ? digest.title : 'KSP CAM — Pengingat Pembukuan',
      digest
        ? digest.body
        : 'Semua pinjaman aman dan belum ada jadwal jatuh tempo atau visit lapangan mendesak.',
      `ksp-cam-manual-${Date.now()}`
    );
  }, [buildDigestText, requestDevicePermission]);

  // Automatic daily system notification once data is loaded & permission is granted
  useEffect(() => {
    if (!dataReady || splashActive) return;
    if (permission !== 'granted' || !deviceEnabled) return;

    const digest = buildDigestText();
    if (!digest) return;

    const today = todayISO();
    const signature = `${today}::${digest.body}`;
    try {
      const prev = localStorage.getItem(LAST_DIGEST_KEY);
      if (prev === signature) return;
      localStorage.setItem(LAST_DIGEST_KEY, signature);
    } catch {
      // continue
    }

    void dispatchSystemNotification(digest.title, digest.body, `ksp-cam-daily-${today}`);
  }, [dataReady, splashActive, permission, deviceEnabled, buildDigestText]);

  const showFloatingToast =
    dataReady &&
    !splashActive &&
    !toastDismissed &&
    unreadNotifications.length > 0 &&
    urgentUnreadCount > 0;

  return {
    notifications,
    unreadIds: readSet,
    unreadCount: unreadNotifications.length,
    urgentUnreadCount,
    permission,
    deviceEnabled,
    showFloatingToast,
    dismissFloatingToast: () => setToastDismissed(true),
    markAsRead,
    markAllAsRead,
    toggleDeviceEnabled,
    requestDevicePermission,
    sendTestOrDigestNow,
  };
}
