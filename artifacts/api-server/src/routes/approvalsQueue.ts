/**
 * Phase 17 — File d'approbations transversale.
 *  - GET /api/approvals/queue : agrégateur d'éléments en attente de décision.
 *
 * Surface en une vue les items qui exigent une action manuelle d'un manager :
 * proformas brouillons, factures non envoyées, gros engagements, documents en
 * attente de signature, contrats expirant <30j, opportunités à clôturer. ACL
 * fine via permissions et clients accessibles.
 */
import { Router, type IRouter } from "express";
import {
  db, proformasTable, invoicesTable, ordersTable, documentsTable,
  contractsTable, collaboratorsTable, opportunitiesTable, clientsTable,
} from "@workspace/db";
import { and, eq, isNull, sql, desc, inArray, lte, gte, ne, or } from "drizzle-orm";
import { hasPermission, userAccessibleClientIds, userAccessibleProjectIds } from "../lib/rbac/permissions";

const router: IRouter = Router();

router.get("/approvals/queue", async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const clientIds = await userAccessibleClientIds(userId);
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86400000);
    const items: Array<{ kind: string; id: string; title: string; subtitle?: string; amount?: number | null; severity: "low" | "medium" | "high" | "urgent"; entityType: string; entityId: string; createdAt: string }> = [];

    // 1. Proformas en brouillon (commercial.read)
    if (await hasPermission(userId, "commercial.read")) {
      const conds: any[] = [eq(proformasTable.status, "draft")];
      if (clientIds && clientIds.length) conds.push(inArray(proformasTable.clientId, clientIds));
      if (!(clientIds && clientIds.length === 0)) {
        const rows = await db.select({ id: proformasTable.id, ref: proformasTable.referenceNumber, totalAmount: proformasTable.totalAmount, createdAt: proformasTable.createdAt })
          .from(proformasTable).where(and(...conds)).orderBy(desc(proformasTable.createdAt)).limit(20);
        for (const r of rows) {
          const ageDays = Math.floor((now.getTime() - new Date(r.createdAt).getTime()) / 86400000);
          items.push({
            kind: "proforma_draft", id: r.id, title: `Proforma ${r.ref} à finaliser`,
            subtitle: `Brouillon depuis ${ageDays} j`, amount: Number(r.totalAmount ?? 0),
            severity: ageDays > 7 ? "high" : ageDays > 3 ? "medium" : "low",
            entityType: "proforma", entityId: r.id, createdAt: r.createdAt.toISOString(),
          });
        }
      }
    }

    // 2. Factures à envoyer (status=draft, accounting.write)
    if (await hasPermission(userId, "accounting.read")) {
      const conds: any[] = [eq(invoicesTable.status, "draft")];
      if (clientIds && clientIds.length) conds.push(inArray(invoicesTable.clientId, clientIds));
      if (!(clientIds && clientIds.length === 0)) {
        const rows = await db.select({ id: invoicesTable.id, ref: invoicesTable.referenceNumber, totalAmount: invoicesTable.totalAmount, createdAt: invoicesTable.createdAt })
          .from(invoicesTable).where(and(...conds)).orderBy(desc(invoicesTable.createdAt)).limit(20);
        for (const r of rows) {
          const ageDays = Math.floor((now.getTime() - new Date(r.createdAt).getTime()) / 86400000);
          items.push({
            kind: "invoice_draft", id: r.id, title: `Facture ${r.ref} à émettre`,
            subtitle: `Brouillon depuis ${ageDays} j`, amount: Number(r.totalAmount ?? 0),
            severity: ageDays > 5 ? "urgent" : ageDays > 2 ? "high" : "medium",
            entityType: "invoice", entityId: r.id, createdAt: r.createdAt.toISOString(),
          });
        }
      }
    }

    // 3. Documents en attente de signature (documents.read + ACL projet)
    if (await hasPermission(userId, "documents.read")) {
      const accessible = await userAccessibleProjectIds(userId);
      const docConds: any[] = [isNull(documentsTable.deletedAt), eq(documentsTable.signatureStatus, "pending")];
      if (accessible !== null) {
        if (accessible.length === 0) docConds.push(ne(documentsTable.entityType, "project"));
        else docConds.push(or(
          ne(documentsTable.entityType, "project"),
          and(eq(documentsTable.entityType, "project"), inArray(documentsTable.entityId, accessible)),
        ));
      }
      const rows = await db.select({ id: documentsTable.id, name: documentsTable.name, createdAt: documentsTable.createdAt })
        .from(documentsTable).where(and(...docConds)).orderBy(desc(documentsTable.createdAt)).limit(20);
      for (const r of rows) {
        const ageDays = Math.floor((now.getTime() - new Date(r.createdAt).getTime()) / 86400000);
        items.push({
          kind: "doc_pending_signature", id: r.id, title: `Signature attendue : ${r.name}`,
          subtitle: `En attente depuis ${ageDays} j`, amount: null,
          severity: ageDays > 14 ? "urgent" : ageDays > 7 ? "high" : "medium",
          entityType: "document", entityId: r.id, createdAt: r.createdAt.toISOString(),
        });
      }
    }

    // 4. Contrats RH expirant <30j (hr.read)
    if (await hasPermission(userId, "hr.read")) {
      const rows = await db.select({
        id: contractsTable.id, endDate: contractsTable.endDate, jobTitle: contractsTable.jobTitle,
        firstName: collaboratorsTable.firstName, lastName: collaboratorsTable.lastName,
      }).from(contractsTable)
        .leftJoin(collaboratorsTable, eq(collaboratorsTable.id, contractsTable.collaboratorId))
        .where(and(eq(contractsTable.status, "active"))).limit(50);
      for (const r of rows) {
        if (!r.endDate) continue;
        const endDate = new Date(r.endDate);
        if (endDate < now || endDate > in30) continue;
        const days = Math.ceil((endDate.getTime() - now.getTime()) / 86400000);
        items.push({
          kind: "contract_expiring", id: r.id, title: `Contrat ${r.firstName ?? ""} ${r.lastName ?? ""} expire dans ${days} j`,
          subtitle: r.jobTitle ?? undefined, amount: null,
          severity: days <= 7 ? "urgent" : days <= 14 ? "high" : "medium",
          entityType: "contract", entityId: r.id, createdAt: now.toISOString(),
        });
      }
    }

    // 5. Opportunités à clôturer (échéance ≤7j et stage avancé)
    if (await hasPermission(userId, "commercial.read")) {
      const conds: any[] = [
        isNull(opportunitiesTable.deletedAt),
        inArray(opportunitiesTable.stage, ["negotiation", "contract", "closing", "proposal"]),
      ];
      if (clientIds && clientIds.length) conds.push(inArray(opportunitiesTable.clientId, clientIds));
      if (!(clientIds && clientIds.length === 0)) {
        const rows = await db.select({
          id: opportunitiesTable.id, title: opportunitiesTable.title, stage: opportunitiesTable.stage,
          value: opportunitiesTable.value, expectedCloseDate: opportunitiesTable.expectedCloseDate, createdAt: opportunitiesTable.createdAt,
        }).from(opportunitiesTable).where(and(...conds)).limit(50);
        for (const r of rows) {
          if (!r.expectedCloseDate) continue;
          const closeDate = new Date(r.expectedCloseDate);
          const days = Math.ceil((closeDate.getTime() - now.getTime()) / 86400000);
          if (days > 7) continue;
          items.push({
            kind: "opportunity_closing", id: r.id, title: `Opp à clôturer : ${r.title}`,
            subtitle: `Stade ${r.stage} · échéance ${days < 0 ? `dépassée de ${-days} j` : `dans ${days} j`}`,
            amount: Number(r.value ?? 0),
            severity: days < 0 ? "urgent" : days <= 2 ? "high" : "medium",
            entityType: "opportunity", entityId: r.id, createdAt: r.createdAt.toISOString(),
          });
        }
      }
    }

    // Compte par sévérité
    const counts = { urgent: 0, high: 0, medium: 0, low: 0 };
    for (const it of items) counts[it.severity]++;
    // Tri sévérité décroissante puis ancienneté
    const sevOrder = { urgent: 3, high: 2, medium: 1, low: 0 };
    items.sort((a, b) => sevOrder[b.severity] - sevOrder[a.severity] || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return res.json({ total: items.length, counts, items: items.slice(0, 100) });
  } catch (e) { next(e); }
});

export default router;
