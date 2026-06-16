/**
 * Seed démo Inventory — produits, catégories, bons de commande, mouvements.
 * Idempotent : ne ré-insère pas si déjà présent (check sur SKU + PO reference).
 */
import { db } from "./index";
import {
  organizationsTable, suppliersTable,
  productCategoriesTable, productsTable,
  purchaseOrdersTable, purchaseOrderLinesTable,
  stockMovementsTable,
} from "./schema";
import { and, eq } from "drizzle-orm";

export async function seedInventoryDemo(): Promise<void> {
  // Organisation par défaut (nexora-demo)
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.slug, "nexora-demo")).limit(1);
  if (!org) return;
  const orgId = org.id;

  // Skip si déjà des produits dans cette org
  const existing = await db.select({ id: productsTable.id }).from(productsTable)
    .where(eq(productsTable.organizationId, orgId)).limit(1);
  if (existing.length > 0) return;

  // Catégories
  const categoriesData = [
    { name: "Matériaux BTP", description: "Ciment, sable, fer à béton" },
    { name: "Quincaillerie", description: "Outillage, fixations, accessoires" },
    { name: "Électricité", description: "Câbles, disjoncteurs, prises" },
    { name: "Plomberie", description: "Tubes, raccords, robinetterie" },
  ];
  const categoriesInserted = await db.insert(productCategoriesTable)
    .values(categoriesData.map((c) => ({ ...c, organizationId: orgId })))
    .returning();
  const catBy = (name: string) => categoriesInserted.find((c) => c.name === name)!.id;

  // Récupère un fournisseur existant (le seed accounting en crée), sinon en crée un
  const [supplier] = await db.select().from(suppliersTable).limit(1);
  let supplierId = supplier?.id;
  if (!supplierId) {
    const [created] = await db.insert(suppliersTable).values({
      organizationId: orgId, code: "F0001", name: "Sahel Matériaux SARL",
      email: "contact@sahelmateriaux.tg", phone: "+228 22 22 33 44",
      isActive: true,
    }).returning();
    supplierId = created.id;
  }

  // Produits
  const productsData = [
    { sku: "CIM-50", name: "Ciment CPA 42.5 — sac 50 kg", category: "Matériaux BTP", unit: "sac", purchase: 4500, sell: 5500, minStock: 50, tax: 18 },
    { sku: "FER-12", name: "Fer à béton Ø 12 mm — barre 12 m", category: "Matériaux BTP", unit: "barre", purchase: 6800, sell: 8200, minStock: 30, tax: 18 },
    { sku: "FER-10", name: "Fer à béton Ø 10 mm — barre 12 m", category: "Matériaux BTP", unit: "barre", purchase: 5200, sell: 6300, minStock: 30, tax: 18 },
    { sku: "CABLE-25", name: "Câble électrique 2.5 mm² — rouleau 100 m", category: "Électricité", unit: "rouleau", purchase: 28000, sell: 35000, minStock: 5, tax: 18 },
    { sku: "DISJ-16A", name: "Disjoncteur bipolaire 16 A", category: "Électricité", unit: "pcs", purchase: 4500, sell: 6500, minStock: 20, tax: 18 },
    { sku: "TUBE-PVC-110", name: "Tube PVC évacuation Ø 110 mm — 3 m", category: "Plomberie", unit: "barre", purchase: 3800, sell: 4900, minStock: 25, tax: 18 },
    { sku: "ROB-LAV", name: "Robinet mitigeur lavabo chromé", category: "Plomberie", unit: "pcs", purchase: 12000, sell: 17500, minStock: 10, tax: 18 },
    { sku: "VIS-6x80", name: "Vis à bois 6 × 80 mm — boîte 100", category: "Quincaillerie", unit: "boîte", purchase: 2200, sell: 3000, minStock: 15, tax: 18 },
  ];

  const productsInserted = await db.insert(productsTable).values(
    productsData.map((p) => ({
      organizationId: orgId,
      sku: p.sku,
      name: p.name,
      categoryId: catBy(p.category),
      unit: p.unit,
      purchasePriceFcfa: String(p.purchase),
      sellingPriceFcfa: String(p.sell),
      taxRatePct: String(p.tax),
      minStock: String(p.minStock),
      primarySupplierId: supplierId,
      isActive: true,
    })),
  ).returning();
  const prodBy = (sku: string) => productsInserted.find((p) => p.sku === sku)!;

  // Stock initial (mouvements d'entrée "initial")
  const initialStock: Record<string, number> = {
    "CIM-50": 120, "FER-12": 80, "FER-10": 90,
    "CABLE-25": 12, "DISJ-16A": 45,
    "TUBE-PVC-110": 60, "ROB-LAV": 22, "VIS-6x80": 40,
  };
  await db.insert(stockMovementsTable).values(
    productsInserted.map((p) => ({
      organizationId: orgId,
      productId: p.id,
      kind: "in",
      quantity: String(initialStock[p.sku] ?? 0),
      unitCostFcfa: p.purchasePriceFcfa,
      referenceType: "initial",
      referenceLabel: "Stock initial",
      reason: "Inventaire d'ouverture",
    })),
  );

  // PO 1 — réceptionné
  const [po1] = await db.insert(purchaseOrdersTable).values({
    organizationId: orgId,
    reference: "PO-2026-0001",
    supplierId,
    status: "received",
    orderDate: new Date(Date.now() - 20 * 86400 * 1000),
    expectedDate: new Date(Date.now() - 14 * 86400 * 1000),
    receivedDate: new Date(Date.now() - 12 * 86400 * 1000),
    totalFcfa: "450000",
    notes: "Commande de réapprovisionnement mensuel.",
  }).returning();
  const po1Lines = [
    { productId: prodBy("CIM-50").id, qty: 50, unit: 4500 },
    { productId: prodBy("FER-12").id, qty: 20, unit: 6800 },
    { productId: prodBy("CABLE-25").id, qty: 3, unit: 28000 },
  ];
  await db.insert(purchaseOrderLinesTable).values(po1Lines.map((l) => ({
    organizationId: orgId, purchaseOrderId: po1.id, productId: l.productId,
    quantity: String(l.qty), unitPriceFcfa: String(l.unit),
    quantityReceived: String(l.qty), totalFcfa: String(l.qty * l.unit),
  })));
  await db.insert(stockMovementsTable).values(po1Lines.map((l) => ({
    organizationId: orgId, productId: l.productId, kind: "in",
    quantity: String(l.qty), unitCostFcfa: String(l.unit),
    referenceType: "purchase", referenceId: po1.id, referenceLabel: po1.reference,
    reason: `Réception ${po1.reference}`,
    occurredAt: new Date(Date.now() - 12 * 86400 * 1000),
  })));

  // PO 2 — en attente (envoyé, pas réceptionné)
  const [po2] = await db.insert(purchaseOrdersTable).values({
    organizationId: orgId,
    reference: "PO-2026-0002",
    supplierId,
    status: "sent",
    orderDate: new Date(Date.now() - 3 * 86400 * 1000),
    expectedDate: new Date(Date.now() + 4 * 86400 * 1000),
    totalFcfa: "186000",
    notes: "Commande urgente — chantier Lomé 2.",
  }).returning();
  await db.insert(purchaseOrderLinesTable).values([
    { organizationId: orgId, purchaseOrderId: po2.id, productId: prodBy("ROB-LAV").id, quantity: "10", unitPriceFcfa: "12000", quantityReceived: "0", totalFcfa: "120000" },
    { organizationId: orgId, purchaseOrderId: po2.id, productId: prodBy("VIS-6x80").id, quantity: "30", unitPriceFcfa: "2200", quantityReceived: "0", totalFcfa: "66000" },
  ]);

  // Quelques sorties (ventes simulées)
  const salesMovements = [
    { sku: "CIM-50", qty: -25, daysAgo: 7 },
    { sku: "CIM-50", qty: -15, daysAgo: 3 },
    { sku: "FER-12", qty: -10, daysAgo: 5 },
    { sku: "DISJ-16A", qty: -8, daysAgo: 2 },
    { sku: "TUBE-PVC-110", qty: -12, daysAgo: 9 },
    { sku: "ROB-LAV", qty: -5, daysAgo: 6 },
    { sku: "VIS-6x80", qty: -4, daysAgo: 1 },
  ];
  await db.insert(stockMovementsTable).values(salesMovements.map((s) => {
    const p = prodBy(s.sku);
    return {
      organizationId: orgId, productId: p.id, kind: "out",
      quantity: String(s.qty), unitCostFcfa: p.purchasePriceFcfa,
      referenceType: "sale", referenceLabel: `Vente démo`,
      reason: `Sortie chantier`,
      occurredAt: new Date(Date.now() - s.daysAgo * 86400 * 1000),
    };
  }));
}
