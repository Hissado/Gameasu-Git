/**
 * Seed RH supplémentaire — complète les données manquantes :
 *  - Contrats (CDI)
 *  - Demandes de congé (6)
 *  - Sessions de formation + participants (3)
 *  - Offres d'emploi (4)
 *  - Candidatures (9)
 *
 * Idempotent : chaque section vérifie sa propre présence.
 * Lancement :
 *   cd lib/db && pnpm exec tsx src/seed-demo-hr-supplement.ts
 */

import { db } from "./index";
import { eq, sql } from "drizzle-orm";
import {
  organizationsTable,
  collaboratorsTable,
  departmentsTable,
  positionsTable,
  contractsTable,
  leaveRequestsTable,
  trainingSessionsTable,
  trainingParticipantsTable,
  jobOffersTable,
  candidaciesTable,
} from "./schema";

const D = (yyyy: number, mm: number, dd: number) =>
  `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;

export async function seedDemoHRSupplement() {
  console.log("→ Seed RH (supplément) démarré…");

  const [org] = await db.select().from(organizationsTable)
    .where(eq(organizationsTable.slug, "nexora-demo")).limit(1);
  if (!org) { console.log("  ✗ Org nexora-demo introuvable — skip"); return; }
  const orgId = org.id;

  const depts = await db.select({ id: departmentsTable.id, code: departmentsTable.code })
    .from(departmentsTable).where(eq(departmentsTable.organizationId, orgId));
  const dByCode: Record<string, string> = {};
  for (const d of depts) dByCode[d.code] = d.id;

  const positions = await db.select({ id: positionsTable.id, code: positionsTable.code, title: positionsTable.title })
    .from(positionsTable).where(eq(positionsTable.organizationId, orgId));
  const pByCode: Record<string, { id: string; title: string }> = {};
  for (const p of positions) pByCode[p.code] = { id: p.id, title: p.title };

  const collabs = await db.select({ id: collaboratorsTable.id, firstName: collaboratorsTable.firstName })
    .from(collaboratorsTable).where(eq(collaboratorsTable.organizationId, orgId));

  console.log(`  Depts: ${depts.length} | Postes: ${positions.length} | Collabs: ${collabs.length}`);

  // ─── 1. Contrats ──────────────────────────────────────────────────────────
  const contractCnt = await db.select({ c: sql<number>`count(*)::int` })
    .from(contractsTable).where(eq(contractsTable.organizationId, orgId));
  if (contractCnt[0]!.c < 10 && collabs.length >= 8) {
    const positions12 = [
      { code: "CHEF-CHA", salary: "1450000" },
      { code: "DAF",      salary: "1800000" },
      { code: "COND-TVX", salary: "1200000" },
      { code: "RESP-MAT", salary: "1100000" },
      { code: "RRH",      salary: "1050000" },
      { code: "COMPTABLE",salary: "980000"  },
      { code: "COMMERCIAL",salary: "950000" },
      { code: "OUVRIER",  salary: "680000"  },
      { code: "MECANO",   salary: "870000"  },
      { code: "COMM",     salary: "780000"  },
    ];
    const toInsert = collabs.slice(0, 10).map((c, i) => {
      const pos = positions12[i] ?? { code: "OUVRIER", salary: "680000" };
      const posData = pByCode[pos.code];
      return {
        organizationId: orgId,
        collaboratorId: c.id,
        type: i < 8 ? "CDI" : "CDD",
        status: "active" as const,
        startDate: D(2026, 1, 1),
        endDate: i >= 8 ? D(2026, 12, 31) : undefined,
        monthlySalary: pos.salary,
        currency: "XOF",
        jobTitle: posData?.title ?? pos.code,
        weeklyHours: "45",
      };
    });
    await db.insert(contractsTable).values(toInsert).onConflictDoNothing().catch((e) => {
      console.error("  ✗ Contrats:", e.message?.slice(0, 80));
    });
    console.log(`  • Contrats créés (${toInsert.length})`);
  } else {
    console.log(`  ✓ Contrats existants (${contractCnt[0]!.c})`);
  }

  // ─── 2. Demandes de congé ──────────────────────────────────────────────────
  const leaveCnt = await db.select({ c: sql<number>`count(*)::int` })
    .from(leaveRequestsTable).where(eq(leaveRequestsTable.organizationId, orgId));
  if (leaveCnt[0]!.c < 5 && collabs.length >= 6) {
    // type valides : congé_payé | RTT | maladie | maternité | paternité | sans_solde | formation | exceptionnel | autre
    const leaveData = [
      { collaboratorId: collabs[0]!.id, type: "congé_payé",  startDate: D(2026, 7, 14), endDate: D(2026, 7, 25), days: "10", status: "approved", reason: "Congé annuel" },
      { collaboratorId: collabs[1]!.id, type: "congé_payé",  startDate: D(2026, 8,  3), endDate: D(2026, 8, 14), days: "10", status: "approved", reason: "Congé annuel" },
      { collaboratorId: collabs[2]!.id, type: "maladie",     startDate: D(2026, 3, 10), endDate: D(2026, 3, 14), days: "5",  status: "approved", reason: "Arrêt maladie — certificat médical joint" },
      { collaboratorId: collabs[3]!.id, type: "exceptionnel", startDate: D(2026, 6, 1), endDate: D(2026, 6,  7), days: "5",  status: "pending",  reason: "Congé exceptionnel — mariage" },
      { collaboratorId: collabs[4]!.id, type: "RTT",         startDate: D(2026, 5, 19), endDate: D(2026, 5, 23), days: "5",  status: "approved", reason: "Récupération heures supplémentaires Q1" },
      { collaboratorId: collabs[5]!.id, type: "maternité",   startDate: D(2026, 4,  1), endDate: D(2026, 7,  1), days: "90", status: "approved", reason: "Congé maternité — 14 semaines légales" },
    ];
    await db.insert(leaveRequestsTable).values(
      leaveData.map(l => ({ ...l, organizationId: orgId }))
    ).onConflictDoNothing().catch((e) => {
      console.error("  ✗ Congés:", e.message?.slice(0, 80));
    });
    console.log(`  • Demandes de congé créées (${leaveData.length})`);
  } else {
    console.log(`  ✓ Congés existants (${leaveCnt[0]!.c})`);
  }

  // ─── 3. Formations ────────────────────────────────────────────────────────
  const trainCnt = await db.select({ c: sql<number>`count(*)::int` })
    .from(trainingSessionsTable).where(eq(trainingSessionsTable.organizationId, orgId));
  if (trainCnt[0]!.c < 2) {
    const sessions = await db.insert(trainingSessionsTable).values([
      {
        organizationId: orgId,
        title: "Sécurité sur chantier — SYSCOHADA BTP",
        description: "Formation obligatoire : EPI, risques électriques, travail en hauteur, manipulation engins.",
        trainer: "Bureau Véritas Togo",
        startDate: D(2026, 3, 15), endDate: D(2026, 3, 17),
        durationHours: "24",
        location: "Salle de formation siège — Lomé",
        status: "completed" as const,
        maxParticipants: 15,
        cost: "850000", currency: "XOF",
      },
      {
        organizationId: orgId,
        title: "Gestion de projets BTP — Ms Project & GANTT avancé",
        description: "Planification, suivi budgétaire, gestion des ressources et reporting projet.",
        trainer: "GESCOM Consulting Abidjan",
        startDate: D(2026, 4, 22), endDate: D(2026, 4, 24),
        durationHours: "21",
        location: "Centre de formation CCIT — Lomé",
        status: "completed" as const,
        maxParticipants: 10,
        cost: "1200000", currency: "XOF",
      },
      {
        organizationId: orgId,
        title: "Leadership & Management d'équipes terrain",
        description: "Management situationnel, résolution de conflits, motivation d'équipes.",
        trainer: "Institut Africain de Management (IAM)",
        startDate: D(2026, 6, 10), endDate: D(2026, 6, 12),
        durationHours: "18",
        location: "Hôtel Sarakawa — Lomé",
        status: "planned" as const,
        maxParticipants: 12,
        cost: "950000", currency: "XOF",
      },
    ]).returning().catch((e) => {
      console.error("  ✗ Formations:", e.message?.slice(0, 80));
      return [];
    });
    if (sessions.length > 0 && collabs.length >= 6) {
      const p1 = collabs.slice(0, 8).map(c => ({ organizationId: orgId, sessionId: sessions[0]!.id, collaboratorId: c.id, status: "completed" as const }));
      const p2 = collabs.slice(1, 7).map(c => ({ organizationId: orgId, sessionId: sessions[1]!.id, collaboratorId: c.id, status: "completed" as const }));
      await db.insert(trainingParticipantsTable).values([...p1, ...p2]).onConflictDoNothing().catch(() => {});
    }
    console.log(`  • Formations créées (${sessions.length})`);
  } else {
    console.log(`  ✓ Formations existantes (${trainCnt[0]!.c})`);
  }

  // ─── 4. Offres d'emploi ────────────────────────────────────────────────────
  const jobCnt = await db.select({ c: sql<number>`count(*)::int` })
    .from(jobOffersTable).where(eq(jobOffersTable.organizationId, orgId));
  let jobOfferIds: string[] = [];
  if (jobCnt[0]!.c < 2) {
    const dOPS = dByCode["OPS"] ?? Object.values(dByCode)[0]!;
    const dCOM = dByCode["COM"] ?? Object.values(dByCode)[1]!;
    const dMAT = dByCode["MAT"] ?? Object.values(dByCode)[2]!;
    const dCPT = dByCode["CPT"] ?? Object.values(dByCode)[3]!;

    const offers = await db.insert(jobOffersTable).values([
      {
        organizationId: orgId,
        reference: "DEMO-RH-2026-001",
        positionId: pByCode["CHEF-CHA"]?.id,
        departmentId: dOPS,
        title: "Chef de chantier BTP — Projets Infrastructure",
        description: "Nous recrutons un Chef de chantier pour piloter nos projets d'infrastructure routière. Vous superviserez une équipe de 10 à 25 personnes, le suivi technique et budgétaire, et la coordination des sous-traitants.",
        requirements: "BAC+3 Génie Civil • 5 ans chantiers BTP • Normes sécurité • Permis B",
        contractType: "CDI",
        location: "Lomé, Togo — Déplacements régionaux",
        salaryMin: "1200000", salaryMax: "1800000", currency: "XOF",
        status: "open" as const,
        openDate: D(2026, 4, 15), closeDate: D(2026, 6, 30),
      },
      {
        organizationId: orgId,
        reference: "DEMO-RH-2026-002",
        positionId: pByCode["COMMERCIAL"]?.id,
        departmentId: dCOM,
        title: "Commercial·e BTP — Développement Grands Comptes",
        description: "Développement du portefeuille clients sur les marchés publics et privés BTP/minier/pétrolier, réponses aux appels d'offres, négociation contrats.",
        requirements: "BAC+4/5 Commerce • 3 ans vente B2B • CRM • Anglais apprécié",
        contractType: "CDI",
        location: "Lomé, Togo",
        salaryMin: "900000", salaryMax: "1400000", currency: "XOF",
        status: "open" as const,
        openDate: D(2026, 5, 2), closeDate: D(2026, 7, 15),
      },
      {
        organizationId: orgId,
        reference: "DEMO-RH-2026-003",
        positionId: pByCode["MECANO"]?.id,
        departmentId: dMAT,
        title: "Mécanicien engins TP — Parc matériel",
        description: "Maintenance préventive et curative du parc d'engins (grues, compresseurs, groupes électrogènes, camions). Diagnostic mécanique/hydraulique/électrique.",
        requirements: "CAP/BEP Maintenance Engins TP • 4 ans minimum • Diagnostic électronique",
        contractType: "CDI",
        location: "Atelier Agbalépédogan — Lomé",
        salaryMin: "750000", salaryMax: "1100000", currency: "XOF",
        status: "closed" as const,
        openDate: D(2026, 2, 1), closeDate: D(2026, 3, 31),
      },
      {
        organizationId: orgId,
        reference: "DEMO-RH-2026-004",
        positionId: pByCode["COMPTABLE"]?.id ?? pByCode["DAF"]?.id,
        departmentId: dCPT,
        title: "Comptable Principal·e — SYSCOHADA",
        description: "Tenue de la comptabilité générale et analytique SYSCOHADA, états financiers, TVA et déclarations OTR, suivi trésorerie.",
        requirements: "BTS/Licence Comptabilité • 5 ans cabinet ou entreprise • SYSCOHADA, SAGE",
        contractType: "CDI",
        location: "Lomé, Togo",
        salaryMin: "850000", salaryMax: "1300000", currency: "XOF",
        status: "open" as const,
        openDate: D(2026, 5, 20), closeDate: D(2026, 7, 31),
      },
    ]).returning().catch((e) => {
      console.error("  ✗ Offres emploi:", e.message?.slice(0, 120));
      return [];
    });
    jobOfferIds = offers.map(o => o.id);
    console.log(`  • Offres d'emploi créées (${jobOfferIds.length})`);
  } else {
    const existing = await db.select({ id: jobOffersTable.id }).from(jobOffersTable)
      .where(eq(jobOffersTable.organizationId, orgId)).limit(4);
    jobOfferIds = existing.map(o => o.id);
    console.log(`  ✓ Offres d'emploi existantes (${jobCnt[0]!.c})`);
  }

  // ─── 5. Candidatures ──────────────────────────────────────────────────────
  // stage valides : new | cv_review | phone_screen | interview | assessment | offer | hired | rejected
  const candCnt = await db.select({ c: sql<number>`count(*)::int` })
    .from(candidaciesTable).where(eq(candidaciesTable.organizationId, orgId));
  if (candCnt[0]!.c < 5 && jobOfferIds.length >= 2) {
    const [jo1, jo2, jo3, jo4] = jobOfferIds;
    await db.insert(candidaciesTable).values([
      { organizationId: orgId, jobOfferId: jo1!, firstName: "Kodzo",    lastName: "Agbovi",    email: "kodzo.agbovi@gmail.com",      phone: "+228 90 12 34 56", source: "LinkedIn",    stage: "interview" as const, rating: 5, notes: "Profil très solide — 8 ans chantier, 2 réf. vérifiées" },
      { organizationId: orgId, jobOfferId: jo1!, firstName: "Komlan",   lastName: "Houenou",   email: "komlan.houenou@yahoo.fr",     phone: "+228 91 23 45 67", source: "Spontanée",   stage: "cv_review" as const, rating: 4, notes: "6 ans de chantier BTP dont 3 en chef de section" },
      { organizationId: orgId, jobOfferId: jo1!, firstName: "Yawa",     lastName: "Mensah",    email: "yawa.mensah@hotmail.com",     phone: "+228 92 34 56 78", source: "Indeed Africa",stage: "new"       as const, rating: 3, notes: "Ingénieure GC EPAC 2019, expérience Côte d'Ivoire" },
      { organizationId: orgId, jobOfferId: jo2!, firstName: "Edem",     lastName: "Kponton",   email: "edem.kponton@gmail.com",      phone: "+228 93 45 67 89", source: "LinkedIn",    stage: "interview" as const, rating: 5, notes: "Entretien DG prévu 09/06/2026 — 5 ans B2B, 22 clients GC" },
      { organizationId: orgId, jobOfferId: jo2!, firstName: "Abla",     lastName: "Dossou",    email: "abla.dossou@gmail.com",       phone: "+228 94 56 78 90", source: "Cabinet RH",  stage: "cv_review" as const, rating: 4, notes: "Recommandée par Talent Africa — marchés publics SIMTOGO" },
      ...(jo3 ? [
        { organizationId: orgId, jobOfferId: jo3,  firstName: "Akpovi",   lastName: "Gligbedji", email: "akpovi.g@gmail.com",         phone: "+228 95 67 89 01", source: "Spontanée",   stage: "hired"     as const, rating: 5, notes: "Embauché — prise de poste 01/04/2026 — 6 ans CFAO Equipment" },
        { organizationId: orgId, jobOfferId: jo3,  firstName: "Kofi",     lastName: "Tsegah",    email: "kofi.tsegah@outlook.com",     phone: "+228 96 78 90 12", source: "Indeed Africa",stage: "rejected"  as const, rating: 2, notes: "Profil trop junior — 3 ans auto, souhaite se reconvertir TP" },
      ] : []),
      ...(jo4 ? [
        { organizationId: orgId, jobOfferId: jo4,  firstName: "Délali",   lastName: "Afanyi",    email: "delali.afanyi@gmail.com",     phone: "+228 97 89 01 23", source: "Cabinet RH",  stage: "new"       as const, rating: 4, notes: "Comptable SYSCOHADA 7 ans — cabinet Abidjan puis Lomé" },
        { organizationId: orgId, jobOfferId: jo4,  firstName: "Fifame",   lastName: "Lawson",    email: "fifame.lawson@hotmail.com",   phone: "+228 98 90 12 34", source: "LinkedIn",    stage: "new"       as const, rating: 3, notes: "Responsable comptable PME — Sage 100 SYSCOHADA" },
      ] : []),
    ]).onConflictDoNothing().catch((e) => {
      console.error("  ✗ Candidatures:", e.message?.slice(0, 120));
    });
    console.log(`  • Candidatures créées (${4 + (jo3 ? 2 : 0) + (jo4 ? 2 : 0)})`);
  } else {
    console.log(`  ✓ Candidatures existantes (${candCnt[0]!.c})`);
  }

  console.log("\n✅ Seed RH supplémentaire terminé !");
}

if (process.argv[1]?.endsWith("seed-demo-hr-supplement.ts") ||
    process.argv[1]?.endsWith("seed-demo-hr-supplement.js")) {
  seedDemoHRSupplement()
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}
