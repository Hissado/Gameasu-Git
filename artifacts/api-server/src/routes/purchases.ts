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
import { and, asc, desc, eq, ilike, isNull, or, sql, inArray, ne } from "drizzle-orm";
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
    let statusHistoryAppend: Array<{ from: string; to: string; at: string; userId: string }> = [];
    if (data.status !== undefined) {
      const [current] = await db.select({ status: supplierInvoicesTable.status, statusHistory: supplierInvoicesTable.statusHistory })
        .from(supplierInvoicesTable)
        .where(and(eq(supplierInvoicesTable.id, id), eq(supplierInvoicesTable.organizationId, orgId)))
        .limit(1);
      if (current && current.status !== data.status) {
        const existing = (current.statusHistory as Array<{ from: string; to: string; at: string; userId: string }>) ?? [];
        statusHistoryAppend = [...existing, { from: current.status, to: data.status, at: new Date().toISOString(), userId: req.authUser!.id }];
      }
    }

    const [updated] = await db.update(supplierInvoicesTable)
      .set({
        ...(data.status !== undefined && { status: data.status }),
        ...(statusHistoryAppend.length > 0 && { statusHistory: statusHistoryAppend }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
        ...(data.notes !== undefined && { notes: data.notes }),
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
    ]);

    const byStatus: Record<string, { count: number; total: number; paid: number }> = {};
    invoiceStats.forEach(s => { byStatus[s.status] = { count: toNum(s.count), total: toNum(s.total), paid: toNum(s.paid) }; });

    const monthExpenses = Object.values(byStatus).reduce((s, v) => s + v.paid, 0);
    const totalUnpaid = Object.entries(byStatus)
      .filter(([k]) => !["paid", "cancelled"].includes(k))
      .reduce((s, [, v]) => s + v.total - v.paid, 0);

    const tunnel = [
      { label: "Reçues", status: "review", count: byStatus["review"]?.count ?? 0, amount: byStatus["review"]?.total ?? 0 },
      { label: "À approuver", status: "awaiting_approval", count: byStatus["awaiting_approval"]?.count ?? 0, amount: byStatus["awaiting_approval"]?.total ?? 0 },
      { label: "Approuvées", status: "approved", count: byStatus["approved"]?.count ?? 0, amount: byStatus["approved"]?.total ?? 0 },
      { label: "À payer", status: "pending", count: byStatus["pending"]?.count ?? 0, amount: byStatus["pending"]?.total ?? 0 },
      { label: "Partiellement payées", status: "partially_paid", count: byStatus["partially_paid"]?.count ?? 0, amount: byStatus["partially_paid"]?.total ?? 0 },
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
      invoicesByStatus: byStatus,
      tunnel,
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
    const rows = await db.select({
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
    return res.json({ data: rows.map(r => ({ period: r.period, total: toNum(r.total), count: toNum(r.count) })) });
  } catch (e: any) {
    req.log.error(e, "purchases/reports/by-period GET");
    return res.status(500).json({ error: "Erreur rapport par période" });
  }
});

// Top fournisseurs par montant facturé
router.get("/purchases/reports/by-supplier", requirePermission("purchases.read"), async (req, res) => {
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
});

// Approbations en attente (factures)
router.get("/purchases/approvals/pending", requirePermission("purchases.read"), async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const rows = await db.select({
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
      or(
        eq(supplierInvoicesTable.status, "review"),
        eq(supplierInvoicesTable.status, "awaiting_approval"),
      ),
    ))
    .orderBy(asc(supplierInvoicesTable.createdAt));
    const today = new Date().toISOString().slice(0, 10);
    return res.json({ data: rows.map(r => ({
      ...r, totalAmount: toNum(r.totalAmount), paidAmount: toNum(r.paidAmount),
      balance: toNum(r.totalAmount) - toNum(r.paidAmount),
      isOverdue: r.dueDate != null && r.dueDate < today,
    })), total: rows.length });
  } catch (e: any) {
    req.log.error(e, "purchases/approvals/pending GET");
    return res.status(500).json({ error: "Erreur récupération approbations" });
  }
});

export default router;

