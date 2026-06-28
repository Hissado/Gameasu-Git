import { Router } from "express";
import { db } from "@workspace/db";
import {
  suppliersTable,
  supplierInvoicesTable,
  supplierInvoiceLinesTable,
  supplierPaymentsTable,
  bankAccountsTable,
  chartOfAccountsTable,
} from "@workspace/db";
import {
  purchaseOrdersTable,
  purchaseOrderLinesTable,
  productsTable,
} from "@workspace/db";
import { expenseReportsTable, expenseItemsTable, collaboratorsTable, organizationsTable, organizationModulesTable } from "@workspace/db";
import { ExcelReportBuilder } from "../lib/excel-engine";
import { and, asc, desc, eq, gte, ilike, isNull, lte, or, sql, inArray, ne } from "drizzle-orm";
import { requirePermission } from "../middlewares/permissions";
import { z } from "zod/v4";

const router = Router();

const toNum = (v: string | number | null | undefined): number => (v == null ? 0 : Number(v));

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const SUPPLIER_STATUS = z.enum(["actif", "inactif", "a_verifier", "suspendu"]);

const SupplierCreateSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  type: z.enum(["fournisseur", "prestataire", "sous-traitant"]).optional().default("fournisseur"),
  status: SUPPLIER_STATUS.optional().default("actif"),
  email: z.email().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  rccm: z.string().optional().nullable(),
  mobileMoney: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const SupplierPatchSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["fournisseur", "prestataire", "sous-traitant"]).optional(),
  status: SUPPLIER_STATUS.optional(),
  isActive: z.boolean().optional(),
  email: z.email().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  rccm: z.string().optional().nullable(),
  mobileMoney: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const InvoiceCreateSchema = z.object({
  supplierId: z.string().uuid("ID fournisseur invalide"),
  referenceNumber: z.string().min(1, "La référence est requise"),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional().nullable(),
  totalAmount: z.coerce.number().positive("Le montant doit être positif"),
  taxAmount: z.coerce.number().min(0).optional().default(0),
  currency: z.string().length(3).optional().default("XOF"),
  notes: z.string().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  expenseAccountId: z.string().uuid().optional().nullable(),
  purchaseOrderId: z.string().uuid().optional().nullable(),
});

const InvoicePatchSchema = z.object({
  status: z.enum(["draft", "review", "awaiting_approval", "approved", "pending", "partially_paid", "paid", "overdue", "cancelled", "rejected"]).optional(),
  dueDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  rejectionReason: z.string().optional().nullable(),
  expenseAccountId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  referenceNumber: z.string().min(1).optional(),
  totalAmount: z.coerce.number().positive().optional(),
  taxAmount: z.coerce.number().min(0).optional(),
  purchaseOrderId: z.string().uuid().optional().nullable(),
});

const PurchaseOrderCreateSchema = z.object({
  supplierId: z.string().uuid("ID fournisseur invalide"),
  deliveryDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  lines: z.array(z.object({
    productId: z.string().uuid("ID produit invalide").optional().nullable(),
    description: z.string().min(1, "Description requise"),
    quantity: z.coerce.number().positive(),
    unitPrice: z.coerce.number().min(0),
    taxRate: z.coerce.number().min(0).optional().default(0),
  })).min(1, "Au moins une ligne est requise"),
});

const PaymentCreateSchema = z.object({
  supplierInvoiceId: z.string().uuid("ID facture invalide"),
  amount: z.coerce.number().positive("Le montant doit être positif"),
  paidAt: z.string().optional(),
  paymentMethod: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ─── Auto-generate supplier code ────────────────────────────────────────────
async function nextSupplierCode(orgId: string): Promise<string> {
  const result = await db
    .select({ code: suppliersTable.code })
    .from(suppliersTable)
    .where(eq(suppliersTable.organizationId, orgId))
    .orderBy(desc(suppliersTable.createdAt))
    .limit(1);
  if (!result.length) return "F0001";
  const lastNum = parseInt(result[0].code.replace(/\D/g, "")) || 0;
  return `F${String(lastNum + 1).padStart(4, "0")}`;
}

async function nextPoReference(orgId: string): Promise<string> {
  const year = new Date().getFullYear();
  const result = await db
    .select({ ref: purchaseOrdersTable.reference })
    .from(purchaseOrdersTable)
    .where(and(eq(purchaseOrdersTable.organizationId, orgId), ilike(purchaseOrdersTable.reference, `PO-${year}-%`)))
    .orderBy(desc(purchaseOrdersTable.createdAt))
    .limit(1);
  if (!result.length) return `PO-${year}-0001`;
  const lastNum = parseInt(result[0].ref.split("-")[2] || "0") || 0;
  return `PO-${year}-${String(lastNum + 1).padStart(4, "0")}`;
}

// ════════════════════════════════════════════════════════════════
// FOURNISSEURS
// ════════════════════════════════════════════════════════════════

router.get("/purchases/suppliers", requirePermission("purchases.read"), async (req, res) => {
  try {
    const { search, status, type, limit = "100", offset = "0" } = req.query as Record<string, string>;
    const orgId = req.authUser!.organizationId;
    const conds = [isNull(suppliersTable.deletedAt), eq(suppliersTable.organizationId, orgId)];

    if (search) {
      conds.push(or(
        ilike(suppliersTable.name, `%${search}%`),
        ilike(suppliersTable.email, `%${search}%`),
        ilike(suppliersTable.code, `%${search}%`),
      )!);
    }
    if (status === "active") conds.push(eq(suppliersTable.isActive, true));
    if (status === "inactive") conds.push(eq(suppliersTable.isActive, false));
    if (type) conds.push(eq(suppliersTable.type, type));

    const [rows, countResult] = await Promise.all([
      db.select({
        id: suppliersTable.id,
        code: suppliersTable.code,
        name: suppliersTable.name,
        email: suppliersTable.email,
        phone: suppliersTable.phone,
        taxId: suppliersTable.taxId,
        paymentTerms: suppliersTable.paymentTerms,
        isActive: suppliersTable.isActive,
        createdAt: suppliersTable.createdAt,
        type: suppliersTable.type,
        country: suppliersTable.country,
        city: suppliersTable.city,
        status: suppliersTable.status,
      })
        .from(suppliersTable)
        .where(and(...conds))
        .orderBy(asc(suppliersTable.name))
        .limit(parseInt(limit))
        .offset(parseInt(offset)),
      db.select({ count: sql<number>`count(*)` }).from(suppliersTable).where(and(...conds)),
    ]);

    // Enrich with outstanding balance
    const ids = rows.map(r => r.id);
    let balances: Record<string, number> = {};
    if (ids.length > 0) {
      const bals = await db
        .select({
          supplierId: supplierInvoicesTable.supplierId,
          balance: sql<number>`sum(${supplierInvoicesTable.totalAmount} - ${supplierInvoicesTable.paidAmount})`,
        })
        .from(supplierInvoicesTable)
        .where(and(
          eq(supplierInvoicesTable.organizationId, orgId),
          inArray(supplierInvoicesTable.supplierId, ids),
          ne(supplierInvoicesTable.status, "cancelled"),
        ))
        .groupBy(supplierInvoicesTable.supplierId);
      bals.forEach(b => { balances[b.supplierId] = toNum(b.balance); });
    }

    const data = rows.map(r => ({ ...r, outstandingBalance: balances[r.id] ?? 0 }));
    return res.json({ data, total: toNum(countResult[0]?.count) });
  } catch (e: any) {
    req.log.error(e, "purchases/suppliers GET");
    return res.status(500).json({ error: "Erreur lors de la récupération des fournisseurs" });
  }
});

router.post("/purchases/suppliers", requirePermission("purchases.write"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const parsed = SupplierCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides" });
    const data = parsed.data;

    const code = await nextSupplierCode(orgId);
    const supplierStatus = data.status ?? "actif";
    const [row] = await db.insert(suppliersTable).values({
      organizationId: orgId,
      code,
      name: data.name,
      email: data.email ?? null,
      phone: data.phone ?? null,
      address: data.address ?? null,
      taxId: data.taxId ?? null,
      paymentTerms: data.paymentTerms ?? null,
      isActive: supplierStatus === "actif",
      type: data.type,
      country: data.country ?? null,
      city: data.city ?? null,
      rccm: data.rccm ?? null,
      mobileMoney: data.mobileMoney ?? null,
      bankName: data.bankName ?? null,
      bankAccountNumber: data.bankAccountNumber ?? null,
      notes: data.notes ?? null,
      status: supplierStatus,
    }).returning();
    return res.status(201).json(row);
  } catch (e: any) {
    req.log.error(e, "purchases/suppliers POST");
    return res.status(500).json({ error: "Erreur lors de la création du fournisseur" });
  }
});

router.get("/purchases/suppliers/:id", requirePermission("purchases.read"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const id = req.params.id as string;

    const [supplier] = await db.select().from(suppliersTable)
      .where(and(eq(suppliersTable.id, id), eq(suppliersTable.organizationId, orgId), isNull(suppliersTable.deletedAt)));
    if (!supplier) return res.status(404).json({ error: "Fournisseur introuvable" });

    const [invoices, payments] = await Promise.all([
      db.select({
        id: supplierInvoicesTable.id,
        referenceNumber: supplierInvoicesTable.referenceNumber,
        status: supplierInvoicesTable.status,
        invoiceDate: supplierInvoicesTable.invoiceDate,
        dueDate: supplierInvoicesTable.dueDate,
        totalAmount: supplierInvoicesTable.totalAmount,
        paidAmount: supplierInvoicesTable.paidAmount,
        currency: supplierInvoicesTable.currency,
      }).from(supplierInvoicesTable)
        .where(and(eq(supplierInvoicesTable.supplierId, id), eq(supplierInvoicesTable.organizationId, orgId)))
        .orderBy(desc(supplierInvoicesTable.invoiceDate))
        .limit(20),
      db.select({
        id: supplierPaymentsTable.id,
        amount: supplierPaymentsTable.amount,
        method: supplierPaymentsTable.method,
        paidAt: supplierPaymentsTable.paidAt,
        reference: supplierPaymentsTable.reference,
      }).from(supplierPaymentsTable)
        .where(and(eq(supplierPaymentsTable.organizationId, orgId),
          sql`${supplierPaymentsTable.supplierInvoiceId} IN (
            SELECT id FROM supplier_invoices WHERE supplier_id = ${id} AND organization_id = ${orgId}
          )`))
        .orderBy(desc(supplierPaymentsTable.paidAt))
        .limit(20),
    ]);

    const totalInvoiced = invoices.reduce((s, i) => s + toNum(i.totalAmount), 0);
    const totalPaid = invoices.reduce((s, i) => s + toNum(i.paidAmount), 0);

    return res.json({ ...supplier, invoices, payments, totalInvoiced, totalPaid, outstandingBalance: totalInvoiced - totalPaid });
  } catch (e: any) {
    req.log.error(e, "purchases/suppliers/:id GET");
    return res.status(500).json({ error: "Erreur lors de la récupération" });
  }
});

router.patch("/purchases/suppliers/:id", requirePermission("purchases.write"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const id = req.params.id as string;
    const parsed = SupplierPatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides" });
    const data = parsed.data;

    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.email !== undefined) patch.email = data.email;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.address !== undefined) patch.address = data.address;
    if (data.taxId !== undefined) patch.taxId = data.taxId;
    if (data.paymentTerms !== undefined) patch.paymentTerms = data.paymentTerms;
    if (data.isActive !== undefined) patch.isActive = data.isActive;
    if (data.type !== undefined) patch.type = data.type;
    if (data.country !== undefined) patch.country = data.country;
    if (data.city !== undefined) patch.city = data.city;
    if (data.rccm !== undefined) patch.rccm = data.rccm;
    if (data.mobileMoney !== undefined) patch.mobileMoney = data.mobileMoney;
    if (data.bankName !== undefined) patch.bankName = data.bankName;
    if (data.bankAccountNumber !== undefined) patch.bankAccountNumber = data.bankAccountNumber;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.status !== undefined) { patch.status = data.status; patch.isActive = data.status === "actif"; }

    const [updated] = await db.update(suppliersTable)
      .set(patch as any)
      .where(and(eq(suppliersTable.id, id), eq(suppliersTable.organizationId, orgId), isNull(suppliersTable.deletedAt)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Fournisseur introuvable" });
    return res.json(updated);
  } catch (e: any) {
    req.log.error(e, "purchases/suppliers/:id PATCH");
    return res.status(500).json({ error: "Erreur lors de la mise à jour" });
  }
});

router.delete("/purchases/suppliers/:id", requirePermission("purchases.write"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const id = req.params.id as string;
    await db.update(suppliersTable)
      .set({ deletedAt: new Date() })
      .where(and(eq(suppliersTable.id, id), eq(suppliersTable.organizationId, orgId)));
    return res.json({ success: true });
  } catch (e: any) {
    req.log.error(e, "purchases/suppliers/:id DELETE");
    return res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

// ════════════════════════════════════════════════════════════════
// FACTURES FOURNISSEURS
// ════════════════════════════════════════════════════════════════

router.get("/purchases/invoices", requirePermission("purchases.read"), async (req, res) => {
  try {
    const { status, supplierId, search, purchaseOrderId, projectId, dateFrom, dateTo, dueBefore, dueAfter, minAmount, maxAmount, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const orgId = req.authUser!.organizationId;
    const conds = [eq(supplierInvoicesTable.organizationId, orgId)];
    if (status) conds.push(eq(supplierInvoicesTable.status, status));
    if (supplierId) conds.push(eq(supplierInvoicesTable.supplierId, supplierId));
    if (purchaseOrderId) conds.push(eq(supplierInvoicesTable.purchaseOrderId, purchaseOrderId));
    if (projectId) conds.push(eq(supplierInvoicesTable.projectId, projectId));
    if (dateFrom) conds.push(sql`${supplierInvoicesTable.invoiceDate} >= ${dateFrom}`);
    if (dateTo) conds.push(sql`${supplierInvoicesTable.invoiceDate} <= ${dateTo}`);
    if (dueBefore) conds.push(sql`${supplierInvoicesTable.dueDate} <= ${dueBefore}`);
    if (dueAfter) conds.push(sql`${supplierInvoicesTable.dueDate} >= ${dueAfter}`);
    if (minAmount) conds.push(sql`${supplierInvoicesTable.totalAmount}::numeric >= ${Number(minAmount)}`);
    if (maxAmount) conds.push(sql`${supplierInvoicesTable.totalAmount}::numeric <= ${Number(maxAmount)}`);
    if (search) {
      conds.push(or(
        ilike(supplierInvoicesTable.referenceNumber, `%${search}%`),
        ilike(supplierInvoicesTable.notes, `%${search}%`),
      )!);
    }

    const [rows, countResult] = await Promise.all([
      db.select({
        id: supplierInvoicesTable.id,
        referenceNumber: supplierInvoicesTable.referenceNumber,
        status: supplierInvoicesTable.status,
        invoiceDate: supplierInvoicesTable.invoiceDate,
        dueDate: supplierInvoicesTable.dueDate,
        totalAmount: supplierInvoicesTable.totalAmount,
        taxAmount: supplierInvoicesTable.taxAmount,
        paidAmount: supplierInvoicesTable.paidAmount,
        currency: supplierInvoicesTable.currency,
        notes: supplierInvoicesTable.notes,
        attachmentUrl: supplierInvoicesTable.attachmentUrl,
        supplierId: supplierInvoicesTable.supplierId,
        purchaseOrderId: supplierInvoicesTable.purchaseOrderId,
        projectId: supplierInvoicesTable.projectId,
        supplierName: suppliersTable.name,
        supplierCode: suppliersTable.code,
        createdAt: supplierInvoicesTable.createdAt,
        updatedAt: supplierInvoicesTable.updatedAt,
      })
        .from(supplierInvoicesTable)
        .leftJoin(suppliersTable, and(eq(suppliersTable.id, supplierInvoicesTable.supplierId), eq(suppliersTable.organizationId, orgId)))
        .where(and(...conds))
        .orderBy(desc(supplierInvoicesTable.invoiceDate))
        .limit(parseInt(limit))
        .offset(parseInt(offset)),
      db.select({ count: sql<number>`count(*)` }).from(supplierInvoicesTable).where(and(...conds)),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const data = rows.map(r => ({
      ...r,
      balance: toNum(r.totalAmount) - toNum(r.paidAmount),
      isOverdue: r.status !== "paid" && r.status !== "cancelled" && r.dueDate && r.dueDate < today,
    }));
    return res.json({ data, total: toNum(countResult[0]?.count) });
  } catch (e: any) {
    req.log.error(e, "purchases/invoices GET");
    return res.status(500).json({ error: "Erreur lors de la récupération des factures" });
  }
});

router.post("/purchases/invoices", requirePermission("purchases.write"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const parsed = InvoiceCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides" });
    const data = parsed.data;

    const [supplier] = await db.select({ id: suppliersTable.id })
      .from(suppliersTable)
      .where(and(eq(suppliersTable.id, data.supplierId), eq(suppliersTable.organizationId, orgId), isNull(suppliersTable.deletedAt)))
      .limit(1);
    if (!supplier) return res.status(400).json({ error: "Fournisseur introuvable ou non autorisé" });

    const [row] = await db.insert(supplierInvoicesTable).values({
      organizationId: orgId,
      supplierId: data.supplierId,
      referenceNumber: data.referenceNumber,
      status: "review",
      invoiceDate: data.invoiceDate || new Date().toISOString().slice(0, 10),
      dueDate: data.dueDate ?? null,
      totalAmount: String(data.totalAmount),
      taxAmount: String(data.taxAmount ?? 0),
      paidAmount: "0",
      currency: data.currency ?? "XOF",
      notes: data.notes ?? null,
      projectId: data.projectId ?? null,
      expenseAccountId: data.expenseAccountId ?? null,
      purchaseOrderId: data.purchaseOrderId ?? null,
    }).returning();
    return res.status(201).json(row);
  } catch (e: any) {
    req.log.error(e, "purchases/invoices POST");
    return res.status(500).json({ error: "Erreur lors de la création" });
  }
});

router.get("/purchases/invoices/:id", requirePermission("purchases.read"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const id = req.params.id as string;
    const [inv] = await db.select({
      id: supplierInvoicesTable.id,
      referenceNumber: supplierInvoicesTable.referenceNumber,
      status: supplierInvoicesTable.status,
      invoiceDate: supplierInvoicesTable.invoiceDate,
      dueDate: supplierInvoicesTable.dueDate,
      totalAmount: supplierInvoicesTable.totalAmount,
      taxAmount: supplierInvoicesTable.taxAmount,
      paidAmount: supplierInvoicesTable.paidAmount,
      currency: supplierInvoicesTable.currency,
      notes: supplierInvoicesTable.notes,
      attachmentUrl: supplierInvoicesTable.attachmentUrl,
      expenseAccountId: supplierInvoicesTable.expenseAccountId,
      projectId: supplierInvoicesTable.projectId,
      purchaseOrderId: supplierInvoicesTable.purchaseOrderId,
      statusHistory: supplierInvoicesTable.statusHistory,
      supplierId: supplierInvoicesTable.supplierId,
      supplierName: suppliersTable.name,
      supplierCode: suppliersTable.code,
      supplierEmail: suppliersTable.email,
      supplierPhone: suppliersTable.phone,
      createdAt: supplierInvoicesTable.createdAt,
    }).from(supplierInvoicesTable)
      .leftJoin(suppliersTable, and(eq(suppliersTable.id, supplierInvoicesTable.supplierId), eq(suppliersTable.organizationId, orgId)))
      .where(and(eq(supplierInvoicesTable.id, id), eq(supplierInvoicesTable.organizationId, orgId)));

    // Fetch linked PO reference if any
    let purchaseOrderReference: string | null = null;
    if (inv?.purchaseOrderId) {
      const [po] = await db.select({ reference: purchaseOrdersTable.reference })
        .from(purchaseOrdersTable)
        .where(and(eq(purchaseOrdersTable.id, inv.purchaseOrderId), eq(purchaseOrdersTable.organizationId, orgId)))
        .limit(1);
      purchaseOrderReference = po?.reference ?? null;
    }

    if (!inv) return res.status(404).json({ error: "Facture introuvable" });

    const payments = await db.select({
      id: supplierPaymentsTable.id,
      amount: supplierPaymentsTable.amount,
      method: supplierPaymentsTable.method,
      status: supplierPaymentsTable.status,
      reference: supplierPaymentsTable.reference,
      paidAt: supplierPaymentsTable.paidAt,
      notes: supplierPaymentsTable.notes,
      bankAccountId: supplierPaymentsTable.bankAccountId,
      bankAccountName: bankAccountsTable.name,
    }).from(supplierPaymentsTable)
      .leftJoin(bankAccountsTable, eq(bankAccountsTable.id, supplierPaymentsTable.bankAccountId))
      .where(and(eq(supplierPaymentsTable.supplierInvoiceId, id), eq(supplierPaymentsTable.organizationId, orgId)))
      .orderBy(desc(supplierPaymentsTable.paidAt));

    const today = new Date().toISOString().slice(0, 10);
    return res.json({
      ...inv,
      purchaseOrderReference,
      statusHistory: inv.statusHistory ?? [],
      balance: toNum(inv.totalAmount) - toNum(inv.paidAmount),
      isOverdue: inv.status !== "paid" && inv.status !== "cancelled" && inv.dueDate && inv.dueDate < today,
      payments,
    });
  } catch (e: any) {
    req.log.error(e, "purchases/invoices/:id GET");
    return res.status(500).json({ error: "Erreur lors de la récupération" });
  }
});

router.patch("/purchases/invoices/:id", requirePermission("purchases.write"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const id = req.params.id as string;
    const parsed = InvoicePatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides" });
    const data = parsed.data;

    // If status is changing, fetch current status to record history
    let statusHistoryAppend: Array<{ from: string; to: string; at: string; userId: string; comment?: string }> = [];
    if (data.status !== undefined) {
      const [current] = await db.select({ status: supplierInvoicesTable.status, statusHistory: supplierInvoicesTable.statusHistory })
        .from(supplierInvoicesTable)
        .where(and(eq(supplierInvoicesTable.id, id), eq(supplierInvoicesTable.organizationId, orgId)))
        .limit(1);
      if (current && current.status !== data.status) {
        const existing = (current.statusHistory as Array<{ from: string; to: string; at: string; userId: string; comment?: string }>) ?? [];
        const entry: { from: string; to: string; at: string; userId: string; comment?: string } = {
          from: current.status, to: data.status, at: new Date().toISOString(), userId: req.authUser!.id,
        };
        if (data.status === "rejected" && data.rejectionReason) entry.comment = data.rejectionReason;
        statusHistoryAppend = [...existing, entry];
      }
    }

    const [updated] = await db.update(supplierInvoicesTable)
      .set({
        ...(data.status !== undefined && { status: data.status }),
        ...(statusHistoryAppend.length > 0 && { statusHistory: statusHistoryAppend }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
        ...(data.notes !== undefined && { notes: data.notes }),
        // Store rejection reason in notes if no explicit notes field was sent
        ...(data.status === "rejected" && data.rejectionReason && data.notes === undefined && { notes: data.rejectionReason }),
        ...(data.expenseAccountId !== undefined && { expenseAccountId: data.expenseAccountId }),
        ...(data.projectId !== undefined && { projectId: data.projectId }),
        ...(data.referenceNumber !== undefined && { referenceNumber: data.referenceNumber }),
        ...(data.totalAmount !== undefined && { totalAmount: String(data.totalAmount) }),
        ...(data.taxAmount !== undefined && { taxAmount: String(data.taxAmount) }),
        ...(data.purchaseOrderId !== undefined && { purchaseOrderId: data.purchaseOrderId }),
      })
      .where(and(eq(supplierInvoicesTable.id, id), eq(supplierInvoicesTable.organizationId, orgId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Facture introuvable" });
    return res.json(updated);
  } catch (e: any) {
    req.log.error(e, "purchases/invoices/:id PATCH");
    return res.status(500).json({ error: "Erreur lors de la mise à jour" });
  }
});

// ─── Invoice lines ────────────────────────────────────────────────────────────

router.get("/purchases/invoices/:id/lines", requirePermission("purchases.read"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const id = req.params.id as string;
    const [inv] = await db.select({ id: supplierInvoicesTable.id })
      .from(supplierInvoicesTable)
      .where(and(eq(supplierInvoicesTable.id, id), eq(supplierInvoicesTable.organizationId, orgId)));
    if (!inv) return res.status(404).json({ error: "Facture introuvable" });
    const lines = await db.select({
      id: supplierInvoiceLinesTable.id,
      description: supplierInvoiceLinesTable.description,
      quantity: supplierInvoiceLinesTable.quantity,
      unitPriceFcfa: supplierInvoiceLinesTable.unitPriceFcfa,
      taxRate: supplierInvoiceLinesTable.taxRate,
      totalHt: supplierInvoiceLinesTable.totalHt,
      totalTtc: supplierInvoiceLinesTable.totalTtc,
      expenseAccountId: supplierInvoiceLinesTable.expenseAccountId,
    }).from(supplierInvoiceLinesTable)
      .where(and(eq(supplierInvoiceLinesTable.invoiceId, id), eq(supplierInvoiceLinesTable.organizationId, orgId)));
    return res.json({ data: lines });
  } catch (e: any) {
    req.log.error(e, "purchases/invoices/:id/lines GET");
    return res.status(500).json({ error: "Erreur lors de la récupération des lignes" });
  }
});

router.post("/purchases/invoices/:id/lines", requirePermission("purchases.write"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const id = req.params.id as string;
    const LineSchema = z.object({
      description: z.string().min(1),
      quantity: z.coerce.number().positive(),
      unitPriceFcfa: z.coerce.number().min(0),
      taxRate: z.coerce.number().min(0).max(100).optional().default(0),
      expenseAccountId: z.string().uuid().optional().nullable(),
    });
    const parsed = z.array(LineSchema).safeParse(req.body.lines ?? [req.body]);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides" });
    const [inv] = await db.select().from(supplierInvoicesTable)
      .where(and(eq(supplierInvoicesTable.id, id), eq(supplierInvoicesTable.organizationId, orgId)));
    if (!inv) return res.status(404).json({ error: "Facture introuvable" });

    // Delete and replace all lines
    await db.delete(supplierInvoiceLinesTable)
      .where(and(eq(supplierInvoiceLinesTable.invoiceId, id), eq(supplierInvoiceLinesTable.organizationId, orgId)));

    const lines = parsed.data;
    const inserted = lines.length > 0 ? await db.insert(supplierInvoiceLinesTable).values(
      lines.map(l => {
        const totalHt = l.quantity * l.unitPriceFcfa;
        const totalTtc = totalHt * (1 + l.taxRate / 100);
        return {
          organizationId: orgId,
          invoiceId: id,
          description: l.description,
          quantity: String(l.quantity),
          unitPriceFcfa: String(l.unitPriceFcfa),
          taxRate: String(l.taxRate),
          totalHt: String(totalHt),
          totalTtc: String(totalTtc),
          expenseAccountId: l.expenseAccountId ?? null,
        };
      })
    ).returning() : [];

    // Recalculate invoice totals from lines
    const newTotalHt = lines.reduce((s, l) => s + l.quantity * l.unitPriceFcfa, 0);
    const newTaxAmount = lines.reduce((s, l) => s + l.quantity * l.unitPriceFcfa * (l.taxRate / 100), 0);
    await db.update(supplierInvoicesTable)
      .set({ totalAmount: String(newTotalHt), taxAmount: String(newTaxAmount) })
      .where(eq(supplierInvoicesTable.id, id));

    return res.status(201).json({ data: inserted });
  } catch (e: any) {
    req.log.error(e, "purchases/invoices/:id/lines POST");
    return res.status(500).json({ error: "Erreur lors de la sauvegarde des lignes" });
  }
});

// ════════════════════════════════════════════════════════════════
// BONS DE COMMANDE
// ════════════════════════════════════════════════════════════════

router.get("/purchases/purchase-orders", requirePermission("purchases.read"), async (req, res) => {
  try {
    const { status, supplierId, search, limit = "50", offset = "0", dateFrom, dateTo } = req.query as Record<string, string>;
    const orgId = req.authUser!.organizationId;
    const conds = [eq(purchaseOrdersTable.organizationId, orgId), isNull(purchaseOrdersTable.deletedAt)];
    if (status) conds.push(eq(purchaseOrdersTable.status, status));
    if (supplierId) conds.push(eq(purchaseOrdersTable.supplierId, supplierId));
    if (search) conds.push(ilike(purchaseOrdersTable.reference, `%${search}%`));
    if (dateFrom) conds.push(sql`${purchaseOrdersTable.orderDate}::date >= ${dateFrom}::date`);
    if (dateTo) conds.push(sql`${purchaseOrdersTable.orderDate}::date <= ${dateTo}::date`);

    const [rows, countResult] = await Promise.all([
      db.select({
        id: purchaseOrdersTable.id,
        reference: purchaseOrdersTable.reference,
        status: purchaseOrdersTable.status,
        orderDate: purchaseOrdersTable.orderDate,
        expectedDate: purchaseOrdersTable.expectedDate,
        totalFcfa: purchaseOrdersTable.totalFcfa,
        notes: purchaseOrdersTable.notes,
        supplierId: purchaseOrdersTable.supplierId,
        supplierName: suppliersTable.name,
        supplierCode: suppliersTable.code,
        createdAt: purchaseOrdersTable.createdAt,
      })
        .from(purchaseOrdersTable)
        .leftJoin(suppliersTable, eq(suppliersTable.id, purchaseOrdersTable.supplierId))
        .where(and(...conds))
        .orderBy(desc(purchaseOrdersTable.orderDate))
        .limit(parseInt(limit))
        .offset(parseInt(offset)),
      db.select({ count: sql<number>`count(*)` }).from(purchaseOrdersTable).where(and(...conds)),
    ]);
    return res.json({ data: rows, total: toNum(countResult[0]?.count) });
  } catch (e: any) {
    req.log.error(e, "purchases/purchase-orders GET");
    return res.status(500).json({ error: "Erreur lors de la récupération" });
  }
});

router.post("/purchases/purchase-orders", requirePermission("purchases.write"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const parsed = PurchaseOrderCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides" });
    const data = parsed.data;

    const [poSupplier] = await db.select({ id: suppliersTable.id })
      .from(suppliersTable)
      .where(and(eq(suppliersTable.id, data.supplierId), eq(suppliersTable.organizationId, orgId), isNull(suppliersTable.deletedAt)))
      .limit(1);
    if (!poSupplier) return res.status(400).json({ error: "Fournisseur introuvable ou non autorisé" });

    if (data.lines.length > 0) {
      // Only validate non-null productIds
      const productIds = data.lines.map((l) => l.productId).filter((pid): pid is string => !!pid);
      if (productIds.length > 0) {
        const validProducts = await db.select({ id: productsTable.id })
          .from(productsTable)
          .where(and(inArray(productsTable.id, productIds), eq(productsTable.organizationId, orgId)));
        const validSet = new Set(validProducts.map((p) => p.id));
        const invalid = productIds.find((pid) => !validSet.has(pid));
        if (invalid) return res.status(400).json({ error: "Produit introuvable ou non autorisé" });
      }
    }

    const reference = await nextPoReference(orgId);
    const totalFcfa = data.lines.reduce((s, l) => s + (l.unitPrice * l.quantity), 0);

    const [po] = await db.insert(purchaseOrdersTable).values({
      organizationId: orgId,
      reference,
      supplierId: data.supplierId,
      status: "draft",
      expectedDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
      totalFcfa: String(totalFcfa),
      notes: data.notes ?? null,
      createdById: req.authUser!.id,
    }).returning();

    if (data.lines.length > 0) {
      await db.insert(purchaseOrderLinesTable).values(
        data.lines.map((l) => ({
          organizationId: orgId,
          purchaseOrderId: po.id,
          productId: l.productId ?? null,
          description: l.description,
          quantity: String(l.quantity),
          unitPriceFcfa: String(l.unitPrice),
          totalFcfa: String(l.unitPrice * l.quantity),
        }))
      );
    }
    return res.status(201).json(po);
  } catch (e: any) {
    req.log.error(e, "purchases/purchase-orders POST");
    return res.status(500).json({ error: "Erreur lors de la création" });
  }
});

router.get("/purchases/purchase-orders/:id", requirePermission("purchases.read"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const id = req.params.id as string;
    const [po] = await db.select({
      id: purchaseOrdersTable.id,
      reference: purchaseOrdersTable.reference,
      status: purchaseOrdersTable.status,
      orderDate: purchaseOrdersTable.orderDate,
      expectedDate: purchaseOrdersTable.expectedDate,
      receivedDate: purchaseOrdersTable.receivedDate,
      totalFcfa: purchaseOrdersTable.totalFcfa,
      notes: purchaseOrdersTable.notes,
      supplierId: purchaseOrdersTable.supplierId,
      supplierName: suppliersTable.name,
      supplierCode: suppliersTable.code,
      supplierPhone: suppliersTable.phone,
      createdAt: purchaseOrdersTable.createdAt,
    }).from(purchaseOrdersTable)
      .leftJoin(suppliersTable, eq(suppliersTable.id, purchaseOrdersTable.supplierId))
      .where(and(eq(purchaseOrdersTable.id, id), eq(purchaseOrdersTable.organizationId, orgId), isNull(purchaseOrdersTable.deletedAt)));

    if (!po) return res.status(404).json({ error: "Bon de commande introuvable" });

    const lines = await db.select({
      id: purchaseOrderLinesTable.id,
      productId: purchaseOrderLinesTable.productId,
      productName: productsTable.name,
      productSku: productsTable.sku,
      description: purchaseOrderLinesTable.description,
      quantity: purchaseOrderLinesTable.quantity,
      unitPriceFcfa: purchaseOrderLinesTable.unitPriceFcfa,
      quantityReceived: purchaseOrderLinesTable.quantityReceived,
      totalFcfa: purchaseOrderLinesTable.totalFcfa,
    }).from(purchaseOrderLinesTable)
      .leftJoin(productsTable, and(eq(productsTable.id, purchaseOrderLinesTable.productId), eq(productsTable.organizationId, orgId)))
      .where(and(eq(purchaseOrderLinesTable.purchaseOrderId, id), eq(purchaseOrderLinesTable.organizationId, orgId)))
      .orderBy(asc(purchaseOrderLinesTable.createdAt));

    return res.json({ ...po, lines });
  } catch (e: any) {
    req.log.error(e, "purchases/purchase-orders/:id GET");
    return res.status(500).json({ error: "Erreur lors de la récupération" });
  }
});

router.patch("/purchases/purchase-orders/:id", requirePermission("purchases.write"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const id = req.params.id as string;
    const PoPatchSchema = z.object({
      status: z.enum(["draft", "sent", "confirmed", "partially_received", "received", "facture", "cancelled"]).optional(),
      expectedDate: z.string().optional().nullable(),
      receivedDate: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    });
    const parsed = PoPatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides" });
    const data = parsed.data;

    const [updated] = await db.update(purchaseOrdersTable)
      .set({
        ...(data.status !== undefined && { status: data.status }),
        ...(data.expectedDate !== undefined && { expectedDate: data.expectedDate ? new Date(data.expectedDate) : null }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.receivedDate !== undefined && { receivedDate: data.receivedDate ? new Date(data.receivedDate) : null }),
      })
      .where(and(eq(purchaseOrdersTable.id, id), eq(purchaseOrdersTable.organizationId, orgId), isNull(purchaseOrdersTable.deletedAt)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Bon de commande introuvable" });
    return res.json(updated);
  } catch (e: any) {
    req.log.error(e, "purchases/purchase-orders/:id PATCH");
    return res.status(500).json({ error: "Erreur lors de la mise à jour" });
  }
});

// ════════════════════════════════════════════════════════════════
// PAIEMENTS FOURNISSEURS
// ════════════════════════════════════════════════════════════════

router.get("/purchases/payments", requirePermission("purchases.read"), async (req, res) => {
  try {
    const { supplierId, invoiceId, method, status, dateFrom, dateTo, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const orgId = req.authUser!.organizationId;
    const conds = [eq(supplierPaymentsTable.organizationId, orgId)];
    if (invoiceId) conds.push(eq(supplierPaymentsTable.supplierInvoiceId, invoiceId));
    if (method) conds.push(eq(supplierPaymentsTable.method, method));
    if (status) conds.push(eq(supplierPaymentsTable.status, status));
    if (supplierId) {
      conds.push(
        sql`${supplierPaymentsTable.supplierInvoiceId} IN (
          SELECT id FROM supplier_invoices WHERE supplier_id = ${supplierId} AND organization_id = ${orgId}
        )`
      );
    }
    const [rows, countResult] = await Promise.all([
      db.select({
        id: supplierPaymentsTable.id,
        amount: supplierPaymentsTable.amount,
        method: supplierPaymentsTable.method,
        status: supplierPaymentsTable.status,
        reference: supplierPaymentsTable.reference,
        paidAt: supplierPaymentsTable.paidAt,
        notes: supplierPaymentsTable.notes,
        bankAccountId: supplierPaymentsTable.bankAccountId,
        bankAccountName: bankAccountsTable.name,
        supplierInvoiceId: supplierPaymentsTable.supplierInvoiceId,
        invoiceRef: supplierInvoicesTable.referenceNumber,
        supplierId: supplierInvoicesTable.supplierId,
        supplierName: suppliersTable.name,
      }).from(supplierPaymentsTable)
        .leftJoin(supplierInvoicesTable, eq(supplierInvoicesTable.id, supplierPaymentsTable.supplierInvoiceId))
        .leftJoin(suppliersTable, and(eq(suppliersTable.id, supplierInvoicesTable.supplierId), eq(suppliersTable.organizationId, orgId)))
        .leftJoin(bankAccountsTable, eq(bankAccountsTable.id, supplierPaymentsTable.bankAccountId))
        .where(and(...conds))
        .orderBy(desc(supplierPaymentsTable.paidAt))
        .limit(parseInt(limit))
        .offset(parseInt(offset)),
      db.select({ count: sql<number>`count(*)` }).from(supplierPaymentsTable).where(and(...conds)),
    ]);
    return res.json({ data: rows, total: toNum(countResult[0]?.count) });
  } catch (e: any) {
    req.log.error(e, "purchases/payments GET");
    return res.status(500).json({ error: "Erreur lors de la récupération" });
  }
});

router.post("/purchases/payments", requirePermission("purchases.pay"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const PaySchema = PaymentCreateSchema.extend({
      bankAccountId: z.string().uuid().optional().nullable(),
      paymentStatus: z.enum(["programme", "en_attente", "confirme", "echoue", "annule"]).optional().default("confirme"),
    });
    const parsed = PaySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides" });
    const data = parsed.data;

    const [invoice] = await db.select().from(supplierInvoicesTable)
      .where(and(eq(supplierInvoicesTable.id, data.supplierInvoiceId), eq(supplierInvoicesTable.organizationId, orgId)));
    if (!invoice) return res.status(404).json({ error: "Facture introuvable" });

    // Validate bankAccountId belongs to org
    const bankAccId = (data as any).bankAccountId ?? null;
    if (bankAccId) {
      const [ba] = await db.select({ id: bankAccountsTable.id }).from(bankAccountsTable)
        .where(and(eq(bankAccountsTable.id, bankAccId), eq(bankAccountsTable.organizationId, orgId)));
      if (!ba) return res.status(400).json({ error: "Compte bancaire introuvable ou non autorisé" });
    }

    const [payment] = await db.insert(supplierPaymentsTable).values({
      organizationId: orgId,
      supplierInvoiceId: data.supplierInvoiceId,
      amount: String(data.amount),
      method: data.paymentMethod ?? "virement",
      reference: data.reference ?? null,
      status: data.paymentStatus ?? "confirme",
      bankAccountId: bankAccId,
      paidAt: data.paidAt ? new Date(data.paidAt) : new Date(),
      notes: data.notes ?? null,
    }).returning();

    // Only update invoice balance if payment is confirmed
    if ((data.paymentStatus ?? "confirme") === "confirme") {
      const newPaid = toNum(invoice.paidAmount) + data.amount;
      const total = toNum(invoice.totalAmount);
      const newStatus = newPaid >= total ? "paid" : "partially_paid";
      await db.update(supplierInvoicesTable)
        .set({ paidAmount: String(newPaid), status: newStatus })
        .where(eq(supplierInvoicesTable.id, data.supplierInvoiceId));
    }

    return res.status(201).json(payment);
  } catch (e: any) {
    req.log.error(e, "purchases/payments POST");
    return res.status(500).json({ error: "Erreur lors de l'enregistrement du paiement" });
  }
});

// Multi-invoice payment: allocate oldest-first
router.post("/purchases/payments/multi", requirePermission("purchases.pay"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const Schema = z.object({
      supplierId: z.string().uuid(),
      invoiceIds: z.array(z.string().uuid()).min(1),
      totalAmount: z.coerce.number().positive(),
      paymentMethod: z.string().optional().default("virement"),
      bankAccountId: z.string().uuid().optional().nullable(),
      reference: z.string().optional().nullable(),
      paidAt: z.string().optional(),
      notes: z.string().optional().nullable(),
      paymentStatus: z.enum(["programme", "en_attente", "confirme"]).optional().default("confirme"),
    });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides" });
    const data = parsed.data;

    // Validate bankAccountId belongs to org
    if (data.bankAccountId) {
      const [ba] = await db.select({ id: bankAccountsTable.id }).from(bankAccountsTable)
        .where(and(eq(bankAccountsTable.id, data.bankAccountId), eq(bankAccountsTable.organizationId, orgId)));
      if (!ba) return res.status(400).json({ error: "Compte bancaire introuvable ou non autorisé" });
    }

    // Fetch and sort invoices by invoiceDate ASC (oldest first)
    const invoices = await db.select().from(supplierInvoicesTable)
      .where(and(
        inArray(supplierInvoicesTable.id, data.invoiceIds),
        eq(supplierInvoicesTable.organizationId, orgId),
        eq(supplierInvoicesTable.supplierId, data.supplierId),
      ))
      .orderBy(asc(supplierInvoicesTable.invoiceDate));
    if (!invoices.length) return res.status(400).json({ error: "Aucune facture trouvable" });

    let remaining = data.totalAmount;
    const created: any[] = [];
    const paidAt = data.paidAt ? new Date(data.paidAt) : new Date();
    const isConfirmed = (data.paymentStatus ?? "confirme") === "confirme";

    for (const inv of invoices) {
      if (remaining <= 0) break;
      const balance = toNum(inv.totalAmount) - toNum(inv.paidAmount);
      if (balance <= 0) continue;
      const payAmt = Math.min(remaining, balance);
      remaining -= payAmt;

      const [p] = await db.insert(supplierPaymentsTable).values({
        organizationId: orgId,
        supplierInvoiceId: inv.id,
        amount: String(payAmt),
        method: data.paymentMethod ?? "virement",
        reference: data.reference ?? null,
        status: data.paymentStatus ?? "confirme",
        bankAccountId: data.bankAccountId ?? null,
        paidAt,
        notes: data.notes ?? null,
      }).returning();
      created.push(p);

      if (isConfirmed) {
        const newPaid = toNum(inv.paidAmount) + payAmt;
        const newStatus = newPaid >= toNum(inv.totalAmount) ? "paid" : "partially_paid";
        await db.update(supplierInvoicesTable)
          .set({ paidAmount: String(newPaid), status: newStatus })
          .where(eq(supplierInvoicesTable.id, inv.id));
      }
    }

    return res.status(201).json({ payments: created, allocatedCount: created.length, remainingAmount: remaining });
  } catch (e: any) {
    req.log.error(e, "purchases/payments/multi POST");
    return res.status(500).json({ error: "Erreur lors des paiements groupés" });
  }
});

// Confirm a scheduled payment
router.patch("/purchases/payments/:id/confirm", requirePermission("purchases.pay"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const id = req.params.id as string;
    const [p] = await db.select().from(supplierPaymentsTable)
      .where(and(eq(supplierPaymentsTable.id, id), eq(supplierPaymentsTable.organizationId, orgId)));
    if (!p) return res.status(404).json({ error: "Paiement introuvable" });
    if (p.status === "confirme") return res.json(p);

    const [updated] = await db.update(supplierPaymentsTable).set({ status: "confirme" })
      .where(eq(supplierPaymentsTable.id, id)).returning();

    // Update invoice balance
    const [inv] = await db.select().from(supplierInvoicesTable)
      .where(eq(supplierInvoicesTable.id, p.supplierInvoiceId));
    if (inv) {
      const newPaid = toNum(inv.paidAmount) + toNum(p.amount);
      const newStatus = newPaid >= toNum(inv.totalAmount) ? "paid" : "partially_paid";
      await db.update(supplierInvoicesTable)
        .set({ paidAmount: String(newPaid), status: newStatus })
        .where(eq(supplierInvoicesTable.id, inv.id));
    }

    return res.json(updated);
  } catch (e: any) {
    req.log.error(e, "purchases/payments/:id/confirm PATCH");
    return res.status(500).json({ error: "Erreur lors de la confirmation" });
  }
});

// Get invoices linked to a PO
router.get("/purchases/purchase-orders/:id/invoices", requirePermission("purchases.read"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const id = req.params.id as string;
    const rows = await db.select({
      id: supplierInvoicesTable.id,
      referenceNumber: supplierInvoicesTable.referenceNumber,
      status: supplierInvoicesTable.status,
      invoiceDate: supplierInvoicesTable.invoiceDate,
      dueDate: supplierInvoicesTable.dueDate,
      totalAmount: supplierInvoicesTable.totalAmount,
      paidAmount: supplierInvoicesTable.paidAmount,
    }).from(supplierInvoicesTable)
      .where(and(eq(supplierInvoicesTable.purchaseOrderId, id), eq(supplierInvoicesTable.organizationId, orgId)))
      .orderBy(desc(supplierInvoicesTable.invoiceDate));
    return res.json({ data: rows });
  } catch (e: any) {
    req.log.error(e, "purchases/purchase-orders/:id/invoices GET");
    return res.status(500).json({ error: "Erreur lors de la récupération" });
  }
});

// Update line quantity received
router.patch("/purchases/purchase-orders/:id/lines/:lineId", requirePermission("purchases.write"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { id, lineId } = req.params as Record<string, string>;
    const Schema = z.object({ quantityReceived: z.coerce.number().min(0) });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides" });

    // Verify PO belongs to org
    const [po] = await db.select({ id: purchaseOrdersTable.id })
      .from(purchaseOrdersTable)
      .where(and(eq(purchaseOrdersTable.id, id), eq(purchaseOrdersTable.organizationId, orgId), isNull(purchaseOrdersTable.deletedAt)));
    if (!po) return res.status(404).json({ error: "Bon de commande introuvable" });

    const [updated] = await db.update(purchaseOrderLinesTable)
      .set({ quantityReceived: String(parsed.data.quantityReceived) })
      .where(and(eq(purchaseOrderLinesTable.id, lineId), eq(purchaseOrderLinesTable.purchaseOrderId, id), eq(purchaseOrderLinesTable.organizationId, orgId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Ligne introuvable" });

    // Auto-update PO status based on all lines
    const allLines = await db.select({ qty: purchaseOrderLinesTable.quantity, received: purchaseOrderLinesTable.quantityReceived })
      .from(purchaseOrderLinesTable)
      .where(and(eq(purchaseOrderLinesTable.purchaseOrderId, id), eq(purchaseOrderLinesTable.organizationId, orgId)));
    const totalQty = allLines.reduce((s, l) => s + toNum(l.qty), 0);
    const totalReceived = allLines.reduce((s, l) => s + toNum(l.received), 0);
    const newPoStatus = totalReceived >= totalQty ? "received" : totalReceived > 0 ? "partially_received" : undefined;
    if (newPoStatus) {
      await db.update(purchaseOrdersTable).set({ status: newPoStatus })
        .where(and(eq(purchaseOrdersTable.id, id), eq(purchaseOrdersTable.organizationId, orgId)));
    }

    return res.json(updated);
  } catch (e: any) {
    req.log.error(e, "purchases/purchase-orders/:id/lines/:lineId PATCH");
    return res.status(500).json({ error: "Erreur lors de la mise à jour de la ligne" });
  }
});

// ════════════════════════════════════════════════════════════════
// PRODUITS (pour sélecteur BC)
// ════════════════════════════════════════════════════════════════

router.get("/purchases/products", requirePermission("purchases.read"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { search, limit = "100" } = req.query as Record<string, string>;
    const conds = [eq(productsTable.organizationId, orgId), eq(productsTable.isActive, true)];
    if (search) conds.push(or(ilike(productsTable.name, `%${search}%`), ilike(productsTable.sku, `%${search}%`))!);
    const rows = await db.select({
      id: productsTable.id,
      name: productsTable.name,
      sku: productsTable.sku,
      purchasePriceFcfa: productsTable.purchasePriceFcfa,
      unit: productsTable.unit,
    }).from(productsTable).where(and(...conds)).orderBy(asc(productsTable.name)).limit(parseInt(limit));
    return res.json({ data: rows });
  } catch (e: any) {
    req.log.error(e, "purchases/products GET");
    return res.status(500).json({ error: "Erreur lors de la récupération des produits" });
  }
});

// ════════════════════════════════════════════════════════════════
// VUE D'ENSEMBLE (KPI)
// ════════════════════════════════════════════════════════════════

router.get("/purchases/overview", requirePermission("purchases.read"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + "-01";
    const weekEnd = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

    const [
      suppliersCount,
      invoiceStats,
      overdueCount,
      upcomingPayments,
      posPending,
      expensesSubmitted,
      urgentInvoices,
      recentPayments,
      recentPOs,
      recentExpenseApprovals,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(suppliersTable)
        .where(and(eq(suppliersTable.organizationId, orgId), eq(suppliersTable.isActive, true), isNull(suppliersTable.deletedAt))),
      db.select({
        status: supplierInvoicesTable.status,
        count: sql<number>`count(*)`,
        total: sql<number>`sum(${supplierInvoicesTable.totalAmount})`,
        paid: sql<number>`sum(${supplierInvoicesTable.paidAmount})`,
      }).from(supplierInvoicesTable)
        .where(eq(supplierInvoicesTable.organizationId, orgId))
        .groupBy(supplierInvoicesTable.status),
      db.select({ count: sql<number>`count(*)`, total: sql<number>`sum(${supplierInvoicesTable.totalAmount} - ${supplierInvoicesTable.paidAmount})` })
        .from(supplierInvoicesTable)
        .where(and(
          eq(supplierInvoicesTable.organizationId, orgId),
          sql`${supplierInvoicesTable.dueDate} < ${today}`,
          ne(supplierInvoicesTable.status, "paid"),
          ne(supplierInvoicesTable.status, "cancelled"),
        )),
      db.select({ count: sql<number>`count(*)`, total: sql<number>`sum(${supplierInvoicesTable.totalAmount} - ${supplierInvoicesTable.paidAmount})` })
        .from(supplierInvoicesTable)
        .where(and(
          eq(supplierInvoicesTable.organizationId, orgId),
          sql`${supplierInvoicesTable.dueDate} BETWEEN ${today} AND ${weekEnd}`,
          ne(supplierInvoicesTable.status, "paid"),
          ne(supplierInvoicesTable.status, "cancelled"),
        )),
      // BCs en attente (status = sent)
      db.select({ count: sql<number>`count(*)`, total: sql<number>`sum(${purchaseOrdersTable.totalFcfa})` })
        .from(purchaseOrdersTable)
        .where(and(eq(purchaseOrdersTable.organizationId, orgId), eq(purchaseOrdersTable.status, "sent"), isNull(purchaseOrdersTable.deletedAt))),
      // Notes de frais soumises
      db.select({ count: sql<number>`count(*)` }).from(expenseReportsTable)
        .where(and(eq(expenseReportsTable.organizationId, orgId), eq(expenseReportsTable.status, "submitted"))),
      // Factures urgentes (échues ou dues dans 7 jours)
      db.select({
        id: supplierInvoicesTable.id,
        referenceNumber: supplierInvoicesTable.referenceNumber,
        dueDate: supplierInvoicesTable.dueDate,
        totalAmount: supplierInvoicesTable.totalAmount,
        paidAmount: supplierInvoicesTable.paidAmount,
        status: supplierInvoicesTable.status,
        supplierName: suppliersTable.name,
      }).from(supplierInvoicesTable)
        .leftJoin(suppliersTable, and(eq(suppliersTable.id, supplierInvoicesTable.supplierId), eq(suppliersTable.organizationId, orgId)))
        .where(and(
          eq(supplierInvoicesTable.organizationId, orgId),
          sql`${supplierInvoicesTable.dueDate} <= ${weekEnd}`,
          ne(supplierInvoicesTable.status, "paid"),
          ne(supplierInvoicesTable.status, "cancelled"),
        ))
        .orderBy(asc(supplierInvoicesTable.dueDate))
        .limit(10),
      // Paiements récents
      db.select({
        id: supplierPaymentsTable.id,
        amount: supplierPaymentsTable.amount,
        paidAt: supplierPaymentsTable.paidAt,
        supplierName: suppliersTable.name,
        reference: supplierPaymentsTable.reference,
      }).from(supplierPaymentsTable)
        .leftJoin(supplierInvoicesTable, eq(supplierInvoicesTable.id, supplierPaymentsTable.supplierInvoiceId))
        .leftJoin(suppliersTable, and(eq(suppliersTable.id, supplierInvoicesTable.supplierId), eq(suppliersTable.organizationId, orgId)))
        .where(and(
          eq(supplierPaymentsTable.organizationId, orgId),
          ne(supplierPaymentsTable.status, "annule"),
        ))
        .orderBy(desc(supplierPaymentsTable.paidAt))
        .limit(5),
      // BCs confirmés récemment
      db.select({
        id: purchaseOrdersTable.id,
        reference: purchaseOrdersTable.reference,
        totalFcfa: purchaseOrdersTable.totalFcfa,
        updatedAt: purchaseOrdersTable.updatedAt,
        supplierName: suppliersTable.name,
      }).from(purchaseOrdersTable)
        .leftJoin(suppliersTable, and(eq(suppliersTable.id, purchaseOrdersTable.supplierId), eq(suppliersTable.organizationId, orgId)))
        .where(and(
          eq(purchaseOrdersTable.organizationId, orgId),
          eq(purchaseOrdersTable.status, "confirmed"),
          isNull(purchaseOrdersTable.deletedAt),
        ))
        .orderBy(desc(purchaseOrdersTable.updatedAt))
        .limit(3),
      // Notes de frais approuvées récemment
      db.select({
        id: expenseReportsTable.id,
        title: expenseReportsTable.title,
        totalAmount: expenseReportsTable.totalAmount,
        approvedAt: expenseReportsTable.approvedAt,
        firstName: collaboratorsTable.firstName,
        lastName: collaboratorsTable.lastName,
      }).from(expenseReportsTable)
        .leftJoin(collaboratorsTable, eq(collaboratorsTable.id, expenseReportsTable.collaboratorId))
        .where(and(
          eq(expenseReportsTable.organizationId, orgId),
          eq(expenseReportsTable.status, "approved"),
        ))
        .orderBy(desc(expenseReportsTable.approvedAt))
        .limit(3),
    ]);

    const byStatus: Record<string, { count: number; total: number; paid: number }> = {};
    invoiceStats.forEach(s => { byStatus[s.status] = { count: toNum(s.count), total: toNum(s.total), paid: toNum(s.paid) }; });

    const monthExpenses = Object.values(byStatus).reduce((s, v) => s + v.paid, 0);
    const totalUnpaid = Object.entries(byStatus)
      .filter(([k]) => !["paid", "cancelled"].includes(k))
      .reduce((s, [, v]) => s + v.total - v.paid, 0);

    const approvalsInvoiceCount = (byStatus["review"]?.count ?? 0) + (byStatus["awaiting_approval"]?.count ?? 0);

    const tunnel = [
      { label: "Reçues", status: "review", count: byStatus["review"]?.count ?? 0, amount: byStatus["review"]?.total ?? 0 },
      { label: "À approuver", status: "awaiting_approval", count: byStatus["awaiting_approval"]?.count ?? 0, amount: byStatus["awaiting_approval"]?.total ?? 0 },
      { label: "Approuvées", status: "approved", count: byStatus["approved"]?.count ?? 0, amount: byStatus["approved"]?.total ?? 0 },
      { label: "À payer", status: "pending", count: byStatus["pending"]?.count ?? 0, amount: byStatus["pending"]?.total ?? 0 },
      { label: "Part. payées", status: "partially_paid", count: byStatus["partially_paid"]?.count ?? 0, amount: byStatus["partially_paid"]?.total ?? 0 },
      { label: "Payées", status: "paid", count: byStatus["paid"]?.count ?? 0, amount: byStatus["paid"]?.total ?? 0 },
    ];

    return res.json({
      suppliersActive: toNum(suppliersCount[0]?.count),
      monthExpenses,
      totalUnpaid,
      overdueCount: toNum(overdueCount[0]?.count),
      overdueAmount: toNum(overdueCount[0]?.total),
      upcomingPaymentsCount: toNum(upcomingPayments[0]?.count),
      upcomingPaymentsAmount: toNum(upcomingPayments[0]?.total),
      approvalsInvoiceCount,
      posPendingCount: toNum(posPending[0]?.count),
      posPendingAmount: toNum(posPending[0]?.total),
      expensesSubmittedCount: toNum(expensesSubmitted[0]?.count),
      invoicesByStatus: byStatus,
      tunnel,
      urgentInvoices: urgentInvoices.map(r => ({
        ...r,
        totalAmount: toNum(r.totalAmount),
        paidAmount: toNum(r.paidAmount),
        balance: toNum(r.totalAmount) - toNum(r.paidAmount),
        isOverdue: r.dueDate != null && r.dueDate < today,
      })),
      recentActivity: [
        ...recentPayments.map(r => ({
          id: r.id,
          type: "payment" as const,
          amount: toNum(r.amount),
          eventAt: r.paidAt,
          label: `Paiement fournisseur`,
          sublabel: `${r.supplierName ?? "—"} · Réf. ${r.reference ?? "—"}`,
        })),
        ...recentPOs.map(r => ({
          id: r.id,
          type: "po_confirmed" as const,
          amount: toNum(r.totalFcfa),
          eventAt: r.updatedAt,
          label: `BC confirmé`,
          sublabel: `${r.supplierName ?? "—"} · ${r.reference}`,
        })),
        ...recentExpenseApprovals.map(r => ({
          id: r.id,
          type: "expense_approved" as const,
          amount: toNum(r.totalAmount),
          eventAt: r.approvedAt,
          label: `Note de frais approuvée`,
          sublabel: `${[r.firstName, r.lastName].filter(Boolean).join(" ") || "—"} · ${r.title}`,
        })),
      ]
        .filter(a => a.eventAt != null)
        .sort((a, b) => new Date(b.eventAt!).getTime() - new Date(a.eventAt!).getTime())
        .slice(0, 10),
    });
  } catch (e: any) {
    req.log.error(e, "purchases/overview GET");
    return res.status(500).json({ error: "Erreur lors du calcul des KPI" });
  }
});

// ════════════════════════════════════════════════════════════════
// RAPPORTS ACHATS
// ════════════════════════════════════════════════════════════════

// AP Aging: factures impayées par tranche d'échéance
router.get("/purchases/reports/aging", requirePermission("purchases.read"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const today = new Date().toISOString().slice(0, 10);
    const rows = await db.select({
      id: supplierInvoicesTable.id,
      referenceNumber: supplierInvoicesTable.referenceNumber,
      supplierId: supplierInvoicesTable.supplierId,
      supplierName: suppliersTable.name,
      dueDate: supplierInvoicesTable.dueDate,
      invoiceDate: supplierInvoicesTable.invoiceDate,
      totalAmount: supplierInvoicesTable.totalAmount,
      paidAmount: supplierInvoicesTable.paidAmount,
      status: supplierInvoicesTable.status,
    })
    .from(supplierInvoicesTable)
    .leftJoin(suppliersTable, and(eq(suppliersTable.id, supplierInvoicesTable.supplierId), eq(suppliersTable.organizationId, orgId)))
    .where(and(
      eq(supplierInvoicesTable.organizationId, orgId),
      ne(supplierInvoicesTable.status, "paid"),
      ne(supplierInvoicesTable.status, "cancelled"),
    ))
    .orderBy(asc(supplierInvoicesTable.dueDate));

    const todayMs = new Date(today).getTime();
    const buckets: Record<string, number> = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, over90: 0 };
    const bucketCounts: Record<string, number> = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, over90: 0 };
    const items = rows.map(r => {
      const balance = toNum(r.totalAmount) - toNum(r.paidAmount);
      let bucket = "current";
      if (r.dueDate) {
        const daysOverdue = Math.floor((todayMs - new Date(r.dueDate + "T00:00:00Z").getTime()) / 864e5);
        if (daysOverdue > 90) bucket = "over90";
        else if (daysOverdue > 60) bucket = "d61_90";
        else if (daysOverdue > 30) bucket = "d31_60";
        else if (daysOverdue > 0) bucket = "d1_30";
      }
      buckets[bucket] += balance;
      bucketCounts[bucket]++;
      return { ...r, balance, bucket, totalAmount: toNum(r.totalAmount), paidAmount: toNum(r.paidAmount) };
    });
    return res.json({ items, buckets, bucketCounts, total: items.reduce((s, i) => s + i.balance, 0) });
  } catch (e: any) {
    req.log.error(e, "purchases/reports/aging GET");
    return res.status(500).json({ error: "Erreur calcul vieillissement" });
  }
});

// Dépenses par période (12 derniers mois)
router.get("/purchases/reports/by-period", requirePermission("purchases.read"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { supplierId, periodFrom, periodTo, projectId, category } = req.query as Record<string, string>;

    const conds = [
      eq(supplierPaymentsTable.organizationId, orgId),
      ne(supplierPaymentsTable.status, "annule"),
      ne(supplierPaymentsTable.status, "echoue"),
    ];
    if (periodFrom) conds.push(sql`${supplierPaymentsTable.paidAt}::date >= ${periodFrom}::date`);
    else conds.push(sql`${supplierPaymentsTable.paidAt} >= NOW() - INTERVAL '12 months'`);
    if (periodTo) conds.push(sql`${supplierPaymentsTable.paidAt}::date <= ${periodTo}::date`);
    if (supplierId) conds.push(
      sql`EXISTS (SELECT 1 FROM supplier_invoices si WHERE si.id = ${supplierPaymentsTable.supplierInvoiceId} AND si.supplier_id = ${supplierId})`
    );
    if (projectId) conds.push(
      sql`EXISTS (SELECT 1 FROM supplier_invoices si WHERE si.id = ${supplierPaymentsTable.supplierInvoiceId} AND si.project_id = ${projectId})`
    );
    if (category) conds.push(
      sql`EXISTS (SELECT 1 FROM supplier_invoices si WHERE si.id = ${supplierPaymentsTable.supplierInvoiceId} AND si.category = ${category})`
    );

    const rows = await db.select({
      period: sql<string>`to_char(${supplierPaymentsTable.paidAt}, 'YYYY-MM')`,
      total: sql<number>`sum(${supplierPaymentsTable.amount})`,
      count: sql<number>`count(*)`,
    })
    .from(supplierPaymentsTable)
    .where(and(...conds))
    .groupBy(sql`to_char(${supplierPaymentsTable.paidAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${supplierPaymentsTable.paidAt}, 'YYYY-MM')`);
    return res.json({ data: rows.map(r => ({ period: r.period, total: toNum(r.total), count: toNum(r.count) })) });
  } catch (e: any) {
    req.log.error(e, "purchases/reports/by-period GET");
    return res.status(500).json({ error: "Erreur rapport par période" });
  }
});

// Top fournisseurs par montant facturé (aussi accessible via /by-vendor)
async function reportBySupplierHandler(req: any, res: any) {
  try {
    const orgId = req.authUser!.organizationId;
    const { limit: lim = "10" } = req.query as Record<string, string>;
    const rows = await db.select({
      supplierId: supplierInvoicesTable.supplierId,
      supplierName: suppliersTable.name,
      totalInvoiced: sql<number>`sum(${supplierInvoicesTable.totalAmount})`,
      totalPaid: sql<number>`sum(${supplierInvoicesTable.paidAmount})`,
      invoiceCount: sql<number>`count(*)`,
    })
    .from(supplierInvoicesTable)
    .leftJoin(suppliersTable, and(eq(suppliersTable.id, supplierInvoicesTable.supplierId), eq(suppliersTable.organizationId, orgId)))
    .where(and(eq(supplierInvoicesTable.organizationId, orgId), ne(supplierInvoicesTable.status, "cancelled")))
    .groupBy(supplierInvoicesTable.supplierId, suppliersTable.name)
    .orderBy(desc(sql`sum(${supplierInvoicesTable.totalAmount})`))
    .limit(parseInt(lim));
    return res.json({ data: rows.map(r => ({
      supplierId: r.supplierId,
      supplierName: r.supplierName ?? "—",
      totalInvoiced: toNum(r.totalInvoiced),
      totalPaid: toNum(r.totalPaid),
      balance: toNum(r.totalInvoiced) - toNum(r.totalPaid),
      invoiceCount: toNum(r.invoiceCount),
    })) });
  } catch (e: any) {
    req.log.error(e, "purchases/reports/by-supplier GET");
    return res.status(500).json({ error: "Erreur rapport par fournisseur" });
  }
}
router.get("/purchases/reports/by-supplier", requirePermission("purchases.read"), reportBySupplierHandler);
// alias contract
router.get("/purchases/reports/by-vendor", requirePermission("purchases.read"), reportBySupplierHandler);

// Approbations en attente — file unifiée (factures + BCs + notes de frais)
router.get("/purchases/approvals/pending", requirePermission("purchases.read"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const today = new Date().toISOString().slice(0, 10);

    const [invoiceRows, poRows, expenseRows] = await Promise.all([
      // Factures fournisseurs : review + awaiting_approval
      db.select({
        id: supplierInvoicesTable.id,
        referenceNumber: supplierInvoicesTable.referenceNumber,
        status: supplierInvoicesTable.status,
        invoiceDate: supplierInvoicesTable.invoiceDate,
        dueDate: supplierInvoicesTable.dueDate,
        totalAmount: supplierInvoicesTable.totalAmount,
        paidAmount: supplierInvoicesTable.paidAmount,
        notes: supplierInvoicesTable.notes,
        supplierId: supplierInvoicesTable.supplierId,
        supplierName: suppliersTable.name,
        createdAt: supplierInvoicesTable.createdAt,
      })
      .from(supplierInvoicesTable)
      .leftJoin(suppliersTable, and(eq(suppliersTable.id, supplierInvoicesTable.supplierId), eq(suppliersTable.organizationId, orgId)))
      .where(and(
        eq(supplierInvoicesTable.organizationId, orgId),
        or(eq(supplierInvoicesTable.status, "review"), eq(supplierInvoicesTable.status, "awaiting_approval")),
      ))
      .orderBy(asc(supplierInvoicesTable.createdAt)),

      // Bons de commande en attente (status = sent, nécessitent confirmation manager)
      db.select({
        id: purchaseOrdersTable.id,
        reference: purchaseOrdersTable.reference,
        status: purchaseOrdersTable.status,
        orderDate: purchaseOrdersTable.orderDate,
        expectedDate: purchaseOrdersTable.expectedDate,
        totalFcfa: purchaseOrdersTable.totalFcfa,
        notes: purchaseOrdersTable.notes,
        supplierId: purchaseOrdersTable.supplierId,
        supplierName: suppliersTable.name,
        createdAt: purchaseOrdersTable.createdAt,
      })
      .from(purchaseOrdersTable)
      .leftJoin(suppliersTable, and(eq(suppliersTable.id, purchaseOrdersTable.supplierId), eq(suppliersTable.organizationId, orgId)))
      .where(and(
        eq(purchaseOrdersTable.organizationId, orgId),
        eq(purchaseOrdersTable.status, "sent"),
        isNull(purchaseOrdersTable.deletedAt),
      ))
      .orderBy(asc(purchaseOrdersTable.createdAt)),

      // Notes de frais soumises
      db.select({
        id: expenseReportsTable.id,
        title: expenseReportsTable.title,
        status: expenseReportsTable.status,
        totalAmount: expenseReportsTable.totalAmount,
        collaboratorId: expenseReportsTable.collaboratorId,
        submittedAt: expenseReportsTable.submittedAt,
        createdAt: expenseReportsTable.createdAt,
        firstName: collaboratorsTable.firstName,
        lastName: collaboratorsTable.lastName,
      })
      .from(expenseReportsTable)
      .leftJoin(collaboratorsTable, eq(collaboratorsTable.id, expenseReportsTable.collaboratorId))
      .where(and(
        eq(expenseReportsTable.organizationId, orgId),
        eq(expenseReportsTable.status, "submitted"),
      ))
      .orderBy(asc(expenseReportsTable.createdAt)),
    ]);

    return res.json({
      invoices: invoiceRows.map(r => ({
        ...r,
        totalAmount: toNum(r.totalAmount),
        paidAmount: toNum(r.paidAmount),
        balance: toNum(r.totalAmount) - toNum(r.paidAmount),
        isOverdue: r.dueDate != null && r.dueDate < today,
      })),
      purchaseOrders: poRows.map(r => ({
        ...r,
        totalFcfa: toNum(r.totalFcfa),
      })),
      expenseReports: expenseRows.map(r => ({
        ...r,
        totalAmount: toNum(r.totalAmount),
        collaboratorName: [r.firstName, r.lastName].filter(Boolean).join(" ") || "—",
      })),
      total: invoiceRows.length + poRows.length + expenseRows.length,
    });
  } catch (e: any) {
    req.log.error(e, "purchases/approvals/pending GET");
    return res.status(500).json({ error: "Erreur récupération approbations" });
  }
});

// ════════════════════════════════════════════════════════════════
// DÉPENSES — VUE MANAGER (expense_reports toutes équipes)
// ════════════════════════════════════════════════════════════════

router.get("/purchases/expenses", requirePermission("purchases.read"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { status, collaboratorId, periodFrom, periodTo, category, limit: lim = "50", offset: off = "0" } = req.query as Record<string, string>;

    const conds = [eq(expenseReportsTable.organizationId, orgId)];
    if (status) conds.push(eq(expenseReportsTable.status, status));
    if (collaboratorId) conds.push(eq(expenseReportsTable.collaboratorId, collaboratorId));
    if (periodFrom) conds.push(sql`${expenseReportsTable.createdAt}::date >= ${periodFrom}::date`);
    if (periodTo) conds.push(sql`${expenseReportsTable.createdAt}::date <= ${periodTo}::date`);
    if (category) conds.push(
      sql`EXISTS (SELECT 1 FROM expense_items ei WHERE ei.expense_report_id = ${expenseReportsTable.id} AND ei.category = ${category})`
    );

    const [rows, countResult] = await Promise.all([
      db.select({
        id: expenseReportsTable.id,
        title: expenseReportsTable.title,
        status: expenseReportsTable.status,
        totalAmount: expenseReportsTable.totalAmount,
        collaboratorId: expenseReportsTable.collaboratorId,
        submittedAt: expenseReportsTable.submittedAt,
        approvedAt: expenseReportsTable.approvedAt,
        paidAt: expenseReportsTable.paidAt,
        notes: expenseReportsTable.notes,
        createdAt: expenseReportsTable.createdAt,
        firstName: collaboratorsTable.firstName,
        lastName: collaboratorsTable.lastName,
        department: collaboratorsTable.department,
      })
      .from(expenseReportsTable)
      .leftJoin(collaboratorsTable, eq(collaboratorsTable.id, expenseReportsTable.collaboratorId))
      .where(and(...conds))
      .orderBy(desc(expenseReportsTable.createdAt))
      .limit(parseInt(lim))
      .offset(parseInt(off)),
      db.select({ count: sql<number>`count(*)` }).from(expenseReportsTable).where(and(...conds)),
    ]);

    return res.json({
      data: rows.map(r => ({
        ...r,
        totalAmount: toNum(r.totalAmount),
        collaboratorName: [r.firstName, r.lastName].filter(Boolean).join(" ") || "—",
      })),
      total: toNum(countResult[0]?.count),
    });
  } catch (e: any) {
    req.log.error(e, "purchases/expenses GET");
    return res.status(500).json({ error: "Erreur récupération dépenses" });
  }
});

router.get("/purchases/expenses/:id", requirePermission("purchases.read"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const id = req.params.id as string;
    const [report] = await db.select({
      id: expenseReportsTable.id,
      title: expenseReportsTable.title,
      status: expenseReportsTable.status,
      totalAmount: expenseReportsTable.totalAmount,
      collaboratorId: expenseReportsTable.collaboratorId,
      submittedAt: expenseReportsTable.submittedAt,
      approvedAt: expenseReportsTable.approvedAt,
      paidAt: expenseReportsTable.paidAt,
      notes: expenseReportsTable.notes,
      createdAt: expenseReportsTable.createdAt,
      firstName: collaboratorsTable.firstName,
      lastName: collaboratorsTable.lastName,
      department: collaboratorsTable.department,
    })
    .from(expenseReportsTable)
    .leftJoin(collaboratorsTable, eq(collaboratorsTable.id, expenseReportsTable.collaboratorId))
    .where(and(eq(expenseReportsTable.id, id), eq(expenseReportsTable.organizationId, orgId)));
    if (!report) return res.status(404).json({ error: "Note de frais introuvable" });

    const items = await db.select().from(expenseItemsTable).where(eq(expenseItemsTable.expenseReportId, id));
    return res.json({ ...report, totalAmount: toNum(report.totalAmount), collaboratorName: [report.firstName, report.lastName].filter(Boolean).join(" ") || "—", items });
  } catch (e: any) {
    req.log.error(e, "purchases/expenses/:id GET");
    return res.status(500).json({ error: "Erreur récupération note de frais" });
  }
});

router.patch("/purchases/expenses/:id/status", requirePermission("purchases.write"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const id = req.params.id as string;
    const { status, rejectionReason } = z.object({
      status: z.enum(["approved", "rejected", "paid"]),
      rejectionReason: z.string().optional(),
    }).parse(req.body);

    const now = new Date().toISOString();
    const [updated] = await db.update(expenseReportsTable)
      .set({
        status,
        ...(status === "approved" ? { approvedAt: now } : {}),
        ...(status === "paid" ? { paidAt: now } : {}),
        ...(status === "rejected" && rejectionReason ? { notes: rejectionReason } : {}),
      })
      .where(and(eq(expenseReportsTable.id, id), eq(expenseReportsTable.organizationId, orgId)))
      .returning({ id: expenseReportsTable.id, status: expenseReportsTable.status });
    if (!updated) return res.status(404).json({ error: "Note de frais introuvable" });
    return res.json(updated);
  } catch (e: any) {
    req.log.error(e, "purchases/expenses/:id/status PATCH");
    return res.status(400).json({ error: e?.message ?? "Erreur mise à jour" });
  }
});

// ════════════════════════════════════════════════════════════════
// DÉPENSES — CRUD COMPLET
// ════════════════════════════════════════════════════════════════

const ExpenseReportCreateSchema = z.object({
  collaboratorId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  periodStart: z.string().optional().nullable(),
  periodEnd: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(["draft", "submitted"]).optional().default("draft"),
});

const ExpenseItemCreateSchema = z.object({
  category: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default("XOF"),
  expenseDate: z.string(),
  receiptUrl: z.string().optional().nullable(),
  isBillable: z.boolean().optional().default(false),
  projectId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Helper: recalculate and persist totalAmount for a report
async function recalcExpenseTotal(reportId: string) {
  const [res] = await db.select({ total: sql<number>`coalesce(sum(${expenseItemsTable.amount}), 0)` })
    .from(expenseItemsTable).where(eq(expenseItemsTable.expenseReportId, reportId));
  await db.update(expenseReportsTable).set({ totalAmount: String(res?.total ?? 0) })
    .where(eq(expenseReportsTable.id, reportId));
}

// POST — créer une note de frais
router.post("/purchases/expenses", requirePermission("purchases.write"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const parsed = ExpenseReportCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides" });
    const d = parsed.data;

    const [report] = await db.insert(expenseReportsTable).values({
      organizationId: orgId,
      collaboratorId: d.collaboratorId,
      title: d.title,
      description: d.description ?? null,
      status: d.status ?? "draft",
      periodStart: d.periodStart ?? null,
      periodEnd: d.periodEnd ?? null,
      notes: d.notes ?? null,
      totalAmount: "0",
      currency: "XOF",
      ...(d.status === "submitted" ? { submittedAt: new Date() } : {}),
    }).returning();
    return res.status(201).json(report);
  } catch (e: any) {
    req.log.error(e, "purchases/expenses POST");
    return res.status(500).json({ error: "Erreur création note de frais" });
  }
});

// PUT — modifier l'en-tête d'une note de frais
router.put("/purchases/expenses/:id", requirePermission("purchases.write"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const id = req.params.id as string;
    const UpdateSchema = ExpenseReportCreateSchema.partial();
    const parsed = UpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides" });
    const d = parsed.data;

    const setFields: Record<string, unknown> = {};
    if (d.title !== undefined) setFields.title = d.title;
    if (d.description !== undefined) setFields.description = d.description;
    if (d.periodStart !== undefined) setFields.periodStart = d.periodStart;
    if (d.periodEnd !== undefined) setFields.periodEnd = d.periodEnd;
    if (d.notes !== undefined) setFields.notes = d.notes;
    if (d.status !== undefined) {
      setFields.status = d.status;
      if (d.status === "submitted") setFields.submittedAt = new Date();
    }

    const [updated] = await db.update(expenseReportsTable)
      .set(setFields as any)
      .where(and(eq(expenseReportsTable.id, id), eq(expenseReportsTable.organizationId, orgId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Note de frais introuvable" });
    return res.json(updated);
  } catch (e: any) {
    req.log.error(e, "purchases/expenses/:id PUT");
    return res.status(500).json({ error: "Erreur mise à jour note de frais" });
  }
});

// DELETE — supprimer une note de frais (uniquement si draft)
router.delete("/purchases/expenses/:id", requirePermission("purchases.write"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const id = req.params.id as string;
    const [report] = await db.select({ id: expenseReportsTable.id, status: expenseReportsTable.status })
      .from(expenseReportsTable).where(and(eq(expenseReportsTable.id, id), eq(expenseReportsTable.organizationId, orgId)));
    if (!report) return res.status(404).json({ error: "Note de frais introuvable" });
    if (report.status !== "draft") return res.status(400).json({ error: "Seules les notes de frais en brouillon peuvent être supprimées" });
    await db.delete(expenseReportsTable).where(eq(expenseReportsTable.id, id));
    return res.status(204).end();
  } catch (e: any) {
    req.log.error(e, "purchases/expenses/:id DELETE");
    return res.status(500).json({ error: "Erreur suppression note de frais" });
  }
});

// POST — ajouter une ligne de frais
router.post("/purchases/expenses/:id/items", requirePermission("purchases.write"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const id = req.params.id as string;
    const [report] = await db.select({ id: expenseReportsTable.id, status: expenseReportsTable.status })
      .from(expenseReportsTable).where(and(eq(expenseReportsTable.id, id), eq(expenseReportsTable.organizationId, orgId)));
    if (!report) return res.status(404).json({ error: "Note de frais introuvable" });
    if (report.status !== "draft") return res.status(400).json({ error: "Impossible de modifier une note soumise ou approuvée" });

    const parsed = ExpenseItemCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides" });
    const d = parsed.data;
    const [item] = await db.insert(expenseItemsTable).values({
      expenseReportId: id,
      category: d.category,
      description: d.description,
      amount: String(d.amount),
      currency: d.currency,
      expenseDate: d.expenseDate,
      receiptUrl: d.receiptUrl ?? null,
      isBillable: d.isBillable ?? false,
      projectId: d.projectId ?? null,
      notes: d.notes ?? null,
    }).returning();
    await recalcExpenseTotal(id);
    return res.status(201).json(item);
  } catch (e: any) {
    req.log.error(e, "purchases/expenses/:id/items POST");
    return res.status(500).json({ error: "Erreur ajout ligne de frais" });
  }
});

// PUT — modifier une ligne de frais
router.put("/purchases/expenses/:id/items/:itemId", requirePermission("purchases.write"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { id, itemId } = req.params as Record<string, string>;
    const [report] = await db.select({ id: expenseReportsTable.id, status: expenseReportsTable.status })
      .from(expenseReportsTable).where(and(eq(expenseReportsTable.id, id), eq(expenseReportsTable.organizationId, orgId)));
    if (!report) return res.status(404).json({ error: "Note de frais introuvable" });
    if (report.status !== "draft") return res.status(400).json({ error: "Impossible de modifier une note soumise ou approuvée" });

    const parsed = ExpenseItemCreateSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides" });
    const d = parsed.data;
    const setFields: Record<string, unknown> = {};
    if (d.category !== undefined) setFields.category = d.category;
    if (d.description !== undefined) setFields.description = d.description;
    if (d.amount !== undefined) setFields.amount = String(d.amount);
    if (d.expenseDate !== undefined) setFields.expenseDate = d.expenseDate;
    if (d.receiptUrl !== undefined) setFields.receiptUrl = d.receiptUrl;
    if (d.isBillable !== undefined) setFields.isBillable = d.isBillable;
    if (d.projectId !== undefined) setFields.projectId = d.projectId;
    if (d.notes !== undefined) setFields.notes = d.notes;

    const [item] = await db.update(expenseItemsTable).set(setFields as any)
      .where(and(eq(expenseItemsTable.id, itemId), eq(expenseItemsTable.expenseReportId, id)))
      .returning();
    if (!item) return res.status(404).json({ error: "Ligne de frais introuvable" });
    await recalcExpenseTotal(id);
    return res.json(item);
  } catch (e: any) {
    req.log.error(e, "purchases/expenses/:id/items/:itemId PUT");
    return res.status(500).json({ error: "Erreur mise à jour ligne de frais" });
  }
});

// DELETE — supprimer une ligne de frais
router.delete("/purchases/expenses/:id/items/:itemId", requirePermission("purchases.write"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { id, itemId } = req.params as Record<string, string>;
    const [report] = await db.select({ id: expenseReportsTable.id, status: expenseReportsTable.status })
      .from(expenseReportsTable).where(and(eq(expenseReportsTable.id, id), eq(expenseReportsTable.organizationId, orgId)));
    if (!report) return res.status(404).json({ error: "Note de frais introuvable" });
    if (report.status !== "draft") return res.status(400).json({ error: "Impossible de modifier une note soumise ou approuvée" });
    await db.delete(expenseItemsTable).where(and(eq(expenseItemsTable.id, itemId), eq(expenseItemsTable.expenseReportId, id)));
    await recalcExpenseTotal(id);
    return res.status(204).end();
  } catch (e: any) {
    req.log.error(e, "purchases/expenses/:id/items/:itemId DELETE");
    return res.status(500).json({ error: "Erreur suppression ligne de frais" });
  }
});

// ════════════════════════════════════════════════════════════════
// RAPPORT FACTURES IMPAYÉES
// ════════════════════════════════════════════════════════════════

router.get("/purchases/reports/unpaid", requirePermission("purchases.read"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const today = new Date().toISOString().slice(0, 10);
    const { supplierId, dateFrom, dateTo } = req.query as Record<string, string>;

    const conds = [
      eq(supplierInvoicesTable.organizationId, orgId),
      ne(supplierInvoicesTable.status, "paid"),
      ne(supplierInvoicesTable.status, "cancelled"),
    ];
    if (supplierId) conds.push(eq(supplierInvoicesTable.supplierId, supplierId));
    if (dateFrom) conds.push(sql`${supplierInvoicesTable.dueDate}::date >= ${dateFrom}::date`);
    if (dateTo) conds.push(sql`${supplierInvoicesTable.dueDate}::date <= ${dateTo}::date`);

    const rows = await db.select({
      id: supplierInvoicesTable.id,
      referenceNumber: supplierInvoicesTable.referenceNumber,
      invoiceDate: supplierInvoicesTable.invoiceDate,
      dueDate: supplierInvoicesTable.dueDate,
      totalAmount: supplierInvoicesTable.totalAmount,
      paidAmount: supplierInvoicesTable.paidAmount,
      status: supplierInvoicesTable.status,
      supplierId: supplierInvoicesTable.supplierId,
      supplierName: suppliersTable.name,
      createdAt: supplierInvoicesTable.createdAt,
    })
    .from(supplierInvoicesTable)
    .leftJoin(suppliersTable, and(eq(suppliersTable.id, supplierInvoicesTable.supplierId), eq(suppliersTable.organizationId, orgId)))
    .where(and(...conds))
    .orderBy(asc(supplierInvoicesTable.dueDate));

    const items = rows.map(r => ({
      ...r,
      totalAmount: toNum(r.totalAmount),
      paidAmount: toNum(r.paidAmount),
      balance: toNum(r.totalAmount) - toNum(r.paidAmount),
      isOverdue: r.dueDate != null && r.dueDate < today,
      daysOverdue: r.dueDate ? Math.floor((Date.now() - new Date(r.dueDate + "T00:00:00Z").getTime()) / 864e5) : 0,
    }));
    return res.json({ data: items, total: items.length, totalBalance: items.reduce((s, i) => s + i.balance, 0) });
  } catch (e: any) {
    req.log.error(e, "purchases/reports/unpaid GET");
    return res.status(500).json({ error: "Erreur rapport impayées" });
  }
});

// ════════════════════════════════════════════════════════════════
// EXPORTS EXCEL — RAPPORTS ACHATS
// ════════════════════════════════════════════════════════════════

router.get("/purchases/reports/:type/export.xlsx", requirePermission("purchases.read"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const type = req.params.type as string;
    const today = new Date().toISOString().slice(0, 10);
    const [org] = await db.select({ name: organizationsTable.name }).from(organizationsTable).where(eq(organizationsTable.id, orgId));
    const orgName = org?.name ?? "Organisation";

    const titles: Record<string, string> = {
      aging: "Vieillissement AP",
      "by-supplier": "Top Fournisseurs",
      unpaid: "Factures Impayées",
      "by-period": "Dépenses par Période",
    };
    if (!titles[type]) return res.status(400).json({ error: "Type d'export inconnu" });

    const builder = new ExcelReportBuilder({
      orgName,
      period: { from: new Date(new Date().getFullYear(), 0, 1), to: new Date() },
      reportTitle: titles[type]!,
    });
    builder.addCoverSheet("Rapport Achats");

    if (type === "aging" || type === "unpaid") {
      const dbRows = await db.select({
        referenceNumber: supplierInvoicesTable.referenceNumber,
        invoiceDate: supplierInvoicesTable.invoiceDate,
        dueDate: supplierInvoicesTable.dueDate,
        totalAmount: supplierInvoicesTable.totalAmount,
        paidAmount: supplierInvoicesTable.paidAmount,
        status: supplierInvoicesTable.status,
        supplierName: suppliersTable.name,
      })
      .from(supplierInvoicesTable)
      .leftJoin(suppliersTable, and(eq(suppliersTable.id, supplierInvoicesTable.supplierId), eq(suppliersTable.organizationId, orgId)))
      .where(and(
        eq(supplierInvoicesTable.organizationId, orgId),
        ne(supplierInvoicesTable.status, "paid"),
        ne(supplierInvoicesTable.status, "cancelled"),
      ))
      .orderBy(asc(supplierInvoicesTable.dueDate));

      builder.addDataSheet({
        name: type === "aging" ? "Vieillissement AP" : "Factures Impayées",
        tabColor: "F37021",
        cols: [
          { header: "Référence", key: "referenceNumber", width: 20, format: "text" },
          { header: "Fournisseur", key: "supplierName", width: 28, format: "text" },
          { header: "Date facture", key: "invoiceDate", width: 16, format: "text" },
          { header: "Échéance", key: "dueDate", width: 16, format: "text" },
          { header: "Montant TTC", key: "totalAmount", width: 18, format: "money" },
          { header: "Déjà payé", key: "paidAmount", width: 18, format: "money" },
          { header: "Solde dû", key: "balance", width: 18, format: "money" },
          { header: "Statut", key: "status", width: 18, format: "text" },
          { header: "Jours échus", key: "daysOverdue", width: 14, format: "number" },
        ],
        rows: dbRows.map(r => {
          const balance = toNum(r.totalAmount) - toNum(r.paidAmount);
          const days = r.dueDate ? Math.max(0, Math.floor((Date.now() - new Date(r.dueDate + "T00:00:00Z").getTime()) / 864e5)) : 0;
          return [r.referenceNumber ?? "—", r.supplierName ?? "—", r.invoiceDate ?? "—", r.dueDate ?? "—", toNum(r.totalAmount), toNum(r.paidAmount), balance, r.status, days];
        }),
        totalsRow: true,
      });
    } else if (type === "by-supplier") {
      const dbRows = await db.select({
        supplierName: suppliersTable.name,
        totalInvoiced: sql<number>`sum(${supplierInvoicesTable.totalAmount})`,
        totalPaid: sql<number>`sum(${supplierInvoicesTable.paidAmount})`,
        invoiceCount: sql<number>`count(*)`,
      })
      .from(supplierInvoicesTable)
      .leftJoin(suppliersTable, and(eq(suppliersTable.id, supplierInvoicesTable.supplierId), eq(suppliersTable.organizationId, orgId)))
      .where(and(eq(supplierInvoicesTable.organizationId, orgId), ne(supplierInvoicesTable.status, "cancelled")))
      .groupBy(supplierInvoicesTable.supplierId, suppliersTable.name)
      .orderBy(desc(sql`sum(${supplierInvoicesTable.totalAmount})`));

      builder.addDataSheet({
        name: "Top Fournisseurs",
        tabColor: "3b82f6",
        cols: [
          { header: "Fournisseur", key: "supplierName", width: 32, format: "text" },
          { header: "Nb factures", key: "invoiceCount", width: 14, format: "number" },
          { header: "Total facturé", key: "totalInvoiced", width: 20, format: "money" },
          { header: "Total payé", key: "totalPaid", width: 20, format: "money" },
          { header: "Solde", key: "balance", width: 20, format: "money" },
        ],
        rows: dbRows.map(r => [
          r.supplierName ?? "—",
          toNum(r.invoiceCount),
          toNum(r.totalInvoiced),
          toNum(r.totalPaid),
          toNum(r.totalInvoiced) - toNum(r.totalPaid),
        ]),
        totalsRow: true,
      });
    } else {
      // by-period
      const dbRows = await db.select({
        period: sql<string>`to_char(${supplierPaymentsTable.paidAt}, 'YYYY-MM')`,
        total: sql<number>`sum(${supplierPaymentsTable.amount})`,
        count: sql<number>`count(*)`,
      })
      .from(supplierPaymentsTable)
      .where(and(
        eq(supplierPaymentsTable.organizationId, orgId),
        ne(supplierPaymentsTable.status, "annule"),
        ne(supplierPaymentsTable.status, "echoue"),
        sql`${supplierPaymentsTable.paidAt} >= NOW() - INTERVAL '12 months'`,
      ))
      .groupBy(sql`to_char(${supplierPaymentsTable.paidAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${supplierPaymentsTable.paidAt}, 'YYYY-MM')`);

      builder.addDataSheet({
        name: "Dépenses par Période",
        tabColor: "22c55e",
        cols: [
          { header: "Période", key: "period", width: 14, format: "text" },
          { header: "Nb paiements", key: "count", width: 14, format: "number" },
          { header: "Total décaissé", key: "total", width: 20, format: "money" },
        ],
        rows: dbRows.map(r => [r.period ?? "—", toNum(r.count), toNum(r.total)]),
        totalsRow: true,
      });
    }

    const filename = `purchases-${type}-${today}.xlsx`;
    await builder.send(res, filename);
  } catch (e: any) {
    req.log.error(e, "purchases/reports/:type/export.xlsx GET");
    if (!res.headersSent) return res.status(500).json({ error: "Erreur génération Excel" });
  }
});

// ════════════════════════════════════════════════════════════════
// PURCHASES SETTINGS — seuil d'approbation
// ════════════════════════════════════════════════════════════════

const DEFAULT_THRESHOLD = 500_000;

router.get("/purchases/settings/threshold", requirePermission("purchases.read"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [row] = await db.select({ config: organizationModulesTable.config })
      .from(organizationModulesTable)
      .where(and(eq(organizationModulesTable.organizationId, orgId), eq(organizationModulesTable.moduleKey, "purchases")));
    const cfg = row?.config as Record<string, unknown> | null | undefined;
    const threshold = typeof cfg?.approvalThreshold === "number" ? cfg.approvalThreshold : DEFAULT_THRESHOLD;
    return res.json({ approvalThreshold: threshold });
  } catch (e: any) {
    req.log.error(e, "purchases/settings/threshold GET");
    return res.status(500).json({ error: "Erreur lecture seuil" });
  }
});

router.put("/purchases/settings/threshold", requirePermission("purchases.manage"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { approvalThreshold } = z.object({ approvalThreshold: z.number().min(0) }).parse(req.body);
    await db.insert(organizationModulesTable)
      .values({ organizationId: orgId, moduleKey: "purchases", config: { approvalThreshold } as Record<string, unknown> })
      .onConflictDoUpdate({
        target: [organizationModulesTable.organizationId, organizationModulesTable.moduleKey],
        set: { config: sql`COALESCE(${organizationModulesTable.config}, '{}'::jsonb) || ${JSON.stringify({ approvalThreshold })}::jsonb` },
      });
    return res.json({ approvalThreshold });
  } catch (e: any) {
    req.log.error(e, "purchases/settings/threshold PUT");
    if (!res.headersSent) return res.status(400).json({ error: "Paramètre invalide" });
  }
});

// ════════════════════════════════════════════════════════════════
// ALIAS EXPORT ROUTES — contrat /reports/export/:type.{xlsx,csv}
// ════════════════════════════════════════════════════════════════

// .xlsx — alias vers le handler existant
router.get("/purchases/reports/export/:type.xlsx", requirePermission("purchases.read"), async (req, res) => {
  // Re-route internally by forwarding to the canonical route handler
  req.params.type = req.params.type as string;
  // Reuse the same logic by calling the URL directly would need an internal redirect.
  // Instead: inline the dispatch — just set a synthetic param and fall through.
  (req as any).url = req.url.replace("/reports/export/", "/reports/").replace(".xlsx", "") + "/export.xlsx";
  res.redirect(307, `/api/purchases/reports/${req.params.type}/export.xlsx?token=${(req.query as any).token ?? ""}`);
});

// .csv — serveur (données brutes sans formatage Excel)
router.get("/purchases/reports/export/:type.csv", requirePermission("purchases.read"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const type = req.params.type as string;
    const today = new Date().toISOString().slice(0, 10);

    const validTypes: Record<string, string> = {
      aging: "vieillissement-ap",
      unpaid: "factures-impayees",
      "by-supplier": "top-fournisseurs",
      "by-period": "depenses-par-periode",
    };
    if (!validTypes[type]) return res.status(400).json({ error: "Type d'export inconnu" });

    let headers: string[] = [];
    let rows: (string | number | null)[][] = [];

    if (type === "aging" || type === "unpaid") {
      const dbRows = await db.select({
        referenceNumber: supplierInvoicesTable.referenceNumber,
        supplierName: suppliersTable.name,
        invoiceDate: supplierInvoicesTable.invoiceDate,
        dueDate: supplierInvoicesTable.dueDate,
        totalAmount: supplierInvoicesTable.totalAmount,
        paidAmount: supplierInvoicesTable.paidAmount,
        status: supplierInvoicesTable.status,
      })
      .from(supplierInvoicesTable)
      .leftJoin(suppliersTable, and(eq(suppliersTable.id, supplierInvoicesTable.supplierId), eq(suppliersTable.organizationId, orgId)))
      .where(and(eq(supplierInvoicesTable.organizationId, orgId), ne(supplierInvoicesTable.status, "paid"), ne(supplierInvoicesTable.status, "cancelled")))
      .orderBy(asc(supplierInvoicesTable.dueDate));
      headers = ["Référence", "Fournisseur", "Date facture", "Échéance", "Montant TTC", "Déjà payé", "Solde dû", "Statut"];
      rows = dbRows.map(r => [
        r.referenceNumber ?? "—", r.supplierName ?? "—", r.invoiceDate ?? "—", r.dueDate ?? "—",
        toNum(r.totalAmount), toNum(r.paidAmount), toNum(r.totalAmount) - toNum(r.paidAmount), r.status,
      ]);
    } else if (type === "by-supplier") {
      const dbRows = await db.select({
        supplierName: suppliersTable.name,
        invoiceCount: sql<number>`count(*)`,
        totalInvoiced: sql<number>`sum(${supplierInvoicesTable.totalAmount})`,
        totalPaid: sql<number>`sum(${supplierInvoicesTable.paidAmount})`,
      })
      .from(supplierInvoicesTable)
      .leftJoin(suppliersTable, and(eq(suppliersTable.id, supplierInvoicesTable.supplierId), eq(suppliersTable.organizationId, orgId)))
      .where(and(eq(supplierInvoicesTable.organizationId, orgId), ne(supplierInvoicesTable.status, "cancelled")))
      .groupBy(supplierInvoicesTable.supplierId, suppliersTable.name)
      .orderBy(desc(sql`sum(${supplierInvoicesTable.totalAmount})`));
      headers = ["Fournisseur", "Nb factures", "Total facturé", "Total payé", "Solde"];
      rows = dbRows.map(r => [r.supplierName ?? "—", toNum(r.invoiceCount), toNum(r.totalInvoiced), toNum(r.totalPaid), toNum(r.totalInvoiced) - toNum(r.totalPaid)]);
    } else {
      const dbRows = await db.select({
        period: sql<string>`to_char(${supplierPaymentsTable.paidAt}, 'YYYY-MM')`,
        total: sql<number>`sum(${supplierPaymentsTable.amount})`,
        count: sql<number>`count(*)`,
      })
      .from(supplierPaymentsTable)
      .where(and(eq(supplierPaymentsTable.organizationId, orgId), ne(supplierPaymentsTable.status, "annule"), ne(supplierPaymentsTable.status, "echoue"), sql`${supplierPaymentsTable.paidAt} >= NOW() - INTERVAL '12 months'`))
      .groupBy(sql`to_char(${supplierPaymentsTable.paidAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${supplierPaymentsTable.paidAt}, 'YYYY-MM')`);
      headers = ["Période", "Nb paiements", "Total décaissé"];
      rows = dbRows.map(r => [r.period ?? "—", toNum(r.count), toNum(r.total)]);
    }

    const bom = "\uFEFF";
    const csvContent = bom + [headers, ...rows]
      .map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="purchases-${validTypes[type]}-${today}.csv"`);
    return res.send(csvContent);
  } catch (e: any) {
    req.log.error(e, "purchases/reports/export/:type.csv GET");
    return res.status(500).json({ error: "Erreur génération CSV" });
  }
});

export default router;

