/**
 * Rapprochement 3 pièces — Bon de commande / Réception / Facture fournisseur
 * (audit phase 5.3). Signale, pour une facture fournisseur :
 *   - facture sans bon de commande rattaché ;
 *   - facture sans réception (BC rattaché mais rien de reçu) ;
 *   - écart de quantités (facturé vs reçu, en agrégat) ;
 *   - écart de prix (HT facturé vs montant du BC, tolérance 1 % ou 1 000 FCFA) ;
 *   - doublon probable (même fournisseur, même montant à ±1 FCFA sous 30 jours,
 *     ou même référence) ;
 *   - montant au-dessus du seuil d'approbation du module Achats.
 *
 * Les drapeaux `error` bloquent l'approbation (sauf passage en force motivé) ;
 * les `warning` sont informatifs.
 */
import { db } from "@workspace/db";
import {
  supplierInvoicesTable,
  supplierInvoiceLinesTable,
  purchaseOrdersTable,
  purchaseOrderLinesTable,
  organizationModulesTable,
} from "@workspace/db";
import { and, eq, ne, sql } from "drizzle-orm";

const num = (v: unknown) => (v == null ? 0 : Number(v));

export type MatchFlag = {
  code:
    | "invoice_without_order"
    | "invoice_without_reception"
    | "quantity_mismatch"
    | "price_mismatch"
    | "possible_duplicate"
    | "over_threshold";
  severity: "error" | "warning";
  message: string;
  details?: Record<string, unknown>;
};

export interface ThreeWayMatchReport {
  invoiceId: string;
  referenceNumber: string;
  flags: MatchFlag[];
  /** true si aucun drapeau bloquant (severity=error). */
  passes: boolean;
  order: { id: string; reference: string; totalFcfa: number; status: string } | null;
  reception: { quantityOrdered: number; quantityReceived: number } | null;
}

const DEFAULT_APPROVAL_THRESHOLD = 500_000;

async function getApprovalThreshold(organizationId: string): Promise<number> {
  const [row] = await db.select({ config: organizationModulesTable.config })
    .from(organizationModulesTable)
    .where(and(
      eq(organizationModulesTable.organizationId, organizationId),
      eq(organizationModulesTable.moduleKey, "purchases"),
    ));
  const cfg = row?.config as Record<string, unknown> | null | undefined;
  return typeof cfg?.approvalThreshold === "number" ? cfg.approvalThreshold : DEFAULT_APPROVAL_THRESHOLD;
}

export async function threeWayMatch(organizationId: string, invoiceId: string): Promise<ThreeWayMatchReport> {
  const [inv] = await db.select().from(supplierInvoicesTable).where(and(
    eq(supplierInvoicesTable.organizationId, organizationId),
    eq(supplierInvoicesTable.id, invoiceId),
  )).limit(1);
  if (!inv) throw new Error("Facture fournisseur introuvable");

  const flags: MatchFlag[] = [];
  const totalTtc = num(inv.totalAmount);
  const totalHt = totalTtc - num(inv.taxAmount);

  // ── 1. Bon de commande ────────────────────────────────────────────────────
  let order: ThreeWayMatchReport["order"] = null;
  let reception: ThreeWayMatchReport["reception"] = null;

  if (!inv.purchaseOrderId) {
    flags.push({
      code: "invoice_without_order",
      severity: "warning",
      message: "Facture sans bon de commande rattaché — rapprochement impossible.",
    });
  } else {
    const [po] = await db.select().from(purchaseOrdersTable).where(and(
      eq(purchaseOrdersTable.organizationId, organizationId),
      eq(purchaseOrdersTable.id, inv.purchaseOrderId),
    )).limit(1);
    if (!po) {
      flags.push({
        code: "invoice_without_order",
        severity: "error",
        message: "Le bon de commande rattaché n'existe pas (ou plus).",
      });
    } else {
      order = { id: po.id, reference: po.reference, totalFcfa: num(po.totalFcfa), status: po.status };

      // ── 2. Réception ──────────────────────────────────────────────────────
      const [qty] = await db.select({
        ordered: sql<string>`COALESCE(SUM(${purchaseOrderLinesTable.quantity}), 0)`,
        received: sql<string>`COALESCE(SUM(${purchaseOrderLinesTable.quantityReceived}), 0)`,
      }).from(purchaseOrderLinesTable)
        .where(eq(purchaseOrderLinesTable.purchaseOrderId, po.id));
      reception = { quantityOrdered: num(qty?.ordered), quantityReceived: num(qty?.received) };

      if (reception.quantityOrdered > 0 && reception.quantityReceived <= 0) {
        flags.push({
          code: "invoice_without_reception",
          severity: "error",
          message: `Aucune réception enregistrée sur le bon de commande ${po.reference}.`,
          details: reception,
        });
      } else if (reception.quantityOrdered > 0 && reception.quantityReceived + 1e-9 < reception.quantityOrdered) {
        flags.push({
          code: "quantity_mismatch",
          severity: "warning",
          message: `Réception partielle : ${reception.quantityReceived} reçu(s) sur ${reception.quantityOrdered} commandé(s).`,
          details: reception,
        });
      }

      // ── 3. Prix : HT facturé vs montant du BC ─────────────────────────────
      const poTotal = num(po.totalFcfa);
      if (poTotal > 0) {
        const gap = Math.abs(totalHt - poTotal);
        const tolerance = Math.max(1000, poTotal * 0.01);
        if (gap > tolerance) {
          flags.push({
            code: "price_mismatch",
            severity: totalHt > poTotal ? "error" : "warning",
            message: `Écart de montant : facture HT ${totalHt.toLocaleString("fr-FR")} FCFA vs bon de commande ${poTotal.toLocaleString("fr-FR")} FCFA.`,
            details: { totalHt, poTotal, gap },
          });
        }
      }
    }
  }

  // ── 4. Doublon probable ────────────────────────────────────────────────────
  const dupes = await db.select({
    id: supplierInvoicesTable.id,
    referenceNumber: supplierInvoicesTable.referenceNumber,
    invoiceDate: supplierInvoicesTable.invoiceDate,
    totalAmount: supplierInvoicesTable.totalAmount,
  }).from(supplierInvoicesTable).where(and(
    eq(supplierInvoicesTable.organizationId, organizationId),
    eq(supplierInvoicesTable.supplierId, inv.supplierId),
    ne(supplierInvoicesTable.id, inv.id),
    ne(supplierInvoicesTable.status, "cancelled"),
  ));
  const invDate = new Date(inv.invoiceDate).getTime();
  for (const d of dupes) {
    const sameRef = d.referenceNumber.trim().toLowerCase() === inv.referenceNumber.trim().toLowerCase();
    const sameAmount = Math.abs(num(d.totalAmount) - totalTtc) <= 1;
    const near = Math.abs(new Date(d.invoiceDate).getTime() - invDate) <= 30 * 86_400_000;
    if (sameRef || (sameAmount && near)) {
      flags.push({
        code: "possible_duplicate",
        severity: sameRef ? "error" : "warning",
        message: sameRef
          ? `Une facture du même fournisseur porte déjà la référence ${d.referenceNumber}.`
          : `Montant identique (${totalTtc.toLocaleString("fr-FR")} FCFA) à la facture ${d.referenceNumber} du même fournisseur à moins de 30 jours.`,
        details: { otherInvoiceId: d.id, otherReference: d.referenceNumber },
      });
      break;
    }
  }

  // ── 5. Seuil d'approbation ─────────────────────────────────────────────────
  const threshold = await getApprovalThreshold(organizationId);
  if (totalTtc > threshold) {
    flags.push({
      code: "over_threshold",
      severity: "warning",
      message: `Montant (${totalTtc.toLocaleString("fr-FR")} FCFA) supérieur au seuil d'approbation (${threshold.toLocaleString("fr-FR")} FCFA) — validation hiérarchique requise.`,
      details: { threshold, totalTtc },
    });
  }

  return {
    invoiceId: inv.id,
    referenceNumber: inv.referenceNumber,
    flags,
    passes: !flags.some((f) => f.severity === "error"),
    order,
    reception,
  };
}
