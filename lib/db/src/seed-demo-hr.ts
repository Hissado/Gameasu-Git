/**
 * Seed démo RH — Gameasu
 *
 * Ajoute :
 *  - 5 départements
 *  - 12 postes
 *  - 7 nouveaux collaborateurs (DG, DT, Comptable, Commercial×2, Conducteur, Assistante)
 *  - Mise à jour salaires + département des 5 collaborateurs existants (seed.ts)
 *  - 12 contrats CDI
 *  - 6 demandes de congé
 *  - 3 sessions de formation + participants
 *  - 4 offres d'emploi + 8 candidatures
 *
 * Idempotent : skip si des départements existent déjà.
 * Lancement :
 *   cd lib/db && pnpm exec tsx src/seed-demo-hr.ts
 */

import { db } from "./index";
import { eq } from "drizzle-orm";
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

export async function seedDemoHR() {
  console.log("→ Seed RH démo démarré…");

  const [org] = await db.select().from(organizationsTable)
    .where(eq(organizationsTable.slug, "nexora-demo")).limit(1);
  if (!org) { console.log("  ✗ Org nexora-demo introuvable — skip"); return; }
  const orgId = org.id;

  // Idempotence
  const deptCheck = await db.select({ id: departmentsTable.id })
    .from(departmentsTable).where(eq(departmentsTable.organizationId, orgId)).limit(1);
  if (deptCheck.length > 0) { console.log("  ✓ Départements déjà présents — skip RH"); return; }

  // ─── 1. Départements ──────────────────────────────────────────────────────
  console.log("  • Départements (5)");
  const [dTech, dOps, dAdm, dCom, dLog] = await db.insert(departmentsTable).values([
    { organizationId: orgId, code: "TECH", name: "Direction Technique",              color: "#0EA5E9", description: "Études, conception, ingénierie et contrôle qualité" },
    { organizationId: orgId, code: "OPS",  name: "Opérations & Chantier",           color: "#10B981", description: "Exécution des chantiers, équipes terrain et HSE" },
    { organizationId: orgId, code: "ADM",  name: "Administration & Finance",         color: "#64748B", description: "Comptabilité générale, RH, services administratifs" },
    { organizationId: orgId, code: "COM",  name: "Commercial & Marketing",           color: "#A855F7", description: "Développement commercial, devis, CRM, marketing" },
    { organizationId: orgId, code: "LOG",  name: "Logistique & Approvisionnement",   color: "#F59E0B", description: "Transport, entrepôt, gestion des achats et stocks" },
  ]).returning();

  if (!dTech || !dOps || !dAdm || !dCom || !dLog) {
    console.log("  ✗ Impossible de créer les départements"); return;
  }

  // ─── 2. Postes ────────────────────────────────────────────────────────────
  console.log("  • Postes (12)");
  const [pDG, pDT, pIng, pTechElec, pChef, pCond, pOuvr,
         pComDir, pComTer, pCpt, pAss, pLogResp] = await db.insert(positionsTable).values([
    { organizationId: orgId, code: "DG",      title: "Directeur Général",                departmentId: dAdm.id, level: 5 },
    { organizationId: orgId, code: "DT",      title: "Directeur Technique",               departmentId: dTech.id, level: 4 },
    { organizationId: orgId, code: "ING-SR",  title: "Ingénieur(e) Senior",               departmentId: dTech.id, level: 3 },
    { organizationId: orgId, code: "TECH-E",  title: "Technicien(ne) Électricien(ne)",    departmentId: dTech.id, level: 2 },
    { organizationId: orgId, code: "CHEF-C",  title: "Chef de Chantier",                  departmentId: dOps.id,  level: 3 },
    { organizationId: orgId, code: "COND",    title: "Conducteur de Travaux",             departmentId: dOps.id,  level: 2 },
    { organizationId: orgId, code: "OUVR-Q",  title: "Ouvrier Qualifié / Soudeur",        departmentId: dOps.id,  level: 1 },
    { organizationId: orgId, code: "DIR-COM", title: "Directeur Commercial",              departmentId: dCom.id,  level: 4 },
    { organizationId: orgId, code: "COM-TER", title: "Commercial(e) Terrain",             departmentId: dCom.id,  level: 2 },
    { organizationId: orgId, code: "CPT",     title: "Comptable Général(e)",              departmentId: dAdm.id,  level: 2 },
    { organizationId: orgId, code: "ASS-ADM", title: "Assistant(e) Administratif(ve)",   departmentId: dAdm.id,  level: 1 },
    { organizationId: orgId, code: "LOG-R",   title: "Responsable Logistique",            departmentId: dLog.id,  level: 3 },
  ]).returning();

  // ─── 3. Mise à jour des collaborateurs existants (depuis seed.ts) ─────────
  console.log("  • Mise à jour collaborateurs existants (salaires + depts)");
  const existingCollabs = await db.select().from(collaboratorsTable)
    .where(eq(collaboratorsTable.organizationId, orgId));

  // Mapping email → (salaire, département, poste)
  const existingUpdates: Record<string, { salary: string; deptId: string; posId: string | undefined; empNum: string }> = {
    "r.essomba@gameasu.com":  { salary: "450000", deptId: dTech.id, posId: pTechElec?.id, empNum: "EMP-008" },
    "f.diallo@gameasu.com":   { salary: "520000", deptId: dTech.id, posId: pIng?.id,       empNum: "EMP-009" },
    "jb.mfoumou@gameasu.com": { salary: "380000", deptId: dOps.id,  posId: pChef?.id,      empNum: "EMP-010" },
    "a.toure@gameasu.com":    { salary: "320000", deptId: dLog.id,  posId: pLogResp?.id,   empNum: "EMP-011" },
    "o.bekono@gameasu.com":   { salary: "290000", deptId: dOps.id,  posId: pOuvr?.id,      empNum: "EMP-012" },
  };

  for (const c of existingCollabs) {
    const upd = c.email ? existingUpdates[c.email] : undefined;
    if (!upd) continue;
    await db.update(collaboratorsTable).set({
      baseSalary: upd.salary, departmentId: upd.deptId, positionId: upd.posId,
      employeeNumber: upd.empNum, employerChargeRate: "18.4",
      transportAllowance: "30000", weeklyHours: "40",
    }).where(eq(collaboratorsTable.id, c.id)).catch(() => {});
  }

  // ─── 4. Nouveaux collaborateurs (7) ──────────────────────────────────────
  console.log("  • Nouveaux collaborateurs (7)");
  const newCollabs = await db.insert(collaboratorsTable).values([
    {
      organizationId: orgId, employeeNumber: "EMP-001",
      firstName: "Jacques", lastName: "Mballa",
      email: "j.mballa@gameasu.tg", phone: "+237 677 000 001",
      position: "Directeur Général", department: "Administration",
      positionId: pDG?.id, departmentId: dAdm.id,
      hireDate: D(2018, 3, 1), baseSalary: "950000",
      employerChargeRate: "18.4", transportAllowance: "75000", housingAllowance: "120000",
      weeklyHours: "40", employmentStatus: "active", isAvailable: true,
    },
    {
      organizationId: orgId, employeeNumber: "EMP-002",
      firstName: "Aissatou", lastName: "Bah",
      email: "a.bah@gameasu.tg", phone: "+237 677 000 002",
      position: "Directrice Technique", department: "Technique",
      positionId: pDT?.id, departmentId: dTech.id,
      hireDate: D(2019, 7, 15), baseSalary: "780000",
      employerChargeRate: "18.4", transportAllowance: "60000", housingAllowance: "80000",
      weeklyHours: "40", employmentStatus: "active", isAvailable: true,
    },
    {
      organizationId: orgId, employeeNumber: "EMP-003",
      firstName: "Kofi", lastName: "Asante",
      email: "k.asante@gameasu.tg", phone: "+237 677 000 003",
      position: "Directeur Commercial", department: "Commercial",
      positionId: pComDir?.id, departmentId: dCom.id,
      hireDate: D(2020, 1, 10), baseSalary: "620000",
      employerChargeRate: "18.4", transportAllowance: "50000",
      weeklyHours: "40", employmentStatus: "active", isAvailable: true,
    },
    {
      organizationId: orgId, employeeNumber: "EMP-004",
      firstName: "Sylvie", lastName: "Ekanga",
      email: "s.ekanga@gameasu.tg", phone: "+237 677 000 010",
      position: "Comptable Général", department: "Administration",
      positionId: pCpt?.id, departmentId: dAdm.id,
      hireDate: D(2021, 4, 1), baseSalary: "420000",
      employerChargeRate: "18.4", transportAllowance: "30000",
      weeklyHours: "40", employmentStatus: "active", isAvailable: true,
    },
    {
      organizationId: orgId, employeeNumber: "EMP-005",
      firstName: "Pascal", lastName: "Nkolo",
      email: "p.nkolo@gameasu.tg", phone: "+237 677 000 011",
      position: "Commercial Terrain", department: "Commercial",
      positionId: pComTer?.id, departmentId: dCom.id,
      hireDate: D(2022, 6, 15), baseSalary: "320000",
      employerChargeRate: "18.4", transportAllowance: "45000",
      weeklyHours: "40", employmentStatus: "active", isAvailable: true,
    },
    {
      organizationId: orgId, employeeNumber: "EMP-006",
      firstName: "Hervé", lastName: "Boua",
      email: "h.boua@gameasu.tg", phone: "+237 677 200 006",
      position: "Conducteur de Travaux", department: "Opérations",
      positionId: pCond?.id, departmentId: dOps.id,
      hireDate: D(2021, 9, 1), baseSalary: "350000",
      employerChargeRate: "18.4", transportAllowance: "35000",
      weeklyHours: "45", employmentStatus: "active", isAvailable: true,
    },
    {
      organizationId: orgId, employeeNumber: "EMP-007",
      firstName: "Chloé", lastName: "Mbassi",
      email: "c.mbassi@gameasu.tg", phone: "+237 677 200 007",
      position: "Assistante Administrative", department: "Administration",
      positionId: pAss?.id, departmentId: dAdm.id,
      hireDate: D(2023, 2, 20), baseSalary: "240000",
      employerChargeRate: "18.4", transportAllowance: "25000",
      weeklyHours: "40", employmentStatus: "active", isAvailable: true,
    },
  ]).returning();

  // ─── 5. Contrats CDI ──────────────────────────────────────────────────────
  console.log("  • Contrats CDI");
  const allCollabs = await db.select().from(collaboratorsTable)
    .where(eq(collaboratorsTable.organizationId, orgId));

  for (const c of allCollabs) {
    if (!c.hireDate || !c.baseSalary) continue;
    await db.insert(contractsTable).values({
      organizationId: orgId,
      collaboratorId: c.id,
      type: "CDI",
      status: "active",
      startDate: c.hireDate,
      monthlySalary: c.baseSalary,
      currency: "XOF",
      jobTitle: c.position ?? "Collaborateur",
      workLocation: "Lomé, Togo",
      weeklyHours: c.weeklyHours ?? "40",
      signedAt: new Date(`${c.hireDate}T09:00:00Z`),
    }).catch(() => {});
  }

  // ─── 6. Demandes de congé (6) ────────────────────────────────────────────
  console.log("  • Congés (6)");
  const c0 = allCollabs[0];
  const c1 = allCollabs[1];
  const c2 = allCollabs[2];
  const c3 = allCollabs[3];
  const c4 = allCollabs[4];
  const c5 = allCollabs[5];

  const leaveData = [
    { collaboratorId: c0?.id, type: "congé_payé", startDate: D(2026,6,1),  endDate: D(2026,6,14), days: "10", status: "approved", reason: "Congés annuels d'été" },
    { collaboratorId: c1?.id, type: "congé_payé", startDate: D(2026,7,15), endDate: D(2026,7,31), days: "12", status: "approved", reason: "Congés été — 12 jours" },
    { collaboratorId: c2?.id, type: "maladie",    startDate: D(2026,4,8),  endDate: D(2026,4,10), days: "3",  status: "approved", reason: "Arrêt médical — certificat médecin CHU-SO" },
    { collaboratorId: c3?.id, type: "formation",  startDate: D(2026,5,19), endDate: D(2026,5,23), days: "5",  status: "approved", reason: "Formation HSE Bureau Veritas Togo" },
    { collaboratorId: c4?.id, type: "congé_payé", startDate: D(2026,8,1),  endDate: D(2026,8,14), days: "10", status: "pending",  reason: "Congés planifiés — août" },
    { collaboratorId: c5?.id, type: "sans_solde", startDate: D(2026,6,15), endDate: D(2026,6,30), days: "11", status: "pending",  reason: "Raisons personnelles familiales" },
  ];

  for (const l of leaveData) {
    if (!l.collaboratorId) continue;
    await db.insert(leaveRequestsTable).values({ organizationId: orgId, ...l }).catch(() => {});
  }

  // ─── 7. Formations (3) ────────────────────────────────────────────────────
  console.log("  • Formations (3)");
  const trainings = await db.insert(trainingSessionsTable).values([
    {
      organizationId: orgId,
      title: "HSE Chantier & Prévention des risques",
      type: "externe", provider: "Bureau Veritas Togo",
      location: "Lomé — Centre de formation BIVAC",
      startDate: D(2026,5,19), endDate: D(2026,5,23),
      durationHours: "40", cost: "580000", currency: "XOF",
      status: "ongoing",
      description: "Sécurité obligatoire : port EPI, secourisme, plan évacuation, prévention risques chantier.",
    },
    {
      organizationId: orgId,
      title: "CACES Grue à Tour & Mobile — R487",
      type: "externe", provider: "Centre Agréé CACES Afrique",
      location: "Abidjan — Site de formation mécanique",
      startDate: D(2026,7,7), endDate: D(2026,7,18),
      durationHours: "70", cost: "1200000", currency: "XOF",
      status: "planned",
      description: "Renouvellement certification CACES cat. 1 et 2 — obligatoire tous les 5 ans.",
    },
    {
      organizationId: orgId,
      title: "Comptabilité SYSCOHADA & Fiscalité Togo",
      type: "externe", provider: "Cabinet Finances & Gestion Togo (CFG)",
      location: "Lomé — Cabinet CFG, Bè-Kpota",
      startDate: D(2026,4,7), endDate: D(2026,4,11),
      durationHours: "30", cost: "480000", currency: "XOF",
      status: "completed",
      description: "Mise à jour OHADA 2024 : nouvelles règles amortissement, fiscalité IS Togo, TVA.",
    },
  ]).returning();

  // Participants aux formations
  const [tr0, tr1, tr2] = trainings;
  if (tr0 && c2 && c3) {
    await db.insert(trainingParticipantsTable).values([
      { organizationId: orgId, trainingSessionId: tr0.id, collaboratorId: c2.id, status: "attended" },
      { organizationId: orgId, trainingSessionId: tr0.id, collaboratorId: c3.id, status: "attended" },
    ]).catch(() => {});
  }
  if (tr2 && c4) {
    await db.insert(trainingParticipantsTable).values([
      { organizationId: orgId, trainingSessionId: tr2.id, collaboratorId: c4.id, status: "certified", score: "87", certificationDate: D(2026,4,11) },
    ]).catch(() => {});
  }

  // ─── 8. Offres d'emploi (4) + candidatures (8) ───────────────────────────
  console.log("  • Offres d'emploi (4) + candidatures (8)");
  const [j1, j2, j3, j4] = await db.insert(jobOffersTable).values([
    {
      organizationId: orgId, reference: "REC-2026-001",
      title: "Ingénieur Électrotechnicien Senior", contractType: "CDI",
      departmentId: dTech.id, positionId: pIng?.id,
      status: "in_review", location: "Lomé, Togo", isRemote: false,
      openDate: D(2026,3,15), closeDate: D(2026,5,31),
      salaryMin: "500000", salaryMax: "700000", currency: "XOF", maxCandidates: 3,
      description: "Renforcement équipe technique : études, coordination chantier HTA/HTB, supervision travaux.",
      requirements: "Bac+5 génie électrique, 5+ ans HTA/HTB, maîtrise AutoCAD/CANECO.",
    },
    {
      organizationId: orgId, reference: "REC-2026-002",
      title: "Commercial Terrain BTP — Région Nord", contractType: "CDI",
      departmentId: dCom.id, positionId: pComTer?.id,
      status: "open", location: "Kara / Atakpamé, Togo", isRemote: false,
      openDate: D(2026,4,1), closeDate: D(2026,6,30),
      salaryMin: "280000", salaryMax: "380000", currency: "XOF", maxCandidates: 2,
      description: "Prospection et développement commercial régions Centre et Nord Togo.",
    },
    {
      organizationId: orgId, reference: "REC-2026-003",
      title: "Soudeur TIG/MIG Certifié", contractType: "CDI",
      departmentId: dOps.id, positionId: pOuvr?.id,
      status: "open", location: "Lomé, Togo",
      openDate: D(2026,4,20), closeDate: D(2026,5,31),
      salaryMin: "260000", salaryMax: "340000", currency: "XOF",
      description: "Soudure industrielle TIG/MIG sur chantiers BTP et montages métalliques.",
    },
    {
      organizationId: orgId, reference: "REC-2026-004",
      title: "Responsable Logistique & Entrepôt", contractType: "CDI",
      departmentId: dLog.id, positionId: pLogResp?.id,
      status: "closed", location: "Lomé — Dépôt Akodéséwa",
      openDate: D(2026,1,10), closeDate: D(2026,3,31),
      salaryMin: "350000", salaryMax: "480000", currency: "XOF",
      description: "Gestion dépôt principal, coordination transports, supervision stock équipements.",
    },
  ]).returning();

  if (j1) {
    await db.insert(candidaciesTable).values([
      {
        organizationId: orgId, jobOfferId: j1.id,
        firstName: "Emmanuel", lastName: "Agbodjan", email: "e.agbodjan@gmail.com", phone: "+228 90 11 22 33",
        stage: "interview", rating: 4, source: "linkedin",
        notes: "Profil très solide — 7 ans HTA/HTB au Bénin et Togo. Entretien prévu 28/05.",
        interviewDate: new Date("2026-05-28T10:00:00Z"),
      },
      {
        organizationId: orgId, jobOfferId: j1.id,
        firstName: "Kofi", lastName: "Mensah", email: "k.mensah.ing@yahoo.fr",
        stage: "cv_review", rating: 3, source: "indeed",
        notes: "4 ans d'expérience — profil à approfondir lors du premier entretien.",
      },
      {
        organizationId: orgId, jobOfferId: j1.id,
        firstName: "Ama", lastName: "Owusu", email: "a.owusu.eng@gmail.com",
        stage: "phone_screen", rating: 4, source: "referral",
        notes: "Recommandée par SOGELEC Cameroun. Entretien téléphonique très concluant.",
      },
    ]).catch(() => {});
  }

  if (j2) {
    await db.insert(candidaciesTable).values([
      {
        organizationId: orgId, jobOfferId: j2.id,
        firstName: "Serge", lastName: "Adakpo", email: "s.adakpo@mail.tg", phone: "+228 91 55 88 12",
        stage: "interview", rating: 3, source: "direct",
        notes: "Bonne connaissance terrain Kara/Sokodé.",
      },
      {
        organizationId: orgId, jobOfferId: j2.id,
        firstName: "Adjoa", lastName: "Fiaga", email: "adjoa.fiaga@gmail.com",
        stage: "new", source: "linkedin",
        notes: "CV reçu — à examiner.",
      },
    ]).catch(() => {});
  }

  if (j3) {
    await db.insert(candidaciesTable).values([
      {
        organizationId: orgId, jobOfferId: j3.id,
        firstName: "Mathieu", lastName: "Kodzo", email: "m.kodzo@hotmail.fr",
        stage: "offer", rating: 5, source: "direct",
        notes: "Excellent profil — certifié TIG/MIG Niveau 2. Offre envoyée le 22/05.",
      },
      {
        organizationId: orgId, jobOfferId: j3.id,
        firstName: "Pierre", lastName: "Lawson", email: "p.lawson.soudeur@gmail.com",
        stage: "rejected", rating: 2, source: "indeed",
        rejectionReason: "Certifications expirées depuis 2022 — non conformes au cahier des charges.",
      },
    ]).catch(() => {});
  }

  // Résumé masse salariale
  const allFinal = await db.select().from(collaboratorsTable)
    .where(eq(collaboratorsTable.organizationId, orgId));
  const totalSalary = allFinal.reduce((s, c) => s + parseFloat(c.baseSalary ?? "0"), 0);
  console.log(`\n  👥 Effectif total     : ${allFinal.length} collaborateurs`);
  console.log(`  💰 Masse salariale    : ${(totalSalary / 1e6).toFixed(2)} M FCFA / mois`);

  console.log("\n✅ Seed RH démo terminé !");
}

// ─── Runner direct ───────────────────────────────────────────────────────────
if (process.argv[1]?.endsWith("seed-demo-hr.ts") ||
    process.argv[1]?.endsWith("seed-demo-hr.js")) {
  seedDemoHR()
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}
