/**
 * Phase 8 — Documents IA : classification automatique, résumé, signature électronique heuristique.
 *  - POST /api/documents/:id/analyze   : (re)classifie le document (IA si dispo, sinon heuristique).
 *  - POST /api/documents/:id/sign      : marque un signataire comme ayant signé (signature simple).
 *  - POST /api/documents/:id/request-signature : démarre un workflow de signature (signers initiaux).
 *  - GET  /api/documents/intelligence/overview : KPI IA + signatures + non classés.
 */
import { Router, type IRouter, type Request } from "express";
import { db, documentsTable } from "@workspace/db";
import { and, eq, isNull, sql, desc, inArray, ne, or } from "drizzle-orm";
import { z } from "zod/v4";
import { userAccessibleProjectIds, hasPermission } from "../lib/rbac/permissions";
import { requirePermission } from "../middlewares/permissions";
import { classifyEnum, aiAvailable } from "../lib/ai";

const router: IRouter = Router();

const CATEGORIES = [
  "contract", "invoice", "quote", "proforma", "receipt", "purchase_order",
  "report", "certificate", "id", "tax", "hr", "payslip", "photo", "plan",
  "specification", "minutes", "other",
] as const;
type Category = typeof CATEGORIES[number];

async function buildProjectAclCond(req: Request) {
  if (!req.authUser) return undefined;
  const accessible = await userAccessibleProjectIds(req.authUser.id);
  if (accessible === null) return undefined;
  if (accessible.length === 0) return ne(documentsTable.entityType, "project");
  return or(
    ne(documentsTable.entityType, "project"),
    and(eq(documentsTable.entityType, "project"), inArray(documentsTable.entityId, accessible)),
  );
}

// ─── Heuristique de classification ─────────────────────────────────────
const PATTERNS: { label: Category; tags: string[]; rx: RegExp }[] = [
  { label: "contract",      tags: ["contrat"],               rx: /contrat|contract|accord|convention|nda/i },
  { label: "invoice",       tags: ["facture"],               rx: /facture|invoice|^fac[\s_-]|inv[\s_-]\d/i },
  { label: "proforma",      tags: ["devis"],                 rx: /proforma|pro[\s_-]?forma/i },
  { label: "quote",         tags: ["devis"],                 rx: /devis|quote|estimation/i },
  { label: "receipt",       tags: ["recu", "paiement"],      rx: /recu|reçu|receipt|quittance/i },
  { label: "purchase_order",tags: ["bon-commande"],          rx: /bon[\s_-]?de[\s_-]?commande|bdc|purchase[\s_-]?order|p[\s_-]?o[\s_-]\d/i },
  { label: "tax",           tags: ["fiscal", "impots"],      rx: /tva|impot|fisc|declaration|otr|sycohada/i },
  { label: "payslip",       tags: ["paie", "rh"],            rx: /bulletin|paie|payslip|salaire/i },
  { label: "hr",            tags: ["rh"],                    rx: /cv|recrut|onboarding|conge|absence|rh[\s_-]/i },
  { label: "id",            tags: ["identite"],              rx: /piece[\s_-]?identite|passeport|cni|carte[\s_-]?nationale/i },
  { label: "certificate",   tags: ["certificat"],            rx: /certificat|attestation|certif|registre|kbis|nif/i },
  { label: "plan",          tags: ["plan", "btp"],           rx: /plan|blueprint|drawing|dwg|cao/i },
  { label: "specification", tags: ["specs", "btp"],          rx: /cahier[\s_-]?des[\s_-]?charges|cctp|specification|spec/i },
  { label: "minutes",       tags: ["reunion"],               rx: /compte[\s_-]?rendu|pv[\s_-]|proces[\s_-]?verbal|minutes/i },
  { label: "report",        tags: ["rapport"],               rx: /rapport|report|bilan|synthese/i },
  { label: "photo",         tags: ["photo"],                 rx: /\.(jpe?g|png|gif|webp|heic)$|photo|image|^img[\s_-]/i },
];
const MIME_FALLBACK: Record<string, { label: Category; tag: string }> = {
  "image/jpeg": { label: "photo", tag: "photo" },
  "image/png": { label: "photo", tag: "photo" },
  "image/webp": { label: "photo", tag: "photo" },
  "application/pdf": { label: "report", tag: "pdf" },
};

function heuristicClassify(name: string, mimeType?: string | null): { label: Category; confidence: number; tags: string[]; summary: string } {
  const haystack = `${name} ${mimeType ?? ""}`.toLowerCase();
  for (const p of PATTERNS) {
    if (p.rx.test(haystack)) {
      return { label: p.label, confidence: 0.7, tags: p.tags, summary: `Détecté heuristiquement comme ${p.label} via le nom du fichier.` };
    }
  }
  if (mimeType && MIME_FALLBACK[mimeType]) {
    const f = MIME_FALLBACK[mimeType];
    return { label: f.label, confidence: 0.4, tags: [f.tag], summary: `Catégorisé via le type MIME (${mimeType}).` };
  }
  return { label: "other", confidence: 0.2, tags: [], summary: "Aucune correspondance heuristique." };
}

// ─── Analyse (classification + résumé) ─────────────────────────────────
router.post("/documents/:id/analyze", requirePermission("documents.read"), async (req, res, next) => {
  try {
    const id = String(req.params["id"]);
    const acl = await buildProjectAclCond(req);
    const conds: any[] = [eq(documentsTable.id, id), isNull(documentsTable.deletedAt)];
    if (acl) conds.push(acl);
    const [doc] = await db.select().from(documentsTable).where(and(...conds)).limit(1);
    if (!doc) return res.status(404).json({ error: "not_found" });

    const context = [
      `Nom du fichier : ${doc.name}`,
      doc.mimeType ? `Type MIME : ${doc.mimeType}` : null,
      doc.description ? `Description : ${doc.description}` : null,
      doc.entityType ? `Entité liée : ${doc.entityType}` : null,
      doc.tags && doc.tags.length > 0 ? `Tags actuels : ${doc.tags.join(", ")}` : null,
    ].filter(Boolean).join("\n");

    let result = await classifyEnum<Category>({ context, labels: CATEGORIES, hint: "Plateforme SaaS B2B BTP/services Togo/Afrique de l'Ouest." });
    let provider: "openai" | "heuristic" = "openai";
    if (!result) {
      result = heuristicClassify(doc.name, doc.mimeType);
      provider = "heuristic";
    }

    const mergedTags = Array.from(new Set([...(doc.tags ?? []), ...result.tags])).slice(0, 12);

    const [updated] = await db.update(documentsTable).set({
      aiCategory: result.label,
      aiConfidence: String(result.confidence) as any,
      aiSummary: result.summary,
      aiTags: result.tags,
      aiAnalyzedAt: new Date(),
      aiProvider: provider,
      // Si la catégorie utilisateur est "other", on adopte automatiquement la suggestion IA.
      category: doc.category === "other" ? result.label : doc.category,
      tags: mergedTags,
    }).where(eq(documentsTable.id, id)).returning();

    return res.json({ document: updated, provider, aiAvailable: aiAvailable() });
  } catch (e) { next(e); }
});

// ─── Workflow de signature ────────────────────────────────────────────
const requestSignatureSchema = z.object({
  signers: z.array(z.object({
    name: z.string().min(1),
    email: z.string().email().optional(),
    role: z.string().optional(),
  })).min(1).max(10),
});

router.post("/documents/:id/request-signature", requirePermission("documents.manage"), async (req, res, next) => {
  try {
    const id = String(req.params["id"]);
    const parsed = requestSignatureSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_body", details: parsed.error.issues });
    const force = req.query["force"] === "1" || req.body?.force === true;
    const acl = await buildProjectAclCond(req);
    const conds: any[] = [eq(documentsTable.id, id), isNull(documentsTable.deletedAt)];
    if (acl) conds.push(acl);
    const [doc] = await db.select().from(documentsTable).where(and(...conds)).limit(1);
    if (!doc) return res.status(404).json({ error: "not_found" });

    // Garde-fou : ne pas réinitialiser silencieusement un document déjà signé
    // sauf si l'appelant force explicitement (réémission de workflow).
    if (doc.signatureStatus === "signed" && !force) {
      return res.status(409).json({ error: "already_signed", message: "Document déjà signé. Utiliser force=1 pour réémettre le workflow." });
    }

    const [updated] = await db.update(documentsTable).set({
      signatureStatus: "pending",
      signers: parsed.data.signers.map((s) => ({ ...s })),
      signedAt: null,
    }).where(eq(documentsTable.id, id)).returning();
    return res.json(updated);
  } catch (e) { next(e); }
});

const signSchema = z.object({
  signerEmail: z.string().email().optional(),
  signerName: z.string().min(1).optional(),
}).refine((d) => d.signerEmail || d.signerName, { message: "signerEmail ou signerName requis" });

/**
 * Signature simple, MVP. Autorisation :
 *  - soit l'email du signataire correspond à l'email de l'utilisateur authentifié ;
 *  - soit l'utilisateur dispose de la permission `documents.manage` (gestionnaire / admin)
 *    qui agit alors comme tiers de confiance et peut acter la signature au nom d'un
 *    signataire externe (cas du client signant en présentiel chez le commercial).
 * Le signataire authentifié est toujours privilégié sur le ciblage par nom.
 *
 * Idempotent : si le signataire ciblé est déjà signé, on renvoie 200 sans modification.
 */
router.post("/documents/:id/sign", requirePermission("documents.read"), async (req, res, next) => {
  try {
    if (!req.authUser) return res.status(401).json({ error: "unauthorized" });
    const id = String(req.params["id"]);
    const parsed = signSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_body", details: parsed.error.issues });

    const acl = await buildProjectAclCond(req);
    const conds: any[] = [eq(documentsTable.id, id), isNull(documentsTable.deletedAt)];
    if (acl) conds.push(acl);
    const [doc] = await db.select().from(documentsTable).where(and(...conds)).limit(1);
    if (!doc) return res.status(404).json({ error: "not_found" });

    const signers = (doc.signers ?? []).slice();
    if (signers.length === 0) return res.status(400).json({ error: "no_signers_requested", message: "Le workflow de signature n'a pas été démarré." });

    // Ciblage : on cherche un signataire correspondant.
    const idx = signers.findIndex((s) =>
      (parsed.data.signerEmail && s.email && s.email.toLowerCase() === parsed.data.signerEmail.toLowerCase()) ||
      (parsed.data.signerName && s.name.toLowerCase() === parsed.data.signerName.toLowerCase()),
    );
    if (idx < 0) return res.status(404).json({ error: "signer_not_found" });

    // Autorisation : soit le signataire EST l'utilisateur authentifié (match email),
    // soit l'utilisateur a `documents.manage` (acteur de confiance interne).
    const targetEmail = (signers[idx].email ?? "").toLowerCase();
    const userEmail = (req.authUser.email ?? "").toLowerCase();
    const isSelfSign = !!targetEmail && targetEmail === userEmail;
    const canActAsTrustee = await hasPermission(req.authUser.id, "documents.manage");
    if (!isSelfSign && !canActAsTrustee) {
      return res.status(403).json({
        error: "signature_forbidden",
        message: "Vous ne pouvez signer que pour vous-même (email correspondant) ou avec la permission documents.manage.",
      });
    }

    // Idempotence : si le signataire ciblé est déjà signé, on renvoie le doc inchangé.
    if (signers[idx].signedAt) {
      return res.json({ ...doc, _idempotent: true });
    }

    const nowIso = new Date().toISOString();
    signers[idx] = {
      ...signers[idx],
      signedAt: nowIso,
      // Trace audit : on conserve qui a acté la signature (utile si tiers de confiance).
      ...(isSelfSign ? {} : { signedByUserId: req.authUser.id } as any),
    };
    const allSigned = signers.every((s) => !!s.signedAt);

    const [updated] = await db.update(documentsTable).set({
      signers,
      signatureStatus: allSigned ? "signed" : "pending",
      signedAt: allSigned ? new Date() : null,
    }).where(eq(documentsTable.id, id)).returning();
    return res.json(updated);
  } catch (e) { next(e); }
});

// ─── Overview ──────────────────────────────────────────────────────────
router.get("/documents/intelligence/overview", requirePermission("documents.read"), async (req, res, next) => {
  try {
    const acl = await buildProjectAclCond(req);
    const baseConds = [isNull(documentsTable.deletedAt)];
    if (acl) baseConds.push(acl);
    const where = and(...baseConds);

    const [
      total, analyzed, notClassified, byAiCategory, bySignature, pendingSign, recentAnalyses,
    ] = await Promise.all([
      db.select({ c: sql<number>`count(*)::int` }).from(documentsTable).where(where),
      db.select({ c: sql<number>`count(*)::int` }).from(documentsTable)
        .where(and(where, sql`${documentsTable.aiAnalyzedAt} IS NOT NULL`)),
      db.select({ c: sql<number>`count(*)::int` }).from(documentsTable)
        .where(and(where, or(eq(documentsTable.category, "other"), isNull(documentsTable.category)))),
      db.select({
        category: documentsTable.aiCategory,
        count: sql<number>`count(*)::int`,
      }).from(documentsTable)
        .where(and(where, sql`${documentsTable.aiCategory} IS NOT NULL`))
        .groupBy(documentsTable.aiCategory),
      db.select({
        status: documentsTable.signatureStatus,
        count: sql<number>`count(*)::int`,
      }).from(documentsTable).where(where).groupBy(documentsTable.signatureStatus),
      db.select().from(documentsTable)
        .where(and(where, eq(documentsTable.signatureStatus, "pending")))
        .orderBy(desc(documentsTable.createdAt)).limit(20),
      db.select().from(documentsTable)
        .where(and(where, sql`${documentsTable.aiAnalyzedAt} IS NOT NULL`))
        .orderBy(desc(documentsTable.aiAnalyzedAt)).limit(10),
    ]);

    return res.json({
      aiAvailable: aiAvailable(),
      total: Number(total[0]?.c ?? 0),
      analyzed: Number(analyzed[0]?.c ?? 0),
      notClassified: Number(notClassified[0]?.c ?? 0),
      byAiCategory: byAiCategory.map((r) => ({ category: r.category, count: Number(r.count) })),
      bySignature: bySignature.map((r) => ({ status: r.status ?? "none", count: Number(r.count) })),
      pendingSign,
      recentAnalyses,
    });
  } catch (e) { next(e); }
});

export default router;
