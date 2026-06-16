import { Router } from "express";
import { db } from "@workspace/db";
import {
  rolesTable, permissionsTable, rolePermissionsTable,
  userProjectAccessTable, auditLogsTable, usersTable,
  departmentsTable, projectsTable, userClientAccessTable, clientsTable,
  userPermissionOverridesTable,
} from "@workspace/db";
import { and, eq, ilike, sql, desc, inArray, gte, lte } from "drizzle-orm";
import { randomBytes, randomUUID } from "node:crypto";
import { requirePermission } from "../middlewares/permissions";
import { invalidatePermissionsCache } from "../lib/rbac/permissions";
import { audit } from "../lib/audit";
import { getCurrentOrganizationId } from "../lib/tenant";
import { sendEmail, buildInvitationEmail, buildPasswordResetEmail, getPreviewInbox } from "../lib/email";
import { seedDemo } from "../services/demo-seed";

const router = Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: any) => typeof v === "string" && UUID_RE.test(v);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function genTempPassword(): string {
  // 10 chars : maj, min, chiffre, symbole — facile à dicter mais robuste.
  const ch = "ABCDEFGHJKMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz!@#%&*";
  let out = "";
  for (let i = 0; i < 10; i++) out += ch[Math.floor(Math.random() * ch.length)];
  return out;
}
function genToken(): string { return randomBytes(32).toString("hex"); }

// ════════════════════════════════════════════════════════════════════
// PERMISSIONS — catalogue (lecture seule)
// ════════════════════════════════════════════════════════════════════
router.get("/admin/permissions", requirePermission("roles.read"), async (_req, res) => {
  const rows = await db.select().from(permissionsTable).orderBy(permissionsTable.category, permissionsTable.code);
  return res.json({ data: rows });
});

// ════════════════════════════════════════════════════════════════════
// ROLES — CRUD + matrice permissions
// ════════════════════════════════════════════════════════════════════
router.get("/admin/roles", requirePermission("roles.read"), async (_req, res) => {
  const roles = await db.select().from(rolesTable).orderBy(desc(sql`COALESCE((${rolesTable.level})::int, 0)`));
  // Compte les permissions par rôle.
  const counts = await db
    .select({ roleId: rolePermissionsTable.roleId, n: sql<number>`COUNT(*)` })
    .from(rolePermissionsTable).groupBy(rolePermissionsTable.roleId);
  const byRole = new Map(counts.map(c => [c.roleId, Number(c.n)]));
  // Compte les utilisateurs par rôle (matching role.code).
  const userCounts = await db
    .select({ role: usersTable.role, n: sql<number>`COUNT(*)` })
    .from(usersTable).where(eq(usersTable.isActive, true)).groupBy(usersTable.role);
  const usersByRole = new Map(userCounts.map(c => [c.role, Number(c.n)]));
  return res.json({
    data: roles.map(r => ({
      ...r,
      permissionsCount: byRole.get(r.id) ?? 0,
      usersCount: usersByRole.get(r.code) ?? 0,
    })),
  });
});

router.get("/admin/roles/:id", requirePermission("roles.read"), async (req, res) => {
  if (!isUuid((req.params.id as string))) return res.status(400).json({ error: "id invalide" });
  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, (req.params.id as string))).limit(1);
  if (!role) return res.status(404).json({ error: "Introuvable" });
  const perms = await db
    .select({ id: permissionsTable.id, code: permissionsTable.code })
    .from(rolePermissionsTable)
    .innerJoin(permissionsTable, eq(rolePermissionsTable.permissionId, permissionsTable.id))
    .where(eq(rolePermissionsTable.roleId, role.id));
  return res.json({ ...role, permissionIds: perms.map(p => p.id), permissionCodes: perms.map(p => p.code) });
});

router.post("/admin/roles", requirePermission("roles.manage"), async (req, res) => {
  const { code, name, description, level } = req.body || {};
  if (typeof code !== "string" || !code.trim()) return res.status(400).json({ error: "code requis" });
  if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "name requis" });
  if (!/^[a-z0-9_]+$/.test(code.trim())) return res.status(400).json({ error: "code : minuscules, chiffres, underscores uniquement" });
  try {
    const [r] = await db.insert(rolesTable).values({
      code: code.trim(), name: name.trim(), description, level: level ?? 10, isSystem: false,
    }).returning();
    await audit(req, "create", { entityType: "role", entityId: r.id, payload: r });
    return res.status(201).json(r);
  } catch (e: any) {
    if (e?.code === "23505") return res.status(409).json({ error: "Un rôle avec ce code existe déjà" });
    return res.status(500).json({ error: e.message });
  }
});

router.put("/admin/roles/:id", requirePermission("roles.manage"), async (req, res) => {
  if (!isUuid((req.params.id as string))) return res.status(400).json({ error: "id invalide" });
  const [existing] = await db.select().from(rolesTable).where(eq(rolesTable.id, (req.params.id as string))).limit(1);
  if (!existing) return res.status(404).json({ error: "Introuvable" });
  const { name, description, level } = req.body || {};
  const upd: any = {};
  if (name !== undefined) upd.name = String(name).trim();
  if (description !== undefined) upd.description = description;
  if (level !== undefined) upd.level = level;
  // Le code est immuable pour les rôles système (utilisé par usersTable.role).
  if (!existing.isSystem && req.body?.code !== undefined) {
    if (!/^[a-z0-9_]+$/.test(String(req.body.code))) return res.status(400).json({ error: "code invalide" });
    upd.code = req.body.code;
  }
  const [r] = await db.update(rolesTable).set(upd).where(eq(rolesTable.id, (req.params.id as string))).returning();
  invalidatePermissionsCache();
  await audit(req, "update", { entityType: "role", entityId: r.id, payload: { before: existing, after: r } });
  return res.json(r);
});

router.delete("/admin/roles/:id", requirePermission("roles.manage"), async (req, res) => {
  if (!isUuid((req.params.id as string))) return res.status(400).json({ error: "id invalide" });
  const [r] = await db.select().from(rolesTable).where(eq(rolesTable.id, (req.params.id as string))).limit(1);
  if (!r) return res.status(404).json({ error: "Introuvable" });
  if (r.isSystem) return res.status(400).json({ error: "Rôle système non supprimable" });
  // Vérifier qu'aucun utilisateur ne porte ce rôle.
  const [{ n }] = await db.select({ n: sql<number>`COUNT(*)::int` }).from(usersTable).where(eq(usersTable.role, r.code));
  if (Number(n) > 0) return res.status(400).json({ error: `Impossible : ${n} utilisateur(s) utilisent ce rôle` });
  await db.delete(rolesTable).where(eq(rolesTable.id, r.id));
  invalidatePermissionsCache();
  await audit(req, "delete", { entityType: "role", entityId: r.id, payload: r });
  return res.status(204).send();
});

// Mise à jour de la matrice de permissions d'un rôle (remplacement complet).
router.put("/admin/roles/:id/permissions", requirePermission("roles.manage"), async (req, res) => {
  if (!isUuid((req.params.id as string))) return res.status(400).json({ error: "id invalide" });
  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, (req.params.id as string))).limit(1);
  if (!role) return res.status(404).json({ error: "Introuvable" });
  const { permissionIds } = req.body || {};
  if (!Array.isArray(permissionIds)) return res.status(400).json({ error: "permissionIds doit être un tableau" });
  const cleanIds = permissionIds.filter(isUuid);
  // Vérifie que toutes les permissions existent.
  if (cleanIds.length > 0) {
    const found = await db.select({ id: permissionsTable.id }).from(permissionsTable).where(inArray(permissionsTable.id, cleanIds));
    if (found.length !== cleanIds.length) return res.status(400).json({ error: "Permission inconnue dans la liste" });
  }
  await db.transaction(async (tx) => {
    await tx.delete(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, role.id));
    if (cleanIds.length > 0) {
      await tx.insert(rolePermissionsTable).values(cleanIds.map((pid) => ({
        roleId: role.id, permissionId: pid, grantedById: req.authUser?.id ?? null,
      })));
    }
  });
  invalidatePermissionsCache();
  await audit(req, "permission_change", { entityType: "role", entityId: role.id, payload: { permissionIds: cleanIds } });
  return res.json({ success: true, count: cleanIds.length });
});

// ════════════════════════════════════════════════════════════════════
// DUPLICATION DE RÔLE
// ════════════════════════════════════════════════════════════════════
router.post("/admin/roles/:id/duplicate", requirePermission("roles.manage"), async (req, res, next) => {
  try {
    if (!isUuid((req.params.id as string))) return res.status(400).json({ error: "id invalide" });
    const [src] = await db.select().from(rolesTable).where(eq(rolesTable.id, (req.params.id as string))).limit(1);
    if (!src) return res.status(404).json({ error: "Introuvable" });
    const rawCode = (req.body?.newCode ?? `${src.code}_copie`).toString().trim();
    const rawName = (req.body?.newName ?? `${src.name} (copie)`).toString().trim();
    if (!/^[a-z0-9_]+$/.test(rawCode)) return res.status(400).json({ error: "code invalide (minuscules, chiffres, _)" });
    const srcPerms = await db
      .select({ permissionId: rolePermissionsTable.permissionId })
      .from(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, src.id));
    const [newRole] = await db.insert(rolesTable).values({
      code: rawCode, name: rawName,
      description: src.description ? `Copie de : ${src.description}` : undefined,
      level: src.level, isSystem: false,
    }).returning();
    if (srcPerms.length > 0) {
      await db.insert(rolePermissionsTable).values(srcPerms.map((p) => ({
        roleId: newRole.id, permissionId: p.permissionId, grantedById: req.authUser?.id ?? null,
      })));
    }
    invalidatePermissionsCache();
    await audit(req, "create", { entityType: "role", entityId: newRole.id, payload: { duplicatedFrom: src.id, ...newRole } });
    return res.status(201).json({ ...newRole, permissionsCount: srcPerms.length, usersCount: 0 });
  } catch (e: any) {
    if (e?.code === "23505") return res.status(409).json({ error: "Un rôle avec ce code existe déjà" });
    return next(e);
  }
});

// ════════════════════════════════════════════════════════════════════
// ACCÈS EFFECTIFS D'UN UTILISATEUR (permissions rôle + surcharges)
// ════════════════════════════════════════════════════════════════════
router.get("/admin/users/:id/effective-permissions", requirePermission("users.read"), async (req, res, next) => {
  try {
    if (!isUuid((req.params.id as string))) return res.status(400).json({ error: "id invalide" });
    const [u] = await db.select({
      id: usersTable.id, email: usersTable.email,
      firstName: usersTable.firstName, lastName: usersTable.lastName,
      role: usersTable.role, isActive: usersTable.isActive,
    }).from(usersTable).where(eq(usersTable.id, (req.params.id as string))).limit(1);
    if (!u) return res.status(404).json({ error: "Introuvable" });
    const isFullAccess = u.role === "super_admin" || u.role === "admin";
    const [roleRow] = await db.select().from(rolesTable).where(eq(rolesTable.code, u.role)).limit(1);
    let rolePermDetails: { code: string; label: string; category: string }[] = [];
    if (roleRow) {
      rolePermDetails = await db
        .select({ code: permissionsTable.code, label: permissionsTable.label, category: permissionsTable.category })
        .from(rolePermissionsTable)
        .innerJoin(permissionsTable, eq(rolePermissionsTable.permissionId, permissionsTable.id))
        .where(eq(rolePermissionsTable.roleId, roleRow.id))
        .orderBy(permissionsTable.category, permissionsTable.code);
    }
    const projectAccess = await db
      .select({
        projectId: userProjectAccessTable.projectId,
        accessLevel: userProjectAccessTable.accessLevel,
        projectName: projectsTable.name,
      })
      .from(userProjectAccessTable)
      .leftJoin(projectsTable, eq(projectsTable.id, userProjectAccessTable.projectId))
      .where(eq(userProjectAccessTable.userId, u.id));
    // Surcharges individuelles (actives + expirées)
    const overrides = await db
      .select()
      .from(userPermissionOverridesTable)
      .where(eq(userPermissionOverridesTable.userId, u.id))
      .orderBy(desc(userPermissionOverridesTable.createdAt));
    const now = new Date();
    const activeOverrides = overrides.filter((ov) => !ov.expiresAt || ov.expiresAt > now);
    const grantCodes = new Set(activeOverrides.filter((o) => o.type === "grant").map((o) => o.permissionCode));
    const denyCodes = new Set(activeOverrides.filter((o) => o.type === "deny").map((o) => o.permissionCode));
    // permissions effectives = (rôle ∪ grants) - denies
    const effectiveSet = new Set(rolePermDetails.map((p) => p.code));
    grantCodes.forEach((c) => effectiveSet.add(c));
    denyCodes.forEach((c) => effectiveSet.delete(c));
    return res.json({
      user: u, role: roleRow ?? null,
      isFullAccess,
      permissions: Array.from(effectiveSet),
      permissionDetails: rolePermDetails,
      projectAccess,
      overrides: activeOverrides,
      overridesAll: overrides,
    });
  } catch (e) { return next(e); }
});

// SURCHARGES DE PERMISSIONS — CRUD
// ════════════════════════════════════════════════════════════════════
router.get("/admin/users/:id/permission-overrides", requirePermission("users.read"), async (req, res, next) => {
  try {
    if (!isUuid((req.params.id as string))) return res.status(400).json({ error: "id invalide" });
    const overrides = await db
      .select()
      .from(userPermissionOverridesTable)
      .where(eq(userPermissionOverridesTable.userId, (req.params.id as string)))
      .orderBy(desc(userPermissionOverridesTable.createdAt));
    return res.json({ data: overrides });
  } catch (e) { return next(e); }
});

router.post("/admin/users/:id/permission-overrides", requirePermission("users.manage"), async (req, res, next) => {
  try {
    if (!isUuid((req.params.id as string))) return res.status(400).json({ error: "id invalide" });
    const { permissionCode, type, reason, expiresAt } = req.body || {};
    if (!permissionCode || !type || !["grant", "deny"].includes(type)) {
      return res.status(400).json({ error: "permissionCode et type (grant|deny) requis" });
    }
    const [u] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, (req.params.id as string))).limit(1);
    if (!u) return res.status(404).json({ error: "Utilisateur introuvable" });
    const [ov] = await db
      .insert(userPermissionOverridesTable)
      .values({
        userId: (req.params.id as string), permissionCode, type,
        reason: reason || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        grantedBy: req.authUser!.id,
      })
      .onConflictDoUpdate({
        target: [userPermissionOverridesTable.userId, userPermissionOverridesTable.permissionCode],
        set: { type, reason: reason || null, expiresAt: expiresAt ? new Date(expiresAt) : null, grantedBy: req.authUser!.id },
      })
      .returning();
    invalidatePermissionsCache((req.params.id as string));
    await audit(req, "permission_change", { entityType: "user", entityId: (req.params.id as string), payload: { added: { type, permissionCode, reason, expiresAt } } });
    return res.status(201).json(ov);
  } catch (e) { return next(e); }
});

router.delete("/admin/users/:id/permission-overrides/:overrideId", requirePermission("users.manage"), async (req, res, next) => {
  try {
    if (!isUuid((req.params.id as string)) || !isUuid((req.params.overrideId as string))) return res.status(400).json({ error: "id invalide" });
    const [deleted] = await db
      .delete(userPermissionOverridesTable)
      .where(and(eq(userPermissionOverridesTable.id, (req.params.overrideId as string)), eq(userPermissionOverridesTable.userId, (req.params.id as string))))
      .returning();
    if (!deleted) return res.status(404).json({ error: "Surcharge introuvable" });
    invalidatePermissionsCache((req.params.id as string));
    await audit(req, "permission_change", { entityType: "user", entityId: (req.params.id as string), payload: { removed: deleted } });
    return res.json({ ok: true });
  } catch (e) { return next(e); }
});

// ════════════════════════════════════════════════════════════════════
// DÉPARTEMENTS — alias propres, déjà servis dans /hr
// ════════════════════════════════════════════════════════════════════
// Conserver le CRUD existant dans /hr/departments (ancien) + monter ici un
// alias pour l'usage admin avec contrôle de permission moderne.
router.get("/departments", requirePermission("departments.read"), async (_req, res) => {
  const rows = await db.select().from(departmentsTable).orderBy(departmentsTable.name);
  // Compte les utilisateurs (table users.departmentId).
  const counts = await db
    .select({ deptId: usersTable.departmentId, n: sql<number>`COUNT(*)::int` })
    .from(usersTable).groupBy(usersTable.departmentId);
  const byDept = new Map(counts.map(c => [c.deptId, Number(c.n)]));
  return res.json({ data: rows.map(d => ({ ...d, usersCount: byDept.get(d.id) ?? 0 })) });
});

router.post("/departments", requirePermission("departments.manage"), async (req, res) => {
  const { code, name, description, parentId, headCollaboratorId, color } = req.body || {};
  if (!code || !name) return res.status(400).json({ error: "code et name requis" });
  try {
    const [d] = await db.insert(departmentsTable).values({
      organizationId: req.authUser!.organizationId, code, name, description, parentId, headCollaboratorId, color }).returning();
    await audit(req, "create", { entityType: "department", entityId: d.id, payload: d });
    return res.status(201).json(d);
  } catch (e: any) {
    if (e?.code === "23505") return res.status(409).json({ error: "Code département déjà utilisé" });
    return res.status(500).json({ error: e.message });
  }
});

router.put("/departments/:id", requirePermission("departments.manage"), async (req, res) => {
  if (!isUuid((req.params.id as string))) return res.status(400).json({ error: "id invalide" });
  const { code, name, description, parentId, headCollaboratorId, color } = req.body || {};
  const [before] = await db.select().from(departmentsTable).where(eq(departmentsTable.id, (req.params.id as string))).limit(1);
  if (!before) return res.status(404).json({ error: "Introuvable" });
  const [d] = await db.update(departmentsTable)
    .set({ code, name, description, parentId, headCollaboratorId, color })
    .where(eq(departmentsTable.id, (req.params.id as string))).returning();
  await audit(req, "update", { entityType: "department", entityId: d.id, payload: { before, after: d } });
  return res.json(d);
});

router.delete("/departments/:id", requirePermission("departments.manage"), async (req, res) => {
  if (!isUuid((req.params.id as string))) return res.status(400).json({ error: "id invalide" });
  const [d] = await db.select().from(departmentsTable).where(eq(departmentsTable.id, (req.params.id as string))).limit(1);
  if (!d) return res.status(404).json({ error: "Introuvable" });
  // Détachement : on libère les utilisateurs et collaborateurs rattachés.
  await db.update(usersTable).set({ departmentId: null }).where(eq(usersTable.departmentId, d.id));
  await db.delete(departmentsTable).where(eq(departmentsTable.id, d.id));
  await audit(req, "delete", { entityType: "department", entityId: d.id, payload: d });
  return res.status(204).send();
});

// ════════════════════════════════════════════════════════════════════
// USERS — invitations, project access, désactivation
// ════════════════════════════════════════════════════════════════════
router.post("/admin/users/invite", requirePermission("users.invite"), async (req, res) => {
  const { email, firstName, lastName, role = "collaborator", phone, departmentId, projectIds = [], permissionsHint } = req.body || {};
  if (typeof email !== "string" || !EMAIL_RE.test(email)) return res.status(400).json({ error: "email invalide" });
  if (!firstName || !lastName) return res.status(400).json({ error: "firstName et lastName requis" });
  // Vérifier que le rôle existe.
  const [roleRow] = await db.select().from(rolesTable).where(eq(rolesTable.code, role)).limit(1);
  if (!roleRow) return res.status(400).json({ error: "Rôle inconnu" });
  if (departmentId && !isUuid(departmentId)) return res.status(400).json({ error: "departmentId invalide" });
  const cleanProjectIds = Array.isArray(projectIds) ? projectIds.filter(isUuid) : [];
  // Vérifier non-collision email.
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (existing) return res.status(409).json({ error: "Un compte existe déjà avec cet email" });

  const tempPassword = genTempPassword();
  const token = genToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const userId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(usersTable).values({
      id: userId,
      organizationId: req.authUser!.organizationId,
      email: email.toLowerCase(),
      password: tempPassword,
      firstName, lastName,
      role: roleRow.code,
      phone, departmentId: departmentId || null,
      isActive: true,
      mustChangePassword: true,
      passwordResetToken: token,
      passwordResetTokenExpiresAt: expiresAt,
      invitedById: req.authUser?.id ?? null,
      invitedAt: new Date(),
    });
    if (cleanProjectIds.length > 0) {
      await tx.insert(userProjectAccessTable).values(cleanProjectIds.map((pid) => ({
        userId, projectId: pid, accessLevel: "viewer", grantedById: req.authUser?.id ?? null,
      })));
    }
  });

  const baseUrl = (process.env.PUBLIC_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN || "localhost"}`).replace(/\/$/, "");
  const acceptUrl = `${baseUrl}/accept-invitation?token=${token}`;
  const inviterName = req.authUser ? `${req.authUser.firstName} ${req.authUser.lastName}` : "Un administrateur";
  const tpl = buildInvitationEmail({
    recipientName: `${firstName} ${lastName}`,
    inviterName, acceptUrl, temporaryPassword: tempPassword,
  });
  const delivery = await sendEmail({ ...tpl, to: email });
  void permissionsHint;

  await audit(req, "invite", { entityType: "user", entityId: userId, payload: { email, role: roleRow.code, projectIds: cleanProjectIds, delivery } });
  await audit(req, "invitation_sent", { entityType: "user", entityId: userId, payload: { email, delivery } });

  return res.status(201).json({
    userId,
    email: email.toLowerCase(),
    acceptUrl,
    temporaryPassword: tempPassword,
    expiresAt,
    delivery,
  });
});

router.post("/admin/users/:id/revoke-invitation", requirePermission("users.invite"), async (req, res) => {
  if (!isUuid((req.params.id as string))) return res.status(400).json({ error: "id invalide" });
  const [u] = await db.select().from(usersTable)
    .where(and(
      eq(usersTable.id, (req.params.id as string)),
      eq(usersTable.organizationId, req.authUser!.organizationId),
    )).limit(1);
  if (!u) return res.status(404).json({ error: "Utilisateur introuvable" });
  if (u.acceptedAt) return res.status(400).json({ error: "Ce compte est déjà activé" });
  await db.update(usersTable).set({
    mustChangePassword: false,
    passwordResetToken: null,
    passwordResetTokenExpiresAt: null,
    isActive: false,
  }).where(eq(usersTable.id, u.id));
  await audit(req, "invitation_revoke", { entityType: "user", entityId: u.id, payload: { email: u.email } });
  return res.json({ success: true });
});

router.post("/admin/users/:id/resend-invitation", requirePermission("users.invite"), async (req, res) => {
  if (!isUuid((req.params.id as string))) return res.status(400).json({ error: "id invalide" });
  const [u] = await db.select().from(usersTable)
    .where(and(eq(usersTable.id, (req.params.id as string)), eq(usersTable.organizationId, req.authUser!.organizationId)))
    .limit(1);
  if (!u) return res.status(404).json({ error: "Introuvable" });
  if (u.acceptedAt) return res.status(400).json({ error: "Invitation déjà acceptée" });
  const tempPassword = genTempPassword();
  const token = genToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.update(usersTable).set({
    password: tempPassword, mustChangePassword: true,
    passwordResetToken: token, passwordResetTokenExpiresAt: expiresAt,
    invitedAt: new Date(),
  }).where(eq(usersTable.id, u.id));
  const baseUrl = (process.env.PUBLIC_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN || "localhost"}`).replace(/\/$/, "");
  const acceptUrl = `${baseUrl}/accept-invitation?token=${token}`;
  const inviterName = req.authUser ? `${req.authUser.firstName} ${req.authUser.lastName}` : "Un administrateur";
  const tpl = buildInvitationEmail({
    recipientName: `${u.firstName} ${u.lastName}`,
    inviterName, acceptUrl, temporaryPassword: tempPassword,
  });
  const delivery = await sendEmail({ ...tpl, to: u.email });
  invalidatePermissionsCache(u.id);
  await audit(req, "invitation_resend", { entityType: "user", entityId: u.id, payload: { delivery } });
  await audit(req, "invitation_sent", { entityType: "user", entityId: u.id, payload: { email: u.email, delivery } });
  return res.json({ acceptUrl, temporaryPassword: tempPassword, expiresAt, delivery });
});

router.get("/admin/invitations", requirePermission("users.invite"), async (req, res) => {
  const rows = await db.select({
    id: usersTable.id, email: usersTable.email, firstName: usersTable.firstName, lastName: usersTable.lastName,
    role: usersTable.role, invitedAt: usersTable.invitedAt, acceptedAt: usersTable.acceptedAt,
    invitedById: usersTable.invitedById, expiresAt: usersTable.passwordResetTokenExpiresAt,
    isActive: usersTable.isActive,
  }).from(usersTable)
    .where(and(
      eq(usersTable.organizationId, req.authUser!.organizationId),
      sql`${usersTable.invitedAt} IS NOT NULL`,
    ))
    .orderBy(desc(usersTable.invitedAt));
  return res.json({ data: rows, preview: getPreviewInbox(20) });
});

// Gestion accès projet
router.get("/admin/users/:id/project-access", requirePermission("users.assign_projects"), async (req, res) => {
  if (!isUuid((req.params.id as string))) return res.status(400).json({ error: "id invalide" });
  const rows = await db.select({
    id: userProjectAccessTable.id,
    projectId: userProjectAccessTable.projectId,
    accessLevel: userProjectAccessTable.accessLevel,
    grantedAt: userProjectAccessTable.grantedAt,
    projectName: projectsTable.name,
  }).from(userProjectAccessTable)
    .leftJoin(projectsTable, eq(projectsTable.id, userProjectAccessTable.projectId))
    .where(eq(userProjectAccessTable.userId, (req.params.id as string)));
  return res.json({ data: rows });
});

router.put("/admin/users/:id/project-access", requirePermission("users.assign_projects"), async (req, res) => {
  if (!isUuid((req.params.id as string))) return res.status(400).json({ error: "id invalide" });
  const { items } = req.body || {};
  if (!Array.isArray(items)) return res.status(400).json({ error: "items doit être un tableau" });
  for (const it of items) {
    if (!isUuid(it?.projectId)) return res.status(400).json({ error: "projectId UUID requis" });
    if (!["viewer", "editor", "manager"].includes(it.accessLevel)) return res.status(400).json({ error: "accessLevel invalide" });
  }
  await db.transaction(async (tx) => {
    await tx.delete(userProjectAccessTable).where(eq(userProjectAccessTable.userId, (req.params.id as string)));
    if (items.length > 0) {
      await tx.insert(userProjectAccessTable).values(items.map((it: any) => ({
        userId: (req.params.id as string), projectId: it.projectId, accessLevel: it.accessLevel,
        grantedById: req.authUser?.id ?? null,
      })));
    }
  });
  invalidatePermissionsCache((req.params.id as string));
  await audit(req, "project_access_grant", { entityType: "user", entityId: (req.params.id as string), payload: items });
  return res.json({ success: true, count: items.length });
});

// ════════════════════════════════════════════════════════════════════
// ACCÈS CLIENT — gestion ACL client-first
// ════════════════════════════════════════════════════════════════════
router.get("/admin/users/:id/client-access", requirePermission("users.assign_projects"), async (req, res) => {
  if (!isUuid((req.params.id as string))) return res.status(400).json({ error: "id invalide" });
  const orgId = req.authUser!.organizationId;
  const userId = req.params.id as string;
  const [targetUser] = await db.select({ id: usersTable.id }).from(usersTable)
    .where(and(eq(usersTable.id, userId), eq(usersTable.organizationId, orgId))).limit(1);
  if (!targetUser) return res.status(404).json({ error: "Utilisateur introuvable" });
  const rows = await db.select({
    id: userClientAccessTable.id,
    clientId: userClientAccessTable.clientId,
    accessLevel: userClientAccessTable.accessLevel,
    grantedAt: userClientAccessTable.grantedAt,
    clientName: clientsTable.name,
  }).from(userClientAccessTable)
    .leftJoin(clientsTable, and(eq(clientsTable.id, userClientAccessTable.clientId), eq(clientsTable.organizationId, orgId)))
    .where(and(eq(userClientAccessTable.userId, userId), eq(userClientAccessTable.organizationId, orgId)));
  return res.json({ data: rows });
});

router.put("/admin/users/:id/client-access", requirePermission("users.assign_projects"), async (req, res) => {
  if (!isUuid((req.params.id as string))) return res.status(400).json({ error: "id invalide" });
  const orgId = req.authUser!.organizationId;
  const userId = req.params.id as string;
  const { items } = req.body || {};
  if (!Array.isArray(items)) return res.status(400).json({ error: "items doit être un tableau" });
  for (const it of items) {
    if (!isUuid(it?.clientId)) return res.status(400).json({ error: "clientId UUID requis" });
    if (!["viewer", "editor", "manager"].includes(it.accessLevel)) return res.status(400).json({ error: "accessLevel invalide" });
  }
  // Isolation multi-tenant : l'utilisateur cible doit appartenir à l'organisation
  const [targetUser] = await db.select({ id: usersTable.id }).from(usersTable)
    .where(and(eq(usersTable.id, userId), eq(usersTable.organizationId, orgId))).limit(1);
  if (!targetUser) return res.status(404).json({ error: "Utilisateur introuvable" });
  // ... et tous les clients référencés aussi
  const clientIds = [...new Set(items.map((it: any) => it.clientId as string))];
  if (clientIds.length > 0) {
    const validClients = await db.select({ id: clientsTable.id }).from(clientsTable)
      .where(and(eq(clientsTable.organizationId, orgId), inArray(clientsTable.id, clientIds)));
    if (validClients.length !== clientIds.length) {
      return res.status(400).json({ error: "Un ou plusieurs clients sont introuvables dans l'organisation" });
    }
  }
  await db.transaction(async (tx) => {
    await tx.delete(userClientAccessTable).where(and(eq(userClientAccessTable.userId, userId), eq(userClientAccessTable.organizationId, orgId)));
    if (items.length > 0) {
      await tx.insert(userClientAccessTable).values(items.map((it: any) => ({
        organizationId: orgId,
        userId, clientId: it.clientId, accessLevel: it.accessLevel,
        grantedById: req.authUser?.id ?? null,
      })));
    }
  });
  invalidatePermissionsCache(userId);
  await audit(req, "client_access_grant", { entityType: "user", entityId: userId, payload: items });
  return res.json({ success: true, count: items.length });
});

// ════════════════════════════════════════════════════════════════════
// AUDIT LOGS
// ════════════════════════════════════════════════════════════════════
router.get("/admin/audit", requirePermission("audit.read"), async (req, res) => {
  const { action, entityType, userId, q, limit = "25", from, to, page: pageParam = "1" } = req.query as Record<string, string>;
  const orgId = await getCurrentOrganizationId((req as any).authUser?.id);
  if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }
  const conds = [eq(auditLogsTable.organizationId, orgId)] as any[];
  if (action) conds.push(eq(auditLogsTable.action, action));
  if (entityType) conds.push(eq(auditLogsTable.entityType, entityType));
  if (userId && isUuid(userId)) conds.push(eq(auditLogsTable.userId, userId));
  if (q) conds.push(ilike(auditLogsTable.userEmail, `%${q}%`));
  if (from) { const d = new Date(from); if (!isNaN(d.getTime())) conds.push(gte(auditLogsTable.createdAt, d)); }
  if (to) { const d = new Date(to + "T23:59:59.999Z"); if (!isNaN(d.getTime())) conds.push(lte(auditLogsTable.createdAt, d)); }
  const lim = Math.min(Math.max(parseInt(limit) || 25, 1), 100);
  const page = Math.max(1, parseInt(pageParam) || 1);
  const offset = (page - 1) * lim;
  const where = conds.length ? and(...conds) : undefined;
  const [rows, countRows] = await Promise.all([
    db.select().from(auditLogsTable).where(where as any).orderBy(desc(auditLogsTable.createdAt)).limit(lim).offset(offset),
    db.select({ count: sql<number>`cast(count(*) as int)` }).from(auditLogsTable).where(where as any),
  ]);
  const total = Number(countRows[0]?.count ?? 0);
  const pages = Math.ceil(total / lim);
  return res.json({ data: rows, total, page, limit: lim, pages });
});

// ════════════════════════════════════════════════════════════════════
// SEED DEMO — peuplement de données de démonstration cross-modules
// ════════════════════════════════════════════════════════════════════
router.post("/admin/seed-demo", requirePermission("users.assign_projects"), async (req, res) => {
  try {
    const force = (req.query.force as string) === "true" || req.body?.force === true;
    const result = await seedDemo({ force });
    await audit(req as any, force ? "update" : "create", { entityType: "demo_seed", payload: { force, ...result } });
    return res.json(result);
  } catch (e: any) {
    console.error("[seed-demo]", e);
    return res.status(500).json({ error: e?.message ?? "Erreur lors de la génération des données de démo" });
  }
});

export default router;
