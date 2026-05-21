import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  insightsTable,
  recommendationsTable,
  riskFlagsTable,
  smartScoresTable,
  assistantSummariesTable,
  tierForScore,
} from "@workspace/db/schema";
import { and, desc, eq, sql, gte } from "drizzle-orm";
import { z } from "zod/v4";
import { getCurrentOrganizationId } from "../lib/tenant";
import { summarize, generateList, aiAvailable } from "../lib/ai";

const router: IRouter = Router();

// ─────────────────────────────────────────────────────────────────
// INSIGHTS
// ─────────────────────────────────────────────────────────────────
router.get("/intelligence/insights", async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) { res.status(403).json({ error: "Aucune organisation rattachée" }); return; }
  const scope = (req.query["scope"] as string) || undefined;
  const kind = (req.query["kind"] as string) || undefined;
  const unreadOnly = req.query["unreadOnly"] === "true";
  const conditions = [eq(insightsTable.organizationId, orgId)];
  if (scope) conditions.push(eq(insightsTable.scope, scope));
  if (kind) conditions.push(eq(insightsTable.kind, kind));
  if (unreadOnly) conditions.push(eq(insightsTable.isRead, false));
  conditions.push(eq(insightsTable.isDismissed, false));
  const rows = await db.select().from(insightsTable).where(and(...conditions)).orderBy(desc(insightsTable.createdAt)).limit(200);
  res.json(rows);
});

router.post("/intelligence/insights", async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) { res.status(403).json({ error: "Aucune organisation rattachée" }); return; }
  const body = z.object({
    kind: z.string(),
    scope: z.string().default("workspace"),
    scopeId: z.string().uuid().optional().nullable(),
    audienceRole: z.string().optional(),
    title: z.string().min(1),
    body: z.string().optional(),
    severity: z.string().optional(),
    actionLabel: z.string().optional(),
    actionUrl: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    validUntil: z.string().datetime().optional(),
  }).parse(req.body);
  const [row] = await db.insert(insightsTable).values({
    organizationId: orgId,
    ...body,
    validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
  } as never).returning();
  res.status(201).json(row);
});

router.patch("/intelligence/insights/:id", async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) { res.status(403).json({ error: "Aucune organisation rattachée" }); return; }
  const body = z.object({
    isRead: z.boolean().optional(),
    isPinned: z.boolean().optional(),
    isDismissed: z.boolean().optional(),
  }).parse(req.body);
  const [row] = await db.update(insightsTable).set(body)
    .where(and(eq(insightsTable.id, req.params["id"]!), eq(insightsTable.organizationId, orgId)))
    .returning();
  if (!row) { res.status(404).json({ error: "not_found" }); return; }
  res.json(row);
});

// ─────────────────────────────────────────────────────────────────
// RECOMMENDATIONS
// ─────────────────────────────────────────────────────────────────
router.get("/intelligence/recommendations", async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) { res.status(403).json({ error: "Aucune organisation rattachée" }); return; }
  const entityType = req.query["entityType"] as string | undefined;
  const entityId = req.query["entityId"] as string | undefined;
  const openOnly = req.query["openOnly"] !== "false";
  const conditions = [eq(recommendationsTable.organizationId, orgId)];
  if (entityType) conditions.push(eq(recommendationsTable.entityType, entityType));
  if (entityId) conditions.push(eq(recommendationsTable.entityId, entityId));
  if (openOnly) {
    conditions.push(eq(recommendationsTable.isApplied, false));
    conditions.push(eq(recommendationsTable.isDismissed, false));
  }
  const rows = await db.select().from(recommendationsTable).where(and(...conditions)).orderBy(desc(recommendationsTable.createdAt)).limit(200);
  res.json(rows);
});

router.post("/intelligence/recommendations", async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) { res.status(403).json({ error: "Aucune organisation rattachée" }); return; }
  const body = z.object({
    entityType: z.string(),
    entityId: z.string().uuid().optional().nullable(),
    action: z.string(),
    title: z.string().min(1),
    reason: z.string().optional(),
    priority: z.string().optional(),
    impact: z.string().optional(),
    ctaLabel: z.string().optional(),
    ctaUrl: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }).parse(req.body);
  const [row] = await db.insert(recommendationsTable).values({ organizationId: orgId, ...body } as never).returning();
  res.status(201).json(row);
});

router.patch("/intelligence/recommendations/:id/apply", async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) { res.status(403).json({ error: "Aucune organisation rattachée" }); return; }
  const userId = req.authUser!.id;
  const [row] = await db.update(recommendationsTable).set({ isApplied: true, appliedAt: new Date(), appliedById: userId })
    .where(and(eq(recommendationsTable.id, req.params["id"]!), eq(recommendationsTable.organizationId, orgId)))
    .returning();
  if (!row) { res.status(404).json({ error: "not_found" }); return; }
  res.json(row);
});

router.patch("/intelligence/recommendations/:id/dismiss", async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) { res.status(403).json({ error: "Aucune organisation rattachée" }); return; }
  const [row] = await db.update(recommendationsTable).set({ isDismissed: true, dismissedAt: new Date() })
    .where(and(eq(recommendationsTable.id, req.params["id"]!), eq(recommendationsTable.organizationId, orgId)))
    .returning();
  if (!row) { res.status(404).json({ error: "not_found" }); return; }
  res.json(row);
});

// ─────────────────────────────────────────────────────────────────
// RISK FLAGS
// ─────────────────────────────────────────────────────────────────
router.get("/intelligence/risks", async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) { res.status(403).json({ error: "Aucune organisation rattachée" }); return; }
  const entityType = req.query["entityType"] as string | undefined;
  const entityId = req.query["entityId"] as string | undefined;
  const openOnly = req.query["openOnly"] !== "false";
  const conditions = [eq(riskFlagsTable.organizationId, orgId)];
  if (entityType) conditions.push(eq(riskFlagsTable.entityType, entityType));
  if (entityId) conditions.push(eq(riskFlagsTable.entityId, entityId));
  if (openOnly) conditions.push(eq(riskFlagsTable.isResolved, false));
  const rows = await db.select().from(riskFlagsTable).where(and(...conditions)).orderBy(desc(riskFlagsTable.detectedAt)).limit(200);
  res.json(rows);
});

router.post("/intelligence/risks", async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) { res.status(403).json({ error: "Aucune organisation rattachée" }); return; }
  const body = z.object({
    entityType: z.string(),
    entityId: z.string().uuid().optional().nullable(),
    severity: z.string().optional(),
    category: z.string(),
    title: z.string().min(1),
    description: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }).parse(req.body);
  const [row] = await db.insert(riskFlagsTable).values({ organizationId: orgId, ...body } as never).returning();
  res.status(201).json(row);
});

router.patch("/intelligence/risks/:id/resolve", async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) { res.status(403).json({ error: "Aucune organisation rattachée" }); return; }
  const userId = req.authUser!.id;
  const note = (req.body?.["resolutionNote"] as string) || null;
  const [row] = await db.update(riskFlagsTable).set({ isResolved: true, resolvedAt: new Date(), resolvedById: userId, resolutionNote: note })
    .where(and(eq(riskFlagsTable.id, req.params["id"]!), eq(riskFlagsTable.organizationId, orgId)))
    .returning();
  if (!row) { res.status(404).json({ error: "not_found" }); return; }
  res.json(row);
});

// ─────────────────────────────────────────────────────────────────
// SMART SCORES
// ─────────────────────────────────────────────────────────────────
router.get("/intelligence/scores", async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) { res.status(403).json({ error: "Aucune organisation rattachée" }); return; }
  const entityType = req.query["entityType"] as string | undefined;
  const entityId = req.query["entityId"] as string | undefined;
  const scoreType = req.query["scoreType"] as string | undefined;
  const conditions = [eq(smartScoresTable.organizationId, orgId)];
  if (entityType) conditions.push(eq(smartScoresTable.entityType, entityType));
  if (entityId) conditions.push(eq(smartScoresTable.entityId, entityId));
  if (scoreType) conditions.push(eq(smartScoresTable.scoreType, scoreType));
  const rows = await db.select().from(smartScoresTable).where(and(...conditions)).orderBy(desc(smartScoresTable.computedAt)).limit(500);
  res.json(rows);
});

router.post("/intelligence/scores", async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) { res.status(403).json({ error: "Aucune organisation rattachée" }); return; }
  const body = z.object({
    entityType: z.string(),
    entityId: z.string().uuid(),
    scoreType: z.string(),
    value: z.number().int().min(0).max(100),
    factors: z.array(z.object({ key: z.string(), label: z.string(), weight: z.number(), value: z.number(), reason: z.string().optional() })).optional(),
    computedBy: z.string().optional(),
  }).parse(req.body);
  const tier = tierForScore(body.value);
  const [row] = await db.insert(smartScoresTable).values({ organizationId: orgId, ...body, tier } as never).returning();
  res.status(201).json(row);
});

// ─────────────────────────────────────────────────────────────────
// ASSISTANT SUMMARIES
// ─────────────────────────────────────────────────────────────────
router.get("/intelligence/summaries", async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) { res.status(403).json({ error: "Aucune organisation rattachée" }); return; }
  const scope = req.query["scope"] as string | undefined;
  const scopeId = req.query["scopeId"] as string | undefined;
  const conditions = [eq(assistantSummariesTable.organizationId, orgId)];
  if (scope) conditions.push(eq(assistantSummariesTable.scope, scope));
  if (scopeId) conditions.push(eq(assistantSummariesTable.scopeId, scopeId));
  const rows = await db.select().from(assistantSummariesTable).where(and(...conditions)).orderBy(desc(assistantSummariesTable.createdAt)).limit(50);
  res.json(rows);
});

router.post("/intelligence/summaries/generate", async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) { res.status(403).json({ error: "Aucune organisation rattachée" }); return; }
  const body = z.object({
    scope: z.string(),
    scopeId: z.string().uuid().optional().nullable(),
    period: z.string().optional(),
    context: z.string().min(1).max(8000),
    title: z.string().optional(),
  }).parse(req.body);

  const aiText = await summarize({ context: body.context, maxTokens: 400 });
  const generatedBy = aiText ? "ai" : "heuristic";
  const content = aiText ?? heuristicSummary(body.context);

  const aiActions = await generateList({
    prompt: `À partir du contexte ci-dessous, propose 3 à 5 prochaines actions concrètes en français professionnel.\n\nCONTEXTE :\n${body.context}`,
    maxItems: 5,
  });
  const nextActions = aiActions ?? heuristicActions(body.context);

  const [row] = await db.insert(assistantSummariesTable).values({
    organizationId: orgId,
    scope: body.scope,
    scopeId: body.scopeId || null,
    period: body.period || "adhoc",
    title: body.title,
    content,
    nextActions,
    generatedBy,
  } as never).returning();
  res.status(201).json(row);
});

// ─────────────────────────────────────────────────────────────────
// OVERVIEW (cockpit dashboard)
// ─────────────────────────────────────────────────────────────────
router.get("/intelligence/overview", async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) { res.status(403).json({ error: "Aucune organisation rattachée" }); return; }
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [insightsOpen] = await db.select({ n: sql<number>`count(*)::int` }).from(insightsTable).where(and(eq(insightsTable.organizationId, orgId), eq(insightsTable.isDismissed, false)));
  const [recsOpen] = await db.select({ n: sql<number>`count(*)::int` }).from(recommendationsTable).where(and(eq(recommendationsTable.organizationId, orgId), eq(recommendationsTable.isApplied, false), eq(recommendationsTable.isDismissed, false)));
  const [risksOpen] = await db.select({ n: sql<number>`count(*)::int` }).from(riskFlagsTable).where(and(eq(riskFlagsTable.organizationId, orgId), eq(riskFlagsTable.isResolved, false)));
  const [risksCritical] = await db.select({ n: sql<number>`count(*)::int` }).from(riskFlagsTable).where(and(eq(riskFlagsTable.organizationId, orgId), eq(riskFlagsTable.isResolved, false), eq(riskFlagsTable.severity, "critical")));
  const recentInsights = await db.select().from(insightsTable).where(and(eq(insightsTable.organizationId, orgId), eq(insightsTable.isDismissed, false), gte(insightsTable.createdAt, since))).orderBy(desc(insightsTable.createdAt)).limit(8);
  const topRecs = await db.select().from(recommendationsTable).where(and(eq(recommendationsTable.organizationId, orgId), eq(recommendationsTable.isApplied, false), eq(recommendationsTable.isDismissed, false))).orderBy(desc(recommendationsTable.createdAt)).limit(8);
  const topRisks = await db.select().from(riskFlagsTable).where(and(eq(riskFlagsTable.organizationId, orgId), eq(riskFlagsTable.isResolved, false))).orderBy(desc(riskFlagsTable.detectedAt)).limit(8);

  res.json({
    aiAvailable: aiAvailable(),
    counts: {
      insightsOpen: insightsOpen?.n ?? 0,
      recommendationsOpen: recsOpen?.n ?? 0,
      risksOpen: risksOpen?.n ?? 0,
      risksCritical: risksCritical?.n ?? 0,
    },
    recentInsights,
    topRecommendations: topRecs,
    topRisks,
  });
});

// ─────────────────────────────────────────────────────────────────
// Heuristic fallbacks
// ─────────────────────────────────────────────────────────────────
function heuristicSummary(ctx: string): string {
  const lines = ctx.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return "Aucun élément à résumer.";
  const bullets = lines.slice(0, 6).map((l) => `• ${l.length > 140 ? l.slice(0, 137) + "…" : l}`).join("\n");
  return `Synthèse rapide (heuristique — IA non configurée) :\n${bullets}`;
}

function heuristicActions(ctx: string): string[] {
  const has = (k: string) => ctx.toLowerCase().includes(k);
  const out: string[] = [];
  if (has("facture") || has("impay") || has("échue")) out.push("Lancer une relance de paiement sur les factures échues");
  if (has("projet") || has("phase") || has("retard")) out.push("Réviser le planning des projets en retard et réaffecter les ressources");
  if (has("client") || has("inactif")) out.push("Reprendre contact avec les clients inactifs depuis plus de 60 jours");
  if (has("tâche") || has("tache")) out.push("Reprioriser les tâches critiques en attente");
  if (has("location") || has("rental")) out.push("Vérifier les locations proches de leur échéance");
  if (out.length === 0) out.push("Valider les indicateurs clés du jour et confirmer les arbitrages");
  return out.slice(0, 5);
}

export default router;
