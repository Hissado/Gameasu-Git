---
name: Drizzle ORM jsonb select bug
description: drizzle-orm 0.45.2 crashes with "Cannot convert undefined or null to object" when a table column is undefined in a select() call. Columns with .$type<>() or absent from schema exports silently become undefined.
---

## Rule
Always use explicit column selection `select({ col: table.col })` in route handlers — **never** bare `select()` without fields. Also use explicit field lists in `returning({ ... })`.

**Why:** In drizzle-orm 0.45.2, `select()` without fields calls `orderSelectedFields(table)` which iterates all columns via `Object.entries`. If any column value is `undefined` (e.g. a column that doesn't exist on the JS table object, or a `jsonb().$type<>()` column with `.default({})`), drizzle throws `TypeError: Cannot convert undefined or null to object`.

**How to apply:**
- Before adding a column to a select object, verify it exists: `grep -n "columnName" lib/db/src/schema/tablefile.ts`
- `collaboratorsTable.photoUrl` does NOT exist — use `avatarUrl` instead
- `.returning()` on tables with jsonb columns must also specify explicit fields
- Use the debug script pattern: `for (const [k,v] of Object.entries({...columns})) console.log(k, v === undefined ? 'UNDEFINED' : typeof v)` to catch undefined columns before they crash at runtime
