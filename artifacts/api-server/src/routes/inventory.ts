/**
 * Inventory / Stock module — endpoints :
 *
 *  Référentiel
 *  -----------
 *  GET    /api/inventory/products
 *  POST   /api/inventory/products
 *  GET    /api/inventory/products/:id
 *  PATCH  /api/inventory/products/:id
 *  DELETE /api/inventory/products/:id              (soft)
 *  GET    /api/inventory/categories
 *  POST   /api/inventory/categories
 *
 *  Achats / Approvisionnements
 *  ---------------------------
 *  GET    /api/inventory/purchase-orders
 *  POST   /api/inventory/purchase-orders           (avec lignes)
 *  GET    /api/inventory/purchase-orders/:id       (avec lignes)
 *  PATCH  /api/inventory/purchase-orders/:id       (statut, notes…)
 *  POST   /api/inventory/purchase-orders/:id/receive  (réception partielle/totale → stock_movements)
 *  DELETE /api/inventory/purchase-orders/:id       (soft, draft only)
 *
 *  Stock
 *  -----
 *  GET    /api/inventory/stock/levels              (on-hand par produit + valorisation)
 *  GET    /api/inventory/stock/alerts              (low stock)
 *  GET    /api/inventory/movements
 *  POST   /api/inventory/movements/adjust          (ajustement manuel)
 *
 *  Ventes (lignes article)
 *  -----------------------
 *  GET    /api/inventory/sales-lines?parentType=&parentId=
 *  POST   /api/inventory/sales-lines
 *  PATCH  /api/inventory/sales-lines/:id
 *  DELETE /api/inventory/sales-lines/:id
 *  POST   /api/inventory/commit-sale               (décrémente le stock — idempotent par parentType+parentId)
 *
 *  Reporting
 *  ---------
 *  GET    /api/inventory/overview                  (KPI dashboard)
 *  GET    /api/inventory/reports/valuation
 *  GET    /api/inventory/reports/top-sellers
 *  GET    /api/inventory/reports/purchases-vs-sales
 *
 *  Toutes les routes : isolation tenant via organizationId.
 *  Permissions : inventory.read / inventory.manage / inventory.receive / inventory.adjust.
 */
import { Router, type IRouter } from "express";
import {
  db,
  productsTable,
  productCategoriesTable,
  purchaseOrdersTable,
  purchaseOrderLinesTable,
  stockMovementsTable,
  salesLinesTable,
  suppliersTable,
  insertProductSchema,
  insertProductCategorySchema,
  warehousesTable,
  internalRequestsTable,
  internalRequestLinesTable,
} from "@workspace/db";
import { and, asc, desc, eq, isNull, sql, gte, lte, ilike, or, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { requirePermission } from "../middlewares/permissions";
import { getCurrentOrganizationId as getOrgIdForUser } from "../lib/tenant";

const router: IRouter = Router();

async function getCurrentOrganizationId(req: any): Promise<string> {
  const userId = req.authUser?.id;
  if (!userId) throw new Error("Authentification requise");
  const orgId = await getOrgIdForUser(userId);
  if (!orgId) throw new Error("Organisation introuvable");
  return orgId;
}

// ─── Helpers ───────────────────────────────────────────────────────
async function nextPoReference(orgId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PO-${year}-`;
  const rows = await db
    .select({ ref: purchaseOrdersTable.reference })
    .from(purchaseOrdersTable)
    .where(and(eq(purchaseOrdersTable.organizationId, orgId), ilike(purchaseOrdersTable.reference, `${prefix}%`)));
  let max = 0;
  for (const { ref } of rows) {
    const n = parseInt(ref.slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

function num(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === "") return fallback;
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ─── Référentiel : catégories ──────────────────────────────────────
router.get("/inventory/categories", requirePermission("inventory.read"), async (req, res, next) => {
  const orgId = await getCurrentOrganizationId(req);
  const rows = await db.select().from(productCategoriesTable)
    .where(eq(productCategoriesTable.organizationId, orgId))
    .orderBy(productCategoriesTable.name);
  res.json(rows);
});

router.post("/inventory/categories", requirePermission("inventory.manage"), async (req, res, next) => {
  const orgId = await getCurrentOrganizationId(req);
  const parsed = insertProductCategorySchema.parse({ ...req.body, organizationId: orgId });
  const [row] = await db.insert(productCategoriesTable).values(parsed).returning();
  res.status(201).json(row);
});

// ─── Référentiel : produits ────────────────────────────────────────
const productFilterSchema = z.object({
  q: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  lowStock: z.enum(["1", "true"]).optional(),
  activeOnly: z.enum(["1", "true", "0", "false"]).optional().default("1"),
});

router.get("/inventory/products", requirePermission("inventory.read"), async (req, res, next) => {
  const orgId = await getCurrentOrganizationId(req);
  const f = productFilterSchema.parse(req.query);
  const conditions = [eq(productsTable.organizationId, orgId), isNull(productsTable.deletedAt)];
  if (f.q) conditions.push(or(ilike(productsTable.sku, `%${f.q}%`), ilike(productsTable.name, `%${f.q}%`))!);
  if (f.categoryId) conditions.push(eq(productsTable.categoryId, f.categoryId));
  if (f.activeOnly === "1" || f.activeOnly === "true") conditions.push(eq(productsTable.isActive, true));

  const products = await db.select().from(productsTable).where(and(...conditions)).orderBy(productsTable.name);

  // Stock on-hand par produit (une seule requête agrégée)
  const stockRows = products.length === 0 ? [] : await db
    .select({
      productId: stockMovementsTable.productId,
      onHand: sql<string>`COALESCE(SUM(${stockMovementsTable.quantity}), 0)`,
    })
    .from(stockMovementsTable)
    .where(and(
      eq(stockMovementsTable.organizationId, orgId),
      inArray(stockMovementsTable.productId, products.map((p) => p.id)),
    ))
    .groupBy(stockMovementsTable.productId);
  const stockMap = new Map(stockRows.map((r) => [r.productId, num(r.onHand)]));

  const enriched = products.map((p) => {
    const onHand = stockMap.get(p.id) ?? 0;
    const minStock = num(p.minStock);
    return {
      ...p,
      stockOnHand: onHand,
      isLowStock: minStock > 0 && onHand <= minStock,
      stockValueFcfa: Math.round(onHand * num(p.purchasePriceFcfa)),
    };
  });

  const filtered = (f.lowStock === "1" || f.lowStock === "true")
    ? enriched.filter((p) => p.isLowStock)
    : enriched;

  res.json(filtered);
});

router.post("/inventory/products", requirePermission("inventory.manage"), async (req, res, next) => {
  const orgId = await getCurrentOrganizationId(req);
  const parsed = insertProductSchema.parse({ ...req.body, organizationId: orgId });
  try {
    const [row] = await db.insert(productsTable).values(parsed).returning();
    res.status(201).json(row);
  } catch (e: any) {
    if (e?.code === "23505") return res.status(409).json({ error: "SKU déjà utilisé dans votre espace" });
    throw e;
  }
});

router.get("/inventory/products/:id", requirePermission("inventory.read"), async (req, res, next) => {
  const orgId = await getCurrentOrganizationId(req);
  const [product] = await db.select().from(productsTable)
    .where(and(eq(productsTable.id, (req.params.id as string)), eq(productsTable.organizationId, orgId), isNull(productsTable.deletedAt)))
    .limit(1);
  if (!product) return res.status(404).json({ error: "Produit introuvable" });

  const [stockRow] = await db
    .select({ onHand: sql<string>`COALESCE(SUM(${stockMovementsTable.quantity}), 0)` })
    .from(stockMovementsTable)
    .where(and(eq(stockMovementsTable.productId, product.id), eq(stockMovementsTable.organizationId, orgId)));

  const movements = await db.select().from(stockMovementsTable)
    .where(and(eq(stockMovementsTable.productId, product.id), eq(stockMovementsTable.organizationId, orgId)))
    .orderBy(desc(stockMovementsTable.occurredAt))
    .limit(50);

  const onHand = num(stockRow?.onHand);
  res.json({
    ...product,
    stockOnHand: onHand,
    stockValueFcfa: Math.round(onHand * num(product.purchasePriceFcfa)),
    isLowStock: num(product.minStock) > 0 && onHand <= num(product.minStock),
    recentMovements: movements,
  });
});

router.patch("/inventory/products/:id", requirePermission("inventory.manage"), async (req, res, next) => {
  const orgId = await getCurrentOrganizationId(req);
  const parsed = insertProductSchema.partial().parse(req.body);
  const { organizationId: _orgId, id: _id, createdAt: _ca, deletedAt: _da, ...patch } = parsed as any;
  const [row] = await db.update(productsTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(productsTable.id, (req.params.id as string)), eq(productsTable.organizationId, orgId)))
    .returning();
  if (!row) return res.status(404).json({ error: "Produit introuvable" });
  res.json(row);
});

router.delete("/inventory/products/:id", requirePermission("inventory.manage"), async (req, res, next) => {
  const orgId = await getCurrentOrganizationId(req);
  const [row] = await db.update(productsTable)
    .set({ deletedAt: new Date(), isActive: false })
    .where(and(eq(productsTable.id, (req.params.id as string)), eq(productsTable.organizationId, orgId)))
    .returning();
  if (!row) return res.status(404).json({ error: "Produit introuvable" });
  res.json({ ok: true });
});

// ─── Bons de commande fournisseurs ─────────────────────────────────
const poLineInputSchema = z.object({
  productId: z.string().uuid(),
  description: z.string().optional(),
  quantity: z.number().positive(),
  unitPriceFcfa: z.number().nonnegative(),
});
const createPoSchema = z.object({
  supplierId: z.string().uuid(),
  expectedDate: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(poLineInputSchema).min(1),
});

router.get("/inventory/purchase-orders", requirePermission("inventory.read"), async (req, res, next) => {
  const orgId = await getCurrentOrganizationId(req);
  const status = typeof (req.query.status as string) === "string" ? (req.query.status as string) : undefined;
  const conditions = [eq(purchaseOrdersTable.organizationId, orgId), isNull(purchaseOrdersTable.deletedAt)];
  if (status) conditions.push(eq(purchaseOrdersTable.status, status));
  const rows = await db.select({
    po: purchaseOrdersTable,
    supplierName: suppliersTable.name,
  }).from(purchaseOrdersTable)
    .leftJoin(suppliersTable, eq(suppliersTable.id, purchaseOrdersTable.supplierId))
    .where(and(...conditions))
    .orderBy(desc(purchaseOrdersTable.orderDate));
  res.json(rows.map((r) => ({ ...r.po, supplierName: r.supplierName })));
});

router.post("/inventory/purchase-orders", requirePermission("inventory.manage"), async (req, res, next) => {
  const orgId = await getCurrentOrganizationId(req);
  const userId = (req as any).authUser?.id ?? null;
  const data = createPoSchema.parse(req.body);

  // Vérifie supplier tenant
  const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, data.supplierId)).limit(1);
  if (!supplier) return res.status(400).json({ error: "Fournisseur introuvable" });

  // Vérifie produits tenant
  const productIds = data.lines.map((l) => l.productId);
  const products = await db.select({ id: productsTable.id }).from(productsTable)
    .where(and(eq(productsTable.organizationId, orgId), inArray(productsTable.id, productIds), isNull(productsTable.deletedAt)));
  if (products.length !== new Set(productIds).size) {
    return res.status(400).json({ error: "Un ou plusieurs produits sont invalides" });
  }

  const total = data.lines.reduce((s, l) => s + l.quantity * l.unitPriceFcfa, 0);
  const reference = await nextPoReference(orgId);

  const [po] = await db.insert(purchaseOrdersTable).values({
    organizationId: orgId,
    reference,
    supplierId: data.supplierId,
    status: "draft",
    expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
    notes: data.notes,
    totalFcfa: String(total),
    createdById: userId,
  }).returning();

  await db.insert(purchaseOrderLinesTable).values(data.lines.map((l) => ({
    organizationId: orgId,
    purchaseOrderId: po.id,
    productId: l.productId,
    description: l.description,
    quantity: String(l.quantity),
    unitPriceFcfa: String(l.unitPriceFcfa),
    totalFcfa: String(l.quantity * l.unitPriceFcfa),
  })));

  res.status(201).json(po);
});

router.get("/inventory/purchase-orders/:id", requirePermission("inventory.read"), async (req, res, next) => {
  const orgId = await getCurrentOrganizationId(req);
  const [po] = await db.select().from(purchaseOrdersTable)
    .where(and(eq(purchaseOrdersTable.id, (req.params.id as string)), eq(purchaseOrdersTable.organizationId, orgId)))
    .limit(1);
  if (!po) return res.status(404).json({ error: "Bon de commande introuvable" });
  const lines = await db.select({
    line: purchaseOrderLinesTable,
    productName: productsTable.name,
    productSku: productsTable.sku,
    productUnit: productsTable.unit,
  }).from(purchaseOrderLinesTable)
    .leftJoin(productsTable, eq(productsTable.id, purchaseOrderLinesTable.productId))
    .where(eq(purchaseOrderLinesTable.purchaseOrderId, po.id));
  const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, po.supplierId)).limit(1);
  res.json({ ...po, supplier, lines: lines.map((r) => ({ ...r.line, productName: r.productName, productSku: r.productSku, productUnit: r.productUnit })) });
});

router.patch("/inventory/purchase-orders/:id", requirePermission("inventory.manage"), async (req, res, next) => {
  const orgId = await getCurrentOrganizationId(req);
  const allowed = z.object({
    status: z.enum(["draft", "sent", "partial", "received", "cancelled"]).optional(),
    notes: z.string().optional(),
    expectedDate: z.string().nullable().optional(),
  }).parse(req.body);
  const patch: any = { ...allowed };
  if (allowed.expectedDate !== undefined) patch.expectedDate = allowed.expectedDate ? new Date(allowed.expectedDate) : null;
  const [row] = await db.update(purchaseOrdersTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(purchaseOrdersTable.id, (req.params.id as string)), eq(purchaseOrdersTable.organizationId, orgId)))
    .returning();
  if (!row) return res.status(404).json({ error: "Bon de commande introuvable" });
  res.json(row);
});

router.delete("/inventory/purchase-orders/:id", requirePermission("inventory.manage"), async (req, res, next) => {
  const orgId = await getCurrentOrganizationId(req);
  const [po] = await db.select().from(purchaseOrdersTable)
    .where(and(eq(purchaseOrdersTable.id, (req.params.id as string)), eq(purchaseOrdersTable.organizationId, orgId))).limit(1);
  if (!po) return res.status(404).json({ error: "Bon de commande introuvable" });
  if (po.status !== "draft") return res.status(409).json({ error: "Seuls les brouillons peuvent être supprimés" });
  await db.update(purchaseOrdersTable).set({ deletedAt: new Date() })
    .where(eq(purchaseOrdersTable.id, po.id));
  res.json({ ok: true });
});

// ─── Réception ─────────────────────────────────────────────────────
const receiveSchema = z.object({
  receipts: z.array(z.object({
    lineId: z.string().uuid(),
    quantity: z.number().positive(),
  })).min(1),
  notes: z.string().optional(),
});

router.post("/inventory/purchase-orders/:id/receive", requirePermission("inventory.receive"), async (req, res, next) => {
  const orgId = await getCurrentOrganizationId(req);
  const userId = (req as any).authUser?.id ?? null;
  const data = receiveSchema.parse(req.body);

  // Refuse les doublons de lineId dans la même réception (évite double comptage)
  const lineIds = data.receipts.map((r) => r.lineId);
  if (new Set(lineIds).size !== lineIds.length) {
    return res.status(400).json({ error: "Doublons de lignes détectés dans la même réception" });
  }

  const [po] = await db.select().from(purchaseOrdersTable)
    .where(and(eq(purchaseOrdersTable.id, (req.params.id as string)), eq(purchaseOrdersTable.organizationId, orgId), isNull(purchaseOrdersTable.deletedAt)))
    .limit(1);
  if (!po) return res.status(404).json({ error: "Bon de commande introuvable" });
  if (po.status === "cancelled" || po.status === "received") {
    return res.status(409).json({ error: `Bon de commande déjà ${po.status === "received" ? "réceptionné" : "annulé"}` });
  }

  const lines = await db.select().from(purchaseOrderLinesTable)
    .where(and(eq(purchaseOrderLinesTable.purchaseOrderId, po.id), eq(purchaseOrderLinesTable.organizationId, orgId)));
  const lineMap = new Map(lines.map((l) => [l.id, l]));

  // Valide les réceptions et insère les mouvements
  for (const r of data.receipts) {
    const line = lineMap.get(r.lineId);
    if (!line) return res.status(400).json({ error: `Ligne ${r.lineId} inexistante` });
    const remaining = num(line.quantity) - num(line.quantityReceived);
    if (r.quantity > remaining + 0.0001) {
      return res.status(400).json({ error: `Quantité reçue (${r.quantity}) supérieure au reste à recevoir (${remaining})` });
    }
  }

  for (const r of data.receipts) {
    const line = lineMap.get(r.lineId)!;
    await db.update(purchaseOrderLinesTable)
      .set({ quantityReceived: String(num(line.quantityReceived) + r.quantity) })
      .where(eq(purchaseOrderLinesTable.id, line.id));
    await db.insert(stockMovementsTable).values({
      organizationId: orgId,
      productId: line.productId,
      kind: "in",
      quantity: String(r.quantity),
      unitCostFcfa: line.unitPriceFcfa,
      referenceType: "purchase",
      referenceId: po.id,
      referenceLabel: po.reference,
      reason: data.notes ?? `Réception ${po.reference}`,
      userId,
    });
  }

  // Recalcule statut PO
  const refreshed = await db.select().from(purchaseOrderLinesTable)
    .where(eq(purchaseOrderLinesTable.purchaseOrderId, po.id));
  const totalQty = refreshed.reduce((s, l) => s + num(l.quantity), 0);
  const totalReceived = refreshed.reduce((s, l) => s + num(l.quantityReceived), 0);
  const newStatus = totalReceived >= totalQty - 0.0001
    ? "received"
    : totalReceived > 0 ? "partial" : po.status;

  await db.update(purchaseOrdersTable)
    .set({ status: newStatus, receivedDate: newStatus === "received" ? new Date() : po.receivedDate, updatedAt: new Date() })
    .where(eq(purchaseOrdersTable.id, po.id));

  res.json({ ok: true, status: newStatus });
});

// ─── Stock : levels & alerts ───────────────────────────────────────
router.get("/inventory/stock/levels", requirePermission("inventory.read"), async (req, res, next) => {
  const orgId = await getCurrentOrganizationId(req);
  const rows = await db
    .select({
      product: productsTable,
      categoryName: productCategoriesTable.name,
      onHand: sql<string>`COALESCE(SUM(${stockMovementsTable.quantity}), 0)`,
    })
    .from(productsTable)
    .leftJoin(productCategoriesTable, eq(productCategoriesTable.id, productsTable.categoryId))
    .leftJoin(stockMovementsTable, and(
      eq(stockMovementsTable.productId, productsTable.id),
      eq(stockMovementsTable.organizationId, orgId),
    ))
    .where(and(eq(productsTable.organizationId, orgId), isNull(productsTable.deletedAt)))
    .groupBy(productsTable.id, productCategoriesTable.name)
    .orderBy(productsTable.name);

  res.json(rows.map((r) => {
    const onHand = num(r.onHand);
    return {
      ...r.product,
      categoryName: r.categoryName,
      stockOnHand: onHand,
      stockValueFcfa: Math.round(onHand * num(r.product.purchasePriceFcfa)),
      isLowStock: num(r.product.minStock) > 0 && onHand <= num(r.product.minStock),
    };
  }));
});

router.get("/inventory/stock/alerts", requirePermission("inventory.read"), async (req, res, next) => {
  const orgId = await getCurrentOrganizationId(req);
  const rows = await db
    .select({
      product: productsTable,
      onHand: sql<string>`COALESCE(SUM(${stockMovementsTable.quantity}), 0)`,
    })
    .from(productsTable)
    .leftJoin(stockMovementsTable, and(
      eq(stockMovementsTable.productId, productsTable.id),
      eq(stockMovementsTable.organizationId, orgId),
    ))
    .where(and(
      eq(productsTable.organizationId, orgId),
      isNull(productsTable.deletedAt),
      eq(productsTable.isActive, true),
      sql`${productsTable.minStock} > 0`,
    ))
    .groupBy(productsTable.id);

  const alerts = rows
    .map((r) => ({ ...r.product, stockOnHand: num(r.onHand) }))
    .filter((p) => p.stockOnHand <= num(p.minStock))
    .sort((a, b) => (a.stockOnHand - num(a.minStock)) - (b.stockOnHand - num(b.minStock)));
  res.json(alerts);
});

// ─── Mouvements ────────────────────────────────────────────────────
router.get("/inventory/movements", requirePermission("inventory.read"), async (req, res, next) => {
  const orgId = await getCurrentOrganizationId(req);
  const productId = typeof (req.query.productId as string) === "string" ? (req.query.productId as string) : undefined;
  const kind = typeof (req.query.kind as string) === "string" ? (req.query.kind as string) : undefined;
  const limit = Math.min(parseInt(String((req.query.limit as string) ?? "200"), 10) || 200, 500);
  const conditions = [eq(stockMovementsTable.organizationId, orgId)];
  if (productId) conditions.push(eq(stockMovementsTable.productId, productId));
  if (kind) conditions.push(eq(stockMovementsTable.kind, kind));
  const rows = await db.select({
    mv: stockMovementsTable,
    productName: productsTable.name,
    productSku: productsTable.sku,
  }).from(stockMovementsTable)
    .leftJoin(productsTable, eq(productsTable.id, stockMovementsTable.productId))
    .where(and(...conditions))
    .orderBy(desc(stockMovementsTable.occurredAt))
    .limit(limit);
  res.json(rows.map((r) => ({ ...r.mv, productName: r.productName, productSku: r.productSku })));
});

const adjustSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().refine((n) => n !== 0, { message: "Quantité non nulle" }),
  unitCostFcfa: z.number().nonnegative().optional(),
  reason: z.string().min(1),
});
router.post("/inventory/movements/adjust", requirePermission("inventory.adjust"), async (req, res, next) => {
  const orgId = await getCurrentOrganizationId(req);
  const userId = (req as any).authUser?.id ?? null;
  const data = adjustSchema.parse(req.body);
  const [product] = await db.select().from(productsTable)
    .where(and(eq(productsTable.id, data.productId), eq(productsTable.organizationId, orgId), isNull(productsTable.deletedAt)))
    .limit(1);
  if (!product) return res.status(404).json({ error: "Produit introuvable" });
  const [row] = await db.insert(stockMovementsTable).values({
    organizationId: orgId,
    productId: product.id,
    kind: "adjust",
    quantity: String(data.quantity),
    unitCostFcfa: data.unitCostFcfa !== undefined ? String(data.unitCostFcfa) : product.purchasePriceFcfa,
    referenceType: "adjustment",
    referenceLabel: "Ajustement manuel",
    reason: data.reason,
    userId,
  }).returning();
  res.status(201).json(row);
});

// ─── Sales lines ───────────────────────────────────────────────────
const ALLOWED_PARENT = ["order", "proforma", "invoice"] as const;
const salesLineSchema = z.object({
  parentType: z.enum(ALLOWED_PARENT),
  parentId: z.string().uuid(),
  productId: z.string().uuid().optional().nullable(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPriceFcfa: z.number().nonnegative(),
  discountPct: z.number().min(0).max(100).optional(),
  taxRatePct: z.number().min(0).max(100).optional(),
  position: z.number().int().optional(),
});

router.get("/inventory/sales-lines", requirePermission("inventory.read"), async (req, res, next) => {
  const orgId = await getCurrentOrganizationId(req);
  const parentType = typeof (req.query.parentType as string) === "string" ? (req.query.parentType as string) : undefined;
  const parentId = typeof (req.query.parentId as string) === "string" ? (req.query.parentId as string) : undefined;
  if (!parentType || !parentId || !ALLOWED_PARENT.includes(parentType as any)) {
    return res.status(400).json({ error: "parentType (order|proforma|invoice) et parentId requis" });
  }
  const rows = await db.select({
    line: salesLinesTable,
    productName: productsTable.name,
    productSku: productsTable.sku,
    productUnit: productsTable.unit,
  }).from(salesLinesTable)
    .leftJoin(productsTable, eq(productsTable.id, salesLinesTable.productId))
    .where(and(
      eq(salesLinesTable.organizationId, orgId),
      eq(salesLinesTable.parentType, parentType),
      eq(salesLinesTable.parentId, parentId),
    ))
    .orderBy(salesLinesTable.position, salesLinesTable.createdAt);
  res.json(rows.map((r) => ({ ...r.line, productName: r.productName, productSku: r.productSku, productUnit: r.productUnit })));
});

router.post("/inventory/sales-lines", requirePermission("inventory.manage"), async (req, res, next) => {
  const orgId = await getCurrentOrganizationId(req);
  const data = salesLineSchema.parse(req.body);
  if (data.productId) {
    const [p] = await db.select({ id: productsTable.id }).from(productsTable)
      .where(and(eq(productsTable.id, data.productId), eq(productsTable.organizationId, orgId), isNull(productsTable.deletedAt)))
      .limit(1);
    if (!p) return res.status(400).json({ error: "Produit invalide pour cette organisation" });
  }
  const discount = data.discountPct ?? 0;
  const tax = data.taxRatePct ?? 0;
  const subtotal = data.quantity * data.unitPriceFcfa * (1 - discount / 100);
  const total = Math.round(subtotal * (1 + tax / 100));
  const [row] = await db.insert(salesLinesTable).values({
    organizationId: orgId,
    parentType: data.parentType,
    parentId: data.parentId,
    productId: data.productId ?? null,
    description: data.description,
    quantity: String(data.quantity),
    unitPriceFcfa: String(data.unitPriceFcfa),
    discountPct: String(discount),
    taxRatePct: String(tax),
    totalFcfa: String(total),
    position: data.position ?? 0,
  }).returning();
  res.status(201).json(row);
});

router.delete("/inventory/sales-lines/:id", requirePermission("inventory.manage"), async (req, res, next) => {
  const orgId = await getCurrentOrganizationId(req);
  const result = await db.delete(salesLinesTable)
    .where(and(eq(salesLinesTable.id, (req.params.id as string)), eq(salesLinesTable.organizationId, orgId)))
    .returning();
  if (result.length === 0) return res.status(404).json({ error: "Ligne introuvable" });
  res.json({ ok: true });
});

const commitSaleSchema = z.object({
  parentType: z.enum(ALLOWED_PARENT),
  parentId: z.string().uuid(),
  referenceLabel: z.string().optional(),
});
router.post("/inventory/commit-sale", requirePermission("inventory.manage"), async (req, res, next) => {
  const orgId = await getCurrentOrganizationId(req);
  const userId = (req as any).authUser?.id ?? null;
  const data = commitSaleSchema.parse(req.body);

  // Idempotence : référence composite parentType+parentId
  const refKey = `${data.parentType}:${data.parentId}`;
  const existing = await db.select({ id: stockMovementsTable.id }).from(stockMovementsTable)
    .where(and(
      eq(stockMovementsTable.organizationId, orgId),
      eq(stockMovementsTable.referenceType, "sale"),
      eq(stockMovementsTable.referenceId, refKey),
    ))
    .limit(1);
  if (existing.length > 0) {
    return res.status(409).json({ error: "Stock déjà décrémenté pour cette vente", idempotent: true });
  }

  const lines = await db.select().from(salesLinesTable)
    .where(and(
      eq(salesLinesTable.organizationId, orgId),
      eq(salesLinesTable.parentType, data.parentType),
      eq(salesLinesTable.parentId, data.parentId),
    ));

  const stockable = lines.filter((l) => l.productId);
  if (stockable.length === 0) {
    return res.json({ ok: true, movements: 0, note: "Aucune ligne liée à un produit stockable" });
  }

  // Vérifie que tous les produits référencés appartiennent bien à l'organisation
  const productIds = [...new Set(stockable.map((l) => l.productId!))];
  const ownedProducts = await db.select({ id: productsTable.id }).from(productsTable)
    .where(and(eq(productsTable.organizationId, orgId), inArray(productsTable.id, productIds)));
  if (ownedProducts.length !== productIds.length) {
    return res.status(400).json({ error: "Une ou plusieurs lignes référencent des produits hors organisation" });
  }

  const inserted = [];
  for (const line of stockable) {
    const [row] = await db.insert(stockMovementsTable).values({
      organizationId: orgId,
      productId: line.productId!,
      kind: "out",
      quantity: String(-Math.abs(num(line.quantity))),
      unitCostFcfa: line.unitPriceFcfa,
      referenceType: "sale",
      referenceId: refKey,
      referenceLabel: data.referenceLabel ?? `Vente ${data.parentType}`,
      reason: `Sortie sur ${data.parentType}`,
      userId,
    }).returning();
    inserted.push(row);
  }
  res.status(201).json({ ok: true, movements: inserted.length });
});

// ─── Overview / Reporting ──────────────────────────────────────────
router.get("/inventory/overview", requirePermission("inventory.read"), async (req, res, next) => {
  const orgId = await getCurrentOrganizationId(req);
  const [{ totalProducts }] = await db
    .select({ totalProducts: sql<number>`COUNT(*)::int` })
    .from(productsTable)
    .where(and(eq(productsTable.organizationId, orgId), isNull(productsTable.deletedAt)));

  const stockByProd = await db
    .select({
      productId: productsTable.id,
      purchasePrice: productsTable.purchasePriceFcfa,
      minStock: productsTable.minStock,
      onHand: sql<string>`COALESCE(SUM(${stockMovementsTable.quantity}), 0)`,
    })
    .from(productsTable)
    .leftJoin(stockMovementsTable, and(
      eq(stockMovementsTable.productId, productsTable.id),
      eq(stockMovementsTable.organizationId, orgId),
    ))
    .where(and(eq(productsTable.organizationId, orgId), isNull(productsTable.deletedAt)))
    .groupBy(productsTable.id);

  let valuation = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  for (const s of stockByProd) {
    const onHand = num(s.onHand);
    valuation += onHand * num(s.purchasePrice);
    if (onHand <= 0) outOfStockCount++;
    else if (num(s.minStock) > 0 && onHand <= num(s.minStock)) lowStockCount++;
  }

  const [{ openPos }] = await db
    .select({ openPos: sql<number>`COUNT(*)::int` })
    .from(purchaseOrdersTable)
    .where(and(
      eq(purchaseOrdersTable.organizationId, orgId),
      isNull(purchaseOrdersTable.deletedAt),
      inArray(purchaseOrdersTable.status, ["draft", "sent", "partial"]),
    ));

  // 30 derniers jours
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const recentMovements = await db
    .select({
      kind: stockMovementsTable.kind,
      total: sql<string>`COALESCE(SUM(ABS(${stockMovementsTable.quantity}) * COALESCE(${stockMovementsTable.unitCostFcfa}, 0)), 0)`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(stockMovementsTable)
    .where(and(
      eq(stockMovementsTable.organizationId, orgId),
      gte(stockMovementsTable.occurredAt, since),
    ))
    .groupBy(stockMovementsTable.kind);

  const purchases30d = num(recentMovements.find((r) => r.kind === "in")?.total);
  const sales30d = num(recentMovements.find((r) => r.kind === "out")?.total);

  res.json({
    totalProducts,
    stockValuationFcfa: Math.round(valuation),
    lowStockCount,
    outOfStockCount,
    openPurchaseOrders: openPos,
    purchases30dFcfa: Math.round(purchases30d),
    sales30dFcfa: Math.round(sales30d),
  });
});

router.get("/inventory/reports/valuation", requirePermission("inventory.read"), async (req, res, next) => {
  const orgId = await getCurrentOrganizationId(req);
  const rows = await db
    .select({
      categoryName: sql<string>`COALESCE(${productCategoriesTable.name}, 'Sans catégorie')`,
      products: sql<number>`COUNT(DISTINCT ${productsTable.id})::int`,
      totalQty: sql<string>`COALESCE(SUM(${stockMovementsTable.quantity}), 0)`,
      valueFcfa: sql<string>`COALESCE(SUM(${stockMovementsTable.quantity} * ${productsTable.purchasePriceFcfa}), 0)`,
    })
    .from(productsTable)
    .leftJoin(productCategoriesTable, eq(productCategoriesTable.id, productsTable.categoryId))
    .leftJoin(stockMovementsTable, and(
      eq(stockMovementsTable.productId, productsTable.id),
      eq(stockMovementsTable.organizationId, orgId),
    ))
    .where(and(eq(productsTable.organizationId, orgId), isNull(productsTable.deletedAt)))
    .groupBy(productCategoriesTable.name);
  res.json(rows.map((r) => ({
    categoryName: r.categoryName,
    productCount: r.products,
    totalQty: num(r.totalQty),
    valueFcfa: Math.round(num(r.valueFcfa)),
  })));
});

router.get("/inventory/reports/top-sellers", requirePermission("inventory.read"), async (req, res, next) => {
  const orgId = await getCurrentOrganizationId(req);
  const days = Math.min(parseInt(String((req.query.days as string) ?? "90"), 10) || 90, 365);
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const rows = await db
    .select({
      productId: stockMovementsTable.productId,
      productName: productsTable.name,
      productSku: productsTable.sku,
      qtySold: sql<string>`COALESCE(SUM(ABS(${stockMovementsTable.quantity})), 0)`,
      revenue: sql<string>`COALESCE(SUM(ABS(${stockMovementsTable.quantity}) * COALESCE(${stockMovementsTable.unitCostFcfa}, 0)), 0)`,
    })
    .from(stockMovementsTable)
    .innerJoin(productsTable, eq(productsTable.id, stockMovementsTable.productId))
    .where(and(
      eq(stockMovementsTable.organizationId, orgId),
      eq(stockMovementsTable.kind, "out"),
      gte(stockMovementsTable.occurredAt, since),
    ))
    .groupBy(stockMovementsTable.productId, productsTable.name, productsTable.sku)
    .orderBy(sql`SUM(ABS(${stockMovementsTable.quantity})) DESC`)
    .limit(20);
  res.json(rows.map((r) => ({
    productId: r.productId,
    productName: r.productName,
    productSku: r.productSku,
    quantitySold: num(r.qtySold),
    revenueFcfa: Math.round(num(r.revenue)),
  })));
});

router.get("/inventory/reports/purchases-vs-sales", requirePermission("inventory.read"), async (req, res, next) => {
  const orgId = await getCurrentOrganizationId(req);
  const months = Math.min(parseInt(String((req.query.months as string) ?? "6"), 10) || 6, 24);
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  since.setDate(1); since.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      month: sql<string>`TO_CHAR(${stockMovementsTable.occurredAt}, 'YYYY-MM')`,
      kind: stockMovementsTable.kind,
      total: sql<string>`COALESCE(SUM(ABS(${stockMovementsTable.quantity}) * COALESCE(${stockMovementsTable.unitCostFcfa}, 0)), 0)`,
    })
    .from(stockMovementsTable)
    .where(and(
      eq(stockMovementsTable.organizationId, orgId),
      gte(stockMovementsTable.occurredAt, since),
      inArray(stockMovementsTable.kind, ["in", "out"]),
    ))
    .groupBy(sql`TO_CHAR(${stockMovementsTable.occurredAt}, 'YYYY-MM')`, stockMovementsTable.kind)
    .orderBy(sql`TO_CHAR(${stockMovementsTable.occurredAt}, 'YYYY-MM')`);

  const byMonth = new Map<string, { month: string; purchasesFcfa: number; salesFcfa: number }>();
  for (const r of rows) {
    const m = byMonth.get(r.month) ?? { month: r.month, purchasesFcfa: 0, salesFcfa: 0 };
    if (r.kind === "in") m.purchasesFcfa = Math.round(num(r.total));
    else if (r.kind === "out") m.salesFcfa = Math.round(num(r.total));
    byMonth.set(r.month, m);
  }
  res.json(Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month)));
});

// ════════════════════════════════════════════════════════════════
// MAGASINS / DÉPÔTS
// ════════════════════════════════════════════════════════════════
router.get("/inventory/warehouses", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const rows = await db.select().from(warehousesTable)
      .where(eq(warehousesTable.organizationId, orgId))
      .orderBy(asc(warehousesTable.code));
    res.json(rows);
  } catch (e) { next(e); }
});

router.post("/inventory/warehouses", requirePermission("inventory.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { code, name, location, address, type, notes } = req.body as {
      code: string; name: string; location?: string; address?: string; type?: string; notes?: string;
    };
    if (!code || !name) { res.status(400).json({ error: "code et name sont requis" }); return; }
    const [row] = await db.insert(warehousesTable).values({
      organizationId: orgId, code, name, location, address, type, notes,
    }).returning();
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.get("/inventory/warehouses/:id", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [row] = await db.select().from(warehousesTable)
      .where(and(eq(warehousesTable.organizationId, orgId), eq(warehousesTable.id, (req.params.id as string))))
      .limit(1);
    if (!row) { res.status(404).json({ error: "Magasin introuvable" }); return; }

    // Stock dans ce magasin (via mouvements)
    const stock = await db
      .select({
        productId: stockMovementsTable.productId,
        productName: productsTable.name,
        productCode: productsTable.sku,
        unit: productsTable.unit,
        qty: sql<number>`SUM(CASE WHEN ${stockMovementsTable.kind} IN ('in','initial') THEN ${stockMovementsTable.quantity} ELSE -${stockMovementsTable.quantity} END)`,
      })
      .from(stockMovementsTable)
      .leftJoin(productsTable, eq(stockMovementsTable.productId, productsTable.id))
      // Les mouvements de stock ne sont pas rattachés à un magasin : stock calculé au niveau organisation
      .where(eq(stockMovementsTable.organizationId, orgId))
      .groupBy(stockMovementsTable.productId, productsTable.name, productsTable.sku, productsTable.unit);

    res.json({ ...row, stock });
  } catch (e) { next(e); }
});

router.patch("/inventory/warehouses/:id", requirePermission("inventory.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [row] = await db.select().from(warehousesTable)
      .where(and(eq(warehousesTable.organizationId, orgId), eq(warehousesTable.id, (req.params.id as string))))
      .limit(1);
    if (!row) { res.status(404).json({ error: "Magasin introuvable" }); return; }
    const upd = req.body as Record<string, unknown>;
    const [updated] = await db.update(warehousesTable).set({
      ...(upd.name != null && { name: String(upd.name) }),
      ...(upd.location != null && { location: String(upd.location) }),
      ...(upd.address != null && { address: String(upd.address) }),
      ...(upd.type != null && { type: String(upd.type) }),
      ...(upd.notes != null && { notes: String(upd.notes) }),
      ...(upd.isActive != null && { isActive: Boolean(upd.isActive) }),
    }).where(eq(warehousesTable.id, row.id)).returning();
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete("/inventory/warehouses/:id", requirePermission("inventory.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [row] = await db.select().from(warehousesTable)
      .where(and(eq(warehousesTable.organizationId, orgId), eq(warehousesTable.id, (req.params.id as string))))
      .limit(1);
    if (!row) { res.status(404).json({ error: "Magasin introuvable" }); return; }
    await db.delete(warehousesTable).where(eq(warehousesTable.id, row.id));
    res.status(204).send();
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════
// DEMANDES INTERNES (BESOINS)
// ════════════════════════════════════════════════════════════════
router.get("/inventory/requests", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { status } = req.query as { status?: string };
    const conditions = [eq(internalRequestsTable.organizationId, orgId)];
    if (status) conditions.push(eq(internalRequestsTable.status, status));
    const rows = await db.select({
      id: internalRequestsTable.id,
      reference: internalRequestsTable.reference,
      status: internalRequestsTable.status,
      priority: internalRequestsTable.priority,
      requesterDepartment: internalRequestsTable.requesterDepartment,
      neededDate: internalRequestsTable.neededDate,
      notes: internalRequestsTable.notes,
      createdAt: internalRequestsTable.createdAt,
      lineCount: sql<number>`(
        SELECT COUNT(*) FROM internal_request_lines WHERE internal_request_lines.request_id = ${internalRequestsTable.id}
      )`,
    }).from(internalRequestsTable)
      .where(and(...conditions))
      .orderBy(desc(internalRequestsTable.createdAt));
    res.json(rows);
  } catch (e) { next(e); }
});

router.post("/inventory/requests", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { reference, requesterDepartment, neededDate, priority, notes, lines } = req.body as {
      reference: string; requesterDepartment?: string; neededDate?: string; priority?: string; notes?: string;
      lines?: { productId?: string; description?: string; quantity: number; unit?: string }[];
    };
    if (!reference) { res.status(400).json({ error: "La référence est requise" }); return; }
    const [req_] = await db.insert(internalRequestsTable).values({
      organizationId: orgId, reference, requesterDepartment, neededDate, priority, notes,
      requestedById: req.authUser!.id,
    }).returning();
    if (lines?.length) {
      await db.insert(internalRequestLinesTable).values(
        lines.map((l) => ({
          organizationId: orgId,
          requestId: req_.id,
          productId: l.productId,
          description: l.description,
          quantity: String(l.quantity),
          unit: l.unit ?? "pcs",
        }))
      );
    }
    res.status(201).json(req_);
  } catch (e) { next(e); }
});

router.get("/inventory/requests/:id", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [ir] = await db.select().from(internalRequestsTable)
      .where(and(eq(internalRequestsTable.organizationId, orgId), eq(internalRequestsTable.id, (req.params.id as string))))
      .limit(1);
    if (!ir) { res.status(404).json({ error: "Demande introuvable" }); return; }
    const lines = await db.select({
      id: internalRequestLinesTable.id,
      productId: internalRequestLinesTable.productId,
      description: internalRequestLinesTable.description,
      quantity: internalRequestLinesTable.quantity,
      unit: internalRequestLinesTable.unit,
      servedQuantity: internalRequestLinesTable.servedQuantity,
      productName: productsTable.name,
      productCode: productsTable.sku,
    }).from(internalRequestLinesTable)
      .leftJoin(productsTable, eq(internalRequestLinesTable.productId, productsTable.id))
      .where(eq(internalRequestLinesTable.requestId, ir.id));
    res.json({ ...ir, lines });
  } catch (e) { next(e); }
});

router.patch("/inventory/requests/:id", requirePermission("inventory.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [ir] = await db.select().from(internalRequestsTable)
      .where(and(eq(internalRequestsTable.organizationId, orgId), eq(internalRequestsTable.id, (req.params.id as string))))
      .limit(1);
    if (!ir) { res.status(404).json({ error: "Demande introuvable" }); return; }
    const upd = req.body as Record<string, unknown>;
    const [updated] = await db.update(internalRequestsTable).set({
      ...(upd.status != null && { status: String(upd.status) }),
      ...(upd.priority != null && { priority: String(upd.priority) }),
      ...(upd.notes != null && { notes: String(upd.notes) }),
      ...(upd.neededDate != null && { neededDate: String(upd.neededDate) }),
      ...(upd.rejectionReason != null && { rejectionReason: String(upd.rejectionReason) }),
      ...(upd.status === "approved" && { approvedById: req.authUser!.id, approvedAt: new Date() }),
    }).where(eq(internalRequestsTable.id, ir.id)).returning();
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete("/inventory/requests/:id", requirePermission("inventory.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [ir] = await db.select().from(internalRequestsTable)
      .where(and(eq(internalRequestsTable.organizationId, orgId), eq(internalRequestsTable.id, (req.params.id as string))))
      .limit(1);
    if (!ir) { res.status(404).json({ error: "Demande introuvable" }); return; }
    await db.delete(internalRequestLinesTable).where(eq(internalRequestLinesTable.requestId, ir.id));
    await db.delete(internalRequestsTable).where(eq(internalRequestsTable.id, ir.id));
    res.status(204).send();
  } catch (e) { next(e); }
});

export default router;
