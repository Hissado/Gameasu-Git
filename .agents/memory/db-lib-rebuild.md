---
name: DB lib rebuild required
description: After adding new table exports to lib/db, stale declarations cause "has no exported member" errors in api-server typecheck
---

## Rule
After any change to `lib/db/src/schema/*.ts` (new table, new export), run:
```
pnpm run typecheck:libs
```
before running `pnpm --filter @workspace/api-server run typecheck`.

**Why:** lib/db is a composite package that emits declarations. The api-server's tsconfig references these declarations. If they're stale, imports like `leavePoliciesTable` from `@workspace/db` show "has no exported member" even though the source code is correct.

**How to apply:** Any time you add a table or export to `lib/db` and then see TS2305 errors in the api-server, this is the fix. It's not a missing export — it's a stale build artifact.
