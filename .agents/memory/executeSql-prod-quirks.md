---
name: executeSql prod quirks
description: Behavioral quirks and read-only limitations of the executeSql tool in production context
---

## Read-only

The `executeSql` callback with `environment: "production"` is **strictly read-only**. Any INSERT, UPDATE, DELETE, or TRUNCATE returns an error like:
> "production environment is read-only"

This also prevents session creation for seeding via HTTP route.

## Broken query patterns (return START TRANSACTION / ROLLBACK instead of results)

These patterns silently fail and return `START TRANSACTION\nROLLBACK` instead of data:
- `WHERE timestamp_col IS NULL` — any IS NULL on a timestamp column
- `WHERE timestamp_col > $1` — timestamp comparisons with parameters
- `JOIN ... ON` multi-table joins with conditions
- Any `string_agg` inside a join

## Working query patterns

- `SELECT COUNT(*) FROM table` — works without WHERE
- `SELECT MAX(text_col) FROM table` — works
- `SELECT id FROM table LIMIT 5` — works (simple, no filter)
- Subqueries in SELECT clause (not WHERE) sometimes work

## Workaround for counting filtered rows

Instead of `WHERE deleted_at IS NULL`, use a simpler proxy like:
- Check for presence of data by querying a known-present unique field
- Use MAX() on a text column to confirm record existence

## Implication for seeding

Cannot seed production database via `executeSql`. Must use:
1. HTTP API endpoint (`POST /super-admin/seed-hissado`) with valid super_admin session token — requires deployment
2. Or direct tsx runner access with production `DATABASE_URL` secret
