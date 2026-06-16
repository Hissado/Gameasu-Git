---
name: Express 5 params/query typing issues
description: @types/express@5.0.6 types req.params as string|string[] in some contexts; req.query as ParsedQs; both cause TS2769 cascade on Drizzle eq() chains.
---

## Problem
`@types/express@5.0.6` causes cascading TS2769 "No overload matches this call" in Drizzle `.returning()` chains when `req.params.id` or `req.query.field` values have type `string | string[]` or `string | string[] | ParsedQs | ...`.

## Root cause
- `req.params.id` typed as `string | string[]` in some handler contexts  
- `eq(table.col, req.params.id)` fails type check → cascades to `.returning()` TS2769
- `req.query.field` typed as `ParsedQs[string]` = `string | string[] | ParsedQs | ParsedQs[] | undefined`

## Fixes applied (accounting.ts)
- `sed -i 's/req\.params\.id\b/req.params.id as string/g'` — 30 replacements
- Column name mismatches fixed: `journalEntryId→entryId`, `chartOfAccountsTable.number→.code`, `.name→.label`, `journalEntriesTable.date→.entryDate`, `disposalDate→disposedAt`

## DO NOT
- Do not create a global `declare module 'express-serve-static-core'` type augmentation — it conflicts with Express 5 types and increases error count from ~692 to ~2788.

**Why:** The augmentation overrides core Express types, breaking the router, handler, and Response type chains.

## Pattern for new route files
- Always cast `req.params.id as string` inline in Drizzle `eq()` calls
- Always cast `req.query as Record<string, string>` at the top of handlers
- esbuild (api-server build) ignores TS errors — they are cosmetic until typecheck script is run

## Remaining TS errors
~688 pre-existing TS errors across 58 route/lib files in api-server. They don't block runtime. All 3 frontends (ERP, Cockpit, Kiosk) are fully type-clean.
