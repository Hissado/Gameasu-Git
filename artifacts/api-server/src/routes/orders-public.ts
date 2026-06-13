import { Router } from "express";
import { db } from "@workspace/db";
import { invoicesTable, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const toNum = (v: string | null | undefined) => (v ? Number(v) : null);

// ── Public invoice by token (no auth required) ────────────────────────────────

router.get("/public/invoices/:token", async (req, res, next) => {
  try {
    const token = String(req.params.token);
    const rows = await db
      .select({ inv: invoicesTable, clientName: clientsTable.name, clientEmail: clientsTable.email })
      .from(invoicesTable)
      .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
      .where(eq(invoicesTable.publicToken, token))
      .limit(1);

    if (!rows[0]) {
      res.status(404).json({ error: "Lien invalide ou expiré" });
      return;
    }

    const { inv, clientName, clientEmail } = rows[0];

    res.json({
      id: inv.id,
      referenceNumber: inv.referenceNumber,
      status: inv.status,
      totalAmount: toNum(inv.totalAmount),
      paidAmount: toNum(inv.paidAmount),
      dueDate: inv.dueDate,
      issuedAt: inv.issuedAt,
      notes: inv.notes,
      clientName,
      clientEmail,
      dunningStatus: inv.dunningStatus,
      promisedPaymentDate: inv.promisedPaymentDate,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
