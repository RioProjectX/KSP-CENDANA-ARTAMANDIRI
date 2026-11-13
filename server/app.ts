import express, { NextFunction, Request, Response } from 'express';
import type {
  CashTransaction,
  KoperasiDatabase,
  Loan,
  Repayment,
  StaffAccount,
} from '../src/types';
import {
  checkLoginRateLimit,
  clearLoginFailures,
  hashPin,
  recordLoginFailure,
  SessionPayload,
  signSessionToken,
  verifyPin,
  verifySessionToken,
} from './auth';
import { getStorage } from './storage';

interface AuthenticatedRequest extends Request {
  authUser?: SessionPayload;
}

function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir. Silakan masuk dengan PIN.' });
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Sesi telah kedaluwarsa. Silakan login kembali dengan PIN.' });
  }
  req.authUser = payload;
  return next();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.authUser || req.authUser.role !== 'Admin') {
    return res.status(403).json({ error: 'Akses ditolak. Fitur ini khusus Admin.' });
  }
  return next();
}

async function buildPublicState() {
  const storage = getStorage();
  const db = await storage.getFullDatabase(true);
  const hasDefaultPin = db.accounts.some(
    (a) => a.active && verifyPin('1234', a.pin || '').valid
  );
  return {
    version: db.version,
    lastModified: db.lastModified,
    accounts: db.accounts.map(({ pin: _pin, ...rest }) => rest),
    transactions: db.transactions,
    loans: db.loans,
    repayments: db.repayments,
    hasDefaultPin,
    storageMode: storage.mode,
  };
}

export function createApiApp() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', async (_req, res) => {
    try {
      const storage = getStorage();
      await storage.init();
      res.json({ ok: true, storage: storage.mode });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Database connection error',
      });
    }
  });

  // Public account names/roles list (no PINs or hashes exposed)
  app.get('/api/auth/accounts', async (_req, res) => {
    try {
      const storage = getStorage();
      const accounts = await storage.getAccounts(true);
      const active = accounts.filter((a) => a.active);
      res.json({
        accounts: active.map(({ id, name, role }) => ({ id, name, role })),
        hasDefaultPin: active.some((a) => verifyPin('1234', a.pin || '').valid),
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal memuat daftar akun.',
      });
    }
  });

  // PIN login with rate limit & HMAC token
  app.post('/api/auth/login', async (req, res) => {
    const ipKey = getClientIp(req);
    const rate = checkLoginRateLimit(ipKey);
    if (!rate.allowed) {
      return res.status(429).json({
        error: `Terlalu banyak percobaan PIN salah. Coba lagi dalam ${rate.waitSeconds} detik.`,
      });
    }

    const { pin, accountId } = req.body as { pin?: string; accountId?: string };
    if (!pin || typeof pin !== 'string') {
      return res.status(400).json({ error: 'PIN wajib diisi.' });
    }

    try {
      const storage = getStorage();
      const accounts = await storage.getAccounts(true);
      const activeAccounts = accounts.filter((a) => a.active);

      let matched: StaffAccount | undefined;
      let needsRehash = false;

      if (accountId) {
        const candidate = activeAccounts.find((a) => a.id === accountId);
        if (candidate) {
          const check = verifyPin(pin, candidate.pin || '');
          if (check.valid) {
            matched = candidate;
            needsRehash = check.needsRehash;
          }
        }
      } else {
        for (const candidate of activeAccounts) {
          const check = verifyPin(pin, candidate.pin || '');
          if (check.valid) {
            matched = candidate;
            needsRehash = check.needsRehash;
            break;
          }
        }
      }

      if (!matched) {
        recordLoginFailure(ipKey);
        return res.status(401).json({ error: 'PIN salah atau akun tidak aktif.' });
      }

      clearLoginFailures(ipKey);

      if (needsRehash) {
        await storage.updateAccount(matched.id, { pin: hashPin(pin) });
      }

      const { pin: _pin, ...safeUser } = matched;
      const token = signSessionToken({
        id: safeUser.id,
        name: safeUser.name,
        role: safeUser.role,
      });

      return res.json({ user: safeUser, token });
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Terjadi kesalahan saat verifikasi PIN.',
      });
    }
  });

  // Change own PIN (requires valid session token)
  app.post('/api/auth/change-pin', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { accountId, oldPin, newPin } = req.body as {
      accountId?: string;
      oldPin?: string;
      newPin?: string;
    };
    const targetId = accountId || req.authUser?.id;
    if (!targetId || targetId !== req.authUser?.id) {
      return res.status(403).json({ error: 'Anda hanya dapat mengubah PIN milik Anda sendiri.' });
    }
    if (!oldPin || !newPin) {
      return res.status(400).json({ error: 'PIN lama dan PIN baru wajib diisi.' });
    }
    if (!/^\d{4,6}$/.test(newPin)) {
      return res.status(400).json({ error: 'PIN baru harus 4 hingga 6 digit angka.' });
    }

    const storage = getStorage();
    const accounts = await storage.getAccounts(true);
    const current = accounts.find((a) => a.id === targetId);
    if (!current) {
      return res.status(404).json({ error: 'Akun tidak ditemukan.' });
    }
    if (!verifyPin(oldPin, current.pin || '').valid) {
      return res.status(401).json({ error: 'PIN lama tidak sesuai.' });
    }

    const duplicate = accounts.find(
      (a) => a.id !== targetId && a.active && verifyPin(newPin, a.pin || '').valid
    );
    if (duplicate) {
      return res.status(409).json({
        error: 'PIN tersebut sudah digunakan oleh akun lain. Gunakan kombinasi berbeda.',
      });
    }

    await storage.updateAccount(targetId, { pin: hashPin(newPin) });
    return res.json({ ok: true, state: await buildPublicState() });
  });

  // Protected State
  app.get('/api/state', requireAuth, async (_req, res) => {
    try {
      res.json(await buildPublicState());
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal memuat data koperasi.',
      });
    }
  });

  // Accounts CRUD (Admin only)
  app.post('/api/accounts', requireAuth, requireAdmin, async (req, res) => {
    const { name, role, pin, active } = req.body as Partial<StaffAccount>;
    if (!name?.trim() || !pin || !/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({ error: 'Nama dan PIN (4-6 digit angka) wajib diisi.' });
    }
    const storage = getStorage();
    const existing = await storage.getAccounts(true);
    if (existing.some((a) => a.active && verifyPin(pin, a.pin || '').valid)) {
      return res.status(409).json({ error: 'PIN sudah dipakai akun lain. Gunakan PIN unik.' });
    }

    const newAccount: StaffAccount = {
      id: `acc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      role: role === 'Admin' ? 'Admin' : 'Staf',
      pin: hashPin(pin),
      active: active !== false,
      createdAt: new Date().toISOString(),
    };
    const created = await storage.createAccount(newAccount);
    return res.json({ account: created, state: await buildPublicState() });
  });

  app.put('/api/accounts/:id', requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, role, pin, active } = req.body as Partial<StaffAccount>;
    const storage = getStorage();
    const accounts = await storage.getAccounts(true);
    const current = accounts.find((a) => a.id === id);
    if (!current) return res.status(404).json({ error: 'Akun tidak ditemukan.' });

    const nextRole = role === 'Admin' || role === 'Staf' ? role : current.role;
    const nextActive = typeof active === 'boolean' ? active : current.active;

    const otherActiveAdmin = accounts.some(
      (a) => a.id !== id && a.active && a.role === 'Admin'
    );
    if (!otherActiveAdmin && (nextRole !== 'Admin' || !nextActive)) {
      return res.status(400).json({ error: 'Minimal harus ada 1 akun Admin yang aktif.' });
    }

    let nextPinHash = current.pin;
    if (pin !== undefined && pin.trim() !== '') {
      if (!/^\d{4,6}$/.test(pin)) {
        return res.status(400).json({ error: 'PIN baru harus 4 hingga 6 digit angka.' });
      }
      if (
        accounts.some(
          (a) => a.id !== id && a.active && verifyPin(pin, a.pin || '').valid
        )
      ) {
        return res.status(409).json({ error: 'PIN tersebut sudah digunakan akun lain.' });
      }
      nextPinHash = hashPin(pin);
    }

    await storage.updateAccount(id, {
      name: name?.trim() ? name.trim() : current.name,
      role: nextRole,
      active: nextActive,
      pin: nextPinHash,
    });
    return res.json({ state: await buildPublicState() });
  });

  app.delete('/api/accounts/:id', requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const storage = getStorage();
    const accounts = await storage.getAccounts(false);
    const target = accounts.find((a) => a.id === id);
    if (!target) return res.status(404).json({ error: 'Akun tidak ditemukan.' });

    const remainingAdmins = accounts.filter(
      (a) => a.id !== id && a.active && a.role === 'Admin'
    );
    if (remainingAdmins.length === 0) {
      return res.status(400).json({ error: 'Tidak dapat menghapus akun Admin terakhir.' });
    }

    await storage.deleteAccount(id);
    return res.json({ state: await buildPublicState() });
  });

  // Cash Transactions CRUD
  app.post('/api/transactions', requireAuth, async (req, res) => {
    const payload = req.body as Omit<CashTransaction, 'id' | 'createdAt' | 'updatedAt'>;
    if (!payload.txNumber || !payload.date || !payload.type || !(payload.amount > 0)) {
      return res.status(400).json({ error: 'Data transaksi kas tidak valid.' });
    }
    const now = new Date().toISOString();
    const created: CashTransaction = {
      ...payload,
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    const storage = getStorage();
    await storage.createTransaction(created);
    return res.json({ transaction: created, state: await buildPublicState() });
  });

  app.put('/api/transactions/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const payload = req.body as Partial<CashTransaction>;
    const storage = getStorage();
    const updated = await storage.updateTransaction(id, payload);
    if (!updated) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    return res.json({ transaction: updated, state: await buildPublicState() });
  });

  app.delete('/api/transactions/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const storage = getStorage();
    await storage.deleteTransaction(id);
    return res.json({ state: await buildPublicState() });
  });

  // Loans CRUD
  app.post('/api/loans', requireAuth, async (req, res) => {
    const payload = req.body as Omit<Loan, 'id' | 'createdAt' | 'updatedAt'>;
    if (
      !payload.txNumber ||
      !payload.borrowerName?.trim() ||
      !payload.loanDate ||
      !payload.dueDate ||
      !(payload.principalAmount > 0)
    ) {
      return res.status(400).json({ error: 'Data pinjaman tidak valid.' });
    }
    const now = new Date().toISOString();
    const created: Loan = {
      ...payload,
      id: `loan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    const storage = getStorage();
    await storage.createLoan(created);
    return res.json({ loan: created, state: await buildPublicState() });
  });

  app.put('/api/loans/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const payload = req.body as Partial<Loan>;
    const storage = getStorage();
    const updated = await storage.updateLoan(id, payload);
    if (!updated) return res.status(404).json({ error: 'Data pinjaman tidak ditemukan.' });
    return res.json({ loan: updated, state: await buildPublicState() });
  });

  app.delete('/api/loans/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const storage = getStorage();
    await storage.deleteLoan(id);
    return res.json({ state: await buildPublicState() });
  });

  // Repayments CRUD
  app.post('/api/repayments', requireAuth, async (req, res) => {
    const payload = req.body as Omit<Repayment, 'id' | 'createdAt'>;
    if (!payload.loanId || !payload.date || !(payload.amount > 0)) {
      return res.status(400).json({ error: 'Data pengembalian tidak valid.' });
    }
    const storage = getStorage();
    const db = await storage.getFullDatabase(false);
    const loan = db.loans.find((l) => l.id === payload.loanId);
    if (!loan) {
      return res.status(404).json({ error: 'Nomor pinjaman tidak ditemukan.' });
    }
    const paidSoFar = db.repayments
      .filter((r) => r.loanId === loan.id)
      .reduce((sum, r) => sum + r.amount, 0);
    const remaining = Math.max(0, loan.totalAmount - paidSoFar);
    if (payload.amount > remaining) {
      return res.status(400).json({
        error: `Nominal pembayaran melebihi sisa tagihan (${remaining}).`,
      });
    }

    const created: Repayment = {
      ...payload,
      loanTxNumber: loan.txNumber,
      id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    await storage.createRepayment(created);
    return res.json({ repayment: created, state: await buildPublicState() });
  });

  app.delete('/api/repayments/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const storage = getStorage();
    await storage.deleteRepayment(id);
    return res.json({ state: await buildPublicState() });
  });

  // Backup & Restore JSON (Protected)
  app.get('/api/backup', requireAuth, async (_req, res) => {
    const storage = getStorage();
    const db = await storage.getFullDatabase(true);
    res.json(db);
  });

  app.post('/api/restore', requireAuth, requireAdmin, async (req, res) => {
    const data = req.body as Partial<KoperasiDatabase>;
    if (
      !data ||
      !Array.isArray(data.transactions) ||
      !Array.isArray(data.loans) ||
      !Array.isArray(data.repayments)
    ) {
      return res.status(400).json({
        error: 'Format file backup JSON tidak valid. Pastikan berasal dari ekspor sistem ini.',
      });
    }
    const storage = getStorage();
    await storage.restoreDatabase({
      version: data.version || 1,
      lastModified: new Date().toISOString(),
      accounts: Array.isArray(data.accounts) ? data.accounts : [],
      transactions: data.transactions,
      loans: data.loans,
      repayments: data.repayments,
    });
    return res.json({ state: await buildPublicState() });
  });

  app.post('/api/reset', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    const { pin } = req.body as { pin?: string };
    const storage = getStorage();
    const account = await storage.findAccountById(req.authUser!.id);
    if (
      !account ||
      !account.active ||
      account.role !== 'Admin' ||
      !pin ||
      !verifyPin(pin, account.pin || '').valid
    ) {
      return res.status(403).json({ error: 'PIN Admin tidak valid untuk reset pembukuan.' });
    }
    await storage.resetLedger();
    return res.json({ state: await buildPublicState() });
  });

  return app;
}
