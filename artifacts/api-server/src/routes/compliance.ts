import { Router } from "express";
import { db } from "@workspace/db";
import {
  invoicesTable,
  invoiceScansTable,
  documentSealsTable,
  docSigRequestsTable,
  docSigSignersTable,
  organizationsTable,
  clientsTable,
  usersTable,
} from "@workspace/db";
import { eq, and, desc, isNull } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import { getAIClient } from "../lib/ai";
import { logger } from "../lib/logger";
import { requireAuth } from "../middlewares/auth";
import type { AuthRequest } from "../middlewares/auth";

const router = Router();

// ══════════════════════════════════════════════════════════════════════════════
// T301 — Cachet fiscal OTR / Normalisation factures
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/compliance/invoices/:id/fiscal-stamp
 * Génère le hash fiscal + données QR pour une facture (conformité OTR Togo).
 * Le QR encode : NIF_vendeur|NIF_client|montant|numéro|date|hash
 */
router.post("/api/compliance/invoices/:id/fiscal-stamp", async (req: AuthRequest, res) => {
  try {
    const orgId = req.user!.organizationId;
    const invoiceId = req.params.id as string;

    const [invoice] = await db.select({
      id: invoicesTable.id,
      referenceNumber: invoicesTable.referenceNumber,
      totalAmount: invoicesTable.totalAmount,
      issuedAt: invoicesTable.issuedAt,
      status: invoicesTable.status,
      fiscalStampedAt: invoicesTable.fiscalStampedAt,
      clientId: invoicesTable.clientId,
      organizationId: invoicesTable.organizationId,
    }).from(invoicesTable)
      .where(and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.organizationId, orgId)));

    if (!invoice) return res.status(404).json({ error: "Facture introuvable" });
    if (invoice.fiscalStampedAt) {
      return res.status(409).json({ error: "Cette facture est déjà cachetée fiscalement" });
    }

    // Récupérer NIF de l'organisation et du client
    const [org] = await db.select({ taxId: organizationsTable.taxId, name: organizationsTable.name })
      .from(organizationsTable).where(eq(organizationsTable.id, orgId));

    let clientTaxId = "";
    let clientName = "";
    if (invoice.clientId) {
      const [client] = await db.select({ taxId: clientsTable.ifu, name: clientsTable.name })
        .from(clientsTable).where(eq(clientsTable.id, invoice.clientId));
      clientTaxId = client?.taxId ?? "";
      clientName = client?.name ?? "";
    }

    const issuedDate = invoice.issuedAt ?? new Date().toISOString().slice(0, 10);
    const amount = invoice.totalAmount ?? "0";

    // Numéro séquentiel fiscal : FAC-YYYY-XXXXX (basé sur referenceNumber)
    const year = issuedDate.slice(0, 4);
    const seqNum = invoice.referenceNumber.replace(/[^0-9]/g, "").padStart(5, "0");
    const fiscalSequenceNumber = `FAC-${year}-${seqNum}`;

    // Hash SHA-256 : NIF_vendeur|NIF_client|montant|numéroFiscal|date
    const hashInput = [
      org?.taxId ?? orgId,
      clientTaxId || "NON_ASSUJETTI",
      amount,
      fiscalSequenceNumber,
      issuedDate,
    ].join("|");
    const fiscalStampHash = createHash("sha256").update(hashInput).digest("hex");

    // Données QR (format OTR simplifié — texte lisible + hash)
    const qrData = [
      `NIF_VENDEUR:${org?.taxId ?? ""}`,
      `NIF_CLIENT:${clientTaxId || "NON_ASSUJETTI"}`,
      `FACTURE:${fiscalSequenceNumber}`,
      `DATE:${issuedDate}`,
      `MONTANT:${amount}`,
      `HASH:${fiscalStampHash.slice(0, 16).toUpperCase()}`,
    ].join("|");

    await db.update(invoicesTable)
      .set({
        fiscalQrCode: qrData,
        fiscalStampHash,
        fiscalStampedAt: new Date(),
        fiscalSequenceNumber,
      })
      .where(eq(invoicesTable.id, invoiceId));

    return res.json({
      success: true,
      fiscalSequenceNumber,
      fiscalStampHash,
      fiscalQrCode: qrData,
      fiscalStampedAt: new Date().toISOString(),
      vendeur: { nif: org?.taxId ?? "", name: org?.name ?? "" },
      client: { nif: clientTaxId, name: clientName },
    });
  } catch (e) {
    logger.error({ err: e }, "fiscal-stamp error");
    return res.status(500).json({ error: "Erreur lors du cachetage fiscal" });
  }
});

/**
 * GET /api/compliance/invoices/:id/fiscal-stamp
 * Retourne le cachet fiscal d'une facture.
 */
router.get("/api/compliance/invoices/:id/fiscal-stamp", async (req: AuthRequest, res) => {
  try {
    const orgId = req.user!.organizationId;
    const invoiceId = req.params.id as string;

    const [invoice] = await db.select({
      id: invoicesTable.id,
      referenceNumber: invoicesTable.referenceNumber,
      fiscalQrCode: invoicesTable.fiscalQrCode,
      fiscalStampHash: invoicesTable.fiscalStampHash,
      fiscalStampedAt: invoicesTable.fiscalStampedAt,
      fiscalSequenceNumber: invoicesTable.fiscalSequenceNumber,
      totalAmount: invoicesTable.totalAmount,
      issuedAt: invoicesTable.issuedAt,
    }).from(invoicesTable)
      .where(and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.organizationId, orgId)));

    if (!invoice) return res.status(404).json({ error: "Facture introuvable" });
    return res.json(invoice);
  } catch (e) {
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// T302 — Scanner OCR intelligent
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/compliance/scan-invoice
 * Crée un enregistrement de scan et lance l'analyse IA (si disponible).
 * Body: { fileUrl, fileName, mimeType?, fileSizeBytes? }
 */
router.post("/api/compliance/scan-invoice", async (req: AuthRequest, res) => {
  try {
    const orgId = req.user!.organizationId;
    const userId = req.user!.id;
    const { fileUrl, fileName, mimeType = "application/pdf", fileSizeBytes, notes } = req.body;

    if (!fileUrl || !fileName) {
      return res.status(400).json({ error: "fileUrl et fileName sont requis" });
    }

    const [scan] = await db.insert(invoiceScansTable).values({
      organizationId: orgId,
      uploadedById: userId,
      fileName,
      fileUrl,
      mimeType,
      fileSizeBytes: fileSizeBytes ?? null,
      status: "processing",
      notes: notes ?? null,
    }).returning();

    // Lancer l'extraction IA en arrière-plan
    processInvoiceScan(scan.id, fileUrl, mimeType, orgId).catch((e) => {
      logger.error({ err: e, scanId: scan.id }, "scan processing failed");
    });

    return res.status(201).json(scan);
  } catch (e) {
    logger.error({ err: e }, "scan-invoice create error");
    return res.status(500).json({ error: "Erreur lors de la création du scan" });
  }
});

/**
 * GET /api/compliance/scans
 * Liste les scans de l'organisation.
 */
router.get("/api/compliance/scans", async (req: AuthRequest, res) => {
  try {
    const orgId = req.user!.organizationId;
    const scans = await db.select({
      id: invoiceScansTable.id,
      fileName: invoiceScansTable.fileName,
      mimeType: invoiceScansTable.mimeType,
      status: invoiceScansTable.status,
      aiConfidence: invoiceScansTable.aiConfidence,
      extractedData: invoiceScansTable.extractedData,
      linkedEntryId: invoiceScansTable.linkedEntryId,
      linkedSupplierInvoiceId: invoiceScansTable.linkedSupplierInvoiceId,
      processedAt: invoiceScansTable.processedAt,
      createdAt: invoiceScansTable.createdAt,
      notes: invoiceScansTable.notes,
    }).from(invoiceScansTable)
      .where(eq(invoiceScansTable.organizationId, orgId))
      .orderBy(desc(invoiceScansTable.createdAt))
      .limit(100);

    return res.json(scans);
  } catch (e) {
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * GET /api/compliance/scans/:id
 */
router.get("/api/compliance/scans/:id", async (req: AuthRequest, res) => {
  try {
    const orgId = req.user!.organizationId;
    const [scan] = await db.select().from(invoiceScansTable)
      .where(and(eq(invoiceScansTable.id, req.params.id as string), eq(invoiceScansTable.organizationId, orgId)));
    if (!scan) return res.status(404).json({ error: "Scan introuvable" });
    return res.json(scan);
  } catch (e) {
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * PATCH /api/compliance/scans/:id
 * Mise à jour manuelle des données extraites (correction utilisateur).
 */
router.patch("/api/compliance/scans/:id", async (req: AuthRequest, res) => {
  try {
    const orgId = req.user!.organizationId;
    const { extractedData, notes, linkedEntryId, linkedSupplierInvoiceId } = req.body;

    const [updated] = await db.update(invoiceScansTable)
      .set({
        ...(extractedData !== undefined && { extractedData }),
        ...(notes !== undefined && { notes }),
        ...(linkedEntryId !== undefined && { linkedEntryId }),
        ...(linkedSupplierInvoiceId !== undefined && { linkedSupplierInvoiceId }),
      })
      .where(and(eq(invoiceScansTable.id, req.params.id as string), eq(invoiceScansTable.organizationId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Scan introuvable" });
    return res.json(updated);
  } catch (e) {
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * POST /api/compliance/scans/:id/reprocess
 * Relance l'analyse IA sur un scan existant.
 */
router.post("/api/compliance/scans/:id/reprocess", async (req: AuthRequest, res) => {
  try {
    const orgId = req.user!.organizationId;
    const [scan] = await db.select().from(invoiceScansTable)
      .where(and(eq(invoiceScansTable.id, req.params.id as string), eq(invoiceScansTable.organizationId, orgId)));
    if (!scan) return res.status(404).json({ error: "Scan introuvable" });

    await db.update(invoiceScansTable)
      .set({ status: "processing", errorMessage: null, processedAt: null })
      .where(eq(invoiceScansTable.id, scan.id));

    processInvoiceScan(scan.id, scan.fileUrl, scan.mimeType, orgId).catch(() => {});
    return res.json({ success: true, message: "Retraitement lancé" });
  } catch (e) {
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// T303 — Cachet numérique sur documents
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/compliance/seals
 * Appose un cachet numérique sur un document.
 * Body: { documentType, documentId, documentLabel?, contentToHash }
 */
router.post("/api/compliance/seals", async (req: AuthRequest, res) => {
  try {
    const orgId = req.user!.organizationId;
    const userId = req.user!.id;
    const { documentType, documentId, contentToHash, documentLabel } = req.body;

    if (!documentType || !documentId || !contentToHash) {
      return res.status(400).json({ error: "documentType, documentId et contentToHash sont requis" });
    }

    const contentHash = createHash("sha256").update(String(contentToHash)).digest("hex");

    const [org] = await db.select({ name: organizationsTable.name, taxId: organizationsTable.taxId, logoUrl: organizationsTable.logoUrl })
      .from(organizationsTable).where(eq(organizationsTable.id, orgId));

    const sealMetadata = {
      organizationName: org?.name ?? "",
      organizationNif: org?.taxId ?? "",
      sealedBy: userId,
      sealedAt: new Date().toISOString(),
      documentType,
      documentId,
      documentLabel: documentLabel ?? "",
      contentHash,
    };

    const [seal] = await db.insert(documentSealsTable).values({
      organizationId: orgId,
      documentType,
      documentId,
      contentHash,
      sealedById: userId,
      sealedAt: new Date(),
      sealMetadata,
      isValid: true,
    }).returning();

    return res.status(201).json(seal);
  } catch (e) {
    logger.error({ err: e }, "seal create error");
    return res.status(500).json({ error: "Erreur lors de l'apposition du cachet" });
  }
});

/**
 * GET /api/compliance/seals
 * Liste les cachets de l'organisation.
 */
router.get("/api/compliance/seals", async (req: AuthRequest, res) => {
  try {
    const orgId = req.user!.organizationId;
    const { documentType, documentId } = req.query;

    const seals = await db.select({
      id: documentSealsTable.id,
      documentType: documentSealsTable.documentType,
      documentId: documentSealsTable.documentId,
      contentHash: documentSealsTable.contentHash,
      sealedAt: documentSealsTable.sealedAt,
      isValid: documentSealsTable.isValid,
      sealMetadata: documentSealsTable.sealMetadata,
      revokedAt: documentSealsTable.revokedAt,
    }).from(documentSealsTable)
      .where(and(
        eq(documentSealsTable.organizationId, orgId),
        documentType ? eq(documentSealsTable.documentType, documentType as string) : undefined,
        documentId ? eq(documentSealsTable.documentId, documentId as string) : undefined,
      ))
      .orderBy(desc(documentSealsTable.sealedAt))
      .limit(200);

    return res.json(seals);
  } catch (e) {
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * POST /api/compliance/seals/:id/verify
 * Vérifie l'intégrité d'un cachet : reçoit contentToHash, recompute, compare.
 */
router.post("/api/compliance/seals/:id/verify", async (req: AuthRequest, res) => {
  try {
    const orgId = req.user!.organizationId;
    const { contentToHash } = req.body;
    const [seal] = await db.select().from(documentSealsTable)
      .where(and(eq(documentSealsTable.id, req.params.id as string), eq(documentSealsTable.organizationId, orgId)));
    if (!seal) return res.status(404).json({ error: "Cachet introuvable" });

    if (!contentToHash) return res.status(400).json({ error: "contentToHash requis" });
    const currentHash = createHash("sha256").update(String(contentToHash)).digest("hex");
    const isIntact = currentHash === seal.contentHash && seal.isValid;

    return res.json({ isIntact, storedHash: seal.contentHash, currentHash, isValid: seal.isValid, revokedAt: seal.revokedAt });
  } catch (e) {
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * DELETE /api/compliance/seals/:id (revoke)
 */
router.delete("/api/compliance/seals/:id", async (req: AuthRequest, res) => {
  try {
    const orgId = req.user!.organizationId;
    const { reason } = req.body;
    const [seal] = await db.update(documentSealsTable)
      .set({ isValid: false, revokedAt: new Date(), revokedReason: reason ?? "Révoqué par l'administrateur" })
      .where(and(eq(documentSealsTable.id, req.params.id as string), eq(documentSealsTable.organizationId, orgId)))
      .returning();
    if (!seal) return res.status(404).json({ error: "Cachet introuvable" });
    return res.json({ success: true, seal });
  } catch (e) {
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// T303 — Workflow de signature interne
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/compliance/signature-requests
 */
router.post("/api/compliance/signature-requests", async (req: AuthRequest, res) => {
  try {
    const orgId = req.user!.organizationId;
    const userId = req.user!.id;
    const { documentType, documentId, documentLabel, message, dueDate, signers } = req.body;

    if (!documentType || !documentId || !documentLabel) {
      return res.status(400).json({ error: "documentType, documentId et documentLabel sont requis" });
    }
    if (!Array.isArray(signers) || signers.length === 0) {
      return res.status(400).json({ error: "Au moins un signataire est requis" });
    }

    const [request] = await db.insert(docSigRequestsTable).values({
      organizationId: orgId,
      documentType,
      documentId,
      documentLabel,
      createdById: userId,
      message: message ?? null,
      dueDate: dueDate ?? null,
      status: "pending",
    }).returning();

    const signerRows = signers.map((s: { email: string; name: string; role?: string; userId?: string }, i: number) => ({
      requestId: request.id,
      signerEmail: s.email,
      signerName: s.name,
      signerRole: s.role ?? null,
      signerId: s.userId ?? null,
      order: i,
      status: "pending" as const,
    }));

    await db.insert(docSigSignersTable).values(signerRows);

    const fullRequest = await db.select().from(docSigRequestsTable)
      .where(eq(docSigRequestsTable.id, request.id));

    return res.status(201).json(fullRequest[0]);
  } catch (e) {
    logger.error({ err: e }, "signature-request create error");
    return res.status(500).json({ error: "Erreur lors de la création de la demande de signature" });
  }
});

/**
 * GET /api/compliance/signature-requests
 */
router.get("/api/compliance/signature-requests", async (req: AuthRequest, res) => {
  try {
    const orgId = req.user!.organizationId;
    const { status, documentType } = req.query;

    const requests = await db.select({
      id: docSigRequestsTable.id,
      documentType: docSigRequestsTable.documentType,
      documentId: docSigRequestsTable.documentId,
      documentLabel: docSigRequestsTable.documentLabel,
      status: docSigRequestsTable.status,
      message: docSigRequestsTable.message,
      dueDate: docSigRequestsTable.dueDate,
      completedAt: docSigRequestsTable.completedAt,
      createdAt: docSigRequestsTable.createdAt,
    }).from(docSigRequestsTable)
      .where(and(
        eq(docSigRequestsTable.organizationId, orgId),
        status ? eq(docSigRequestsTable.status, status as string) : undefined,
        documentType ? eq(docSigRequestsTable.documentType, documentType as string) : undefined,
      ))
      .orderBy(desc(docSigRequestsTable.createdAt))
      .limit(100);

    // Enrichir avec les signataires
    const results = await Promise.all(requests.map(async (r) => {
      const signers = await db.select().from(docSigSignersTable)
        .where(eq(docSigSignersTable.requestId, r.id))
        .orderBy(docSigSignersTable.order);
      return { ...r, signers };
    }));

    return res.json(results);
  } catch (e) {
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * GET /api/compliance/signature-requests/:id
 */
router.get("/api/compliance/signature-requests/:id", async (req: AuthRequest, res) => {
  try {
    const orgId = req.user!.organizationId;
    const [request] = await db.select().from(docSigRequestsTable)
      .where(and(eq(docSigRequestsTable.id, req.params.id as string), eq(docSigRequestsTable.organizationId, orgId)));
    if (!request) return res.status(404).json({ error: "Demande introuvable" });

    const signers = await db.select().from(docSigSignersTable)
      .where(eq(docSigSignersTable.requestId, request.id))
      .orderBy(docSigSignersTable.order);

    return res.json({ ...request, signers });
  } catch (e) {
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * POST /api/compliance/signature-requests/:id/sign
 * Un signataire signe ou rejette la demande.
 * Body: { signerId, action: "sign"|"reject", reason? }
 */
router.post("/api/compliance/signature-requests/:id/sign", async (req: AuthRequest, res) => {
  try {
    const orgId = req.user!.organizationId;
    const userId = req.user!.id;
    const { signerId, action, reason } = req.body;
    const signerIdToUse = signerId ?? userId;

    const [request] = await db.select().from(docSigRequestsTable)
      .where(and(eq(docSigRequestsTable.id, req.params.id as string), eq(docSigRequestsTable.organizationId, orgId)));
    if (!request) return res.status(404).json({ error: "Demande introuvable" });
    if (request.status === "completed" || request.status === "cancelled") {
      return res.status(409).json({ error: "Cette demande est déjà terminée ou annulée" });
    }

    const [signer] = await db.select().from(docSigSignersTable)
      .where(and(
        eq(docSigSignersTable.requestId, request.id),
        eq(docSigSignersTable.signerId, signerIdToUse),
      ));
    if (!signer) return res.status(404).json({ error: "Signataire introuvable dans cette demande" });

    const fingerprint = createHash("sha256")
      .update(`${request.id}|${signerIdToUse}|${new Date().toISOString()}`)
      .digest("hex");

    if (action === "sign") {
      await db.update(docSigSignersTable)
        .set({ status: "signed", signedAt: new Date(), fingerprint, ipAddress: req.ip ?? null })
        .where(eq(docSigSignersTable.id, signer.id));
    } else if (action === "reject") {
      await db.update(docSigSignersTable)
        .set({ status: "rejected", rejectedAt: new Date(), rejectionReason: reason ?? null })
        .where(eq(docSigSignersTable.id, signer.id));
      await db.update(docSigRequestsTable)
        .set({ status: "rejected" })
        .where(eq(docSigRequestsTable.id, request.id));
      return res.json({ success: true, status: "rejected" });
    } else {
      return res.status(400).json({ error: "action doit être 'sign' ou 'reject'" });
    }

    // Vérifier si tous ont signé
    const allSigners = await db.select().from(docSigSignersTable)
      .where(eq(docSigSignersTable.requestId, request.id));
    const allSigned = allSigners.every((s) => s.status === "signed");
    const someSigned = allSigners.some((s) => s.status === "signed");

    const newStatus = allSigned ? "completed" : (someSigned ? "partially_signed" : "pending");
    await db.update(docSigRequestsTable)
      .set({ status: newStatus, ...(allSigned ? { completedAt: new Date() } : {}) })
      .where(eq(docSigRequestsTable.id, request.id));

    return res.json({ success: true, status: newStatus, fingerprint });
  } catch (e) {
    logger.error({ err: e }, "sign error");
    return res.status(500).json({ error: "Erreur lors de la signature" });
  }
});

/**
 * PATCH /api/compliance/signature-requests/:id/cancel
 */
router.patch("/api/compliance/signature-requests/:id/cancel", async (req: AuthRequest, res) => {
  try {
    const orgId = req.user!.organizationId;
    const [updated] = await db.update(docSigRequestsTable)
      .set({ status: "cancelled" })
      .where(and(eq(docSigRequestsTable.id, req.params.id as string), eq(docSigRequestsTable.organizationId, orgId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Demande introuvable" });
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * GET /api/compliance/dashboard
 * Tableau de bord conformité : KPIs cachets, signatures, scans.
 */
router.get("/api/compliance/dashboard", async (req: AuthRequest, res) => {
  try {
    const orgId = req.user!.organizationId;

    const [scansRaw, sealsRaw, signaturesRaw] = await Promise.all([
      db.select({ id: invoiceScansTable.id, status: invoiceScansTable.status })
        .from(invoiceScansTable).where(eq(invoiceScansTable.organizationId, orgId)),
      db.select({ id: documentSealsTable.id, isValid: documentSealsTable.isValid })
        .from(documentSealsTable).where(eq(documentSealsTable.organizationId, orgId)),
      db.select({ id: docSigRequestsTable.id, status: docSigRequestsTable.status })
        .from(docSigRequestsTable).where(eq(docSigRequestsTable.organizationId, orgId)),
    ]);

    // Factures cachetées
    const stampedInvoices = await db.select({ id: invoicesTable.id })
      .from(invoicesTable)
      .where(and(
        eq(invoicesTable.organizationId, orgId),
        isNull(invoicesTable.fiscalStampedAt),
      )).limit(1);

    const totalScans = scansRaw.length;
    const scansDone = scansRaw.filter((s) => s.status === "done").length;
    const scansPending = scansRaw.filter((s) => s.status === "pending" || s.status === "processing").length;

    const totalSeals = sealsRaw.length;
    const validSeals = sealsRaw.filter((s) => s.isValid).length;

    const totalSigs = signaturesRaw.length;
    const pendingSigs = signaturesRaw.filter((s) => s.status === "pending" || s.status === "partially_signed").length;
    const completedSigs = signaturesRaw.filter((s) => s.status === "completed").length;

    return res.json({
      scans: { total: totalScans, done: scansDone, pending: scansPending, error: totalScans - scansDone - scansPending },
      seals: { total: totalSeals, valid: validSeals, revoked: totalSeals - validSeals },
      signatures: { total: totalSigs, pending: pendingSigs, completed: completedSigs },
      invoicesWithoutStamp: stampedInvoices.length > 0 ? "some" : "none",
    });
  } catch (e) {
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// ── Traitement OCR asynchrone ──────────────────────────────────────────────
async function processInvoiceScan(scanId: string, fileUrl: string, mimeType: string, orgId: string) {
  const client = getAIClient();
  if (!client) {
    await db.update(invoiceScansTable)
      .set({ status: "error", errorMessage: "Service IA non disponible (OPENAI_API_KEY manquant)", processedAt: new Date() })
      .where(eq(invoiceScansTable.id, scanId));
    return;
  }

  try {
    const isImage = mimeType.startsWith("image/");
    const isPdf = mimeType === "application/pdf";

    if (!isImage && !isPdf) {
      await db.update(invoiceScansTable)
        .set({ status: "error", errorMessage: "Type de fichier non supporté pour l'OCR (PDF ou image requis)", processedAt: new Date() })
        .where(eq(invoiceScansTable.id, scanId));
      return;
    }

    const prompt = `Tu es un assistant OCR expert en comptabilité OHADA/francophone.
Analyse ce document et extrais les informations structurées en JSON.
Retourne UNIQUEMENT un objet JSON valide avec ces clés (null si non trouvé) :
{
  "documentType": "facture_fournisseur" | "facture_client" | "bon_de_commande" | "devis" | "recu" | "autre",
  "vendeur": { "nom": string, "nif": string, "adresse": string, "telephone": string },
  "client": { "nom": string, "nif": string, "adresse": string },
  "numero": string,
  "date": "YYYY-MM-DD",
  "dateEcheance": "YYYY-MM-DD",
  "lignes": [{ "description": string, "quantite": number, "prixUnitaire": number, "total": number }],
  "montantHT": number,
  "montantTVA": number,
  "tauxTVA": number,
  "montantTTC": number,
  "devise": "XOF" | "EUR" | "USD" | string,
  "modePaiement": string,
  "notes": string
}`;

    const messages: Parameters<typeof client.chat.completions.create>[0]["messages"] = [
      {
        role: "user",
        content: isImage
          ? [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: fileUrl, detail: "high" } },
            ]
          : [{ type: "text", text: `${prompt}\n\nURL du document PDF : ${fileUrl}\n(Analyse le contenu de cette facture PDF.)` }],
      },
    ];

    const completion = await client.chat.completions.create({
      model: isImage ? "gpt-4o" : "gpt-5-nano",
      messages,
      max_tokens: 1500,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const cleaned = raw.replace(/^```(?:json)?/, "").replace(/```$/, "").trim();

    let extractedData: Record<string, unknown> | null = null;
    let aiConfidence = "0.7";
    try {
      extractedData = JSON.parse(cleaned);
      // Estimer la confiance selon la complétude
      const fields = ["numero", "date", "montantTTC", "vendeur", "client"].filter(
        (f) => extractedData && extractedData[f] !== null && extractedData[f] !== undefined,
      );
      aiConfidence = (fields.length / 5).toFixed(2);
    } catch {
      extractedData = { rawText: cleaned };
      aiConfidence = "0.3";
    }

    await db.update(invoiceScansTable)
      .set({
        status: "done",
        extractedData,
        rawOcrText: raw,
        aiConfidence,
        aiModel: isImage ? "gpt-4o" : "gpt-5-nano",
        processedAt: new Date(),
      })
      .where(eq(invoiceScansTable.id, scanId));
  } catch (e) {
    logger.error({ err: e, scanId }, "OCR processing error");
    await db.update(invoiceScansTable)
      .set({
        status: "error",
        errorMessage: e instanceof Error ? e.message : "Erreur inconnue lors du traitement IA",
        processedAt: new Date(),
      })
      .where(eq(invoiceScansTable.id, scanId));
  }
}

export default router;
