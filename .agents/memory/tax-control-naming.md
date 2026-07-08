---
name: Tax-control table naming
description: Avoid name clash with taxDeclarationsTable already in benefits.ts when adding the fiscal-control module.
---

## Rule
`lib/db/src/schema/benefits.ts` exports `taxDeclarationsTable` (pg table `tax_declarations`).
The new fiscal-control module must use the `fiscal_*` prefix for all its tables and TS exports:
- `fiscalDeclarationsTable`  → pg `fiscal_declarations`
- `fiscalAnomaliesTable`     → pg `fiscal_anomalies`
- `fiscalChecksTable`        → pg `fiscal_checks`
- `fiscalDeclarationHistoryTable` → pg `fiscal_declaration_history`
- `fiscalSettingsTable`      → pg `fiscal_settings`

**Why:** esbuild reports "Ambiguous import" at build time when two schema files in `@workspace/db` export the same name. This breaks the API server build entirely.

**How to apply:** Before naming any new DB table export, grep `lib/db/src/schema/` for the planned export name. If it already exists, pick a distinguishing prefix from the module name.

## drizzle-kit push interactive prompt workaround
When renaming tables, `drizzle-kit push` shows an interactive prompt asking which existing table to rename FROM. This blocks CI-style runs. Bypass by writing a `lib/db/src/migrate-*.ts` script using raw `db.execute(sql\`CREATE TABLE IF NOT EXISTS ...\`)`, running it with `pnpm exec tsx src/migrate-*.ts`, then deleting it. Import `db` from `./index` (not `./client`).
