---
name: Compliance module table naming
description: Naming convention for compliance/document-signing tables to avoid ambiguous-import conflict with benefits.ts
---

## Rule

`benefits.ts` already exports `signatureRequestsTable` (for HR contract signatures). Any new document-signing table in `compliance.ts` must use a different prefix.

**Chosen prefix:** `docSig` → `docSigRequestsTable`, `docSigSignersTable`.
DB table names: `doc_sig_requests`, `doc_sig_signers`.

**Why:** esbuild barfs on ambiguous re-exports from `lib/db` barrel (`export * from "./compliance"` + `export * from "./benefits"` both exporting a symbol with the same name) — build fails with "Ambiguous import has multiple matching exports".

**How to apply:** Any future table in compliance.ts whose name could collide with an existing export in another schema file must use a unique prefix. Verify with `grep -r "export const.*Table" lib/db/src/schema/` before naming a new table.

## drizzle-kit push workaround

When adding new tables to compliance.ts, `drizzle-kit push` may prompt interactively (rename vs create). `printf "y\ny\n" | drizzle-kit push` does NOT work in this environment. Use a tsx migration script in `lib/db/src/migrate_xxx.ts` that calls `db.execute(sql\`CREATE TABLE IF NOT EXISTS ...\`)`, then delete it after running.
