import { useCallback, useEffect, useMemo, useState } from 'react';
import { testFirebaseConnection } from './firebase';
import { AccountsPinView } from './components/AccountsPinView';
import { AttachmentViewerModal } from './components/AttachmentViewerModal';
import { CashTransactionsView } from './components/CashTransactionsView';
import { DashboardView } from './components/DashboardView';
import { LoansView } from './components/LoansView';
import { PinLoginScreen } from './components/PinLoginScreen';
import { RepaymentsView } from './components/RepaymentsView';
import { ReportsBackupView } from './components/ReportsBackupView';
import { Sidebar } from './components/Sidebar';
import {
  ActivePage,
  Attachment,
  CashTransaction,
  KoperasiDatabase,
  Loan,
  Repayment,
  StaffAccount,
  UserRole,
} from './types';
import { computeKoperasiMetrics } from './utils/format';

interface PublicStateResponse extends KoperasiDatabase {
  hasDefaultPin?: boolean;
}

export default function App() {
  const [loginAccounts, setLoginAccounts] = useState<
    Pick<StaffAccount, 'id' | 'name' | 'role'>[]
  >([]);
  const [hasDefaultPin, setHasDefaultPin] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<StaffAccount | null>(null);
  const [authToken, setAuthToken] = useState<string>('');

  const [db, setDb] = useState<KoperasiDatabase>({
    version: 1,
    lastModified: '',
    accounts: [],
    transactions: [],
    loans: [],
    repayments: [],
  });
  const [loadingState, setLoadingState] = useState<boolean>(false);
  const [activePage, setActivePage] = useState<ActivePage>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [preselectedLoanId, setPreselectedLoanId] = useState<string | null>(null);

  const fetchAuthAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/accounts');
      if (!res.ok) return;
      const data = (await res.json()) as {
        accounts: Pick<StaffAccount, 'id' | 'name' | 'role'>[];
        hasDefaultPin: boolean;
      };
      setLoginAccounts(data.accounts || []);
      setHasDefaultPin(Boolean(data.hasDefaultPin));
    } catch {
      // ignore transient network errors on boot
    }
  }, []);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    setAuthToken('');
    setMobileMenuOpen(false);
    setPreselectedLoanId(null);
    void fetchAuthAccounts();
  }, [fetchAuthAccounts]);

  const fetchState = useCallback(
    async (token: string) => {
      if (!token) return;
      setLoadingState(true);
      try {
        const res = await fetch('/api/state', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          handleLogout();
          return;
        }
        if (!res.ok) throw new Error('Gagal memuat data koperasi.');
        const data = (await res.json()) as PublicStateResponse;
        setDb({
          version: data.version,
          lastModified: data.lastModified,
          accounts: data.accounts,
          transactions: data.transactions,
          loans: data.loans,
          repayments: data.repayments,
        });
        if (typeof data.hasDefaultPin === 'boolean') {
          setHasDefaultPin(data.hasDefaultPin);
        }
      } finally {
        setLoadingState(false);
      }
    },
    [handleLogout]
  );

  useEffect(() => {
    void testFirebaseConnection();
    void fetchAuthAccounts();
  }, [fetchAuthAccounts]);

  const handleLoginSuccess = (user: StaffAccount, token: string) => {
    setCurrentUser(user);
    setAuthToken(token);
    setActivePage('dashboard');
    void fetchState(token);
  };

  const applyServerState = (state: PublicStateResponse) => {
    setDb({
      version: state.version,
      lastModified: state.lastModified,
      accounts: state.accounts,
      transactions: state.transactions,
      loans: state.loans,
      repayments: state.repayments,
    });
    if (typeof state.hasDefaultPin === 'boolean') {
      setHasDefaultPin(state.hasDefaultPin);
    }
  };

  const apiMutate = async (url: string, method: string, body?: unknown) => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${authToken}`,
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const rawText = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      throw new Error(`Respons server tidak valid (HTTP ${res.status}).`);
    }
    if (res.status === 401) {
      handleLogout();
      throw new Error((data.error as string) || 'Sesi berakhir. Silakan masuk ulang.');
    }
    if (!res.ok) {
      throw new Error((data.error as string) || 'Terjadi kesalahan pada server.');
    }
    if (data.state) {
      applyServerState(data.state as PublicStateResponse);
    }
    return data;
  };

  const handleFetchBackup = async (): Promise<KoperasiDatabase> => {
    const res = await fetch('/api/backup', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.status === 401) {
      handleLogout();
      throw new Error('Sesi berakhir. Silakan login ulang.');
    }
    if (!res.ok) {
      throw new Error('Gagal mengambil data backup dari server.');
    }
    return (await res.json()) as KoperasiDatabase;
  };

  // Computed real-time financial metrics
  const { computedLoans, summary, ledger } = useMemo(
    () => computeKoperasiMetrics(db),
    [db]
  );

  // Handlers
  const handleSaveTransaction = async (
    payload: Omit<CashTransaction, 'id' | 'createdAt' | 'updatedAt'>,
    editingId?: string
  ) => {
    if (editingId) {
      await apiMutate(`/api/transactions/${editingId}`, 'PUT', payload);
    } else {
      await apiMutate('/api/transactions', 'POST', payload);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    await apiMutate(`/api/transactions/${id}`, 'DELETE');
  };

  const handleSaveLoan = async (
    payload: Omit<Loan, 'id' | 'createdAt' | 'updatedAt'>,
    editingId?: string
  ) => {
    if (editingId) {
      await apiMutate(`/api/loans/${editingId}`, 'PUT', payload);
    } else {
      await apiMutate('/api/loans', 'POST', payload);
    }
  };

  const handleDeleteLoan = async (id: string) => {
    await apiMutate(`/api/loans/${id}`, 'DELETE');
  };

  const handleAddRepayment = async (payload: Omit<Repayment, 'id' | 'createdAt'>) => {
    await apiMutate('/api/repayments', 'POST', payload);
  };

  const handleDeleteRepayment = async (id: string) => {
    await apiMutate(`/api/repayments/${id}`, 'DELETE');
  };

  const handleRestoreBackup = async (backupData: KoperasiDatabase) => {
    await apiMutate('/api/restore', 'POST', backupData);
  };

  const handleResetLedger = async (pin: string, accountId: string) => {
    await apiMutate('/api/reset', 'POST', { pin, accountId });
  };

  const handleChangeOwnPin = async (oldPin: string, newPin: string) => {
    if (!currentUser) return;
    await apiMutate('/api/auth/change-pin', 'POST', {
      accountId: currentUser.id,
      oldPin,
      newPin,
    });
  };

  const handleCreateAccount = async (payload: {
    name: string;
    role: UserRole;
    pin: string;
    active: boolean;
  }) => {
    await apiMutate('/api/accounts', 'POST', payload);
  };

  const handleUpdateAccount = async (
    id: string,
    payload: { name?: string; role?: UserRole; pin?: string; active?: boolean }
  ) => {
    await apiMutate(`/api/accounts/${id}`, 'PUT', payload);
    if (currentUser && currentUser.id === id) {
      setCurrentUser((prev) =>
        prev
          ? {
              ...prev,
              name: payload.name ?? prev.name,
              role: payload.role ?? prev.role,
              active: payload.active ?? prev.active,
            }
          : null
      );
    }
  };

  const handleDeleteAccount = async (id: string) => {
    await apiMutate(`/api/accounts/${id}`, 'DELETE');
  };

  const handleGoToRepayment = (loanId: string) => {
    setPreselectedLoanId(loanId);
    setActivePage('pengembalian');
  };

  if (!currentUser || !authToken) {
    return (
      <PinLoginScreen
        accounts={loginAccounts}
        hasDefaultPin={hasDefaultPin}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  const dueAlertCount = summary.overdueLoanCount + summary.dueSoonLoanCount;

  return (
    <div className="min-h-screen bg-[#F6F8F6] text-[#0F1F17] flex flex-col lg:flex-row">
      <Sidebar
        activePage={activePage}
        onNavigate={(page) => {
          if (page !== 'pengembalian') setPreselectedLoanId(null);
          setActivePage(page);
        }}
        currentUser={currentUser}
        onLogout={handleLogout}
        mobileOpen={mobileMenuOpen}
        onSetMobileOpen={setMobileMenuOpen}
        dueAlertCount={dueAlertCount}
      />

      <main className="flex-1 min-w-0">
        <div className="mx-auto w-full max-w-[1360px] px-4 py-6 sm:px-6 lg:px-8">
          {loadingState && db.lastModified === '' ? (
            <div className="rounded-xl border border-[#DCE4DE] bg-white p-10 text-center text-sm text-[#5C6E63]">
              Memuat data keuangan KSP Cendana Artha Mandiri...
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
                  currentUserId={currentUser.id}
                  onFetchBackup={handleFetchBackup}
                  onRestoreBackup={handleRestoreBackup}
                  onResetLedger={handleResetLedger}
                />
              )}

              {activePage === 'akun' && (
                <AccountsPinView
                  currentUser={currentUser}
                  accounts={db.accounts}
                  onChangeOwnPin={handleChangeOwnPin}
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
    </div>
  );
}
