---
name: DB push interactive prompt workaround
description: drizzle-kit push blocks on interactive prompts; use a tsx migration script instead.
---

# DB push interactive prompt workaround

## The rule
`pnpm --filter @workspace/db run push` and `drizzle-kit push --force` both block on interactive CLI prompts when adding unique constraints to non-empty tables (e.g. "Do you want to truncate the table?"). Piping stdin doesn't help.

**Why:** Drizzle Kit's prompts use a TTY-based picker that ignores piped stdin.

**How to apply:**
1. Write a one-off migration script at `lib/db/src/migrate-<feature>.ts`:
   ```ts
   import { pool } from "./index";
   async function main() {
     const client = await pool.connect();
     try {
       await client.query("ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...");
       // ... more DDL
     } finally { client.release(); await pool.end(); }
   }
   main().catch(e => { console.error(e.message); process.exit(1); });
   ```
2. Run: `cd lib/db && pnpm exec tsx src/migrate-<feature>.ts`
3. Delete the script after running (it's a one-time migration)

Note: `pnpm exec tsx -e "..."` does NOT work (esbuild CJS/top-level-await conflict).
Must write to a real `.ts` file and run via `pnpm exec tsx src/<file>.ts`.
