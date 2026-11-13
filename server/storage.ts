import fs from 'fs';
import path from 'path';
import firebaseConfig from '../firebase-applet-config.json';
import type {
  CashTransaction,
  KoperasiDatabase,
  Loan,
  Repayment,
  StaffAccount,
} from '../src/types';
import { hashPin } from './auth';

export interface StorageAdapter {
  readonly mode: 'firebase-firestore' | 'json-file';
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

// ============================================================================
// Firestore REST Value Codec (Zero gRPC / Zero Serverless Cold-Start Hang)
// ============================================================================
type FirestoreValue =
  | { stringValue: string }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { nullValue: null }
  | { mapValue: { fields: Record<string, FirestoreValue> } }
  | { arrayValue: { values: FirestoreValue[] } };

function encodeValue(val: unknown): FirestoreValue {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val)
      ? { integerValue: String(val) }
      : { doubleValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(encodeValue) } };
  }
  if (typeof val === 'object') {
    return {
      mapValue: { fields: encodeFields(val as Record<string, unknown>) },
    };
  }
  return { stringValue: String(val) };
}

function encodeFields(obj: Record<string, unknown>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      fields[k] = encodeValue(v);
    }
  }
  return fields;
}

function decodeValue(v: FirestoreValue): unknown {
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
  return undefined;
}

function decodeFields<T = Record<string, unknown>>(
  fields: Record<string, FirestoreValue> | undefined
): T {
  const out: Record<string, unknown> = {};
  if (!fields) return out as T;
  for (const [k, v] of Object.entries(fields)) {
    out[k] = decodeValue(v);
  }
  return out as T;
}

// ============================================================================
// 1. Firebase Cloud Firestore REST Adapter (Works on Vercel & Local Node)
// ============================================================================
type CollectionName = 'accounts' | 'transactions' | 'loans' | 'repayments';

class FirestoreRestStorage implements StorageAdapter {
  readonly mode = 'firebase-firestore' as const;
  private baseUrl: string;
  private apiKey: string;
  private workspaceId: string;
  private initialized = false;

  constructor(cfg: typeof firebaseConfig) {
    this.baseUrl = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${cfg.firestoreDatabaseId}/documents`;
    this.apiKey = cfg.apiKey;
    const rawKey = process.env.FIREBASE_WORKSPACE_KEY?.trim();
    this.workspaceId =
      rawKey && /^[a-zA-Z0-9_\-]{20,128}$/.test(rawKey)
        ? rawKey
        : 'ksp-cendana-artha-mandiri-prod-v1';
  }

  private docUrl(col: CollectionName, id: string): string {
    return `${this.baseUrl}/koperasi/${this.workspaceId}/${col}/${encodeURIComponent(
      id
    )}?key=${encodeURIComponent(this.apiKey)}`;
  }

  private queryUrl(): string {
    return `${this.baseUrl}/koperasi/${this.workspaceId}:runQuery?key=${encodeURIComponent(
      this.apiKey
    )}`;
  }

  private async listCollection<T>(col: CollectionName): Promise<T[]> {
    const res = await fetch(this.queryUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: col }],
        },
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Firestore query (${col}) gagal [${res.status}]: ${errText}`);
    }
    const items = (await res.json()) as Array<{
      document?: { fields?: Record<string, FirestoreValue> };
    }>;
    const result: T[] = [];
    for (const item of items) {
      if (item.document?.fields) {
        result.push(decodeFields<T>(item.document.fields));
      }
    }
    return result;
  }

  private async getDocument<T>(col: CollectionName, id: string): Promise<T | null> {
    const res = await fetch(this.docUrl(col, id));
    if (res.status === 404) return null;
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Firestore get (${col}/${id}) gagal [${res.status}]: ${errText}`);
    }
    const data = (await res.json()) as { fields?: Record<string, FirestoreValue> };
    return data.fields ? decodeFields<T>(data.fields) : null;
  }

  private async putDocument(
    col: CollectionName,
    id: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const res = await fetch(this.docUrl(col, id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: encodeFields(payload) }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Firestore save (${col}/${id}) gagal [${res.status}]: ${errText}`);
    }
  }

  private async deleteDocument(col: CollectionName, id: string): Promise<void> {
    const res = await fetch(this.docUrl(col, id), { method: 'DELETE' });
    if (res.status === 404) return;
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Firestore delete (${col}/${id}) gagal [${res.status}]: ${errText}`);
    }
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    const accounts = await this.listCollection<StaffAccount>('accounts');
    if (accounts.length === 0) {
      const admin = createDefaultAdmin();
      await this.putDocument('accounts', admin.id, stripUndefined({ ...admin }));
    }
    this.initialized = true;
  }

  async getAccounts(includePin = false): Promise<StaffAccount[]> {
    await this.init();
    const list = await this.listCollection<StaffAccount>('accounts');
    list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    return includePin ? list : list.map(sanitizeAccount);
  }

  async findAccountById(id: string): Promise<StaffAccount | null> {
    await this.init();
    return this.getDocument<StaffAccount>('accounts', id);
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
    await this.putDocument('accounts', payload.id, stripUndefined({ ...payload }));
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
    await this.putDocument('accounts', id, stripUndefined({ ...next }));
    return sanitizeAccount(next);
  }

  async deleteAccount(id: string): Promise<boolean> {
    await this.init();
    const existing = await this.findAccountById(id);
    if (!existing) return false;
    await this.deleteDocument('accounts', id);
    return true;
  }

  async getFullDatabase(includePins = false): Promise<KoperasiDatabase> {
    await this.init();
    const [accounts, transactions, loans, repayments] = await Promise.all([
      this.listCollection<StaffAccount>('accounts'),
      this.listCollection<CashTransaction>('transactions'),
      this.listCollection<Loan>('loans'),
      this.listCollection<Repayment>('repayments'),
    ]);

    accounts.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    transactions.sort(
      (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)
    );
    loans.sort(
      (a, b) => a.loanDate.localeCompare(b.loanDate) || a.createdAt.localeCompare(b.createdAt)
    );
    repayments.sort(
      (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)
    );

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
    await this.putDocument('transactions', clean.id, clean);
    return clean;
  }

  async updateTransaction(
    id: string,
    patch: Partial<CashTransaction>
  ): Promise<CashTransaction | null> {
    await this.init();
    const prev = await this.getDocument<CashTransaction>('transactions', id);
    if (!prev) return null;
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
    await this.putDocument('transactions', id, next);
    return next;
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.init();
    await this.deleteDocument('transactions', id);
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
    await this.putDocument('loans', clean.id, clean);
    return clean;
  }

  async updateLoan(id: string, patch: Partial<Loan>): Promise<Loan | null> {
    await this.init();
    const prev = await this.getDocument<Loan>('loans', id);
    if (!prev) return null;
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
    await this.putDocument('loans', id, next);
    return next;
  }

  async deleteLoan(id: string): Promise<void> {
    await this.init();
    const repayments = await this.listCollection<Repayment>('repayments');
    await Promise.all(
      repayments.filter((r) => r.loanId === id).map((r) => this.deleteDocument('repayments', r.id))
    );
    await this.deleteDocument('loans', id);
  }

  async createRepayment(rep: Repayment): Promise<Repayment> {
    await this.init();
    const clean = stripUndefined({
      ...rep,
      amount: Math.round(rep.amount),
      notes: rep.notes || '',
    });
    await this.putDocument('repayments', clean.id, clean);
    return clean;
  }

  async deleteRepayment(id: string): Promise<void> {
    await this.init();
    await this.deleteDocument('repayments', id);
  }

  private async clearCollection(col: CollectionName): Promise<void> {
    const items = await this.listCollection<{ id: string }>(col);
    await Promise.all(items.map((item) => this.deleteDocument(col, item.id)));
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
        await this.putDocument('accounts', cleanAcc.id, stripUndefined({ ...cleanAcc }));
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
// 2. Local JSON File Fallback (Only if firebase config unavailable locally)
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

  if (
    firebaseConfig &&
    firebaseConfig.projectId &&
    firebaseConfig.projectId !== 'remixed-project-id' &&
    firebaseConfig.firestoreDatabaseId
  ) {
    cachedAdapter = new FirestoreRestStorage(firebaseConfig);
    return cachedAdapter;
  }

  cachedAdapter = new JsonFileStorage();
  return cachedAdapter;
}
