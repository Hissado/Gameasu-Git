/**
 * Phase 13 — Chatbot Nexora (assistant conversationnel).
 *  - POST /api/assistant/ask  { question, context? }
 *
 * Détecte l'intention (kpi/clients/projets/finance/rh/recherche/aide), assemble
 * un contexte structuré depuis la base, et appelle OpenAI proxy. Fallback
 * heuristique si OpenAI absent.
 */
import { Router, type IRouter } from "express";
import { db, clientsTable, projectsTable, tasksTable, invoicesTable, collaboratorsTable, riskFlagsTable } from "@workspace/db";
import { and, eq, isNull, sql, desc, inArray, ilike, or } from "drizzle-orm";
import { z } from "zod/v4";
import { summarize, aiAvailable } from "../lib/ai";
import { hasPermission, userAccessibleProjectIds, userAccessibleClientIds } from "../lib/rbac/permissions";
import { getCurrentOrganizationId } from "../lib/tenant";

const router: IRouter = Router();

type Intent = "kpi_overview" | "clients" | "projects" | "tasks" | "finance" | "hr" | "search" | "help" | "unknown";

function detectIntent(q: string): Intent {
  const s = q.toLowerCase();
  if (/(bonjour|salut|aide|help|comment|que peux|qui es|fonctionne)/.test(s)) return "help";
  if (/(kpi|tableau de bord|vue d'ensemble|globale|santé)/.test(s)) return "kpi_overview";
  if (/(client|prospect)/.test(s)) return "clients";
  if (/(projet|chantier|phase)/.test(s)) return "projects";
  if (/(tâche|task|backlog|urgence)/.test(s)) return "tasks";
  if (/(facture|paiement|trésorerie|cash|finance|recouvrement|impayé|encours)/.test(s)) return "finance";
  if (/(rh|collaborateur|équipe|absent|retard|pointage|congé)/.test(s)) return "hr";
  if (/(cherche|trouve|recherch|où est|find)/.test(s)) return "search";
  return "unknown";
}

async function buildContext(intent: Intent, userId: string, q: string): Promise<{ text: string; citations: Array<{ label: string; url: string }> }> {
  const citations: Array<{ label: string; url: string }> = [];
  const lines: string[] = [];

  const clientIds = await userAccessibleClientIds(userId);
  const projectIds = await userAccessibleProjectIds(userId);
  const orgId = await getCurrentOrganizationId(userId);

  if (intent === "kpi_overview" || intent === "unknown") {
    const clientConds = [isNull(clientsTable.deletedAt)];
    if (clientIds) clientConds.push(inArray(clientsTable.id, clientIds.length ? clientIds : ["00000000-0000-0000-0000-000000000000"]));
    const [clientCount] = await db.select({ c: sql<number>`count(*)::int` }).from(clientsTable).where(and(...clientConds));

    const projConds = [isNull(projectsTable.deletedAt)];
    if (projectIds) projConds.push(inArray(projectsTable.id, projectIds.length ? projectIds : ["00000000-0000-0000-0000-000000000000"]));
    const [projCount] = await db.select({ c: sql<number>`count(*)::int` }).from(projectsTable).where(and(...projConds));

    const taskConds = [isNull(tasksTable.deletedAt)];
    if (projectIds) taskConds.push(inArray(tasksTable.projectId, projectIds.length ? projectIds : ["00000000-0000-0000-0000-000000000000"]));
    const [openTasks] = await db.select({ c: sql<number>`count(*)::int` }).from(tasksTable).where(and(...taskConds, sql`${tasksTable.status} not in ('done','completed','cancelled')`));

    lines.push(`KPI globaux : ${clientCount?.c ?? 0} clients actifs, ${projCount?.c ?? 0} projets, ${openTasks?.c ?? 0} tâches ouvertes.`);
    citations.push({ label: "Tableau de bord", url: "/" });
  }

  if (intent === "clients" || intent === "kpi_overview") {
    const conds = [isNull(clientsTable.deletedAt)];
    if (clientIds && clientIds.length) conds.push(inArray(clientsTable.id, clientIds));
    if (clientIds && clientIds.length === 0) {
      lines.push("Aucun client accessible avec votre profil.");
    } else {
      const rows = await db.select({ id: clientsTable.id, name: clientsTable.name, industry: clientsTable.industry, status: clientsTable.status })
        .from(clientsTable).where(and(...conds)).orderBy(desc(clientsTable.createdAt)).limit(5);
      if (rows.length) {
        lines.push("Derniers clients : " + rows.map((r) => `${r.name} (${r.status})`).join(", ") + ".");
        rows.slice(0, 3).forEach((r) => citations.push({ label: r.name, url: `/clients/${r.id}` }));
      }
    }
  }

  if (intent === "projects") {
    const conds = [isNull(projectsTable.deletedAt)];
    if (projectIds && projectIds.length) conds.push(inArray(projectsTable.id, projectIds));
    if (projectIds && projectIds.length === 0) {
      lines.push("Aucun projet accessible.");
    } else {
      const rows = await db.select({ id: projectsTable.id, name: projectsTable.name, status: projectsTable.status, progress: projectsTable.progress })
        .from(projectsTable).where(and(...conds)).orderBy(desc(projectsTable.updatedAt)).limit(5);
      lines.push("Projets actifs : " + rows.map((r) => `${r.name} (${r.status}, ${r.progress ?? 0}%)`).join(", "));
      rows.slice(0, 3).forEach((r) => citations.push({ label: r.name, url: `/projects/${r.id}` }));
    }
  }

  if (intent === "tasks") {
    const conds: any[] = [isNull(tasksTable.deletedAt), sql`${tasksTable.status} not in ('done','completed','cancelled')`];
    if (projectIds && projectIds.length) conds.push(inArray(tasksTable.projectId, projectIds));
    if (projectIds && projectIds.length === 0) {
      lines.push("Aucune tâche accessible.");
    } else {
      const rows = await db.select({ id: tasksTable.id, title: tasksTable.title, status: tasksTable.status, priority: tasksTable.priority, dueDate: tasksTable.dueDate })
        .from(tasksTable).where(and(...conds)).orderBy(desc(tasksTable.priority)).limit(5);
      lines.push(`${rows.length} tâche(s) prioritaires : ` + rows.map((r) => `« ${r.title} » (${r.priority}, échéance ${r.dueDate ?? "non définie"})`).join("; "));
      citations.push({ label: "Focus tâches", url: "/tasks/focus" });
    }
  }

  if (intent === "finance" && await hasPermission(userId, "accounting.read")) {
    const overdueConds = [
      sql`${invoicesTable.status} not in ('draft','paid','cancelled')`,
      sql`${invoicesTable.dueDate} is not null`,
      sql`${invoicesTable.dueDate}::date < now()::date`,
    ];
    if (clientIds && clientIds.length) overdueConds.push(inArray(invoicesTable.clientId, clientIds));
    const overdue = (clientIds && clientIds.length === 0) ? [] : await db.select({
      id: invoicesTable.id, ref: invoicesTable.referenceNumber, total: invoicesTable.totalAmount, paid: invoicesTable.paidAmount,
    }).from(invoicesTable).where(and(...overdueConds)).limit(5);
    const totalOverdue = overdue.reduce((s, r) => s + (Number(r.total) - Number(r.paid ?? 0)), 0);
    lines.push(`${overdue.length} facture(s) en retard pour un encours estimé de ${Math.round(totalOverdue).toLocaleString("fr-FR")} FCFA.`);
    citations.push({ label: "Finance IA", url: "/finance/intelligence" });
  }

  if (intent === "hr" && await hasPermission(userId, "hr.read")) {
    const [active] = await db.select({ c: sql<number>`count(*)::int` }).from(collaboratorsTable).where(and(isNull(collaboratorsTable.deletedAt), eq(collaboratorsTable.employmentStatus, "active")));
    lines.push(`Effectif actif : ${active?.c ?? 0} collaborateur(s).`);
    citations.push({ label: "RH IA", url: "/hr/intelligence" });
  }

  if (intent === "search") {
    const m = q.match(/(?:cherche|trouve|recherch[a-z]*)\s+(.+?)(?:\?|$|\.)/i);
    const term = (m?.[1] ?? "").trim();
    if (term.length >= 2) {
      const pattern = `%${term}%`;
      const cConds = [isNull(clientsTable.deletedAt), ilike(clientsTable.name, pattern)];
      if (clientIds && clientIds.length) cConds.push(inArray(clientsTable.id, clientIds));
      const cs = (clientIds && clientIds.length === 0) ? [] : await db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable).where(and(...cConds)).limit(3);
      if (cs.length) {
        lines.push("Clients trouvés : " + cs.map((c) => c.name).join(", "));
        cs.forEach((c) => citations.push({ label: c.name, url: `/clients/${c.id}` }));
      } else {
        lines.push(`Aucun client correspondant à « ${term} ».`);
      }
      citations.push({ label: "Recherche universelle", url: "/search" });
    } else {
      citations.push({ label: "Recherche universelle", url: "/search" });
    }
  }

  // Risques en cours (top 3) — tenant-scoped + RBAC
  if (intent !== "help" && orgId && await hasPermission(userId, "ai.view_risk_flags")) {
    const risks = await db.select({ severity: riskFlagsTable.severity, title: riskFlagsTable.title })
      .from(riskFlagsTable).where(and(
        eq(riskFlagsTable.organizationId, orgId),
        eq(riskFlagsTable.isResolved, false),
      )).orderBy(desc(riskFlagsTable.createdAt)).limit(3);
    if (risks.length) {
      lines.push("Risques signalés : " + risks.map((r) => `[${r.severity}] ${r.title}`).join(" / "));
      citations.push({ label: "Centre d'intelligence", url: "/intelligence" });
    }
  }

  return { text: lines.join("\n"), citations };
}

function heuristicAnswer(intent: Intent, ctx: string, q: string): string {
  if (intent === "help") {
    return "Je suis l'assistant Nexora. Posez-moi des questions sur vos KPI, clients, projets, tâches, finances ou équipe. Exemples : « combien de factures en retard ? », « tâches urgentes », « trouve le client SOGELEC ». Pour la recherche libre, utilisez /search.";
  }
  if (!ctx.trim()) {
    return "Je n'ai pas trouvé d'éléments correspondants dans vos données. Reformulez ou consultez la recherche universelle.";
  }
  return ctx;
}

const askSchema = z.object({
  question: z.string().min(1).max(500),
});

router.post("/assistant/ask", async (req, res, next) => {
  try {
    const parsed = askSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "question_required" });
    const { question } = parsed.data;
    const userId = req.authUser!.id;

    const intent = detectIntent(question);
    const { text, citations } = await buildContext(intent, userId, question);

    let answer: string | null = null;
    let provider: "openai" | "heuristic" = "heuristic";

    if (aiAvailable() && intent !== "help") {
      const summary = await summarize({
        system: "Tu es l'assistant exécutif Nexora (SaaS B2B Togo/Afrique francophone). Réponds en français business, 3-6 phrases max, factuel, sans préambule, sans markdown. Utilise UNIQUEMENT les données fournies en contexte. Si le contexte est vide, dis-le.",
        context: `Question: ${question}\n\nContexte:\n${text || "(aucune donnée pertinente trouvée)"}`,
        maxTokens: 400,
      });
      if (summary) { answer = summary; provider = "openai"; }
    }

    if (!answer) answer = heuristicAnswer(intent, text, question);

    return res.json({
      intent,
      answer,
      citations,
      provider,
      contextPreview: text.slice(0, 500),
    });
  } catch (e) { next(e); }
});

export default router;
