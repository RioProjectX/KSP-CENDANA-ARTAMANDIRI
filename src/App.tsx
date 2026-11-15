import { useCallback, useEffect, useMemo, useState } from 'react';
import { testFirebaseConnection } from './firebase';
import { AccountsPinView } from './components/AccountsPinView';
import { AttachmentViewerModal } from './components/AttachmentViewerModal';
import { CashTransactionsView } from './components/CashTransactionsView';
import { DashboardView } from './components/DashboardView';
import { LoansView } from './components/LoansView';
import { LoanApplicationsView } from './components/LoanApplicationsView';
import { RepaymentsView } from './components/RepaymentsView';
import { ReportsBackupView } from './components/ReportsBackupView';
import { Sidebar } from './components/Sidebar';
import { WaveLoadingScreen } from './components/WaveLoadingScreen';
import {
  NotificationBellButton,
  NotificationDrawer,
  NotificationToastBanner,
} from './components/NotificationCenter';
import { useAppNotifications } from './hooks/useAppNotifications';
import {
  createCashTransaction,
  createLoanApplicationRecord,
  createLoanRecord,
  createRepaymentRecord,
  createStaffAccount,
  disburseLoanApplicationRecord,
  removeCashTransaction,
  removeLoanApplicationRecord,
  removeLoanRecord,
  removeRepaymentRecord,
  removeStaffAccount,
  resetKoperasiLedger,
  restoreKoperasiDatabase,
  subscribeKoperasiDatabase,
  updateCashTransaction,
  updateLoanApplicationRecord,
  updateLoanRecord,
  updateStaffAccount,
} from './services/firestoreService';
import {
  ActivePage,
  Attachment,
  CashTransaction,
  KoperasiDatabase,
  Loan,
  LoanApplication,
  Repayment,
  StaffAccount,
  UserRole,
} from './types';
import { computeKoperasiMetrics, formatDateID, todayISO } from './utils/format';

const FALLBACK_OPERATOR: StaffAccount = {
  id: 'admin-utama',
  name: 'Administrator Utama',
  role: 'Admin',
  active: true,
  createdAt: new Date().toISOString(),
};

const ACTIVE_OP_STORAGE_KEY = 'ksp_active_operator_id';

export default function App() {
  const [db, setDb] = useState<KoperasiDatabase>({
    version: 1,
    lastModified: '',
    accounts: [],
    transactions: [],
    loans: [],
    repayments: [],
    loanApplications: [],
  });
  const [dataReady, setDataReady] = useState<boolean>(false);
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [syncError, setSyncError] = useState<string>('');
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>(() => {
    try {
      return localStorage.getItem(ACTIVE_OP_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  const [activePage, setActivePage] = useState<ActivePage>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [notifOpen, setNotifOpen] = useState<boolean>(false);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [preselectedLoanId, setPreselectedLoanId] = useState<string | null>(null);

  useEffect(() => {
    void testFirebaseConnection();
    const unsub = subscribeKoperasiDatabase(
      (nextDb) => {
        setDb(nextDb);
        setDataReady(true);
        setSyncError('');
      },
      (err) => {
        setSyncError(err.message || 'Gagal menyinkronkan data dengan Firebase Firestore.');
        setDataReady(true);
      }
    );
    return () => unsub();
  }, []);

  const currentUser = useMemo<StaffAccount>(() => {
    const activeAccounts = db.accounts.filter((a) => a.active);
    if (selectedOperatorId) {
      const matched = activeAccounts.find((a) => a.id === selectedOperatorId);
      if (matched) return matched;
    }
    const admin = activeAccounts.find((a) => a.role === 'Admin');
    return admin || activeAccounts[0] || FALLBACK_OPERATOR;
  }, [db.accounts, selectedOperatorId]);

  const handleSwitchOperator = useCallback((acc: StaffAccount) => {
    setSelectedOperatorId(acc.id);
    try {
      localStorage.setItem(ACTIVE_OP_STORAGE_KEY, acc.id);
    } catch {
      // ignore storage failure in private mode
    }
  }, []);

  const { computedLoans, summary, ledger } = useMemo(
    () => computeKoperasiMetrics(db),
    [db]
  );

  const notif = useAppNotifications({
    db,
    computedLoans,
    summary,
    dataReady,
    splashActive: showSplash,
  });

  // Firestore CRUD Handlers
  const handleSaveTransaction = async (
    payload: Omit<CashTransaction, 'id' | 'createdAt' | 'updatedAt'>,
    editingId?: string
  ) => {
    if (editingId) {
      const existing = db.transactions.find((t) => t.id === editingId);
      if (!existing) throw new Error('Transaksi tidak ditemukan.');
      await updateCashTransaction(existing, payload);
    } else {
      await createCashTransaction(payload);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    await removeCashTransaction(id);
  };

  const handleSaveLoan = async (
    payload: Omit<Loan, 'id' | 'createdAt' | 'updatedAt'>,
    editingId?: string
  ) => {
    if (editingId) {
      const existing = db.loans.find((l) => l.id === editingId);
      if (!existing) throw new Error('Data pinjaman tidak ditemukan.');
      await updateLoanRecord(existing, payload);
    } else {
      await createLoanRecord(payload);
    }
  };

  const handleDeleteLoan = async (id: string) => {
    await removeLoanRecord(id, db.repayments);
  };

  const handleAddRepayment = async (payload: Omit<Repayment, 'id' | 'createdAt'>) => {
    const loan = db.loans.find((l) => l.id === payload.loanId);
    if (!loan) throw new Error('Nomor pinjaman tidak ditemukan.');
    const paidSoFar = db.repayments
      .filter((r) => r.loanId === loan.id)
      .reduce((sum, r) => sum + r.amount, 0);
    const remaining = Math.max(0, loan.totalAmount - paidSoFar);
    if (payload.amount > remaining) {
      throw new Error(`Nominal pembayaran melebihi sisa tagihan (${remaining}).`);
    }
    await createRepaymentRecord({
      ...payload,
      loanTxNumber: loan.txNumber,
    });
  };

  const handleDeleteRepayment = async (id: string) => {
    await removeRepaymentRecord(id);
  };

  const handleCreateApplication = async (
    payload: Omit<LoanApplication, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    await createLoanApplicationRecord(payload);
  };

  const handleUpdateApplication = async (
    existing: LoanApplication,
    payload: Omit<LoanApplication, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    await updateLoanApplicationRecord(existing, payload);
  };

  const handleDeleteApplication = async (id: string) => {
    await removeLoanApplicationRecord(id);
  };

  const handleDisburseApplication = async (
    application: LoanApplication,
    loanPayload: Omit<Loan, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    await disburseLoanApplicationRecord(application, loanPayload);
  };

  const handleFetchBackup = async (): Promise<KoperasiDatabase> => {
    return {
      ...db,
      lastModified: new Date().toISOString(),
    };
  };

  const handleRestoreBackup = async (backupData: KoperasiDatabase) => {
    await restoreKoperasiDatabase(backupData);
  };

  const handleResetLedger = async () => {
    await resetKoperasiLedger();
  };

  const handleCreateAccount = async (payload: {
    name: string;
    role: UserRole;
    active: boolean;
  }) => {
    await createStaffAccount(payload);
  };

  const handleUpdateAccount = async (
    id: string,
    payload: { name?: string; role?: UserRole; active?: boolean }
  ) => {
    const current = db.accounts.find((a) => a.id === id);
    if (!current) throw new Error('Akun tidak ditemukan.');

    const nextRole = payload.role ?? current.role;
    const nextActive = payload.active ?? current.active;
    const otherActiveAdmin = db.accounts.some(
      (a) => a.id !== id && a.active && a.role === 'Admin'
    );
    if (!otherActiveAdmin && (nextRole !== 'Admin' || !nextActive)) {
      throw new Error('Minimal harus ada 1 akun Admin yang aktif.');
    }

    await updateStaffAccount(current, payload);
  };

  const handleDeleteAccount = async (id: string) => {
    const remainingAdmins = db.accounts.filter(
      (a) => a.id !== id && a.active && a.role === 'Admin'
    );
    if (remainingAdmins.length === 0) {
      throw new Error('Tidak dapat menghapus akun Admin terakhir.');
    }
    await removeStaffAccount(id);
  };

  const handleGoToRepayment = (loanId: string) => {
    setPreselectedLoanId(loanId);
    setActivePage('pengembalian');
  };

  const dueAlertCount = summary.overdueLoanCount + summary.dueSoonLoanCount;
  const pendingVisitCount = (db.loanApplications || []).filter(
    (a) => a.status === 'MENUNGGU_VISIT' || a.status === 'MENUNGGU_FINALISASI'
  ).length;

  return (
    <div className="min-h-screen bg-[#F6F8F6] text-[#0F1F17] flex flex-col lg:flex-row">
      {showSplash && (
        <WaveLoadingScreen
          dataReady={dataReady}
          onFinished={() => setShowSplash(false)}
        />
      )}

      <Sidebar
        activePage={activePage}
        onNavigate={(page) => {
          if (page !== 'pengembalian') setPreselectedLoanId(null);
          setActivePage(page);
        }}
        currentUser={currentUser}
        mobileOpen={mobileMenuOpen}
        onSetMobileOpen={setMobileMenuOpen}
        dueAlertCount={dueAlertCount}
        pendingVisitCount={pendingVisitCount}
        unreadNotifCount={notif.unreadCount}
        urgentNotifCount={notif.urgentUnreadCount}
        onOpenNotifications={() => setNotifOpen(true)}
      />

      <main className="flex-1 min-w-0">
        {/* Desktop Top Utility Bar */}
        <div className="no-print hidden lg:flex items-center justify-between border-b border-[#E5ECE7] bg-white/80 px-8 py-2.5 backdrop-blur-xs">
          <p className="text-xs font-medium text-[#5C6E63]">
            Tanggal Pembukuan:{' '}
            <span className="font-mono font-semibold text-[#0F1F17]">
              {formatDateID(todayISO())}
            </span>
          </p>
          <div className="flex items-center gap-2.5">
            {notif.permission === 'default' && (
              <button
                type="button"
                onClick={() => void notif.requestDevicePermission()}
                className="flex h-9 items-center rounded-lg border border-[#C59B27]/50 bg-[#FEF9E7] px-3 text-xs font-semibold text-[#7D5D0F] hover:bg-[#FDF3CC] transition-colors"
              >
                Aktifkan Notifikasi Perangkat
              </button>
            )}
            <NotificationBellButton
              variant="light"
              unreadCount={notif.unreadCount}
              urgentCount={notif.urgentUnreadCount}
              onClick={() => setNotifOpen(true)}
            />
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1360px] px-4 py-6 sm:px-6 lg:px-8">
          {syncError && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"
            >
              {syncError}
            </div>
          )}

          {!dataReady ? (
            <div className="rounded-xl border border-[#DCE4DE] bg-white p-10 text-center text-sm text-[#5C6E63]">
              Menghubungkan data Koperasi Simpan Pinjam Artha Mandiri...
            </div>
          ) : (
            <>
              {activePage === 'dashboard' && (
                <DashboardView
                  db={db}
                  summary={summary}
                  computedLoans={computedLoans}
                  onNavigate={setActivePage}
                />
              )}

              {activePage === 'uang-masuk' && (
                <CashTransactionsView
                  mode="masuk"
                  transactions={db.transactions}
                  currentCashBalance={summary.saldoKasTersedia}
                  currentUserName={currentUser.name}
                  onSaveTransaction={handleSaveTransaction}
                  onDeleteTransaction={handleDeleteTransaction}
                  onPreviewAttachment={setPreviewAttachment}
                />
              )}

              {activePage === 'uang-keluar' && (
                <CashTransactionsView
                  mode="keluar"
                  transactions={db.transactions}
                  currentCashBalance={summary.saldoKasTersedia}
                  currentUserName={currentUser.name}
                  onSaveTransaction={handleSaveTransaction}
                  onDeleteTransaction={handleDeleteTransaction}
                  onPreviewAttachment={setPreviewAttachment}
                />
              )}

              {activePage === 'calon-nasabah' && (
                <LoanApplicationsView
                  applications={db.loanApplications || []}
                  existingLoanNumbers={db.loans.map((l) => l.txNumber)}
                  currentCashBalance={summary.saldoKasTersedia}
                  currentUserName={currentUser.name}
                  onCreateApplication={handleCreateApplication}
                  onUpdateApplication={handleUpdateApplication}
                  onDeleteApplication={handleDeleteApplication}
                  onDisburseApplication={handleDisburseApplication}
                  onPreviewAttachment={setPreviewAttachment}
                  onGoToLoans={() => setActivePage('pinjaman')}
                />
              )}

              {activePage === 'pinjaman' && (
                <LoansView
                  loans={computedLoans}
                  currentCashBalance={summary.saldoKasTersedia}
                  currentUserName={currentUser.name}
                  onSaveLoan={handleSaveLoan}
                  onDeleteLoan={handleDeleteLoan}
                  onPreviewAttachment={setPreviewAttachment}
                  onGoToRepayment={handleGoToRepayment}
                />
              )}

              {activePage === 'pengembalian' && (
                <RepaymentsView
                  loans={computedLoans}
                  repayments={db.repayments}
                  preselectedLoanId={preselectedLoanId}
                  currentUserName={currentUser.name}
                  onAddRepayment={handleAddRepayment}
                  onDeleteRepayment={handleDeleteRepayment}
                  onPreviewAttachment={setPreviewAttachment}
                />
              )}

              {activePage === 'laporan' && (
                <ReportsBackupView
                  db={db}
                  ledger={ledger}
                  summary={summary}
                  currentUserName={currentUser.name}
                  currentUserRole={currentUser.role}
                  onFetchBackup={handleFetchBackup}
                  onRestoreBackup={handleRestoreBackup}
                  onResetLedger={handleResetLedger}
                />
              )}

              {activePage === 'akun' && (
                <AccountsPinView
                  currentUser={currentUser}
                  accounts={db.accounts}
                  onSwitchOperator={handleSwitchOperator}
                  onCreateAccount={handleCreateAccount}
                  onUpdateAccount={handleUpdateAccount}
                  onDeleteAccount={handleDeleteAccount}
                />
              )}
            </>
          )}
        </div>
      </main>

      <AttachmentViewerModal
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />

      <NotificationDrawer
        open={notifOpen}
        notifications={notif.notifications}
        readSet={notif.unreadIds}
        unreadCount={notif.unreadCount}
        permission={notif.permission}
        deviceEnabled={notif.deviceEnabled}
        onClose={() => setNotifOpen(false)}
        onSelectNotification={(item) => {
          notif.markAsRead(item.id);
          setNotifOpen(false);
          if (item.targetPage === 'pengembalian' && item.targetLoanId) {
            setPreselectedLoanId(item.targetLoanId);
          } else {
            setPreselectedLoanId(null);
          }
          setActivePage(item.targetPage);
        }}
        onMarkAsRead={notif.markAsRead}
        onMarkAllAsRead={notif.markAllAsRead}
        onRequestPermission={notif.requestDevicePermission}
        onToggleDeviceEnabled={notif.toggleDeviceEnabled}
        onSendTestNow={notif.sendTestOrDigestNow}
      />

      <NotificationToastBanner
        visible={notif.showFloatingToast && !notifOpen}
        urgentCount={notif.urgentUnreadCount}
        totalUnread={notif.unreadCount}
        onOpenDrawer={() => {
          notif.dismissFloatingToast();
          setNotifOpen(true);
        }}
        onDismiss={notif.dismissFloatingToast}
      />
    </div>
  );
}
