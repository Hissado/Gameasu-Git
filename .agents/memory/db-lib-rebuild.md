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

## Caveat — verify the exports target first
As of this writing, `lib/db/package.json` `exports` points to **source** (`./src/index.ts`, `./src/schema/index.ts`), not `dist`. When exports resolve to source, consumers (api-server, edole-admin) typecheck against the DB schema **source**, so a newly added column/export — and the `$inferSelect` type derived from it — is visible **immediately without** rebuilding the lib. The rebuild rule above only bites when exports resolve to emitted `dist/*.d.ts`. So: always check the `exports` target before assuming a stale-declaration problem — if it points at source, a lib rebuild is not required for consumers to see new schema fields.
