---
name: Hissado demo seed
description: How the comprehensive Hissado Consulting tenant demo seed works and how to re-run it
---

## Pattern

Three files coordinate the seed:

1. **Service** — `artifacts/api-server/src/services/seed-hissado.ts`
   - Exports `seedHissado(orgIdOverride?: string)` — idempotent, slug-lookup fallback
   - Covers: email fix, cost centers, analytical accounts, fixed assets, journal entries, payroll runs + payslips (3 months × 12 collabs), warehouse + products + stock movements, marketing campaigns + prospects, invoices + proformas, supplier invoices, conversations + messages, notifications, tickets, CRM opportunities

2. **Runner** — `artifacts/api-server/src/scripts/seed-hissado-runner.ts`
   - Execute directly with tsx against any DB:
     ```bash
     cd /home/runner/workspace/artifacts/api-server
     /home/runner/workspace/scripts/node_modules/.bin/tsx src/scripts/seed-hissado-runner.ts <orgId>
     ```

3. **HTTP route** — `POST /api/super-admin/seed-hissado` (requires super_admin session)
   - Body: `{ "orgId": "<uuid>" }` (optional, falls back to slug lookup)

## Org IDs
- **DEV Hissado**: `8c41d48a-df54-496a-84c5-c9283dbe4305`
- **PROD Hissado**: `88d7592d-8749-49c1-a9b1-d69b44c90f72`

## Execution status (2026-06-25)
- DEV seed: **EXECUTED** via tsx runner → all 19 sections succeeded
- PROD seed: **PENDING** — requires deploying code, then calling the HTTP route with valid super_admin session

## Why tsx runner, not executeSql
`executeSql` in the Replit prod tool environment is **read-only** (INSERT/UPDATE/DELETE all fail with "production environment is read-only"). The tsx runner must be used against dev; for prod, the HTTP route must be called after deployment.

## Stock movements table
`stockMovementsTable` uses fields `kind`, `occurredAt`, `referenceLabel`, `reason` — NOT `warehouseId`. Warehouse is joined via product, not directly.

## Schema pitfalls discovered
- `warehousesTable` requires a `code` field (short unique code)
- `ticketCommentsTable` does NOT exist — use only `ticketsTable`
- `proformasTable` uses `proformaDate` / `validUntil` / `subtotal` / `taxAmount` / `totalAmount`
