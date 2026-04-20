/**
 * Génération de données de démo réalistes et interconnectées pour EDOLE AFRICA.
 *
 * Stratégie :
 * - Idempotent : marqueur via un client "BTP Vision SARL" — si présent, on saute.
 * - Réutilise les seeds existants (HR départements/positions, plan SYSCOHADA,
 *   journaux, périodes fiscales, banques, RBAC).
 * - Toutes les écritures comptables passent par `postings.ts` (intégrité).
 * - Données cohérentes : projets liés à des clients, factures liées à des projets,
 *   tâches liées à des engagements ou projets, etc.
 */

import { db } from "@workspace/db";
import {
  clientsTable, clientContactsTable,
  usersTable, userClientAccessTable,
  collaboratorsTable, departmentsTable, positionsTable,
  contractsTable, hrDocumentsTable, collaboratorAssignmentsTable,
  servicesTable, clientServicesTable, serviceSectionsTable,
  projectsTable, projectPhasesTable,
  tasksTable,
  equipmentTable, equipmentCategoriesTable, equipmentMovementsTable,
  rentalsTable, rentalItemsTable, inspectionsTable, logisticsOperationsTable,
  ordersTable, proformasTable, invoicesTable, paymentsTable,
  suppliersTable, supplierInvoicesTable, supplierPaymentsTable,
  bankAccountsTable, fiscalPeriodsTable, fixedAssetsTable, chartOfAccountsTable,
  budgetsTable, budgetLinesTable,
  opportunitiesTable, activitiesTable,
  prospectsTable, marketingCampaignsTable,
  documentsTable,
  conversationsTable, conversationParticipantsTable, messagesTable, notificationsTable,
  alertsTable, ticketsTable,
} from "@workspace/db";
import { eq, and, inArray, like, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  postCustomerInvoice, postCustomerPayment,
  postSupplierInvoice, postSupplierPayment,
} from "./postings";
import { getCurrentFiscalPeriod } from "./syscohada-seed";

const MARKER = "BTP Vision SARL";
const DEMO_CLIENT_NAMES = [
  "BTP Vision SARL", "Hôtel Atlantique Group", "Société Minière du Sahel",
  "Distribution Express SA", "Cimenterie Sahel", "Téléco Côte d'Ivoire",
  "Banque Régionale de l'Ouest",
];
const DEMO_USER_EMAILS = [
  "directeur@edole.africa", "commercial@edole.africa", "comptable@edole.africa",
  "chefchantier@edole.africa", "conducteur@edole.africa", "rh@edole.africa",
];

/**
 * Supprime toutes les données de démo générées précédemment.
 * Appelé quand force=true pour permettre une régénération propre.
 */
export async function cleanupDemo(): Promise<void> {
  // Récupérer les IDs de référence
  const demoClients = await db.select({ id: clientsTable.id }).from(clientsTable).where(inArray(clientsTable.name, DEMO_CLIENT_NAMES));
  const clientIds = demoClients.map(c => c.id);
  const demoProjects = clientIds.length
    ? await db.select({ id: projectsTable.id }).from(projectsTable).where(inArray(projectsTable.clientId, clientIds as any))
    : [];
  const projectIds = demoProjects.map(p => p.id);
  const demoEngs = clientIds.length
    ? await db.select({ id: clientServicesTable.id }).from(clientServicesTable).where(inArray(clientServicesTable.clientId, clientIds as any))
    : [];
  const engagementIds = demoEngs.map(e => e.id);
  const demoCollabs = await db.select({ id: collaboratorsTable.id }).from(collaboratorsTable).where(like(collaboratorsTable.employeeNumber, "EDO-1%"));
  const collabIds = demoCollabs.map(c => c.id);
  const demoSuppliers = await db.select({ id: suppliersTable.id }).from(suppliersTable).where(like(suppliersTable.code, "DEMO-F%"));
  const supplierIds = demoSuppliers.map(s => s.id);
  const demoOpps = clientIds.length
    ? await db.select({ id: opportunitiesTable.id }).from(opportunitiesTable).where(inArray(opportunitiesTable.clientId, clientIds as any))
    : [];
  const oppIds = demoOpps.map(o => o.id);

  // Order matters : enfants → parents
  // Tâches : il faut d'abord récupérer leurs IDs pour purger task_comments / task_history.
  const { taskCommentsTable, taskHistoryTable, callSessionsTable } = await import("@workspace/db");
  let taskIdsToDelete: string[] = [];
  if (projectIds.length || engagementIds.length) {
    const cond: any[] = [];
    if (projectIds.length) cond.push(inArray(tasksTable.projectId, projectIds as any));
    if (engagementIds.length) cond.push(inArray(tasksTable.serviceId, engagementIds as any));
    const ts = await db.select({ id: tasksTable.id }).from(tasksTable).where(cond.length === 1 ? cond[0] : (or as any)(...cond));
    taskIdsToDelete = ts.map(t => t.id);
  }
  if (taskIdsToDelete.length) {
    await db.delete(taskCommentsTable).where(inArray(taskCommentsTable.taskId, taskIdsToDelete as any));
    await db.delete(taskHistoryTable).where(inArray(taskHistoryTable.taskId, taskIdsToDelete as any));
    // Sous-tâches d'abord (parentTaskId), puis parents
    await db.delete(tasksTable).where(inArray(tasksTable.parentTaskId, taskIdsToDelete as any));
    await db.delete(tasksTable).where(inArray(tasksTable.id, taskIdsToDelete as any));
  }
  if (projectIds.length) {
    await db.delete(collaboratorAssignmentsTable).where(inArray(collaboratorAssignmentsTable.projectId, projectIds as any));
    await db.delete(projectPhasesTable).where(inArray(projectPhasesTable.projectId, projectIds as any));
  }

  // Locations + dépendances : scope par clientId démo (couvre tous les anciens préfixes éventuels)
  const demoRentals = clientIds.length
    ? await db.select({ id: rentalsTable.id }).from(rentalsTable).where(inArray(rentalsTable.clientId, clientIds as any))
    : [];
  const rentalIds = demoRentals.map(r => r.id);
  if (rentalIds.length) {
    await db.delete(rentalItemsTable).where(inArray(rentalItemsTable.rentalId, rentalIds as any));
    await db.delete(inspectionsTable).where(inArray(inspectionsTable.rentalId, rentalIds as any));
    await db.delete(logisticsOperationsTable).where(inArray(logisticsOperationsTable.rentalId, rentalIds as any));
    await db.delete(rentalsTable).where(inArray(rentalsTable.id, rentalIds as any));
  }

  // Équipements + mouvements + catégories de démo
  const demoEquip = await db.select({ id: equipmentTable.id }).from(equipmentTable).where(like(equipmentTable.code, "DEMO-EQ-%"));
  const equipIds = demoEquip.map(e => e.id);
  if (equipIds.length) {
    await db.delete(equipmentMovementsTable).where(inArray(equipmentMovementsTable.equipmentId, equipIds as any));
    await db.delete(equipmentTable).where(inArray(equipmentTable.id, equipIds as any));
  }
  // Catégories sans équipement restant
  // Note : on conserve les catégories d'équipement (potentiellement référencées ailleurs).

  // Cycle commercial : scope par clientId démo
  const demoInvoices = clientIds.length
    ? await db.select({ id: invoicesTable.id }).from(invoicesTable).where(inArray(invoicesTable.clientId, clientIds as any))
    : [];
  const invoiceIds = demoInvoices.map(i => i.id);
  if (invoiceIds.length) {
    const demoPayments = await db.select({ id: paymentsTable.id }).from(paymentsTable).where(inArray(paymentsTable.invoiceId, invoiceIds as any));
    const payIds = demoPayments.map(p => p.id);
    // Écritures comptables : supprimer par sourceId
    if (payIds.length) {
      const { journalEntriesTable, journalEntryLinesTable } = await import("@workspace/db");
      const entries = await db.select({ id: journalEntriesTable.id }).from(journalEntriesTable).where(and(eq(journalEntriesTable.sourceType, "payment"), inArray(journalEntriesTable.sourceId, payIds as any)) as any);
      const eIds = entries.map(e => e.id);
      if (eIds.length) {
        await db.delete(journalEntryLinesTable).where(inArray(journalEntryLinesTable.entryId, eIds as any));
        await db.delete(journalEntriesTable).where(inArray(journalEntriesTable.id, eIds as any));
      }
      await db.delete(paymentsTable).where(inArray(paymentsTable.id, payIds as any));
    }
    const { journalEntriesTable, journalEntryLinesTable } = await import("@workspace/db");
    const invEntries = await db.select({ id: journalEntriesTable.id }).from(journalEntriesTable).where(and(eq(journalEntriesTable.sourceType, "invoice"), inArray(journalEntriesTable.sourceId, invoiceIds as any)) as any);
    const eIds = invEntries.map(e => e.id);
    if (eIds.length) {
      await db.delete(journalEntryLinesTable).where(inArray(journalEntryLinesTable.entryId, eIds as any));
      await db.delete(journalEntriesTable).where(inArray(journalEntriesTable.id, eIds as any));
    }
    await db.delete(invoicesTable).where(inArray(invoicesTable.id, invoiceIds as any));
  }
  if (clientIds.length) {
    await db.delete(proformasTable).where(inArray(proformasTable.clientId, clientIds as any));
    await db.delete(ordersTable).where(inArray(ordersTable.clientId, clientIds as any));
  }

  // Factures fournisseurs + paiements + écritures
  if (supplierIds.length) {
    const sInvs = await db.select({ id: supplierInvoicesTable.id }).from(supplierInvoicesTable).where(inArray(supplierInvoicesTable.supplierId, supplierIds as any));
    const sInvIds = sInvs.map(s => s.id);
    if (sInvIds.length) {
      const sPays = await db.select({ id: supplierPaymentsTable.id }).from(supplierPaymentsTable).where(inArray(supplierPaymentsTable.supplierInvoiceId, sInvIds as any));
      const sPayIds = sPays.map(p => p.id);
      const { journalEntriesTable, journalEntryLinesTable } = await import("@workspace/db");
      if (sPayIds.length) {
        const entries = await db.select({ id: journalEntriesTable.id }).from(journalEntriesTable).where(and(eq(journalEntriesTable.sourceType, "supplier_payment"), inArray(journalEntriesTable.sourceId, sPayIds as any)) as any);
        const eIds = entries.map(e => e.id);
        if (eIds.length) {
          await db.delete(journalEntryLinesTable).where(inArray(journalEntryLinesTable.entryId, eIds as any));
          await db.delete(journalEntriesTable).where(inArray(journalEntriesTable.id, eIds as any));
        }
        await db.delete(supplierPaymentsTable).where(inArray(supplierPaymentsTable.id, sPayIds as any));
      }
      const sInvEntries = await db.select({ id: journalEntriesTable.id }).from(journalEntriesTable).where(and(eq(journalEntriesTable.sourceType, "supplier_invoice"), inArray(journalEntriesTable.sourceId, sInvIds as any)) as any);
      const eIds = sInvEntries.map(e => e.id);
      if (eIds.length) {
        await db.delete(journalEntryLinesTable).where(inArray(journalEntryLinesTable.entryId, eIds as any));
        await db.delete(journalEntriesTable).where(inArray(journalEntriesTable.id, eIds as any));
      }
      await db.delete(supplierInvoicesTable).where(inArray(supplierInvoicesTable.id, sInvIds as any));
    }
    await db.delete(suppliersTable).where(inArray(suppliersTable.id, supplierIds as any));
  }

  // Immobilisations
  await db.delete(fixedAssetsTable).where(like(fixedAssetsTable.code, "DEMO-IMM-%"));

  // Budgets : nouveau préfixe [DÉMO] + ancien format (compat migration)
  const demoBudgets = await db.select({ id: budgetsTable.id }).from(budgetsTable).where(
    or(
      like(budgetsTable.name, "[DÉMO]%"),
      like(budgetsTable.name, "Budget annuel %"),
      like(budgetsTable.name, "Forecast révisé %"),
    ) as any,
  );
  const budgetIds = demoBudgets.map(b => b.id);
  if (budgetIds.length) {
    await db.delete(budgetLinesTable).where(inArray(budgetLinesTable.budgetId, budgetIds as any));
    await db.delete(budgetsTable).where(inArray(budgetsTable.id, budgetIds as any));
  }

  // CRM
  if (oppIds.length) {
    await db.delete(activitiesTable).where(inArray(activitiesTable.opportunityId, oppIds as any));
    await db.delete(opportunitiesTable).where(inArray(opportunitiesTable.id, oppIds as any));
  }
  if (clientIds.length) {
    await db.delete(activitiesTable).where(inArray(activitiesTable.clientId, clientIds as any));
  }

  // Marketing
  await db.delete(prospectsTable).where(like(prospectsTable.email, "prospect%@example.com"));
  await db.delete(marketingCampaignsTable).where(like(marketingCampaignsTable.name, "[DÉMO]%"));

  // Documents (préfixe [DÉMO])
  await db.delete(documentsTable).where(like(documentsTable.name, "[DÉMO]%"));

  // Conversations (filtrées par titre [DÉMO]) + dépendances (call_sessions, reads, reactions, mentions, attachments)
  {
    const { messageReadsTable, messageReactionsTable, messageMentionsTable, messageAttachmentsTable } = await import("@workspace/db");
    const convs = await db.select({ id: conversationsTable.id }).from(conversationsTable).where(like(conversationsTable.title, "[DÉMO]%"));
    const convIds = convs.map(c => c.id);
    if (convIds.length) {
      // call_sessions référencent conversationId sans cascade
      await db.delete(callSessionsTable).where(inArray(callSessionsTable.conversationId, convIds as any));
      const msgs = await db.select({ id: messagesTable.id }).from(messagesTable).where(inArray(messagesTable.conversationId, convIds as any));
      const msgIds = msgs.map(m => m.id);
      if (msgIds.length) {
        await db.delete(messageReadsTable).where(inArray(messageReadsTable.messageId, msgIds as any));
        await db.delete(messageReactionsTable).where(inArray(messageReactionsTable.messageId, msgIds as any));
        await db.delete(messageMentionsTable).where(inArray(messageMentionsTable.messageId, msgIds as any));
        await db.delete(messageAttachmentsTable).where(inArray(messageAttachmentsTable.messageId, msgIds as any));
        await db.delete(messagesTable).where(inArray(messagesTable.id, msgIds as any));
      }
      await db.delete(conversationParticipantsTable).where(inArray(conversationParticipantsTable.conversationId, convIds as any));
      await db.delete(conversationsTable).where(inArray(conversationsTable.id, convIds as any));
    }
  }

  // Notifications & alertes & tickets
  await db.delete(notificationsTable).where(eq(notificationsTable.body, "Notification générée pour la démo."));
  await db.delete(alertsTable).where(like(alertsTable.dedupKey, "demo-alert-%"));
  await db.delete(ticketsTable).where(eq(ticketsTable.description, "Ticket de démo pour test du module support."));

  // Projets
  if (projectIds.length) {
    await db.delete(projectsTable).where(inArray(projectsTable.id, projectIds as any));
  }
  // Engagements + sections
  if (engagementIds.length) {
    await db.delete(serviceSectionsTable).where(inArray(serviceSectionsTable.clientServiceId, engagementIds as any));
    await db.delete(clientServicesTable).where(inArray(clientServicesTable.id, engagementIds as any));
  }
  // Catalogue services
  await db.delete(servicesTable).where(inArray(servicesTable.code, [
    "ETUDE-FAISA", "CONST-GO", "MAIN-PRV", "LOC-MAT", "SUIV-CHA", "AUDIT-TEC",
  ]));

  // Contacts + ACL clients
  if (clientIds.length) {
    await db.delete(clientContactsTable).where(inArray(clientContactsTable.clientId, clientIds as any));
    await db.delete(userClientAccessTable).where(inArray(userClientAccessTable.clientId, clientIds as any));
    await db.delete(clientsTable).where(inArray(clientsTable.id, clientIds as any));
  }

  // Collaborateurs (et leurs contrats/docs cascadent)
  if (collabIds.length) {
    await db.delete(contractsTable).where(inArray(contractsTable.collaboratorId, collabIds as any));
    await db.delete(hrDocumentsTable).where(inArray(hrDocumentsTable.collaboratorId, collabIds as any));
    await db.delete(collaboratorsTable).where(inArray(collaboratorsTable.id, collabIds as any));
  }

  // Utilisateurs additionnels conservés intentionnellement (FK audit/rbac).
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function ymd(d: Date): string { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function pick<T>(arr: T[], i: number): T { return arr[i % arr.length]; }

export async function seedDemo(opts: { force?: boolean } = {}): Promise<{ skipped?: boolean; counts?: Record<string, number>; message?: string }> {
  // Idempotence
  const existing = await db.select({ id: clientsTable.id }).from(clientsTable).where(eq(clientsTable.name, MARKER)).limit(1);
  if (existing[0] && !opts.force) {
    return { skipped: true, message: "Données de démo déjà présentes (marqueur trouvé)." };
  }
  if (opts.force) {
    await cleanupDemo();
  }

  const counts: Record<string, number> = {};

  // ─── Pré-requis : période fiscale, comptes, journaux, banques ───
  const period = await getCurrentFiscalPeriod();
  if (!period) throw new Error("Aucune période fiscale ouverte. Lancez d'abord seedSyscohada().");

  const accountByCode = new Map<string, string>();
  const allAccounts = await db.select().from(chartOfAccountsTable);
  for (const a of allAccounts) accountByCode.set(a.code, a.id);
  const acc = (code: string) => {
    const id = accountByCode.get(code);
    if (!id) throw new Error(`Compte SYSCOHADA ${code} manquant`);
    return id;
  };

  let bankAccount = (await db.select().from(bankAccountsTable).limit(1))[0];
  if (!bankAccount) {
    [bankAccount] = await db.insert(bankAccountsTable).values({
      name: "BICICI compte courant", type: "bank", bankName: "BICICI",
      accountNumber: "CI05-CI-12345-67890", accountId: acc("521"), currency: "XOF", openingBalance: "5000000",
    }).returning();
  }

  // ─── Admin existant ───
  const admin = (await db.select().from(usersTable).where(eq(usersTable.email, "admin@edole.africa")).limit(1))[0];
  if (!admin) throw new Error("Compte admin@edole.africa introuvable.");

  // ─── Utilisateurs supplémentaires ───
  const passwordHash = "demo2026";
  const userSpecs = [
    { email: "directeur@edole.africa", firstName: "Kouassi", lastName: "Adjoumani", role: "manager" },
    { email: "commercial@edole.africa", firstName: "Aminata", lastName: "Diallo", role: "manager" },
    { email: "comptable@edole.africa", firstName: "Salif", lastName: "Traoré", role: "collaborator" },
    { email: "chefchantier@edole.africa", firstName: "Moussa", lastName: "Konaté", role: "collaborator" },
    { email: "conducteur@edole.africa", firstName: "Fatou", lastName: "Sangaré", role: "collaborator" },
    { email: "rh@edole.africa", firstName: "Mariam", lastName: "Ouédraogo", role: "manager" },
  ];
  const users: Record<string, string> = { admin: admin.id };
  for (const u of userSpecs) {
    const existing = (await db.select().from(usersTable).where(eq(usersTable.email, u.email)).limit(1))[0];
    if (existing) { users[u.email] = existing.id; continue; }
    const [created] = await db.insert(usersTable).values({
      ...u, password: passwordHash, isActive: true, mustChangePassword: false,
    }).returning();
    users[u.email] = created.id;
  }
  counts.users = userSpecs.length;

  // ─── Départements / postes (existent déjà via hr-seed) ───
  const departments = await db.select().from(departmentsTable);
  const positions = await db.select().from(positionsTable);
  const deptByCode = new Map(departments.map(d => [d.code, d.id]));
  const posByCode = new Map(positions.map(p => [p.code, p.id]));

  // ─── Collaborateurs ───
  const collabSpecs = [
    { firstName: "Kouassi", lastName: "Adjoumani", email: "directeur@edole.africa", deptCode: "DIR", posCode: "DIR-GEN", baseSalary: "1200000" },
    { firstName: "Aminata", lastName: "Diallo", email: "commercial@edole.africa", deptCode: "COM", posCode: "COM-DIR", baseSalary: "850000" },
    { firstName: "Salif", lastName: "Traoré", email: "comptable@edole.africa", deptCode: "FIN", posCode: "FIN-CPT", baseSalary: "650000" },
    { firstName: "Moussa", lastName: "Konaté", email: "chefchantier@edole.africa", deptCode: "OPS", posCode: "OPS-CHE", baseSalary: "550000" },
    { firstName: "Fatou", lastName: "Sangaré", email: "conducteur@edole.africa", deptCode: "OPS", posCode: "OPS-CON", baseSalary: "480000" },
    { firstName: "Mariam", lastName: "Ouédraogo", email: "rh@edole.africa", deptCode: "RH", posCode: "RH-DIR", baseSalary: "780000" },
    { firstName: "Ibrahim", lastName: "Cissé", email: null, deptCode: "OPS", posCode: "OPS-OUV", baseSalary: "320000" },
    { firstName: "Aïssatou", lastName: "Bamba", email: null, deptCode: "OPS", posCode: "OPS-OUV", baseSalary: "320000" },
  ];
  const collabIds: string[] = [];
  let empCounter = 1001;
  for (const c of collabSpecs) {
    const userId = c.email ? users[c.email] : null;
    const [created] = await db.insert(collaboratorsTable).values({
      employeeNumber: `EDO-${empCounter++}`,
      firstName: c.firstName, lastName: c.lastName,
      email: c.email, phone: `+225 07 ${Math.floor(10000000 + Math.random() * 89999999)}`,
      departmentId: deptByCode.get(c.deptCode) ?? null,
      positionId: posByCode.get(c.posCode) ?? null,
      userId, position: c.posCode, department: c.deptCode,
      hireDate: ymd(addDays(new Date(), -Math.floor(Math.random() * 1500) - 200)),
      baseSalary: c.baseSalary, employmentStatus: "active", isAvailable: true,
    } as any).returning();
    collabIds.push(created.id);
  }
  counts.collaborators = collabIds.length;

  // ─── Contrats + documents RH ───
  for (let i = 0; i < collabIds.length; i++) {
    const collab = (await db.select().from(collaboratorsTable).where(eq(collaboratorsTable.id, collabIds[i])).limit(1))[0];
    await db.insert(contractsTable).values({
      collaboratorId: collabIds[i], type: i < 6 ? "CDI" : "CDD",
      status: "active", startDate: collab.hireDate as any,
      endDate: i < 6 ? null : ymd(addDays(new Date(), 180)) as any,
      monthlySalary: collab.baseSalary, currency: "XOF",
      jobTitle: collabSpecs[i].posCode, workLocation: "Abidjan, Côte d'Ivoire",
      weeklyHours: "40", signedAt: new Date(collab.hireDate as any),
    } as any);
  }
  for (let i = 0; i < 4; i++) {
    await db.insert(hrDocumentsTable).values({
      collaboratorId: collabIds[i], type: pick(["CNI", "diplome", "contrat", "fiche_paie"], i),
      name: `Document RH ${i + 1}`, fileUrl: `https://files.edole.africa/hr/${randomUUID()}.pdf`,
    } as any);
  }
  counts.contracts = collabIds.length;

  // ─── Clients ───
  const clientSpecs = [
    { name: MARKER, industry: "BTP", email: "contact@btpvision.ci", phone: "+225 27 22 12 34 56", address: "Plateau, Abidjan, CI", status: "active" },
    { name: "Hôtel Atlantique Group", industry: "Hôtellerie", email: "achats@atlantique-group.ci", phone: "+225 27 21 33 44 55", address: "Cocody, Abidjan, CI", status: "active" },
    { name: "Société Minière du Sahel", industry: "Mines", email: "logistique@sms.ml", phone: "+223 20 22 11 22", address: "Bamako, ML", status: "active" },
    { name: "Distribution Express SA", industry: "Distribution", email: "ops@dexpress.sn", phone: "+221 33 822 44 55", address: "Dakar, SN", status: "active" },
    { name: "Cimenterie Sahel", industry: "Industrie", email: "projet@cimsahel.bf", phone: "+226 25 30 11 22", address: "Ouagadougou, BF", status: "active" },
    { name: "Téléco Côte d'Ivoire", industry: "Télécoms", email: "infra@telecoci.ci", phone: "+225 27 20 30 40 50", address: "Marcory, Abidjan, CI", status: "active" },
    { name: "Banque Régionale de l'Ouest", industry: "Finance", email: "facility@brouest.ci", phone: "+225 27 20 21 22 23", address: "Plateau, Abidjan, CI", status: "active" },
  ];
  const clientIds: string[] = [];
  for (const c of clientSpecs) {
    const [created] = await db.insert(clientsTable).values(c as any).returning();
    clientIds.push(created.id);
  }
  counts.clients = clientIds.length;

  // ─── Contacts clients ───
  for (let i = 0; i < clientIds.length; i++) {
    await db.insert(clientContactsTable).values([
      { clientId: clientIds[i], firstName: "Direction", lastName: "Générale", email: clientSpecs[i].email, phone: clientSpecs[i].phone, role: "Directeur Général", isPrimary: "true" },
      { clientId: clientIds[i], firstName: pick(["Yao", "Mariam", "Cheikh", "Awa"], i), lastName: pick(["N'Guessan", "Coulibaly", "Diop", "Touré"], i), email: `achats@${clientSpecs[i].email.split("@")[1]}`, phone: clientSpecs[i].phone, role: "Responsable Achats", isPrimary: "false" },
    ] as any);
  }
  counts.clientContacts = clientIds.length * 2;

  // ─── ACL clients ───
  await db.insert(userClientAccessTable).values(
    clientIds.map(cid => ({ userId: users["commercial@edole.africa"], clientId: cid, accessLevel: "manager", grantedById: admin.id }))
  );
  await db.insert(userClientAccessTable).values(
    clientIds.slice(0, 4).map(cid => ({ userId: users["chefchantier@edole.africa"], clientId: cid, accessLevel: "viewer", grantedById: admin.id }))
  );

  // ─── Catalogue de services ───
  const catalogSpecs = [
    { code: "ETUDE-FAISA", name: "Étude de faisabilité", category: "Études", unit: "forfait", unitPrice: "2500000" },
    { code: "CONST-GO", name: "Construction gros œuvre", category: "Construction", unit: "m²", unitPrice: "180000" },
    { code: "MAIN-PRV", name: "Maintenance préventive", category: "Maintenance", unit: "mois", unitPrice: "850000" },
    { code: "LOC-MAT", name: "Location de matériel BTP", category: "Location", unit: "jour", unitPrice: "120000" },
    { code: "SUIV-CHA", name: "Suivi de chantier", category: "Conseil", unit: "jour", unitPrice: "180000" },
    { code: "AUDIT-TEC", name: "Audit technique d'ouvrage", category: "Audit", unit: "forfait", unitPrice: "1800000" },
  ];
  const catalogIds: string[] = [];
  for (const s of catalogSpecs) {
    const exists = (await db.select().from(servicesTable).where(eq(servicesTable.code, s.code)).limit(1))[0];
    if (exists) { catalogIds.push(exists.id); continue; }
    const [created] = await db.insert(servicesTable).values({ ...s, isActive: true } as any).returning();
    catalogIds.push(created.id);
  }
  counts.catalogServices = catalogSpecs.length;

  // ─── Engagements clients (client_services) + sections ───
  const engagementSpecs = [
    { clientIdx: 0, catalogIdx: 1, name: "Construction siège — BTP Vision", isRecurring: false },
    { clientIdx: 1, catalogIdx: 2, name: "Maintenance HVAC — Hôtel Atlantique", isRecurring: true },
    { clientIdx: 2, catalogIdx: 3, name: "Location flotte engins — SMS", isRecurring: true },
    { clientIdx: 3, catalogIdx: 1, name: "Entrepôt logistique Dakar", isRecurring: false },
    { clientIdx: 4, catalogIdx: 4, name: "Suivi chantier extension Cimenterie", isRecurring: false },
    { clientIdx: 5, catalogIdx: 2, name: "Maintenance sites télécoms — Téléco CI", isRecurring: true },
    { clientIdx: 6, catalogIdx: 5, name: "Audit annuel agences — BRO", isRecurring: true },
  ];
  const engagementIds: string[] = [];
  const sectionIdsByEng: Record<string, string[]> = {};
  for (const e of engagementSpecs) {
    const [created] = await db.insert(clientServicesTable).values({
      clientId: clientIds[e.clientIdx], catalogId: catalogIds[e.catalogIdx], name: e.name,
      description: "Engagement créé pour la démonstration de la plateforme.",
      status: "active", isRecurring: e.isRecurring,
      recurrencePattern: e.isRecurring ? { frequency: "monthly", interval: 1 } as any : null,
      ownerId: users["commercial@edole.africa"],
      startDate: ymd(addDays(new Date(), -90)), endDate: ymd(addDays(new Date(), 270)),
    } as any).returning();
    engagementIds.push(created.id);
    const sectionNames = ["Préparation", "Exécution", "Livraison & contrôle"];
    const secs = await db.insert(serviceSectionsTable).values(
      sectionNames.map((n, i) => ({ clientServiceId: created.id, name: n, position: i }))
    ).returning();
    sectionIdsByEng[created.id] = secs.map(s => s.id);
  }
  counts.engagements = engagementIds.length;

  // ─── Projets ───
  const projectSpecs = [
    { name: "Siège social BTP Vision — Plateau", clientIdx: 0, status: "in_progress", progress: 35, budget: "180000000" },
    { name: "Rénovation suites Hôtel Atlantique", clientIdx: 1, status: "in_progress", progress: 60, budget: "95000000" },
    { name: "Plateforme logistique mines SMS", clientIdx: 2, status: "planning", progress: 10, budget: "240000000" },
    { name: "Entrepôt frigorifique Dakar", clientIdx: 3, status: "in_progress", progress: 45, budget: "120000000" },
    { name: "Extension four cimenterie", clientIdx: 4, status: "in_progress", progress: 25, budget: "320000000" },
    { name: "Déploiement 25 sites Téléco CI", clientIdx: 5, status: "completed", progress: 100, budget: "85000000" },
  ];
  const projectIds: string[] = [];
  for (const p of projectSpecs) {
    const [created] = await db.insert(projectsTable).values({
      name: p.name, clientId: clientIds[p.clientIdx], managerId: users["chefchantier@edole.africa"],
      status: p.status, progress: p.progress, budget: p.budget,
      startDate: ymd(addDays(new Date(), -120)), endDate: ymd(addDays(new Date(), 150)),
      description: `Projet de référence — ${p.name}`,
    } as any).returning();
    projectIds.push(created.id);
    const phases = ["Études", "Approvisionnement", "Exécution", "Réception"];
    await db.insert(projectPhasesTable).values(
      phases.map((n, i) => ({ projectId: created.id, name: n, status: i < Math.floor(p.progress / 25) ? "completed" : "pending", order: i }))
    );
  }
  counts.projects = projectIds.length;

  // ─── Affectations collaborateurs / projets ───
  for (let i = 0; i < projectIds.length; i++) {
    await db.insert(collaboratorAssignmentsTable).values({
      collaboratorId: collabIds[3], projectId: projectIds[i], role: "Chef de chantier", allocationPct: 60, status: "active",
    } as any);
    await db.insert(collaboratorAssignmentsTable).values({
      collaboratorId: collabIds[4], projectId: projectIds[i], role: "Conducteur de travaux", allocationPct: 50, status: "active",
    } as any);
  }
  counts.assignments = projectIds.length * 2;

  // ─── Tâches (mix engagements + projets, hiérarchie) ───
  const statuses = ["todo", "in_progress", "in_review", "done"];
  const priorities = ["low", "medium", "high", "urgent"];
  let taskCount = 0;
  for (let i = 0; i < engagementIds.length; i++) {
    const sections = sectionIdsByEng[engagementIds[i]];
    for (let j = 0; j < 3; j++) {
      const [parent] = await db.insert(tasksTable).values({
        title: `${engagementSpecs[i].name} — étape ${j + 1}`,
        description: "Tâche de démonstration liée à un engagement client.",
        status: pick(statuses, j), priority: pick(priorities, j),
        serviceId: engagementIds[i], sectionId: pick(sections, j),
        assigneeId: users["chefchantier@edole.africa"],
        dueDate: ymd(addDays(new Date(), 7 * (j + 1))),
      } as any).returning();
      taskCount++;
      // Sous-tâche
      await db.insert(tasksTable).values({
        title: `Sous-tâche ${j + 1}.1 — vérification`,
        status: "todo", priority: "medium",
        serviceId: engagementIds[i], sectionId: pick(sections, j),
        parentTaskId: parent.id,
        assigneeId: users["conducteur@edole.africa"],
        dueDate: ymd(addDays(new Date(), 7 * (j + 1) + 3)),
      } as any);
      taskCount++;
    }
  }
  for (let i = 0; i < projectIds.length; i++) {
    for (let j = 0; j < 3; j++) {
      await db.insert(tasksTable).values({
        title: `${projectSpecs[i].name} — lot ${j + 1}`,
        status: pick(statuses, i + j), priority: pick(priorities, j),
        projectId: projectIds[i],
        assigneeId: users["chefchantier@edole.africa"],
        dueDate: ymd(addDays(new Date(), 14 * (j + 1))),
      } as any);
      taskCount++;
    }
  }
  counts.tasks = taskCount;

  // ─── Équipement ───
  const equipCats = ["Engins de terrassement", "Levage", "Énergie", "Mesure & contrôle"];
  const catIds: string[] = [];
  for (const n of equipCats) {
    const [c] = await db.insert(equipmentCategoriesTable).values({ name: n, description: `Catégorie ${n}` } as any).returning();
    catIds.push(c.id);
  }
  const equipSpecs = [
    { name: "Pelle hydraulique CAT 320D", catIdx: 0, dailyRate: "180000", quantity: 2 },
    { name: "Chargeuse compacte Bobcat S650", catIdx: 0, dailyRate: "95000", quantity: 3 },
    { name: "Grue mobile Liebherr LTM 1030", catIdx: 1, dailyRate: "320000", quantity: 1 },
    { name: "Échafaudage tubulaire (lot 100m²)", catIdx: 1, dailyRate: "45000", quantity: 5 },
    { name: "Groupe électrogène 250 kVA", catIdx: 2, dailyRate: "85000", quantity: 4 },
    { name: "Compresseur diesel 7 bars", catIdx: 2, dailyRate: "55000", quantity: 3 },
    { name: "Niveau laser rotatif Leica", catIdx: 3, dailyRate: "25000", quantity: 6 },
    { name: "Théodolite numérique Topcon", catIdx: 3, dailyRate: "35000", quantity: 4 },
  ];
  const equipIds: string[] = [];
  for (let i = 0; i < equipSpecs.length; i++) {
    const e = equipSpecs[i];
    const [created] = await db.insert(equipmentTable).values({
      name: e.name, code: `DEMO-EQ-${1000 + i}`, categoryId: catIds[e.catIdx],
      status: "available", quantity: e.quantity, availableQuantity: e.quantity,
      dailyRate: e.dailyRate, location: "Dépôt central — Yopougon",
    } as any).returning();
    equipIds.push(created.id);
  }
  counts.equipment = equipIds.length;

  // ─── Locations + items + inspections + logistique ───
  for (let i = 0; i < 3; i++) {
    const [rental] = await db.insert(rentalsTable).values({
      referenceNumber: `DEMO-LOC-2026-${String(i + 1).padStart(4, "0")}`,
      clientId: clientIds[i + 1], status: pick(["active", "returned", "active"], i),
      startDate: ymd(addDays(new Date(), -30 + i * 5)), endDate: ymd(addDays(new Date(), 30 + i * 5)),
      totalCost: String(2_500_000 + i * 800_000),
      notes: "Location matériel pour chantier de démo.",
    } as any).returning();
    await db.insert(rentalItemsTable).values([
      { rentalId: rental.id, equipmentId: equipIds[i], quantity: 1, dailyRate: equipSpecs[i].dailyRate, subtotal: String(Number(equipSpecs[i].dailyRate) * 30) },
      { rentalId: rental.id, equipmentId: equipIds[i + 4], quantity: 1, dailyRate: equipSpecs[i + 4].dailyRate, subtotal: String(Number(equipSpecs[i + 4].dailyRate) * 30) },
    ] as any);
    await db.insert(inspectionsTable).values({
      rentalId: rental.id, type: "before", conductedById: users["chefchantier@edole.africa"],
      notes: "Matériel en bon état au départ.", hasDispute: "false",
    } as any);
    await db.insert(logisticsOperationsTable).values({
      type: pick(["delivery", "pickup"], i), status: "completed", rentalId: rental.id,
      responsibleId: users["conducteur@edole.africa"],
      address: clientSpecs[i + 1].address,
      scheduledAt: addDays(new Date(), -30 + i * 5),
      completedAt: addDays(new Date(), -29 + i * 5),
    } as any);
    await db.insert(equipmentMovementsTable).values({
      equipmentId: equipIds[i], type: "rental_out",
      fromLocation: "Dépôt central", toLocation: clientSpecs[i + 1].address,
      quantity: 1, performedById: users["conducteur@edole.africa"],
      notes: `Sortie pour location ${rental.referenceNumber}`,
    } as any);
  }
  counts.rentals = 3;

  // ─── Fournisseurs ───
  const suppliers = [
    { code: "DEMO-F001", name: "Béton Express CI", email: "ventes@betonexpress.ci", phone: "+225 27 22 50 60 70", paymentTerms: "30 jours", accountId: acc("401") },
    { code: "DEMO-F002", name: "Ferro Sahel SA", email: "commande@ferrosahel.bf", phone: "+226 25 31 22 33", paymentTerms: "45 jours", accountId: acc("401") },
    { code: "DEMO-F003", name: "Énergie Diesel Plus", email: "contact@edplus.ci", phone: "+225 27 21 11 22 33", paymentTerms: "Comptant", accountId: acc("401") },
    { code: "DEMO-F004", name: "Outillage Pro Afrique", email: "abj@outillagepro.ci", phone: "+225 27 23 44 55 66", paymentTerms: "30 jours", accountId: acc("401") },
  ];
  const supplierIds: string[] = [];
  for (const s of suppliers) {
    const [created] = await db.insert(suppliersTable).values(s as any).returning();
    supplierIds.push(created.id);
  }
  counts.suppliers = supplierIds.length;

  // ─── Factures fournisseurs + comptabilisation + paiements ───
  for (let i = 0; i < 6; i++) {
    const dt = addDays(new Date(), -60 + i * 8);
    const expense = pick(["601", "604", "605", "624"], i);
    const [sInv] = await db.insert(supplierInvoicesTable).values({
      referenceNumber: `DEMO-FF-2026-${String(i + 1).padStart(4, "0")}`,
      supplierId: pick(supplierIds, i), projectId: projectIds[i % projectIds.length],
      status: "validated", invoiceDate: ymd(dt), dueDate: ymd(addDays(dt, 30)),
      totalAmount: String(450_000 + i * 220_000), currency: "XOF",
      expenseAccountId: acc(expense), notes: "Facture fournisseur de démo.",
    } as any).returning();
    await postSupplierInvoice(sInv.id, admin.id);
    if (i < 4) {
      const [sp] = await db.insert(supplierPaymentsTable).values({
        supplierInvoiceId: sInv.id, bankAccountId: bankAccount.id,
        amount: sInv.totalAmount as any, currency: "XOF", method: "bank_transfer",
        reference: `VIR-${1000 + i}`, paidAt: addDays(dt, 20),
      } as any).returning();
      await postSupplierPayment(sp.id, admin.id);
    }
  }
  counts.supplierInvoices = 6;

  // ─── Cycle commercial : commandes → proformas → factures → paiements ───
  let invoiceCount = 0;
  for (let i = 0; i < 8; i++) {
    const clientId = clientIds[i % clientIds.length];
    const amount = 1_500_000 + (i * 850_000);
    const dt = addDays(new Date(), -50 + i * 6);

    const [order] = await db.insert(ordersTable).values({
      referenceNumber: `DEMO-BC-2026-${String(i + 1).padStart(4, "0")}`,
      clientId, status: "confirmed", totalAmount: String(amount), currency: "XOF",
      notes: "Commande de démo.",
    } as any).returning();

    const [pro] = await db.insert(proformasTable).values({
      referenceNumber: `DEMO-PRO-2026-${String(i + 1).padStart(4, "0")}`,
      orderId: order.id, clientId, status: "accepted",
      totalAmount: String(amount), currency: "XOF",
      validUntil: ymd(addDays(dt, 30)), durationDays: 30,
    } as any).returning();

    const [inv] = await db.insert(invoicesTable).values({
      referenceNumber: `DEMO-FAC-2026-${String(i + 1).padStart(4, "0")}`,
      proformaId: pro.id, clientId, status: i < 5 ? "paid" : "sent",
      totalAmount: String(amount), paidAmount: i < 5 ? String(amount) : "0",
      currency: "XOF", dueDate: ymd(addDays(dt, 30)), issuedAt: ymd(dt),
    } as any).returning();
    await postCustomerInvoice(inv.id, admin.id);
    invoiceCount++;

    if (i < 5) {
      const [pay] = await db.insert(paymentsTable).values({
        invoiceId: inv.id, amount: String(amount), currency: "XOF",
        method: pick(["bank_transfer", "mobile_money", "cheque"], i),
        reference: `RGL-${2000 + i}`, paidAt: addDays(dt, 15),
      } as any).returning();
      await postCustomerPayment(pay.id, { bankAccountId: bankAccount.id, userId: admin.id });
    }
  }
  counts.invoices = invoiceCount;

  // ─── Immobilisations ───
  for (let i = 0; i < 4; i++) {
    await db.insert(fixedAssetsTable).values({
      code: `DEMO-IMM-${100 + i}`, label: pick([
        "Véhicule utilitaire Toyota Hilux", "Mobilier de bureau direction",
        "Pelle hydraulique CAT 320D #2", "Serveur informatique principal",
      ], i),
      category: pick(["véhicule", "mobilier", "matériel", "informatique"], i),
      accountId: acc(pick(["245", "244", "241", "244"], i)),
      depreciationAccountId: acc(pick(["2845", "2844", "2841", "2844"], i)),
      expenseAccountId: acc("681"),
      acquisitionDate: ymd(addDays(new Date(), -365 - i * 90)),
      acquisitionCost: String(8_500_000 + i * 3_500_000),
      depreciationMethod: "linear", usefulLifeYears: pick([5, 10, 8, 4], i),
      status: "active",
    } as any);
  }
  counts.fixedAssets = 4;

  // ─── Budget annuel + lignes mensuelles ───
  const [budget] = await db.insert(budgetsTable).values({
    name: `[DÉMO] Budget annuel ${period.name}`, kind: "budget", fiscalPeriodId: period.id,
    scope: "company", versionNumber: 1, status: "approved",
    notes: "Budget de référence pour la démo.", createdById: admin.id,
  } as any).returning();
  const budgetAccounts: { code: string; monthly: number }[] = [
    { code: "706", monthly: 18_000_000 }, // produits
    { code: "7071", monthly: 4_500_000 },
    { code: "601", monthly: 5_500_000 },  // charges
    { code: "605", monthly: 1_200_000 },
    { code: "622", monthly: 850_000 },
    { code: "624", monthly: 650_000 },
    { code: "661", monthly: 6_500_000 },
    { code: "664", monthly: 1_300_000 },
    { code: "628", monthly: 380_000 },
  ];
  const year = period.startDate.slice(0, 4);
  const lines: any[] = [];
  for (const b of budgetAccounts) {
    for (let m = 1; m <= 12; m++) {
      const variation = 1 + ((m % 3) - 1) * 0.07;
      lines.push({
        budgetId: budget.id, accountId: acc(b.code),
        period: `${year}-${String(m).padStart(2, "0")}`,
        amount: String(Math.round(b.monthly * variation)),
      });
    }
  }
  await db.insert(budgetLinesTable).values(lines);

  const [forecast] = await db.insert(budgetsTable).values({
    name: `[DÉMO] Forecast révisé ${period.name}`, kind: "forecast", fiscalPeriodId: period.id,
    scope: "company", versionNumber: 2, status: "approved", basedOnId: budget.id,
    notes: "Forecast Q2 reflétant les écarts.", createdById: admin.id,
  } as any).returning();
  await db.insert(budgetLinesTable).values(
    lines.map(l => ({ ...l, budgetId: forecast.id, amount: String(Math.round(Number(l.amount) * 1.05)) }))
  );
  counts.budgets = 2;

  // ─── CRM : opportunités + activités ───
  const oppIds: string[] = [];
  const oppSpecs = [
    { title: "Construction parking Aéroport", clientIdx: 5, value: "85000000", stage: "proposal", probability: 60 },
    { title: "Maintenance annuelle réseau BRO", clientIdx: 6, value: "45000000", stage: "negotiation", probability: 75 },
    { title: "Réhabilitation usine Cimenterie", clientIdx: 4, value: "120000000", stage: "qualification", probability: 35 },
    { title: "Nouveaux entrepôts Distribution Express", clientIdx: 3, value: "62000000", stage: "lead", probability: 20 },
  ];
  for (const o of oppSpecs) {
    const [created] = await db.insert(opportunitiesTable).values({
      title: o.title, clientId: clientIds[o.clientIdx], stage: o.stage,
      value: o.value, currency: "XOF", probability: o.probability,
      assignedToId: users["commercial@edole.africa"],
      expectedCloseDate: ymd(addDays(new Date(), 60)),
      notes: "Opportunité de démo.",
    } as any).returning();
    oppIds.push(created.id);
  }
  for (let i = 0; i < 8; i++) {
    await db.insert(activitiesTable).values({
      type: pick(["call", "email", "meeting", "note"], i),
      subject: `Suivi ${i + 1}`, description: "Activité commerciale de démo.",
      clientId: clientIds[i % clientIds.length], opportunityId: oppIds[i % oppIds.length],
      userId: users["commercial@edole.africa"],
      scheduledAt: addDays(new Date(), -i * 2),
      completedAt: i < 5 ? addDays(new Date(), -i * 2 + 1) : null,
    } as any);
  }
  counts.opportunities = oppIds.length;

  // ─── Marketing : prospects + campagnes ───
  for (let i = 0; i < 6; i++) {
    await db.insert(prospectsTable).values({
      firstName: pick(["Jean", "Awa", "Issa", "Mariam", "Yao", "Cheikh"], i),
      lastName: pick(["Kouadio", "Diop", "Touré", "N'Guessan", "Sow", "Coulibaly"], i),
      email: `prospect${i + 1}@example.com`, phone: `+225 07 ${10000000 + i * 1234567}`,
      company: pick(["Construction Plus", "Mining Africa", "LogiServ", "Bâti Pro", "MétalCorp", "InfraBuild"], i),
      source: pick(["website", "referral", "linkedin", "salon"], i),
      status: pick(["new", "contacted", "qualified"], i),
      tags: ["démo"],
    } as any);
  }
  await db.insert(marketingCampaignsTable).values([
    {
      name: "[DÉMO] Newsletter trimestrielle Q2", channel: "email",
      subject: "Nos chantiers en cours", body: "Découvrez les réalisations EDOLE du trimestre.",
      segment: { audiences: ["clients", "prospects"] } as any,
      status: "sent", sentAt: addDays(new Date(), -10),
      recipientsCount: 142, sentCount: 138, failedCount: 4, createdBy: users["commercial@edole.africa"],
    },
    {
      name: "[DÉMO] Promotion location matériel", channel: "whatsapp",
      body: "Tarifs préférentiels sur les engins de terrassement ce mois-ci.",
      segment: { audiences: ["clients"] } as any,
      status: "scheduled", scheduledAt: addDays(new Date(), 5),
      recipientsCount: 65, sentCount: 0, failedCount: 0, createdBy: users["commercial@edole.africa"],
    },
  ] as any);
  counts.campaigns = 2;

  // ─── Documents (liés à clients/projets) ───
  const docCategories = ["contract", "quote", "invoice", "report", "other"];
  for (let i = 0; i < 8; i++) {
    await db.insert(documentsTable).values({
      name: `[DÉMO] Document ${i + 1}.pdf`,
      fileUrl: `https://files.edole.africa/demo/${randomUUID()}.pdf`,
      mimeType: "application/pdf", size: 250_000 + i * 50_000,
      category: pick(docCategories, i),
      entityType: i < 4 ? "client" : "project",
      entityId: i < 4 ? clientIds[i] : projectIds[i - 4],
      description: "Document de démonstration.", tags: ["démo"],
      uploadedBy: admin.id,
    } as any);
  }
  counts.documents = 8;

  // ─── Conversations + messages + notifications ───
  const convIds: string[] = [];
  for (let i = 0; i < 4; i++) {
    const [conv] = await db.insert(conversationsTable).values({
      title: `[DÉMO] Discussion ${projectSpecs[i].name}`,
      type: "project", projectId: projectIds[i], clientId: clientIds[projectSpecs[i].clientIdx],
      createdBy: admin.id, source: "internal",
    } as any).returning();
    convIds.push(conv.id);
    const participants = [admin.id, users["chefchantier@edole.africa"], users["commercial@edole.africa"]];
    await db.insert(conversationParticipantsTable).values(
      participants.map(uid => ({ conversationId: conv.id, userId: uid, isAdmin: uid === admin.id }))
    );
    const msgs = [
      "Bonjour, où en est-on sur la phase étude ?",
      "Le rapport est en cours de finalisation, livraison prévue cette semaine.",
      "Parfait, prévoyons une réunion de validation jeudi.",
      "Validé. J'organise la réunion.",
    ];
    for (let m = 0; m < msgs.length; m++) {
      const [msg] = await db.insert(messagesTable).values({
        conversationId: conv.id, senderId: participants[m % participants.length],
        content: msgs[m], kind: "text",
      } as any).returning();
      await db.update(conversationsTable).set({ lastMessage: msg.content, lastMessageAt: msg.createdAt }).where(eq(conversationsTable.id, conv.id));
    }
  }
  // Notifications
  for (let i = 0; i < 6; i++) {
    await db.insert(notificationsTable).values({
      userId: admin.id,
      title: pick(["Nouvelle facture", "Paiement reçu", "Tâche en retard", "Nouveau message"], i),
      body: "Notification générée pour la démo.", type: "info",
    } as any);
  }
  counts.conversations = convIds.length;

  // ─── Alertes & tickets ───
  for (let i = 0; i < 5; i++) {
    await db.insert(alertsTable).values({
      kind: pick(["invoice_overdue", "rental_return_due", "stock_low", "contract_expiring", "task_overdue"], i),
      entityType: "client", entityId: clientIds[i % clientIds.length],
      title: pick([
        "Facture en retard", "Retour location à prévoir", "Stock matériel faible",
        "Contrat à renouveler", "Tâche en retard",
      ], i),
      message: "Alerte générée pour la démo.",
      severity: pick(["info", "warning", "critical"], i),
      dueAt: addDays(new Date(), -i * 2),
      dedupKey: `demo-alert-${i}-${randomUUID()}`,
    } as any);
  }
  for (let i = 0; i < 4; i++) {
    await db.insert(ticketsTable).values({
      subject: pick([
        "Demande d'accès SIG", "Anomalie facture FAC-2026-003",
        "Demande devis maintenance", "Réclamation qualité chantier",
      ], i),
      description: "Ticket de démo pour test du module support.",
      category: pick(["support", "billing", "sales", "complaint"], i),
      priority: pick(["low", "medium", "high"], i),
      status: pick(["open", "in_progress", "resolved", "open"], i),
      createdById: users["commercial@edole.africa"],
      assigneeId: admin.id,
    } as any);
  }
  counts.alertsTickets = 9;

  return { counts, message: "Données de démo générées avec succès." };
}
