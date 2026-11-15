export type UserRole = 'Admin' | 'Staf';

export interface StaffAccount {
  id: string;
  name: string;
  role: UserRole;
  pin?: string;
  active: boolean;
  createdAt: string;
}

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
}

export type CashTransactionType = 'masuk' | 'keluar';

export type PaymentMethod = 'Tunai' | 'Transfer Bank';

export interface CashTransaction {
  id: string;
  txNumber: string;
  type: CashTransactionType;
  date: string; // YYYY-MM-DD
  category: string;
  amount: number;
  partyName: string;
  paymentMethod: PaymentMethod;
  description: string;
  attachment?: Attachment;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Loan {
  id: string;
  txNumber: string;
  borrowerName: string;
  memberId: string;
  phone: string;
  loanDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  principalAmount: number;
  adminFee?: number;
  interestAmount: number;
  totalAmount: number;
  description: string;
  attachment?: Attachment;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type RepaymentKind = 'cicilan' | 'perpanjangan';

export interface Repayment {
  id: string;
  txNumber: string;
  loanId: string;
  loanTxNumber: string;
  date: string; // YYYY-MM-DD
  amount: number;
  repaymentType?: RepaymentKind;
  penaltyAmount?: number;
  paymentMethod: PaymentMethod;
  notes: string;
  attachment?: Attachment;
  createdBy: string;
  createdAt: string;
}

export type LoanApplicationStatus =
  | 'MENUNGGU_VISIT'
  | 'MENUNGGU_FINALISASI'
  | 'LOLOS'
  | 'TIDAK_LOLOS';

export interface LoanApplication {
  id: string;
  applicationNumber: string;
  applicantName: string;
  nik: string;
  phone: string;
  address: string;
  occupation: string;
  requestDate: string; // YYYY-MM-DD
  visitDate: string; // YYYY-MM-DD or ''
  requestedAmount: number;
  collateralNotes: string;
  visitSurveyNotes: string;
  visitChecked: boolean;
  status: LoanApplicationStatus;
  surveyorName: string;
  disbursedLoanId?: string;
  attachment?: Attachment;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface KoperasiDatabase {
  version: number;
  lastModified: string;
  accounts: StaffAccount[];
  transactions: CashTransaction[];
  loans: Loan[];
  repayments: Repayment[];
  loanApplications?: LoanApplication[];
}

export type LoanStatus = 'DIPINJAM' | 'DIBAYAR SEBAGIAN' | 'LUNAS' | 'TERLAMBAT';

export type DueReminderLevel = 'terlambat' | 'h1' | 'h3' | 'h7' | 'aman' | 'lunas';

export interface ComputedLoan extends Loan {
  paidAmount: number;
  remainingAmount: number;
  status: LoanStatus;
  daysUntilDue: number;
  daysLate: number;
  dailyPenaltyRate: number;
  accruedPenalty: number;
  totalPenaltyPaid: number;
  dueReminderLevel: DueReminderLevel;
  repayments: Repayment[];
}

export interface DashboardSummary {
  totalSeluruhDana: number;
  saldoKasTersedia: number;
  totalDanaSedangDipinjam: number;
  totalDanaSudahKembali: number;
  totalUangMasuk: number;
  totalUangKeluar: number;
  totalPokokDicairkan: number;
  jumlahTransaksiAktif: number;
  activeLoanCount: number;
  overdueLoanCount: number;
  dueSoonLoanCount: number;
}

export interface UnifiedLedgerRow {
  id: string;
  date: string;
  txNumber: string;
  kind: 'Uang Masuk' | 'Uang Keluar' | 'Pencairan Pinjaman' | 'Pengembalian Dana';
  category: string;
  party: string;
  description: string;
  debit: number; // Kas bertambah
  credit: number; // Kas berkurang
  paymentMethod: string;
  createdAt: string;
}

export type ActivePage =
  | 'dashboard'
  | 'uang-masuk'
  | 'uang-keluar'
  | 'calon-nasabah'
  | 'pinjaman'
  | 'pengembalian'
  | 'laporan'
  | 'akun';
