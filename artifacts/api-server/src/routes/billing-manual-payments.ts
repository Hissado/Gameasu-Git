/**
 * Paiements manuels déclarés — routes tenant + cockpit super-admin.
 *
 * Tenant :
 *   POST  /billing/declare-payment            Déclare un paiement (virement/dépôt/chèque)
 *   GET   /billing/payment-declarations       Historique des déclarations
 *   GET   /billing/bank-coordinates           Coordonnées bancaires Gaméasù
 *
 * Cockpit :
 *   GET   /super-admin/payment-declarations                    Liste toutes les déclarations
 *   POST  /super-admin/payment-declarations/:id/confirm        Confirme + active l'abo
 *   POST  /super-admin/payment-declarations/:id/reject         Rejette avec motif
 *   GET   /super-admin/settings/bank-coordinates               Lecture coordonnées bancaires
 *   PUT   /super-admin/settings/bank-coordinates               Mise à jour coordonnées
 */

import { Router, type IRouter, type RequestHandler } from "express";
import {
  db,
  paymentTransactionsTable,
  billingEventsTable,
  organizationSubscriptionsTable,
  organizationsTable,
  platformSettingsTable,
} from "@workspace/db";
import { and, eq, desc, sql, inArray } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { calcPlanPricing, getPlan, type Periodicity } from "../lib/pricing";
import { sendEmail } from "../lib/email";
import { getPublicBaseUrl } from "../lib/url";

const router: IRouter = Router();

// ── Middleware super-admin ─────────────────────────────────────────
const sa: RequestHandler = (req, res, next) => {
  if (!req.authUser) { res.status(401).json({ error: "Authentification requise" }); return; }
  if (req.authUser.role !== "super_admin") { res.status(403).json({ error: "Accès réservé aux super-administrateurs" }); return; }
  next();
};

// ── Labels ────────────────────────────────────────────────────────
const METHOD_LABELS: Record<string, string> = {
  virement: "Virement bancaire",
  depot_bancaire: "Dépôt bancaire",
  depot_bureau: "Dépôt au bureau",
  cheque: "Chèque",
  card: "Carte bancaire",
  mixx: "Mixx Mobile Money",
  flooz: "Flooz Mobile Money",
};

const MANUAL_METHODS = ["virement", "depot_bancaire", "depot_bureau", "cheque"];

// ── Coordonnées bancaires par défaut (modifiables via Cockpit) ─────
const DEFAULT_BANK_COORDS = {
  bankName: "Ecobank Togo",
  accountHolder: "Gaméasù SARL",
  accountNumber: "10001-00000-12345678901-00",
  iban: "TG53TG0090604310346500400045",
  bic: "ECOCTGLO",
  officeAddress: "Boulevard du 13 Janvier, Lomé, Togo",
  officeHours: "Lun–Ven 8h00–17h30",
  checkOrder: "Gaméasù SARL",
  officePhone: "+228 91 00 00 00",
};

async function getBankCoords() {
  const [row] = await db.select().from(platformSettingsTable)
    .where(eq(platformSettingsTable.key, "bank_coordinates")).limit(1);
  if (!row) {
    await db.insert(platformSettingsTable).values({ key: "bank_coordinates", value: DEFAULT_BANK_COORDS }).onConflictDoNothing();
    return DEFAULT_BANK_COORDS;
  }
  return (row.value as typeof DEFAULT_BANK_COORDS) ?? DEFAULT_BANK_COORDS;
}

function generateRef(prefix: string, seq: number, year: number) {
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

// ── GET /billing/bank-coordinates ────────────────────────────────
router.get("/billing/bank-coordinates", requireAdmin, async (_req, res, next) => {
  try {
    const coords = await getBankCoords();
    res.json({ data: coords });
  } catch (e) { next(e); }
});

// ── POST /billing/declare-payment ────────────────────────────────
router.post("/billing/declare-payment", requireAdmin, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    if (!orgId) { res.status(400).json({ error: "Organisation introuvable" }); return; }

    const { planCode, seats, periodicity = "monthly", method, justificationUrl, notes, payerPhone } = req.body as Record<string, string>;

    if (!method || !MANUAL_METHODS.includes(method)) {
      res.status(400).json({ error: "Moyen de paiement invalide pour une déclaration manuelle" }); return;
    }
    if (!planCode) { res.status(400).json({ error: "Formule requise" }); return; }
    if (!justificationUrl) { res.status(400).json({ error: "Un justificatif est requis" }); return; }

    const seatsN = Math.max(1, parseInt(seats as string, 10) || 1);
    const pricing = calcPlanPricing({ planCode, seats: seatsN, periodicity: periodicity as Periodicity });
    if (!pricing) { res.status(400).json({ error: "Plan ou tarification invalide" }); return; }

    const [sub] = await db.select({ id: organizationSubscriptionsTable.id })
      .from(organizationSubscriptionsTable)
      .where(and(eq(organizationSubscriptionsTable.organizationId, orgId), eq(organizationSubscriptionsTable.isCurrent, true)))
      .limit(1);

    const [org] = await db.select({ name: organizationsTable.name, contactEmail: organizationsTable.contactEmail })
      .from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);

    const year = new Date().getFullYear();
    const [cntRow] = await db.select({ c: sql<number>`count(*)::int` }).from(paymentTransactionsTable)
      .where(and(eq(paymentTransactionsTable.organizationId, orgId), sql`EXTRACT(year FROM created_at) = ${year}`));
    const txRef = generateRef("DECL", (cntRow?.c ?? 0) + 1, year);

    const amount = pricing.totalTTC;
    const now = new Date();
    const planName = getPlan(planCode)?.name ?? planCode;
    const methodLabel = METHOD_LABELS[method] ?? method;

    const [event] = await db.insert(billingEventsTable).values({
      organizationId: orgId,
      subscriptionId: sub?.id ?? null,
      kind: "payment",
      label: `Déclaration — ${planName} ${seatsN} util. (${methodLabel})`,
      amount,
      currency: "XOF",
      status: "pending",
      reference: txRef,
    }).returning();

    const [tx] = await db.insert(paymentTransactionsTable).values({
      organizationId: orgId,
      subscriptionId: sub?.id ?? null,
      billingEventId: event.id,
      amount,
      currency: "XOF",
      method,
      payerPhone: payerPhone || null,
      reference: txRef,
      purpose: "renewal",
      notes: notes || null,
      status: "pending_verification",
      justificationUrl,
      declaredAt: now,
      planCode,
      seats: seatsN,
      periodicity,
    }).returning();

    const clientEmail = req.authUser!.email;
    await sendEmail({
      to: clientEmail,
      subject: `[Gaméasù] Déclaration de paiement reçue — ${txRef}`,
      html: emailDeclarationAck({ orgName: org?.name ?? "", txRef, amount, method: methodLabel, planName, seats: seatsN }),
      text: `Votre déclaration de paiement ${txRef} a été reçue. Notre équipe la vérifiera sous 24 à 48h ouvrables.`,
    });

    const teamEmail = process.env.TEAM_NOTIFICATION_EMAIL ?? "equipe@gameasu.com";
    const cockpitUrl = getPublicBaseUrl().replace(/\/cockpit.*$/, "/cockpit") + "/payment-declarations";
    await sendEmail({
      to: teamEmail,
      subject: `[Cockpit] Nouvelle déclaration — ${txRef} — ${org?.name ?? orgId}`,
      html: emailTeamNotif({ orgName: org?.name ?? orgId, txRef, amount, method: methodLabel, planName, seats: seatsN, cockpitUrl }),
      text: `Nouvelle déclaration de ${org?.name}: ${txRef} — ${amount} FCFA par ${methodLabel}.`,
    });

    logger.info({ txId: tx.id, orgId, method, amount, ref: txRef }, "Paiement manuel déclaré");
    res.status(201).json({ ...tx, billingEvent: event });
  } catch (e) { next(e); }
});

// ── GET /billing/payment-declarations ────────────────────────────
router.get("/billing/payment-declarations", requireAdmin, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    if (!orgId) { res.status(400).json({ error: "Organisation introuvable" }); return; }

    const rows = await db.select().from(paymentTransactionsTable)
      .where(and(eq(paymentTransactionsTable.organizationId, orgId), inArray(paymentTransactionsTable.method, MANUAL_METHODS)))
      .orderBy(desc(paymentTransactionsTable.createdAt))
      .limit(50);

    res.json({ data: rows });
  } catch (e) { next(e); }
});

// ── GET /super-admin/settings/bank-coordinates ────────────────────
router.get("/super-admin/settings/bank-coordinates", sa, async (_req, res, next) => {
  try {
    res.json({ data: await getBankCoords() });
  } catch (e) { next(e); }
});

// ── PUT /super-admin/settings/bank-coordinates ────────────────────
router.put("/super-admin/settings/bank-coordinates", sa, async (req, res, next) => {
  try {
    const { bankName, accountHolder, accountNumber, iban, bic, officeAddress, officeHours, checkOrder, officePhone } = req.body as Record<string, string>;
    const value = { bankName, accountHolder, accountNumber, iban, bic, officeAddress, officeHours, checkOrder, officePhone };
    await db.insert(platformSettingsTable)
      .values({ key: "bank_coordinates", value, updatedById: req.authUser!.id })
      .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value, updatedById: req.authUser!.id } });
    res.json({ data: value });
  } catch (e) { next(e); }
});

// ── GET /super-admin/payment-declarations ────────────────────────
router.get("/super-admin/payment-declarations", sa, async (req, res, next) => {
  try {
    const { status, orgId } = req.query as Record<string, string>;

    const conditions: ReturnType<typeof eq>[] = [inArray(paymentTransactionsTable.method, MANUAL_METHODS) as unknown as ReturnType<typeof eq>];
    if (status) conditions.push(eq(paymentTransactionsTable.status, status));
    if (orgId) conditions.push(eq(paymentTransactionsTable.organizationId, orgId));

    const rows = await db.select({
      tx: paymentTransactionsTable,
      orgName: organizationsTable.name,
      orgSlug: organizationsTable.slug,
      orgContactEmail: organizationsTable.contactEmail,
    }).from(paymentTransactionsTable)
      .innerJoin(organizationsTable, eq(organizationsTable.id, paymentTransactionsTable.organizationId))
      .where(and(...conditions))
      .orderBy(desc(paymentTransactionsTable.createdAt))
      .limit(200);

    const data = rows.map((r) => ({ ...r.tx, orgName: r.orgName, orgSlug: r.orgSlug, orgContactEmail: r.orgContactEmail }));
    res.json({ data, count: data.length });
  } catch (e) { next(e); }
});

// ── POST /super-admin/payment-declarations/:id/confirm ────────────
router.post("/super-admin/payment-declarations/:id/confirm", sa, async (req, res, next) => {
  try {
    const { id } = req.params as Record<string, string>;

    const [found] = await db.select({
      tx: paymentTransactionsTable,
      orgName: organizationsTable.name,
      orgContactEmail: organizationsTable.contactEmail,
    }).from(paymentTransactionsTable)
      .innerJoin(organizationsTable, eq(organizationsTable.id, paymentTransactionsTable.organizationId))
      .where(eq(paymentTransactionsTable.id, id)).limit(1);

    if (!found) { res.status(404).json({ error: "Déclaration introuvable" }); return; }
    if (found.tx.status !== "pending_verification") {
      res.status(400).json({ error: `Impossible de confirmer une déclaration au statut "${found.tx.status}"` }); return;
    }

    const year = new Date().getFullYear();
    const [cnt] = await db.select({ c: sql<number>`count(*)::int` }).from(paymentTransactionsTable)
      .where(and(eq(paymentTransactionsTable.organizationId, found.tx.organizationId), eq(paymentTransactionsTable.status, "confirmed"), sql`EXTRACT(year FROM created_at) = ${year}`));
    const receiptNumber = generateRef("REC", (cnt?.c ?? 0) + 1, year);
    const now = new Date();

    const [updated] = await db.update(paymentTransactionsTable).set({
      status: "confirmed",
      confirmedAt: now,
      verifiedAt: now,
      verifiedById: req.authUser!.id,
      receiptNumber,
    }).where(eq(paymentTransactionsTable.id, id)).returning();

    if (found.tx.billingEventId) {
      await db.update(billingEventsTable).set({ status: "paid", reference: receiptNumber })
        .where(eq(billingEventsTable.id, found.tx.billingEventId));
    }

    let periodEnd: Date | null = null;
    if (found.tx.subscriptionId) {
      const [sub] = await db.select().from(organizationSubscriptionsTable)
        .where(eq(organizationSubscriptionsTable.id, found.tx.subscriptionId)).limit(1);
      if (sub) {
        const MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };
        const months = MONTHS[found.tx.periodicity ?? "monthly"] ?? 1;
        const periodStart = sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) > now ? new Date(sub.currentPeriodEnd) : now;
        periodEnd = new Date(periodStart);
        periodEnd.setMonth(periodEnd.getMonth() + months);
        await db.update(organizationSubscriptionsTable).set({
          status: "active",
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        }).where(eq(organizationSubscriptionsTable.id, sub.id));
      }
    }

    const clientEmail = found.orgContactEmail;
    if (clientEmail) {
      await sendEmail({
        to: clientEmail,
        subject: `[Gaméasù] Paiement confirmé — ${receiptNumber}`,
        html: emailPaymentConfirmed({ orgName: found.orgName, receiptNumber, amount: found.tx.amount, method: METHOD_LABELS[found.tx.method] ?? found.tx.method, periodEnd }),
        text: `Votre paiement ${receiptNumber} a été confirmé. Votre abonnement est actif.`,
      });
    }

    logger.info({ txId: id, receiptNumber }, "Déclaration manuelle confirmée");
    res.json({ ...updated });
  } catch (e) { next(e); }
});

// ── POST /super-admin/payment-declarations/:id/reject ─────────────
router.post("/super-admin/payment-declarations/:id/reject", sa, async (req, res, next) => {
  try {
    const { id } = req.params as Record<string, string>;
    const { reason } = req.body as { reason?: string };
    if (!reason?.trim()) { res.status(400).json({ error: "Un motif de rejet est obligatoire" }); return; }

    const [found] = await db.select({
      tx: paymentTransactionsTable,
      orgName: organizationsTable.name,
      orgContactEmail: organizationsTable.contactEmail,
    }).from(paymentTransactionsTable)
      .innerJoin(organizationsTable, eq(organizationsTable.id, paymentTransactionsTable.organizationId))
      .where(eq(paymentTransactionsTable.id, id)).limit(1);

    if (!found) { res.status(404).json({ error: "Déclaration introuvable" }); return; }
    if (found.tx.status !== "pending_verification") {
      res.status(400).json({ error: `Impossible de rejeter une déclaration au statut "${found.tx.status}"` }); return;
    }

    const now = new Date();
    const [updated] = await db.update(paymentTransactionsTable).set({
      status: "rejected",
      rejectionReason: reason.trim(),
      verifiedAt: now,
      verifiedById: req.authUser!.id,
    }).where(eq(paymentTransactionsTable.id, id)).returning();

    if (found.tx.billingEventId) {
      await db.update(billingEventsTable).set({ status: "failed" }).where(eq(billingEventsTable.id, found.tx.billingEventId));
    }

    const clientEmail = found.orgContactEmail;
    if (clientEmail) {
      await sendEmail({
        to: clientEmail,
        subject: `[Gaméasù] Déclaration de paiement non validée — ${found.tx.reference}`,
        html: emailPaymentRejected({ orgName: found.orgName, reference: found.tx.reference ?? "—", reason: reason.trim(), amount: found.tx.amount, method: METHOD_LABELS[found.tx.method] ?? found.tx.method }),
        text: `Votre déclaration ${found.tx.reference} a été rejetée. Motif : ${reason.trim()}.`,
      });
    }

    logger.info({ txId: id, reason }, "Déclaration manuelle rejetée");
    res.json({ ...updated });
  } catch (e) { next(e); }
});

// ── POST /super-admin/payment-declarations/:id/cancel ────────────
router.post("/super-admin/payment-declarations/:id/cancel", sa, async (req, res, next) => {
  try {
    const { id } = req.params as Record<string, string>;

    const [found] = await db.select({ tx: paymentTransactionsTable })
      .from(paymentTransactionsTable)
      .where(eq(paymentTransactionsTable.id, id)).limit(1);

    if (!found) { res.status(404).json({ error: "Déclaration introuvable" }); return; }
    if (found.tx.status !== "pending_verification") {
      res.status(400).json({ error: `Impossible d'annuler une déclaration au statut "${found.tx.status}"` }); return;
    }

    const [updated] = await db.update(paymentTransactionsTable).set({
      status: "cancelled",
      verifiedAt: new Date(),
      verifiedById: req.authUser!.id,
    }).where(eq(paymentTransactionsTable.id, id)).returning();

    if (found.tx.billingEventId) {
      await db.update(billingEventsTable).set({ status: "failed" }).where(eq(billingEventsTable.id, found.tx.billingEventId));
    }

    logger.info({ txId: id }, "Déclaration manuelle annulée par super-admin");
    res.json({ ...updated });
  } catch (e) { next(e); }
});

// ─── Email templates ──────────────────────────────────────────────

function fmt(n: number) { return new Intl.NumberFormat("fr-FR").format(n) + " FCFA"; }

function emailDeclarationAck({ orgName, txRef, amount, method, planName, seats }: { orgName: string; txRef: string; amount: number; method: string; planName: string; seats: number }) {
  return `<!DOCTYPE html><html lang="fr"><body style="font-family:Arial,sans-serif;background:#f9f9f9;padding:24px">
<div style="max-width:560px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <div style="background:#F37021;padding:20px 24px"><h1 style="color:#fff;margin:0;font-size:20px">Gaméasù</h1><p style="color:rgba(255,255,255,.85);margin:4px 0 0;font-size:13px">Déclaration de paiement reçue</p></div>
  <div style="padding:24px">
    <p style="color:#374151">Bonjour,</p>
    <p style="color:#374151">Nous avons bien reçu votre déclaration de paiement pour <strong>${orgName}</strong>.</p>
    <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:16px 0">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="color:#6b7280;padding:4px 0">Référence</td><td style="font-weight:600;text-align:right">${txRef}</td></tr>
        <tr><td style="color:#6b7280;padding:4px 0">Formule</td><td style="font-weight:600;text-align:right">${planName} — ${seats} utilisateur${seats > 1 ? "s" : ""}</td></tr>
        <tr><td style="color:#6b7280;padding:4px 0">Moyen de paiement</td><td style="font-weight:600;text-align:right">${method}</td></tr>
        <tr><td style="color:#6b7280;padding:4px 0">Montant TTC</td><td style="font-weight:700;text-align:right;color:#F37021">${fmt(amount)}</td></tr>
      </table>
    </div>
    <p style="color:#374151">Notre équipe vérifiera votre justificatif dans un délai de <strong>24 à 48 heures ouvrables</strong>. Vous recevrez un email de confirmation ou de retour.</p>
    <p style="color:#6b7280;font-size:13px;margin-top:24px">Gaméasù — La plateforme de pilotage d'entreprise</p>
  </div>
</div></body></html>`;
}

function emailTeamNotif({ orgName, txRef, amount, method, planName, seats, cockpitUrl }: { orgName: string; txRef: string; amount: number; method: string; planName: string; seats: number; cockpitUrl: string }) {
  return `<!DOCTYPE html><html lang="fr"><body style="font-family:Arial,sans-serif;background:#f9f9f9;padding:24px">
<div style="max-width:560px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <div style="background:#0F172A;padding:20px 24px"><h1 style="color:#fff;margin:0;font-size:20px">Cockpit Gaméasù</h1><p style="color:rgba(255,255,255,.7);margin:4px 0 0;font-size:13px">Nouvelle déclaration de paiement</p></div>
  <div style="padding:24px">
    <p style="color:#374151"><strong>Organisation :</strong> ${orgName}</p>
    <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin:16px 0">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="color:#92400e;padding:4px 0">Référence</td><td style="font-weight:600;text-align:right">${txRef}</td></tr>
        <tr><td style="color:#92400e;padding:4px 0">Formule</td><td style="font-weight:600;text-align:right">${planName} — ${seats} util.</td></tr>
        <tr><td style="color:#92400e;padding:4px 0">Moyen de paiement</td><td style="font-weight:600;text-align:right">${method}</td></tr>
        <tr><td style="color:#92400e;padding:4px 0">Montant TTC</td><td style="font-weight:700;text-align:right;color:#d97706">${fmt(amount)}</td></tr>
      </table>
    </div>
    <a href="${cockpitUrl}" style="display:inline-block;background:#F37021;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">Vérifier dans le Cockpit</a>
  </div>
</div></body></html>`;
}

function emailPaymentConfirmed({ orgName, receiptNumber, amount, method, periodEnd }: { orgName: string; receiptNumber: string; amount: number; method: string; periodEnd: Date | null }) {
  const fmtDate = (d: Date | null) => d ? d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—";
  return `<!DOCTYPE html><html lang="fr"><body style="font-family:Arial,sans-serif;background:#f9f9f9;padding:24px">
<div style="max-width:560px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <div style="background:#059669;padding:20px 24px"><h1 style="color:#fff;margin:0;font-size:20px">✓ Paiement confirmé</h1><p style="color:rgba(255,255,255,.85);margin:4px 0 0;font-size:13px">Gaméasù — Votre abonnement est actif</p></div>
  <div style="padding:24px">
    <p style="color:#374151">Bonjour,</p>
    <p style="color:#374151">Le paiement de <strong>${orgName}</strong> a été confirmé. Votre abonnement est maintenant actif.</p>
    <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:16px;margin:16px 0">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="color:#065f46;padding:4px 0">Numéro de reçu</td><td style="font-weight:600;text-align:right">${receiptNumber}</td></tr>
        <tr><td style="color:#065f46;padding:4px 0">Moyen de paiement</td><td style="font-weight:600;text-align:right">${method}</td></tr>
        <tr><td style="color:#065f46;padding:4px 0">Montant TTC</td><td style="font-weight:700;text-align:right">${fmt(amount)}</td></tr>
        ${periodEnd ? `<tr><td style="color:#065f46;padding:4px 0">Valable jusqu'au</td><td style="font-weight:600;text-align:right">${fmtDate(periodEnd)}</td></tr>` : ""}
      </table>
    </div>
    <p style="color:#374151">Merci pour votre confiance. N'hésitez pas à nous contacter pour toute question.</p>
    <p style="color:#6b7280;font-size:13px;margin-top:24px">Gaméasù — La plateforme de pilotage d'entreprise</p>
  </div>
</div></body></html>`;
}

function emailPaymentRejected({ orgName, reference, reason, amount, method }: { orgName: string; reference: string; reason: string; amount: number; method: string }) {
  return `<!DOCTYPE html><html lang="fr"><body style="font-family:Arial,sans-serif;background:#f9f9f9;padding:24px">
<div style="max-width:560px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <div style="background:#dc2626;padding:20px 24px"><h1 style="color:#fff;margin:0;font-size:20px">Déclaration non validée</h1><p style="color:rgba(255,255,255,.85);margin:4px 0 0;font-size:13px">Gaméasù — Action requise</p></div>
  <div style="padding:24px">
    <p style="color:#374151">Bonjour,</p>
    <p style="color:#374151">Nous n'avons pas pu valider la déclaration de paiement de <strong>${orgName}</strong>.</p>
    <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0 0 8px;font-size:13px;color:#991b1b"><strong>Référence :</strong> ${reference}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#991b1b"><strong>Montant :</strong> ${fmt(amount)} (${method})</p>
      <p style="margin:0;font-size:13px;color:#991b1b"><strong>Motif du rejet :</strong> ${reason}</p>
    </div>
    <p style="color:#374151">Veuillez soumettre une nouvelle déclaration avec les informations corrigées, ou contacter notre équipe pour tout éclaircissement.</p>
    <p style="color:#6b7280;font-size:13px;margin-top:24px">Gaméasù — La plateforme de pilotage d'entreprise</p>
  </div>
</div></body></html>`;
}

export default router;
