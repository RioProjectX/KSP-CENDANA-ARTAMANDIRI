import {
  ActivePage,
  ComputedLoan,
  DashboardSummary,
  KoperasiDatabase,
} from '../types';
import { formatDateID, formatRupiah, todayISO } from './format';

export type NotificationCategory = 'jatuh-tempo' | 'visit' | 'kas';
export type NotificationSeverity = 'critical' | 'warning' | 'info' | 'success';

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  message: string;
  dateLabel: string;
  targetPage: ActivePage;
  targetLoanId?: string;
  actionLabel: string;
}

const SEVERITY_RANK: Record<NotificationSeverity, number> = {
  critical: 1,
  warning: 2,
  info: 3,
  success: 4,
};

export function buildAppNotifications(
  db: KoperasiDatabase,
  computedLoans: ComputedLoan[],
  summary: DashboardSummary
): AppNotification[] {
  const today = todayISO();
  const items: AppNotification[] = [];

  // 1. Pinjaman Terlambat & Mendekati Jatuh Tempo (H-0 sampai H-7)
  for (const loan of computedLoans) {
    if (loan.status === 'LUNAS') continue;

    if (loan.dueReminderLevel === 'terlambat') {
      const daysLate = Math.abs(loan.daysUntilDue);
      items.push({
        id: `loan-overdue-${loan.id}-${today}`,
        category: 'jatuh-tempo',
        severity: 'critical',
        title: `Terlambat ${daysLate} Hari — ${loan.borrowerName}`,
        message: `${loan.txNumber} · Sisa tagihan ${formatRupiah(loan.remainingAmount)} + est. denda ${formatRupiah(loan.accruedPenalty)} (Jatuh tempo ${formatDateID(loan.dueDate)}).`,
        dateLabel: `Terlambat ${daysLate} hr`,
        targetPage: 'pengembalian',
        targetLoanId: loan.id,
        actionLabel: 'Catat Cicilan',
      });
    } else if (loan.daysUntilDue >= 0 && loan.daysUntilDue <= 7) {
      const isUrgent = loan.daysUntilDue <= 1;
      const dueText =
        loan.daysUntilDue === 0
          ? 'Jatuh Tempo Hari Ini'
          : loan.daysUntilDue === 1
          ? 'Jatuh Tempo Besok (H-1)'
          : `Mendekati Jatuh Tempo (H-${loan.daysUntilDue})`;

      items.push({
        id: `loan-due-${loan.id}-${loan.daysUntilDue}`,
        category: 'jatuh-tempo',
        severity: isUrgent ? 'warning' : 'info',
        title: `${dueText} — ${loan.borrowerName}`,
        message: `${loan.txNumber} · Sisa tagihan ${formatRupiah(loan.remainingAmount)} (${formatDateID(loan.dueDate)}).`,
        dateLabel: loan.daysUntilDue === 0 ? 'Hari Ini' : `H-${loan.daysUntilDue}`,
        targetPage: 'pinjaman',
        targetLoanId: loan.id,
        actionLabel: 'Lihat Pinjaman',
      });
    }
  }

  // 2. Calon Nasabah: Perlu Visit Lapangan, Menunggu Finalisasi, & Lolos Siap Cair
  const applications = db.loanApplications || [];
  for (const app of applications) {
    if (app.status === 'MENUNGGU_VISIT') {
      const dueVisit = Boolean(app.visitDate && app.visitDate <= today);
      items.push({
        id: `app-visit-${app.id}-${app.visitDate || 'none'}`,
        category: 'visit',
        severity: dueVisit ? 'warning' : 'info',
        title: `Perlu Visit Lapangan — ${app.applicantName}`,
        message: `${app.applicationNumber} · ${app.address} · Ajuan ${formatRupiah(app.requestedAmount)}.`,
        dateLabel: app.visitDate ? `Visit ${formatDateID(app.visitDate)}` : 'Belum Dijadwal',
        targetPage: 'calon-nasabah',
        actionLabel: 'Buka Daftar Visit',
      });
    } else if (app.status === 'MENUNGGU_FINALISASI') {
      items.push({
        id: `app-final-${app.id}`,
        category: 'visit',
        severity: 'info',
        title: `Menunggu Finalisasi — ${app.applicantName}`,
        message: `${app.applicationNumber} sudah dicek visit lapangan · Tentukan keputusan Lolos atau Tidak Lolos.`,
        dateLabel: 'Menunggu Keputusan',
        targetPage: 'calon-nasabah',
        actionLabel: 'Finalisasi',
      });
    } else if (app.status === 'LOLOS' && !app.disbursedLoanId) {
      items.push({
        id: `app-lolos-${app.id}`,
        category: 'visit',
        severity: 'success',
        title: `Pengajuan Lolos Siap Dicairkan — ${app.applicantName}`,
        message: `${app.applicationNumber} · Ajuan ${formatRupiah(app.requestedAmount)} sudah lolos survei dan siap dicairkan.`,
        dateLabel: 'Siap Cair',
        targetPage: 'calon-nasabah',
        actionLabel: 'Cairkan Pinjaman',
      });
    }
  }

  // 3. Peringatan Saldo Kas Rendah / Minus (jika koperasi sudah memiliki transaksi)
  const hasActivity = db.transactions.length > 0 || db.loans.length > 0;
  if (hasActivity && summary.saldoKasTersedia <= 0) {
    items.push({
      id: `cash-deficit-${today}`,
      category: 'kas',
      severity: 'critical',
      title: 'Saldo Kas Tersedia Habis / Defisit',
      message: `Saldo kas likuid saat ini ${formatRupiah(summary.saldoKasTersedia)}. Periksa pemasukan kas atau pencairan pinjaman.`,
      dateLabel: formatDateID(today),
      targetPage: 'dashboard',
      actionLabel: 'Cek Saldo Kas',
    });
  } else if (hasActivity && summary.saldoKasTersedia < 500000) {
    items.push({
      id: `cash-low-${today}`,
      category: 'kas',
      severity: 'warning',
      title: 'Saldo Kas Likuid Menipis',
      message: `Saldo kas tersedia saat ini ${formatRupiah(summary.saldoKasTersedia)} (di bawah Rp 500.000).`,
      dateLabel: formatDateID(today),
      targetPage: 'uang-masuk',
      actionLabel: 'Catat Kas Masuk',
    });
  }

  return items.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
