import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { automationRulesTable, automationLogsTable } from "@workspace/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { getCurrentOrganizationId } from "../lib/tenant";
import { AVAILABLE_ACTIONS, AVAILABLE_TRIGGERS, runRule, triggerEvent, type AutomationTrigger } from "../lib/automation";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

// ─────────────────────────────────────────────────────────────────
// Catalogue triggers / actions
// ─────────────────────────────────────────────────────────────────
router.get("/automation/catalog", async (_req, res) => {
  res.json({ triggers: AVAILABLE_TRIGGERS, actions: AVAILABLE_ACTIONS });
});

// ─────────────────────────────────────────────────────────────────
// Rules CRUD
// ─────────────────────────────────────────────────────────────────
router.get("/automation/rules", async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) { res.status(403).json({ error: "Aucune organisation rattachée" }); return; }
  const rows = await db.select().from(automationRulesTable).where(eq(automationRulesTable.organizationId, orgId)).orderBy(desc(automationRulesTable.createdAt));
  res.json(rows);
});

router.post("/automation/rules", requireAdmin, async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) { res.status(403).json({ error: "Aucune organisation rattachée" }); return; }
  const userId = req.authUser?.id;
  const body = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    triggerType: z.string().min(1),
    triggerConfig: z.record(z.string(), z.unknown()).optional(),
    conditions: z.array(z.object({ field: z.string(), op: z.string(), value: z.unknown() })).optional(),
    actions: z.array(z.object({ kind: z.string(), params: z.record(z.string(), z.unknown()) })).min(1),
    isActive: z.boolean().optional(),
  }).parse(req.body);
  const [row] = await db.insert(automationRulesTable).values({ organizationId: orgId, createdById: userId ?? null, ...body } as never).returning();
  res.status(201).json(row);
});

router.patch("/automation/rules/:id", requireAdmin, async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) { res.status(403).json({ error: "Aucune organisation rattachée" }); return; }
  const body = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    triggerType: z.string().optional(),
    triggerConfig: z.record(z.string(), z.unknown()).optional(),
    conditions: z.array(z.object({ field: z.string(), op: z.string(), value: z.unknown() })).optional(),
    actions: z.array(z.object({ kind: z.string(), params: z.record(z.string(), z.unknown()) })).min(1).optional(),
    isActive: z.boolean().optional(),
  }).parse(req.body);
  const [row] = await db.update(automationRulesTable).set(body as never)
    .where(and(eq(automationRulesTable.id, String(req.params["id"])), eq(automationRulesTable.organizationId, orgId)))
    .returning();
  if (!row) { res.status(404).json({ error: "not_found" }); return; }
  res.json(row);
});

router.delete("/automation/rules/:id", requireAdmin, async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) { res.status(403).json({ error: "Aucune organisation rattachée" }); return; }
  const result = await db.delete(automationRulesTable)
    .where(and(eq(automationRulesTable.id, String(req.params["id"])), eq(automationRulesTable.organizationId, orgId)))
    .returning();
  if (!result.length) { res.status(404).json({ error: "not_found" }); return; }
  res.status(204).end();
});

router.post("/automation/rules/:id/run", requireAdmin, async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) return res.status(403).json({ error: "Aucune organisation rattachée" });
  const [rule] = await db.select().from(automationRulesTable)
    .where(and(eq(automationRulesTable.id, String(req.params["id"])), eq(automationRulesTable.organizationId, orgId)));
  if (!rule) return res.status(404).json({ error: "not_found" });
  await runRule(rule, (req.body?.["payload"] as Record<string, unknown>) || {}, "manual");
  return res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────
// Émission manuelle d'un événement (test ou intégration externe)
// ─────────────────────────────────────────────────────────────────
router.post("/automation/trigger", requireAdmin, async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) { res.status(403).json({ error: "Aucune organisation rattachée" }); return; }
  const body = z.object({
    triggerType: z.string().min(1),
    payload: z.record(z.string(), z.unknown()).default({}),
  }).parse(req.body);
  const r = await triggerEvent(orgId, body.triggerType as AutomationTrigger, body.payload);
  res.json(r);
});

// ─────────────────────────────────────────────────────────────────
// Logs
// ─────────────────────────────────────────────────────────────────
router.get("/automation/logs", async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) { res.status(403).json({ error: "Aucune organisation rattachée" }); return; }
  const ruleId = req.query["ruleId"] as string | undefined;
  const conditions = [eq(automationLogsTable.organizationId, orgId)];
  if (ruleId) conditions.push(eq(automationLogsTable.ruleId, ruleId));
  const rows = await db.select().from(automationLogsTable).where(and(...conditions)).orderBy(desc(automationLogsTable.executedAt)).limit(200);
  res.json(rows);
});

export default router;
