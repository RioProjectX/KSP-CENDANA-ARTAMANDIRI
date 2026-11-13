import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import firebaseConfig from '../firebase-applet-config.json';
import type { UserRole } from '../src/types';

export interface SessionPayload {
  id: string;
  name: string;
  role: UserRole;
  exp: number;
}

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 jam

function getSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16) {
    return process.env.SESSION_SECRET.trim();
  }

  // On Vercel/serverless, derive a stable secret across all cold starts from the project's Firebase config
  if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    try {
      const dataDir = path.join(process.cwd(), 'data');
      const secretFile = path.join(dataDir, '.session-secret');
      if (fs.existsSync(secretFile)) {
        return fs.readFileSync(secretFile, 'utf-8').trim();
      }
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const generated = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(secretFile, generated, 'utf-8');
      return generated;
    } catch {
      // Fall through to deterministic project-scoped secret
    }
  }

  const seed = `${firebaseConfig.projectId}:${firebaseConfig.firestoreDatabaseId}:${firebaseConfig.appId}:${firebaseConfig.apiKey}`;
  return crypto.createHash('sha256').update(seed).digest('hex');
}

export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(pin, salt, 32).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPin(
  inputPin: string,
  storedPin: string
): { valid: boolean; needsRehash: boolean } {
  if (!storedPin) return { valid: false, needsRehash: false };

  if (storedPin.startsWith('scrypt:')) {
    const parts = storedPin.split(':');
    if (parts.length !== 3) return { valid: false, needsRehash: false };
    const [, salt, storedHex] = parts;
    const derived = crypto.scryptSync(inputPin, salt, 32);
    const storedBuf = Buffer.from(storedHex, 'hex');
    if (derived.length !== storedBuf.length) {
      return { valid: false, needsRehash: false };
    }
    return {
      valid: crypto.timingSafeEqual(derived, storedBuf),
      needsRehash: false,
    };
  }

  const a = Buffer.from(inputPin, 'utf-8');
  const b = Buffer.from(storedPin, 'utf-8');
  if (a.length !== b.length) return { valid: false, needsRehash: false };
  return {
    valid: crypto.timingSafeEqual(a, b),
    needsRehash: true,
  };
}

export function signSessionToken(user: { id: string; name: string; role: UserRole }): string {
  const payload: SessionPayload = {
    id: user.id,
    name: user.name,
    role: user.role,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(body)
    .digest('base64url');

  const a = Buffer.from(sig, 'utf-8');
  const b = Buffer.from(expectedSig, 'utf-8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as SessionPayload;
    if (!parsed.id || !parsed.role || !parsed.exp || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

const failedAttempts = new Map<string, { count: number; lockedUntil: number }>();

export function checkLoginRateLimit(ipKey: string): { allowed: boolean; waitSeconds: number } {
  const entry = failedAttempts.get(ipKey);
  if (!entry) return { allowed: true, waitSeconds: 0 };
  if (entry.lockedUntil > Date.now()) {
    return {
      allowed: false,
      waitSeconds: Math.ceil((entry.lockedUntil - Date.now()) / 1000),
    };
  }
  return { allowed: true, waitSeconds: 0 };
}

export function recordLoginFailure(ipKey: string) {
  const now = Date.now();
  const prev = failedAttempts.get(ipKey);
  const count = prev ? prev.count + 1 : 1;
  if (count >= 5) {
    failedAttempts.set(ipKey, { count: 0, lockedUntil: now + 60_000 });
  } else {
    failedAttempts.set(ipKey, { count, lockedUntil: 0 });
  }
}

export function clearLoginFailures(ipKey: string) {
  failedAttempts.delete(ipKey);
}
