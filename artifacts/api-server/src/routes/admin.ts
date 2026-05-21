import { Router } from "express";
import { db } from "@workspace/db";
import {
  rolesTable, permissionsTable, rolePermissionsTable,
  userProjectAccessTable, auditLogsTable, usersTable,
  departmentsTable, projectsTable, userClientAccessTable, clientsTable,
} from "@workspace/db";
import { and, eq, ilike, sql, desc, inArray } from "drizzle-orm";
import { randomBytes, randomUUID } from "node:crypto";
import { requirePermission } from "../middlewares/permissions";
import { invalidatePermissionsCache } from "../lib/rbac/permissions";
import { audit } from "../lib/audit";
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
  if (!isUuid(req.params.id)) return res.status(400).json({ error: "id invalide" });
  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, req.params.id)).limit(1);
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
  if (!isUuid(req.params.id)) return res.status(400).json({ error: "id invalide" });
  const [existing] = await db.select().from(rolesTable).where(eq(rolesTable.id, req.params.id)).limit(1);
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
  const [r] = await db.update(rolesTable).set(upd).where(eq(rolesTable.id, req.params.id)).returning();
  invalidatePermissionsCache();
  await audit(req, "update", { entityType: "role", entityId: r.id, payload: { before: existing, after: r } });
  return res.json(r);
});

router.delete("/admin/roles/:id", requirePermission("roles.manage"), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: "id invalide" });
  const [r] = await db.select().from(rolesTable).where(eq(rolesTable.id, req.params.id)).limit(1);
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
  if (!isUuid(req.params.id)) return res.status(400).json({ error: "id invalide" });
  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, req.params.id)).limit(1);
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
  if (!isUuid(req.params.id)) return res.status(400).json({ error: "id invalide" });
  const { code, name, description, parentId, headCollaboratorId, color } = req.body || {};
  const [before] = await db.select().from(departmentsTable).where(eq(departmentsTable.id, req.params.id)).limit(1);
  if (!before) return res.status(404).json({ error: "Introuvable" });
  const [d] = await db.update(departmentsTable)
    .set({ code, name, description, parentId, headCollaboratorId, color })
    .where(eq(departmentsTable.id, req.params.id)).returning();
  await audit(req, "update", { entityType: "department", entityId: d.id, payload: { before, after: d } });
  return res.json(d);
});

router.delete("/departments/:id", requirePermission("departments.manage"), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: "id invalide" });
  const [d] = await db.select().from(departmentsTable).where(eq(departmentsTable.id, req.params.id)).limit(1);
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

  return res.status(201).json({
    userId,
    email: email.toLowerCase(),
    acceptUrl,
    temporaryPassword: tempPassword,
    expiresAt,
    delivery,
  });
});

router.post("/admin/users/:id/resend-invitation", requirePermission("users.invite"), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: "id invalide" });
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, req.params.id)).limit(1);
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
  return res.json({ acceptUrl, temporaryPassword: tempPassword, expiresAt, delivery });
});

router.get("/admin/invitations", requirePermission("users.invite"), async (_req, res) => {
  const rows = await db.select({
    id: usersTable.id, email: usersTable.email, firstName: usersTable.firstName, lastName: usersTable.lastName,
    role: usersTable.role, invitedAt: usersTable.invitedAt, acceptedAt: usersTable.acceptedAt,
    invitedById: usersTable.invitedById, expiresAt: usersTable.passwordResetTokenExpiresAt,
    isActive: usersTable.isActive,
  }).from(usersTable)
    .where(sql`${usersTable.invitedAt} IS NOT NULL`)
    .orderBy(desc(usersTable.invitedAt));
  return res.json({ data: rows, preview: getPreviewInbox(20) });
});

// Gestion accès projet
router.get("/admin/users/:id/project-access", requirePermission("users.assign_projects"), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: "id invalide" });
  const rows = await db.select({
    id: userProjectAccessTable.id,
    projectId: userProjectAccessTable.projectId,
    accessLevel: userProjectAccessTable.accessLevel,
    grantedAt: userProjectAccessTable.grantedAt,
    projectName: projectsTable.name,
  }).from(userProjectAccessTable)
    .leftJoin(projectsTable, eq(projectsTable.id, userProjectAccessTable.projectId))
    .where(eq(userProjectAccessTable.userId, req.params.id));
  return res.json({ data: rows });
});

router.put("/admin/users/:id/project-access", requirePermission("users.assign_projects"), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: "id invalide" });
  const { items } = req.body || {};
  if (!Array.isArray(items)) return res.status(400).json({ error: "items doit être un tableau" });
  for (const it of items) {
    if (!isUuid(it?.projectId)) return res.status(400).json({ error: "projectId UUID requis" });
    if (!["viewer", "editor", "manager"].includes(it.accessLevel)) return res.status(400).json({ error: "accessLevel invalide" });
  }
  await db.transaction(async (tx) => {
    await tx.delete(userProjectAccessTable).where(eq(userProjectAccessTable.userId, req.params.id));
    if (items.length > 0) {
      await tx.insert(userProjectAccessTable).values(items.map((it: any) => ({
        userId: req.params.id, projectId: it.projectId, accessLevel: it.accessLevel,
        grantedById: req.authUser?.id ?? null,
      })));
    }
  });
  invalidatePermissionsCache(req.params.id);
  await audit(req, "project_access_grant", { entityType: "user", entityId: req.params.id, payload: items });
  return res.json({ success: true, count: items.length });
});

// ════════════════════════════════════════════════════════════════════
// ACCÈS CLIENT — gestion ACL client-first
// ════════════════════════════════════════════════════════════════════
router.get("/admin/users/:id/client-access", requirePermission("users.assign_projects"), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: "id invalide" });
  const rows = await db.select({
    id: userClientAccessTable.id,
    clientId: userClientAccessTable.clientId,
    accessLevel: userClientAccessTable.accessLevel,
    grantedAt: userClientAccessTable.grantedAt,
    clientName: clientsTable.name,
  }).from(userClientAccessTable)
    .leftJoin(clientsTable, eq(clientsTable.id, userClientAccessTable.clientId))
    .where(eq(userClientAccessTable.userId, req.params.id));
  return res.json({ data: rows });
});

router.put("/admin/users/:id/client-access", requirePermission("users.assign_projects"), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: "id invalide" });
  const { items } = req.body || {};
  if (!Array.isArray(items)) return res.status(400).json({ error: "items doit être un tableau" });
  for (const it of items) {
    if (!isUuid(it?.clientId)) return res.status(400).json({ error: "clientId UUID requis" });
    if (!["viewer", "editor", "manager"].includes(it.accessLevel)) return res.status(400).json({ error: "accessLevel invalide" });
  }
  await db.transaction(async (tx) => {
    await tx.delete(userClientAccessTable).where(eq(userClientAccessTable.userId, req.params.id));
    if (items.length > 0) {
      await tx.insert(userClientAccessTable).values(items.map((it: any) => ({
        userId: req.params.id, clientId: it.clientId, accessLevel: it.accessLevel,
        grantedById: req.authUser?.id ?? null,
      })));
    }
  });
  invalidatePermissionsCache(req.params.id);
  await audit(req, "client_access_grant", { entityType: "user", entityId: req.params.id, payload: items });
  return res.json({ success: true, count: items.length });
});

// ════════════════════════════════════════════════════════════════════
// AUDIT LOGS
// ════════════════════════════════════════════════════════════════════
router.get("/admin/audit", requirePermission("audit.read"), async (req, res) => {
  const { action, entityType, userId, q, limit = "100" } = req.query as Record<string, string>;
  const conds = [] as any[];
  if (action) conds.push(eq(auditLogsTable.action, action));
  if (entityType) conds.push(eq(auditLogsTable.entityType, entityType));
  if (userId && isUuid(userId)) conds.push(eq(auditLogsTable.userId, userId));
  if (q) conds.push(ilike(auditLogsTable.userEmail, `%${q}%`));
  const lim = Math.min(Math.max(parseInt(limit) || 100, 1), 500);
  const where = conds.length ? and(...conds) : undefined;
  const rows = await db.select().from(auditLogsTable).where(where as any).orderBy(desc(auditLogsTable.createdAt)).limit(lim);
  return res.json({ data: rows });
});

// ════════════════════════════════════════════════════════════════════
// SEED DEMO — peuplement de données de démonstration cross-modules
// ════════════════════════════════════════════════════════════════════
router.post("/admin/seed-demo", requirePermission("users.assign_projects"), async (req, res) => {
  try {
    const force = req.query.force === "true" || req.body?.force === true;
    const result = await seedDemo({ force });
    await audit(req as any, force ? "update" : "create", { entityType: "demo_seed", payload: { force, ...result } });
    return res.json(result);
  } catch (e: any) {
    console.error("[seed-demo]", e);
    return res.status(500).json({ error: e?.message ?? "Erreur lors de la génération des données de démo" });
  }
});

export default router;
