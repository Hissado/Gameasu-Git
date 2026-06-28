import { Router } from "express";
import { db } from "@workspace/db";
import {
  suppliersTable,
  supplierInvoicesTable,
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
import { requireManagerOrAbove } from "../middlewares/auth";
import { z } from "zod/v4";

const router = Router();

const toNum = (v: string | number | null | undefined): number => (v == null ? 0 : Number(v));

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

router.get("/purchases/suppliers", async (req, res) => {
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

router.post("/purchases/suppliers", requireManagerOrAbove, async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const {
      name, email, phone, address, taxId, paymentTerms,
      type, country, city, rccm, mobileMoney, bankName, bankAccountNumber, notes,
    } = req.body;
    if (!name) return res.status(400).json({ error: "Le nom est requis" });

    const code = await nextSupplierCode(orgId);
    const [row] = await db.insert(suppliersTable).values({
      organizationId: orgId,
      code,
      name: name as string,
      email: email || null,
      phone: phone || null,
      address: address || null,
      taxId: taxId || null,
      paymentTerms: paymentTerms || null,
      isActive: true,
      type: type || "fournisseur",
      country: country || null,
      city: city || null,
      rccm: rccm || null,
      mobileMoney: mobileMoney || null,
      bankName: bankName || null,
      bankAccountNumber: bankAccountNumber || null,
      notes: notes || null,
      status: "actif",
    }).returning();
    return res.status(201).json(row);
  } catch (e: any) {
    req.log.error(e, "purchases/suppliers POST");
    return res.status(500).json({ error: "Erreur lors de la création du fournisseur" });
  }
});

router.get("/purchases/suppliers/:id", async (req, res) => {
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

router.patch("/purchases/suppliers/:id", requireManagerOrAbove, async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const id = req.params.id as string;
    const { name, email, phone, address, taxId, paymentTerms, isActive, type, country, city, rccm, mobileMoney, bankName, bankAccountNumber, notes, status } = req.body;
    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name;
    if (email !== undefined) patch.email = email;
    if (phone !== undefined) patch.phone = phone;
    if (address !== undefined) patch.address = address;
    if (taxId !== undefined) patch.taxId = taxId;
    if (paymentTerms !== undefined) patch.paymentTerms = paymentTerms;
    if (isActive !== undefined) patch.isActive = isActive;
    if (type !== undefined) patch.type = type;
    if (country !== undefined) patch.country = country;
    if (city !== undefined) patch.city = city;
    if (rccm !== undefined) patch.rccm = rccm;
    if (mobileMoney !== undefined) patch.mobileMoney = mobileMoney;
    if (bankName !== undefined) patch.bankName = bankName;
    if (bankAccountNumber !== undefined) patch.bankAccountNumber = bankAccountNumber;
    if (notes !== undefined) patch.notes = notes;
    if (status !== undefined) { patch.status = status; patch.isActive = status === "actif"; }
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

router.delete("/purchases/suppliers/:id", requireManagerOrAbove, async (req, res) => {
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

router.get("/purchases/invoices", async (req, res) => {
  try {
    const { status, supplierId, search, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const orgId = req.authUser!.organizationId;
    const conds = [eq(supplierInvoicesTable.organizationId, orgId)];
    if (status) conds.push(eq(supplierInvoicesTable.status, status));
    if (supplierId) conds.push(eq(supplierInvoicesTable.supplierId, supplierId));
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
        supplierName: suppliersTable.name,
        supplierCode: suppliersTable.code,
        createdAt: supplierInvoicesTable.createdAt,
        updatedAt: supplierInvoicesTable.updatedAt,
      })
        .from(supplierInvoicesTable)
        .leftJoin(suppliersTable, eq(suppliersTable.id, supplierInvoicesTable.supplierId))
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

router.post("/purchases/invoices", requireManagerOrAbove, async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const {
      supplierId, referenceNumber, invoiceDate, dueDate,
      totalAmount, taxAmount, currency, notes, projectId,
      expenseAccountId, purchaseOrderId,
    } = req.body;
    if (!supplierId || !referenceNumber || !totalAmount) {
      return res.status(400).json({ error: "Fournisseur, référence et montant sont requis" });
    }
    const [row] = await db.insert(supplierInvoicesTable).values({
      organizationId: orgId,
      supplierId: supplierId as string,
      referenceNumber: referenceNumber as string,
      status: "review",
      invoiceDate: invoiceDate || new Date().toISOString().slice(0, 10),
      dueDate: dueDate || null,
      totalAmount: String(totalAmount),
      taxAmount: taxAmount ? String(taxAmount) : "0",
      paidAmount: "0",
      currency: currency || "XOF",
      notes: notes || null,
      projectId: projectId || null,
      expenseAccountId: expenseAccountId || null,
      ...(purchaseOrderId !== undefined && { purchaseOrderId }),
    } as any).returning();
    return res.status(201).json(row);
  } catch (e: any) {
    req.log.error(e, "purchases/invoices POST");
    return res.status(500).json({ error: "Erreur lors de la création" });
  }
});

router.get("/purchases/invoices/:id", async (req, res) => {
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
      supplierId: supplierInvoicesTable.supplierId,
      supplierName: suppliersTable.name,
      supplierCode: suppliersTable.code,
      supplierEmail: suppliersTable.email,
      supplierPhone: suppliersTable.phone,
      createdAt: supplierInvoicesTable.createdAt,
    }).from(supplierInvoicesTable)
      .leftJoin(suppliersTable, eq(suppliersTable.id, supplierInvoicesTable.supplierId))
      .where(and(eq(supplierInvoicesTable.id, id), eq(supplierInvoicesTable.organizationId, orgId)));

    if (!inv) return res.status(404).json({ error: "Facture introuvable" });

    const payments = await db.select().from(supplierPaymentsTable)
      .where(and(eq(supplierPaymentsTable.supplierInvoiceId, id), eq(supplierPaymentsTable.organizationId, orgId)))
      .orderBy(desc(supplierPaymentsTable.paidAt));

    const today = new Date().toISOString().slice(0, 10);
    return res.json({
      ...inv,
      balance: toNum(inv.totalAmount) - toNum(inv.paidAmount),
      isOverdue: inv.status !== "paid" && inv.status !== "cancelled" && inv.dueDate && inv.dueDate < today,
      payments,
    });
  } catch (e: any) {
    req.log.error(e, "purchases/invoices/:id GET");
    return res.status(500).json({ error: "Erreur lors de la récupération" });
  }
});

router.patch("/purchases/invoices/:id", requireManagerOrAbove, async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const id = req.params.id as string;
    const { status, dueDate, notes, expenseAccountId, projectId, referenceNumber, totalAmount, taxAmount } = req.body;
    const [updated] = await db.update(supplierInvoicesTable)
      .set({
        ...(status !== undefined && { status }),
        ...(dueDate !== undefined && { dueDate }),
        ...(notes !== undefined && { notes }),
        ...(expenseAccountId !== undefined && { expenseAccountId }),
        ...(projectId !== undefined && { projectId }),
        ...(referenceNumber !== undefined && { referenceNumber }),
        ...(totalAmount !== undefined && { totalAmount: String(totalAmount) }),
        ...(taxAmount !== undefined && { taxAmount: String(taxAmount) }),
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

// ════════════════════════════════════════════════════════════════
// BONS DE COMMANDE
// ════════════════════════════════════════════════════════════════

router.get("/purchases/purchase-orders", async (req, res) => {
  try {
    const { status, supplierId, search, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const orgId = req.authUser!.organizationId;
    const conds = [eq(purchaseOrdersTable.organizationId, orgId), isNull(purchaseOrdersTable.deletedAt)];
    if (status) conds.push(eq(purchaseOrdersTable.status, status));
    if (supplierId) conds.push(eq(purchaseOrdersTable.supplierId, supplierId));
    if (search) conds.push(ilike(purchaseOrdersTable.reference, `%${search}%`));

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

router.post("/purchases/purchase-orders", requireManagerOrAbove, async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { supplierId, expectedDate, notes, lines = [] } = req.body;
    if (!supplierId) return res.status(400).json({ error: "Fournisseur requis" });

    const reference = await nextPoReference(orgId);
    const totalFcfa = (lines as any[]).reduce((s: number, l: any) => s + (toNum(l.unitPriceFcfa) * toNum(l.quantity)), 0);

    const [po] = await db.insert(purchaseOrdersTable).values({
      organizationId: orgId,
      reference,
      supplierId: supplierId as string,
      status: "draft",
      expectedDate: expectedDate ? new Date(expectedDate) : null,
      totalFcfa: String(totalFcfa),
      notes: notes || null,
      createdById: req.authUser!.id,
    }).returning();

    if (lines.length > 0) {
      await db.insert(purchaseOrderLinesTable).values(
        (lines as any[]).map((l: any) => ({
          organizationId: orgId,
          purchaseOrderId: po.id,
          productId: l.productId,
          description: l.description || null,
          quantity: String(l.quantity),
          unitPriceFcfa: String(l.unitPriceFcfa),
          totalFcfa: String(toNum(l.unitPriceFcfa) * toNum(l.quantity)),
        }))
      );
    }
    return res.status(201).json(po);
  } catch (e: any) {
    req.log.error(e, "purchases/purchase-orders POST");
    return res.status(500).json({ error: "Erreur lors de la création" });
  }
});

router.get("/purchases/purchase-orders/:id", async (req, res) => {
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
      .leftJoin(productsTable, eq(productsTable.id, purchaseOrderLinesTable.productId))
      .where(eq(purchaseOrderLinesTable.purchaseOrderId, id))
      .orderBy(asc(purchaseOrderLinesTable.createdAt));

    return res.json({ ...po, lines });
  } catch (e: any) {
    req.log.error(e, "purchases/purchase-orders/:id GET");
    return res.status(500).json({ error: "Erreur lors de la récupération" });
  }
});

router.patch("/purchases/purchase-orders/:id", requireManagerOrAbove, async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const id = req.params.id as string;
    const { status, expectedDate, notes, receivedDate } = req.body;
    const [updated] = await db.update(purchaseOrdersTable)
      .set({
        ...(status !== undefined && { status }),
        ...(expectedDate !== undefined && { expectedDate: expectedDate ? new Date(expectedDate) : null }),
        ...(notes !== undefined && { notes }),
        ...(receivedDate !== undefined && { receivedDate: receivedDate ? new Date(receivedDate) : null }),
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

router.get("/purchases/payments", async (req, res) => {
  try {
    const { supplierId, invoiceId, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const orgId = req.authUser!.organizationId;
    const conds = [eq(supplierPaymentsTable.organizationId, orgId)];
    if (invoiceId) conds.push(eq(supplierPaymentsTable.supplierInvoiceId, invoiceId));
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
        reference: supplierPaymentsTable.reference,
        paidAt: supplierPaymentsTable.paidAt,
        notes: supplierPaymentsTable.notes,
        supplierInvoiceId: supplierPaymentsTable.supplierInvoiceId,
        invoiceRef: supplierInvoicesTable.referenceNumber,
        supplierId: supplierInvoicesTable.supplierId,
        supplierName: suppliersTable.name,
      }).from(supplierPaymentsTable)
        .leftJoin(supplierInvoicesTable, eq(supplierInvoicesTable.id, supplierPaymentsTable.supplierInvoiceId))
        .leftJoin(suppliersTable, eq(suppliersTable.id, supplierInvoicesTable.supplierId))
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

router.post("/purchases/payments", requireManagerOrAbove, async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { supplierInvoiceId, amount, method, reference, paidAt, bankAccountId, notes } = req.body;
    if (!supplierInvoiceId || !amount || !method) {
      return res.status(400).json({ error: "Facture, montant et mode de paiement sont requis" });
    }

    const [invoice] = await db.select().from(supplierInvoicesTable)
      .where(and(eq(supplierInvoicesTable.id, supplierInvoiceId as string), eq(supplierInvoicesTable.organizationId, orgId)));
    if (!invoice) return res.status(404).json({ error: "Facture introuvable" });

    const [payment] = await db.insert(supplierPaymentsTable).values({
      organizationId: orgId,
      supplierInvoiceId: supplierInvoiceId as string,
      amount: String(amount),
      method: method as string,
      reference: reference || null,
      paidAt: paidAt ? new Date(paidAt) : new Date(),
      bankAccountId: bankAccountId || null,
      notes: notes || null,
    }).returning();

    const newPaid = toNum(invoice.paidAmount) + toNum(amount);
    const total = toNum(invoice.totalAmount);
    const newStatus = newPaid >= total ? "paid" : "partially_paid";
    await db.update(supplierInvoicesTable)
      .set({ paidAmount: String(newPaid), status: newStatus })
      .where(eq(supplierInvoicesTable.id, supplierInvoiceId as string));

    return res.status(201).json(payment);
  } catch (e: any) {
    req.log.error(e, "purchases/payments POST");
    return res.status(500).json({ error: "Erreur lors de l'enregistrement du paiement" });
  }
});

// ════════════════════════════════════════════════════════════════
// VUE D'ENSEMBLE (KPI)
// ════════════════════════════════════════════════════════════════

router.get("/purchases/overview", async (req, res) => {
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

export default router;
