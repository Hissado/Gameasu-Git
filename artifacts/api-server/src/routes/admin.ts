import { Router } from "express";
import { db } from "@workspace/db";
import {
  rolesTable, permissionsTable, rolePermissionsTable,
  userProjectAccessTable, auditLogsTable, usersTable,
  departmentsTable, projectsTable, userClientAccessTable, clientsTable,
  userPermissionOverridesTable, organizationMembersTable, organizationsTable,
} from "@workspace/db";
import { and, eq, ilike, sql, desc, inArray, gte, lte, or, isNull } from "drizzle-orm";
import { randomBytes, randomUUID } from "node:crypto";
import { requirePermission } from "../middlewares/permissions";
import { invalidatePermissionsCache } from "../lib/rbac/permissions";
import { audit } from "../lib/audit";
import { getCurrentOrganizationId } from "../lib/tenant";
import { sendEmail, buildInvitationEmail, buildPasswordResetEmail, getPreviewInbox } from "../lib/email";
import { getPublicBaseUrl } from "../lib/url";
import { seedDemo } from "../services/demo-seed";
import { getNumberingSettings, setNumberingPrefix, DEFAULT_PREFIXES, type DocType } from "../services/numbering";

const router = Router();

// ════════════════════════════════════════════════════════════════════
// NUMÉROTATION DES DOCUMENTS — préfixes configurables par organisation
// (audit P2 §F #15). Format {PRÉFIXE}-{AAAA}-{NNNNN}, séquence atomique.
// ════════════════════════════════════════════════════════════════════
router.get("/admin/numbering", requirePermission("settings.read"), async (req, res, next) => {
  try {
    const settings = await getNumberingSettings(req.authUser!.organizationId);
    return res.json({ data: settings });
  } catch (e) { return next(e); }
});

router.put("/admin/numbering/:docType", requirePermission("settings.manage"), async (req, res, next) => {
  try {
    const docType = req.params.docType as DocType;
    if (!(docType in DEFAULT_PREFIXES)) return res.status(400).json({ error: "Type de document inconnu" });
    const { prefix, padding } = req.body || {};
    if (typeof prefix !== "string" || !/^[A-Z0-9]{1,8}$/.test(prefix)) {
      return res.status(400).json({ error: "Préfixe invalide (1 à 8 lettres majuscules ou chiffres)" });
    }
    const pad = Number.isInteger(padding) && padding >= 3 && padding <= 8 ? padding : 5;
    await setNumberingPrefix(req.authUser!.organizationId, docType, prefix, pad);
    await audit(req, "update", { entityType: "numbering", entityId: docType, payload: { prefix, padding: pad } });
    return res.json({ docType, prefix, padding: pad });
  } catch (e) { return next(e); }
});
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
  // Alias label/category (vocabulaire du frontend) sur name/module (colonnes canoniques).
  const rows = await db.select({
    id: permissionsTable.id,
    code: permissionsTable.code,
    label: permissionsTable.name,
    category: permissionsTable.module,
    description: permissionsTable.description,
  }).from(permissionsTable).orderBy(permissionsTable.module, permissionsTable.code);
  return res.json({ data: rows });
});

// ════════════════════════════════════════════════════════════════════
// ROLES — CRUD + matrice permissions (scoped à l'org)
// Règle : rôles système (isSystem=true, organizationId=null) sont globaux (lecture seule).
//         rôles custom (isSystem=false, organizationId=orgId) appartiennent à l'org.
// ════════════════════════════════════════════════════════════════════

/** Filtre : rôles système OU rôles custom de l'org appelante. */
function orgRolesCond(orgId: string) {
  return or(eq(rolesTable.isSystem, true), eq(rolesTable.organizationId, orgId));
}
/** Filtre : rôle custom appartenant à l'org (écriture/suppression). */
function ownCustomRoleCond(id: string, orgId: string) {
  return and(eq(rolesTable.id, id), eq(rolesTable.isSystem, false), eq(rolesTable.organizationId, orgId));
}

router.get("/admin/roles", requirePermission("roles.read"), async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const roles = await db.select().from(rolesTable)
    .where(orgRolesCond(orgId))
    .orderBy(desc(sql`COALESCE((${rolesTable.level})::int, 0)`));
  // Compte les permissions par rôle.
  const counts = await db
    .select({ roleId: rolePermissionsTable.roleId, n: sql<number>`COUNT(*)` })
    .from(rolePermissionsTable).groupBy(rolePermissionsTable.roleId);
  const byRole = new Map(counts.map(c => [c.roleId, Number(c.n)]));
  // Compte les utilisateurs par rôle (matching role.code) dans cette org.
  const orgMemberIds = db.select({ uid: organizationMembersTable.userId })
    .from(organizationMembersTable).where(eq(organizationMembersTable.organizationId, orgId));
  const userCounts = await db
    .select({ role: usersTable.role, n: sql<number>`COUNT(*)` })
    .from(usersTable)
    .where(and(eq(usersTable.isActive, true), inArray(usersTable.id, orgMemberIds)))
    .groupBy(usersTable.role);
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
  const orgId = req.authUser!.organizationId;
  if (!isUuid((req.params.id as string))) return res.status(400).json({ error: "id invalide" });
  const [role] = await db.select().from(rolesTable)
    .where(and(eq(rolesTable.id, (req.params.id as string)), orgRolesCond(orgId))).limit(1);
  if (!role) return res.status(404).json({ error: "Introuvable" });
  const perms = await db
    .select({ id: permissionsTable.id, code: permissionsTable.code })
    .from(rolePermissionsTable)
    .innerJoin(permissionsTable, eq(rolePermissionsTable.permissionCode, permissionsTable.code))
    .where(eq(rolePermissionsTable.roleId, role.id));
  return res.json({ ...role, permissionIds: perms.map(p => p.id), permissionCodes: perms.map(p => p.code) });
});

router.post("/admin/roles", requirePermission("roles.manage"), async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const { code, name, description, level } = req.body || {};
  if (typeof code !== "string" || !code.trim()) return res.status(400).json({ error: "code requis" });
  if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "name requis" });
  if (!/^[a-z0-9_]+$/.test(code.trim())) return res.status(400).json({ error: "code : minuscules, chiffres, underscores uniquement" });
  // Empêcher l'utilisation d'un code de rôle système
  const [sysConflict] = await db.select({ id: rolesTable.id }).from(rolesTable)
    .where(and(eq(rolesTable.code, code.trim()), eq(rolesTable.isSystem, true))).limit(1);
  if (sysConflict) return res.status(409).json({ error: "Ce code est réservé à un rôle système" });
  try {
    const [r] = await db.insert(rolesTable).values({
      code: code.trim(), name: name.trim(), description, level: level ?? 10,
      isSystem: false, organizationId: orgId,
    }).returning();
    await audit(req, "create", { entityType: "role", entityId: r.id, payload: r });
    return res.status(201).json(r);
  } catch (e: any) {
    if (e?.code === "23505") return res.status(409).json({ error: "Un rôle avec ce code existe déjà dans votre organisation" });
    return res.status(500).json({ error: e.message });
  }
});

router.put("/admin/roles/:id", requirePermission("roles.manage"), async (req, res) => {
  const orgId = req.authUser!.organizationId;
  if (!isUuid((req.params.id as string))) return res.status(400).json({ error: "id invalide" });
  const [existing] = await db.select().from(rolesTable)
    .where(ownCustomRoleCond((req.params.id as string), orgId)).limit(1);
  if (!existing) return res.status(404).json({ error: "Rôle introuvable ou non modifiable" });
  const { name, description, level } = req.body || {};
  const upd: any = {};
  if (name !== undefined) upd.name = String(name).trim();
  if (description !== undefined) upd.description = description;
  if (level !== undefined) upd.level = level;
  // Le code est immuable après création (convention pour les rôles custom aussi).
  const [r] = await db.update(rolesTable).set(upd).where(eq(rolesTable.id, (req.params.id as string))).returning();
  invalidatePermissionsCache();
  await audit(req, "update", { entityType: "role", entityId: r.id, payload: { before: existing, after: r } });
  return res.json(r);
});

router.delete("/admin/roles/:id", requirePermission("roles.manage"), async (req, res) => {
  const orgId = req.authUser!.organizationId;
  if (!isUuid((req.params.id as string))) return res.status(400).json({ error: "id invalide" });
  const [r] = await db.select().from(rolesTable)
    .where(ownCustomRoleCond((req.params.id as string), orgId)).limit(1);
  if (!r) return res.status(404).json({ error: "Rôle introuvable ou non supprimable" });
  // Vérifier qu'aucun utilisateur de cette org ne porte ce rôle.
  const orgMemberIds = db.select({ uid: organizationMembersTable.userId })
    .from(organizationMembersTable).where(eq(organizationMembersTable.organizationId, orgId));
  const [{ n }] = await db.select({ n: sql<number>`COUNT(*)::int` })
    .from(usersTable).where(and(eq(usersTable.role, r.code), inArray(usersTable.id, orgMemberIds)));
  if (Number(n) > 0) return res.status(400).json({ error: `Impossible : ${n} utilisateur(s) de votre organisation utilisent ce rôle` });
  await db.delete(rolesTable).where(eq(rolesTable.id, r.id));
  invalidatePermissionsCache();
  await audit(req, "delete", { entityType: "role", entityId: r.id, payload: r });
  return res.status(204).send();
});

// Mise à jour de la matrice de permissions d'un rôle (remplacement complet).
router.put("/admin/roles/:id/permissions", requirePermission("roles.manage"), async (req, res) => {
  const orgId = req.authUser!.organizationId;
  if (!isUuid((req.params.id as string))) return res.status(400).json({ error: "id invalide" });
  const [role] = await db.select().from(rolesTable)
    .where(ownCustomRoleCond((req.params.id as string), orgId)).limit(1);
  if (!role) return res.status(404).json({ error: "Rôle introuvable ou non modifiable" });
  const { permissionIds } = req.body || {};
  if (!Array.isArray(permissionIds)) return res.status(400).json({ error: "permissionIds doit être un tableau" });
  const cleanIds = permissionIds.filter(isUuid);
  // Résout les IDs en CODES (modèle canonique : role_permissions.permission_code)
  // et vérifie que toutes les permissions existent.
  let codes: string[] = [];
  if (cleanIds.length > 0) {
    const found = await db.select({ id: permissionsTable.id, code: permissionsTable.code })
      .from(permissionsTable).where(inArray(permissionsTable.id, cleanIds));
    if (found.length !== cleanIds.length) return res.status(400).json({ error: "Permission inconnue dans la liste" });
    codes = found.map((f) => f.code);
  }
  await db.transaction(async (tx) => {
    await tx.delete(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, role.id));
    if (codes.length > 0) {
      await tx.insert(rolePermissionsTable).values(codes.map((permissionCode) => ({
        roleId: role.id, permissionCode, organizationId: orgId,
      })));
    }
  });
  invalidatePermissionsCache();
  await audit(req, "permission_change", { entityType: "role", entityId: role.id, payload: { permissionCodes: codes } });
  return res.json({ success: true, count: codes.length });
});

// ════════════════════════════════════════════════════════════════════
// DUPLICATION DE RÔLE (scoped à l'org)
// ════════════════════════════════════════════════════════════════════
router.post("/admin/roles/:id/duplicate", requirePermission("roles.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    if (!isUuid((req.params.id as string))) return res.status(400).json({ error: "id invalide" });
    // Source : rôle système OU custom de l'org (on peut dupliquer depuis un rôle système)
    const [src] = await db.select().from(rolesTable)
      .where(and(eq(rolesTable.id, (req.params.id as string)), orgRolesCond(orgId))).limit(1);
    if (!src) return res.status(404).json({ error: "Introuvable" });
    const rawCode = (req.body?.newCode ?? `${src.code}_copie`).toString().trim();
    const rawName = (req.body?.newName ?? `${src.name} (copie)`).toString().trim();
    if (!/^[a-z0-9_]+$/.test(rawCode)) return res.status(400).json({ error: "code invalide (minuscules, chiffres, _)" });
    // Empêcher conflit avec rôle système
    const [sysConflict] = await db.select({ id: rolesTable.id }).from(rolesTable)
      .where(and(eq(rolesTable.code, rawCode), eq(rolesTable.isSystem, true))).limit(1);
    if (sysConflict) return res.status(409).json({ error: "Ce code est réservé à un rôle système" });
    const srcPerms = await db
      .select({ permissionCode: rolePermissionsTable.permissionCode })
      .from(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, src.id));
    const [newRole] = await db.insert(rolesTable).values({
      code: rawCode, name: rawName,
      description: src.description ? `Copie de : ${src.description}` : undefined,
      level: src.level, isSystem: false, organizationId: orgId,
    }).returning();
    if (srcPerms.length > 0) {
      await db.insert(rolePermissionsTable).values(srcPerms.map((p) => ({
        roleId: newRole.id, permissionCode: p.permissionCode, organizationId: orgId,
      })));
    }
    invalidatePermissionsCache();
    await audit(req, "create", { entityType: "role", entityId: newRole.id, payload: { duplicatedFrom: src.id, ...newRole } });
    return res.status(201).json({ ...newRole, permissionsCount: srcPerms.length, usersCount: 0 });
  } catch (e: any) {
    if (e?.code === "23505") return res.status(409).json({ error: "Un rôle avec ce code existe déjà dans votre organisation" });
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
    let rolePermDetails: { code: string; label: string; category: string | null }[] = [];
    if (roleRow) {
      rolePermDetails = await db
        .select({ code: permissionsTable.code, label: permissionsTable.name, category: permissionsTable.module })
        .from(rolePermissionsTable)
        .innerJoin(permissionsTable, eq(rolePermissionsTable.permissionCode, permissionsTable.code))
        .where(eq(rolePermissionsTable.roleId, roleRow.id))
        .orderBy(permissionsTable.module, permissionsTable.code);
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

router.post("/admin/users/:id/permission-overrides", requirePermission("roles.manage"), async (req, res, next) => {
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

router.delete("/admin/users/:id/permission-overrides/:overrideId", requirePermission("roles.manage"), async (req, res, next) => {
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
  const orgId = req.authUser!.organizationId;
  const inviterName = req.authUser ? `${req.authUser.firstName} ${req.authUser.lastName}` : "Un administrateur";
  const baseUrl = getPublicBaseUrl();

  // ── Cas multi-org : l'email existe déjà dans un autre compte ──────────────
  const [existing] = await db
    .select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email, isActive: usersTable.isActive })
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  if (existing) {
    // Vérifier si l'utilisateur est déjà membre de CETTE organisation
    const [alreadyMember] = await db
      .select({ userId: organizationMembersTable.userId })
      .from(organizationMembersTable)
      .where(and(eq(organizationMembersTable.userId, existing.id), eq(organizationMembersTable.organizationId, orgId)))
      .limit(1);

    if (alreadyMember) {
      return res.status(409).json({ error: "Cet utilisateur est déjà membre de cette organisation." });
    }

    // Récupérer le nom de l'organisation pour l'email de notification
    const [orgRow] = await db.select({ name: organizationsTable.name }).from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);
    const orgName = orgRow?.name ?? "un nouvel espace de travail";

    // Ajouter au nouvel espace + accès projets — pas de nouveau compte créé
    await db.transaction(async (tx) => {
      await tx.insert(organizationMembersTable).values({ organizationId: orgId, userId: existing.id, role: roleRow.code });
      if (cleanProjectIds.length > 0) {
        await tx.insert(userProjectAccessTable).values(
          cleanProjectIds.map((pid) => ({ userId: existing.id, projectId: pid, accessLevel: "viewer", grantedById: req.authUser?.id ?? null })),
        );
      }
    });

    // Notifier l'utilisateur qu'il a été ajouté à un nouvel espace
    const loginUrl = `${baseUrl}/login`;
    const notifHtml = `<p>Bonjour ${existing.firstName},</p>
<p><strong>${inviterName}</strong> vous a ajouté à l'espace de travail <strong>${orgName}</strong> sur Gameasu.</p>
<p>Connectez-vous avec vos identifiants habituels — lors du prochain accès, vous pourrez choisir l'espace à ouvrir.</p>
<p><a href="${loginUrl}" style="background:#F37021;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:bold;">Accéder à Gameasu</a></p>`;
    const notifText = `Bonjour ${existing.firstName},\n\n${inviterName} vous a ajouté à l'espace "${orgName}" sur Gameasu.\n\nConnectez-vous sur ${loginUrl} avec vos identifiants habituels.`;
    const delivery = await sendEmail({ to: existing.email, subject: `Vous avez été ajouté à ${orgName}`, html: notifHtml, text: notifText });

    void permissionsHint;
    await audit(req, "invite", { entityType: "user", entityId: existing.id, payload: { email: existing.email, role: roleRow.code, projectIds: cleanProjectIds, method: "existing_user_added_to_org", delivery } });

    return res.status(200).json({
      userId: existing.id,
      email: existing.email,
      method: "existing_user_added_to_org",
      message: `${existing.firstName} ${existing.lastName} a été ajouté à l'organisation avec succès.`,
    });
  }

  // ── Cas standard : nouvel utilisateur à créer ─────────────────────────────
  const tempPassword = genTempPassword();
  const token = genToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const userId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(usersTable).values({
      id: userId,
      organizationId: orgId,
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
    await tx.insert(organizationMembersTable).values({ organizationId: orgId, userId, role: roleRow.code });
    if (cleanProjectIds.length > 0) {
      await tx.insert(userProjectAccessTable).values(cleanProjectIds.map((pid) => ({
        userId, projectId: pid, accessLevel: "viewer", grantedById: req.authUser?.id ?? null,
      })));
    }
  });

  const acceptUrl = `${baseUrl}/accept-invitation?token=${token}`;
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
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.update(usersTable).set({
    password: tempPassword, mustChangePassword: true,
    passwordResetToken: token, passwordResetTokenExpiresAt: expiresAt,
    invitedAt: new Date(),
  }).where(eq(usersTable.id, u.id));
  const baseUrl = getPublicBaseUrl();
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

// NOTE: /admin/audit routes sont dans routes/audit-enriched.ts

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
