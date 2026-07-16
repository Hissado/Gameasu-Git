---
name: RBAC schema/DB mismatch — role_permissions & user_permission_overrides
description: Two Drizzle schema tables are out of sync with the actual DB; must use raw SQL to query them correctly.
---

## The rule

Never use Drizzle ORM queries for `rolePermissionsTable` or `userPermissionOverridesTable` — the schema definitions don't match the actual DB. Use `db.execute(sql\`...\`)` with the real table/column names instead.

## Details

### role_permissions
- **Schema says**: `permissionCode: text("permission_code")` + no `permissionId`
- **DB has**: `permission_id uuid FK → permissions.id`, `granted_at`, `granted_by_id` (NO `permission_code` column)
- **Correct query** (in permissions.ts):
  ```sql
  SELECT p.code FROM role_permissions rp
  JOIN permissions p ON rp.permission_id = p.id
  WHERE rp.role_id = ${roleId}
  ```

### user_permission_overrides
- **Schema says**: `pgTable("user_perm_overrides", ...)` with field `granted: boolean`
- **DB has**: table `user_permission_overrides`, column `type text` (values: "grant" | "deny"), no `organization_id`
- **Correct query**:
  ```sql
  SELECT permission_code, type, expires_at
  FROM user_permission_overrides
  WHERE user_id = ${userId}
  ```
  Check `type === "grant"` / `type === "deny"`, not a boolean field.

**Why:** The schema was refactored (denormalized to permissionCode) without running drizzle-kit push. The DB kept the original FK-based structure. The mismatch caused `column "permission_code" does not exist` and `relation "user_perm_overrides" does not exist` errors on every `requirePermission()` call and `verify-2fa`, completely blocking auth.

**How to apply:** Any code touching rolePermissionsTable or userPermissionOverridesTable (in permissions.ts, admin routes, seed scripts) must use raw SQL or psql directly. Do NOT run `drizzle-kit push` to "fix" this without verifying all dependent data/indexes won't be dropped.
