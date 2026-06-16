import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, organizationMembersTable } from "@workspace/db";
import { eq, ilike, sql, and, ne, inArray } from "drizzle-orm";
import { requirePermission } from "../middlewares/permissions";
import { audit } from "../lib/audit";

const router = Router();

/** Sous-requête : ids des utilisateurs membres de l'organisation courante. */
function orgMemberIdsSubquery(orgId: string) {
  return db.select({ uid: organizationMembersTable.userId })
    .from(organizationMembersTable)
    .where(eq(organizationMembersTable.organizationId, orgId));
}

/** Vérifie qu'un user appartient bien à l'org appelante (anti-IDOR). */
async function userBelongsToOrg(userId: string, orgId: string): Promise<boolean> {
  const [m] = await db.select({ id: organizationMembersTable.id })
    .from(organizationMembersTable)
    .where(and(eq(organizationMembersTable.userId, userId), eq(organizationMembersTable.organizationId, orgId)))
    .limit(1);
  return !!m;
}

/** Garde-fous critiques pour éviter le lockout / l'auto-sabotage.
 *  Scope par organisation : on ne compte que les admins de la même org. */
async function ensureNotLastAdmin(targetUserId: string, orgId: string): Promise<void> {
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, targetUserId)).limit(1);
  if (!target) return;
  if (target.role !== "admin" && target.role !== "super_admin") return;
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(usersTable)
    .innerJoin(organizationMembersTable, eq(organizationMembersTable.userId, usersTable.id))
    .where(and(
      eq(organizationMembersTable.organizationId, orgId),
      sql`${usersTable.role} in ('admin','super_admin')`,
      eq(usersTable.isActive, true),
      ne(usersTable.id, targetUserId),
    ));
  if (Number(count) === 0) {
    const err: any = new Error("Impossible : il doit rester au moins un administrateur actif.");
    err.status = 409;
    throw err;
  }
}

router.get("/users", requirePermission("users.read"), async (req, res) => {
  const { search, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;
  const orgId = req.authUser!.organizationId;

  const conds: any[] = [inArray(usersTable.id, orgMemberIdsSubquery(orgId))];
  if (search) conds.push(ilike(usersTable.firstName, `%${search}%`));
  const data = await db.select().from(usersTable).where(and(...conds)).limit(limitNum).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(and(...conds));
  const total = Number(countResult[0].count);

  return res.json({
    data: data.map(u => ({ ...u, password: undefined })),
    total,
    page: pageNum,
    limit: limitNum,
  });
});

router.post("/users", requirePermission("users.create"), async (req, res) => {
  const { email, password, firstName, lastName, role, phone, isClient } = req.body;
  const orgId = req.authUser!.organizationId;
  const [user] = await db.insert(usersTable).values({
    organizationId: orgId,
    email, password, firstName, lastName,
    role: role || "collaborator",
    phone,
    isClient: isClient || false,
  }).returning();
  // Rattache automatiquement le nouvel utilisateur à l'org appelante.
  await db.insert(organizationMembersTable).values({
    organizationId: orgId, userId: user.id, role: role || "collaborator",
  });
  await audit(req, "create", { entityType: "user", entityId: user.id, payload: { email, role } });
  return res.status(201).json({ ...user, password: undefined });
});

router.get("/users/:id", requirePermission("users.read"), async (req, res) => {
  const orgId = req.authUser!.organizationId;
  if (!(await userBelongsToOrg(req.params.id, orgId))) return res.status(404).json({ error: "Not found" });
  const users = await db.select().from(usersTable).where(eq(usersTable.id, req.params.id)).limit(1);
  if (!users[0]) return res.status(404).json({ error: "Not found" });
  return res.json({ ...users[0], password: undefined });
});

router.put("/users/:id", requirePermission("users.update"), async (req, res) => {
  const { firstName, lastName, role, phone, isActive, departmentId } = req.body;
  const orgId = req.authUser!.organizationId;
  if (!(await userBelongsToOrg(req.params.id, orgId))) return res.status(404).json({ error: "Not found" });
  const [previous] = await db.select().from(usersTable).where(eq(usersTable.id, req.params.id)).limit(1);
  if (!previous) return res.status(404).json({ error: "Not found" });

  // Garde-fous : empêcher l'auto-désactivation et la perte du dernier admin.
  if (req.authUser?.id === req.params.id && isActive === false) {
    return res.status(409).json({ error: "Vous ne pouvez pas désactiver votre propre compte." });
  }
  if (req.authUser?.id === req.params.id && role && role !== previous.role) {
    return res.status(409).json({ error: "Vous ne pouvez pas modifier votre propre rôle." });
  }
  try {
    if (isActive === false || (role && role !== previous.role && previous.role === "admin")) {
      await ensureNotLastAdmin(req.params.id, orgId);
    }
  } catch (e: any) {
    return res.status(e.status || 500).json({ error: e.message });
  }

  const [user] = await db.update(usersTable)
    .set({ firstName, lastName, role, phone, isActive, departmentId: departmentId || null })
    .where(eq(usersTable.id, req.params.id))
    .returning();

  // Audit ciblé sur les changements sensibles.
  if (role && role !== previous.role) {
    await audit(req, "role_change", { entityType: "user", entityId: user.id, payload: { from: previous.role, to: role } });
  }
  if (isActive !== undefined && isActive !== previous.isActive) {
    await audit(req, isActive ? "activate" : "deactivate", { entityType: "user", entityId: user.id });
  }
  return res.json({ ...user, password: undefined });
});

router.delete("/users/:id", requirePermission("users.delete"), async (req, res) => {
  const orgId = req.authUser!.organizationId;
  if (req.authUser?.id === req.params.id) {
    return res.status(409).json({ error: "Vous ne pouvez pas supprimer votre propre compte." });
  }
  if (!(await userBelongsToOrg(req.params.id, orgId))) return res.status(404).json({ error: "Not found" });
  try { await ensureNotLastAdmin(req.params.id, orgId); }
  catch (e: any) { return res.status(e.status || 500).json({ error: e.message }); }
  await db.update(usersTable).set({ isActive: false }).where(eq(usersTable.id, req.params.id));
  await audit(req, "delete", { entityType: "user", entityId: req.params.id });
  return res.status(204).send();
});

export default router;
