---
name: Clean base / startup demo-seed gating
description: Why a DB wipe alone doesn't stay clean — startup auto-seeds repopulate it unless gated.
---

# Clean base & demo-seed gating

A data wipe (TRUNCATE) is **not durable on its own**: the API re-seeds on every boot.

**Where it happens:** `artifacts/api-server/src/routes/index.ts` runs seeds at module load
(`seedRbac`, `seedSaas`, then intelligence/operations/inventory/kiosk demo seeds).
`artifacts/api-server/src/index.ts` separately runs `seedHr`, `seedSyscohada`, `ensureCockpitAdmin`.

**The trap:** `seedSaas()`'s `ensureDefaultOrganization()` looks for an org with
`isDefault=true`. The platform org (`gameasu-platform`) has `isDefault=false`, so after a
wipe seedSaas would create a fresh demo org (`nexora-demo` / "Gaméasù Demo") + subscription +
billing, and the demo seeds (which target slug `nexora-demo`) would refill it. The wipe is
silently undone on the next restart/deploy.

**The rule (current design):**
- `seedSaas(opts)` is **catalog-only by default** (module catalog + plans — reference data,
  idempotent, needed in prod). It only creates the demo org/membership/subscription/modules/
  billing when `opts.includeDemoData === true`.
- `routes/index.ts` gates the whole demo chain behind `process.env.SEED_DEMO_DATA === "true"`.
  Default (unset) = clean base in both dev and prod.
- Structural seeds (`seedHr`, `seedSyscohada`, `ensureCockpitAdmin`, `seedRbac`) always run and
  are wipe-safe (they only seed the platform org / reference data).

**Why:** pre-launch the user wanted both dev and prod wiped AND to stay clean across restarts.

**How to apply:** if you ever add a new startup seed that writes business/tenant data, gate it
behind `SEED_DEMO_DATA` too, or a fresh deploy / factory-reset will be repopulated. The dev
master seeders (`lib/db/src/seed-demo-all.ts`, `seed-gameasu-master.ts`) are run manually and
do NOT call `seedSaas`, so they're unaffected by the default change.
