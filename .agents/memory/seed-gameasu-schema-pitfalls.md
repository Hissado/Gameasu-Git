---
name: Gaméasù master seed schema pitfalls
description: NOT NULL fields and schema mismatches discovered during master seed execution; required to run the seed cleanly
---

## Rule
Before adding rows to a table in seed-gameasu-master.ts, verify NOT NULL fields match the schema. Several mismatches existed:

| Table | Issue | Fix |
|---|---|---|
| `chart_of_accounts` | `classNum` NOT NULL (1..9) | Add `classNum: parseInt(code[0])` |
| `bank_accounts` | `accountId` (FK→COA) NOT NULL | Insert COA first, then bank accounts with accountId |
| `fiscal_periods` | field is `name` not `label` | Use `name:` |
| `journal_entries` | `entryNumber` NOT NULL | Pass `entryNumber: e.ref` |
| `suppliers` | `code` NOT NULL (unique per org) | Add codes F001–F00N |
| `ticket_comments` | field is `body` not `content` | Use `body:` |
| `incidents` | no `organizationId`, no `startedAt`, no `resolvedById`; `affectedServices` is `text` not array | Remove those fields; pass comma-separated string |
| `notifications` | field is `body` not `message` | Use `body:` |
| `attendance_sessions` | `workDate` (date) NOT NULL | Derive from dayOffset and ISO-slice |
| `tasks.assigneeId` | FK → `usersTable.id`, NOT `collaboratorsTable.id` | Use `collab.userId ?? admin.id` |

## Dependency order (critical)
`chart_of_accounts` must be inserted BEFORE `bank_accounts` (accountId FK).

## TRUNCATE list
Full correct table list includes: `crm_activities` (not "activities"), `user_presence`, `push_subscriptions`, `whatsapp_channels`, `message_reactions`, `message_reads`, `message_mentions`, `message_attachments`, `task_history`, `equipment_movements`, `credit_notes`, `sales_lines`, `stock_movements`, `analytical_entries`, `analytical_accounts`, `cost_centers`, `bank_transactions`, `supplier_payments`, `client_notes`, `client_email_logs`.

## User delete pitfall
Never DELETE users by email pattern — payroll/presence FKs will violate. Use upsert (SELECT + UPDATE/INSERT) on @gameasu.tech accounts directly.

**Why:** Old @edole.africa users are referenced by payroll_runs, user_presence, and other tables added after initial seeding. Truncating those tables too makes TRUNCATE order exponentially complex.

**How to apply:** Only run the upsert block for the 7 target demo accounts. Leave old users in place — business data is fully truncated above anyway.
