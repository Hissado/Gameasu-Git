---
name: text date columns + OVERLAPS / range ops
description: Postgres date columns stored as text need ::date casts on BOTH sides of OVERLAPS, or the query throws (→ 500)
---

# Text date columns and OVERLAPS

In this schema many date fields are stored as `text` (ISO `YYYY-MM-DD`), e.g.
`fiscal_periods.start_date/end_date`, `journal_entries.entry_date`,
`leave_requests.start_date`, `projects.end_date`.

**Rule:** PostgreSQL's `(a, b) OVERLAPS (c, d)` requires both row-value sides to
be the same type. When the left side is `(text, text)` columns and the right
side is `(... ::date, ... ::date)`, Postgres raises a type-mismatch error. You
must cast the text columns too:

```sql
(start_date::date, end_date::date) OVERLAPS ($1::date, $2::date)
```

**Why:** the fiscal-period creation endpoint returned a raw HTTP 500 because the
OVERLAPS conflict check compared text columns against `::date` values without
casting the columns. The route also had no try/catch, so the DB error surfaced
as an opaque 500 instead of a useful message.

**How to apply:**
- Any new range/overlap/`BETWEEN` logic on these text date columns must cast the
  column to `::date` (single-column comparisons against `now()::date` etc. are
  already fine — the column gets cast and compared to a date expression, no row-
  value mismatch).
- Wrap DB-touching route handlers in try/catch → `next(err)` so query failures
  return structured errors, not bare 500s.
