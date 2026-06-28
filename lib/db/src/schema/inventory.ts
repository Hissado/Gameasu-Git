/**
 * Inventory / Stock module — produits destinés à la revente (Class 3 SYSCOHADA).
 *
 * Concepts :
 *  - product_categories : taxonomie des articles
 *  - products           : référentiel SKU avec prix achat/vente, stock min, fournisseur principal
 *  - purchase_orders    : bons de commande fournisseurs (PO-YYYY-NNNN)
 *  - purchase_order_lines : lignes de PO avec quantités commandées / reçues
 *  - stock_movements    : journal de mouvements (in/out/adjust), source unique de vérité.
 *                         Le stock disponible = SUM(quantity) par produit. Quantity signé
 *                         (positif pour entrée, négatif pour sortie).
 *  - sales_lines        : lignes d'articles attachables à un order / proforma / invoice.
 *
 * Tous tenant-scoped via `organizationId NOT NULL`.
 */
import { pgTable, text, timestamp, uuid, numeric, integer, boolean, date, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./saas";
import { suppliersTable } from "./accounting";
import { usersTable } from "./users";

// ─────────────────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────────────────
export const productCategoriesTable = pgTable("product_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  parentId: uuid("parent_id"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index("product_categories_org_idx").on(t.organizationId),
  nameIdx: uniqueIndex("product_categories_org_name_uidx").on(t.organizationId, t.name),
}));

// ─────────────────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────────────────
export const productsTable = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  sku: text("sku").notNull(),                                       // code article unique par tenant
  name: text("name").notNull(),
  description: text("description"),
  categoryId: uuid("category_id").references(() => productCategoriesTable.id, { onDelete: "set null" }),
  unit: text("unit").notNull().default("pcs"),                      // pcs, kg, m, l, sac, …
  purchasePriceFcfa: numeric("purchase_price_fcfa", { precision: 18, scale: 2 }).notNull().default("0"),
  sellingPriceFcfa: numeric("selling_price_fcfa", { precision: 18, scale: 2 }).notNull().default("0"),
  taxRatePct: numeric("tax_rate_pct", { precision: 5, scale: 2 }).notNull().default("18"),
  minStock: numeric("min_stock", { precision: 18, scale: 3 }).notNull().default("0"),
  primarySupplierId: uuid("primary_supplier_id").references(() => suppliersTable.id, { onDelete: "set null" }),
  imageUrl: text("image_url"),
  barcode: text("barcode"),
  variant: text("variant"),                                         // ex: "couleur: rouge / taille: M"
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => ({
  orgIdx: index("products_org_idx").on(t.organizationId),
  skuIdx: uniqueIndex("products_org_sku_uidx").on(t.organizationId, t.sku),
  catIdx: index("products_cat_idx").on(t.categoryId),
}));

// ─────────────────────────────────────────────────────────
// PURCHASE ORDERS (bons de commande fournisseurs)
// ─────────────────────────────────────────────────────────
export const purchaseOrdersTable = pgTable("purchase_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  reference: text("reference").notNull(),                           // ex: PO-2026-0001
  supplierId: uuid("supplier_id").notNull().references(() => suppliersTable.id, { onDelete: "restrict" }),
  // draft | sent | partial | received | cancelled
  status: text("status").notNull().default("draft"),
  orderDate: timestamp("order_date", { withTimezone: true }).notNull().defaultNow(),
  expectedDate: timestamp("expected_date", { withTimezone: true }),
  receivedDate: timestamp("received_date", { withTimezone: true }),
  totalFcfa: numeric("total_fcfa", { precision: 18, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdById: uuid("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => ({
  orgIdx: index("po_org_idx").on(t.organizationId),
  refIdx: uniqueIndex("po_org_ref_uidx").on(t.organizationId, t.reference),
  statusIdx: index("po_status_idx").on(t.status),
}));

export const purchaseOrderLinesTable = pgTable("purchase_order_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  purchaseOrderId: uuid("purchase_order_id").notNull().references(() => purchaseOrdersTable.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => productsTable.id, { onDelete: "set null" }),
  description: text("description"),                                 // override libellé
  quantity: numeric("quantity", { precision: 18, scale: 3 }).notNull(),
  unitPriceFcfa: numeric("unit_price_fcfa", { precision: 18, scale: 2 }).notNull(),
  quantityReceived: numeric("quantity_received", { precision: 18, scale: 3 }).notNull().default("0"),
  totalFcfa: numeric("total_fcfa", { precision: 18, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  poIdx: index("pol_po_idx").on(t.purchaseOrderId),
  productIdx: index("pol_product_idx").on(t.productId),
}));

// ─────────────────────────────────────────────────────────
// STOCK MOVEMENTS (journal source de vérité)
// ─────────────────────────────────────────────────────────
export const stockMovementsTable = pgTable("stock_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => productsTable.id, { onDelete: "restrict" }),
  // in | out | adjust
  kind: text("kind").notNull(),
  // signé : positif pour in/adjust+, négatif pour out/adjust-
  quantity: numeric("quantity", { precision: 18, scale: 3 }).notNull(),
  unitCostFcfa: numeric("unit_cost_fcfa", { precision: 18, scale: 2 }),
  // référence source : purchase | sale | adjustment | return | initial
  referenceType: text("reference_type"),
  referenceId: uuid("reference_id"),                                // uuid de PO / order / proforma / invoice
  referenceLabel: text("reference_label"),                          // ex: "PO-2026-0001"
  reason: text("reason"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index("sm_org_idx").on(t.organizationId),
  productIdx: index("sm_product_idx").on(t.productId),
  refIdx: index("sm_ref_idx").on(t.referenceType, t.referenceId),
  occurredIdx: index("sm_occurred_idx").on(t.occurredAt),
}));

// ─────────────────────────────────────────────────────────
// SALES LINES — lignes article attachables à order/proforma/invoice
// ─────────────────────────────────────────────────────────
export const salesLinesTable = pgTable("sales_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  // order | proforma | invoice
  parentType: text("parent_type").notNull(),
  parentId: uuid("parent_id").notNull(),
  productId: uuid("product_id").references(() => productsTable.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 18, scale: 3 }).notNull(),
  unitPriceFcfa: numeric("unit_price_fcfa", { precision: 18, scale: 2 }).notNull(),
  discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  taxRatePct: numeric("tax_rate_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  totalFcfa: numeric("total_fcfa", { precision: 18, scale: 2 }).notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  parentIdx: index("sl_parent_idx").on(t.parentType, t.parentId),
  productIdx: index("sl_product_idx").on(t.productId),
  orgIdx: index("sl_org_idx").on(t.organizationId),
}));

// ─────────────────────────────────────────────────────────
// MAGASINS / DÉPÔTS
// ─────────────────────────────────────────────────────────
export const warehousesTable = pgTable("warehouses", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  location: text("location"),
  address: text("address"),
  // principal | secondaire | transit | externe
  type: text("type").notNull().default("principal"),
  managerId: uuid("manager_id").references(() => usersTable.id),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  codeOrgIdx: uniqueIndex("warehouses_org_code_uidx").on(t.organizationId, t.code),
}));

// ─────────────────────────────────────────────────────────
// DEMANDES INTERNES (BESOINS)
// ─────────────────────────────────────────────────────────
export const internalRequestsTable = pgTable("internal_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  reference: text("reference").notNull(),
  requestedById: uuid("requested_by_id").references(() => usersTable.id),
  // draft | submitted | approved | rejected | fulfilled | cancelled
  status: text("status").notNull().default("draft"),
  // Département / service demandeur (texte libre ou futur FK)
  requesterDepartment: text("requester_department"),
  neededDate: date("needed_date"),
  priority: text("priority").notNull().default("normal"), // low | normal | high | urgent
  notes: text("notes"),
  approvedById: uuid("approved_by_id").references(() => usersTable.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  refOrgIdx: uniqueIndex("internal_requests_org_ref_uidx").on(t.organizationId, t.reference),
  statusIdx: index("internal_requests_status_idx").on(t.status),
}));

export const internalRequestLinesTable = pgTable("internal_request_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  requestId: uuid("request_id").notNull().references(() => internalRequestsTable.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => productsTable.id),
  description: text("description"),
  quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull(),
  unit: text("unit").notNull().default("pcs"),
  // Quantité réellement servie
  servedQuantity: numeric("served_quantity", { precision: 10, scale: 3 }).default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  requestIdx: index("irl_request_idx").on(t.requestId),
}));

// ─────────────────────────────────────────────────────────
// ZOD SCHEMAS
// ─────────────────────────────────────────────────────────
export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });
export const insertProductCategorySchema = createInsertSchema(productCategoriesTable).omit({ id: true, createdAt: true });
export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrdersTable).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });
export const insertPurchaseOrderLineSchema = createInsertSchema(purchaseOrderLinesTable).omit({ id: true, createdAt: true });
export const insertStockMovementSchema = createInsertSchema(stockMovementsTable).omit({ id: true, createdAt: true });
export const insertSalesLineSchema = createInsertSchema(salesLinesTable).omit({ id: true, createdAt: true });

export type Product = typeof productsTable.$inferSelect;
export type ProductCategory = typeof productCategoriesTable.$inferSelect;
export type PurchaseOrder = typeof purchaseOrdersTable.$inferSelect;
export type PurchaseOrderLine = typeof purchaseOrderLinesTable.$inferSelect;
export type StockMovement = typeof stockMovementsTable.$inferSelect;
export type SalesLine = typeof salesLinesTable.$inferSelect;
export const insertWarehouseSchema = createInsertSchema(warehousesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInternalRequestSchema = createInsertSchema(internalRequestsTable).omit({ id: true, createdAt: true, updatedAt: true, approvedAt: true });
export const insertInternalRequestLineSchema = createInsertSchema(internalRequestLinesTable).omit({ id: true, createdAt: true });
export type Warehouse = typeof warehousesTable.$inferSelect;
export type InternalRequest = typeof internalRequestsTable.$inferSelect;
export type InternalRequestLine = typeof internalRequestLinesTable.$inferSelect;

export type { z };
