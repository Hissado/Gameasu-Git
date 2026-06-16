---
name: Multi-tenant isolation must cover joins, not just the base WHERE
description: Org-scoping the base table is not enough — join conditions and overlap/aggregation subqueries leak foreign column values unless they too carry an organizationId filter.
---

Org-scoping a list endpoint by adding `eq(table.organizationId, orgId)` to the top-level WHERE only scopes the **row set**. Any `leftJoin`/`innerJoin` or secondary query that pulls columns from *another* table still leaks foreign-tenant values if the join condition is keyed solely on a foreign key.

**Why:** an org-A row can reference a foreign-org id (corrupted/legacy data, or a create path that never validated ownership). A join `leftJoin(categories, eq(equipment.categoryId, categories.id))` then surfaces the foreign category *name* even though the equipment row itself is org-A. Same for client names in ACL joins and for rental-overlap subqueries keyed only on `equipmentId`.

**How to apply (in this repo, api-server routes):**
- Every join that reads a tenant-owned table must add the org predicate to the join's `and(...)`, e.g. `leftJoin(categories, and(eq(equipment.categoryId, categories.id), eq(categories.organizationId, orgId)))`.
- Overlap/availability subqueries (rentals × rental_items) must filter BOTH tables by org, not just rely on a parent 404.
- Admin endpoints acting on a `:id` user/client: verify the *target* belongs to the caller org (404/400) before read or mutate, and org-scope the delete in replace-style PUTs.

**Test pattern:** drive from a user in an org that has *no* data and assert empty/zero/404, then a same-org happy path returns the data — see the cross-tenant smoke recipe (mint `auth_sessions` UUID token, curl `localhost:80/api` Bearer, delete session). Base64 legacy tokens are rejected for these.
