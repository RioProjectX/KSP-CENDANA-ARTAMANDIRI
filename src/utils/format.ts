import {
  ComputedLoan,
  DashboardSummary,
  DueReminderLevel,
  KoperasiDatabase,
  LoanStatus,
  Repayment,
  UnifiedLedgerRow,
} from '../types';

export const CASH_IN_CATEGORIES = [
  'Simpanan Pokok',
  'Simpanan Wajib',
  'Simpanan Sukarela',
  'Setoran Modal Koperasi',
  'Pendapatan Administrasi',
  'Jasa / Bunga Lainnya',
  'Pemasukan Lainnya',
];

export const CASH_OUT_CATEGORIES = [
  'Penarikan Simpanan Anggota',
  'Biaya Operasional Kantor',
  'Honorarium / Gaji Pengurus',
  'Pembelian Perlengkapan',
  'Biaya Listrik, Air & Internet',
  'Pembagian SHU',
  'Pengeluaran Lainnya',
];

export function formatRupiah(value: number): string {
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  const abs = Math.abs(safe);
  const formatted = new Intl.NumberFormat('id-ID').format(abs);
  return safe < 0 ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

export function formatNumericDots(raw: string | number): string {
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';
  return new Intl.NumberFormat('id-ID').format(Number(digits));
}

export function parseNumericDots(raw: string): number {
  const digits = raw.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDateID(isoDate: string): string {
  if (!isoDate) return '-';
  const parts = isoDate.slice(0, 10).split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatDateTimeID(isoDateTime: string): string {
  if (!isoDateTime) return '-';
  const dt = new Date(isoDateTime);
  if (Number.isNaN(dt.getTime())) return isoDateTime;
  const d = String(dt.getDate()).padStart(2, '0');
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const y = dt.getFullYear();
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return `${d}/${m}/${y} ${hh}:${mm}`;
}

export function diffCalendarDays(targetISO: string, fromISO: string = todayISO()): number {
  const [ty, tm, td] = targetISO.slice(0, 10).split('-').map(Number);
  const [fy, fm, fd] = fromISO.slice(0, 10).split('-').map(Number);
  if (!ty || !tm || !td || !fy || !fm || !fd) return 0;
  const targetUtc = Date.UTC(ty, tm - 1, td);
  const fromUtc = Date.UTC(fy, fm - 1, fd);
  return Math.round((targetUtc - fromUtc) / (1000 * 60 * 60 * 24));
}

export function generateTxNumber(
  prefix: 'KM' | 'KK' | 'PJ' | 'PB',
  dateISO: string,
  existingNumbers: string[]
): string {
  const datePart = (dateISO || todayISO()).replace(/-/g, '').slice(0, 8);
  const base = `${prefix}-${datePart}-`;
  let maxSeq = 0;
  for (const num of existingNumbers) {
    if (num.startsWith(base)) {
      const seq = Number(num.slice(base.length));
      if (Number.isFinite(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }
  return `${base}${String(maxSeq + 1).padStart(3, '0')}`;
}

export function getDueReminderLabel(loan: ComputedLoan): string {
  if (loan.status === 'LUNAS') return 'Lunas';
  if (loan.daysUntilDue < 0) return `Terlambat ${Math.abs(loan.daysUntilDue)} hari`;
  if (loan.daysUntilDue === 0) return 'Jatuh Tempo Hari Ini';
  if (loan.daysUntilDue === 1) return 'H-1 (Besok)';
  if (loan.daysUntilDue <= 3) return `H-${loan.daysUntilDue} (Segera)`;
  if (loan.daysUntilDue <= 7) return `H-${loan.daysUntilDue}`;
  return `${loan.daysUntilDue} hari lagi`;
}

export function computeKoperasiMetrics(db: KoperasiDatabase): {
  computedLoans: ComputedLoan[];
  summary: DashboardSummary;
  ledger: UnifiedLedgerRow[];
} {
  const today = todayISO();

  const repaymentsByLoan = new Map<string, Repayment[]>();
  for (const rep of db.repayments) {
    const arr = repaymentsByLoan.get(rep.loanId) || [];
    arr.push(rep);
    repaymentsByLoan.set(rep.loanId, arr);
  }

  const computedLoans: ComputedLoan[] = db.loans.map((loan) => {
    const loanRepayments = [...(repaymentsByLoan.get(loan.id) || [])].sort((a, b) =>
      a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)
    );
    const paidAmount = loanRepayments.reduce((sum, r) => sum + r.amount, 0);
    const remainingAmount = Math.max(0, loan.totalAmount - paidAmount);
    const daysUntilDue = diffCalendarDays(loan.dueDate, today);

    let status: LoanStatus = 'DIPINJAM';
    let dueReminderLevel: DueReminderLevel = 'aman';

    if (remainingAmount <= 0) {
      status = 'LUNAS';
      dueReminderLevel = 'lunas';
    } else if (daysUntilDue < 0) {
      status = 'TERLAMBAT';
      dueReminderLevel = 'terlambat';
    } else {
      status = paidAmount > 0 ? 'DIBAYAR SEBAGIAN' : 'DIPINJAM';
      if (daysUntilDue <= 1) dueReminderLevel = 'h1';
      else if (daysUntilDue <= 3) dueReminderLevel = 'h3';
      else if (daysUntilDue <= 7) dueReminderLevel = 'h7';
      else dueReminderLevel = 'aman';
    }

    return {
      ...loan,
      paidAmount,
      remainingAmount,
      status,
      daysUntilDue,
      dueReminderLevel,
      repayments: loanRepayments,
    };
  });

  let totalUangMasuk = 0;
  let totalUangKeluar = 0;
  for (const tx of db.transactions) {
    if (tx.type === 'masuk') totalUangMasuk += tx.amount;
    else totalUangKeluar += tx.amount;
  }

  const totalPokokDicairkan = db.loans.reduce((sum, l) => sum + l.principalAmount, 0);
  const totalDanaSudahKembali = db.repayments.reduce((sum, r) => sum + r.amount, 0);
  const totalDanaSedangDipinjam = computedLoans
    .filter((l) => l.status !== 'LUNAS')
    .reduce((sum, l) => sum + l.remainingAmount, 0);

  const saldoKasTersedia =
    totalUangMasuk - totalUangKeluar - totalPokokDicairkan + totalDanaSudahKembali;

  const totalSeluruhDana = saldoKasTersedia + totalDanaSedangDipinjam;

  const activeLoans = computedLoans.filter((l) => l.status !== 'LUNAS');
  const overdueLoanCount = activeLoans.filter((l) => l.dueReminderLevel === 'terlambat').length;
  const dueSoonLoanCount = activeLoans.filter((l) =>
    ['h1', 'h3', 'h7'].includes(l.dueReminderLevel)
  ).length;

  const jumlahTransaksiAktif =
    db.transactions.length + activeLoans.length + db.repayments.length;

  const summary: DashboardSummary = {
    totalSeluruhDana,
    saldoKasTersedia,
    totalDanaSedangDipinjam,
    totalDanaSudahKembali,
    totalUangMasuk,
    totalUangKeluar,
    totalPokokDicairkan,
    jumlahTransaksiAktif,
    activeLoanCount: activeLoans.length,
    overdueLoanCount,
    dueSoonLoanCount,
  };

  // Unified chronological ledger
  const loanMap = new Map(db.loans.map((l) => [l.id, l]));
  const ledger: UnifiedLedgerRow[] = [
    ...db.transactions.map((tx) => ({
      id: `tx-${tx.id}`,
      date: tx.date,
      txNumber: tx.txNumber,
      kind: (tx.type === 'masuk' ? 'Uang Masuk' : 'Uang Keluar') as UnifiedLedgerRow['kind'],
      category: tx.category,
      party: tx.partyName || '-',
      description: tx.description || '-',
      debit: tx.type === 'masuk' ? tx.amount : 0,
      credit: tx.type === 'keluar' ? tx.amount : 0,
      paymentMethod: tx.paymentMethod,
      createdAt: tx.createdAt,
    })),
    ...db.loans.map((loan) => ({
      id: `loan-${loan.id}`,
      date: loan.loanDate,
      txNumber: loan.txNumber,
      kind: 'Pencairan Pinjaman' as const,
      category: `Jatuh Tempo ${formatDateID(loan.dueDate)}`,
      party: loan.borrowerName,
      description: loan.description || `Pinjaman ${loan.borrowerName}`,
      debit: 0,
      credit: loan.principalAmount,
      paymentMethod: 'Kas Koperasi',
      createdAt: loan.createdAt,
    })),
    ...db.repayments.map((rep) => {
      const parent = loanMap.get(rep.loanId);
      return {
        id: `rep-${rep.id}`,
        date: rep.date,
        txNumber: rep.txNumber,
        kind: 'Pengembalian Dana' as const,
        category: `Cicilan ${rep.loanTxNumber}`,
        party: parent?.borrowerName || '-',
        description: rep.notes || `Pengembalian pinjaman ${rep.loanTxNumber}`,
        debit: rep.amount,
        credit: 0,
        paymentMethod: rep.paymentMethod,
        createdAt: rep.createdAt,
      };
    }),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  return { computedLoans, summary, ledger };
}

export interface MonthlyChartDatum {
  monthKey: string; // YYYY-MM
  label: string; // Nov 2026
  uangMasuk: number;
  uangKeluar: number;
  danaDipinjam: number;
  pengembalian: number;
  saldoAkhir: number;
}

const MONTH_NAMES_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

export function buildMonthlyChartSeries(db: KoperasiDatabase): MonthlyChartDatum[] {
  const map = new Map<string, MonthlyChartDatum>();

  const ensureMonth = (dateISO: string): MonthlyChartDatum => {
    const key = dateISO.slice(0, 7);
    let existing = map.get(key);
    if (!existing) {
      const [y, m] = key.split('-').map(Number);
      const label = m >= 1 && m <= 12 ? `${MONTH_NAMES_ID[m - 1]} ${y}` : key;
      existing = {
        monthKey: key,
        label,
        uangMasuk: 0,
        uangKeluar: 0,
        danaDipinjam: 0,
        pengembalian: 0,
        saldoAkhir: 0,
      };
      map.set(key, existing);
    }
    return existing;
  };

  for (const tx of db.transactions) {
    const bucket = ensureMonth(tx.date);
    if (tx.type === 'masuk') bucket.uangMasuk += tx.amount;
    else bucket.uangKeluar += tx.amount;
  }

  for (const loan of db.loans) {
    const bucket = ensureMonth(loan.loanDate);
    bucket.danaDipinjam += loan.principalAmount;
  }

  for (const rep of db.repayments) {
    const bucket = ensureMonth(rep.date);
    bucket.pengembalian += rep.amount;
  }

  const sorted = [...map.values()].sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  let runningBalance = 0;
  for (const item of sorted) {
    runningBalance += item.uangMasuk + item.pengembalian - item.uangKeluar - item.danaDipinjam;
    item.saldoAkhir = runningBalance;
  }

  return sorted;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
