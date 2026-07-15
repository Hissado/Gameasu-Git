/**
 * Moteur Fiscal — Togo / OHADA (configurable par pays)
 *
 * GET    /api/fiscal/engine/rates              taux configurés
 * POST   /api/fiscal/engine/rates              créer/remplacer un taux
 * DELETE /api/fiscal/engine/rates/:id          supprimer
 *
 * GET    /api/fiscal/engine/obligations        échéancier fiscal
 * POST   /api/fiscal/engine/obligations        créer une obligation
 * PATCH  /api/fiscal/engine/obligations/:id    mettre à jour
 * POST   /api/fiscal/engine/obligations/:id/pay  enregistrer un paiement
 *
 * POST   /api/fiscal/engine/simulate           simuler la charge fiscale
 * GET    /api/fiscal/engine/simulations        simulations sauvegardées
 * POST   /api/fiscal/engine/seed-togo          seeder les taux Togo par défaut
 *
 * GET    /api/fiscal/engine/dashboard          KPIs fiscaux (obligations, alertes)
 */
import { Router } from "express";
import { db } from "@workspace/db";
import {
  taxRateConfigsTable,
  patenteBracketsTable,
  taxObligationsTable,
  taxObligationPaymentsTable,
  taxSimulationsTable,
} from "@workspace/db";
import { and, eq, desc, asc, lte, gte, sql } from "drizzle-orm";
import { requireAuth, requireManagerOrAbove } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

const toNum = (v: string | number | null | undefined) => (v == null ? 0 : Number(v));

// ─────────────────────────────────────────────────────────
// CALCULS FISCAUX TOGO
// ─────────────────────────────────────────────────────────

/** IRPP progressif Togo (annuel, en XOF) */
function computeIrpp(annualIncome: number): number {
  const brackets = [
    { up: 900_000,    rate: 0 },
    { up: 1_500_000,  rate: 0.07 },
    { up: 2_500_000,  rate: 0.11 },
    { up: 4_000_000,  rate: 0.15 },
    { up: 6_000_000,  rate: 0.20 },
    { up: 10_000_000, rate: 0.25 },
    { up: Infinity,   rate: 0.35 },
  ];
  let tax = 0, prev = 0;
  for (const { up, rate } of brackets) {
    if (annualIncome <= prev) break;
    tax += (Math.min(annualIncome, up) - prev) * rate;
    prev = up;
  }
  return Math.round(tax);
}

/** Patente Togo (taux selon CA et secteur) */
function computePatente(
  caHt: number,
  sector: "CO" | "SE" | "BTP" | "TEL" | "IND" | string,
): number {
  const tables: Record<string, number[]> = {
    CO:  [0.0055, 0.006,  0.0065, 0.007],
    HO:  [0.0055, 0.006,  0.0065, 0.007],
    PH:  [0.0055, 0.006,  0.0065, 0.007],
    SE:  [0.0075, 0.008,  0.010,  0.012],
    ASS: [0.0075, 0.008,  0.010,  0.012],
    BE:  [0.0075, 0.008,  0.010,  0.012],
    BTP: [0.0075, 0.008,  0.010,  0.012],
    TEL: [0.008,  0.0095, 0.010,  0.012],
    TI:  [0.008,  0.0095, 0.010,  0.012],
    IND: [0.007,  0.008,  0.009,  0.010],
  };
  const rates = tables[sector] ?? tables["SE"];
  const slabs = [500_000_000, 10_000_000_000, 50_000_000_000, Infinity];
  for (let i = 0; i < slabs.length; i++) {
    if (caHt <= slabs[i]) return Math.round(caHt * rates[i]);
  }
  return Math.round(caHt * rates[3]);
}

/** IS Togo 27%, avec IMF 1% CAHT minimum */
function computeIs(netProfit: number, caHt: number): { is: number; imf: number; payable: number } {
  const is = Math.round(Math.max(0, netProfit) * 0.27);
  const imf = Math.round(caHt * 0.01);
  const payable = Math.max(is, imf);
  return { is, imf, payable };
}

/** TVA Togo 18% */
function computeVat(caHt: number, vatDeductible = 0): { collected: number; deductible: number; net: number } {
  const collected = Math.round(caHt * 0.18);
  const net = Math.max(0, collected - vatDeductible);
  return { collected, deductible: vatDeductible, net };
}

// ─────────────────────────────────────────────────────────
// TAUX
// ─────────────────────────────────────────────────────────
router.get("/fiscal/engine/rates", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const rates = await db.select().from(taxRateConfigsTable)
      .where(eq(taxRateConfigsTable.organizationId, orgId))
      .orderBy(asc(taxRateConfigsTable.taxCode));
    res.json(rates.map((r) => ({ ...r, rate: toNum(r.rate), fixedAmount: toNum(r.fixedAmount) })));
  } catch (e) { next(e); }
});

router.post("/fiscal/engine/rates", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const userId = req.authUser!.id;
    const body = req.body as Record<string, unknown>;

    // Upsert par taxCode+country
    const existing = await db.select({ id: taxRateConfigsTable.id })
      .from(taxRateConfigsTable)
      .where(and(
        eq(taxRateConfigsTable.organizationId, orgId),
        eq(taxRateConfigsTable.taxCode, String(body.taxCode ?? "")),
        eq(taxRateConfigsTable.country, String(body.country ?? "TG")),
      )).limit(1);

    const data = {
      organizationId: orgId,
      country: String(body.country ?? "TG"),
      taxCode: String(body.taxCode ?? ""),
      taxLabel: String(body.taxLabel ?? ""),
      legalRef: body.legalRef ? String(body.legalRef) : null,
      rate: body.rate != null ? String(body.rate) : null,
      fixedAmount: body.fixedAmount != null ? String(body.fixedAmount) : null,
      calculationBase: String(body.calculationBase ?? "revenue_ht"),
      declarationFrequency: String(body.declarationFrequency ?? "monthly"),
      dueDayOfPeriod: body.dueDayOfPeriod ? Number(body.dueDayOfPeriod) : null,
      applicableSectors: body.applicableSectors ?? null,
      advancePaymentsPerYear: Number(body.advancePaymentsPerYear ?? 0),
      advancePaymentDates: body.advancePaymentDates ?? null,
      isActive: body.isActive !== false,
      notes: body.notes ? String(body.notes) : null,
      createdById: userId,
    };

    if (existing.length > 0) {
      const [updated] = await db.update(taxRateConfigsTable)
        .set(data).where(eq(taxRateConfigsTable.id, existing[0].id)).returning();
      res.json(updated);
    } else {
      const [created] = await db.insert(taxRateConfigsTable).values(data).returning();
      res.status(201).json(created);
    }
  } catch (e) { next(e); }
});

router.delete("/fiscal/engine/rates/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const id = req.params.id as string;
    await db.delete(taxRateConfigsTable).where(and(
      eq(taxRateConfigsTable.id, id),
      eq(taxRateConfigsTable.organizationId, orgId),
    ));
    res.status(204).end();
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────
// SEEDER TAUX TOGO PAR DÉFAUT
// ─────────────────────────────────────────────────────────
router.post("/fiscal/engine/seed-togo", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const userId = req.authUser!.id;

    const togoRates = [
      { taxCode: "TVA",     taxLabel: "Taxe sur la Valeur Ajoutée",               legalRef: "CGI Art. 64", rate: "18",   calculationBase: "revenue_ht",    declarationFrequency: "monthly",  dueDayOfPeriod: 15 },
      { taxCode: "IS",      taxLabel: "Impôt sur les Sociétés",                   legalRef: "CGI Art. 91-117", rate: "27", calculationBase: "net_profit",  declarationFrequency: "annual",   dueDayOfPeriod: 31, advancePaymentsPerYear: 4, advancePaymentDates: ["01-31","05-31","07-31","10-31"] },
      { taxCode: "IMF",     taxLabel: "Impôt Minimum Forfaitaire",                legalRef: "CGI Art. 120-121", rate: "1", calculationBase: "turnover",    declarationFrequency: "annual",   dueDayOfPeriod: 31 },
      { taxCode: "PATENTE", taxLabel: "Patente",                                  legalRef: "CGI Art. 254",  rate: null, calculationBase: "turnover",      declarationFrequency: "annual",   dueDayOfPeriod: 31, advancePaymentsPerYear: 4, advancePaymentDates: ["01-31","05-31","07-31","10-31"] },
      { taxCode: "IRPP",    taxLabel: "Impôt sur le Revenu des Personnes Phys.", legalRef: "CGI Barème",    rate: null, calculationBase: "gross_salary",   declarationFrequency: "monthly",  dueDayOfPeriod: 15 },
      { taxCode: "CNSS",    taxLabel: "Cotisations CNSS",                         legalRef: "Code Travail",  rate: "20.4", calculationBase: "gross_salary", declarationFrequency: "monthly",  dueDayOfPeriod: 15 },
      { taxCode: "IPTS",    taxLabel: "Impôt Proportionnel sur Traitements et Salaires", legalRef: "CGI",   rate: "2",  calculationBase: "gross_salary",   declarationFrequency: "monthly",  dueDayOfPeriod: 15 },
      { taxCode: "RS",      taxLabel: "Retenue à la Source",                      legalRef: "CGI Art. 55",   rate: "5",  calculationBase: "payment",        declarationFrequency: "monthly",  dueDayOfPeriod: 15 },
      { taxCode: "TFPB",    taxLabel: "Taxe Foncière sur Propriétés Bâties",     legalRef: "CGI Art. 257",  rate: "7.5", calculationBase: "property_value", declarationFrequency: "annual",  dueDayOfPeriod: 31 },
      { taxCode: "TFPNB",   taxLabel: "Taxe Foncière sur Propriétés Non Bâties", legalRef: "CGI Art. 257",  rate: "0.5", calculationBase: "property_value", declarationFrequency: "annual",  dueDayOfPeriod: 31 },
      { taxCode: "DE",      taxLabel: "Droits d'Enregistrement",                  legalRef: "CGI Art. 300-555", rate: null, calculationBase: "transaction_value", declarationFrequency: "on_event", dueDayOfPeriod: 90 },
    ];

    let seeded = 0;
    for (const r of togoRates) {
      const exists = await db.select({ id: taxRateConfigsTable.id })
        .from(taxRateConfigsTable)
        .where(and(eq(taxRateConfigsTable.organizationId, orgId), eq(taxRateConfigsTable.taxCode, r.taxCode)))
        .limit(1);
      if (exists.length === 0) {
        await db.insert(taxRateConfigsTable).values({
          organizationId: orgId,
          country: "TG",
          ...r,
          rate: r.rate ?? null,
          fixedAmount: null,
          applicableSectors: null,
          advancePaymentsPerYear: r.advancePaymentsPerYear ?? 0,
          advancePaymentDates: r.advancePaymentDates ?? null,
          isActive: true,
          createdById: userId,
        });
        seeded++;
      }
    }

    // Seeder les tranches de patente
    const patenteBrackets = [
      { sector: "CO",  sectorLabel: "Commerce / Hôtellerie / Pharmacie", fromAmount: "0",                toAmount: "500000000",      rate: "0.0055" },
      { sector: "CO",  sectorLabel: "Commerce / Hôtellerie / Pharmacie", fromAmount: "500000001",        toAmount: "10000000000",    rate: "0.006"  },
      { sector: "CO",  sectorLabel: "Commerce / Hôtellerie / Pharmacie", fromAmount: "10000000001",      toAmount: "50000000000",    rate: "0.0065" },
      { sector: "CO",  sectorLabel: "Commerce / Hôtellerie / Pharmacie", fromAmount: "50000000001",      toAmount: null,             rate: "0.007"  },
      { sector: "SE",  sectorLabel: "Services / Assurances / BTP",       fromAmount: "0",                toAmount: "500000000",      rate: "0.0075" },
      { sector: "SE",  sectorLabel: "Services / Assurances / BTP",       fromAmount: "500000001",        toAmount: "10000000000",    rate: "0.008"  },
      { sector: "SE",  sectorLabel: "Services / Assurances / BTP",       fromAmount: "10000000001",      toAmount: "50000000000",    rate: "0.010"  },
      { sector: "SE",  sectorLabel: "Services / Assurances / BTP",       fromAmount: "50000000001",      toAmount: null,             rate: "0.012"  },
      { sector: "TEL", sectorLabel: "Téléphonie / Technologies",          fromAmount: "0",                toAmount: "500000000",      rate: "0.008"  },
      { sector: "TEL", sectorLabel: "Téléphonie / Technologies",          fromAmount: "500000001",        toAmount: "10000000000",    rate: "0.0095" },
      { sector: "TEL", sectorLabel: "Téléphonie / Technologies",          fromAmount: "10000000001",      toAmount: "50000000000",    rate: "0.010"  },
      { sector: "TEL", sectorLabel: "Téléphonie / Technologies",          fromAmount: "50000000001",      toAmount: null,             rate: "0.012"  },
      { sector: "IND", sectorLabel: "Industries",                         fromAmount: "0",                toAmount: "500000000",      rate: "0.007"  },
      { sector: "IND", sectorLabel: "Industries",                         fromAmount: "500000001",        toAmount: "10000000000",    rate: "0.008"  },
      { sector: "IND", sectorLabel: "Industries",                         fromAmount: "10000000001",      toAmount: "50000000000",    rate: "0.009"  },
      { sector: "IND", sectorLabel: "Industries",                         fromAmount: "50000000001",      toAmount: null,             rate: "0.010"  },
    ];
    for (const b of patenteBrackets) {
      await db.insert(patenteBracketsTable).values({
        organizationId: orgId,
        country: "TG",
        ...b,
        toAmount: b.toAmount ?? null,
        isActive: true,
      }).onConflictDoNothing();
    }

    res.json({ message: `Taux Togo semés avec succès (${seeded} nouveaux taux + tranches patente).` });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────
// OBLIGATIONS FISCALES
// ─────────────────────────────────────────────────────────
router.get("/fiscal/engine/obligations", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { fiscalYear, status, taxCode } = req.query as Record<string, string>;

    const conditions = [eq(taxObligationsTable.organizationId, orgId)];
    if (fiscalYear) conditions.push(eq(taxObligationsTable.fiscalYear, fiscalYear));
    if (status)     conditions.push(eq(taxObligationsTable.status, status));
    if (taxCode)    conditions.push(eq(taxObligationsTable.taxCode, taxCode));

    const obligations = await db.select().from(taxObligationsTable)
      .where(and(...conditions))
      .orderBy(asc(taxObligationsTable.dueDate));

    res.json(obligations.map((o) => ({
      ...o,
      calculatedAmount: toNum(o.calculatedAmount),
      declaredAmount: toNum(o.declaredAmount),
      paidAmount: toNum(o.paidAmount),
      latePenalty: toNum(o.latePenalty),
      balance: toNum(o.declaredAmount) - toNum(o.paidAmount),
    })));
  } catch (e) { next(e); }
});

router.post("/fiscal/engine/obligations", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const userId = req.authUser!.id;
    const body = req.body as Record<string, unknown>;

    const [created] = await db.insert(taxObligationsTable).values({
      organizationId: orgId,
      taxCode:       String(body.taxCode ?? ""),
      taxLabel:      String(body.taxLabel ?? ""),
      fiscalYear:    String(body.fiscalYear ?? new Date().getFullYear()),
      period:        String(body.period ?? ""),
      periodLabel:   String(body.periodLabel ?? ""),
      status:        String(body.status ?? "upcoming"),
      calculatedAmount: body.calculatedAmount ? String(body.calculatedAmount) : null,
      declaredAmount:   body.declaredAmount   ? String(body.declaredAmount)   : null,
      dueDate:       String(body.dueDate ?? ""),
      obligationType: String(body.obligationType ?? "payment"),
      notes: body.notes ? String(body.notes) : null,
      responsibleId: userId,
      createdById:   userId,
    }).returning();
    res.status(201).json({ ...created, calculatedAmount: toNum(created.calculatedAmount), paidAmount: 0 });
  } catch (e) { next(e); }
});

router.patch("/fiscal/engine/obligations/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const id = req.params.id as string;
    const body = req.body as Record<string, unknown>;

    const update: Record<string, unknown> = {};
    if (body.status       !== undefined) update.status       = body.status;
    if (body.declaredAmount !== undefined) update.declaredAmount = String(body.declaredAmount);
    if (body.calculatedAmount !== undefined) update.calculatedAmount = String(body.calculatedAmount);
    if (body.referenceNumber !== undefined) update.referenceNumber = body.referenceNumber;
    if (body.submittedDate !== undefined) update.submittedDate = body.submittedDate;
    if (body.notes         !== undefined) update.notes         = body.notes;

    const [updated] = await db.update(taxObligationsTable)
      .set(update).where(and(eq(taxObligationsTable.id, id), eq(taxObligationsTable.organizationId, orgId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Obligation introuvable." }); return; }
    res.json({ ...updated, calculatedAmount: toNum(updated.calculatedAmount), paidAmount: toNum(updated.paidAmount) });
  } catch (e) { next(e); }
});

router.post("/fiscal/engine/obligations/:id/pay", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const userId = req.authUser!.id;
    const id = req.params.id as string;
    const { amount, paymentDate, paymentMethod, referenceNumber, notes } = req.body as Record<string, unknown>;

    const [obligation] = await db.select().from(taxObligationsTable)
      .where(and(eq(taxObligationsTable.id, id), eq(taxObligationsTable.organizationId, orgId))).limit(1);
    if (!obligation) { res.status(404).json({ error: "Obligation introuvable." }); return; }

    // Enregistrer le paiement
    await db.insert(taxObligationPaymentsTable).values({
      organizationId: orgId,
      obligationId: id,
      amount: String(amount ?? 0),
      paymentDate: String(paymentDate ?? new Date().toISOString().slice(0, 10)),
      paymentMethod: String(paymentMethod ?? "virement"),
      referenceNumber: referenceNumber ? String(referenceNumber) : null,
      notes: notes ? String(notes) : null,
      recordedById: userId,
    });

    // Mettre à jour le montant payé
    const newPaid = toNum(obligation.paidAmount) + Number(amount ?? 0);
    const declared = toNum(obligation.declaredAmount);
    const newStatus = newPaid >= declared ? "paid" : "due";

    const [updated] = await db.update(taxObligationsTable)
      .set({ paidAmount: String(newPaid), paidDate: newStatus === "paid" ? String(paymentDate ?? new Date().toISOString().slice(0, 10)) : null, status: newStatus })
      .where(eq(taxObligationsTable.id, id)).returning();

    res.json({ ...updated, paidAmount: toNum(updated.paidAmount), balance: toNum(updated.declaredAmount) - newPaid });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────
// SIMULATION FISCALE
// ─────────────────────────────────────────────────────────
router.post("/fiscal/engine/simulate", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const userId = req.authUser!.id;
    const {
      label, fiscalYear, country = "TG",
      turnover = 0, netProfit = 0, vatDeductible = 0,
      sector = "SE", employeeCount = 0, totalGrossSalary = 0,
      save = false,
    } = req.body as {
      label?: string; fiscalYear?: string; country?: string;
      turnover?: number; netProfit?: number; vatDeductible?: number;
      sector?: string; employeeCount?: number; totalGrossSalary?: number;
      save?: boolean;
    };

    const vat = computeVat(turnover, vatDeductible);
    const isResult = computeIs(netProfit, turnover);
    const patente = computePatente(turnover, sector);
    const cnssTotal = Math.round(totalGrossSalary * 0.164);
    const irppEstimate = Math.round(computeIrpp(totalGrossSalary / Math.max(1, employeeCount) * 12) * employeeCount / 12);
    const iptsTotal = Math.round(totalGrossSalary * 0.02);

    const results = {
      tva:     { collected: vat.collected, deductible: vat.deductible, net: vat.net },
      is:      { calculated: isResult.is, imf: isResult.imf, payable: isResult.payable },
      patente: { amount: patente, sector },
      cnss:    { employerShare: cnssTotal },
      irpp:    { estimated: irppEstimate },
      ipts:    { total: iptsTotal },
      totaux: {
        charges_fiscales: vat.net + isResult.payable + patente,
        charges_sociales: cnssTotal + irppEstimate + iptsTotal,
        total: vat.net + isResult.payable + patente + cnssTotal + irppEstimate + iptsTotal,
        effective_rate: turnover > 0
          ? Math.round(((vat.net + isResult.payable + patente) / turnover) * 10000) / 100
          : 0,
      },
    };

    const totalBurden = results.totaux.total;
    const effectiveRate = results.totaux.effective_rate;

    let simulation = null;
    if (save && label) {
      const [saved] = await db.insert(taxSimulationsTable).values({
        organizationId: orgId,
        label,
        fiscalYear: String(fiscalYear ?? new Date().getFullYear()),
        country,
        inputs: { turnover, netProfit, vatDeductible, sector, employeeCount, totalGrossSalary },
        results,
        totalTaxBurden: String(totalBurden),
        effectiveTaxRate: String(effectiveRate / 100),
        createdById: userId,
      }).returning();
      simulation = saved;
    }

    res.json({ results, totalBurden, effectiveRate, simulation });
  } catch (e) { next(e); }
});

router.get("/fiscal/engine/simulations", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const sims = await db.select().from(taxSimulationsTable)
      .where(eq(taxSimulationsTable.organizationId, orgId))
      .orderBy(desc(taxSimulationsTable.createdAt));
    res.json(sims.map((s) => ({ ...s, totalTaxBurden: toNum(s.totalTaxBurden), effectiveTaxRate: toNum(s.effectiveTaxRate) })));
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────
// DASHBOARD FISCAL
// ─────────────────────────────────────────────────────────
router.get("/fiscal/engine/dashboard", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    const allObligations = await db.select().from(taxObligationsTable)
      .where(eq(taxObligationsTable.organizationId, orgId));

    const upcoming = allObligations.filter((o) => o.dueDate >= today && o.dueDate <= in30 && o.status !== "paid");
    const overdue  = allObligations.filter((o) => o.dueDate < today  && o.status !== "paid");
    const paid     = allObligations.filter((o) => o.status === "paid");

    const totalDue  = overdue.reduce((s, o)  => s + toNum(o.declaredAmount) - toNum(o.paidAmount), 0);
    const totalPaid = paid.reduce((s, o)     => s + toNum(o.paidAmount), 0);

    res.json({
      summary: {
        upcoming: upcoming.length,
        overdue:  overdue.length,
        paid:     paid.length,
        total:    allObligations.length,
        totalDue,
        totalPaid,
      },
      upcomingObligations: upcoming.slice(0, 5).map((o) => ({
        ...o,
        calculatedAmount: toNum(o.calculatedAmount),
        paidAmount: toNum(o.paidAmount),
        balance: toNum(o.declaredAmount) - toNum(o.paidAmount),
        daysUntilDue: Math.round((new Date(o.dueDate).getTime() - Date.now()) / 86400000),
      })),
      overdueObligations: overdue.map((o) => ({
        ...o,
        calculatedAmount: toNum(o.calculatedAmount),
        paidAmount: toNum(o.paidAmount),
        balance: toNum(o.declaredAmount) - toNum(o.paidAmount),
        daysOverdue: Math.round((Date.now() - new Date(o.dueDate).getTime()) / 86400000),
      })),
    });
  } catch (e) { next(e); }
});

export default router;
