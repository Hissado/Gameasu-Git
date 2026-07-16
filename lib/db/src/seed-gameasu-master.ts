/**
 * Gameasu — Master Demo Seed v2.0
 *
 * Seed complet et professionnel pour la démonstration de la plateforme.
 * Couvre : Users, SaaS, Clients, CRM, Projets, RH, Équipements, Locations,
 *          Commandes, Finance, Comptabilité, Stock, Opérations, Messagerie,
 *          Tickets Support, Cockpit, Présences/Pointage.
 *
 * Emails : tous les comptes internes utilisent @gameasu.com
 *
 * Lancement :
 *   cd lib/db && pnpm exec tsx src/seed-gameasu-master.ts
 */

import { db } from "./index";
import { sql, eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  usersTable,
  organizationsTable, organizationMembersTable,
  moduleCatalogTable, subscriptionPlansTable, subscriptionPlanFeaturesTable,
  organizationSubscriptionsTable, organizationModulesTable, billingEventsTable,
  clientsTable, clientContactsTable, opportunitiesTable, activitiesTable,
  projectsTable, projectPhasesTable, tasksTable, taskCommentsTable,
  collaboratorsTable,
  equipmentCategoriesTable, equipmentTable,
  rentalsTable, rentalItemsTable, inspectionsTable, logisticsOperationsTable,
  ordersTable, proformasTable, invoicesTable, paymentsTable,
  conversationsTable, conversationParticipantsTable, messagesTable, notificationsTable,
  documentsTable,
  ticketsTable, ticketCommentsTable, incidentsTable, cockpitAuditLogsTable,
  departmentsTable, positionsTable, contractsTable,
  chartOfAccountsTable, fiscalPeriodsTable, journalsTable, journalEntriesTable, journalEntryLinesTable,
  bankAccountsTable, suppliersTable,
  productCategoriesTable, productsTable,
  attendanceSessionsTable, attendanceRecordsTable,
} from "./schema";

// ─── Helpers ────────────────────────────────────────────────────────────────

const D = (offset: number) => {
  const d = new Date("2026-06-14");
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const DT = (offset: number, hour = 9) => {
  const d = new Date("2026-06-14");
  d.setDate(d.getDate() + offset);
  d.setHours(hour, 0, 0, 0);
  return d;
};
const num = (n: number) => n.toFixed(2);

// ─── Modules catalogue ────────────────────────────────────────────────────

const MODULES = [
  { key: "dashboard",            name: "Tableau de bord",               category: "core",     sortOrder: 10,  isCore: true,  icon: "LayoutDashboard" },
  { key: "clients",              name: "Clients",                        category: "core",     sortOrder: 20,  isCore: true,  icon: "Building2" },
  { key: "services",             name: "Services",                       category: "core",     sortOrder: 30,  isCore: true,  icon: "Briefcase" },
  { key: "projects",             name: "Projets",                        category: "core",     sortOrder: 40,  isCore: true,  icon: "FolderKanban" },
  { key: "tasks",                name: "Tâches",                         category: "core",     sortOrder: 50,  isCore: true,  icon: "CheckSquare" },
  { key: "sales_crm",            name: "Ventes & Relation client",       category: "business", sortOrder: 60,  icon: "Target" },
  { key: "accounting",           name: "Comptabilité",                   category: "business", sortOrder: 70,  icon: "Calculator" },
  { key: "financial_planning",   name: "Planification financière",       category: "business", sortOrder: 80,  icon: "TrendingUp" },
  { key: "operations",           name: "Opérations",                     category: "business", sortOrder: 90,  icon: "Truck" },
  { key: "inventory_assets",     name: "Parc & équipements",             category: "business", sortOrder: 100, icon: "Wrench" },
  { key: "inventory_products",   name: "Produits & Stock",               category: "business", sortOrder: 105, icon: "Package" },
  { key: "rentals",              name: "Locations",                      category: "business", sortOrder: 110, icon: "Truck" },
  { key: "documents",            name: "Documents",                      category: "core",     sortOrder: 120, isCore: true,  icon: "FolderOpen" },
  { key: "team_hr",              name: "Équipe & RH",                    category: "business", sortOrder: 130, icon: "UsersRound" },
  { key: "communications",       name: "Communications",                 category: "business", sortOrder: 140, icon: "MessageSquare" },
  { key: "reports",              name: "Rapports",                       category: "business", sortOrder: 150, icon: "BarChart3" },
  { key: "client_portal",        name: "Portail client",                 category: "business", sortOrder: 160, icon: "ExternalLink" },
  { key: "marketing",            name: "Marketing",                      category: "business", sortOrder: 170, icon: "Megaphone" },
  { key: "administration",       name: "Administration",                 category: "admin",    sortOrder: 200, isCore: true,  icon: "Shield" },
  { key: "billing_subscription", name: "Abonnement & facturation",       category: "admin",    sortOrder: 210, isCore: true,  icon: "CreditCard" },
  { key: "workspace_settings",   name: "Paramètres de l'espace de travail", category: "admin", sortOrder: 220, isCore: true, icon: "Settings" },
];

const PLANS = [
  {
    code: "STARTER", name: "Starter", tagline: "Démarrer simplement",
    description: "Pour les petites équipes qui structurent leur activité.",
    monthlyPricePerSeat: 8_000, annualPricePerSeat: 80_000, setupFee: 0,
    minimumSeats: 1, includedSeats: 3, maxSeats: 10,
    includedModules: ["dashboard","clients","services","projects","tasks","documents","communications","reports","administration","billing_subscription","workspace_settings"],
    isFeatured: false, sortOrder: 10,
    features: ["Jusqu'à 10 utilisateurs","Clients, services, projets, tâches","Documents centralisés","Messagerie d'équipe","Support standard"],
  },
  {
    code: "GROWTH", name: "Growth", tagline: "Accélérer la croissance",
    description: "Pour les organisations en expansion qui veulent vendre et facturer.",
    monthlyPricePerSeat: 18_000, annualPricePerSeat: 180_000, setupFee: 250_000,
    minimumSeats: 3, includedSeats: 10, maxSeats: 30,
    includedModules: ["dashboard","clients","services","projects","tasks","sales_crm","accounting","documents","team_hr","communications","reports","administration","billing_subscription","workspace_settings"],
    isFeatured: false, sortOrder: 20,
    features: ["Jusqu'à 30 utilisateurs","CRM & pipeline commercial","Comptabilité SYSCOHADA","Équipe & RH","Onboarding & formation incluse"],
  },
  {
    code: "PREMIUM", name: "Premium", tagline: "Le standard complet",
    description: "Pour les structures multi-services qui pilotent finance et opérations.",
    monthlyPricePerSeat: 35_000, annualPricePerSeat: 350_000, setupFee: 750_000,
    minimumSeats: 5, includedSeats: 25, maxSeats: 100,
    includedModules: MODULES.map(m => m.key),
    isFeatured: true, sortOrder: 30,
    features: ["Jusqu'à 100 utilisateurs","Planification financière & forecast","Parc, locations, opérations","Portail client & marketing","Account manager dédié"],
  },
  {
    code: "ENTERPRISE", name: "Enterprise", tagline: "Sur-mesure et souverain",
    description: "Pour les groupes et grandes organisations à exigences avancées.",
    monthlyPricePerSeat: 60_000, annualPricePerSeat: 600_000, setupFee: 2_500_000,
    minimumSeats: 10, includedSeats: 100, maxSeats: null,
    includedModules: MODULES.map(m => m.key),
    isFeatured: false, sortOrder: 40,
    features: ["Utilisateurs illimités","Tous les modules activés","SSO, audit avancé, SLA","Hébergement souverain disponible","Customisations & intégrations sur-mesure"],
  },
];

// ─── MAIN ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Gameasu — Master Demo Seed v2.0");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // ── 0. Truncate business data ──────────────────────────────────────────
  console.log("→ Nettoyage des données métier...");
  await db.execute(sql`
    TRUNCATE TABLE
      cockpit_audit_logs, incidents, ticket_comments,
      tickets,
      attendance_records, attendance_sessions,
      notifications,
      user_presence, push_subscriptions, whatsapp_channels,
      message_reactions, message_reads, message_mentions, message_attachments,
      messages, conversation_participants, conversations,
      documents,
      payments,
      credit_notes,
      invoices,
      sales_lines,
      proformas,
      orders,
      rental_items, inspections, logistics_operations, rentals,
      equipment_movements, equipment, equipment_categories,
      task_comments, task_history, tasks, project_phases, projects,
      crm_activities, opportunities, client_notes, client_email_logs, client_contacts, clients,
      collaborator_assignments, contracts, hr_documents, collaborators,
      departments, positions,
      stock_movements, product_categories, products,
      journal_entry_lines, journal_entries, fiscal_periods, journals,
      analytical_entries, analytical_accounts, cost_centers,
      chart_of_accounts, bank_transactions, bank_accounts, supplier_invoices, supplier_payments, suppliers
    CASCADE
  `);
  console.log("  ✓ Tables métier nettoyées");

  // ── 1. Organisation cible ──────────────────────────────────────────────
  // Priorité : org existante du client réel → sinon gameasu-technologies
  console.log("→ Organisation...");
  const PREFERRED_SLUGS = ["hissado-consulting", "nexora-demo", "gameasu-technologies"];
  let org: typeof organizationsTable.$inferSelect | undefined;
  for (const slug of PREFERRED_SLUGS) {
    const rows = await db.select().from(organizationsTable).where(eq(organizationsTable.slug, slug)).limit(1);
    if (rows[0]) { org = rows[0]; break; }
  }
  if (!org) {
    const rows = await db.insert(organizationsTable).values({
      slug: "gameasu-technologies",
      name: "Gameasu Technologies",
      legalName: "Gameasu Technologies SARL",
      industry: "Services aux entreprises & BTP",
      country: "TG",
      currency: "XOF",
      timezone: "Africa/Lome",
      locale: "fr-FR",
      contactEmail: "contact@gameasu.com",
      isDefault: true,
      primaryColor: "#F37021",
      secondaryColor: "#0F172A",
    }).onConflictDoUpdate({
      target: organizationsTable.slug,
      set: { name: "Gameasu Technologies", isDefault: true },
    }).returning();
    org = rows[0]!;
  }
  // Mise à jour des métadonnées premium de l'org cible
  await db.update(organizationsTable).set({
    industry: "Services aux entreprises & BTP",
    country: "TG",
    currency: "XOF",
    timezone: "Africa/Lome",
    locale: "fr-FR",
    isDefault: true,
    primaryColor: "#F37021",
    secondaryColor: "#0F172A",
  }).where(eq(organizationsTable.id, org.id));
  // Désactiver le flag default sur les autres orgs
  await db.execute(sql`UPDATE organizations SET is_default = false WHERE id != ${org.id}`);
  const orgId = org.id;
  console.log(`  ✓ Org cible: ${org.name} (${orgId.slice(0, 8)}…)`);

  // ── 2. Plans & modules SaaS ──────────────────────────────────────────
  console.log("→ Catalogue modules & plans...");
  for (const m of MODULES) {
    await db.insert(moduleCatalogTable).values({
      key: m.key, name: m.name, category: m.category,
      sortOrder: m.sortOrder, isCore: m.isCore ?? false, icon: m.icon,
    }).onConflictDoUpdate({ target: moduleCatalogTable.key, set: { name: m.name } });
  }
  const planIds: Record<string, string> = {};
  for (const p of PLANS) {
    const [row] = await db.insert(subscriptionPlansTable).values({
      code: p.code, name: p.name, tagline: p.tagline, description: p.description,
      monthlyPricePerSeat: p.monthlyPricePerSeat, annualPricePerSeat: p.annualPricePerSeat,
      setupFee: p.setupFee, minimumSeats: p.minimumSeats, includedSeats: p.includedSeats,
      maxSeats: p.maxSeats ?? null, includedModules: p.includedModules,
      isFeatured: p.isFeatured, sortOrder: p.sortOrder, currency: "XOF",
    }).onConflictDoUpdate({ target: subscriptionPlansTable.code, set: { name: p.name } }).returning({ id: subscriptionPlansTable.id });
    planIds[p.code] = row.id;
    await db.delete(subscriptionPlanFeaturesTable).where(eq(subscriptionPlanFeaturesTable.planId, row.id));
    for (let i = 0; i < p.features.length; i++) {
      await db.insert(subscriptionPlanFeaturesTable).values({ planId: row.id, label: p.features[i]!, included: true, sortOrder: (i + 1) * 10 });
    }
  }
  console.log("  ✓ Plans & modules");

  // ── 3. Users ──────────────────────────────────────────────────────────
  console.log("→ Utilisateurs...");
  // Upsert the 7 @gameasu.com demo accounts (old @edole.africa users stay but are
  // harmless since all business data was already truncated above).

  const userRows = [
    { email: "admin@gameasu.com",      password: "admin123",      firstName: "Jacques",  lastName: "Koami Mensah",     role: "super_admin",   phone: "+228 90 00 00 01" },
    { email: "directeur@gameasu.com",  password: "admin123",      firstName: "Komi",     lastName: "Agbemelo",         role: "manager",       phone: "+228 90 00 00 02" },
    { email: "commercial@gameasu.com", password: "commercial123", firstName: "Aminata",  lastName: "Diallo-Touré",     role: "commercial",    phone: "+228 90 00 00 03" },
    { email: "finance@gameasu.com",    password: "finance123",    firstName: "Salif",    lastName: "Koné",             role: "collaborator",  phone: "+228 90 00 00 04" },
    { email: "rh@gameasu.com",         password: "rh123",         firstName: "Mariam",   lastName: "Ouédraogo-Sawadogo", role: "collaborator", phone: "+228 90 00 00 05" },
    { email: "operations@gameasu.com", password: "ops123",        firstName: "Moussa",   lastName: "Konaté",           role: "collaborator",  phone: "+228 90 00 00 06" },
    { email: "support@gameasu.com",    password: "support123",    firstName: "Afi",      lastName: "Lawson",           role: "collaborator",  phone: "+228 90 00 00 07" },
  ];

  const users: Record<string, typeof usersTable.$inferSelect> = {};
  for (const u of userRows) {
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, u.email)).limit(1);
    let userRecord: typeof usersTable.$inferSelect;
    if (existing.length > 0) {
      await db.update(usersTable).set({ password: u.password, firstName: u.firstName, lastName: u.lastName, role: u.role, isActive: true, organizationId: orgId }).where(eq(usersTable.email, u.email));
      userRecord = { ...existing[0]!, password: u.password, firstName: u.firstName, lastName: u.lastName, role: u.role, isActive: true, organizationId: orgId };
    } else {
      const [row] = await db.insert(usersTable).values({ ...u, isActive: true, isClient: false, organizationId: orgId }).returning();
      userRecord = row!;
    }
    users[u.email] = userRecord;
  }

  const admin = users["admin@gameasu.com"]!;
  const directeur = users["directeur@gameasu.com"]!;
  const commercial = users["commercial@gameasu.com"]!;
  const finance = users["finance@gameasu.com"]!;
  const rh = users["rh@gameasu.com"]!;
  const operations = users["operations@gameasu.com"]!;
  const support = users["support@gameasu.com"]!;
  console.log("  ✓ 7 utilisateurs @gameasu.com");

  // Membership @gameasu.com
  for (const u of Object.values(users)) {
    const role = u.role === "super_admin" ? "owner" : u.role === "manager" ? "manager" : "member";
    await db.insert(organizationMembersTable).values({ organizationId: orgId, userId: u.id, role, isPrimary: true }).onConflictDoNothing();
  }
  // Ensure existing users already in the target org are also registered as members (owner)
  const existingOrgUsers = await db.select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable).where(eq(usersTable.organizationId, orgId));
  for (const u of existingOrgUsers) {
    const role = u.role === "super_admin" ? "owner" : u.role === "manager" ? "manager" : "member";
    await db.insert(organizationMembersTable).values({ organizationId: orgId, userId: u.id, role, isPrimary: true }).onConflictDoNothing();
  }

  // Subscription Professional
  const existingSub = await db.select().from(organizationSubscriptionsTable)
    .where(and(eq(organizationSubscriptionsTable.organizationId, orgId), eq(organizationSubscriptionsTable.isCurrent, true))).limit(1);
  let subId: string;
  if (existingSub.length > 0) {
    subId = existingSub[0]!.id;
  } else {
    const now = new Date();
    const periodEnd = new Date(now); periodEnd.setMonth(periodEnd.getMonth() + 1);
    const [sub] = await db.insert(organizationSubscriptionsTable).values({
      organizationId: orgId, planId: planIds["PREMIUM"]!, status: "active",
      billingCycle: "monthly", seats: 25, currentPeriodStart: now, currentPeriodEnd: periodEnd,
      unitPrice: 35_000, setupFee: 750_000, currency: "XOF", isCurrent: true,
    }).returning({ id: organizationSubscriptionsTable.id });
    subId = sub!.id;
  }

  // Modules activated
  for (const m of MODULES) {
    await db.insert(organizationModulesTable).values({ organizationId: orgId, moduleKey: m.key, enabled: true, source: "plan" }).onConflictDoNothing();
  }

  // Billing history (6 mois)
  const existingBilling = await db.select().from(billingEventsTable).where(eq(billingEventsTable.organizationId, orgId)).limit(1);
  if (existingBilling.length === 0) {
    for (let i = 6; i >= 1; i--) {
      const d = new Date("2026-06-14"); d.setMonth(d.getMonth() - i);
      await db.insert(billingEventsTable).values({
        organizationId: orgId, subscriptionId: subId, kind: "invoice",
        label: `Abonnement Professional — ${d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`,
        amount: 35_000 * 25, status: "paid", currency: "XOF",
        reference: `GM-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}-001`,
        occurredAt: d,
      }).onConflictDoNothing();
    }
    await db.insert(billingEventsTable).values({
      organizationId: orgId, subscriptionId: subId, kind: "setup_fee",
      label: "Frais d'installation & onboarding Premium",
      amount: 750_000, status: "paid", currency: "XOF",
      reference: "GM-SETUP-2025-001",
      occurredAt: new Date("2025-12-01"),
    }).onConflictDoNothing();
  }
  console.log("  ✓ Abonnement Professional + historique facturation");

  // ── 4. Clients ───────────────────────────────────────────────────────
  console.log("→ Clients (15 entreprises ouest-africaines)...");
  const clientRows = await db.insert(clientsTable).values([
    { organizationId: orgId, name: "CEET — Compagnie Énergie Électrique du Togo", email: "marches@ceet.tg", phone: "+228 22 21 80 20", industry: "Énergie & Électricité", address: "Avenue de la Libération, Lomé", website: "https://ceet.tg", status: "active", creditLimit: "250000000", paymentTermsDays: 45 },
    { organizationId: orgId, name: "Port Autonome de Lomé", email: "achats@portdelome.tg", phone: "+228 22 27 47 42", industry: "Logistique portuaire", address: "Boulevard du Mono, Lomé", website: "https://portdelome.tg", status: "active", creditLimit: "500000000", paymentTermsDays: 60 },
    { organizationId: orgId, name: "WACEM SA — West African Cement", email: "commercial@wacem.tg", phone: "+228 22 26 84 30", industry: "Cimenterie & Matériaux BTP", address: "Zone industrielle, Tabligbo", website: "https://wacem.tg", status: "active", creditLimit: "180000000", paymentTermsDays: 30 },
    { organizationId: orgId, name: "Lomé Construction SA", email: "contact@lome-construction.tg", phone: "+228 22 21 30 45", industry: "BTP & Génie civil", address: "Boulevard du Mono, Bè, Lomé", website: "https://lome-construction.tg", status: "active", creditLimit: "120000000", paymentTermsDays: 30 },
    { organizationId: orgId, name: "BTCI — Banque Togolaise pour le Commerce", email: "infra@btci.tg", phone: "+228 22 21 46 41", industry: "Banque & Finance", address: "Avenue Sylvanus Olympio, Lomé", website: "https://btci.tg", status: "active", creditLimit: "80000000", paymentTermsDays: 45 },
    { organizationId: orgId, name: "Togocom SA", email: "b2b@togocom.tg", phone: "+228 22 22 03 14", industry: "Télécommunications", address: "Rue de la Kara, Tokoin, Lomé", website: "https://togocom.tg", status: "active", creditLimit: "150000000", paymentTermsDays: 30 },
    { organizationId: orgId, name: "Société des Mines de Kara", email: "ops@minekara.tg", phone: "+228 26 60 12 33", industry: "Mines & Carrières", address: "BP 245, Kara", website: "https://minekara.tg", status: "active", creditLimit: "350000000", paymentTermsDays: 60 },
    { organizationId: orgId, name: "CHU Sylvanus Olympio", email: "logistique@chu-so.tg", phone: "+228 22 21 25 01", industry: "Santé publique", address: "Boulevard Eyadéma, Tokoin, Lomé", website: "https://chu-so.tg", status: "active", creditLimit: "60000000", paymentTermsDays: 90 },
    { organizationId: orgId, name: "Mairie de Lomé", email: "marches@mairie-lome.tg", phone: "+228 22 21 24 24", industry: "Collectivité publique", address: "Place de l'Indépendance, Lomé", website: "https://mairie-lome.tg", status: "active", creditLimit: "200000000", paymentTermsDays: 90 },
    { organizationId: orgId, name: "Bolloré Africa Logistics Togo", email: "togo@bollore.com", phone: "+228 22 27 02 70", industry: "Logistique & Transit", address: "Port Autonome, Lomé", status: "active", creditLimit: "300000000", paymentTermsDays: 45 },
    { organizationId: orgId, name: "ECOBANK Togo", email: "facility@ecobank.tg", phone: "+228 22 21 72 14", industry: "Banque & Finance", address: "2 Rue Koumoré, Lomé", website: "https://ecobank.com", status: "active", creditLimit: "100000000", paymentTermsDays: 30 },
    { organizationId: orgId, name: "BTP Gabon SARL", email: "info@btpgabon.ga", phone: "+241 011 700 200", industry: "Construction & BTP", address: "Avenue Omar Bongo, Libreville", website: "https://btpgabon.ga", status: "active", creditLimit: "95000000", paymentTermsDays: 45 },
    { organizationId: orgId, name: "SOGELEC Cameroun", email: "contact@sogelec.cm", phone: "+237 222 500 100", industry: "Énergie & Électricité", address: "Boulevard du 20 Mai, Yaoundé", website: "https://sogelec.cm", status: "active", creditLimit: "85000000", paymentTermsDays: 30 },
    { organizationId: orgId, name: "CONLOG Côte d'Ivoire", email: "direction@conlog.ci", phone: "+225 27 20 222 333", industry: "Logistique & Transport", address: "Zone Industrielle de Vridi, Abidjan", website: "https://conlog.ci", status: "prospect", creditLimit: "50000000", paymentTermsDays: 30 },
    { organizationId: orgId, name: "SGI Bénin SARL", email: "contact@sgi-benin.bj", phone: "+229 21 30 41 50", industry: "Promotion immobilière", address: "Carré 245, Cotonou, Bénin", status: "prospect", creditLimit: "40000000", paymentTermsDays: 45 },
  ]).returning();

  const C = clientRows;
  console.log(`  ✓ ${C.length} clients`);

  // ── 5. Contacts clients ──────────────────────────────────────────────
  await db.insert(clientContactsTable).values([
    { organizationId: orgId, clientId: C[0]!.id, firstName: "Mawuli", lastName: "Akakpo", email: "m.akakpo@ceet.tg", phone: "+228 90 33 44 55", role: "Chef Marchés Publics", isPrimary: "true" },
    { organizationId: orgId, clientId: C[0]!.id, firstName: "Afi", lastName: "Bokoé", email: "a.bokoe@ceet.tg", phone: "+228 90 11 22 33", role: "Ingénieure Réseaux" },
    { organizationId: orgId, clientId: C[1]!.id, firstName: "Yawo", lastName: "Apélété", email: "y.apelete@portdelome.tg", phone: "+228 91 45 22 88", role: "Directeur Technique", isPrimary: "true" },
    { organizationId: orgId, clientId: C[1]!.id, firstName: "Edem", lastName: "Sossou", email: "e.sossou@portdelome.tg", phone: "+228 91 67 33 21", role: "Chef de Projet Infrastructure" },
    { organizationId: orgId, clientId: C[2]!.id, firstName: "Komla", lastName: "Agbéko", email: "k.agbeko@wacem.tg", phone: "+228 92 14 56 77", role: "Directeur des Opérations", isPrimary: "true" },
    { organizationId: orgId, clientId: C[2]!.id, firstName: "Sylvie", lastName: "Tchakou", email: "s.tchakou@wacem.tg", phone: "+228 92 88 11 30", role: "Responsable Maintenance" },
    { organizationId: orgId, clientId: C[3]!.id, firstName: "Komi", lastName: "Adjété", email: "k.adjete@lome-construction.tg", phone: "+228 90 12 34 56", role: "Directeur Général", isPrimary: "true" },
    { organizationId: orgId, clientId: C[3]!.id, firstName: "Akossiwa", lastName: "Mensah", email: "a.mensah@lome-construction.tg", phone: "+228 90 22 11 77", role: "Responsable Achats" },
    { organizationId: orgId, clientId: C[4]!.id, firstName: "Christine", lastName: "Folly", email: "c.folly@btci.tg", phone: "+228 90 21 14 56", role: "DSI", isPrimary: "true" },
    { organizationId: orgId, clientId: C[5]!.id, firstName: "Komi", lastName: "Lawson", email: "k.lawson@togocom.tg", phone: "+228 90 55 66 77", role: "Directeur B2B", isPrimary: "true" },
    { organizationId: orgId, clientId: C[6]!.id, firstName: "Issifou", lastName: "Tchébou", email: "i.tchebou@minekara.tg", phone: "+228 92 11 22 33", role: "Directeur d'exploitation", isPrimary: "true" },
    { organizationId: orgId, clientId: C[7]!.id, firstName: "Dr. Komi", lastName: "Aledji", email: "k.aledji@chu-so.tg", phone: "+228 90 88 77 66", role: "Directeur Administratif", isPrimary: "true" },
    { organizationId: orgId, clientId: C[8]!.id, firstName: "Adjowa", lastName: "Vovor", email: "a.vovor@mairie-lome.tg", phone: "+228 91 55 66 77", role: "Adjointe Voirie", isPrimary: "true" },
    { organizationId: orgId, clientId: C[9]!.id, firstName: "Jean-Marc", lastName: "Houénou", email: "jm.houenou@bollore.com", phone: "+228 91 88 99 00", role: "Operations Manager", isPrimary: "true" },
    { organizationId: orgId, clientId: C[10]!.id, firstName: "Adoté", lastName: "Kossi", email: "a.kossi@ecobank.tg", phone: "+228 91 22 33 44", role: "Facility Manager", isPrimary: "true" },
    { organizationId: orgId, clientId: C[11]!.id, firstName: "Pierre", lastName: "Atangana", email: "p.atangana@btpgabon.ga", phone: "+241 074 111 222", role: "Directeur Général", isPrimary: "true" },
    { organizationId: orgId, clientId: C[12]!.id, firstName: "Sophie", lastName: "Owono", email: "s.owono@sogelec.cm", phone: "+237 699 111 002", role: "Responsable Achats", isPrimary: "true" },
  ]);

  // ── 6. Opportunités CRM ──────────────────────────────────────────────
  console.log("→ CRM — Opportunités & activités...");
  const opps = await db.insert(opportunitiesTable).values([
    { organizationId: orgId, title: "Extension réseau HTA — 4 postes Kpalimé", clientId: C[0]!.id, stage: "won", value: "210000000", currency: "XOF", probability: 100, assignedToId: commercial.id, expectedCloseDate: D(-25), notes: "Marché attribué. Notification CEET du 20/05/2026. Démarrage prévu mi-juillet." },
    { organizationId: orgId, title: "Rénovation entrepôts portuaires zone 3", clientId: C[1]!.id, stage: "negotiation", value: "320000000", currency: "XOF", probability: 70, assignedToId: directeur.id, expectedCloseDate: D(30), notes: "Conditions de paiement en discussion. RDV DG prévu le 25/06." },
    { organizationId: orgId, title: "Maintenance four cimentier #2 — arrêt annuel", clientId: C[2]!.id, stage: "proposal", value: "95000000", currency: "XOF", probability: 55, assignedToId: commercial.id, expectedCloseDate: D(45), notes: "Offre remise le 10/06. Réponse attendue sous 10 jours." },
    { organizationId: orgId, title: "Siège social — extension R+3 (1 200 m²)", clientId: C[3]!.id, stage: "won", value: "185000000", currency: "XOF", probability: 100, assignedToId: commercial.id, expectedCloseDate: D(-10), notes: "Contrat signé. Démarrage chantier 01/06/2026." },
    { organizationId: orgId, title: "Rénovation 6 agences bancaires — Lot Sud", clientId: C[4]!.id, stage: "negotiation", value: "62000000", currency: "XOF", probability: 75, assignedToId: directeur.id, expectedCloseDate: D(15), notes: "Validation finale comité achats BTCI le 20/06." },
    { organizationId: orgId, title: "Déploiement fibre optique — quartier Adidogomé", clientId: C[5]!.id, stage: "proposal", value: "78000000", currency: "XOF", probability: 50, assignedToId: commercial.id, expectedCloseDate: D(60), notes: "Phase pilote 1 500 ménages. RDV technique le 30/06." },
    { organizationId: orgId, title: "Convoyage minéralier Kara–Lomé 12 mois", clientId: C[6]!.id, stage: "qualified", value: "145000000", currency: "XOF", probability: 40, assignedToId: directeur.id, expectedCloseDate: D(90), notes: "Étude de marché remise. En attente budget annuel minier." },
    { organizationId: orgId, title: "Réhabilitation bloc opératoire CHU — bailleur BAD", clientId: C[7]!.id, stage: "won", value: "280000000", currency: "XOF", probability: 100, assignedToId: admin.id, expectedCloseDate: D(-40), notes: "Marché BAD. Mobilisation équipes en cours." },
    { organizationId: orgId, title: "Voirie zone industrielle Adakpamé phase II", clientId: C[8]!.id, stage: "qualified", value: "510000000", currency: "XOF", probability: 35, assignedToId: directeur.id, expectedCloseDate: D(120), notes: "Appel d'offres public prévu Q3. Pré-qualification validée." },
    { organizationId: orgId, title: "Entrepôt frigorifique Bolloré — 8 000 m²", clientId: C[9]!.id, stage: "proposal", value: "385000000", currency: "XOF", probability: 55, assignedToId: commercial.id, expectedCloseDate: D(55), notes: "Conception-réalisation. Avant-projet sommaire remis." },
    { organizationId: orgId, title: "Sécurisation périmétrique — 8 agences ECOBANK", clientId: C[10]!.id, stage: "negotiation", value: "42000000", currency: "XOF", probability: 80, assignedToId: commercial.id, expectedCloseDate: D(10), notes: "Prix validé. Calendrier en finalisation." },
    { organizationId: orgId, title: "Maintenance lourde grue chantier Libreville", clientId: C[11]!.id, stage: "won", value: "18500000", currency: "XOF", probability: 100, assignedToId: commercial.id, expectedCloseDate: D(-60), notes: "Mission réalisée Q1 2026. Bonne relation commerciale." },
    { organizationId: orgId, title: "Fourniture transformateurs 630 kVA — lot 3", clientId: C[12]!.id, stage: "qualified", value: "38000000", currency: "XOF", probability: 45, assignedToId: commercial.id, expectedCloseDate: D(75), notes: "Délai de livraison ABB à confirmer." },
    { organizationId: orgId, title: "Logistique transport matériaux Abidjan–Lomé", clientId: C[13]!.id, stage: "lead", value: "65000000", currency: "XOF", probability: 20, assignedToId: commercial.id, expectedCloseDate: D(150), notes: "Prospect chaud. Premier appel le 12/06." },
    { organizationId: orgId, title: "Audit structure immeuble R+6 — Cotonou", clientId: C[14]!.id, stage: "proposal", value: "22000000", currency: "XOF", probability: 60, assignedToId: directeur.id, expectedCloseDate: D(25), notes: "Devis envoyé le 08/06. Réponse attendue semaine prochaine." },
  ]).returning();

  // Activités CRM
  const activityData: any[] = [];
  const actTypes = ["call", "email", "meeting", "site_visit", "proposal", "demo"];
  const actUsers = [admin, directeur, commercial];
  opps.forEach((opp, i) => {
    for (let j = 0; j < 3; j++) {
      const t = actTypes[(i * 3 + j) % actTypes.length]!;
      const u = actUsers[(i + j) % actUsers.length]!;
      const dayOff = -90 + (i * 6) + (j * 20);
      activityData.push({
        organizationId: orgId, type: t, clientId: opp.clientId, opportunityId: opp.id, userId: u.id,
        subject: t === "call" ? `Appel qualification — ${opp.title.slice(0, 45)}` :
                 t === "email" ? `Relance offre — ${opp.title.slice(0, 45)}` :
                 t === "meeting" ? `Réunion technique — ${opp.title.slice(0, 45)}` :
                 t === "site_visit" ? `Visite chantier — ${opp.title.slice(0, 45)}` :
                 t === "proposal" ? `Remise proposition — ${opp.title.slice(0, 45)}` :
                 `Démo solution — ${opp.title.slice(0, 45)}`,
        description: `Activité commerciale sur l'opportunité "${opp.title}". Client: ${opp.clientId}.`,
        scheduledAt: DT(dayOff, 9 + (j * 2)),
        completedAt: dayOff < 0 ? DT(dayOff, 10 + (j * 2)) : null,
      });
    }
  });
  await db.insert(activitiesTable).values(activityData);
  console.log("  ✓ 15 opportunités + 45 activités CRM");

  // ── 7. Collaborateurs ────────────────────────────────────────────────
  console.log("→ Collaborateurs (15)...");
  const collabRows = await db.insert(collaboratorsTable).values([
    { organizationId: orgId, userId: directeur.id, firstName: "Komi", lastName: "Agbemelo", email: "directeur@gameasu.com", phone: "+228 90 00 00 02", position: "Directeur des Opérations", department: "Direction", hireDate: "2018-03-01", employmentStatus: "active", baseSalary: "1850000", isAvailable: true },
    { organizationId: orgId, userId: commercial.id, firstName: "Aminata", lastName: "Diallo-Touré", email: "commercial@gameasu.com", phone: "+228 90 00 00 03", position: "Directrice Commerciale", department: "Commercial", hireDate: "2019-06-15", employmentStatus: "active", baseSalary: "1250000", isAvailable: true, currentProjectsCount: 2 },
    { organizationId: orgId, userId: finance.id, firstName: "Salif", lastName: "Koné", email: "finance@gameasu.com", phone: "+228 90 00 00 04", position: "Responsable Financier", department: "Finance", hireDate: "2019-02-01", employmentStatus: "active", baseSalary: "980000", isAvailable: true },
    { organizationId: orgId, userId: rh.id, firstName: "Mariam", lastName: "Ouédraogo-Sawadogo", email: "rh@gameasu.com", phone: "+228 90 00 00 05", position: "DRH", department: "Ressources humaines", hireDate: "2020-04-01", employmentStatus: "active", baseSalary: "890000", isAvailable: true },
    { organizationId: orgId, userId: operations.id, firstName: "Moussa", lastName: "Konaté", email: "operations@gameasu.com", phone: "+228 90 00 00 06", position: "Responsable Opérations", department: "Opérations", hireDate: "2017-09-01", employmentStatus: "active", baseSalary: "820000", isAvailable: false, currentProjectsCount: 3 },
    { organizationId: orgId, firstName: "Akossiwa", lastName: "Adzo", email: "a.adzo@gameasu.com", phone: "+228 90 11 22 02", position: "Chef de Projet Senior", department: "Projets", hireDate: "2020-06-01", employmentStatus: "active", baseSalary: "1100000", isAvailable: false, currentProjectsCount: 2 },
    { organizationId: orgId, firstName: "Yawo", lastName: "Klutsè", email: "y.klutse@gameasu.com", phone: "+228 90 11 22 03", position: "Ingénieur Génie Civil", department: "Projets", hireDate: "2021-02-10", employmentStatus: "active", baseSalary: "850000", isAvailable: true },
    { organizationId: orgId, firstName: "Edem", lastName: "Tchalla", email: "e.tchalla@gameasu.com", phone: "+228 90 11 22 04", position: "Conducteur de Travaux", department: "Travaux", hireDate: "2018-09-20", employmentStatus: "active", baseSalary: "720000", isAvailable: false, currentProjectsCount: 3 },
    { organizationId: orgId, firstName: "Sika", lastName: "Avoulété", email: "s.avoulete@gameasu.com", phone: "+228 90 11 22 07", position: "Architecte DPLG", department: "Études", hireDate: "2020-01-15", employmentStatus: "active", baseSalary: "1050000", isAvailable: true },
    { organizationId: orgId, firstName: "Komlan", lastName: "Bokovi", email: "k.bokovi@gameasu.com", phone: "+228 90 11 22 08", position: "Chef d'Équipe Maçonnerie", department: "Travaux", hireDate: "2016-08-22", employmentStatus: "active", baseSalary: "520000", isAvailable: false, currentProjectsCount: 1 },
    { organizationId: orgId, firstName: "Eyram", lastName: "Apélété", email: "e.apelete@gameasu.com", phone: "+228 90 11 22 10", position: "Responsable HSE", department: "Sécurité", hireDate: "2021-07-19", employmentStatus: "active", baseSalary: "780000", isAvailable: true },
    { organizationId: orgId, firstName: "Akouvi", lastName: "Tévi", email: "a.tevi@gameasu.com", phone: "+228 90 11 22 14", position: "Géomètre-Topographe", department: "Études", hireDate: "2020-10-08", employmentStatus: "active", baseSalary: "750000", isAvailable: true },
    { organizationId: orgId, firstName: "Kossi", lastName: "Adjété", email: "kossi.adjete@gameasu.com", phone: "+228 90 11 22 12", position: "Magasinier-Chef", department: "Logistique", hireDate: "2019-05-30", employmentStatus: "active", baseSalary: "450000", isAvailable: true },
    { organizationId: orgId, firstName: "Délali", lastName: "Sossou", email: "d.sossou@gameasu.com", phone: "+228 90 11 22 09", position: "Assistante Administrative", department: "Administration", hireDate: "2022-03-01", employmentStatus: "active", baseSalary: "380000", isAvailable: true },
    { organizationId: orgId, firstName: "Senyo", lastName: "Doe", email: "s.doe@gameasu.com", phone: "+228 90 11 22 15", position: "Stagiaire BTS Génie Civil", department: "Études", hireDate: "2026-03-01", employmentStatus: "active", baseSalary: "120000", isAvailable: true },
  ]).returning();

  const [cDir, cCom, cFin, cRH, cOps, cChefProj, cIngGC, cConducteur, cArchi, cChefMac, cHSE, cGeo, cMag, cAdmin, cStagiaire] = collabRows;
  console.log(`  ✓ ${collabRows.length} collaborateurs`);

  // ── 8. RH — Départements, postes, contrats ───────────────────────────
  console.log("→ RH — Départements & postes...");
  const depts = await db.insert(departmentsTable).values([
    { organizationId: orgId, code: "DIR", name: "Direction Générale", description: "Direction stratégique", color: "#6366F1" },
    { organizationId: orgId, code: "COM", name: "Commercial", description: "Ventes & développement client", color: "#F59E0B" },
    { organizationId: orgId, code: "FIN", name: "Finance & Comptabilité", description: "Gestion financière", color: "#10B981" },
    { organizationId: orgId, code: "RH", name: "Ressources Humaines", description: "GRH & paie", color: "#EC4899" },
    { organizationId: orgId, code: "OPS", name: "Opérations", description: "Conduite de travaux", color: "#EF4444" },
    { organizationId: orgId, code: "PROJ", name: "Projets & Études", description: "Ingénierie & gestion de projet", color: "#3B82F6" },
    { organizationId: orgId, code: "LOG", name: "Logistique", description: "Stock & transport", color: "#8B5CF6" },
    { organizationId: orgId, code: "ADM", name: "Administration", description: "Services généraux", color: "#6B7280" },
    { organizationId: orgId, code: "HSE", name: "Sécurité & HSE", description: "Hygiène, sécurité, environnement", color: "#F97316" },
  ]).returning();

  const positions = await db.insert(positionsTable).values([
    { organizationId: orgId, code: "DG", title: "Directeur Général", departmentId: depts[0]!.id, level: 5 },
    { organizationId: orgId, code: "DO", title: "Directeur des Opérations", departmentId: depts[0]!.id, level: 4 },
    { organizationId: orgId, code: "COM-DIR", title: "Directeur Commercial", departmentId: depts[1]!.id, level: 4 },
    { organizationId: orgId, code: "FIN-RESP", title: "Responsable Financier", departmentId: depts[2]!.id, level: 3 },
    { organizationId: orgId, code: "DRH", title: "Directeur des Ressources Humaines", departmentId: depts[3]!.id, level: 4 },
    { organizationId: orgId, code: "RESP-OPS", title: "Responsable Opérations", departmentId: depts[4]!.id, level: 3 },
    { organizationId: orgId, code: "CHEF-PROJ", title: "Chef de Projet Senior", departmentId: depts[5]!.id, level: 3 },
    { organizationId: orgId, code: "ING-GC", title: "Ingénieur Génie Civil", departmentId: depts[5]!.id, level: 2 },
    { organizationId: orgId, code: "COND-TRAV", title: "Conducteur de Travaux", departmentId: depts[4]!.id, level: 2 },
    { organizationId: orgId, code: "ARCHI", title: "Architecte DPLG", departmentId: depts[5]!.id, level: 3 },
    { organizationId: orgId, code: "RESP-HSE", title: "Responsable HSE", departmentId: depts[8]!.id, level: 3 },
    { organizationId: orgId, code: "MAG-CHEF", title: "Magasinier-Chef", departmentId: depts[6]!.id, level: 2 },
    { organizationId: orgId, code: "ASSIST-ADM", title: "Assistante Administrative", departmentId: depts[7]!.id, level: 1 },
  ]).returning();

  // Contrats
  const contractData = [
    { collab: cDir!, salary: "1850000", type: "CDI", start: "2018-03-01", jobTitle: "Directeur des Opérations" },
    { collab: cCom!, salary: "1250000", type: "CDI", start: "2019-06-15", jobTitle: "Directrice Commerciale" },
    { collab: cFin!, salary: "980000",  type: "CDI", start: "2019-02-01", jobTitle: "Responsable Financier" },
    { collab: cRH!,  salary: "890000",  type: "CDI", start: "2020-04-01", jobTitle: "DRH" },
    { collab: cOps!, salary: "820000",  type: "CDI", start: "2017-09-01", jobTitle: "Responsable Opérations" },
    { collab: cChefProj!, salary: "1100000", type: "CDI", start: "2020-06-01", jobTitle: "Chef de Projet Senior" },
    { collab: cIngGC!, salary: "850000", type: "CDI", start: "2021-02-10", jobTitle: "Ingénieur Génie Civil" },
    { collab: cConducteur!, salary: "720000", type: "CDI", start: "2018-09-20", jobTitle: "Conducteur de Travaux" },
    { collab: cArchi!, salary: "1050000", type: "CDI", start: "2020-01-15", jobTitle: "Architecte DPLG" },
    { collab: cChefMac!, salary: "520000", type: "CDI", start: "2016-08-22", jobTitle: "Chef d'Équipe Maçonnerie" },
    { collab: cHSE!, salary: "780000", type: "CDI", start: "2021-07-19", jobTitle: "Responsable HSE" },
    { collab: cGeo!, salary: "750000", type: "CDI", start: "2020-10-08", jobTitle: "Géomètre-Topographe" },
    { collab: cMag!, salary: "450000", type: "CDI", start: "2019-05-30", jobTitle: "Magasinier-Chef" },
    { collab: cAdmin!, salary: "380000", type: "CDD", start: "2022-03-01", end: "2026-12-31", jobTitle: "Assistante Administrative" },
    { collab: cStagiaire!, salary: "120000", type: "stage", start: "2026-03-01", end: "2026-08-31", jobTitle: "Stagiaire BTS Génie Civil" },
  ];
  for (const c of contractData) {
    if (!c.collab) continue;
    await db.insert(contractsTable).values({
      organizationId: orgId, collaboratorId: c.collab.id, type: c.type, status: "active",
      startDate: c.start, endDate: (c as any).end ?? null,
      monthlySalary: c.salary, currency: "XOF", jobTitle: c.jobTitle,
      workLocation: "Lomé, Togo", weeklyHours: "40",
    });
  }
  console.log("  ✓ 9 départements + 13 postes + 15 contrats");

  // ── 9. Projets & phases & tâches ────────────────────────────────────
  console.log("→ Projets (8) + phases + tâches...");
  const projects = await db.insert(projectsTable).values([
    { organizationId: orgId, name: "Extension réseau HTA — CEET Kpalimé", description: "Pose de 4 postes HTA 20 kV et raccordement BT sur 6 km. Coordination CEET et accès foncier.", status: "active", clientId: C[0]!.id, managerId: directeur.id, leadCollaboratorId: cChefProj!.id, startDate: D(-45), endDate: D(150), progress: 22, budget: "210000000" },
    { organizationId: orgId, name: "Siège Lomé Construction — Extension R+3", description: "Construction d'une extension R+3 sur 1 200 m² au siège social. Béton armé, façade aluminium, climatisation centralisée.", status: "active", clientId: C[3]!.id, managerId: directeur.id, leadCollaboratorId: cConducteur!.id, startDate: D(-20), endDate: D(200), progress: 12, budget: "185000000" },
    { organizationId: orgId, name: "Réhabilitation bloc opératoire CHU SO", description: "Réhabilitation complète bloc opératoire. Normes BAD/OMS. Salles stériles, fluides médicaux, stérilisation centrale.", status: "active", clientId: C[7]!.id, managerId: admin.id, leadCollaboratorId: cArchi!.id, startDate: D(-60), endDate: D(240), progress: 28, budget: "280000000" },
    { organizationId: orgId, name: "Voirie zone industrielle Adakpamé — Ph.1", description: "Réfection 3 km de voirie, pose bordures, signalisation horizontale et verticale, éclairage solaire LED.", status: "active", clientId: C[8]!.id, managerId: directeur.id, leadCollaboratorId: cConducteur!.id, startDate: D(-90), endDate: D(45), progress: 78, budget: "98000000" },
    { organizationId: orgId, name: "Rénovation agences BTCI — Lot Lomé Sud", description: "Rénovation intérieure 6 agences (Bè, Tokoin, Hédzranawoé, Adidogomé, Agoé, Baguida). Mobilier, électricité, clim.", status: "active", clientId: C[4]!.id, managerId: directeur.id, leadCollaboratorId: cArchi!.id, startDate: D(-30), endDate: D(90), progress: 18, budget: "62000000" },
    { organizationId: orgId, name: "Sécurisation périmétrique ECOBANK (8 agences)", description: "Clôtures anti-intrusion, contrôle d'accès biométrique, vidéosurveillance IP sur 8 agences Togo.", status: "planning", clientId: C[10]!.id, managerId: directeur.id, leadCollaboratorId: cHSE!.id, startDate: D(10), endDate: D(100), progress: 0, budget: "42000000" },
    { organizationId: orgId, name: "Audit structure immeuble SGI Bénin", description: "Diagnostic structurel R+6, sondages béton, modélisation SAP2000, rapport de préconisations.", status: "active", clientId: C[14]!.id, managerId: directeur.id, leadCollaboratorId: cGeo!.id, startDate: D(-10), endDate: D(40), progress: 45, budget: "22000000" },
    { organizationId: orgId, name: "Maintenance lourde four cimentier WACEM #2", description: "Arrêt annuel planifié. Réfection garnissage réfractaire, remplacement couronne, graissage central.", status: "planning", clientId: C[2]!.id, managerId: directeur.id, leadCollaboratorId: cChefMac!.id, startDate: D(60), endDate: D(90), progress: 0, budget: "95000000" },
  ]).returning();

  const phaseData: any[] = [];
  const phaseTemplates = [
    ["Études & conception","Mobilisation & installation chantier","Gros œuvre","Second œuvre & équipements","Réception & levée des réserves"],
    ["Études architecturales","Préparation chantier","Structure béton armé","Façades & menuiseries","Lots techniques","Finitions & livraison"],
    ["Diagnostic & conception","Démolitions sélectives","Génie civil","Équipements médicaux spéciaux","Contrôle qualité & réception"],
    ["Repérage & implantation","Terrassement & assainissement","Pose voirie","Équipements de voirie","Réception"],
    ["État des lieux & conception","Approvisionnement","Démolitions","Corps d'état techniques","Finitions & livraison"],
  ];
  projects.forEach((p, i) => {
    const tpl = phaseTemplates[i % phaseTemplates.length]!;
    tpl.forEach((name, idx) => {
      const pStart = idx * 30 - 45;
      const pEnd = pStart + 28;
      const pStatus = pEnd < 0 ? "completed" : (pStart < 0 ? "active" : "pending");
      phaseData.push({ organizationId: orgId, projectId: p.id, name, status: pStatus, startDate: D(pStart), endDate: D(pEnd), order: idx + 1 });
    });
  });
  await db.insert(projectPhasesTable).values(phaseData);

  const taskData: any[] = [];
  const allCollabs = [cDir, cCom, cFin, cRH, cOps, cChefProj, cIngGC, cConducteur, cArchi, cHSE, cGeo];
  const tasksByProject = [
    [
      { title: "Levé topographique ligne HTA", status: "done", priority: "high", due: -35, assign: cGeo! },
      { title: "Obtention permis de voirie CEET", status: "done", priority: "urgent", due: -25, assign: cChefProj! },
      { title: "Implantation postes HTA — site A & B", status: "in_progress", priority: "high", due: 10, assign: cIngGC! },
      { title: "Fourniture câbles 15 kV — bon de commande ABB", status: "in_progress", priority: "urgent", due: 5, assign: cDir! },
      { title: "Coordination équipe terrain semaine 24", status: "todo", priority: "medium", due: 15, assign: cConducteur! },
      { title: "Rapport d'avancement mensuel — juin 2026", status: "todo", priority: "medium", due: 20, assign: cChefProj! },
    ],
    [
      { title: "Plans d'exécution béton armé", status: "done", priority: "high", due: -15, assign: cArchi! },
      { title: "Coulage dalle R+1 (Z. A)", status: "in_progress", priority: "urgent", due: 5, assign: cConducteur! },
      { title: "Commande menuiseries aluminium", status: "in_progress", priority: "high", due: 10, assign: cChefProj! },
      { title: "Pose armatures R+2", status: "todo", priority: "high", due: 30, assign: cConducteur! },
      { title: "Contrôle résistance béton — laboratoire", status: "todo", priority: "medium", due: 15, assign: cIngGC! },
    ],
    [
      { title: "Revue cahier des charges BAD — validation", status: "done", priority: "urgent", due: -55, assign: cArchi! },
      { title: "Démolition équipements existants", status: "done", priority: "high", due: -40, assign: cConducteur! },
      { title: "Génie civil — dalles flottantes bloc A", status: "in_progress", priority: "urgent", due: -5, assign: cConducteur! },
      { title: "Cahier des charges équipements médicaux", status: "in_progress", priority: "high", due: 20, assign: cHSE! },
      { title: "Certification BV fluides médicaux", status: "todo", priority: "urgent", due: 60, assign: cChefProj! },
    ],
    [
      { title: "Implantation & repérage axes voirie", status: "done", priority: "high", due: -85, assign: cGeo! },
      { title: "Terrassement et nivelage (km 0–1)", status: "done", priority: "urgent", due: -60, assign: cConducteur! },
      { title: "Pose bordures granite et caniveaux", status: "done", priority: "medium", due: -30, assign: cChefMac! },
      { title: "Enrobé bitumineux couche de base (km 0–2)", status: "in_progress", priority: "urgent", due: 5, assign: cConducteur! },
      { title: "Installation éclairage solaire LED", status: "todo", priority: "medium", due: 25, assign: cIngGC! },
      { title: "Réception provisoire avec mairie", status: "todo", priority: "high", due: 40, assign: cChefProj! },
    ],
  ];
  tasksByProject.forEach((tasks, pi) => {
    if (!projects[pi]) return;
    tasks.forEach((t) => {
      taskData.push({
        organizationId: orgId, projectId: projects[pi]!.id, title: t.title,
        status: t.status, priority: t.priority, assigneeId: t.assign.userId ?? admin.id,
        dueDate: D(t.due),
      });
    });
  });
  // Standalone tasks
  taskData.push(
    { organizationId: orgId, title: "Renouveler assurances flotte véhicules (juillet 2026)", status: "todo", priority: "urgent", assigneeId: admin.id, dueDate: D(16) },
    { organizationId: orgId, title: "Préparer présentation bilan S1 2026 — Conseil", status: "in_progress", priority: "high", assigneeId: directeur.id, dueDate: D(20) },
    { organizationId: orgId, title: "Lancer recrutement conducteur de travaux senior", status: "todo", priority: "medium", assigneeId: rh.id, dueDate: D(30) },
    { organizationId: orgId, title: "Audit interne qualité ISO 9001 — Q3", status: "todo", priority: "medium", assigneeId: cHSE!.id ? directeur.id : admin.id, dueDate: D(50) },
    { organizationId: orgId, title: "Mettre à jour plan formation 2026–2027", status: "todo", priority: "low", assigneeId: rh.id, dueDate: D(35) },
  );
  const taskRows = await db.insert(tasksTable).values(taskData).returning();
  console.log(`  ✓ ${projects.length} projets + ${phaseData.length} phases + ${taskRows.length} tâches`);

  // ── 10. Équipements ───────────────────────────────────────────────────
  console.log("→ Équipements (catégories + matériel)...");
  const cats = await db.insert(equipmentCategoriesTable).values([
    { organizationId: orgId, name: "Grues & Levage", description: "Grues mobiles, grues à tour, palans électriques" },
    { organizationId: orgId, name: "Générateurs & Énergie", description: "Groupes électrogènes industriels, UPS, batteries" },
    { organizationId: orgId, name: "Véhicules & Engins", description: "Camions, semi-remorques, porte-engins, mini-pelles" },
    { organizationId: orgId, name: "Outillage Électrique HTA", description: "Transformateurs, armoires HTA/BT, câbles industriels" },
    { organizationId: orgId, name: "Matériel Topographique", description: "Stations totales, GPS, niveaux optiques" },
    { organizationId: orgId, name: "Matériel de Sécurité", description: "EPI collectifs, signalisation, barrières chantier" },
  ]).returning();

  const equipRows = await db.insert(equipmentTable).values([
    { organizationId: orgId, name: "Grue Mobile Liebherr LTM 1060-3.1", code: "GRU-001", categoryId: cats[0]!.id, description: "Grue mobile 60T, flèche principale 51 m, biflèche optionnelle. Certificat CACES R487 à jour.", status: "available", quantity: 1, availableQuantity: 1, dailyRate: "750000", location: "Dépôt Principal — Lomé" },
    { organizationId: orgId, name: "Grue à Flèche Grove GMK 3060L", code: "GRU-002", categoryId: cats[0]!.id, description: "Grue tout-terrain 60T, configuration routière. Idéale chantiers BTP.", status: "rented", quantity: 1, availableQuantity: 0, dailyRate: "850000", location: "Site CHU Sylvanus Olympio" },
    { organizationId: orgId, name: "Grue Potain MDT 178", code: "GRU-003", categoryId: cats[0]!.id, description: "Grue à tour 8T, flèche 55 m. Montage/démontage inclus sur site.", status: "available", quantity: 1, availableQuantity: 1, dailyRate: "320000", location: "Entrepôt Adidogomé" },
    { organizationId: orgId, name: "Générateur Caterpillar C18 ACERT 750 kVA", code: "GEN-001", categoryId: cats[1]!.id, description: "Groupe électrogène industriel 750 kVA, cabine insonorisée 65 dB.", status: "available", quantity: 2, availableQuantity: 2, dailyRate: "350000", location: "Dépôt Principal — Lomé" },
    { organizationId: orgId, name: "Groupe Électrogène Perkins 500 kVA", code: "GEN-002", categoryId: cats[1]!.id, description: "Générateur portable 500 kVA, démarrage automatique ATS.", status: "maintenance", quantity: 1, availableQuantity: 0, dailyRate: "280000", location: "Atelier Maintenance" },
    { organizationId: orgId, name: "Groupe Électrogène FG Wilson 250 kVA", code: "GEN-003", categoryId: cats[1]!.id, description: "Groupe 250 kVA silencieux. Idéal zones résidentielles.", status: "rented", quantity: 1, availableQuantity: 0, dailyRate: "160000", location: "Site BTCI Hédzranawoé" },
    { organizationId: orgId, name: "Camion Porte-Engin MAN TGX 26.480 6x4", code: "VEH-001", categoryId: cats[2]!.id, description: "Porte-engin 40T, plateau hydraulique basculant, rallonges extensibles.", status: "available", quantity: 1, availableQuantity: 1, dailyRate: "450000", location: "Dépôt Principal — Lomé" },
    { organizationId: orgId, name: "Semi-remorque Plateau Lowboy 60T", code: "VEH-002", categoryId: cats[2]!.id, description: "Lowboy 60T pour transport grues et engins lourds. Col de cygne amovible.", status: "available", quantity: 2, availableQuantity: 2, dailyRate: "200000", location: "Dépôt Principal — Lomé" },
    { organizationId: orgId, name: "Mini-pelle Kubota KX057-5", code: "VEH-003", categoryId: cats[2]!.id, description: "Mini-pelle 5,7T. Idéale tranchées et zones restreintes.", status: "rented", quantity: 3, availableQuantity: 1, dailyRate: "120000", location: "Site Voirie Adakpamé" },
    { organizationId: orgId, name: "Transformateur ABB 630 kVA 15kV/400V", code: "TRF-001", categoryId: cats[3]!.id, description: "Transformateur HTA/BT immergé huile. Réseau 15 kV CEET.", status: "available", quantity: 4, availableQuantity: 3, dailyRate: "180000", location: "Stock Électrique Lomé" },
    { organizationId: orgId, name: "Station Totale Leica TS16 5\"", code: "TOP-001", categoryId: cats[4]!.id, description: "Station totale robotisée 5\", portée 1 000 m sans prisme.", status: "available", quantity: 2, availableQuantity: 2, dailyRate: "85000", location: "Bureau Études" },
    { organizationId: orgId, name: "GPS Topcon HiPer HR RTK", code: "TOP-002", categoryId: cats[4]!.id, description: "GPS RTK bi-fréquence, précision planimétrique 3 mm + 0,5 ppm.", status: "rented", quantity: 1, availableQuantity: 0, dailyRate: "65000", location: "Site CEET Kpalimé" },
  ]).returning();

  console.log(`  ✓ ${cats.length} catégories + ${equipRows.length} équipements`);

  // ── 11. Locations ─────────────────────────────────────────────────────
  console.log("→ Locations (3 actives)...");
  const rental1 = await db.insert(rentalsTable).values({
    organizationId: orgId, referenceNumber: "RNT-2026-0001", clientId: C[7]!.id,
    status: "active", startDate: D(-45), endDate: D(150),
    totalCost: "38250000",
    notes: "Location grue Grove GMK pour chantier bloc opératoire CHU. Grutier fourni.",
  }).returning();

  const rental2 = await db.insert(rentalsTable).values({
    organizationId: orgId, referenceNumber: "RNT-2026-0002", clientId: C[4]!.id,
    status: "active", startDate: D(-25), endDate: D(65),
    totalCost: "14400000",
    notes: "Location groupe FG Wilson 250 kVA pour agence BTCI Hédzranawoé en travaux.",
  }).returning();

  const rental3 = await db.insert(rentalsTable).values({
    organizationId: orgId, referenceNumber: "RNT-2026-0003", clientId: C[3]!.id,
    status: "active", startDate: D(-10), endDate: D(80),
    totalCost: "10800000",
    notes: "Location 2 mini-pelles pour terrassement fondations extension siège.",
  }).returning();

  if (rental1[0] && equipRows[1]) {
    await db.insert(rentalItemsTable).values({ organizationId: orgId, rentalId: rental1[0].id, equipmentId: equipRows[1].id, quantity: 1, dailyRate: "850000", subtotal: "38250000" });
    await db.insert(inspectionsTable).values({ organizationId: orgId, rentalId: rental1[0].id, type: "pre_rental", notes: "État général : excellent. Tous systèmes opérationnels. Carburant plein. Carnet entretien à jour. Flèche inspectée par APAVE.", hasDispute: "false", photos: ["https://placehold.co/800x600?text=Grue+Etat+Avant"] });
    await db.insert(logisticsOperationsTable).values({ organizationId: orgId, type: "delivery", status: "completed", rentalId: rental1[0].id, address: "CHU Sylvanus Olympio, Boulevard Eyadéma, Lomé", scheduledAt: DT(-45, 7), completedAt: DT(-45, 12), notes: "Livraison effectuée sans incident. Grue en position de levage bloc C.", responsibleId: operations.id });
  }
  if (rental2[0] && equipRows[5]) {
    await db.insert(rentalItemsTable).values({ organizationId: orgId, rentalId: rental2[0].id, equipmentId: equipRows[5].id, quantity: 1, dailyRate: "160000", subtotal: "14400000" });
    await db.insert(inspectionsTable).values({ organizationId: orgId, rentalId: rental2[0].id, type: "pre_rental", notes: "Groupe en bon état. Niveau huile et carburant vérifiés. ATS testé et validé.", hasDispute: "false" });
  }
  if (rental3[0] && equipRows[8]) {
    await db.insert(rentalItemsTable).values({ organizationId: orgId, rentalId: rental3[0].id, equipmentId: equipRows[8].id, quantity: 2, dailyRate: "120000", subtotal: "10800000" });
    await db.insert(logisticsOperationsTable).values({ organizationId: orgId, type: "delivery", status: "completed", rentalId: rental3[0].id, address: "Boulevard du Mono, Bè, Lomé — Chantier Siège Lomé Construction", scheduledAt: DT(-10, 8), completedAt: DT(-10, 11), notes: "2 mini-pelles livrées. Accès chantier OK.", responsibleId: operations.id });
  }
  console.log("  ✓ 3 locations actives");

  // ── 12. Commandes, proformas, factures, paiements ────────────────────
  console.log("→ Ventes — Commandes, factures, encaissements...");

  // Commande 1 — CEET (won)
  const [ord1] = await db.insert(ordersTable).values({ organizationId: orgId, referenceNumber: "ORD-2026-0001", clientId: C[0]!.id, status: "confirmed", totalAmount: "210000000", currency: "XOF", notes: "Extension réseau HTA — 4 postes Kpalimé. Notification marché CEET du 20/05/2026." }).returning();
  const [pro1] = await db.insert(proformasTable).values({ organizationId: orgId, referenceNumber: "PRO-2026-0001", orderId: ord1!.id, clientId: C[0]!.id, status: "accepted", totalAmount: "210000000", currency: "XOF", validUntil: D(30), notes: "Proforma acceptée par CEET — bon de commande joint." }).returning();
  const [inv1] = await db.insert(invoicesTable).values({ organizationId: orgId, referenceNumber: "INV-2026-0001", proformaId: pro1!.id, clientId: C[0]!.id, status: "partially_paid", totalAmount: "210000000", paidAmount: "63000000", currency: "XOF", dueDate: D(-10), issuedAt: D(-30), notes: "Facture acompte 30% — démarrage travaux." }).returning();
  await db.insert(paymentsTable).values({ organizationId: orgId, invoiceId: inv1!.id, amount: "63000000", currency: "XOF", method: "bank_transfer", reference: "VIR-CEET-BTD-2026-0601", paidAt: DT(-28), notes: "Virement reçu. Réf Banque Togolaise de Développement." });

  // Commande 2 — Lomé Construction (won)
  const [ord2] = await db.insert(ordersTable).values({ organizationId: orgId, referenceNumber: "ORD-2026-0002", clientId: C[3]!.id, status: "confirmed", totalAmount: "185000000", currency: "XOF", notes: "Siège Lomé Construction — Extension R+3." }).returning();
  const [pro2] = await db.insert(proformasTable).values({ organizationId: orgId, referenceNumber: "PRO-2026-0002", orderId: ord2!.id, clientId: C[3]!.id, status: "accepted", totalAmount: "185000000", currency: "XOF", validUntil: D(15), notes: "Proforma signée le 02/06/2026." }).returning();
  const [inv2] = await db.insert(invoicesTable).values({ organizationId: orgId, referenceNumber: "INV-2026-0002", proformaId: pro2!.id, clientId: C[3]!.id, status: "partially_paid", totalAmount: "185000000", paidAmount: "92500000", currency: "XOF", dueDate: D(5), issuedAt: D(-18), notes: "Acompte 50% à la mobilisation." }).returning();
  await db.insert(paymentsTable).values({ organizationId: orgId, invoiceId: inv2!.id, amount: "92500000", currency: "XOF", method: "bank_transfer", reference: "VIR-LCSA-SGBT-2026-0605", paidAt: DT(-15), notes: "Virement SGBT — compte Lomé Construction SA." });

  // Commande 3 — CHU SO (won) — facture payée
  const [ord3] = await db.insert(ordersTable).values({ organizationId: orgId, referenceNumber: "ORD-2026-0003", clientId: C[7]!.id, status: "confirmed", totalAmount: "280000000", currency: "XOF", notes: "Bloc opératoire CHU SO — financement BAD." }).returning();
  const [pro3] = await db.insert(proformasTable).values({ organizationId: orgId, referenceNumber: "PRO-2026-0003", orderId: ord3!.id, clientId: C[7]!.id, status: "accepted", totalAmount: "280000000", currency: "XOF", validUntil: D(-20), notes: "Marché BAD approuvé. Contrat signé 15/04/2026." }).returning();
  const [inv3] = await db.insert(invoicesTable).values({ organizationId: orgId, referenceNumber: "INV-2026-0003", proformaId: pro3!.id, clientId: C[7]!.id, status: "partially_paid", totalAmount: "280000000", paidAmount: "112000000", currency: "XOF", dueDate: D(-15), issuedAt: D(-45), notes: "Tranche BAD 1 — 40%." }).returning();
  await db.insert(paymentsTable).values({ organizationId: orgId, invoiceId: inv3!.id, amount: "112000000", currency: "XOF", method: "bank_transfer", reference: "VIR-BAD-TG-2026-0522", paidAt: DT(-40), notes: "Virement BAD — décaissement tranche 1." });

  // Commande 4 — Voirie Mairie (facture impayée/retard)
  const [ord4] = await db.insert(ordersTable).values({ organizationId: orgId, referenceNumber: "ORD-2026-0004", clientId: C[8]!.id, status: "confirmed", totalAmount: "98000000", currency: "XOF", notes: "Voirie zone industrielle Adakpamé phase 1." }).returning();
  const [pro4] = await db.insert(proformasTable).values({ organizationId: orgId, referenceNumber: "PRO-2026-0004", orderId: ord4!.id, clientId: C[8]!.id, status: "accepted", totalAmount: "98000000", currency: "XOF", validUntil: D(-30), notes: "Approuvé par délibération du conseil municipal." }).returning();
  const [inv4] = await db.insert(invoicesTable).values({ organizationId: orgId, referenceNumber: "INV-2026-0004", proformaId: pro4!.id, clientId: C[8]!.id, status: "overdue", totalAmount: "98000000", paidAmount: "0", currency: "XOF", dueDate: D(-20), issuedAt: D(-65), notes: "Facture de situation #1 — 0% encaissé. Délai dépassé.", dunningStatus: "sent" }).returning();

  // Commande 5 — BTCI Rénovation
  const [ord5] = await db.insert(ordersTable).values({ organizationId: orgId, referenceNumber: "ORD-2026-0005", clientId: C[4]!.id, status: "confirmed", totalAmount: "62000000", currency: "XOF", notes: "Rénovation 6 agences BTCI Lot Lomé Sud." }).returning();
  const [pro5] = await db.insert(proformasTable).values({ organizationId: orgId, referenceNumber: "PRO-2026-0005", orderId: ord5!.id, clientId: C[4]!.id, status: "draft", totalAmount: "62000000", currency: "XOF", validUntil: D(20), notes: "En attente validation direction BTCI." }).returning();

  // Commande 6 — Bolloré entrepôt frigorifique (proforma en cours)
  const [ord6] = await db.insert(ordersTable).values({ organizationId: orgId, referenceNumber: "ORD-2026-0006", clientId: C[9]!.id, status: "pending", totalAmount: "385000000", currency: "XOF", notes: "Entrepôt frigorifique 8 000 m² — conception-réalisation." }).returning();
  await db.insert(proformasTable).values({ organizationId: orgId, referenceNumber: "PRO-2026-0006", orderId: ord6!.id, clientId: C[9]!.id, status: "sent", totalAmount: "385000000", currency: "XOF", validUntil: D(40), notes: "Avant-projet sommaire remis. Proforma en attente de signature." });

  console.log("  ✓ 6 commandes + proformas + factures + paiements");

  // ── 13. Comptabilité ──────────────────────────────────────────────────
  console.log("→ Comptabilité SYSCOHADA...");

  // Plan comptable SYSCOHADA (classes 1–7) — doit être créé AVANT les comptes bancaires
  const accounts = await db.insert(chartOfAccountsTable).values([
    // Classe 1 — Capitaux
    { organizationId: orgId, classNum: 1, code: "10",   label: "Capital et réserves",              type: "equity",    normalBalance: "credit", isPostable: false },
    { organizationId: orgId, classNum: 1, code: "1010", label: "Capital social",                   type: "equity",    normalBalance: "credit", isPostable: true },
    { organizationId: orgId, classNum: 1, code: "12",   label: "Résultat net de l'exercice",       type: "equity",    normalBalance: "credit", isPostable: true },
    // Classe 2 — Immobilisations
    { organizationId: orgId, classNum: 2, code: "22",   label: "Immobilisations corporelles",      type: "asset",     normalBalance: "debit",  isPostable: false },
    { organizationId: orgId, classNum: 2, code: "2240", label: "Matériel et outillage industriel", type: "asset",     normalBalance: "debit",  isPostable: true },
    { organizationId: orgId, classNum: 2, code: "2350", label: "Matériel de transport",            type: "asset",     normalBalance: "debit",  isPostable: true },
    // Classe 4 — Tiers
    { organizationId: orgId, classNum: 4, code: "40",   label: "Fournisseurs et comptes rattachés",type: "liability", normalBalance: "credit", isPostable: false },
    { organizationId: orgId, classNum: 4, code: "4010", label: "Fournisseurs — dettes",            type: "liability", normalBalance: "credit", isPostable: true },
    { organizationId: orgId, classNum: 4, code: "41",   label: "Clients et comptes rattachés",     type: "asset",     normalBalance: "debit",  isPostable: false },
    { organizationId: orgId, classNum: 4, code: "4110", label: "Clients — créances",               type: "asset",     normalBalance: "debit",  isPostable: true },
    { organizationId: orgId, classNum: 4, code: "4430", label: "TVA facturée",                     type: "liability", normalBalance: "credit", isPostable: true },
    { organizationId: orgId, classNum: 4, code: "4450", label: "TVA récupérable",                  type: "asset",     normalBalance: "debit",  isPostable: true },
    { organizationId: orgId, classNum: 4, code: "46",   label: "Débiteurs et créditeurs divers",   type: "asset",     normalBalance: "debit",  isPostable: true },
    // Classe 5 — Trésorerie
    { organizationId: orgId, classNum: 5, code: "52",   label: "Banques",                          type: "asset",     normalBalance: "debit",  isPostable: false },
    { organizationId: orgId, classNum: 5, code: "5210", label: "Banque SGBT — opérations",         type: "asset",     normalBalance: "debit",  isPostable: true },
    { organizationId: orgId, classNum: 5, code: "5211", label: "Banque ORABANK — projets",         type: "asset",     normalBalance: "debit",  isPostable: true },
    { organizationId: orgId, classNum: 5, code: "571",  label: "Caisse principale",                type: "asset",     normalBalance: "debit",  isPostable: true },
    // Classe 6 — Charges
    { organizationId: orgId, classNum: 6, code: "60",   label: "Achats et variations de stocks",   type: "expense",   normalBalance: "debit",  isPostable: false },
    { organizationId: orgId, classNum: 6, code: "6010", label: "Achats de matières et fournitures",type: "expense",   normalBalance: "debit",  isPostable: true },
    { organizationId: orgId, classNum: 6, code: "61",   label: "Transports consommés",             type: "expense",   normalBalance: "debit",  isPostable: true },
    { organizationId: orgId, classNum: 6, code: "62",   label: "Services extérieurs",              type: "expense",   normalBalance: "debit",  isPostable: true },
    { organizationId: orgId, classNum: 6, code: "63",   label: "Impôts et taxes",                  type: "expense",   normalBalance: "debit",  isPostable: true },
    { organizationId: orgId, classNum: 6, code: "64",   label: "Charges de personnel",             type: "expense",   normalBalance: "debit",  isPostable: true },
    { organizationId: orgId, classNum: 6, code: "65",   label: "Autres charges opérationnelles",   type: "expense",   normalBalance: "debit",  isPostable: true },
    // Classe 7 — Produits
    { organizationId: orgId, classNum: 7, code: "70",   label: "Ventes et produits d'exploitation",type: "income",    normalBalance: "credit", isPostable: false },
    { organizationId: orgId, classNum: 7, code: "7010", label: "Ventes de travaux — BTP",          type: "income",    normalBalance: "credit", isPostable: true },
    { organizationId: orgId, classNum: 7, code: "7060", label: "Locations d'équipements",          type: "income",    normalBalance: "credit", isPostable: true },
    { organizationId: orgId, classNum: 7, code: "7070", label: "Prestations de services",          type: "income",    normalBalance: "credit", isPostable: true },
  ]).returning();

  const acctByCode = new Map(accounts.map(a => [a.code, a]));

  // Comptes bancaires — après le plan comptable pour pouvoir référencer accountId
  const bankAccts = await db.insert(bankAccountsTable).values([
    { organizationId: orgId, name: "Compte courant SGBT — opérations", type: "bank", bankName: "Société Générale Banque Togo", accountNumber: "TG53-0202-0101-2345-6789-012", currency: "XOF", openingBalance: "85000000", isActive: true, accountId: acctByCode.get("5210")!.id },
    { organizationId: orgId, name: "Compte courant ORABANK — projets", type: "bank", bankName: "ORABANK Togo", accountNumber: "TG53-0301-0201-9876-5432-101", currency: "XOF", openingBalance: "42500000", isActive: true, accountId: acctByCode.get("5211")!.id },
    { organizationId: orgId, name: "Caisse principale — Lomé", type: "cash", currency: "XOF", openingBalance: "3500000", isActive: true, accountId: acctByCode.get("571")!.id },
  ]).returning();
  const [bkSGBT, bkORA, bkCaisse] = bankAccts;

  // Période fiscale 2026
  const [fp2026] = await db.insert(fiscalPeriodsTable).values({ organizationId: orgId, name: "Exercice 2026", startDate: "2026-01-01", endDate: "2026-12-31", status: "open" }).returning();

  // Journal principal
  const [jnl] = await db.insert(journalsTable).values({ organizationId: orgId, code: "VT", label: "Journal des ventes", type: "sales", isActive: true, defaultAccountId: acctByCode.get("4110")?.id }).returning();

  // Écritures comptables (ventes encaissées)
  const jecEntries = [
    { ref: "JNL-2026-0001", desc: "Facture INV-2026-0001 — CEET Extension HTA", amount: 63000000, date: D(-28), debitCode: "5210", creditCode: "4110" },
    { ref: "JNL-2026-0002", desc: "Produit ventes travaux — INV-2026-0001 CEET", amount: 63000000, date: D(-28), debitCode: "4110", creditCode: "7010" },
    { ref: "JNL-2026-0003", desc: "Encaissement INV-2026-0002 — Lomé Construction acompte", amount: 92500000, date: D(-15), debitCode: "5210", creditCode: "4110" },
    { ref: "JNL-2026-0004", desc: "Produit ventes — INV-2026-0002 Lomé Construction", amount: 92500000, date: D(-15), debitCode: "4110", creditCode: "7010" },
    { ref: "JNL-2026-0005", desc: "Encaissement BAD — INV-2026-0003 CHU Bloc Opér.", amount: 112000000, date: D(-40), debitCode: "5210", creditCode: "4110" },
    { ref: "JNL-2026-0006", desc: "Produit ventes — INV-2026-0003 CHU BAD", amount: 112000000, date: D(-40), debitCode: "4110", creditCode: "7010" },
    { ref: "JNL-2026-0007", desc: "Charges personnel mai 2026 — masse salariale", amount: 12500000, date: D(-15), debitCode: "64", creditCode: "5210" },
    { ref: "JNL-2026-0008", desc: "Loyers entrepôt + véhicules — mai 2026", amount: 3850000, date: D(-14), debitCode: "62", creditCode: "5210" },
  ];

  for (const e of jecEntries) {
    const debitAcct = acctByCode.get(e.debitCode);
    const creditAcct = acctByCode.get(e.creditCode);
    if (!debitAcct || !creditAcct || !jnl || !fp2026) continue;
    const [entry] = await db.insert(journalEntriesTable).values({
      organizationId: orgId, journalId: jnl.id, fiscalPeriodId: fp2026.id,
      entryNumber: e.ref, reference: e.ref, description: e.desc, entryDate: e.date,
      status: "posted", totalDebit: num(e.amount), totalCredit: num(e.amount),
      createdById: admin.id,
    }).returning();
    if (entry) {
      await db.insert(journalEntryLinesTable).values([
        { organizationId: orgId, entryId: entry.id, accountId: debitAcct.id, debit: num(e.amount), credit: "0", description: e.desc, position: 1 },
        { organizationId: orgId, entryId: entry.id, accountId: creditAcct.id, debit: "0", credit: num(e.amount), description: e.desc, position: 2 },
      ]);
    }
  }
  console.log("  ✓ Plan comptable SYSCOHADA + période 2026 + 8 écritures");

  // ── 14. Fournisseurs ─────────────────────────────────────────────────
  await db.insert(suppliersTable).values([
    { organizationId: orgId, code: "F001", name: "ABB Afrique de l'Ouest", email: "togo@abb.com", phone: "+228 22 20 50 10", isActive: true },
    { organizationId: orgId, code: "F002", name: "CIMAF Matériaux Togo", email: "vente@cimaf.tg", phone: "+228 22 26 00 12", isActive: true },
    { organizationId: orgId, code: "F003", name: "Caterpillar Togo (CICA)", email: "contact@cica.tg", phone: "+228 22 27 55 40", isActive: true },
    { organizationId: orgId, code: "F004", name: "SECO Tools Afrique", email: "africa@seco.com", phone: "+225 27 22 310 000", isActive: true },
    { organizationId: orgId, code: "F005", name: "Bolloré Logistics (transit)", email: "transit-lome@bollore.com", phone: "+228 22 27 02 80", isActive: true },
  ]);

  // ── 15. Stock & Produits ──────────────────────────────────────────────
  console.log("→ Stock & Produits...");
  const prodCats = await db.insert(productCategoriesTable).values([
    { organizationId: orgId, name: "Matériaux de construction", description: "Ciment, acier, agrégats, briques" },
    { organizationId: orgId, name: "Équipements électriques", description: "Câbles, coffrets, appareillage HTA/BT" },
    { organizationId: orgId, name: "Consommables chantier", description: "EPI, peinture, visserie, adhésifs" },
    { organizationId: orgId, name: "Pièces de rechange", description: "Filtres, courroies, joints — engins" },
    { organizationId: orgId, name: "Fournitures de bureau", description: "Papeterie, cartouches, toners" },
  ]).returning();

  await db.insert(productsTable).values([
    { organizationId: orgId, sku: "CIM-CPJ-50", name: "Ciment CPJ 45 — sac 50 kg (CIMAF)", categoryId: prodCats[0]!.id, unit: "sac", purchasePriceFcfa: "4500", sellingPriceFcfa: "5200", taxRatePct: "18", minStock: "500", isActive: true },
    { organizationId: orgId, sku: "ACIER-HA12", name: "Acier HA Ø12 mm — barre 12 m", categoryId: prodCats[0]!.id, unit: "barre", purchasePriceFcfa: "5800", sellingPriceFcfa: "7000", taxRatePct: "18", minStock: "200", isActive: true },
    { organizationId: orgId, sku: "ACIER-HA16", name: "Acier HA Ø16 mm — barre 12 m", categoryId: prodCats[0]!.id, unit: "barre", purchasePriceFcfa: "9800", sellingPriceFcfa: "11500", taxRatePct: "18", minStock: "150", isActive: true },
    { organizationId: orgId, sku: "GRAVIER-5-25", name: "Gravier 5/25 mm — tonne", categoryId: prodCats[0]!.id, unit: "t", purchasePriceFcfa: "28000", sellingPriceFcfa: "38000", taxRatePct: "18", minStock: "50", isActive: true },
    { organizationId: orgId, sku: "CAB-HTA-150", name: "Câble HTA XLPE 15 kV 150 mm² — mètre", categoryId: prodCats[1]!.id, unit: "m", purchasePriceFcfa: "12500", sellingPriceFcfa: "16000", taxRatePct: "18", minStock: "500", isActive: true },
    { organizationId: orgId, sku: "COFBT-PRAGMA", name: "Coffret BT 24 modules IP65 Schneider", categoryId: prodCats[1]!.id, unit: "pcs", purchasePriceFcfa: "45000", sellingPriceFcfa: "62000", taxRatePct: "18", minStock: "20", isActive: true },
    { organizationId: orgId, sku: "EPI-CASQUE", name: "Casque de chantier EN 397 — jaune", categoryId: prodCats[2]!.id, unit: "pcs", purchasePriceFcfa: "2800", sellingPriceFcfa: "4500", taxRatePct: "18", minStock: "50", isActive: true },
    { organizationId: orgId, sku: "EPI-HARNAIS", name: "Harnais antichute EN 361 complet", categoryId: prodCats[2]!.id, unit: "pcs", purchasePriceFcfa: "32000", sellingPriceFcfa: "48000", taxRatePct: "18", minStock: "15", isActive: true },
    { organizationId: orgId, sku: "FILTRE-CAT-HUILE", name: "Filtre à huile Caterpillar C18 — 1R-0749", categoryId: prodCats[3]!.id, unit: "pcs", purchasePriceFcfa: "18500", sellingPriceFcfa: "28000", taxRatePct: "18", minStock: "10", isActive: true },
    { organizationId: orgId, sku: "PEINTURE-FACADE", name: "Peinture façade acrylique — bidon 25 L", categoryId: prodCats[2]!.id, unit: "bidon", purchasePriceFcfa: "22000", sellingPriceFcfa: "32000", taxRatePct: "18", minStock: "30", isActive: true },
  ]);
  console.log("  ✓ 5 catégories produits + 10 références");

  // ── 16. Documents ─────────────────────────────────────────────────────
  console.log("→ Documents...");
  await db.insert(documentsTable).values([
    { organizationId: orgId, name: "Contrat-cadre CEET — Extension HTA 2026", category: "contracts", fileUrl: "https://files.gameasu.com/contracts/ceet-hta-2026.pdf", entityType: "project", entityId: projects[0]?.id, uploadedBy: admin.id },
    { organizationId: orgId, name: "Plan d'exécution fondations — Siège Lomé Construction", category: "technical", fileUrl: "https://files.gameasu.com/plans/lc-fondations-ex-2026.dwg", entityType: "project", entityId: projects[1]?.id, uploadedBy: directeur.id },
    { organizationId: orgId, name: "Rapport d'avancement CHU — Juin 2026", category: "reports", fileUrl: "https://files.gameasu.com/reports/chu-avancement-juin2026.pdf", entityType: "project", entityId: projects[2]?.id, uploadedBy: directeur.id },
    { organizationId: orgId, name: "PV réception voirie Adakpamé — km 0 à 2", category: "reception", fileUrl: "https://files.gameasu.com/pvs/voirie-adakpame-km0-2.pdf", entityType: "project", entityId: projects[3]?.id, uploadedBy: cChefProj?.id ?? admin.id },
    { organizationId: orgId, name: "RCCM — Gameasu Technologies SARL", category: "administrative", fileUrl: "https://files.gameasu.com/legal/rccm-gameasu-tech.pdf", uploadedBy: admin.id },
    { organizationId: orgId, name: "Agrément technique MIETFP — Génie civil", category: "administrative", fileUrl: "https://files.gameasu.com/legal/agrement-mietfp-gc.pdf", uploadedBy: admin.id },
    { organizationId: orgId, name: "Assurance décennale — Police 2026", category: "administrative", fileUrl: "https://files.gameasu.com/legal/assurance-decennale-2026.pdf", uploadedBy: admin.id },
    { organizationId: orgId, name: "Planning directeur — Projet CHU bloc opératoire", category: "technical", fileUrl: "https://files.gameasu.com/planning/chu-planning-directeur.xlsx", entityType: "project", entityId: projects[2]?.id, uploadedBy: cArchi?.id ?? admin.id },
    { organizationId: orgId, name: "Note de calcul béton armé — Extension siège R+3", category: "technical", fileUrl: "https://files.gameasu.com/studies/lc-calcul-ba-r3.pdf", entityType: "project", entityId: projects[1]?.id, uploadedBy: cIngGC?.id ?? admin.id },
    { organizationId: orgId, name: "Plan HSE chantier — CHU bloc opératoire", category: "hse", fileUrl: "https://files.gameasu.com/hse/chu-plan-hse-2026.pdf", entityType: "project", entityId: projects[2]?.id, uploadedBy: cHSE?.id ?? admin.id },
  ]);
  console.log("  ✓ 10 documents");

  // ── 17. Messagerie ────────────────────────────────────────────────────
  console.log("→ Messagerie (conversations + messages)...");
  const convs = await db.insert(conversationsTable).values([
    { organizationId: orgId, title: "Équipe Projet CEET — Kpalimé HTA", type: "group", projectId: projects[0]?.id, lastMessage: "Plan d'exécution postes HTA validé par CEET.", lastMessageAt: DT(-2, 16) },
    { organizationId: orgId, title: "Direction — Bilan S1 2026", type: "group", lastMessage: "Je partage le draft du rapport conseil demain matin.", lastMessageAt: DT(-1, 18) },
    { organizationId: orgId, title: "Commercial — Pipeline Q3", type: "group", lastMessage: "Bolloré a demandé une visite technique pour l'entrepôt frig.", lastMessageAt: DT(0, 9) },
    { organizationId: orgId, title: "Chantier CHU — Coordination", type: "group", projectId: projects[2]?.id, lastMessage: "Coulage dalle bloc B demain 6h30. Béton commandé OK.", lastMessageAt: DT(-1, 20) },
  ]).returning();

  const allUserIds = [admin.id, directeur.id, commercial.id, finance.id, rh.id, operations.id];
  for (const conv of convs) {
    const participantIds = conv.title?.includes("Équipe Projet") ? [admin.id, directeur.id, operations.id] :
                           conv.title?.includes("Direction") ? [admin.id, directeur.id, finance.id] :
                           conv.title?.includes("Commercial") ? [admin.id, directeur.id, commercial.id] :
                           [admin.id, directeur.id, operations.id];
    for (const uid of participantIds) {
      await db.insert(conversationParticipantsTable).values({ organizationId: orgId, conversationId: conv.id, userId: uid }).onConflictDoNothing();
    }
  }

  await db.insert(messagesTable).values([
    { organizationId: orgId, conversationId: convs[0]!.id, senderId: directeur.id, content: "Bonjour équipe, le levé topo ligne HTA est terminé. Rapport remis à CEET hier." },
    { organizationId: orgId, conversationId: convs[0]!.id, senderId: admin.id, content: "Très bien ! On anticipe l'arrivée des câbles ABB la semaine prochaine ?" },
    { organizationId: orgId, conversationId: convs[0]!.id, senderId: operations.id, content: "Oui, livraison confirmée vendredi. J'ai coordonné avec le transitaire Bolloré." },
    { organizationId: orgId, conversationId: convs[0]!.id, senderId: directeur.id, content: "Plan d'exécution postes HTA validé par CEET. On peut lancer la mobilisation équipe terrain." },
    { organizationId: orgId, conversationId: convs[1]!.id, senderId: finance.id, content: "Le MRR juin est à 875 000 FCFA. Croissance de 12% vs mai. Bonne nouvelle !" },
    { organizationId: orgId, conversationId: convs[1]!.id, senderId: admin.id, content: "Excellent. On est en ligne avec notre objectif annuel. Préparez les slides pour le conseil." },
    { organizationId: orgId, conversationId: convs[1]!.id, senderId: directeur.id, content: "Je partage le draft du rapport conseil demain matin." },
    { organizationId: orgId, conversationId: convs[2]!.id, senderId: commercial.id, content: "Pipeline Q3 : 3 opportunités > 100M FCFA en phase négociation. Bolloré, BTCI, Port Lomé." },
    { organizationId: orgId, conversationId: convs[2]!.id, senderId: admin.id, content: "Concentrons-nous sur Bolloré — c'est le plus grand projet. RDV technique ?" },
    { organizationId: orgId, conversationId: convs[2]!.id, senderId: commercial.id, content: "Bolloré a demandé une visite technique pour l'entrepôt frig. Je propose le 25 juin." },
    { organizationId: orgId, conversationId: convs[3]!.id, senderId: operations.id, content: "Réunion de coordination chantier CHU demain 7h. Sécurité, planning, points bloquants." },
    { organizationId: orgId, conversationId: convs[3]!.id, senderId: directeur.id, content: "Je serai là. On a le suivi du bureau de contrôle aussi ?" },
    { organizationId: orgId, conversationId: convs[3]!.id, senderId: operations.id, content: "Oui, APAVE confirme leur présence. Coulage dalle bloc B demain 6h30. Béton commandé OK." },
  ]);
  console.log("  ✓ 4 conversations + 13 messages");

  // ── 18. Notifications ─────────────────────────────────────────────────
  await db.insert(notificationsTable).values([
    { organizationId: orgId, userId: admin.id, type: "payment_received", title: "Paiement reçu — CEET", body: "Virement de 63 000 000 FCFA reçu. Réf : VIR-CEET-BTD-2026-0601. Facture INV-2026-0001.", entityType: "invoice", isRead: "false" },
    { organizationId: orgId, userId: admin.id, type: "invoice_overdue", title: "Facture en retard — Mairie de Lomé", body: "INV-2026-0004 (98 000 000 FCFA) est en retard de 20 jours. Relance urgente recommandée.", entityType: "invoice", isRead: "false" },
    { organizationId: orgId, userId: admin.id, type: "opportunity_update", title: "Opportunité gagnée — CEET Kpalimé", body: "L'opportunité Extension HTA 210 M FCFA est passée en 'Gagné'. Contrat signé.", entityType: "opportunity", isRead: "true" },
    { organizationId: orgId, userId: directeur.id, type: "task_assigned", title: "Tâche assignée — Bilan S1 2026", body: "Préparez la présentation bilan S1 2026 pour le Conseil. Échéance : " + D(20), entityType: "task", isRead: "false" },
    { organizationId: orgId, userId: directeur.id, type: "project_milestone", title: "Jalon projet — Voirie Adakpamé 78%", body: "Le projet Voirie zone industrielle Adakpamé Phase 1 atteint 78% d'avancement.", entityType: "project", isRead: "false" },
    { organizationId: orgId, userId: commercial.id, type: "opportunity_update", title: "Négociation — ECOBANK périmétrique", body: "L'opportunité ECOBANK (42 M FCFA) passe en phase de négociation. Probabilité 80%.", entityType: "opportunity", isRead: "false" },
    { organizationId: orgId, userId: finance.id, type: "payment_received", title: "Encaissement BAD — CHU bloc opératoire", body: "Virement BAD de 112 000 000 FCFA reçu. Tranche 1 décaissée.", entityType: "invoice", isRead: "true" },
    { organizationId: orgId, userId: admin.id, type: "rental_expiring", title: "Location bientôt à renouveler", body: "RNT-2026-0002 (Groupe FG Wilson — BTCI) expire dans " + (65) + " jours.", entityType: "rental", isRead: "true" },
    { organizationId: orgId, userId: rh.id, type: "task_assigned", title: "Action RH — Recrutement conducteur travaux", body: "Lancer le recrutement conducteur de travaux senior. Budget validé en comité.", entityType: "task", isRead: "false" },
    { organizationId: orgId, userId: admin.id, type: "system", title: "Rapport mensuel Mai 2026 disponible", body: "Le rapport de performance Mai 2026 est prêt. CA : 267 500 000 FCFA. Marge : 22,4%.", entityType: "report", isRead: "true" },
  ]);

  // ── 19. Tickets Support ───────────────────────────────────────────────
  console.log("→ Tickets support...");
  const tickets = await db.insert(ticketsTable).values([
    { organizationId: orgId, subject: "Impossible d'exporter le rapport de variance budget en Excel", description: "Lors du clic sur 'Exporter variance', le téléchargement commence puis s'interrompt. Navigateur : Chrome 125. OS : Windows 11. Aucun message d'erreur visible.", category: "bug", priority: "high", status: "in_progress", createdById: finance.id, assigneeId: support.id },
    { organizationId: orgId, subject: "Ajouter le filtre 'par département' sur la liste des tâches", description: "Nous avons 8 départements et il est difficile de retrouver les tâches d'un département spécifique sans filtre. Ce serait très utile pour la réunion hebdo.", category: "feature", priority: "medium", status: "open", createdById: directeur.id },
    { organizationId: orgId, subject: "Les notifications de paiement ne s'affichent pas en temps réel", description: "On reçoit les notifications avec 5 à 10 minutes de retard. Le suivi de trésorerie s'en trouve impacté.", category: "bug", priority: "medium", status: "resolved", createdById: finance.id, assigneeId: support.id },
    { organizationId: orgId, subject: "Demande d'accès module Planification Financière pour Salif Koné", description: "Salif Koné (finance@gameasu.com) a besoin d'accéder au module FP&A pour préparer le budget Q3.", category: "access", priority: "high", status: "open", createdById: admin.id },
    { organizationId: orgId, subject: "Question sur la méthode de calcul du DSO", description: "Comment le DSO est-il calculé dans le module Recouvrement ? Quelle est la fenêtre temporelle utilisée ?", category: "question", priority: "low", status: "closed", createdById: finance.id, assigneeId: support.id },
    { organizationId: orgId, subject: "Erreur 500 lors de la création d'une inspection de location", description: "Quand on tente de créer une inspection pré-location pour RNT-2026-0003, l'application renvoie une erreur 500. Besoin urgent.", category: "bug", priority: "urgent", status: "open", createdById: operations.id },
  ]).returning();

  await db.insert(ticketCommentsTable).values([
    { ticketId: tickets[0]!.id, authorId: support.id, body: "Bonjour Salif, merci pour votre rapport. Je reproduis le problème sur notre environnement de test. Je reviens vers vous d'ici fin de journée avec un correctif." },
    { ticketId: tickets[0]!.id, authorId: finance.id, body: "Merci ! Je précise : ça arrive uniquement sur les fichiers > 1 000 lignes. Pour les petits budgets, l'export fonctionne." },
    { ticketId: tickets[2]!.id, authorId: support.id, body: "Problème identifié : un délai de 5 min dans la synchronisation WebSocket. Correctif déployé en production il y a 30 min. Pouvez-vous confirmer que c'est résolu de votre côté ?" },
    { ticketId: tickets[2]!.id, authorId: finance.id, body: "Confirmé ! Les notifications arrivent maintenant en temps réel. Merci pour la réactivité." },
    { ticketId: tickets[4]!.id, authorId: support.id, body: "Le DSO est calculé sur les 90 derniers jours (créances clients / CA 90j × 90). La fenêtre est configurable dans les paramètres de l'espace de travail." },
  ]);
  console.log(`  ✓ ${tickets.length} tickets + commentaires`);

  // ── 20. Cockpit — Incidents & audit ──────────────────────────────────
  console.log("→ Cockpit — Incidents & journal d'audit...");
  await db.insert(incidentsTable).values([
    { title: "Latence API > 2s sur /api/fpa/variance (batch exports)", severity: "medium", status: "resolved", affectedServices: "api-server, fpa-module", resolvedAt: DT(-12, 16), createdById: admin.id, description: "Des requêtes de variance FP&A sur des budgets de plus de 500 lignes dépassaient 2 secondes. Cause : index manquant sur budget_lines.period. Correctif appliqué en production à 16h15." },
    { title: "Interruption WebSocket — synchronisation messagerie (5 min)", severity: "low", status: "resolved", affectedServices: "realtime, messaging", resolvedAt: DT(-5, 9), createdById: admin.id, description: "Déconnexion brève du serveur Socket.IO suite à un redémarrage de pod. Les clients ont reconnecté automatiquement." },
    { title: "Tentatives de connexion répétées — IP 197.215.42.x", severity: "high", status: "monitoring", affectedServices: "auth, api-server", createdById: admin.id, description: "30 tentatives de connexion en 10 minutes depuis l'IP 197.215.42.88 avec des emails inexistants. Possible attaque bruteforce." },
  ]);

  await db.insert(cockpitAuditLogsTable).values([
    { actorId: admin.id, actorEmail: "admin@gameasu.com", action: "org.update", resource: "organization", resourceId: orgId, metadata: { field: "primaryColor", from: "#000000", to: "#F37021" } },
    { actorId: admin.id, actorEmail: "admin@gameasu.com", action: "user.create", resource: "user", resourceId: directeur.id, metadata: { email: "directeur@gameasu.com", role: "manager" } },
    { actorId: admin.id, actorEmail: "admin@gameasu.com", action: "module.enable", resource: "module", resourceId: orgId, metadata: { module: "financial_planning", enabled: true } },
    { actorId: admin.id, actorEmail: "admin@gameasu.com", action: "ticket.update", resource: "ticket", resourceId: tickets[2]!.id, metadata: { status: { from: "in_progress", to: "resolved" } } },
    { actorId: admin.id, actorEmail: "admin@gameasu.com", action: "subscription.change", resource: "subscription", resourceId: subId, metadata: { plan: "PROFESSIONAL", seats: 25, amount: "875000 FCFA/mois" } },
    { actorId: admin.id, actorEmail: "admin@gameasu.com", action: "incident.create", resource: "incident", resourceId: orgId, metadata: { title: "Tentatives connexion répétées", severity: "high" } },
  ]);
  console.log("  ✓ 3 incidents + 6 entrées audit");

  // ── 21. Présences & Pointage ──────────────────────────────────────────
  console.log("→ Présences & Pointage (attendance sessions)...");
  const attendanceCollabs = collabRows.slice(0, 8);
  const attendanceData: any[] = [];
  for (let dayOffset = -14; dayOffset <= -1; dayOffset++) {
    const isWeekend = new Date(`2026-06-${14 + dayOffset < 10 ? "0" : ""}${14 + dayOffset}`).getDay();
    if (isWeekend === 0 || isWeekend === 6) continue;
    for (const collab of attendanceCollabs) {
      const clockIn = 7 + Math.floor(Math.random() * 2); // 7h ou 8h
      const isLate = clockIn >= 8;
      const totalMin = 480 + Math.floor(Math.random() * 60);
      const workDateObj = new Date();
      workDateObj.setDate(workDateObj.getDate() + dayOffset);
      const workDate = workDateObj.toISOString().slice(0, 10);
      attendanceData.push({
        organizationId: orgId, collaboratorId: collab.id,
        userId: collab.userId ?? null,
        workDate,
        status: "closed",
        clockInAt: DT(dayOffset, clockIn),
        clockOutAt: DT(dayOffset, clockIn + Math.floor(totalMin / 60)),
        totalMinutes: totalMin, breakMinutes: 60, effectiveMinutes: totalMin - 60,
        expectedMinutes: 480, isLate,
        approvalStatus: "approved", approvedById: directeur.id,
      });
    }
  }
  if (attendanceData.length > 0) {
    await db.insert(attendanceSessionsTable).values(attendanceData);
  }
  console.log(`  ✓ ${attendanceData.length} sessions de pointage (14 jours × 8 collabs)`);

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  ✅ Gameasu Master Demo Seed — Terminé avec succès !");
  console.log("─────────────────────────────────────────────────────────────");
  console.log("  Comptes démo :");
  console.log("    admin@gameasu.com       / admin123");
  console.log("    directeur@gameasu.com   / admin123");
  console.log("    commercial@gameasu.com  / commercial123");
  console.log("    finance@gameasu.com     / finance123");
  console.log("    rh@gameasu.com          / rh123");
  console.log("    operations@gameasu.com  / ops123");
  console.log("═══════════════════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error("✗ Erreur:", e); process.exit(1); });
