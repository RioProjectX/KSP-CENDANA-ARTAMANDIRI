import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { firestoreDb, handleFirestoreError, OperationType } from '../firebase';
import type {
  CashTransaction,
  KoperasiDatabase,
  Loan,
  LoanApplication,
  Repayment,
  StaffAccount,
} from '../types';

const WORKSPACE_ID = 'ksp-cendana-artha-mandiri-prod-v1';

type CollectionName =
  | 'accounts'
  | 'transactions'
  | 'loans'
  | 'repayments'
  | 'loanApplications';

function colPath(name: CollectionName): string {
  return `koperasi/${WORKSPACE_ID}/${name}`;
}

function colRef(name: CollectionName) {
  return collection(firestoreDb, 'koperasi', WORKSPACE_ID, name);
}

function docRef(name: CollectionName, id: string) {
  return doc(firestoreDb, 'koperasi', WORKSPACE_ID, name, id);
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      clean[k] = v;
    }
  }
  return clean as T;
}

function createDefaultAdmin(): StaffAccount {
  return {
    id: 'admin-utama',
    name: 'Administrator Utama',
    role: 'Admin',
    pin: '0000',
    active: true,
    createdAt: new Date().toISOString(),
  };
}

export async function ensureDefaultAccount(): Promise<void> {
  const path = colPath('accounts');
  try {
    const snap = await getDocs(colRef('accounts'));
    if (snap.empty) {
      const admin = createDefaultAdmin();
      await setDoc(docRef('accounts', admin.id), stripUndefined({ ...admin }));
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export function subscribeKoperasiDatabase(
  onData: (db: KoperasiDatabase) => void,
  onError: (err: Error) => void
): () => void {
  const state: {
    accounts: StaffAccount[];
    transactions: CashTransaction[];
    loans: Loan[];
    repayments: Repayment[];
    loanApplications: LoanApplication[];
    loaded: Record<CollectionName, boolean>;
  } = {
    accounts: [],
    transactions: [],
    loans: [],
    repayments: [],
    loanApplications: [],
    loaded: {
      accounts: false,
      transactions: false,
      loans: false,
      repayments: false,
      loanApplications: false,
    },
  };

  let bootstrapped = false;

  const emitIfReady = () => {
    if (
      state.loaded.accounts &&
      state.loaded.transactions &&
      state.loaded.loans &&
      state.loaded.repayments &&
      state.loaded.loanApplications
    ) {
      onData({
        version: 1,
        lastModified: new Date().toISOString(),
        accounts: state.accounts,
        transactions: state.transactions,
        loans: state.loans,
        repayments: state.repayments,
        loanApplications: state.loanApplications,
      });
    }
  };

  const unsubAccounts = onSnapshot(
    colRef('accounts'),
    (snap) => {
      const list = snap.docs
        .map((d) => d.data() as StaffAccount)
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

      if (list.length === 0 && !bootstrapped) {
        bootstrapped = true;
        const admin = createDefaultAdmin();
        void setDoc(docRef('accounts', admin.id), stripUndefined({ ...admin })).catch((e) =>
          onError(e instanceof Error ? e : new Error(String(e)))
        );
        state.accounts = [admin];
      } else {
        state.accounts = list;
      }
      state.loaded.accounts = true;
      emitIfReady();
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, colPath('accounts'));
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  const unsubTransactions = onSnapshot(
    colRef('transactions'),
    (snap) => {
      state.transactions = snap.docs
        .map((d) => d.data() as CashTransaction)
        .sort(
          (a, b) =>
            (a.date || '').localeCompare(b.date || '') ||
            (a.createdAt || '').localeCompare(b.createdAt || '')
        );
      state.loaded.transactions = true;
      emitIfReady();
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, colPath('transactions'));
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  const unsubLoans = onSnapshot(
    colRef('loans'),
    (snap) => {
      state.loans = snap.docs
        .map((d) => d.data() as Loan)
        .sort(
          (a, b) =>
            (a.loanDate || '').localeCompare(b.loanDate || '') ||
            (a.createdAt || '').localeCompare(b.createdAt || '')
        );
      state.loaded.loans = true;
      emitIfReady();
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, colPath('loans'));
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  const unsubRepayments = onSnapshot(
    colRef('repayments'),
    (snap) => {
      state.repayments = snap.docs
        .map((d) => d.data() as Repayment)
        .sort(
          (a, b) =>
            (a.date || '').localeCompare(b.date || '') ||
            (a.createdAt || '').localeCompare(b.createdAt || '')
        );
      state.loaded.repayments = true;
      emitIfReady();
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, colPath('repayments'));
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  const unsubLoanApplications = onSnapshot(
    colRef('loanApplications'),
    (snap) => {
      state.loanApplications = snap.docs
        .map((d) => d.data() as LoanApplication)
        .sort(
          (a, b) =>
            (b.requestDate || '').localeCompare(a.requestDate || '') ||
            (b.createdAt || '').localeCompare(a.createdAt || '')
        );
      state.loaded.loanApplications = true;
      emitIfReady();
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, colPath('loanApplications'));
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  return () => {
    unsubAccounts();
    unsubTransactions();
    unsubLoans();
    unsubRepayments();
    unsubLoanApplications();
  };
}

// ============================================================================
// Cash Transactions
// ============================================================================
export async function createCashTransaction(
  payload: Omit<CashTransaction, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const now = new Date().toISOString();
  const id = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const clean = stripUndefined({
    ...payload,
    id,
    amount: Math.round(payload.amount),
    description: payload.description || '',
    createdAt: now,
    updatedAt: now,
  });
  try {
    await setDoc(docRef('transactions', id), clean);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${colPath('transactions')}/${id}`);
  }
}

export async function updateCashTransaction(
  existing: CashTransaction,
  patch: Omit<CashTransaction, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const next = stripUndefined({
    ...patch,
    id: existing.id,
    createdBy: existing.createdBy,
    createdAt: existing.createdAt,
    amount: Math.round(patch.amount),
    description: patch.description || '',
    updatedAt: new Date().toISOString(),
  });
  try {
    await setDoc(docRef('transactions', existing.id), next);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${colPath('transactions')}/${existing.id}`);
  }
}

export async function removeCashTransaction(id: string): Promise<void> {
  try {
    await deleteDoc(docRef('transactions', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${colPath('transactions')}/${id}`);
  }
}

// ============================================================================
// Loans
// ============================================================================
export async function createLoanRecord(
  payload: Omit<Loan, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const now = new Date().toISOString();
  const id = `loan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const principalAmount = Math.round(payload.principalAmount);
  const adminFee = Math.min(principalAmount, Math.max(0, Math.round(payload.adminFee ?? 0)));
  const clean = stripUndefined({
    ...payload,
    id,
    memberId: payload.memberId || '',
    phone: payload.phone || '',
    principalAmount,
    adminFee,
    interestAmount: Math.round(payload.interestAmount || 0),
    totalAmount: Math.round(payload.totalAmount),
    description: payload.description || '',
    createdAt: now,
    updatedAt: now,
  });
  try {
    await setDoc(docRef('loans', id), clean);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${colPath('loans')}/${id}`);
  }
}

export async function updateLoanRecord(
  existing: Loan,
  patch: Omit<Loan, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const principalAmount = Math.round(patch.principalAmount);
  const adminFee = Math.min(principalAmount, Math.max(0, Math.round(patch.adminFee ?? 0)));
  const next = stripUndefined({
    ...patch,
    id: existing.id,
    createdBy: existing.createdBy,
    createdAt: existing.createdAt,
    memberId: patch.memberId || '',
    phone: patch.phone || '',
    principalAmount,
    adminFee,
    interestAmount: Math.round(patch.interestAmount || 0),
    totalAmount: Math.round(patch.totalAmount),
    description: patch.description || '',
    updatedAt: new Date().toISOString(),
  });
  try {
    await setDoc(docRef('loans', existing.id), next);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${colPath('loans')}/${existing.id}`);
  }
}

export async function removeLoanRecord(id: string, allRepayments: Repayment[]): Promise<void> {
  try {
    const childReps = allRepayments.filter((r) => r.loanId === id);
    for (const rep of childReps) {
      await deleteDoc(docRef('repayments', rep.id));
    }
    await deleteDoc(docRef('loans', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${colPath('loans')}/${id}`);
  }
}

// ============================================================================
// Repayments
// ============================================================================
export async function createRepaymentRecord(
  payload: Omit<Repayment, 'id' | 'createdAt'>
): Promise<void> {
  const id = `rep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const clean = stripUndefined({
    ...payload,
    id,
    amount: Math.round(payload.amount),
    notes: payload.notes || '',
    createdAt: new Date().toISOString(),
  });
  try {
    await setDoc(docRef('repayments', id), clean);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${colPath('repayments')}/${id}`);
  }
}

export async function removeRepaymentRecord(id: string): Promise<void> {
  try {
    await deleteDoc(docRef('repayments', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${colPath('repayments')}/${id}`);
  }
}

// ============================================================================
// Loan Applications (Calon Nasabah / Antrean Visit Lapangan & Finalisasi)
// ============================================================================
function sanitizeLoanApplicationFields(
  payload: Omit<LoanApplication, 'id' | 'createdAt' | 'updatedAt'>
) {
  const visitDateClean =
    payload.visitDate && payload.visitDate.trim().length === 10
      ? payload.visitDate.trim().slice(0, 10)
      : '';
  return {
    applicationNumber: payload.applicationNumber.trim().slice(0, 64),
    applicantName: payload.applicantName.trim().slice(0, 160),
    nik: (payload.nik || '').trim().slice(0, 64),
    phone: (payload.phone || '').trim().slice(0, 40),
    address: payload.address.trim().slice(0, 500),
    occupation: (payload.occupation || '').trim().slice(0, 160),
    requestDate: payload.requestDate.trim().slice(0, 10),
    visitDate: visitDateClean,
    requestedAmount: Math.max(1, Math.round(payload.requestedAmount)),
    collateralNotes: (payload.collateralNotes || '').trim().slice(0, 1000),
    visitSurveyNotes: (payload.visitSurveyNotes || '').trim().slice(0, 1000),
    visitChecked: Boolean(payload.visitChecked),
    status: payload.status,
    surveyorName: (payload.surveyorName || '').trim().slice(0, 120),
    disbursedLoanId: payload.disbursedLoanId ? payload.disbursedLoanId : undefined,
    attachment: payload.attachment,
    createdBy: payload.createdBy.trim().slice(0, 120),
  };
}

export async function createLoanApplicationRecord(
  payload: Omit<LoanApplication, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const now = new Date().toISOString();
  const id = `app-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const clean = stripUndefined({
    ...sanitizeLoanApplicationFields(payload),
    id,
    createdAt: now,
    updatedAt: now,
  });
  try {
    await setDoc(docRef('loanApplications', id), clean);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${colPath('loanApplications')}/${id}`);
  }
}

export async function updateLoanApplicationRecord(
  existing: LoanApplication,
  patch: Omit<LoanApplication, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const next = stripUndefined({
    ...sanitizeLoanApplicationFields(patch),
    id: existing.id,
    createdBy: existing.createdBy,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  });
  try {
    await setDoc(docRef('loanApplications', existing.id), next);
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.UPDATE,
      `${colPath('loanApplications')}/${existing.id}`
    );
  }
}

export async function removeLoanApplicationRecord(id: string): Promise<void> {
  try {
    await deleteDoc(docRef('loanApplications', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${colPath('loanApplications')}/${id}`);
  }
}

export async function disburseLoanApplicationRecord(
  application: LoanApplication,
  loanPayload: Omit<Loan, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const now = new Date().toISOString();
  const loanId = `loan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const principalAmount = Math.round(loanPayload.principalAmount);
  const adminFee = Math.min(principalAmount, Math.max(0, Math.round(loanPayload.adminFee ?? 0)));

  const cleanLoan = stripUndefined({
    ...loanPayload,
    id: loanId,
    memberId: loanPayload.memberId || '',
    phone: loanPayload.phone || '',
    principalAmount,
    adminFee,
    interestAmount: Math.round(loanPayload.interestAmount || 0),
    totalAmount: Math.round(loanPayload.totalAmount),
    description: loanPayload.description || '',
    createdAt: now,
    updatedAt: now,
  });

  const cleanApplication = stripUndefined({
    ...sanitizeLoanApplicationFields({
      ...application,
      visitChecked: true,
      status: 'LOLOS',
      disbursedLoanId: loanId,
    }),
    id: application.id,
    createdBy: application.createdBy,
    createdAt: application.createdAt,
    updatedAt: now,
  });

  try {
    const batch = writeBatch(firestoreDb);
    batch.set(docRef('loans', loanId), cleanLoan);
    batch.set(docRef('loanApplications', application.id), cleanApplication);
    await batch.commit();
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.WRITE,
      `${colPath('loanApplications')}/${application.id}`
    );
  }
}

// ============================================================================
// Staff & Admin Profiles (No PIN Gate)
// ============================================================================
export async function createStaffAccount(payload: {
  name: string;
  role: 'Admin' | 'Staf';
  active: boolean;
}): Promise<StaffAccount> {
  const id = `acc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const account: StaffAccount = {
    id,
    name: payload.name.trim(),
    role: payload.role === 'Admin' ? 'Admin' : 'Staf',
    pin: '0000',
    active: payload.active !== false,
    createdAt: new Date().toISOString(),
  };
  try {
    await setDoc(docRef('accounts', id), stripUndefined({ ...account }));
    return account;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${colPath('accounts')}/${id}`);
  }
}

export async function updateStaffAccount(
  existing: StaffAccount,
  patch: { name?: string; role?: 'Admin' | 'Staf'; active?: boolean }
): Promise<void> {
  const next: StaffAccount = {
    id: existing.id,
    name: patch.name?.trim() ? patch.name.trim() : existing.name,
    role: patch.role ?? existing.role,
    pin: existing.pin && existing.pin.length >= 4 ? existing.pin : '0000',
    active: patch.active ?? existing.active,
    createdAt: existing.createdAt,
  };
  try {
    await setDoc(docRef('accounts', existing.id), stripUndefined({ ...next }));
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${colPath('accounts')}/${existing.id}`);
  }
}

export async function removeStaffAccount(id: string): Promise<void> {
  try {
    await deleteDoc(docRef('accounts', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${colPath('accounts')}/${id}`);
  }
}

// ============================================================================
// Backup, Restore & Reset
// ============================================================================
async function deleteAllInCollection(name: CollectionName): Promise<void> {
  const snap = await getDocs(colRef(name));
  if (snap.empty) return;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = writeBatch(firestoreDb);
    for (const d of docs.slice(i, i + 400)) {
      batch.delete(d.ref);
    }
    await batch.commit();
  }
}

export async function restoreKoperasiDatabase(data: KoperasiDatabase): Promise<void> {
  try {
    await deleteAllInCollection('repayments');
    await deleteAllInCollection('loans');
    await deleteAllInCollection('transactions');
    await deleteAllInCollection('loanApplications');

    if (Array.isArray(data.accounts) && data.accounts.length > 0) {
      await deleteAllInCollection('accounts');
      for (const acc of data.accounts) {
        const cleanAcc: StaffAccount = {
          id: acc.id,
          name: acc.name,
          role: acc.role === 'Admin' ? 'Admin' : 'Staf',
          pin: acc.pin && acc.pin.length >= 4 ? acc.pin : '0000',
          active: acc.active !== false,
          createdAt: acc.createdAt || new Date().toISOString(),
        };
        await setDoc(docRef('accounts', cleanAcc.id), stripUndefined({ ...cleanAcc }));
      }
    }

    for (const tx of data.transactions) {
      const cleanTx = stripUndefined({
        ...tx,
        amount: Math.round(tx.amount),
        description: tx.description || '',
      });
      await setDoc(docRef('transactions', cleanTx.id), cleanTx);
    }

    for (const loan of data.loans) {
      const principalAmount = Math.round(loan.principalAmount);
      const adminFee = Math.min(principalAmount, Math.max(0, Math.round(loan.adminFee ?? 0)));
      const cleanLoan = stripUndefined({
        ...loan,
        memberId: loan.memberId || '',
        phone: loan.phone || '',
        principalAmount,
        adminFee,
        interestAmount: Math.round(loan.interestAmount || 0),
        totalAmount: Math.round(loan.totalAmount),
        description: loan.description || '',
      });
      await setDoc(docRef('loans', cleanLoan.id), cleanLoan);
    }

    for (const rep of data.repayments) {
      const cleanRep = stripUndefined({
        ...rep,
        amount: Math.round(rep.amount),
        notes: rep.notes || '',
      });
      await setDoc(docRef('repayments', cleanRep.id), cleanRep);
    }

    for (const app of data.loanApplications || []) {
      const cleanApp = stripUndefined({
        ...sanitizeLoanApplicationFields(app),
        id: app.id,
        createdAt: app.createdAt || new Date().toISOString(),
        updatedAt: app.updatedAt || new Date().toISOString(),
      });
      await setDoc(docRef('loanApplications', cleanApp.id), cleanApp);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `koperasi/${WORKSPACE_ID}`);
  }
}

export async function resetKoperasiLedger(): Promise<void> {
  try {
    await deleteAllInCollection('repayments');
    await deleteAllInCollection('loans');
    await deleteAllInCollection('transactions');
    await deleteAllInCollection('loanApplications');
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `koperasi/${WORKSPACE_ID}`);
  }
}
