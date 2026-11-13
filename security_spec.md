# Security Specification — KSP Cendana Artha Mandiri Firestore Rules

## 1. Data Invariants
1. Global default-deny catch-all (`match /{document=**} { allow read, write: if false; }`) blocks every unspecified path.
2. Every document ID (`workspaceId`, `accountId`, `transactionId`, `loanId`, `repaymentId`) must pass `isValidId()` (`^[a-zA-Z0-9_\-]+$`, length `<= 128`).
3. Every `create` and `update` enforces strict key allowlisting (`keys().hasAll(...) && keys().hasOnly(...)`), strict data types, string `.size()` caps, and positive numeric amounts (`amount > 0`, `principalAmount > 0`, `totalAmount >= principalAmount`).
4. Every `Repayment` creation verifies via `exists()` that its parent `Loan` document exists in the same workspace (`/koperasi/$(workspaceId)/loans/$(incoming().loanId)`).
5. `createdAt` and `id` are immutable after creation (`incoming().id == existing().id`, `incoming().createdAt == existing().createdAt`).
6. Attachments, when present, must be maps with bounded keys (`id`, `name`, `mimeType`, `size`, `dataUrl`) and bounded sizes under Firestore's 1 MiB limit.
7. No blanket `allow read: if true` or `allow write: if true` anywhere in the ruleset.

## 2. Adversarial Payloads Blocked
1. Write to unknown top-level collection `/secrets/doc1` -> DENIED by catch-all.
2. Create `StaffAccount` with invalid role `"SuperGod"` -> DENIED by role enum check.
3. Create `StaffAccount` with extra ghost field `isSuperAdmin: true` -> DENIED by `keys().hasOnly(...)`.
4. Create `CashTransaction` with `amount: -50000` -> DENIED by `amount > 0`.
5. Create `CashTransaction` with 1.5KB junk `transactionId` -> DENIED by `isValidId(transactionId)`.
6. Create `Loan` with `totalAmount < principalAmount` -> DENIED by `totalAmount >= principalAmount`.
7. Create `Repayment` referencing non-existent `loanId` -> DENIED by `exists(...)` relational gate.
8. Update `CashTransaction` changing `createdAt` or `id` -> DENIED by immutability check.
9. Update `Loan` injecting extra field `forgiven: true` -> DENIED by `affectedKeys().hasOnly(...)`.
10. Create `CashTransaction` with `description` > 1000 chars -> DENIED by `.size() <= 1000`.
11. Read/list invalid workspace ID containing special characters -> DENIED by `isValidId(workspaceId)`.
12. Create `Repayment` with `amount: 0` -> DENIED by `amount > 0`.
