/**
 * Phase 9 — Finance IA.
 *  - GET /api/finance/intelligence/overview         : KPI synthèse (encours, DSO, retards, prévision 30j).
 *  - GET /api/finance/intelligence/cashflow-forecast?days=30|60|90 : projection des encaissements.
 *  - GET /api/finance/intelligence/anomalies        : factures atypiques (montant outlier, retard inhabituel).
 *  - GET /api/finance/intelligence/collections      : scoring de relance impayés (priorité).
 *
 * 100 % heuristique (statistiques + règles). Aucun appel IA payant — le module Finance
 * doit rester déterministe et auditable.
 */
import { Router, type IRouter } from "express";
import { db, invoicesTable, paymentsTable, clientsTable, clientEmailLogsTable } from "@workspace/db";
import { and, eq, ne, desc } from "drizzle-orm";
import { requirePermission } from "../middlewares/permissions";
import { getTreasuryPosition } from "../services/kpis";

const router: IRouter = Router();

type Inv = {
  id: string; ref: string; clientId: string | null; clientName: string | null;
  status: string; total: number; paid: number; outstanding: number;
  dueDate: string | null; issuedAt: string | null;
  daysOverdue: number; isOverdue: boolean; isPaid: boolean;
};

// ─── Helpers ───────────────────────────────────────────────────────────
function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
function fmtISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}
function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((v) => (v - m) ** 2)));
}

// Récupère toutes les factures émises (hors brouillons/annulées) + nom client + statut calculé.
// orgId est OBLIGATOIRE pour l'isolation multi-tenant.
async function loadInvoices(orgId: string): Promise<Inv[]> {
  const rows = await db
    .select({
      id: invoicesTable.id,
      ref: invoicesTable.referenceNumber,
      clientId: invoicesTable.clientId,
      clientName: clientsTable.name,
      status: invoicesTable.status,
      total: invoicesTable.totalAmount,
      paid: invoicesTable.paidAmount,
      dueDate: invoicesTable.dueDate,
      issuedAt: invoicesTable.issuedAt,
    })
    .from(invoicesTable)
    .leftJoin(clientsTable, eq(clientsTable.id, invoicesTable.clientId))
    .where(and(
      eq(invoicesTable.organizationId, orgId),
      ne(invoicesTable.status, "cancelled"),
      ne(invoicesTable.status, "draft"),
    ));

  const now = new Date();
  return rows.map((r) => {
    const total = Number(r.total ?? 0);
    const paid = Number(r.paid ?? 0);
    const outstanding = Math.max(0, total - paid);
    const due = parseDate(r.dueDate);
    const isPaid = outstanding <= 0.01;
    const isOverdue = !isPaid && !!due && due < now;
    const daysOverdue = isOverdue && due ? daysBetween(now, due) : 0;
    return {
      id: r.id,
      ref: r.ref,
      clientId: r.clientId,
      clientName: r.clientName ?? null,
      status: r.status,
      total, paid, outstanding,
      dueDate: r.dueDate,
      issuedAt: r.issuedAt,
      daysOverdue, isOverdue, isPaid,
    };
  });
}

/**
 * Délai moyen réel de paiement par client, calculé au niveau facture (settlement).
 * Pour chaque facture totalement payée, on prend la date du DERNIER paiement
 * (settlement) et on mesure le retard par rapport à `dueDate` (ou `issuedAt` à défaut).
 * Cela évite le biais des paiements multiples (un acompte précoce + solde tardif
 * comptait deux fois auparavant).
 *
 * Retourne aussi la date du dernier paiement par facture, réutilisée pour
 * détecter les paiements partiels figés.
 */
async function loadPaymentHistory(orgId: string): Promise<{
  delayByClient: Map<string, { meanDays: number; samples: number }>;
  lastPaymentByInvoice: Map<string, Date>;
}> {
  const rows = await db
    .select({
      invoiceId: paymentsTable.invoiceId,
      paidAt: paymentsTable.paidAt,
      clientId: invoicesTable.clientId,
      status: invoicesTable.status,
      dueDate: invoicesTable.dueDate,
      issuedAt: invoicesTable.issuedAt,
    })
    .from(paymentsTable)
    .innerJoin(invoicesTable, and(eq(invoicesTable.id, paymentsTable.invoiceId), eq(invoicesTable.organizationId, orgId)));

  // 1) Dernier paiement par facture (toutes factures confondues).
  const lastPaymentByInvoice = new Map<string, Date>();
  // 2) Métadonnées par facture pour le calcul de settlement (status, ref dates, client).
  const invoiceMeta = new Map<string, { clientId: string; status: string; dueDate: string | null; issuedAt: string | null }>();

  for (const r of rows) {
    if (!r.paidAt) continue;
    const d = new Date(r.paidAt);
    const prev = lastPaymentByInvoice.get(r.invoiceId);
    if (!prev || d > prev) lastPaymentByInvoice.set(r.invoiceId, d);
    if (r.clientId) {
      invoiceMeta.set(r.invoiceId, {
        clientId: r.clientId,
        status: r.status,
        dueDate: r.dueDate,
        issuedAt: r.issuedAt,
      });
    }
  }

  // 3) Pour chaque facture totalement payée, on prend son settlement date (= dernier paiement)
  //    et on accumule un délai par client.
  const byClient = new Map<string, number[]>();
  for (const [invoiceId, meta] of invoiceMeta) {
    if (meta.status !== "paid") continue;
    const settlement = lastPaymentByInvoice.get(invoiceId);
    if (!settlement) continue;
    const ref = parseDate(meta.dueDate) ?? parseDate(meta.issuedAt);
    if (!ref) continue;
    const delay = daysBetween(settlement, ref);
    if (!byClient.has(meta.clientId)) byClient.set(meta.clientId, []);
    byClient.get(meta.clientId)!.push(delay);
  }
  const delayByClient = new Map<string, { meanDays: number; samples: number }>();
  byClient.forEach((arr, k) => delayByClient.set(k, { meanDays: mean(arr), samples: arr.length }));
  return { delayByClient, lastPaymentByInvoice };
}

// ─── Position de trésorerie (source unique — audit phase 3) ────────────
// LA définition de « Trésorerie disponible » : solde comptable de la
// classe 5 (grand livre), identique au poste Trésorerie du bilan.
router.get("/finance/treasury-position", requirePermission("accounting.read"), async (req, res, next) => {
  try {
    const asOf = typeof req.query["asOf"] === "string" ? (req.query["asOf"] as string) : undefined;
    const position = await getTreasuryPosition(req.authUser!.organizationId, asOf);
    return res.json(position);
  } catch (e) { return next(e); }
});

// ─── Overview ──────────────────────────────────────────────────────────
router.get("/finance/intelligence/overview", requirePermission("accounting.read"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const invs = await loadInvoices(orgId);
    const open = invs.filter((i) => !i.isPaid);
    const overdue = invs.filter((i) => i.isOverdue);
    const totalOutstanding = open.reduce((s, i) => s + i.outstanding, 0);
    const totalOverdue = overdue.reduce((s, i) => s + i.outstanding, 0);

    // DSO simple : (encours / CA des 90 derniers jours) × 90.
    const now = new Date();
    const ninetyAgo = addDays(now, -90);
    const ca90 = invs
      .filter((i) => {
        const iss = parseDate(i.issuedAt);
        return iss && iss >= ninetyAgo;
      })
      .reduce((s, i) => s + i.total, 0);
    const dso = ca90 > 0 ? Math.round((totalOutstanding / ca90) * 90) : 0;

    // Aging buckets.
    const buckets = { current: 0, b1_30: 0, b31_60: 0, b61_90: 0, b90plus: 0 };
    for (const i of open) {
      if (!i.isOverdue) buckets.current += i.outstanding;
      else if (i.daysOverdue <= 30) buckets.b1_30 += i.outstanding;
      else if (i.daysOverdue <= 60) buckets.b31_60 += i.outstanding;
      else if (i.daysOverdue <= 90) buckets.b61_90 += i.outstanding;
      else buckets.b90plus += i.outstanding;
    }

    // Top 5 retards.
    const topOverdue = [...overdue]
      .sort((a, b) => b.outstanding * b.daysOverdue - a.outstanding * a.daysOverdue)
      .slice(0, 5);

    return res.json({
      openCount: open.length,
      overdueCount: overdue.length,
      totalOutstanding,
      totalOverdue,
      dso,
      ca90,
      buckets,
      topOverdue,
    });
  } catch (e) { next(e); }
});

// ─── Cashflow forecast ─────────────────────────────────────────────────
/**
 * Projection des encaissements jour par jour.
 * Pour chaque facture impayée :
 *   - on prend `dueDate` (ou aujourd'hui si absente),
 *   - on ajoute le retard moyen client (si historique ≥ 2 paiements), borné à 90 j,
 *   - on pondère par la probabilité d'encaissement = max(0.2, 1 - retard_attendu/120).
 * On agrège par jour sur `days` (30/60/90), avec cumul.
 */
router.get("/finance/intelligence/cashflow-forecast", requirePermission("accounting.read"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const days = Math.max(7, Math.min(180, Number(req.query["days"] ?? 30)));
    const [invs, history] = await Promise.all([loadInvoices(orgId), loadPaymentHistory(orgId)]);
    const delays = history.delayByClient;
    const open = invs.filter((i) => !i.isPaid);

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const horizon = addDays(now, days);

    const byDay = new Map<string, { expected: number; weighted: number }>();
    for (let i = 0; i <= days; i++) {
      byDay.set(fmtISODate(addDays(now, i)), { expected: 0, weighted: 0 });
    }

    let beyondHorizon = 0;
    let beyondHorizonWeighted = 0;

    for (const inv of open) {
      const ref = parseDate(inv.dueDate) ?? now;
      const clientDelay = inv.clientId && delays.has(inv.clientId) && delays.get(inv.clientId)!.samples >= 2
        ? Math.max(0, Math.min(90, delays.get(inv.clientId)!.meanDays))
        : (inv.isOverdue ? 15 : 5); // fallback : factures déjà en retard → +15j ; sinon +5j de courtoisie
      const expectedDate = addDays(ref, clientDelay);
      const expectedDay = expectedDate < now ? now : expectedDate;
      const weight = Math.max(0.2, 1 - clientDelay / 120);

      if (expectedDay > horizon) {
        beyondHorizon += inv.outstanding;
        beyondHorizonWeighted += inv.outstanding * weight;
        continue;
      }
      const k = fmtISODate(expectedDay);
      const cur = byDay.get(k);
      if (cur) {
        cur.expected += inv.outstanding;
        cur.weighted += inv.outstanding * weight;
      }
    }

    let cumulative = 0;
    let cumulativeWeighted = 0;
    const series = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => {
        cumulative += v.expected;
        cumulativeWeighted += v.weighted;
        return {
          date,
          expected: Math.round(v.expected),
          weighted: Math.round(v.weighted),
          cumulative: Math.round(cumulative),
          cumulativeWeighted: Math.round(cumulativeWeighted),
        };
      });

    return res.json({
      horizonDays: days,
      totalExpected: Math.round(cumulative),
      totalWeighted: Math.round(cumulativeWeighted),
      beyondHorizon: Math.round(beyondHorizon),
      beyondHorizonWeighted: Math.round(beyondHorizonWeighted),
      series,
    });
  } catch (e) { next(e); }
});

// ─── Détection d'anomalies ─────────────────────────────────────────────
router.get("/finance/intelligence/anomalies", requirePermission("accounting.read"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [invs, history] = await Promise.all([loadInvoices(orgId), loadPaymentHistory(orgId)]);
    const lastPay = history.lastPaymentByInvoice;
    const amounts = invs.map((i) => i.total).filter((v) => v > 0);
    const med = median(amounts);
    const sd = stddev(amounts);
    const upper = med + 3 * sd; // outlier vers le haut (3σ)

    const anomalies: Array<{
      invoiceId: string; reference: string; clientName: string | null;
      type: "amount_outlier" | "long_overdue" | "no_due_date" | "partial_stuck";
      severity: "low" | "medium" | "high";
      message: string;
      amount: number;
    }> = [];

    for (const i of invs) {
      // 1) Montant anormalement élevé
      if (sd > 0 && i.total > upper && i.total > med * 2) {
        anomalies.push({
          invoiceId: i.id, reference: i.ref, clientName: i.clientName,
          type: "amount_outlier",
          severity: i.total > med * 5 ? "high" : "medium",
          message: `Montant ${Math.round(i.total).toLocaleString("fr-FR")} FCFA > médiane ${Math.round(med).toLocaleString("fr-FR")} FCFA + 3σ.`,
          amount: i.total,
        });
      }
      // 2) Retard > 90 jours
      if (i.isOverdue && i.daysOverdue > 90) {
        anomalies.push({
          invoiceId: i.id, reference: i.ref, clientName: i.clientName,
          type: "long_overdue",
          severity: i.daysOverdue > 180 ? "high" : "medium",
          message: `Retard de ${i.daysOverdue} jours sur ${Math.round(i.outstanding).toLocaleString("fr-FR")} FCFA d'encours.`,
          amount: i.outstanding,
        });
      }
      // 3) Pas de date d'échéance saisie
      if (!i.isPaid && !i.dueDate) {
        anomalies.push({
          invoiceId: i.id, reference: i.ref, clientName: i.clientName,
          type: "no_due_date",
          severity: "low",
          message: "Aucune échéance saisie — impossible de suivre le recouvrement.",
          amount: i.outstanding,
        });
      }
      // 4) Paiement partiel bloqué : >30 j depuis le dernier versement reçu.
      if (i.paid > 0 && !i.isPaid) {
        const last = lastPay.get(i.id);
        if (last) {
          const daysSinceLast = daysBetween(new Date(), last);
          if (daysSinceLast > 30) {
            anomalies.push({
              invoiceId: i.id, reference: i.ref, clientName: i.clientName,
              type: "partial_stuck",
              severity: daysSinceLast > 90 ? "high" : "medium",
              message: `Paiement partiel (${Math.round((i.paid / i.total) * 100)}%) figé depuis ${daysSinceLast} j (dernier versement le ${last.toISOString().slice(0, 10)}).`,
              amount: i.outstanding,
            });
          }
        }
      }
    }

    anomalies.sort((a, b) => {
      const sev = { high: 3, medium: 2, low: 1 } as const;
      return sev[b.severity] - sev[a.severity] || b.amount - a.amount;
    });

    return res.json({
      stats: { medianAmount: Math.round(med), stddev: Math.round(sd), upperThreshold: Math.round(upper) },
      count: anomalies.length,
      anomalies: anomalies.slice(0, 100),
    });
  } catch (e) { next(e); }
});

// ─── Scoring de relance impayés ────────────────────────────────────────
/**
 * Score 0-100 = 40 % retard + 35 % montant + 15 % âge client + 10 % historique délai client.
 * Tier : excellent (recouvrement saine) → critical (relance immédiate).
 */
router.get("/finance/intelligence/collections", requirePermission("accounting.read"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [invs, history] = await Promise.all([loadInvoices(orgId), loadPaymentHistory(orgId)]);
    const delays = history.delayByClient;
    const open = invs.filter((i) => !i.isPaid && i.outstanding > 0);
    const maxOutstanding = open.reduce((m, i) => Math.max(m, i.outstanding), 1);

    const ranked = open.map((i) => {
      // 1) Urgence retard : 0..40
      const overdueScore = i.isOverdue ? Math.min(40, (i.daysOverdue / 90) * 40) : 0;
      // 2) Poids montant : 0..35 (échelle log)
      const amountScore = Math.min(35, (Math.log10(Math.max(1, i.outstanding)) / Math.log10(maxOutstanding + 1)) * 35);
      // 3) Âge facture : 0..15
      const iss = parseDate(i.issuedAt);
      const ageDays = iss ? daysBetween(new Date(), iss) : 0;
      const ageScore = Math.min(15, (ageDays / 180) * 15);
      // 4) Historique délai client : 0..10
      const delayInfo = i.clientId ? delays.get(i.clientId) : undefined;
      const histScore = delayInfo && delayInfo.samples >= 2
        ? Math.min(10, (Math.max(0, delayInfo.meanDays) / 60) * 10)
        : 5; // inconnu → neutre

      const score = Math.round(overdueScore + amountScore + ageScore + histScore);
      const tier: "critical" | "high" | "medium" | "low" =
        score >= 75 ? "critical" : score >= 55 ? "high" : score >= 35 ? "medium" : "low";

      return {
        invoiceId: i.id,
        reference: i.ref,
        clientId: i.clientId,
        clientName: i.clientName,
        outstanding: i.outstanding,
        daysOverdue: i.daysOverdue,
        dueDate: i.dueDate,
        score,
        tier,
        factors: {
          overdue: Math.round(overdueScore),
          amount: Math.round(amountScore),
          age: Math.round(ageScore),
          history: Math.round(histScore),
        },
        clientHistory: delayInfo
          ? { meanDelayDays: Math.round(delayInfo.meanDays), samples: delayInfo.samples }
          : null,
      };
    }).sort((a, b) => b.score - a.score);

    return res.json({
      count: ranked.length,
      totalOutstanding: ranked.reduce((s, r) => s + r.outstanding, 0),
      ranked: ranked.slice(0, 100),
    });
  } catch (e) { next(e); }
});

// ────────────────────────────────────────────────────────────────
// HISTORIQUE DES RELANCES
// ────────────────────────────────────────────────────────────────
router.get("/finance/intelligence/relance-history", requirePermission("accounting.read"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const limit = Math.min(parseInt(String((req.query.limit as string) ?? "50")), 100);

    const rows = await db
      .select({
        id: clientEmailLogsTable.id,
        clientId: clientEmailLogsTable.clientId,
        clientName: clientsTable.name,
        subject: clientEmailLogsTable.subject,
        preview: clientEmailLogsTable.preview,
        sentAt: clientEmailLogsTable.sentAt,
        status: clientEmailLogsTable.status,
        fromAddress: clientEmailLogsTable.fromAddress,
        toAddress: clientEmailLogsTable.toAddress,
      })
      .from(clientEmailLogsTable)
      .leftJoin(clientsTable, eq(clientsTable.id, clientEmailLogsTable.clientId))
      .where(
        and(
          eq(clientEmailLogsTable.organizationId, orgId),
          eq(clientEmailLogsTable.direction, "outbound"),
        )
      )
      .orderBy(desc(clientEmailLogsTable.sentAt))
      .limit(limit);

    return res.json({ count: rows.length, data: rows });
  } catch (e) { next(e); }
});

export default router;
