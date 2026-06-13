import { Router } from "express";
import {
  db,
  pricingScenariosTable,
  clientsTable,
  organizationsTable,
} from "@workspace/db";
import { and, eq, isNull, desc, ilike, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { generatePricingPdf } from "../lib/pricing-pdf";

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── LIST ──────────────────────────────────────────────────────────────────────
router.get("/api/pricing/scenarios", async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const { q, limit = "50", offset = "0" } = req.query as Record<string, string>;

  const conds = [
    eq(pricingScenariosTable.organizationId, orgId),
    isNull(pricingScenariosTable.deletedAt),
  ];
  if (q?.trim()) {
    conds.push(
      or(
        ilike(pricingScenariosTable.name, `%${q.trim()}%`),
        ilike(pricingScenariosTable.productName, `%${q.trim()}%`),
      ) as any,
    );
  }

  const rows = await db
    .select({
      id: pricingScenariosTable.id,
      name: pricingScenariosTable.name,
      description: pricingScenariosTable.description,
      productName: pricingScenariosTable.productName,
      clientId: pricingScenariosTable.clientId,
      opportunityId: pricingScenariosTable.opportunityId,
      shareToken: pricingScenariosTable.shareToken,
      shareEnabled: pricingScenariosTable.shareEnabled,
      notes: pricingScenariosTable.notes,
      createdAt: pricingScenariosTable.createdAt,
      updatedAt: pricingScenariosTable.updatedAt,
      clientName: clientsTable.name,
    })
    .from(pricingScenariosTable)
    .leftJoin(clientsTable, eq(pricingScenariosTable.clientId, clientsTable.id))
    .where(and(...conds))
    .orderBy(desc(pricingScenariosTable.updatedAt))
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  return res.json({ data: rows, total: rows.length });
});

// ─── GET ONE ──────────────────────────────────────────────────────────────────
router.get("/api/pricing/scenarios/:id", async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const [row] = await db
    .select({
      id: pricingScenariosTable.id,
      name: pricingScenariosTable.name,
      description: pricingScenariosTable.description,
      productName: pricingScenariosTable.productName,
      clientId: pricingScenariosTable.clientId,
      opportunityId: pricingScenariosTable.opportunityId,
      proformaId: pricingScenariosTable.proformaId,
      orderId: pricingScenariosTable.orderId,
      invoiceId: pricingScenariosTable.invoiceId,
      shareToken: pricingScenariosTable.shareToken,
      shareEnabled: pricingScenariosTable.shareEnabled,
      scenarioData: pricingScenariosTable.scenarioData,
      resultData: pricingScenariosTable.resultData,
      notes: pricingScenariosTable.notes,
      createdBy: pricingScenariosTable.createdBy,
      createdAt: pricingScenariosTable.createdAt,
      updatedAt: pricingScenariosTable.updatedAt,
      clientName: clientsTable.name,
    })
    .from(pricingScenariosTable)
    .leftJoin(clientsTable, eq(pricingScenariosTable.clientId, clientsTable.id))
    .where(
      and(
        eq(pricingScenariosTable.id, req.params.id),
        eq(pricingScenariosTable.organizationId, orgId),
        isNull(pricingScenariosTable.deletedAt),
      ),
    )
    .limit(1);

  if (!row) return res.status(404).json({ error: "Scénario introuvable" });
  return res.json(row);
});

// ─── CREATE ───────────────────────────────────────────────────────────────────
router.post("/api/pricing/scenarios", async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const userId = req.authUser!.userId;

  const {
    name, description, productName, clientId,
    opportunityId, proformaId, orderId, invoiceId,
    scenarioData, resultData, notes,
  } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: "Le nom est obligatoire" });
  if (!scenarioData) return res.status(400).json({ error: "Les données du scénario sont obligatoires" });

  const [created] = await db
    .insert(pricingScenariosTable)
    .values({
      organizationId: orgId,
      name: name.trim(),
      description: description ?? null,
      productName: productName ?? null,
      clientId: clientId ?? null,
      opportunityId: opportunityId ?? null,
      proformaId: proformaId ?? null,
      orderId: orderId ?? null,
      invoiceId: invoiceId ?? null,
      shareToken: randomUUID(),
      shareEnabled: false,
      scenarioData,
      resultData: resultData ?? null,
      notes: notes ?? null,
      createdBy: userId,
    })
    .returning();

  return res.status(201).json(created);
});

// ─── UPDATE ───────────────────────────────────────────────────────────────────
router.put("/api/pricing/scenarios/:id", async (req, res) => {
  const orgId = req.authUser!.organizationId;

  const [existing] = await db
    .select({ id: pricingScenariosTable.id })
    .from(pricingScenariosTable)
    .where(
      and(
        eq(pricingScenariosTable.id, req.params.id),
        eq(pricingScenariosTable.organizationId, orgId),
        isNull(pricingScenariosTable.deletedAt),
      ),
    )
    .limit(1);
  if (!existing) return res.status(404).json({ error: "Scénario introuvable" });

  const {
    name, description, productName, clientId,
    opportunityId, proformaId, orderId, invoiceId,
    scenarioData, resultData, notes,
  } = req.body;

  const [updated] = await db
    .update(pricingScenariosTable)
    .set({
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(productName !== undefined ? { productName } : {}),
      ...(clientId !== undefined ? { clientId } : {}),
      ...(opportunityId !== undefined ? { opportunityId } : {}),
      ...(proformaId !== undefined ? { proformaId } : {}),
      ...(orderId !== undefined ? { orderId } : {}),
      ...(invoiceId !== undefined ? { invoiceId } : {}),
      ...(scenarioData !== undefined ? { scenarioData } : {}),
      ...(resultData !== undefined ? { resultData } : {}),
      ...(notes !== undefined ? { notes } : {}),
    })
    .where(
      and(
        eq(pricingScenariosTable.id, req.params.id),
        eq(pricingScenariosTable.organizationId, orgId),
      ),
    )
    .returning();

  return res.json(updated);
});

// ─── DELETE (soft) ────────────────────────────────────────────────────────────
router.delete("/api/pricing/scenarios/:id", async (req, res) => {
  const orgId = req.authUser!.organizationId;
  await db
    .update(pricingScenariosTable)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(pricingScenariosTable.id, req.params.id),
        eq(pricingScenariosTable.organizationId, orgId),
      ),
    );
  return res.json({ ok: true });
});

// ─── DUPLICATE ────────────────────────────────────────────────────────────────
router.post("/api/pricing/scenarios/:id/duplicate", async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const userId = req.authUser!.userId;

  const [src] = await db
    .select()
    .from(pricingScenariosTable)
    .where(
      and(
        eq(pricingScenariosTable.id, req.params.id),
        eq(pricingScenariosTable.organizationId, orgId),
        isNull(pricingScenariosTable.deletedAt),
      ),
    )
    .limit(1);
  if (!src) return res.status(404).json({ error: "Scénario introuvable" });

  const [dup] = await db
    .insert(pricingScenariosTable)
    .values({
      organizationId: orgId,
      name: `${src.name} (copie)`,
      description: src.description,
      productName: src.productName,
      clientId: src.clientId,
      opportunityId: src.opportunityId,
      proformaId: null,
      orderId: null,
      invoiceId: null,
      shareToken: randomUUID(),
      shareEnabled: false,
      scenarioData: src.scenarioData,
      resultData: src.resultData,
      notes: src.notes,
      createdBy: userId,
    })
    .returning();

  return res.status(201).json(dup);
});

// ─── TOGGLE SHARE ─────────────────────────────────────────────────────────────
router.patch("/api/pricing/scenarios/:id/share", async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const { enabled } = req.body as { enabled: boolean };

  const [updated] = await db
    .update(pricingScenariosTable)
    .set({ shareEnabled: !!enabled })
    .where(
      and(
        eq(pricingScenariosTable.id, req.params.id),
        eq(pricingScenariosTable.organizationId, orgId),
        isNull(pricingScenariosTable.deletedAt),
      ),
    )
    .returning({ shareEnabled: pricingScenariosTable.shareEnabled, shareToken: pricingScenariosTable.shareToken });

  if (!updated) return res.status(404).json({ error: "Scénario introuvable" });
  return res.json(updated);
});

// ─── LINK DOCUMENTS ───────────────────────────────────────────────────────────
router.patch("/api/pricing/scenarios/:id/links", async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const { opportunityId, proformaId, orderId, invoiceId } = req.body;

  const [updated] = await db
    .update(pricingScenariosTable)
    .set({
      ...(opportunityId !== undefined ? { opportunityId } : {}),
      ...(proformaId !== undefined ? { proformaId } : {}),
      ...(orderId !== undefined ? { orderId } : {}),
      ...(invoiceId !== undefined ? { invoiceId } : {}),
    })
    .where(
      and(
        eq(pricingScenariosTable.id, req.params.id),
        eq(pricingScenariosTable.organizationId, orgId),
        isNull(pricingScenariosTable.deletedAt),
      ),
    )
    .returning();

  if (!updated) return res.status(404).json({ error: "Scénario introuvable" });
  return res.json(updated);
});

// ─── EXPORT PDF ───────────────────────────────────────────────────────────────
router.get("/api/pricing/scenarios/:id/export.pdf", async (req, res) => {
  const orgId = req.authUser!.organizationId;

  const [row] = await db
    .select({
      scenario: pricingScenariosTable,
      clientName: clientsTable.name,
    })
    .from(pricingScenariosTable)
    .leftJoin(clientsTable, eq(pricingScenariosTable.clientId, clientsTable.id))
    .where(
      and(
        eq(pricingScenariosTable.id, req.params.id),
        eq(pricingScenariosTable.organizationId, orgId),
        isNull(pricingScenariosTable.deletedAt),
      ),
    )
    .limit(1);

  if (!row) return res.status(404).json({ error: "Scénario introuvable" });

  const [orgRow] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, orgId))
    .limit(1);

  const sc = row.scenario.scenarioData as Record<string, any>;
  const result = row.scenario.resultData as Record<string, any> | null;

  // Build cost breakdown from scenarioData
  const costBreakdown: { label: string; amount: number; pct: number }[] = [];
  const totalCost = (result?.totalCost as number) ?? 0;

  const catLabels: Record<string, string> = {
    direct: "Coûts directs",
    purchase: "Achats & approvisionnement",
    logistics: "Logistique",
    tax_input: "Taxes & droits",
    other: "Autres frais directs",
    labor: "Main-d\'œuvre",
    operational: "Charges opérationnelles",
    depreciation: "Amortissements",
    admin: "Administration & structure",
    commercial: "Frais commerciaux",
    financial: "Frais financiers",
    risk: "Provisions & risques",
  };

  if (result?.byCategory) {
    for (const [cat, amount] of Object.entries(result.byCategory as Record<string, number>)) {
      if (amount > 0) {
        costBreakdown.push({
          label: catLabels[cat] ?? cat,
          amount,
          pct: totalCost > 0 ? (amount / totalCost) * 100 : 0,
        });
      }
    }
    costBreakdown.sort((a, b) => b.amount - a.amount);
  }

  const shareUrl = row.scenario.shareEnabled
    ? `${req.protocol}://${req.get("host")}/pricing/share/${row.scenario.shareToken}`
    : undefined;

  const pdfData = {
    scenarioName: row.scenario.name,
    description: row.scenario.description,
    productName: row.scenario.productName,
    clientName: row.clientName ?? (sc?.clientId ? "Client lié" : null),
    category: sc?.category ?? null,
    unit: sc?.unit ?? null,
    quantity: sc?.quantity ?? null,
    period: sc?.period ?? null,
    notes: row.scenario.notes,
    shareUrl,
    generatedAt: formatDate(new Date()),
    costBreakdown,
    totalCost,
    minimumPriceHT: (result?.minimumPriceHT as number) ?? 0,
    recommendedPriceHT: (result?.recommendedPriceHT as number) ?? 0,
    finalPriceHT: (result?.priceHT as number) ?? 0,
    finalPriceTTC: (result?.priceTTC as number) ?? 0,
    taxRate: (sc?.taxRate as number) ?? 18,
    taxAmount: (result?.taxAmount as number) ?? 0,
    grossMarginPct: (result?.grossMarginPct as number) ?? 0,
    netMarginPct: (result?.netMarginPct as number) ?? 0,
    netProfit: (result?.netProfit as number) ?? 0,
    corporateTax: (result?.corporateTax as number) ?? 0,
    marginMode: (sc?.marginMode as string) ?? "net",
    marginTarget: (sc?.marginTarget as number) ?? 25,
    discountPct: (sc?.discountPct as number) ?? 0,
    discountAmount: (result?.discountAmount as number) ?? 0,
    priceHTBrut: (result?.priceHTBrut as number) ?? 0,
  };

  const orgData = {
    name: orgRow?.name ?? "Gaméasù",
    legalName: (orgRow as any)?.legalName ?? null,
    address: (orgRow as any)?.address ?? null,
    taxId: (orgRow as any)?.taxId ?? null,
    contactEmail: (orgRow as any)?.contactEmail ?? null,
    contactPhone: (orgRow as any)?.contactPhone ?? null,
  };

  const filename = `tarification_${row.scenario.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${new Date().toISOString().slice(0, 10)}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  generatePricingPdf(pdfData, orgData, res);
});

export default router;

// ─── PUBLIC SHARE ─────────────────────────────────────────────────────────────
export const pricingPublicRouter = Router();

pricingPublicRouter.get("/api/public/pricing/:token", async (req, res) => {
  const [row] = await db
    .select({
      id: pricingScenariosTable.id,
      name: pricingScenariosTable.name,
      description: pricingScenariosTable.description,
      productName: pricingScenariosTable.productName,
      shareToken: pricingScenariosTable.shareToken,
      shareEnabled: pricingScenariosTable.shareEnabled,
      scenarioData: pricingScenariosTable.scenarioData,
      resultData: pricingScenariosTable.resultData,
      notes: pricingScenariosTable.notes,
      createdAt: pricingScenariosTable.createdAt,
      updatedAt: pricingScenariosTable.updatedAt,
      clientName: clientsTable.name,
      orgName: organizationsTable.name,
    })
    .from(pricingScenariosTable)
    .leftJoin(clientsTable, eq(pricingScenariosTable.clientId, clientsTable.id))
    .leftJoin(organizationsTable, eq(pricingScenariosTable.organizationId, organizationsTable.id))
    .where(
      and(
        eq(pricingScenariosTable.shareToken, req.params.token),
        eq(pricingScenariosTable.shareEnabled, true),
        isNull(pricingScenariosTable.deletedAt),
      ),
    )
    .limit(1);

  if (!row) return res.status(404).json({ error: "Lien de partage invalide ou désactivé" });

  // Return read-only view — no scenarioData internals
  return res.json({
    id: row.id,
    name: row.name,
    description: row.description,
    productName: row.productName,
    clientName: row.clientName,
    orgName: row.orgName,
    resultData: row.resultData,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
});
