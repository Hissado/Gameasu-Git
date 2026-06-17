---
name: Organization (tenant) hard-delete FK blockers
description: Why deleting an organization needs explicit cleanup of 4 user-referencing tables before the FK cascade.
---

# Deleting an organization (tenant)

Hard-deleting a row from `organizations` cascades cleanly across ~167 child tables
because almost every org-scoped FK uses `onDelete: cascade`. An org's `users` are
themselves cascade-deleted.

**The catch:** exactly 4 tables reference `users` with `ON DELETE NO ACTION`, so when
the org's users are cascade-deleted these references throw an FK error:

- `user_presence.user_id` — NOT NULL (PK) → DELETE the rows
- `cockpit_audit_logs.actor_id` — nullable → SET NULL (preserve the global audit log)
- `incidents.created_by_id` — nullable → SET NULL (preserve the incident)
- `role_permissions.granted_by_id` — nullable → SET NULL (preserve the grant)

`user_presence` is the one that bites in practice: every tenant that ever connected has
presence rows, so a naive `db.delete(organizations)` fails with
`user_presence_user_id_users_id_fk`.

**The rule:** any FK-safe org (or bulk user) deletion must neutralize these 4 in the same
transaction, scoped to the org's users, BEFORE deleting the org. Implemented in
`artifacts/api-server/src/services/delete-organization.ts` (subquery-scoped, not a JS
id array, to avoid param-count limits on huge tenants).

**Why:** the only blockers are these 4 because they are the sole FKs whose parent is in
the org-cascade closure but whose child table is not. Verify with a `pg_constraint`
delete-rule graph analysis (BFS from `organizations` over cascade edges) if the schema
changes — a new `NO ACTION`/`RESTRICT` FK to any cascade-deleted table would regress this.

**How to apply:** keep platform-org / isDefault guards in the route; require typed-name
confirmation; both Cockpit entry points (tenants list `index.tsx` + `detail.tsx`) must
send `{ confirm }` in the DELETE body.
