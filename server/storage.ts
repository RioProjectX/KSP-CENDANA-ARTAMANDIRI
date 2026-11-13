import fs from 'fs';
import path from 'path';
import { getApps, initializeApp } from 'firebase/app';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { Pool } from 'pg';
import type {
  Attachment,
  CashTransaction,
  KoperasiDatabase,
  Loan,
  Repayment,
  StaffAccount,
} from '../src/types';
import { hashPin } from './auth';

export interface StorageAdapter {
  readonly mode: 'firebase-firestore' | 'postgres' | 'json-file';
  init(): Promise<void>;
  getAccounts(includePin?: boolean): Promise<StaffAccount[]>;
  findAccountById(id: string): Promise<StaffAccount | null>;
  createAccount(account: StaffAccount): Promise<StaffAccount>;
  updateAccount(id: string, patch: Partial<StaffAccount>): Promise<StaffAccount | null>;
  deleteAccount(id: string): Promise<boolean>;
  getFullDatabase(includePins?: boolean): Promise<KoperasiDatabase>;
  createTransaction(tx: CashTransaction): Promise<CashTransaction>;
  updateTransaction(id: string, patch: Partial<CashTransaction>): Promise<CashTransaction | null>;
  deleteTransaction(id: string): Promise<void>;
  createLoan(loan: Loan): Promise<Loan>;
  updateLoan(id: string, patch: Partial<Loan>): Promise<Loan | null>;
  deleteLoan(id: string): Promise<void>;
  createRepayment(rep: Repayment): Promise<Repayment>;
  deleteRepayment(id: string): Promise<void>;
  restoreDatabase(db: KoperasiDatabase): Promise<void>;
  resetLedger(): Promise<void>;
}

function createDefaultAdmin(): StaffAccount {
  return {
    id: 'admin-utama',
    name: 'Administrator Utama',
    role: 'Admin',
    pin: hashPin('1234'),
    active: true,
    createdAt: new Date().toISOString(),
  };
}

function sanitizeAccount(acc: StaffAccount): StaffAccount {
  const { pin: _pin, ...rest } = acc;
  return rest;
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

interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

function loadFirebaseConfig(): FirebaseAppletConfig | null {
  try {
    const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(cfgPath)) return null;
    const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as FirebaseAppletConfig;
    if (
      !raw?.projectId ||
      raw.projectId === 'remixed-project-id' ||
      !raw?.firestoreDatabaseId
    ) {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

// ============================================================================
// 1. Firebase Firestore Storage Adapter
// ============================================================================
class FirestoreStorage implements StorageAdapter {
  readonly mode = 'firebase-firestore' as const;
  private db: Firestore;
  private workspaceId: string;
  private initializedPromise: Promise<void> | null = null;

  constructor(config: FirebaseAppletConfig) {
    const app =
      getApps().find((a) => a.name === 'ksp-server') ||
      initializeApp(config, 'ksp-server');
    this.db = getFirestore(app, config.firestoreDatabaseId);
    const rawKey = process.env.FIREBASE_WORKSPACE_KEY?.trim();
    this.workspaceId =
      rawKey && /^[a-zA-Z0-9_\-]{20,128}$/.test(rawKey)
        ? rawKey
        : 'ksp-cendana-artha-mandiri-prod-v1';
  }

  private col(name: 'accounts' | 'transactions' | 'loans' | 'repayments') {
    return collection(this.db, 'koperasi', this.workspaceId, name);
  }

  private docRef(name: 'accounts' | 'transactions' | 'loans' | 'repayments', id: string) {
    return doc(this.db, 'koperasi', this.workspaceId, name, id);
  }

  async init(): Promise<void> {
    if (!this.initializedPromise) {
      this.initializedPromise = this.bootstrap();
    }
    return this.initializedPromise;
  }

  private async bootstrap(): Promise<void> {
    const snap = await getDocs(this.col('accounts'));
    if (snap.empty) {
      const admin = createDefaultAdmin();
      await setDoc(this.docRef('accounts', admin.id), stripUndefined({ ...admin }));
    }
  }

  async getAccounts(includePin = false): Promise<StaffAccount[]> {
    await this.init();
    const snap = await getDocs(this.col('accounts'));
    const list = snap.docs.map((d) => d.data() as StaffAccount);
    list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    return includePin ? list : list.map(sanitizeAccount);
  }

  async findAccountById(id: string): Promise<StaffAccount | null> {
    await this.init();
    const snap = await getDoc(this.docRef('accounts', id));
    if (!snap.exists()) return null;
    return snap.data() as StaffAccount;
  }

  async createAccount(account: StaffAccount): Promise<StaffAccount> {
    await this.init();
    const payload: StaffAccount = {
      id: account.id,
      name: account.name,
      role: account.role === 'Admin' ? 'Admin' : 'Staf',
      pin: account.pin || hashPin('1234'),
      active: account.active !== false,
      createdAt: account.createdAt,
    };
    await setDoc(this.docRef('accounts', payload.id), payload);
    return sanitizeAccount(payload);
  }

  async updateAccount(id: string, patch: Partial<StaffAccount>): Promise<StaffAccount | null> {
    await this.init();
    const existing = await this.findAccountById(id);
    if (!existing) return null;
    const next: StaffAccount = {
      id: existing.id,
      name: patch.name ?? existing.name,
      role: patch.role ?? existing.role,
      pin: patch.pin ?? existing.pin,
      active: patch.active ?? existing.active,
      createdAt: existing.createdAt,
    };
    await updateDoc(this.docRef('accounts', id), {
      name: next.name,
      role: next.role,
      pin: next.pin,
      active: next.active,
    });
    return sanitizeAccount(next);
  }

  async deleteAccount(id: string): Promise<boolean> {
    await this.init();
    const existing = await this.findAccountById(id);
    if (!existing) return false;
    await deleteDoc(this.docRef('accounts', id));
    return true;
  }

  async getFullDatabase(includePins = false): Promise<KoperasiDatabase> {
    await this.init();
    const [accSnap, txSnap, loanSnap, repSnap] = await Promise.all([
      getDocs(this.col('accounts')),
      getDocs(this.col('transactions')),
      getDocs(this.col('loans')),
      getDocs(this.col('repayments')),
    ]);

    const accounts = accSnap.docs
      .map((d) => d.data() as StaffAccount)
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

    const transactions = txSnap.docs
      .map((d) => d.data() as CashTransaction)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

    const loans = loanSnap.docs
      .map((d) => d.data() as Loan)
      .sort((a, b) => a.loanDate.localeCompare(b.loanDate) || a.createdAt.localeCompare(b.createdAt));

    const repayments = repSnap.docs
      .map((d) => d.data() as Repayment)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

    return {
      version: 1,
      lastModified: new Date().toISOString(),
      accounts: includePins ? accounts : accounts.map(sanitizeAccount),
      transactions,
      loans,
      repayments,
    };
  }

  async createTransaction(tx: CashTransaction): Promise<CashTransaction> {
    await this.init();
    const clean = stripUndefined({
      ...tx,
      amount: Math.round(tx.amount),
      description: tx.description || '',
    });
    await setDoc(this.docRef('transactions', clean.id), clean);
    return clean;
  }

  async updateTransaction(
    id: string,
    patch: Partial<CashTransaction>
  ): Promise<CashTransaction | null> {
    await this.init();
    const ref = this.docRef('transactions', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const prev = snap.data() as CashTransaction;
    const next = stripUndefined({
      ...prev,
      ...patch,
      id: prev.id,
      createdBy: prev.createdBy,
      createdAt: prev.createdAt,
      amount: Math.round(patch.amount ?? prev.amount),
      description: patch.description ?? prev.description ?? '',
      updatedAt: new Date().toISOString(),
    });
    await setDoc(ref, next);
    return next;
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.init();
    await deleteDoc(this.docRef('transactions', id));
  }

  async createLoan(loan: Loan): Promise<Loan> {
    await this.init();
    const clean = stripUndefined({
      ...loan,
      memberId: loan.memberId || '',
      phone: loan.phone || '',
      principalAmount: Math.round(loan.principalAmount),
      interestAmount: Math.round(loan.interestAmount || 0),
      totalAmount: Math.round(loan.totalAmount),
      description: loan.description || '',
    });
    await setDoc(this.docRef('loans', clean.id), clean);
    return clean;
  }

  async updateLoan(id: string, patch: Partial<Loan>): Promise<Loan | null> {
    await this.init();
    const ref = this.docRef('loans', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const prev = snap.data() as Loan;
    const next = stripUndefined({
      ...prev,
      ...patch,
      id: prev.id,
      createdBy: prev.createdBy,
      createdAt: prev.createdAt,
      memberId: patch.memberId ?? prev.memberId ?? '',
      phone: patch.phone ?? prev.phone ?? '',
      principalAmount: Math.round(patch.principalAmount ?? prev.principalAmount),
      interestAmount: Math.round(patch.interestAmount ?? prev.interestAmount ?? 0),
      totalAmount: Math.round(patch.totalAmount ?? prev.totalAmount),
      description: patch.description ?? prev.description ?? '',
      updatedAt: new Date().toISOString(),
    });
    await setDoc(ref, next);
    return next;
  }

  async deleteLoan(id: string): Promise<void> {
    await this.init();
    const repSnap = await getDocs(this.col('repayments'));
    const batch = writeBatch(this.db);
    for (const d of repSnap.docs) {
      const rep = d.data() as Repayment;
      if (rep.loanId === id) {
        batch.delete(d.ref);
      }
    }
    batch.delete(this.docRef('loans', id));
    await batch.commit();
  }

  async createRepayment(rep: Repayment): Promise<Repayment> {
    await this.init();
    const clean = stripUndefined({
      ...rep,
      amount: Math.round(rep.amount),
      notes: rep.notes || '',
    });
    await setDoc(this.docRef('repayments', clean.id), clean);
    return clean;
  }

  async deleteRepayment(id: string): Promise<void> {
    await this.init();
    await deleteDoc(this.docRef('repayments', id));
  }

  private async clearCollection(name: 'accounts' | 'transactions' | 'loans' | 'repayments') {
    const snap = await getDocs(this.col(name));
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(this.db);
      for (const d of docs.slice(i, i + 400)) {
        batch.delete(d.ref);
      }
      await batch.commit();
    }
  }

  async restoreDatabase(db: KoperasiDatabase): Promise<void> {
    await this.init();
    await this.clearCollection('repayments');
    await this.clearCollection('loans');
    await this.clearCollection('transactions');

    if (Array.isArray(db.accounts) && db.accounts.length > 0) {
      await this.clearCollection('accounts');
      for (const acc of db.accounts) {
        const cleanAcc: StaffAccount = {
          id: acc.id,
          name: acc.name,
          role: acc.role === 'Admin' ? 'Admin' : 'Staf',
          pin:
            acc.pin && acc.pin.startsWith('scrypt:')
              ? acc.pin
              : hashPin(acc.pin || '1234'),
          active: acc.active !== false,
          createdAt: acc.createdAt || new Date().toISOString(),
        };
        await setDoc(this.docRef('accounts', cleanAcc.id), cleanAcc);
      }
    }

    for (const tx of db.transactions) {
      await this.createTransaction(tx);
    }
    for (const loan of db.loans) {
      await this.createLoan(loan);
    }
    for (const rep of db.repayments) {
      await this.createRepayment(rep);
    }
  }

  async resetLedger(): Promise<void> {
    await this.init();
    await this.clearCollection('repayments');
    await this.clearCollection('loans');
    await this.clearCollection('transactions');
  }
}

// ============================================================================
// 2. PostgreSQL Storage Adapter (Optional via DATABASE_URL)
// ============================================================================
class PostgresStorage implements StorageAdapter {
  readonly mode = 'postgres' as const;
  private pool: Pool;
  private initializedPromise: Promise<void> | null = null;

  constructor(connectionString: string) {
    const isLocal =
      connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
    this.pool = new Pool({
      connectionString,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 10,
    });
  }

  async init(): Promise<void> {
    if (!this.initializedPromise) {
      this.initializedPromise = this.bootstrapSchema();
    }
    return this.initializedPromise;
  }

  private async bootstrapSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS koperasi_accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        pin_hash TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS koperasi_transactions (
        id TEXT PRIMARY KEY,
        tx_number TEXT NOT NULL,
        type TEXT NOT NULL,
        date TEXT NOT NULL,
        category TEXT NOT NULL,
        amount BIGINT NOT NULL,
        party_name TEXT NOT NULL,
        payment_method TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        attachment_json JSONB,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS koperasi_loans (
        id TEXT PRIMARY KEY,
        tx_number TEXT NOT NULL,
        borrower_name TEXT NOT NULL,
        member_id TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        loan_date TEXT NOT NULL,
        due_date TEXT NOT NULL,
        principal_amount BIGINT NOT NULL,
        interest_amount BIGINT NOT NULL DEFAULT 0,
        total_amount BIGINT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        attachment_json JSONB,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS koperasi_repayments (
        id TEXT PRIMARY KEY,
        tx_number TEXT NOT NULL,
        loan_id TEXT NOT NULL REFERENCES koperasi_loans(id) ON DELETE CASCADE,
        loan_tx_number TEXT NOT NULL,
        date TEXT NOT NULL,
        amount BIGINT NOT NULL,
        payment_method TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        attachment_json JSONB,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    const countRes = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM koperasi_accounts'
    );
    if (Number(countRes.rows[0]?.count || 0) === 0) {
      const admin = createDefaultAdmin();
      await this.pool.query(
        `INSERT INTO koperasi_accounts (id, name, role, pin_hash, active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [admin.id, admin.name, admin.role, admin.pin, admin.active, admin.createdAt]
      );
    }
  }

  private mapAccount(row: Record<string, unknown>, includePin: boolean): StaffAccount {
    const acc: StaffAccount = {
      id: String(row.id),
      name: String(row.name),
      role: row.role === 'Admin' ? 'Admin' : 'Staf',
      active: Boolean(row.active),
      createdAt: String(row.created_at),
    };
    if (includePin) acc.pin = String(row.pin_hash);
    return acc;
  }

  private mapTransaction(row: Record<string, unknown>): CashTransaction {
    return {
      id: String(row.id),
      txNumber: String(row.tx_number),
      type: row.type === 'keluar' ? 'keluar' : 'masuk',
      date: String(row.date),
      category: String(row.category),
      amount: Number(row.amount),
      partyName: String(row.party_name),
      paymentMethod: row.payment_method === 'Transfer Bank' ? 'Transfer Bank' : 'Tunai',
      description: String(row.description || ''),
      attachment: (row.attachment_json as Attachment | null) || undefined,
      createdBy: String(row.created_by),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private mapLoan(row: Record<string, unknown>): Loan {
    return {
      id: String(row.id),
      txNumber: String(row.tx_number),
      borrowerName: String(row.borrower_name),
      memberId: String(row.member_id || ''),
      phone: String(row.phone || ''),
      loanDate: String(row.loan_date),
      dueDate: String(row.due_date),
      principalAmount: Number(row.principal_amount),
      interestAmount: Number(row.interest_amount),
      totalAmount: Number(row.total_amount),
      description: String(row.description || ''),
      attachment: (row.attachment_json as Attachment | null) || undefined,
      createdBy: String(row.created_by),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private mapRepayment(row: Record<string, unknown>): Repayment {
    return {
      id: String(row.id),
      txNumber: String(row.tx_number),
      loanId: String(row.loan_id),
      loanTxNumber: String(row.loan_tx_number),
      date: String(row.date),
      amount: Number(row.amount),
      paymentMethod: row.payment_method === 'Transfer Bank' ? 'Transfer Bank' : 'Tunai',
      notes: String(row.notes || ''),
      attachment: (row.attachment_json as Attachment | null) || undefined,
      createdBy: String(row.created_by),
      createdAt: String(row.created_at),
    };
  }

  async getAccounts(includePin = false): Promise<StaffAccount[]> {
    await this.init();
    const res = await this.pool.query('SELECT * FROM koperasi_accounts ORDER BY created_at ASC');
    return res.rows.map((r) => this.mapAccount(r, includePin));
  }

  async findAccountById(id: string): Promise<StaffAccount | null> {
    await this.init();
    const res = await this.pool.query('SELECT * FROM koperasi_accounts WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return this.mapAccount(res.rows[0], true);
  }

  async createAccount(account: StaffAccount): Promise<StaffAccount> {
    await this.init();
    await this.pool.query(
      `INSERT INTO koperasi_accounts (id, name, role, pin_hash, active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        account.id,
        account.name,
        account.role,
        account.pin || hashPin('1234'),
        account.active,
        account.createdAt,
      ]
    );
    return sanitizeAccount(account);
  }

  async updateAccount(id: string, patch: Partial<StaffAccount>): Promise<StaffAccount | null> {
    await this.init();
    const existing = await this.findAccountById(id);
    if (!existing) return null;
    const nextName = patch.name ?? existing.name;
    const nextRole = patch.role ?? existing.role;
    const nextActive = patch.active ?? existing.active;
    const nextPin = patch.pin ?? existing.pin!;
    await this.pool.query(
      `UPDATE koperasi_accounts SET name = $2, role = $3, active = $4, pin_hash = $5 WHERE id = $1`,
      [id, nextName, nextRole, nextActive, nextPin]
    );
    return { id, name: nextName, role: nextRole, active: nextActive, createdAt: existing.createdAt };
  }

  async deleteAccount(id: string): Promise<boolean> {
    await this.init();
    const res = await this.pool.query('DELETE FROM koperasi_accounts WHERE id = $1', [id]);
    return (res.rowCount || 0) > 0;
  }

  async getFullDatabase(includePins = false): Promise<KoperasiDatabase> {
    await this.init();
    const [accRes, txRes, loanRes, repRes] = await Promise.all([
      this.pool.query('SELECT * FROM koperasi_accounts ORDER BY created_at ASC'),
      this.pool.query('SELECT * FROM koperasi_transactions ORDER BY date ASC, created_at ASC'),
      this.pool.query('SELECT * FROM koperasi_loans ORDER BY loan_date ASC, created_at ASC'),
      this.pool.query('SELECT * FROM koperasi_repayments ORDER BY date ASC, created_at ASC'),
    ]);
    return {
      version: 1,
      lastModified: new Date().toISOString(),
      accounts: accRes.rows.map((r) => this.mapAccount(r, includePins)),
      transactions: txRes.rows.map((r) => this.mapTransaction(r)),
      loans: loanRes.rows.map((r) => this.mapLoan(r)),
      repayments: repRes.rows.map((r) => this.mapRepayment(r)),
    };
  }

  async createTransaction(tx: CashTransaction): Promise<CashTransaction> {
    await this.init();
    await this.pool.query(
      `INSERT INTO koperasi_transactions
       (id, tx_number, type, date, category, amount, party_name, payment_method, description, attachment_json, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        tx.id, tx.txNumber, tx.type, tx.date, tx.category, Math.round(tx.amount),
        tx.partyName, tx.paymentMethod, tx.description || '',
        tx.attachment ? JSON.stringify(tx.attachment) : null,
        tx.createdBy, tx.createdAt, tx.updatedAt,
      ]
    );
    return tx;
  }

  async updateTransaction(id: string, patch: Partial<CashTransaction>): Promise<CashTransaction | null> {
    await this.init();
    const cur = await this.pool.query('SELECT * FROM koperasi_transactions WHERE id = $1', [id]);
    if (cur.rows.length === 0) return null;
    const prev = this.mapTransaction(cur.rows[0]);
    const next: CashTransaction = { ...prev, ...patch, id, updatedAt: new Date().toISOString() };
    await this.pool.query(
      `UPDATE koperasi_transactions
       SET tx_number=$2, type=$3, date=$4, category=$5, amount=$6, party_name=$7, payment_method=$8, description=$9, attachment_json=$10, updated_at=$11
       WHERE id=$1`,
      [
        id, next.txNumber, next.type, next.date, next.category, Math.round(next.amount),
        next.partyName, next.paymentMethod, next.description || '',
        next.attachment ? JSON.stringify(next.attachment) : null, next.updatedAt,
      ]
    );
    return next;
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.init();
    await this.pool.query('DELETE FROM koperasi_transactions WHERE id = $1', [id]);
  }

  async createLoan(loan: Loan): Promise<Loan> {
    await this.init();
    await this.pool.query(
      `INSERT INTO koperasi_loans
       (id, tx_number, borrower_name, member_id, phone, loan_date, due_date, principal_amount, interest_amount, total_amount, description, attachment_json, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        loan.id, loan.txNumber, loan.borrowerName, loan.memberId || '', loan.phone || '',
        loan.loanDate, loan.dueDate, Math.round(loan.principalAmount), Math.round(loan.interestAmount || 0),
        Math.round(loan.totalAmount), loan.description || '',
        loan.attachment ? JSON.stringify(loan.attachment) : null,
        loan.createdBy, loan.createdAt, loan.updatedAt,
      ]
    );
    return loan;
  }

  async updateLoan(id: string, patch: Partial<Loan>): Promise<Loan | null> {
    await this.init();
    const cur = await this.pool.query('SELECT * FROM koperasi_loans WHERE id = $1', [id]);
    if (cur.rows.length === 0) return null;
    const prev = this.mapLoan(cur.rows[0]);
    const next: Loan = { ...prev, ...patch, id, updatedAt: new Date().toISOString() };
    await this.pool.query(
      `UPDATE koperasi_loans
       SET tx_number=$2, borrower_name=$3, member_id=$4, phone=$5, loan_date=$6, due_date=$7, principal_amount=$8, interest_amount=$9, total_amount=$10, description=$11, attachment_json=$12, updated_at=$13
       WHERE id=$1`,
      [
        id, next.txNumber, next.borrowerName, next.memberId || '', next.phone || '',
        next.loanDate, next.dueDate, Math.round(next.principalAmount), Math.round(next.interestAmount || 0),
        Math.round(next.totalAmount), next.description || '',
        next.attachment ? JSON.stringify(next.attachment) : null, next.updatedAt,
      ]
    );
    return next;
  }

  async deleteLoan(id: string): Promise<void> {
    await this.init();
    await this.pool.query('DELETE FROM koperasi_loans WHERE id = $1', [id]);
  }

  async createRepayment(rep: Repayment): Promise<Repayment> {
    await this.init();
    await this.pool.query(
      `INSERT INTO koperasi_repayments
       (id, tx_number, loan_id, loan_tx_number, date, amount, payment_method, notes, attachment_json, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        rep.id, rep.txNumber, rep.loanId, rep.loanTxNumber, rep.date, Math.round(rep.amount),
        rep.paymentMethod, rep.notes || '', rep.attachment ? JSON.stringify(rep.attachment) : null,
        rep.createdBy, rep.createdAt,
      ]
    );
    return rep;
  }

  async deleteRepayment(id: string): Promise<void> {
    await this.init();
    await this.pool.query('DELETE FROM koperasi_repayments WHERE id = $1', [id]);
  }

  async restoreDatabase(db: KoperasiDatabase): Promise<void> {
    await this.init();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM koperasi_repayments');
      await client.query('DELETE FROM koperasi_loans');
      await client.query('DELETE FROM koperasi_transactions');
      if (Array.isArray(db.accounts) && db.accounts.length > 0) {
        await client.query('DELETE FROM koperasi_accounts');
        for (const acc of db.accounts) {
          const pinValue = acc.pin && acc.pin.startsWith('scrypt:') ? acc.pin : hashPin(acc.pin || '1234');
          await client.query(
            `INSERT INTO koperasi_accounts (id, name, role, pin_hash, active, created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
            [acc.id, acc.name, acc.role === 'Admin' ? 'Admin' : 'Staf', pinValue, acc.active !== false, acc.createdAt || new Date().toISOString()]
          );
        }
      }
      for (const tx of db.transactions) {
        await client.query(
          `INSERT INTO koperasi_transactions (id, tx_number, type, date, category, amount, party_name, payment_method, description, attachment_json, created_by, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [tx.id, tx.txNumber, tx.type, tx.date, tx.category, Math.round(tx.amount), tx.partyName, tx.paymentMethod, tx.description || '', tx.attachment ? JSON.stringify(tx.attachment) : null, tx.createdBy, tx.createdAt, tx.updatedAt]
        );
      }
      for (const loan of db.loans) {
        await client.query(
          `INSERT INTO koperasi_loans (id, tx_number, borrower_name, member_id, phone, loan_date, due_date, principal_amount, interest_amount, total_amount, description, attachment_json, created_by, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [loan.id, loan.txNumber, loan.borrowerName, loan.memberId || '', loan.phone || '', loan.loanDate, loan.dueDate, Math.round(loan.principalAmount), Math.round(loan.interestAmount || 0), Math.round(loan.totalAmount), loan.description || '', loan.attachment ? JSON.stringify(loan.attachment) : null, loan.createdBy, loan.createdAt, loan.updatedAt]
        );
      }
      for (const rep of db.repayments) {
        await client.query(
          `INSERT INTO koperasi_repayments (id, tx_number, loan_id, loan_tx_number, date, amount, payment_method, notes, attachment_json, created_by, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [rep.id, rep.txNumber, rep.loanId, rep.loanTxNumber, rep.date, Math.round(rep.amount), rep.paymentMethod, rep.notes || '', rep.attachment ? JSON.stringify(rep.attachment) : null, rep.createdBy, rep.createdAt]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async resetLedger(): Promise<void> {
    await this.init();
    await this.pool.query('DELETE FROM koperasi_repayments');
    await this.pool.query('DELETE FROM koperasi_loans');
    await this.pool.query('DELETE FROM koperasi_transactions');
  }
}

// ============================================================================
// 3. Local JSON File Storage Adapter (Local fallback)
// ============================================================================
class JsonFileStorage implements StorageAdapter {
  readonly mode = 'json-file' as const;
  private dataDir = path.join(process.cwd(), 'data');
  private dbFile = path.join(this.dataDir, 'koperasi-db.json');

  private readSync(): KoperasiDatabase {
    if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
    if (!fs.existsSync(this.dbFile)) {
      const initial: KoperasiDatabase = {
        version: 1,
        lastModified: new Date().toISOString(),
        accounts: [createDefaultAdmin()],
        transactions: [],
        loans: [],
        repayments: [],
      };
      fs.writeFileSync(this.dbFile, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    try {
      const raw = fs.readFileSync(this.dbFile, 'utf-8');
      const parsed = JSON.parse(raw) as KoperasiDatabase;
      return {
        version: parsed.version || 1,
        lastModified: parsed.lastModified || new Date().toISOString(),
        accounts:
          Array.isArray(parsed.accounts) && parsed.accounts.length > 0
            ? parsed.accounts
            : [createDefaultAdmin()],
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        loans: Array.isArray(parsed.loans) ? parsed.loans : [],
        repayments: Array.isArray(parsed.repayments) ? parsed.repayments : [],
      };
    } catch {
      const initial: KoperasiDatabase = {
        version: 1,
        lastModified: new Date().toISOString(),
        accounts: [createDefaultAdmin()],
        transactions: [],
        loans: [],
        repayments: [],
      };
      this.writeSync(initial);
      return initial;
    }
  }

  private writeSync(db: KoperasiDatabase): KoperasiDatabase {
    if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
    const updated: KoperasiDatabase = { ...db, lastModified: new Date().toISOString() };
    const tmpFile = `${this.dbFile}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(updated, null, 2), 'utf-8');
    fs.renameSync(tmpFile, this.dbFile);
    return updated;
  }

  async init(): Promise<void> { this.readSync(); }
  async getAccounts(includePin = false): Promise<StaffAccount[]> {
    const db = this.readSync();
    return includePin ? db.accounts : db.accounts.map(sanitizeAccount);
  }
  async findAccountById(id: string): Promise<StaffAccount | null> {
    return this.readSync().accounts.find((a) => a.id === id) || null;
  }
  async createAccount(account: StaffAccount): Promise<StaffAccount> {
    const db = this.readSync();
    db.accounts.push(account);
    this.writeSync(db);
    return sanitizeAccount(account);
  }
  async updateAccount(id: string, patch: Partial<StaffAccount>): Promise<StaffAccount | null> {
    const db = this.readSync();
    const idx = db.accounts.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    db.accounts[idx] = { ...db.accounts[idx], ...patch, id };
    this.writeSync(db);
    return sanitizeAccount(db.accounts[idx]);
  }
  async deleteAccount(id: string): Promise<boolean> {
    const db = this.readSync();
    const before = db.accounts.length;
    db.accounts = db.accounts.filter((a) => a.id !== id);
    this.writeSync(db);
    return db.accounts.length < before;
  }
  async getFullDatabase(includePins = false): Promise<KoperasiDatabase> {
    const db = this.readSync();
    return { ...db, accounts: includePins ? db.accounts : db.accounts.map(sanitizeAccount) };
  }
  async createTransaction(tx: CashTransaction): Promise<CashTransaction> {
    const db = this.readSync();
    db.transactions.push(tx);
    this.writeSync(db);
    return tx;
  }
  async updateTransaction(id: string, patch: Partial<CashTransaction>): Promise<CashTransaction | null> {
    const db = this.readSync();
    const idx = db.transactions.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    db.transactions[idx] = { ...db.transactions[idx], ...patch, id, updatedAt: new Date().toISOString() };
    this.writeSync(db);
    return db.transactions[idx];
  }
  async deleteTransaction(id: string): Promise<void> {
    const db = this.readSync();
    db.transactions = db.transactions.filter((t) => t.id !== id);
    this.writeSync(db);
  }
  async createLoan(loan: Loan): Promise<Loan> {
    const db = this.readSync();
    db.loans.push(loan);
    this.writeSync(db);
    return loan;
  }
  async updateLoan(id: string, patch: Partial<Loan>): Promise<Loan | null> {
    const db = this.readSync();
    const idx = db.loans.findIndex((l) => l.id === id);
    if (idx === -1) return null;
    db.loans[idx] = { ...db.loans[idx], ...patch, id, updatedAt: new Date().toISOString() };
    this.writeSync(db);
    return db.loans[idx];
  }
  async deleteLoan(id: string): Promise<void> {
    const db = this.readSync();
    db.loans = db.loans.filter((l) => l.id !== id);
    db.repayments = db.repayments.filter((r) => r.loanId !== id);
    this.writeSync(db);
  }
  async createRepayment(rep: Repayment): Promise<Repayment> {
    const db = this.readSync();
    db.repayments.push(rep);
    this.writeSync(db);
    return rep;
  }
  async deleteRepayment(id: string): Promise<void> {
    const db = this.readSync();
    db.repayments = db.repayments.filter((r) => r.id !== id);
    this.writeSync(db);
  }
  async restoreDatabase(data: KoperasiDatabase): Promise<void> {
    const current = this.readSync();
    const accounts =
      Array.isArray(data.accounts) && data.accounts.length > 0
        ? data.accounts.map((acc) => ({
            ...acc,
            pin: acc.pin && acc.pin.startsWith('scrypt:') ? acc.pin : hashPin(acc.pin || '1234'),
          }))
        : current.accounts;
    this.writeSync({
      version: data.version || 1,
      lastModified: new Date().toISOString(),
      accounts,
      transactions: data.transactions,
      loans: data.loans,
      repayments: data.repayments,
    });
  }
  async resetLedger(): Promise<void> {
    const db = this.readSync();
    this.writeSync({ ...db, transactions: [], loans: [], repayments: [] });
  }
}

let cachedAdapter: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (cachedAdapter) return cachedAdapter;

  const fbConfig = loadFirebaseConfig();
  if (fbConfig) {
    cachedAdapter = new FirestoreStorage(fbConfig);
    return cachedAdapter;
  }

  const pgUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (pgUrl && pgUrl.trim().length > 0) {
    cachedAdapter = new PostgresStorage(pgUrl.trim());
    return cachedAdapter;
  }

  cachedAdapter = new JsonFileStorage();
  return cachedAdapter;
}
