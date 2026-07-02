/**
 * Seed Hissado Consulting — Gameasu
 *
 * Organisation démo complète : conseil, technologie, finance & transformation
 * digitale — Lomé, Togo.
 *
 * Couvre : Org + abonnement, utilisateurs, RH (depts/postes/collabs/contrats/congés),
 * CRM (clients/contacts/opportunités/activités), projets + phases + tâches,
 * ventes (ordres/proformas/factures/paiements/avoirs), services, équipements,
 * kiosk + pointages, tickets support, notifications, facturation SaaS.
 *
 * Idempotent : skip si l'organisation "hissado-consulting" existe déjà.
 *
 * Lancement :
 *   cd lib/db && pnpm exec tsx src/seed-hissado.ts
 */

import { db } from "./index";
import { eq, and, inArray } from "drizzle-orm";
void inArray;
import {
  organizationsTable, organizationMembersTable,
  organizationSubscriptionsTable, organizationModulesTable,
  subscriptionPlansTable, billingEventsTable, moduleCatalogTable,
  usersTable,
  clientsTable, clientContactsTable,
  opportunitiesTable, activitiesTable,
  projectsTable, projectPhasesTable,
  tasksTable,
  collaboratorsTable,
  departmentsTable, positionsTable, contractsTable, leaveRequestsTable,
  equipmentCategoriesTable, equipmentTable,
  ordersTable, proformasTable, invoicesTable, paymentsTable, creditNotesTable,
  servicesTable,
  kiosksTable,
  attendanceSessionsTable, attendanceRecordsTable, attendanceFlagsTable,
  attendanceCorrectionsTable,
  ticketsTable,
  notificationsTable,
  suppliersTable,
} from "./schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const D = (yyyy: number, mm: number, dd: number) =>
  `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;

const DT = (yyyy: number, mm: number, dd: number, hh = 8, min = 0) =>
  new Date(`${D(yyyy, mm, dd)}T${String(hh).padStart(2, "0")}:${String(min).padStart(2, "0")}:00Z`);

// ─── Main seed ───────────────────────────────────────────────────────────────

export async function seedHissado() {
  console.log("→ Seed Hissado Consulting démarré…");

  // ── Idempotence ──────────────────────────────────────────────────────────
  const existing = await db.select({ id: organizationsTable.id })
    .from(organizationsTable)
    .where(eq(organizationsTable.slug, "hissado-consulting"))
    .limit(1);
  if (existing.length > 0) {
    console.log("  ✓ Hissado Consulting déjà présent — skip.");
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 1. ORGANISATION
  // ══════════════════════════════════════════════════════════════════════════
  console.log("  • Organisation…");
  const [org] = await db.insert(organizationsTable).values({
    slug: "hissado-consulting",
    name: "Hissado Consulting",
    legalName: "Hissado Consulting SARL",
    industry: "Conseil & Transformation digitale",
    country: "TG",
    address: "Immeuble Lomé Business Center, Avenue du 24 Janvier, Hédzranawoe",
    currency: "XOF",
    timezone: "Africa/Lome",
    locale: "fr-FR",
    contactEmail: "contact@hissadoconsulting.com",
    contactPhone: "+228 22 61 00 10",
    isDefault: false,
    primaryColor: "#1B4FD8",
    secondaryColor: "#0F172A",
    taxId: "TG-2021-BIC-004578",
  }).returning();
  const orgId = org!.id;
  console.log(`  ✓ Org créée : ${orgId}`);

  // ══════════════════════════════════════════════════════════════════════════
  // 2. ABONNEMENT PROFESSIONAL + MODULES
  // ══════════════════════════════════════════════════════════════════════════
  console.log("  • Abonnement Professional…");
  const [plan] = await db.select().from(subscriptionPlansTable)
    .where(eq(subscriptionPlansTable.code, "PROFESSIONAL")).limit(1);

  let subId: string | null = null;
  if (plan) {
    const now = new Date();
    const periodEnd = new Date(now); periodEnd.setMonth(periodEnd.getMonth() + 1);
    const [sub] = await db.insert(organizationSubscriptionsTable).values({
      organizationId: orgId,
      planId: plan.id,
      status: "active",
      billingCycle: "monthly",
      seats: 25,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      unitPrice: plan.monthlyPricePerSeat,
      setupFee: plan.setupFee,
      currency: "XOF",
      isCurrent: true,
    }).returning();
    subId = sub!.id;

    // Tous les modules activés
    const modules = await db.select().from(moduleCatalogTable);
    for (const m of modules) {
      await db.insert(organizationModulesTable).values({
        organizationId: orgId, moduleKey: m.key, enabled: true, source: "plan",
      }).onConflictDoNothing();
    }

    // Historique facturation (5 mois)
    for (let i = 5; i >= 1; i--) {
      const d = new Date(now); d.setMonth(d.getMonth() - i);
      await db.insert(billingEventsTable).values({
        organizationId: orgId, subscriptionId: subId,
        kind: "invoice",
        label: `Abonnement Professional — ${d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`,
        amount: 35_000 * 12, status: "paid", currency: "XOF",
        reference: `HC-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}-001`,
        occurredAt: d,
      }).catch(() => {});
    }
    await db.insert(billingEventsTable).values({
      organizationId: orgId, subscriptionId: subId,
      kind: "setup_fee", label: "Frais d'installation & onboarding Gameasu",
      amount: 750_000, status: "paid", currency: "XOF",
      reference: "HC-SETUP-001",
      occurredAt: DT(2024, 1, 10),
    }).catch(() => {});
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. UTILISATEURS (10)
  // ══════════════════════════════════════════════════════════════════════════
  console.log("  • Utilisateurs (10)…");
  const USERS = [
    { email: "direction@hissadoconsulting.com",  password: "hissado123", firstName: "Kodjo",     lastName: "Hissado",          role: "super_admin",  phone: "+228 90 11 00 01" },
    { email: "admin@hissadoconsulting.com",       password: "hissado123", firstName: "Eglantine", lastName: "Toviho",           role: "admin",        phone: "+228 90 11 00 02" },
    { email: "finance@hissadoconsulting.com",     password: "finance123", firstName: "Mawuena",   lastName: "Agbeko",           role: "manager",      phone: "+228 90 11 00 03" },
    { email: "compta@hissadoconsulting.com",      password: "compta123",  firstName: "Sylvie",    lastName: "Kpossou",          role: "collaborator", phone: "+228 90 11 00 04" },
    { email: "commercial@hissadoconsulting.com",  password: "com123",     firstName: "Yawo",      lastName: "Sossou-Agbessi",   role: "commercial",   phone: "+228 90 11 00 05" },
    { email: "sales2@hissadoconsulting.com",      password: "sales123",   firstName: "Afiwa",     lastName: "Mensah",           role: "commercial",   phone: "+228 90 11 00 06" },
    { email: "rh@hissadoconsulting.com",          password: "rh123",      firstName: "Adjoa",     lastName: "Datsakpo",         role: "manager",      phone: "+228 90 11 00 07" },
    { email: "operations@hissadoconsulting.com",  password: "ops123",     firstName: "Komlan",    lastName: "Tsigbe",           role: "manager",      phone: "+228 90 11 00 08" },
    { email: "collab@hissadoconsulting.com",      password: "collab123",  firstName: "Eyram",     lastName: "Apélété",          role: "collaborator", phone: "+228 90 11 00 09" },
    { email: "audit@hissadoconsulting.com",       password: "read123",    firstName: "Sika",      lastName: "Abalo",            role: "collaborator", phone: "+228 90 11 00 10" },
  ];
  const userRecs: Record<string, string> = {};
  for (const u of USERS) {
    const [row] = await db.insert(usersTable).values({ ...u, organizationId: orgId, isActive: true, isClient: false })
      .onConflictDoUpdate({ target: usersTable.email, set: { organizationId: orgId, firstName: u.firstName, lastName: u.lastName, role: u.role, isActive: true } })
      .returning({ id: usersTable.id });
    userRecs[u.email] = row!.id;
    await db.insert(organizationMembersTable).values({
      organizationId: orgId, userId: row!.id,
      role: u.role === "super_admin" ? "owner" : u.role === "admin" ? "admin" : u.role === "manager" ? "manager" : "member",
      isPrimary: true,
    }).onConflictDoNothing();
  }
  const dgId    = userRecs["direction@hissadoconsulting.com"]!;
  const finId   = userRecs["finance@hissadoconsulting.com"]!;
  const comId   = userRecs["commercial@hissadoconsulting.com"]!;
  const opsId   = userRecs["operations@hissadoconsulting.com"]!;
  const rhId    = userRecs["rh@hissadoconsulting.com"]!;

  // ══════════════════════════════════════════════════════════════════════════
  // 4. RH — DÉPARTEMENTS + POSTES + COLLABORATEURS + CONTRATS + CONGÉS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("  • Départements & postes…");
  const [dDir, dFin, dCom, dOps, dRh, dDigital] = await db.insert(departmentsTable).values([
    { organizationId: orgId, code: "DIR",  name: "Direction Générale",         color: "#1B4FD8", description: "Stratégie, gouvernance et pilotage" },
    { organizationId: orgId, code: "FIN",  name: "Finance & Comptabilité",      color: "#10B981", description: "Comptabilité, trésorerie, contrôle de gestion" },
    { organizationId: orgId, code: "COM",  name: "Commercial & Développement",  color: "#A855F7", description: "Développement commercial, CRM, marketing" },
    { organizationId: orgId, code: "OPS",  name: "Opérations & Conseil",        color: "#F59E0B", description: "Exécution des missions de conseil et projets clients" },
    { organizationId: orgId, code: "RH",   name: "Ressources Humaines",          color: "#EF4444", description: "Recrutement, formation, paie, bien-être" },
    { organizationId: orgId, code: "DIG",  name: "Digital & Technologie",        color: "#06B6D4", description: "Transformation digitale, IT, outils internes" },
  ]).returning();

  const [pDG, pDAF, pDCom, pConsSr, pConsJr, pCpt, pComTer, pAss, pDRH, pChDig, pAnalyste, pStage] = await db.insert(positionsTable).values([
    { organizationId: orgId, code: "DG",      title: "Directeur Général",                   departmentId: dDir!.id, level: 5 },
    { organizationId: orgId, code: "DAF",     title: "Directeur Administratif & Financier",  departmentId: dFin!.id, level: 4 },
    { organizationId: orgId, code: "DCOM",    title: "Directeur Commercial",                 departmentId: dCom!.id, level: 4 },
    { organizationId: orgId, code: "CONS-SR", title: "Consultant(e) Senior",                 departmentId: dOps!.id, level: 3 },
    { organizationId: orgId, code: "CONS-JR", title: "Consultant(e) Junior",                 departmentId: dOps!.id, level: 2 },
    { organizationId: orgId, code: "CPT",     title: "Comptable Général(e)",                 departmentId: dFin!.id, level: 2 },
    { organizationId: orgId, code: "COM-TER", title: "Commercial(e) Terrain",                departmentId: dCom!.id, level: 2 },
    { organizationId: orgId, code: "ASS-ADM", title: "Assistant(e) Administratif(ve)",       departmentId: dDir!.id, level: 1 },
    { organizationId: orgId, code: "DRH",     title: "Directeur(rice) des RH",               departmentId: dRh!.id,  level: 4 },
    { organizationId: orgId, code: "CH-DIG",  title: "Chef de Projet Digital",               departmentId: dDigital!.id, level: 3 },
    { organizationId: orgId, code: "ANA",     title: "Analyste Financier(e)",                departmentId: dFin!.id, level: 2 },
    { organizationId: orgId, code: "STAGE",   title: "Stagiaire",                            departmentId: dOps!.id, level: 1 },
  ]).returning();

  console.log("  • Collaborateurs (12) + kiosk codes…");
  const COLLABS = [
    { no: "HC-001", fn: "Kodjo",     ln: "Hissado",       email: "dg@hissadoconsulting.com",         phone: "+228 90 11 00 01", pos: "Directeur Général",               dept: "Direction",   posId: pDG?.id,       deptId: dDir!.id, salary: "1800000", trans: "120000", hous: "250000", hired: D(2018,3,15), kiosk: "1001", userId: dgId },
    { no: "HC-002", fn: "Mawuena",   ln: "Agbeko",        email: "finance.collab@hissadoconsulting.com",  phone: "+228 90 11 00 03", pos: "DAF",                             dept: "Finance",     posId: pDAF?.id,      deptId: dFin!.id, salary: "1200000", trans: "80000",  hous: "150000", hired: D(2019,6,1),  kiosk: "1002", userId: finId },
    { no: "HC-003", fn: "Yawo",      ln: "Sossou-Agbessi",email: "commercial.collab@hissadoconsulting.com", phone: "+228 90 11 00 05", pos: "Directeur Commercial",          dept: "Commercial",  posId: pDCom?.id,     deptId: dCom!.id, salary: "1050000", trans: "70000",  hous: "100000", hired: D(2020,1,10), kiosk: "1003", userId: comId },
    { no: "HC-004", fn: "Adjoa",     ln: "Datsakpo",      email: "rh.collab@hissadoconsulting.com",       phone: "+228 90 11 00 07", pos: "DRH",                             dept: "RH",          posId: pDRH?.id,      deptId: dRh!.id,  salary: "900000",  trans: "60000",  hous: "80000",  hired: D(2019,9,1),  kiosk: "1004", userId: rhId },
    { no: "HC-005", fn: "Komlan",    ln: "Tsigbe",        email: "ops.collab@hissadoconsulting.com",      phone: "+228 90 11 00 08", pos: "Consultant Senior",               dept: "Opérations",  posId: pConsSr?.id,   deptId: dOps!.id, salary: "980000",  trans: "65000",  hous: "90000",  hired: D(2020,4,20), kiosk: "1005", userId: opsId },
    { no: "HC-006", fn: "Sylvie",    ln: "Kpossou",       email: "compta.collab@hissadoconsulting.com",   phone: "+228 90 11 00 04", pos: "Comptable",                       dept: "Finance",     posId: pCpt?.id,      deptId: dFin!.id, salary: "620000",  trans: "40000",  hous: null,     hired: D(2021,3,1),  kiosk: "1006" },
    { no: "HC-007", fn: "Afiwa",     ln: "Mensah",        email: "sales2.collab@hissadoconsulting.com",   phone: "+228 90 11 00 06", pos: "Commercial Terrain",              dept: "Commercial",  posId: pComTer?.id,   deptId: dCom!.id, salary: "580000",  trans: "50000",  hous: null,     hired: D(2021,7,15), kiosk: "1007" },
    { no: "HC-008", fn: "Eyram",     ln: "Apélété",       email: "collab@hissadoconsulting.com",          phone: "+228 90 11 00 09", pos: "Consultant Junior",               dept: "Opérations",  posId: pConsJr?.id,   deptId: dOps!.id, salary: "520000",  trans: "35000",  hous: null,     hired: D(2022,2,1),  kiosk: "1008" },
    { no: "HC-009", fn: "Kafui",     ln: "Ahorlu",        email: "kafui@hissadoconsulting.com",           phone: "+228 90 11 00 11", pos: "Chef de Projet Digital",          dept: "Digital",     posId: pChDig?.id,    deptId: dDigital!.id, salary: "820000", trans: "55000", hous: "70000", hired: D(2021,11,1), kiosk: "1009" },
    { no: "HC-010", fn: "Eglantine", ln: "Toviho",        email: "admin.collab@hissadoconsulting.com",    phone: "+228 90 11 00 02", pos: "Assistante Administrative",       dept: "Direction",   posId: pAss?.id,      deptId: dDir!.id, salary: "420000",  trans: "30000",  hous: null,     hired: D(2022,9,1),  kiosk: "1010" },
    { no: "HC-011", fn: "Koami",     ln: "Adzoa",         email: "koami@hissadoconsulting.com",           phone: "+228 90 11 00 12", pos: "Analyste Financier",              dept: "Finance",     posId: pAnalyste?.id, deptId: dFin!.id, salary: "680000",  trans: "45000",  hous: null,     hired: D(2023,1,16), kiosk: "1011" },
    { no: "HC-012", fn: "Victoire",  ln: "Agbénoxevi",    email: "victoire@hissadoconsulting.com",        phone: "+228 90 11 00 13", pos: "Stagiaire",                       dept: "Opérations",  posId: pStage?.id,    deptId: dOps!.id, salary: "120000",  trans: "15000",  hous: null,     hired: D(2024,3,1),  kiosk: "1012" },
  ];

  const collabRecs: string[] = [];
  for (const c of COLLABS) {
    const [row] = await db.insert(collaboratorsTable).values({
      organizationId: orgId,
      employeeNumber: c.no,
      firstName: c.fn, lastName: c.ln,
      email: c.email, phone: c.phone,
      position: c.pos, department: c.dept,
      positionId: c.posId ?? null, departmentId: c.deptId,
      hireDate: c.hired, baseSalary: c.salary,
      employerChargeRate: "18.4",
      transportAllowance: c.trans,
      housingAllowance: c.hous ?? null,
      weeklyHours: "40",
      employmentStatus: "active",
      isAvailable: true,
      kioskCode: c.kiosk,
      userId: c.userId ?? null,
    }).returning();
    collabRecs.push(row!.id);
  }

  console.log("  • Contrats CDI (12)…");
  const allCollabs = await db.select().from(collaboratorsTable)
    .where(eq(collaboratorsTable.organizationId, orgId));
  for (const c of allCollabs) {
    if (!c.hireDate || !c.baseSalary) continue;
    await db.insert(contractsTable).values({
      organizationId: orgId, collaboratorId: c.id,
      type: "CDI", status: "active", startDate: c.hireDate,
      monthlySalary: c.baseSalary, currency: "XOF",
      jobTitle: c.position ?? "Collaborateur",
      workLocation: "Lomé, Togo",
      weeklyHours: c.weeklyHours ?? "40",
      signedAt: new Date(`${c.hireDate}T09:00:00Z`),
    }).catch(() => {});
  }

  console.log("  • Congés (8)…");
  const cs = collabRecs;
  const leaves = [
    { id: cs[0], type: "congé_payé", start: D(2026,7,14), end: D(2026,7,25), days: "10", status: "approved", reason: "Congés annuels — vacances familiales" },
    { id: cs[1], type: "congé_payé", start: D(2026,8,4),  end: D(2026,8,15), days: "10", status: "approved", reason: "Congés été planifiés" },
    { id: cs[2], type: "maladie",    start: D(2026,5,12), end: D(2026,5,14), days: "3",  status: "approved", reason: "Arrêt médical — CHU Sylvanus Olympio" },
    { id: cs[3], type: "formation",  start: D(2026,6,23), end: D(2026,6,27), days: "5",  status: "approved", reason: "Formation : Management RH & droit du travail OHADA" },
    { id: cs[4], type: "congé_payé", start: D(2026,9,1),  end: D(2026,9,12), days: "10", status: "pending",  reason: "Congés planifiés — septembre" },
    { id: cs[5], type: "récupération", start: D(2026,6,20), end: D(2026,6,21), days: "2", status: "approved", reason: "Récupération heures supplémentaires Q1" },
    { id: cs[6], type: "maternité",  start: D(2026,7,1),  end: D(2026,9,30), days: "90", status: "approved", reason: "Congé maternité légal — 14 semaines" },
    { id: cs[7], type: "sans_solde", start: D(2026,8,18), end: D(2026,8,22), days: "5",  status: "pending",  reason: "Voyage familial urgent" },
  ];
  for (const l of leaves) {
    if (!l.id) continue;
    await db.insert(leaveRequestsTable).values({
      collaboratorId: l.id, organizationId: orgId,
      type: l.type, startDate: l.start, endDate: l.end,
      days: l.days, status: l.status, reason: l.reason,
    }).catch(() => {});
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 5. CRM — CLIENTS + CONTACTS + OPPORTUNITÉS + ACTIVITÉS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("  • Clients (8)…");
  const CLIENTS = [
    { name: "BSIC Togo — Banque Sahélo-Saharienne",    email: "dsi@bsic-togo.tg",      phone: "+228 22 20 80 80", industry: "Banque & Finance",          address: "Ave du Président Grunitzky, Lomé", status: "active" },
    { name: "Groupe Bolloré Africa — Togo",             email: "procurement@bollore.tg", phone: "+228 22 27 02 70", industry: "Logistique & Transit",       address: "Port Autonome de Lomé",           status: "active" },
    { name: "ORABANK Togo",                             email: "daf@orabank.tg",         phone: "+228 22 23 10 00", industry: "Banque & Microfinance",      address: "BD du 13 Janvier, Lomé",         status: "active" },
    { name: "Ecobank Togo — Direction Générale",        email: "it@ecobank.tg",          phone: "+228 22 21 72 14", industry: "Banque Panafricaine",        address: "2 Rue Koumoré, Lomé",             status: "active" },
    { name: "GTA — Groupama Togo Assurances",           email: "dg@gta-togo.tg",         phone: "+228 22 21 16 93", industry: "Assurance",                  address: "BD du 13 Janvier, Lomé",         status: "active" },
    { name: "NSIA Banque Togo",                         email: "direction@nsia-tg.com",  phone: "+228 22 21 07 07", industry: "Banque Universelle",         address: "Ave du Maréchal Foch, Lomé",     status: "active" },
    { name: "COFINA Togo — Microfinance",               email: "daf@cofina-togo.tg",     phone: "+228 22 26 17 50", industry: "Microfinance & Inclusion",   address: "Rue Aniko Palako, Lomé",         status: "prospect" },
    { name: "Togolaise des Eaux (TdE)",                 email: "si@tde.tg",              phone: "+228 22 21 43 24", industry: "Service Public — Eau",       address: "Bd Circulaire, Lomé",            status: "prospect" },
  ];
  const clientRecs = await db.insert(clientsTable)
    .values(CLIENTS.map(c => ({ ...c, organizationId: orgId })))
    .returning();

  console.log("  • Contacts clients (16)…");
  await db.insert(clientContactsTable).values([
    { organizationId: orgId, clientId: clientRecs[0]!.id, firstName: "Kofi",      lastName: "Atchrimi",   email: "k.atchrimi@bsic-togo.tg",    phone: "+228 90 20 11 01", role: "Directeur des Systèmes d'Information", isPrimary: "true" },
    { organizationId: orgId, clientId: clientRecs[0]!.id, firstName: "Céleste",   lastName: "Amétépé",    email: "c.ametepe@bsic-togo.tg",     phone: "+228 90 20 11 02", role: "Responsable Transformation Digitale" },
    { organizationId: orgId, clientId: clientRecs[1]!.id, firstName: "Jean-Marc", lastName: "Houénou",    email: "jm.houenou@bollore.tg",      phone: "+228 91 00 22 01", role: "Operations Director", isPrimary: "true" },
    { organizationId: orgId, clientId: clientRecs[1]!.id, firstName: "Adama",     lastName: "Koné",       email: "a.kone@bollore.tg",          phone: "+228 91 00 22 02", role: "Chief Financial Officer" },
    { organizationId: orgId, clientId: clientRecs[2]!.id, firstName: "Afi",       lastName: "Amégashie",  email: "a.amegashie@orabank.tg",     phone: "+228 90 55 10 01", role: "Directrice Administrative", isPrimary: "true" },
    { organizationId: orgId, clientId: clientRecs[3]!.id, firstName: "Adoté",     lastName: "Kossi",      email: "a.kossi@ecobank.tg",         phone: "+228 91 22 33 44", role: "Chief Digital Officer", isPrimary: "true" },
    { organizationId: orgId, clientId: clientRecs[3]!.id, firstName: "Yao",       lastName: "Akakpo",     email: "y.akakpo@ecobank.tg",        phone: "+228 91 22 33 55", role: "Responsable Projet SI" },
    { organizationId: orgId, clientId: clientRecs[4]!.id, firstName: "Kafui",     lastName: "Tsatsu",     email: "k.tsatsu@gta-togo.tg",       phone: "+228 90 80 10 01", role: "Directeur Général Adjoint", isPrimary: "true" },
    { organizationId: orgId, clientId: clientRecs[5]!.id, firstName: "Amèvi",     lastName: "Gakpé",      email: "a.gakpe@nsia-tg.com",        phone: "+228 90 70 20 01", role: "Directeur des Opérations", isPrimary: "true" },
    { organizationId: orgId, clientId: clientRecs[5]!.id, firstName: "Prisca",    lastName: "Dédé",       email: "p.dede@nsia-tg.com",         phone: "+228 90 70 20 02", role: "Responsable Conformité" },
    { organizationId: orgId, clientId: clientRecs[6]!.id, firstName: "Oumarou",   lastName: "Fofana",     email: "o.fofana@cofina-togo.tg",    phone: "+228 90 60 30 01", role: "Directeur Général", isPrimary: "true" },
    { organizationId: orgId, clientId: clientRecs[7]!.id, firstName: "Dossou",    lastName: "Glidja",     email: "d.glidja@tde.tg",            phone: "+228 90 43 24 01", role: "DSI", isPrimary: "true" },
    { organizationId: orgId, clientId: clientRecs[2]!.id, firstName: "Sénamé",    lastName: "Gnama",      email: "s.gnama@orabank.tg",         phone: "+228 90 55 10 02", role: "Chef de Projet ERP" },
    { organizationId: orgId, clientId: clientRecs[4]!.id, firstName: "Mawuli",    lastName: "Lamboni",    email: "m.lamboni@gta-togo.tg",      phone: "+228 90 80 10 02", role: "Responsable Audit Interne" },
    { organizationId: orgId, clientId: clientRecs[6]!.id, firstName: "Nassiba",   lastName: "Drabo",      email: "n.drabo@cofina-togo.tg",     phone: "+228 90 60 30 02", role: "DAF" },
    { organizationId: orgId, clientId: clientRecs[7]!.id, firstName: "Yévègnon",  lastName: "Amoussou",   email: "y.amoussou@tde.tg",          phone: "+228 90 43 24 02", role: "Responsable Informatique" },
  ]);

  console.log("  • Opportunités (15)…");
  const OPPS = [
    { title: "Audit SI & transformation digitale",       cIdx: 0, stage: "won",         value: "185000000", prob: 100, exp: D(2026,2,15),  notes: "Marché attribué. Mission en cours." },
    { title: "Implémentation ERP comptable",             cIdx: 1, stage: "negotiation", value: "320000000", prob: 70,  exp: D(2026,8,15),  notes: "Proposition acceptée en principe. Négociation finale." },
    { title: "Refonte système de gestion RH",            cIdx: 2, stage: "proposal",    value: "95000000",  prob: 55,  exp: D(2026,9,10),  notes: "RFP reçu, proposition en cours de finalisation." },
    { title: "Formation cadres — Finance OHADA",         cIdx: 3, stage: "won",         value: "22000000",  prob: 100, exp: D(2026,3,1),   notes: "Session réalisée. Rapport remis." },
    { title: "Conseil en stratégie fintech",             cIdx: 4, stage: "qualified",   value: "78000000",  prob: 45,  exp: D(2026,10,1),  notes: "Réunion de qualification réussie." },
    { title: "Déploiement plateforme paiement mobile",   cIdx: 5, stage: "proposal",    value: "145000000", prob: 60,  exp: D(2026,9,30),  notes: "Devis soumis — version 2 après retour client." },
    { title: "Audit réglementaire BCEAO",               cIdx: 0, stage: "won",         value: "32000000",  prob: 100, exp: D(2026,1,20),  notes: "Rapport final remis, mission clôturée." },
    { title: "Accompagnement digitalisation agences",    cIdx: 2, stage: "negotiation", value: "67500000",  prob: 75,  exp: D(2026,8,31),  notes: "Termes du contrat presque finalisés." },
    { title: "Business Intelligence & Tableaux de bord", cIdx: 3, stage: "proposal",   value: "48000000",  prob: 50,  exp: D(2026,10,15), notes: "Démo effectuée. Attente décision comité." },
    { title: "Restructuration plan comptable SYSCOHADA", cIdx: 4, stage: "qualified",   value: "24000000",  prob: 40,  exp: D(2026,11,1),  notes: "Premier contact positif." },
    { title: "Conseil fusion-acquisition — diligence",   cIdx: 1, stage: "lead",        value: "560000000", prob: 20,  exp: D(2026,12,1),  notes: "Mise en relation CEO. RDV à planifier." },
    { title: "Formation Excel & reporting financier",    cIdx: 5, stage: "won",         value: "8500000",   prob: 100, exp: D(2026,4,10),  notes: "Formation de 3 jours réalisée." },
    { title: "Développement application mobile microfinance", cIdx: 6, stage: "proposal", value: "120000000", prob: 55, exp: D(2026,9,20), notes: "Maquettes soumises. Retours attendus." },
    { title: "Diagnostic processus métier & cartographie", cIdx: 7, stage: "qualified", value: "35000000",  prob: 40,  exp: D(2026,10,30), notes: "RDV DSI effectué. Suite à programmer." },
    { title: "Implémentation GED & archivage numérique",  cIdx: 3, stage: "lost",       value: "18000000",  prob: 0,   exp: D(2026,3,31),  notes: "Perdu sur critère de délai. Concurrent local plus rapide." },
  ];
  const oppRecs = await db.insert(opportunitiesTable)
    .values(OPPS.map(o => ({
      organizationId: orgId,
      title: o.title,
      clientId: clientRecs[o.cIdx]!.id,
      stage: o.stage,
      value: o.value,
      probability: o.prob,
      assignedToId: o.cIdx % 2 === 0 ? comId : dgId,
      expectedCloseDate: o.exp,
      notes: o.notes,
    })))
    .returning();

  console.log("  • Activités CRM (30)…");
  const actTypes = ["call", "email", "meeting", "demo", "proposal"];
  const actBatch = [];
  for (let i = 0; i < 30; i++) {
    const opp = oppRecs[i % oppRecs.length]!;
    const t = actTypes[i % actTypes.length]!;
    const daysAgo = -(i * 3 + 2);
    actBatch.push({
      organizationId: orgId,
      type: t,
      subject: t === "call" ? `Appel — ${opp.title.slice(0, 50)}`
        : t === "email" ? `Email suivi — ${opp.title.slice(0, 50)}`
        : t === "meeting" ? `Réunion cadrage — ${opp.title.slice(0, 50)}`
        : t === "demo" ? `Présentation solution — ${opp.title.slice(0, 50)}`
        : `Envoi proposition — ${opp.title.slice(0, 50)}`,
      description: `Activité ${t} dans le cadre de l'opportunité "${opp.title}"`,
      clientId: opp.clientId,
      opportunityId: opp.id,
      userId: i % 2 === 0 ? comId : dgId,
      scheduledAt: new Date(Date.now() + daysAgo * 86400_000),
      completedAt: daysAgo < 0 ? new Date(Date.now() + daysAgo * 86400_000) : null,
    });
  }
  await db.insert(activitiesTable).values(actBatch);

  // ══════════════════════════════════════════════════════════════════════════
  // 6. SERVICES
  // ══════════════════════════════════════════════════════════════════════════
  console.log("  • Services (6)…");
  await db.insert(servicesTable).values([
    { organizationId: orgId, code: "HC-SVC-001", name: "Conseil en Stratégie",         description: "Accompagnement stratégique et planification d'entreprise",         unitPrice: "250000", unit: "jour", category: "Conseil",   isActive: true },
    { organizationId: orgId, code: "HC-SVC-002", name: "Audit des Systèmes d'Information", description: "Diagnostic complet du SI, cartographie et plan de remédiation", unitPrice: "180000", unit: "jour", category: "Audit",     isActive: true },
    { organizationId: orgId, code: "HC-SVC-003", name: "Formation Professionnelle",     description: "Formation sur-mesure finance, gestion, outils ERP",                unitPrice: "120000", unit: "jour", category: "Formation", isActive: true },
    { organizationId: orgId, code: "HC-SVC-004", name: "Développement Logiciel",        description: "Conception et développement d'applications métier",                 unitPrice: "150000", unit: "jour", category: "Digital",   isActive: true },
    { organizationId: orgId, code: "HC-SVC-005", name: "Gestion de Projet PMO",         description: "Pilotage de projets de transformation, gouvernance et reporting",    unitPrice: "200000", unit: "jour", category: "Conseil",   isActive: true },
    { organizationId: orgId, code: "HC-SVC-006", name: "Diagnostic Financier & Fiscal", description: "Analyse des états financiers, conformité SYSCOHADA, liasse fiscale", unitPrice: "350000", unit: "mission", category: "Finance", isActive: true },
  ]).catch(() => {});

  // ══════════════════════════════════════════════════════════════════════════
  // 7. PROJETS + PHASES + TÂCHES
  // ══════════════════════════════════════════════════════════════════════════
  console.log("  • Projets (4) + phases + tâches…");
  const PROJECTS = [
    { name: "Audit SI BSIC Togo",                  cIdx: 0, status: "in_progress", start: D(2026,2,1),  end: D(2026,7,31),  budget: "185000000", progress: 65, mgr: dgId },
    { name: "Implémentation ERP Bolloré Togo",      cIdx: 1, status: "planning",    start: D(2026,9,1),  end: D(2027,3,31),  budget: "320000000", progress: 5,  mgr: opsId },
    { name: "Formation Cadres Ecobank",             cIdx: 3, status: "completed",   start: D(2026,3,1),  end: D(2026,4,30),  budget: "22000000",  progress: 100, mgr: finId },
    { name: "Plateforme paiement mobile NSIA",      cIdx: 5, status: "in_progress", start: D(2026,6,1),  end: D(2026,11,30), budget: "145000000", progress: 30, mgr: opsId },
  ];
  const projectRecs = [];
  for (const p of PROJECTS) {
    const [proj] = await db.insert(projectsTable).values({
      organizationId: orgId,
      name: p.name, description: `Mission ${p.name} — Hissado Consulting`,
      status: p.status, clientId: clientRecs[p.cIdx]!.id,
      managerId: p.mgr, startDate: p.start, endDate: p.end,
      budget: p.budget, progress: p.progress,
    }).returning();
    projectRecs.push(proj!);
  }

  // Phases pour projet 1
  const [p1ph1, p1ph2, p1ph3] = await db.insert(projectPhasesTable).values([
    { organizationId: orgId, projectId: projectRecs[0]!.id, name: "Cadrage & collecte", status: "completed", order: 1 },
    { organizationId: orgId, projectId: projectRecs[0]!.id, name: "Diagnostic & analyse", status: "in_progress", order: 2 },
    { organizationId: orgId, projectId: projectRecs[0]!.id, name: "Rapport & recommandations", status: "pending", order: 3 },
  ]).returning();
  // Phases pour projet 2
  const [p2ph1, p2ph2] = await db.insert(projectPhasesTable).values([
    { organizationId: orgId, projectId: projectRecs[1]!.id, name: "Analyse des besoins", status: "in_progress", order: 1 },
    { organizationId: orgId, projectId: projectRecs[1]!.id, name: "Paramétrage & déploiement", status: "pending", order: 2 },
  ]).returning();

  const TASKS = [
    // Projet 1
    { proj: 0, title: "Interviews parties prenantes",    status: "done",        priority: "high",   assignee: opsId, due: D(2026,2,28) },
    { proj: 0, title: "Cartographie du SI existant",    status: "done",        priority: "high",   assignee: opsId, due: D(2026,3,15) },
    { proj: 0, title: "Analyse des flux de données",    status: "in_progress", priority: "high",   assignee: opsId, due: D(2026,6,30) },
    { proj: 0, title: "Audit sécurité & conformité",    status: "in_progress", priority: "medium", assignee: comId, due: D(2026,7,15) },
    { proj: 0, title: "Rédaction rapport final",         status: "todo",        priority: "high",   assignee: dgId,  due: D(2026,7,25) },
    // Projet 2
    { proj: 1, title: "Ateliers de recueil des besoins", status: "in_progress", priority: "high",  assignee: opsId, due: D(2026,9,30) },
    { proj: 1, title: "Rédaction cahier des charges",    status: "todo",        priority: "high",   assignee: opsId, due: D(2026,10,15) },
    { proj: 1, title: "Paramétrage module comptable",    status: "todo",        priority: "medium", assignee: finId, due: D(2026,12,31) },
    // Projet 3
    { proj: 2, title: "Préparation supports formation",  status: "done",        priority: "medium", assignee: finId, due: D(2026,3,5) },
    { proj: 2, title: "Sessions formation J1-J3",        status: "done",        priority: "high",   assignee: finId, due: D(2026,4,3) },
    { proj: 2, title: "Évaluation & rapport",            status: "done",        priority: "low",    assignee: finId, due: D(2026,4,10) },
    // Projet 4
    { proj: 3, title: "Spécifications fonctionnelles",   status: "done",        priority: "high",   assignee: opsId, due: D(2026,6,20) },
    { proj: 3, title: "Développement API paiement",      status: "in_progress", priority: "high",   assignee: opsId, due: D(2026,8,31) },
    { proj: 3, title: "Tests & recette utilisateurs",    status: "todo",        priority: "high",   assignee: comId, due: D(2026,10,15) },
    { proj: 3, title: "Déploiement production",          status: "todo",        priority: "high",   assignee: opsId, due: D(2026,11,15) },
  ];
  for (const t of TASKS) {
    await db.insert(tasksTable).values({
      organizationId: orgId,
      projectId: projectRecs[t.proj]!.id,
      title: t.title, status: t.status, priority: t.priority,
      assigneeId: t.assignee, dueDate: t.due,
    }).catch(() => {});
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 8. COMMANDES / PROFORMAS / FACTURES / PAIEMENTS / AVOIRS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("  • Commandes + Factures + Paiements…");

  // Commande 1 — Audit SI BSIC (won)
  const [ord1] = await db.insert(ordersTable).values({
    organizationId: orgId, referenceNumber: "BC-HC-2026-001",
    clientId: clientRecs[0]!.id, status: "completed",
    totalAmount: "185000000", currency: "XOF",
    notes: "Mission Audit SI — BSIC Togo. Bon de commande signé le 28/01/2026.",
  }).returning();

  const [pro1] = await db.insert(proformasTable).values({
    organizationId: orgId, referenceNumber: "PRO-HC-2026-001",
    orderId: ord1!.id, clientId: clientRecs[0]!.id,
    status: "accepted", totalAmount: "185000000", currency: "XOF",
    validUntil: D(2026,2,15), paymentTerms: "30% à la commande, 40% mi-mission, 30% à réception",
    durationDays: 90, notes: "Proforma acceptée le 25/01/2026.",
  }).returning();

  const [inv1] = await db.insert(invoicesTable).values({
    organizationId: orgId, referenceNumber: "FAC-HC-2026-001",
    proformaId: pro1!.id, clientId: clientRecs[0]!.id,
    status: "paid", totalAmount: "185000000", paidAmount: "185000000",
    currency: "XOF", dueDate: D(2026,3,15), issuedAt: D(2026,2,1),
    notes: "Facture solde — Mission Audit SI BSIC Togo. Payée intégralement.",
  }).returning();
  await db.insert(paymentsTable).values({
    organizationId: orgId, invoiceId: inv1!.id,
    amount: "55500000", currency: "XOF", method: "virement",
    transactionStatus: "confirmed", reference: "VIR-BSIC-20260201",
    paidAt: DT(2026,2,1,10), notes: "Acompte 30% — virement Ecobank",
  }).catch(() => {});
  await db.insert(paymentsTable).values({
    organizationId: orgId, invoiceId: inv1!.id,
    amount: "74000000", currency: "XOF", method: "virement",
    transactionStatus: "confirmed", reference: "VIR-BSIC-20260415",
    paidAt: DT(2026,4,15,10), notes: "40% mi-mission",
  }).catch(() => {});
  await db.insert(paymentsTable).values({
    organizationId: orgId, invoiceId: inv1!.id,
    amount: "55500000", currency: "XOF", method: "virement",
    transactionStatus: "confirmed", reference: "VIR-BSIC-20260620",
    paidAt: DT(2026,6,20,10), notes: "Solde 30% — rapport final remis",
  }).catch(() => {});

  // Commande 2 — Formation Ecobank (won, payée complètement)
  const [ord2] = await db.insert(ordersTable).values({
    organizationId: orgId, referenceNumber: "BC-HC-2026-002",
    clientId: clientRecs[3]!.id, status: "completed",
    totalAmount: "22000000", currency: "XOF",
    notes: "Formation cadres Finance OHADA — 3 jours.",
  }).returning();
  const [pro2] = await db.insert(proformasTable).values({
    organizationId: orgId, referenceNumber: "PRO-HC-2026-002",
    orderId: ord2!.id, clientId: clientRecs[3]!.id,
    status: "accepted", totalAmount: "22000000", currency: "XOF",
    validUntil: D(2026,2,28), paymentTerms: "100% avant démarrage",
    durationDays: 3, notes: "Proforma acceptée.",
  }).returning();
  const [inv2] = await db.insert(invoicesTable).values({
    organizationId: orgId, referenceNumber: "FAC-HC-2026-002",
    proformaId: pro2!.id, clientId: clientRecs[3]!.id,
    status: "paid", totalAmount: "22000000", paidAmount: "22000000",
    currency: "XOF", dueDate: D(2026,3,5), issuedAt: D(2026,3,1),
    notes: "Facture — Formation cadres Ecobank. Réglée par virement.",
  }).returning();
  await db.insert(paymentsTable).values({
    organizationId: orgId, invoiceId: inv2!.id,
    amount: "22000000", currency: "XOF", method: "virement",
    transactionStatus: "confirmed", reference: "VIR-ECOBK-20260302",
    paidAt: DT(2026,3,2,9), notes: "Paiement intégral avant démarrage",
  }).catch(() => {});

  // Facture 3 — Paiement partiel (en retard)
  const [inv3] = await db.insert(invoicesTable).values({
    organizationId: orgId, referenceNumber: "FAC-HC-2026-003",
    clientId: clientRecs[2]!.id,
    status: "partial", totalAmount: "67500000", paidAmount: "20250000",
    currency: "XOF", dueDate: D(2026,5,31), issuedAt: D(2026,4,15),
    dunningStatus: "sent", lastDunnedAt: D(2026,6,10),
    notes: "Acompte reçu. Solde en attente. Relance envoyée.",
  }).returning();
  await db.insert(paymentsTable).values({
    organizationId: orgId, invoiceId: inv3!.id,
    amount: "20250000", currency: "XOF", method: "virement",
    transactionStatus: "confirmed", reference: "VIR-ORA-20260430",
    paidAt: DT(2026,4,30,11), notes: "Acompte 30%",
  }).catch(() => {});

  // Avoir — remise accordée sur mission formation
  await db.insert(creditNotesTable).values({
    organizationId: orgId, referenceNumber: "AV-HC-2026-001",
    invoiceId: inv2!.id, clientId: clientRecs[3]!.id,
    reason: "Remise commerciale accordée suite à renouvellement de contrat annuel",
    amount: "1100000", appliedAmount: "1100000",
    currency: "XOF", status: "applied",
  }).catch(() => {});

  // Proforma en attente de signature
  await db.insert(proformasTable).values({
    organizationId: orgId, referenceNumber: "PRO-HC-2026-003",
    clientId: clientRecs[5]!.id,
    status: "sent", totalAmount: "145000000", currency: "XOF",
    validUntil: D(2026,9,15), paymentTerms: "30/40/30 selon jalons",
    durationDays: 180, notes: "En attente de validation comité de direction NSIA.",
  }).catch(() => {});

  // ══════════════════════════════════════════════════════════════════════════
  // 9. ÉQUIPEMENTS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("  • Équipements…");
  const [catIT, catMob, catBur] = await db.insert(equipmentCategoriesTable).values([
    { organizationId: orgId, name: "Informatique & Réseau", description: "Serveurs, postes de travail, équipements réseau" },
    { organizationId: orgId, name: "Mobilité & Téléphonie",  description: "Smartphones, tablettes, SIM data" },
    { organizationId: orgId, name: "Mobilier & Bureau",       description: "Bureaux, fauteuils, salles de réunion" },
  ]).returning();

  await db.insert(equipmentTable).values([
    { organizationId: orgId, categoryId: catIT!.id, code: "HC-IT-001", name: "Serveur Dell PowerEdge R750",     status: "available", quantity: 1, availableQuantity: 1, location: "Salle serveurs — Bât A", description: "Serveur rack 2U — 32 cores, 128 Go RAM, 2 To NVMe" },
    { organizationId: orgId, categoryId: catIT!.id, code: "HC-IT-002", name: "Switch HP Aruba 48 ports",        status: "available", quantity: 1, availableQuantity: 1, location: "Salle serveurs — Bât A", description: "Switch administrable L3 48 ports 1G + 4 SFP+" },
    { organizationId: orgId, categoryId: catIT!.id, code: "HC-IT-003", name: "Laptop Dell Latitude 5540",       status: "in_use",    quantity: 1, availableQuantity: 0, location: "Affecté — Kodjo Hissado", description: "Core i7 13e gen, 16 Go RAM, 512 Go SSD" },
    { organizationId: orgId, categoryId: catMob!.id, code: "HC-MB-001", name: "Tablette Samsung Galaxy Tab S9", status: "in_use",    quantity: 1, availableQuantity: 0, location: "Kiosk Entrée principale", description: "Kiosk de pointage — Android 13, 12 pouces" },
    { organizationId: orgId, categoryId: catMob!.id, code: "HC-MB-002", name: "Téléphone Cisco IP 7945",        status: "available", quantity: 2, availableQuantity: 2, location: "Accueil", description: "Téléphone IP fixe, écran couleur" },
    { organizationId: orgId, categoryId: catBur!.id, code: "HC-BU-001", name: "Projecteur Epson EB-L200F",      status: "available", quantity: 1, availableQuantity: 1, location: "Salle de réunion RDC", description: "Vidéoprojecteur laser 4500 lumens, Full HD" },
  ]).catch(() => {});

  // ══════════════════════════════════════════════════════════════════════════
  // 10. KIOSK + POINTAGES (15 sessions, 30 records)
  // ══════════════════════════════════════════════════════════════════════════
  console.log("  • Kiosk + Présences…");
  const [kiosk] = await db.insert(kiosksTable).values({
    organizationId: orgId,
    name: "Kiosk Entrée Principale",
    location: "Hall d'accueil — RDC",
    description: "Kiosk de pointage principal — Hissado Consulting Lomé",
    isActive: true,
  }).returning();

  // 4 semaines × 5 collaborateurs — données de démo rapports présences
  // Patterns variés : retards / h.sup / départs anticipés / ponctuel
  const WORK_DATES_4W = [
    "2026-06-02","2026-06-03","2026-06-04","2026-06-05","2026-06-06",
    "2026-06-09","2026-06-10","2026-06-11","2026-06-12","2026-06-13",
    "2026-06-16","2026-06-17","2026-06-18","2026-06-19","2026-06-20",
    "2026-06-23","2026-06-24","2026-06-25","2026-06-26","2026-06-27",
  ];
  // Pattern par index de collab : late=jours tardifs, early=départs anticipés, ot=jours h.sup.
  const ATTN_PATTERNS = [
    { late: [4],              earlyLeave: [],           ot: [2,10,17]           }, // ponctuel, quelques h.sup
    { late: [1,6,11,16],     earlyLeave: [8],           ot: [0,5,14]            }, // souvent en retard
    { late: [0],              earlyLeave: [],           ot: [0,1,2,3,5,6,7,8,10,11,12,13] }, // champion h.sup
    { late: [3,9],            earlyLeave: [15,18],      ot: [4,12,19]           }, // profil mixte
    { late: [2,14],           earlyLeave: [6,10,17],    ot: [1,9]               }, // départs anticipés
  ];
  const demoCollabs = allCollabs.slice(0, 5).map(c => c.id);
  for (let ci = 0; ci < demoCollabs.length; ci++) {
    const cId = demoCollabs[ci]!;
    const pat = ATTN_PATTERNS[ci % ATTN_PATTERNS.length]!;
    for (let di = 0; di < WORK_DATES_4W.length; di++) {
      const workDate = WORK_DATES_4W[di]!;
      const [y, m, dd] = workDate.split("-").map(Number) as [number,number,number];
      const isLate = pat.late.includes(di);
      const isEarlyLeave = pat.earlyLeave.includes(di);
      const isOvertime = pat.ot.includes(di);
      const ciMins = isLate ? 30 : 0;
      const coMins = isEarlyLeave ? -90 : isOvertime ? 90 : 30;
      const clockIn = DT(y, m, dd, 8, 0 + ciMins);
      const clockOut = DT(y, m, dd, 17, 30 + coMins);
      const breakMin = 60;
      const totalMin = Math.round((clockOut.getTime() - clockIn.getTime()) / 60_000);
      const effectMin = totalMin - breakMin;
      const overtimeMin = Math.max(0, effectMin - 480);
      const [sess] = await db.insert(attendanceSessionsTable).values({
        organizationId: orgId, collaboratorId: cId,
        workDate, status: "closed",
        clockInAt: clockIn, clockOutAt: clockOut,
        totalMinutes: totalMin, breakMinutes: breakMin,
        effectiveMinutes: effectMin, overtimeMinutes: overtimeMin, expectedMinutes: 480,
        isLate, isEarlyLeave, approvalStatus: "approved",
      }).onConflictDoNothing().returning();
      if (!sess) continue;
      await db.insert(attendanceRecordsTable).values([
        { organizationId: orgId, sessionId: sess.id, collaboratorId: cId, kind: "clock_in",  occurredAt: sess.clockInAt!,  latitude: "6.1722", longitude: "1.2313", locationLabel: "Hissado Consulting — Hall d'accueil", sourceDevice: "Kiosk Samsung Tab S9", source: "kiosk", kioskId: kiosk!.id, status: "validated" },
        { organizationId: orgId, sessionId: sess.id, collaboratorId: cId, kind: "clock_out", occurredAt: sess.clockOutAt!, latitude: "6.1722", longitude: "1.2313", locationLabel: "Hissado Consulting — Hall d'accueil", sourceDevice: "Kiosk Samsung Tab S9", source: "kiosk", kioskId: kiosk!.id, status: "validated" },
      ]).catch(() => {});
      // Flags automatiques
      if (isLate || isEarlyLeave) {
        await db.insert(attendanceFlagsTable).values({
          organizationId: orgId, collaboratorId: cId, sessionId: sess.id,
          workDate, kind: isLate ? "late" : "early_leave",
          severity: isLate ? "warning" : "info",
          description: isLate ? `Arrivée tardive de 30 min (${workDate})` : `Départ anticipé de 90 min (${workDate})`,
          isResolved: false,
        }).onConflictDoNothing().catch(() => {});
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 10b. CORRECTIONS DE POINTAGE (3 démos)
  // ══════════════════════════════════════════════════════════════════════════
  console.log("  • Corrections de pointage (3 démos)…");
  const corrDefs = [
    { cId: demoCollabs[1]!, workDate: "2026-06-03", kind: "clock_in",  proposedAt: DT(2026,6,3,8,0),    reason: "Mon arrivée kiosk n'a pas été enregistrée à 08h00 car j'avais une réunion externe. La pointeuse était hors service.", status: "approved", reviewComment: "Confirmé avec le registre visiteurs du client. Correction appliquée." },
    { cId: demoCollabs[3]!, workDate: "2026-06-10", kind: "clock_out", proposedAt: DT(2026,6,10,17,30), reason: "Mon départ réel était 17h30 et non 16h00. La panne kiosk en fin de journée a empêché le pointage.", status: "rejected",  reviewComment: "Log kiosk ne confirme pas ce départ. Demande rejetée faute de preuve." },
    { cId: demoCollabs[0]!, workDate: "2026-06-17", kind: "break",     proposedAt: null as Date | null,  reason: "Ma pause affichée (90 min) est incorrecte — j'ai reçu un appel client urgent et suis revenu au bureau après seulement 45 min.", status: "pending",  reviewComment: null as string | null },
  ];
  for (const def of corrDefs) {
    const [csess] = await db.select({ id: attendanceSessionsTable.id })
      .from(attendanceSessionsTable)
      .where(and(eq(attendanceSessionsTable.organizationId, orgId), eq(attendanceSessionsTable.collaboratorId, def.cId), eq(attendanceSessionsTable.workDate, def.workDate)))
      .limit(1);
    if (!csess) { console.warn(`    ⚠ Session introuvable: ${def.workDate}`); continue; }
    await db.insert(attendanceCorrectionsTable).values({
      organizationId: orgId, collaboratorId: def.cId, sessionId: csess.id,
      kind: def.kind, proposedAt: def.proposedAt, reason: def.reason,
      status: def.status, reviewComment: def.reviewComment,
    }).catch(() => {});
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 11. TICKETS SUPPORT (6)
  // ══════════════════════════════════════════════════════════════════════════
  console.log("  • Tickets support (6)…");
  const TICKETS = [
    { subject: "Problème de synchronisation kiosk",                        desc: "Le kiosk ne synchronise plus les pointages depuis ce matin.",  cat: "technical", prio: "high",   status: "open",     createdById: dgId },
    { subject: "Export Excel budget — colonnes manquantes",                 desc: "L'export FP&A Budget ne génère pas les colonnes 'Écart %'.",   cat: "bug",       prio: "medium", status: "in_progress", createdById: finId },
    { subject: "Demande d'accès module Comptabilité pour Koami Adzoa",     desc: "Koami Adzoa (Analyste) doit accéder au module Comptabilité.", cat: "access",    prio: "low",    status: "resolved", createdById: rhId,   resolvedAt: DT(2026,5,20,14) },
    { subject: "Erreur 500 sur /api/fpa/variance lors du filtre département", desc: "Filtre département dans la page Variance FP&A cause une 500.", cat: "bug",  prio: "high",   status: "resolved", createdById: finId,  resolvedAt: DT(2026,6,1,11) },
    { subject: "Question : Comment archiver une facture dans Gameasu ?",   desc: "Je cherche la procédure pour archiver les factures payées.", cat: "question",  prio: "low",    status: "resolved", createdById: finId,  resolvedAt: DT(2026,4,10,9) },
    { subject: "Doublon collaborateur après import",                        desc: "Un collaborateur apparaît deux fois dans la liste RH.",       cat: "bug",       prio: "medium", status: "open",     createdById: rhId },
  ];
  for (const t of TICKETS) {
    await db.insert(ticketsTable).values({
      organizationId: orgId,
      subject: t.subject, description: t.desc,
      category: t.cat, priority: t.prio, status: t.status,
      createdById: t.createdById, assigneeId: opsId,
      resolvedAt: t.resolvedAt ?? null,
    }).catch(() => {});
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 12. NOTIFICATIONS (12)
  // ══════════════════════════════════════════════════════════════════════════
  console.log("  • Notifications (12)…");
  const NOTIFS = [
    { uid: dgId,  title: "Nouvelle opportunité qualifiée",          body: "L'opportunité « Conseil fusion-acquisition Bolloré » vient d'être qualifiée.",       type: "info",    isRead: "false" },
    { uid: finId, title: "Facture FAC-HC-2026-003 en retard",        body: "ORABANK Togo n'a pas réglé le solde de 47 250 000 FCFA. Relance envoyée.",          type: "warning", isRead: "false" },
    { uid: rhId,  title: "Demande de congé à valider",              body: "Eyram Apélété a déposé une demande de congé du 01/09 au 12/09/2026.",                type: "info",    isRead: "false" },
    { uid: dgId,  title: "Paiement reçu — Ecobank",                 body: "Virement de 22 000 000 FCFA reçu pour FAC-HC-2026-002.",                            type: "success", isRead: "true" },
    { uid: opsId, title: "Tâche en retard — Audit SI BSIC",          body: "La tâche « Rédaction rapport final » est en retard de 5 jours.",                   type: "warning", isRead: "false" },
    { uid: dgId,  title: "Nouveau ticket support ouvert",            body: "Un ticket priorité HAUTE a été ouvert : Problème synchronisation kiosk.",           type: "warning", isRead: "false" },
    { uid: comId, title: "Opportunité gagnée !",                     body: "L'opportunité « Audit réglementaire BCEAO » est marquée comme gagnée (32M FCFA).", type: "success", isRead: "true" },
    { uid: finId, title: "Abonnement Gameasu renouvelé",             body: "Votre abonnement Professional a été renouvelé pour le mois prochain.",              type: "info",    isRead: "true" },
    { uid: rhId,  title: "Anniversaire d'embauche — Mawuena Agbeko", body: "Mawuena Agbeko fête ses 7 ans dans l'entreprise aujourd'hui. Félicitations !",     type: "info",    isRead: "false" },
    { uid: opsId, title: "Nouveau projet créé",                      body: "Le projet « Implémentation ERP Bolloré Togo » a été créé et vous a été assigné.",   type: "info",    isRead: "true" },
    { uid: finId, title: "Export budget disponible",                 body: "L'export Excel du budget FP&A 2026 est prêt au téléchargement.",                   type: "success", isRead: "false" },
    { uid: dgId,  title: "Rapport mensuel disponible",               body: "Le rapport de performance juin 2026 est disponible dans la section Rapports.",      type: "info",    isRead: "false" },
  ];
  for (const n of NOTIFS) {
    await db.insert(notificationsTable).values({
      organizationId: orgId, userId: n.uid,
      title: n.title, body: n.body, type: n.type, isRead: n.isRead,
    }).catch(() => {});
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 13. COMPTES BANCAIRES + FOURNISSEURS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("  • Fournisseurs…");
  await db.insert(suppliersTable).values([
    { organizationId: orgId, code: "F001", name: "Logitek Togo SARL",         email: "contact@logitek.tg",           phone: "+228 22 54 10 20", address: "Rue des Entrepreneurs, Lomé",     paymentTerms: "30 jours net", isActive: true },
    { organizationId: orgId, code: "F002", name: "Cabinet Martial & Associés", email: "cabinet@martial-avocats.tg",  phone: "+228 22 21 40 15", address: "Ave du Président Grunitzky, Lomé", paymentTerms: "À réception",  isActive: true },
    { organizationId: orgId, code: "F003", name: "Print Express Lomé",         email: "info@printexpress.tg",        phone: "+228 22 61 88 77", address: "Zone Industrielle, Lomé",          paymentTerms: "15 jours",     isActive: true },
    { organizationId: orgId, code: "F004", name: "CANAL+ Entreprises Togo",    email: "b2b@canalplus.tg",            phone: "+228 22 23 14 00", address: "Bd du 13 Janvier, Lomé",          paymentTerms: "Mensuel",      isActive: true },
    { organizationId: orgId, code: "F005", name: "TotalEnergies Togo",         email: "cartes@total.tg",             phone: "+228 22 21 04 04", address: "Ave du Général de Gaulle, Lomé",  paymentTerms: "30 jours",     isActive: true },
  ]).catch(() => {});

  console.log("  ✅ Seed Hissado Consulting terminé avec succès !");
  console.log(`     Org ID : ${orgId}`);
  console.log("     Credentials demo :");
  console.log("       direction@hissadoconsulting.com   / hissado123  (Super Admin — Kodjo Hissado)");
  console.log("       admin@hissadoconsulting.com       / hissado123  (Admin — Eglantine Toviho)");
  console.log("       finance@hissadoconsulting.com     / finance123  (DAF — Mawuena Agbeko)");
  console.log("       commercial@hissadoconsulting.com  / com123      (Commercial — Yawo Sossou-Agbessi)");
  console.log("       rh@hissadoconsulting.com          / rh123       (DRH — Adjoa Datsakpo)");
  console.log("       operations@hissadoconsulting.com  / ops123      (Ops — Komlan Tsigbe)");
}

// Pas d'auto-run : ce module est appelé explicitement par le boot de l'API
// (artifacts/api-server/src/routes/index.ts) ou via le script `pnpm run seed:hissado`.
// L'auto-run via `import.meta.url === argv[1]` est ambigu une fois bundlé.
