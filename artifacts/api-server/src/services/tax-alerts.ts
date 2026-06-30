/**
 * Service de vérification des déclarations fiscales en retard.
 * Peut être appelé depuis une route API (pour un seul orgId)
 * ou depuis le planificateur quotidien (pour toutes les organisations).
 */
import { db } from "@workspace/db";
import {
  taxDeclarationsTable,
  notificationsTable,
  usersTable,
  organizationMembersTable,
  organizationsTable,
} from "@workspace/db";
import { and, eq, lte, inArray, gte } from "drizzle-orm";
import { sendEmail } from "../lib/email";
import { logger } from "../lib/logger";

const TYPE_LABELS: Record<string, string> = {
  cnss: "CNSS", irpp: "IRPP", ipts: "IPTS",
  tva: "TVA", is: "IS", autre: "Autre",
};

export type TaxAlertResult = {
  orgId: string;
  sent: number;
  declarations: typeof taxDeclarationsTable.$inferSelect[];
};

export async function checkTaxAlertsForOrg(orgId: string): Promise<TaxAlertResult> {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  const threshold = new Date(now);
  threshold.setDate(threshold.getDate() + 3);
  const thresholdStr = threshold.toISOString().split("T")[0];

  const overdue = await db
    .select()
    .from(taxDeclarationsTable)
    .where(
      and(
        eq(taxDeclarationsTable.organizationId, orgId),
        eq(taxDeclarationsTable.status, "generated"),
        lte(taxDeclarationsTable.dueDate, thresholdStr),
      )
    )
    .orderBy(taxDeclarationsTable.dueDate);

  if (overdue.length === 0) return { orgId, sent: 0, declarations: [] };

  const members = await db
    .select({ userId: organizationMembersTable.userId })
    .from(organizationMembersTable)
    .where(eq(organizationMembersTable.organizationId, orgId));

  if (!members.length) return { orgId, sent: 0, declarations: overdue };

  const users = await db
    .select({
      id: usersTable.id,
      role: usersTable.role,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
    })
    .from(usersTable)
    .where(and(eq(usersTable.isActive, true), inArray(usersTable.id, members.map(m => m.userId))));

  const managers = users.filter(u => ["admin", "manager", "super_admin"].includes(u.role ?? ""));
  if (!managers.length) return { orgId, sent: 0, declarations: overdue };

  let notifsSent = 0;

  for (const decl of overdue) {
    const dueDate = decl.dueDate ?? "";
    const isPastDue = dueDate < todayStr;
    const daysUntilDue = Math.ceil((new Date(dueDate + "T12:00:00Z").getTime() - now.getTime()) / 86400000);
    const typeLabel = TYPE_LABELS[decl.type] ?? decl.type;

    const title = isPastDue
      ? `Déclaration ${typeLabel} en retard — ${decl.period}`
      : `Rappel : déclaration ${typeLabel} dans ${daysUntilDue} jour${daysUntilDue > 1 ? "s" : ""} — ${decl.period}`;
    const body = isPastDue
      ? `La déclaration ${typeLabel} de la période ${decl.period} était due le ${new Date(dueDate + "T12:00:00Z").toLocaleDateString("fr-FR")} et n'a pas encore été soumise.`
      : `La déclaration ${typeLabel} de la période ${decl.period} est due le ${new Date(dueDate + "T12:00:00Z").toLocaleDateString("fr-FR")}. Soumettez-la avant la date limite pour éviter des pénalités.`;

    const existing = await db
      .select({ id: notificationsTable.id })
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.organizationId, orgId),
          eq(notificationsTable.entityType, "tax_declaration"),
          eq(notificationsTable.entityId, decl.id),
          gte(notificationsTable.createdAt, new Date(todayStr + "T00:00:00.000Z")),
        )
      )
      .limit(1);

    if (existing.length > 0) continue;

    await db.insert(notificationsTable).values(
      managers.map(u => ({
        organizationId: orgId,
        userId: u.id,
        title,
        body,
        type: isPastDue ? "error" : "warning",
        entityType: "tax_declaration",
        entityId: decl.id,
      }))
    );
    notifsSent += managers.length;
  }

  if (notifsSent > 0) {
    const overdueList = overdue
      .map(d => {
        const isPast = (d.dueDate ?? "") < todayStr;
        return `<li style="margin-bottom:8px"><strong>${TYPE_LABELS[d.type] ?? d.type} — ${d.period}</strong> : échéance <span style="color:${isPast ? "#dc2626" : "#d97706"};font-weight:600">${d.dueDate ? new Date(d.dueDate + "T12:00:00Z").toLocaleDateString("fr-FR") : "—"}</span>${isPast ? " <em>(en retard)</em>" : ""}</li>`;
      })
      .join("");

    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f2f4f7;font-family:Inter,-apple-system,Arial,sans-serif;color:#111">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08)">
  <div style="background:#0b0b0b;padding:20px 28px"><div style="color:#3B82F6;font-weight:700;letter-spacing:2px;font-size:11px;margin-bottom:4px">GAMÉASÙ RH</div><h1 style="margin:0;font-size:18px;color:#fff">Alerte — Déclarations fiscales en attente</h1></div>
  <div style="padding:24px 28px">
    <p style="margin-top:0">Les déclarations fiscales suivantes n'ont pas encore été soumises et approchent ou ont dépassé leur date d'échéance :</p>
    <ul style="padding-left:20px;line-height:1.7">${overdueList}</ul>
    <p style="margin-bottom:0;font-size:13px;color:#555">Connectez-vous à la plateforme pour soumettre ces déclarations dès que possible et éviter des pénalités de retard.</p>
  </div>
  <div style="background:#fafafa;padding:14px 28px;font-size:11px;color:#aaa;border-top:1px solid #f0f0f0;text-align:center">© ${new Date().getFullYear()} Gameasu — Ne pas répondre à cet email automatique</div>
</div></body></html>`;

    const text = `Alerte déclarations fiscales\n\nLes déclarations suivantes sont en attente :\n${overdue.map(d => `- ${TYPE_LABELS[d.type] ?? d.type} ${d.period} — échéance : ${d.dueDate ?? "—"}`).join("\n")}\n\nConnectez-vous pour soumettre ces déclarations.`;

    for (const manager of managers) {
      if (!manager.email) continue;
      await sendEmail({
        to: manager.email,
        subject: `⚠️ ${overdue.length} déclaration${overdue.length > 1 ? "s" : ""} fiscale${overdue.length > 1 ? "s" : ""} en attente — Gameasu`,
        html,
        text,
        category: "tax_alert",
      });
    }
  }

  return { orgId, sent: notifsSent, declarations: overdue };
}

export async function runDailyTaxAlerts(): Promise<void> {
  logger.info("Planificateur fiscal : démarrage de la vérification quotidienne");
  try {
    const orgs = await db.select({ id: organizationsTable.id }).from(organizationsTable);
    let totalSent = 0;
    for (const org of orgs) {
      try {
        const result = await checkTaxAlertsForOrg(org.id);
        totalSent += result.sent;
      } catch (e) {
        logger.error({ err: e, orgId: org.id }, "Planificateur fiscal : erreur pour l'organisation");
      }
    }
    logger.info({ totalSent, orgsChecked: orgs.length }, "Planificateur fiscal : vérification terminée");
  } catch (e) {
    logger.error({ err: e }, "Planificateur fiscal : erreur critique");
  }
}

const DAILY_MS = 24 * 60 * 60 * 1000;

export function startTaxAlertScheduler(): void {
  logger.info("Planificateur fiscal : démarrage (vérification quotidienne à J+0 puis toutes les 24h)");
  runDailyTaxAlerts().catch(() => {});
  setInterval(() => runDailyTaxAlerts().catch(() => {}), DAILY_MS);
}
