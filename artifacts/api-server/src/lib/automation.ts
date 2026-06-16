import { db } from "@workspace/db";
import {
  automationRulesTable,
  automationLogsTable,
  insightsTable,
  recommendationsTable,
} from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { logger } from "./logger";

// ─────────────────────────────────────────────────────────────────
// GAMÉASÙ — Moteur d'automatisation transversale
// Évalue les règles métier au déclenchement d'événements et exécute
// les actions configurées (email, SMS, WhatsApp, tâche, notification,
// changement de statut, tag, résumé, recommandation…).
// ─────────────────────────────────────────────────────────────────

export type AutomationTrigger =
  | "invoice.issued"
  | "invoice.overdue"
  | "payment.received"
  | "proforma.pending"
  | "service.renewal_due"
  | "rental.due_soon"
  | "rental.returned"
  | "document.missing"
  | "project.at_risk"
  | "project.completed"
  | "client.inactive"
  | "client.created"
  | "lead.hot"
  | "task.critical_pending"
  | "task.overdue"
  | "user.invited"
  | "schedule.cron";

export const AVAILABLE_TRIGGERS: { type: AutomationTrigger; label: string; category: string }[] = [
  { type: "invoice.issued", label: "Facture émise", category: "Facturation" },
  { type: "invoice.overdue", label: "Facture échue impayée", category: "Facturation" },
  { type: "payment.received", label: "Paiement reçu", category: "Facturation" },
  { type: "proforma.pending", label: "Proforma non validée", category: "Ventes" },
  { type: "service.renewal_due", label: "Service à renouveler", category: "Services" },
  { type: "rental.due_soon", label: "Location proche échéance", category: "Locations" },
  { type: "rental.returned", label: "Location retournée", category: "Locations" },
  { type: "document.missing", label: "Document manquant", category: "Documents" },
  { type: "project.at_risk", label: "Projet à risque", category: "Projets" },
  { type: "project.completed", label: "Projet terminé", category: "Projets" },
  { type: "client.inactive", label: "Client inactif", category: "Clients" },
  { type: "client.created", label: "Nouveau client", category: "Clients" },
  { type: "lead.hot", label: "Prospect chaud", category: "Commercial" },
  { type: "task.critical_pending", label: "Tâche critique en attente", category: "Tâches" },
  { type: "task.overdue", label: "Tâche en retard", category: "Tâches" },
  { type: "user.invited", label: "Utilisateur invité", category: "Équipe" },
  { type: "schedule.cron", label: "Planification récurrente", category: "Système" },
];

export type AutomationAction = {
  kind:
    | "send_email"
    | "send_sms"
    | "send_whatsapp"
    | "create_task"
    | "notify_manager"
    | "notify_client"
    | "set_status"
    | "add_tag"
    | "generate_summary"
    | "generate_recommendation"
    | "create_insight"
    | "webhook";
  params: Record<string, unknown>;
};

export const AVAILABLE_ACTIONS: { kind: AutomationAction["kind"]; label: string }[] = [
  { kind: "send_email", label: "Envoyer un e-mail" },
  { kind: "send_sms", label: "Envoyer un SMS" },
  { kind: "send_whatsapp", label: "Envoyer un WhatsApp" },
  { kind: "create_task", label: "Créer une tâche" },
  { kind: "notify_manager", label: "Notifier le manager" },
  { kind: "notify_client", label: "Notifier le client" },
  { kind: "set_status", label: "Changer le statut" },
  { kind: "add_tag", label: "Ajouter un tag" },
  { kind: "generate_summary", label: "Générer un résumé" },
  { kind: "generate_recommendation", label: "Générer une recommandation" },
  { kind: "create_insight", label: "Créer un insight" },
  { kind: "webhook", label: "Appeler un webhook" },
];

// Évaluation simple d'une condition
function evalCondition(cond: { field: string; op: string; value: unknown }, payload: Record<string, unknown>): boolean {
  const fv = payload[cond.field];
  switch (cond.op) {
    case "eq": return fv === cond.value;
    case "neq": return fv !== cond.value;
    case "gt": return Number(fv) > Number(cond.value);
    case "gte": return Number(fv) >= Number(cond.value);
    case "lt": return Number(fv) < Number(cond.value);
    case "lte": return Number(fv) <= Number(cond.value);
    case "contains": return String(fv ?? "").toLowerCase().includes(String(cond.value).toLowerCase());
    case "in": return Array.isArray(cond.value) && (cond.value as unknown[]).includes(fv);
    case "exists": return fv != null;
    default: return true;
  }
}

// Exécute une action. Les providers externes (email/SMS/WhatsApp) sont
// branchés via les libs `email.ts` ou loggés (mode preview).
async function executeAction(
  action: AutomationAction,
  ctx: { organizationId: string | null; triggerType: string; payload: Record<string, unknown> },
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  try {
    switch (action.kind) {
      case "send_email": {
        const { sendEmail } = await import("./email");
        const to = (action.params["to"] as string) || (ctx.payload["email"] as string);
        const subject = renderTemplate((action.params["subject"] as string) || "", ctx.payload);
        const body = renderTemplate((action.params["body"] as string) || "", ctx.payload);
        if (!to) return { ok: false, error: "no_recipient" };
        await sendEmail({ to, subject, html: body, text: body.replace(/<[^>]+>/g, "") });
        return { ok: true, result: { to, subject } };
      }
      case "send_sms":
      case "send_whatsapp": {
        const to = (action.params["to"] as string) || (ctx.payload["phone"] as string);
        const message = renderTemplate((action.params["message"] as string) || "", ctx.payload);
        logger.info({ action: action.kind, to, message: message.slice(0, 80) }, "automation: simulated outbound");
        return { ok: true, result: { simulated: true, to, message } };
      }
      case "create_task": {
        const { tasksTable } = await import("@workspace/db/schema");
        const title = renderTemplate((action.params["title"] as string) || "Tâche automatique", ctx.payload);
        const description = renderTemplate((action.params["description"] as string) || "", ctx.payload);
        const [row] = await db.insert(tasksTable).values({
          title,
          description,
          priority: (action.params["priority"] as string) || "medium",
          status: "todo",
          ...(typeof ctx.payload["projectId"] === "string" ? { projectId: ctx.payload["projectId"] as string } : {}),
        } as never).returning();
        return { ok: true, result: { taskId: (row as { id?: string })?.id } };
      }
      case "create_insight": {
        const [row] = await db.insert(insightsTable).values({
          organizationId: ctx.organizationId,
          kind: (action.params["kind"] as string) || "reminder",
          scope: (action.params["scope"] as string) || "workspace",
          scopeId: (action.params["scopeId"] as string) || undefined,
          title: renderTemplate((action.params["title"] as string) || "Notification", ctx.payload),
          body: renderTemplate((action.params["body"] as string) || "",  ctx.payload),
          severity: (action.params["severity"] as string) || "info",
          actionLabel: action.params["actionLabel"] as string | undefined,
          actionUrl: action.params["actionUrl"] as string | undefined,
          metadata: { trigger: ctx.triggerType, payload: ctx.payload } as Record<string, unknown>,
          generatedBy: "automation",
        }).returning();
        return { ok: true, result: { insightId: row?.id } };
      }
      case "generate_recommendation": {
        const [row] = await db.insert(recommendationsTable).values({
          organizationId: ctx.organizationId,
          entityType: (action.params["entityType"] as string) || "workspace",
          entityId: (action.params["entityId"] as string) || (ctx.payload["entityId"] as string) || undefined,
          action: (action.params["action"] as string) || "review",
          title: renderTemplate((action.params["title"] as string) || "Action recommandée", ctx.payload),
          reason: renderTemplate((action.params["reason"] as string) || "", ctx.payload),
          priority: (action.params["priority"] as string) || "medium",
          impact: action.params["impact"] as string | undefined,
          ctaLabel: action.params["ctaLabel"] as string | undefined,
          ctaUrl: action.params["ctaUrl"] as string | undefined,
          generatedBy: "automation",
        }).returning();
        return { ok: true, result: { recommendationId: row?.id } };
      }
      case "notify_manager":
      case "notify_client": {
        logger.info({ action: action.kind, payload: ctx.payload }, "automation: notification dispatched");
        return { ok: true, result: { simulated: true } };
      }
      case "webhook": {
        const url = action.params["url"] as string;
        if (!url) return { ok: false, error: "no_url" };
        if (!isSafeWebhookUrl(url)) return { ok: false, error: "blocked_url" };
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          const res = await fetch(url, {
            method: (action.params["method"] as string) || "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ trigger: ctx.triggerType, payload: ctx.payload }),
            redirect: "error",
            signal: controller.signal,
          });
          return { ok: res.ok, result: { status: res.status } };
        } finally {
          clearTimeout(timeout);
        }
      }
      case "set_status":
      case "add_tag":
      case "generate_summary":
      default:
        logger.info({ action: action.kind }, "automation: action stub executed");
        return { ok: true, result: { stub: true } };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// SSRF guard : refuse les URLs non https/http, les hôtes locaux, les plages
// privées (RFC1918), loopback, link-local et le service de métadonnées cloud.
function isSafeWebhookUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const host = u.hostname.toLowerCase();
  if (!host) return false;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
  // IPv4 ranges interdits
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 169 && b === 254) return false; // link-local + metadata
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a >= 224) return false; // multicast/reserved
  }
  // IPv6 loopback / link-local / ULA
  if (host === "::1" || host === "[::1]" || host.startsWith("fe80") || host.startsWith("fc") || host.startsWith("fd")) return false;
  return true;
}

function renderTemplate(tpl: string, vars: Record<string, unknown>): string {
  if (!tpl) return "";
  return tpl.replace(/\{\{\s*([\w\.]+)\s*\}\}/g, (_, k) => {
    const parts = String(k).split(".");
    let v: unknown = vars;
    for (const p of parts) v = v && typeof v === "object" ? (v as Record<string, unknown>)[p] : undefined;
    return v == null ? "" : String(v);
  });
}

/**
 * Émet un événement métier. Toutes les règles d'automatisation actives
 * dont le déclencheur correspond seront évaluées et exécutées.
 */
export async function triggerEvent(
  organizationId: string | null,
  triggerType: AutomationTrigger,
  payload: Record<string, unknown> = {},
): Promise<{ matched: number; executed: number }> {
  const where = organizationId
    ? and(eq(automationRulesTable.triggerType, triggerType), eq(automationRulesTable.isActive, true), eq(automationRulesTable.organizationId, organizationId))
    : and(eq(automationRulesTable.triggerType, triggerType), eq(automationRulesTable.isActive, true));
  const rules = await db.select().from(automationRulesTable).where(where);
  let executed = 0;
  for (const rule of rules) {
    const conds = (rule.conditions || []) as Array<{ field: string; op: string; value: unknown }>;
    if (conds.length && !conds.every((c) => evalCondition(c, payload))) continue;
    await runRule(rule, payload, "event");
    executed++;
  }
  return { matched: rules.length, executed };
}

/** Exécute manuellement une règle (test ou cron). */
export async function runRule(
  rule: typeof automationRulesTable.$inferSelect,
  payload: Record<string, unknown> = {},
  source: "event" | "cron" | "manual" = "manual",
): Promise<void> {
  const start = Date.now();
  const actions = (rule.actions || []) as AutomationAction[];
  const results: Array<{ kind: string; ok: boolean; result?: unknown; error?: string }> = [];
  for (const a of actions) {
    const r = await executeAction(a, { organizationId: rule.organizationId, triggerType: rule.triggerType, payload });
    results.push({ kind: a.kind, ...r });
  }
  const allOk = results.every((r) => r.ok);
  const anyOk = results.some((r) => r.ok);
  const status = allOk ? "ok" : anyOk ? "partial" : "failed";

  await db.insert(automationLogsTable).values({
    organizationId: rule.organizationId,
    ruleId: rule.id,
    ruleName: rule.name,
    triggerType: rule.triggerType,
    triggeredBy: source,
    payload,
    actionsExecuted: results,
    status,
    durationMs: Date.now() - start,
  });

  await db
    .update(automationRulesTable)
    .set({ lastRunAt: new Date(), runCount: (rule.runCount || 0) + 1 })
    .where(eq(automationRulesTable.id, rule.id));
}
