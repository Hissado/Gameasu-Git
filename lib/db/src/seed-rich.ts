/**
 * Gaméasù — Seed enrichi de démonstration.
 *
 * Objectif : ajouter du volume et du contexte togolais/ouest-africain réaliste
 * sur le seed de base (`seed.ts`), sans casser les credentials de démo
 * (`*@gameasu.tech`). Idempotent via marqueur (client « Lomé Construction SA »).
 *
 * Lancement :
 *   pnpm exec tsx lib/db/src/seed-rich.ts
 */
import { db } from "./index";
import { eq, sql } from "drizzle-orm";
import {
  usersTable,
  clientsTable, clientContactsTable,
  opportunitiesTable, activitiesTable,
  projectsTable, projectPhasesTable,
  tasksTable, taskCommentsTable,
  collaboratorsTable,
  equipmentCategoriesTable, equipmentTable,
  rentalsTable, rentalItemsTable, inspectionsTable, logisticsOperationsTable,
  ordersTable, proformasTable, invoicesTable, paymentsTable,
  conversationsTable, conversationParticipantsTable, messagesTable,
  notificationsTable,
  servicesTable,
  documentsTable,
  suppliersTable, supplierInvoicesTable,
} from "./schema";

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
const D = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const DT = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
};
const pick = <T,>(arr: T[], i: number) => arr[i % arr.length]!;
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// ─────────────────────────────────────────────────────────────────
// SEED
// ─────────────────────────────────────────────────────────────────
export async function seedRich() {
  console.log("→ Seed enrichi Gaméasù démarré...");

  // Idempotence (pré-check rapide hors transaction)
  const markerPre = await db.select().from(clientsTable).where(eq(clientsTable.name, "Lomé Construction SA")).limit(1);
  if (markerPre.length > 0) {
    console.log("✓ Seed enrichi déjà appliqué — skip.");
    return;
  }

  // Garde défensive : exige les 4 users de démo seedés par seed.ts.
  const users = await db.select().from(usersTable);
  const admin = users.find(u => u.email === "admin@gameasu.tech");
  const manager = users.find(u => u.email === "directeur@gameasu.tech");
  const commercial = users.find(u => u.email === "commercial@gameasu.tech");
  const collab = users.find(u => u.email === "collab@gameasu.tech");
  if (!admin || !manager || !commercial || !collab) {
    throw new Error(
      "Seed enrichi: utilisateurs de démo manquants (admin/manager/commercial/collab @gameasu.tech). " +
      "Exécutez d'abord `pnpm exec tsx lib/db/src/seed.ts`."
    );
  }
  const allUsers = [admin, manager, commercial, collab];

  await db.transaction(async (tx) => {
  // (Tous les inserts suivants utilisent `tx` au lieu de `db` pour garantir
  // une idempotence transactionnelle : en cas d'erreur, tout est rollback
  // et la base reste exactement dans l'état laissé par seed.ts.)
  const db = tx; // alias local — minimise la diff vs version initiale

  // ───────── CLIENTS (16 nouveaux) — Togo + Afrique de l'Ouest ─────────
  console.log("  • Clients (16 togolais/sous-régionaux)");
  const newClients = await db.insert(clientsTable).values([
    { name: "Lomé Construction SA", email: "contact@lome-construction.tg", phone: "+228 22 21 30 45", industry: "BTP & Génie civil", address: "Boulevard du Mono, Bè, Lomé", website: "https://lome-construction.tg", status: "active" },
    { name: "Port Autonome de Lomé", email: "achats@portdelome.tg", phone: "+228 22 27 47 42", industry: "Logistique portuaire", address: "Boulevard du Mono, Port, Lomé", website: "https://portdelome.tg", status: "active" },
    { name: "Cimenterie WACEM SA", email: "commercial@wacem.tg", phone: "+228 22 26 84 30", industry: "Cimenterie & Matériaux", address: "Zone industrielle, Tabligbo", website: "https://wacem.tg", status: "active" },
    { name: "CEET — Compagnie d'Énergie Électrique du Togo", email: "marches@ceet.tg", phone: "+228 22 21 80 20", industry: "Énergie & Électricité", address: "Avenue de la Libération, Lomé", website: "https://ceet.tg", status: "active" },
    { name: "Togo Telecom (Togocom)", email: "b2b@togocom.tg", phone: "+228 22 22 03 14", industry: "Télécommunications", address: "Rue de la Kara, Tokoin, Lomé", website: "https://togocom.tg", status: "active" },
    { name: "BTCI — Banque Togolaise pour le Commerce", email: "infra@btci.tg", phone: "+228 22 21 46 41", industry: "Banque & Finance", address: "Avenue Sylvanus Olympio, Lomé", website: "https://btci.tg", status: "active" },
    { name: "Brasserie BB Lomé", email: "achats@bblome.tg", phone: "+228 22 27 12 00", industry: "Agro-industrie", address: "Route d'Aného, Baguida, Lomé", website: "https://bblome.tg", status: "active" },
    { name: "Société des Mines de Kara", email: "ops@minekara.tg", phone: "+228 26 60 12 33", industry: "Mines & Carrières", address: "BP 245, Kara", website: "https://minekara.tg", status: "active" },
    { name: "Hôpital Sylvanus Olympio", email: "logistique@chu-so.tg", phone: "+228 22 21 25 01", industry: "Santé publique", address: "Boulevard Eyadéma, Tokoin, Lomé", website: "https://chu-so.tg", status: "active" },
    { name: "Université de Lomé", email: "patrimoine@univ-lome.tg", phone: "+228 22 25 41 94", industry: "Éducation supérieure", address: "Campus Universitaire, Lomé", website: "https://univ-lome.tg", status: "active" },
    { name: "ECOBANK Togo", email: "facility@ecobank.tg", phone: "+228 22 21 72 14", industry: "Banque & Finance", address: "2 Rue Koumoré, Lomé", website: "https://ecobank.com", status: "active" },
    { name: "Mairie de Lomé", email: "marches@mairie-lome.tg", phone: "+228 22 21 24 24", industry: "Collectivité publique", address: "Place de l'Indépendance, Lomé", website: "https://mairie-lome.tg", status: "active" },
    { name: "Bolloré Africa Logistics Togo", email: "togo@bollore.com", phone: "+228 22 27 02 70", industry: "Logistique & Transit", address: "Port Autonome, Lomé", status: "active" },
    { name: "SGI Bénin — Société Générale Immobilière", email: "contact@sgi-benin.bj", phone: "+229 21 30 41 50", industry: "Promotion immobilière", address: "Carré 245, Cotonou, Bénin", status: "active" },
    { name: "OCPB Burkina — Office Cotonnier", email: "achats@ocpb.bf", phone: "+226 25 30 70 22", industry: "Agro-industrie", address: "Avenue Kwame Nkrumah, Ouagadougou", status: "prospect" },
    { name: "Ghana Cocoa Board (COCOBOD) — Aflao", email: "infra@cocobod.gh", phone: "+233 30 266 4521", industry: "Agro-industrie", address: "Aflao, frontière Togo-Ghana", status: "prospect" },
  ]).returning();

  const C = newClients;
  const clientByName = (n: string) => C.find(c => c.name.startsWith(n))!;

  // ───────── CONTACTS CLIENTS ─────────
  console.log("  • Contacts clients (40)");
  await db.insert(clientContactsTable).values([
    { clientId: C[0]!.id, firstName: "Komi", lastName: "Adjété", email: "k.adjete@lome-construction.tg", phone: "+228 90 12 34 56", role: "Directeur Général", isPrimary: "true" },
    { clientId: C[0]!.id, firstName: "Akossiwa", lastName: "Mensah", email: "a.mensah@lome-construction.tg", phone: "+228 90 22 11 77", role: "Responsable Achats" },
    { clientId: C[1]!.id, firstName: "Yawo", lastName: "Apélété", email: "y.apelete@portdelome.tg", phone: "+228 91 45 22 88", role: "Directeur Technique", isPrimary: "true" },
    { clientId: C[1]!.id, firstName: "Edem", lastName: "Sossou", email: "e.sossou@portdelome.tg", phone: "+228 91 67 33 21", role: "Chef de Projet Infrastructure" },
    { clientId: C[2]!.id, firstName: "Komla", lastName: "Agbéko", email: "k.agbeko@wacem.tg", phone: "+228 92 14 56 77", role: "Directeur des Opérations", isPrimary: "true" },
    { clientId: C[2]!.id, firstName: "Sylvie", lastName: "Tchakou", email: "s.tchakou@wacem.tg", phone: "+228 92 88 11 30", role: "Responsable Maintenance" },
    { clientId: C[3]!.id, firstName: "Mawuli", lastName: "Akakpo", email: "m.akakpo@ceet.tg", phone: "+228 90 33 44 55", role: "Chef Marchés Publics", isPrimary: "true" },
    { clientId: C[3]!.id, firstName: "Afi", lastName: "Bokoé", email: "a.bokoe@ceet.tg", phone: "+228 90 11 22 33", role: "Ingénieure Réseaux" },
    { clientId: C[4]!.id, firstName: "Komi", lastName: "Lawson", email: "k.lawson@togocom.tg", phone: "+228 90 55 66 77", role: "Directeur B2B", isPrimary: "true" },
    { clientId: C[4]!.id, firstName: "Eyram", lastName: "Dossou", email: "e.dossou@togocom.tg", phone: "+228 90 77 88 99", role: "Account Manager" },
    { clientId: C[5]!.id, firstName: "Christine", lastName: "Folly", email: "c.folly@btci.tg", phone: "+228 90 21 14 56", role: "DSI", isPrimary: "true" },
    { clientId: C[5]!.id, firstName: "Yao", lastName: "Mensah", email: "y.mensah@btci.tg", phone: "+228 90 99 88 77", role: "Responsable Patrimoine" },
    { clientId: C[6]!.id, firstName: "Komlan", lastName: "Atayi", email: "k.atayi@bblome.tg", phone: "+228 92 33 22 11", role: "Directeur Industriel", isPrimary: "true" },
    { clientId: C[6]!.id, firstName: "Délali", lastName: "Anani", email: "d.anani@bblome.tg", phone: "+228 92 77 66 55", role: "Achats Techniques" },
    { clientId: C[7]!.id, firstName: "Issifou", lastName: "Tchébou", email: "i.tchebou@minekara.tg", phone: "+228 92 11 22 33", role: "Directeur d'exploitation", isPrimary: "true" },
    { clientId: C[7]!.id, firstName: "Aïcha", lastName: "Ouro-Akpo", email: "a.ouroakpo@minekara.tg", phone: "+228 92 44 55 66", role: "Responsable HSE" },
    { clientId: C[8]!.id, firstName: "Dr. Komi", lastName: "Aledji", email: "k.aledji@chu-so.tg", phone: "+228 90 88 77 66", role: "Directeur Administratif", isPrimary: "true" },
    { clientId: C[9]!.id, firstName: "Prof. Sika", lastName: "Kpotchou", email: "s.kpotchou@univ-lome.tg", phone: "+228 90 12 78 45", role: "Directeur du Patrimoine", isPrimary: "true" },
    { clientId: C[10]!.id, firstName: "Adoté", lastName: "Kossi", email: "a.kossi@ecobank.tg", phone: "+228 91 22 33 44", role: "Facility Manager", isPrimary: "true" },
    { clientId: C[11]!.id, firstName: "Adjowa", lastName: "Vovor", email: "a.vovor@mairie-lome.tg", phone: "+228 91 55 66 77", role: "Adjointe Voirie", isPrimary: "true" },
    { clientId: C[12]!.id, firstName: "Jean-Marc", lastName: "Houénou", email: "jm.houenou@bollore.com", phone: "+228 91 88 99 00", role: "Operations Manager", isPrimary: "true" },
    { clientId: C[13]!.id, firstName: "Houénoussi", lastName: "Codjia", email: "h.codjia@sgi-benin.bj", phone: "+229 97 12 34 56", role: "Directeur Travaux", isPrimary: "true" },
    { clientId: C[14]!.id, firstName: "Issouf", lastName: "Ouédraogo", email: "i.ouedraogo@ocpb.bf", phone: "+226 70 22 14 88", role: "Chef Maintenance", isPrimary: "true" },
    { clientId: C[15]!.id, firstName: "Kwame", lastName: "Asare", email: "k.asare@cocobod.gh", phone: "+233 24 555 1234", role: "Procurement Officer", isPrimary: "true" },
  ]);

  // ───────── OPPORTUNITÉS CRM (20) ─────────
  console.log("  • Opportunités (20)");
  const stages = ["lead", "qualified", "proposal", "negotiation", "won", "lost"];
  const opps = await db.insert(opportunitiesTable).values([
    { title: "Construction siège — extension R+3", clientId: C[0]!.id, stage: "negotiation", value: "185000000", probability: 65, assignedToId: commercial.id, expectedCloseDate: D(45), notes: "Devis comparatif demandé. Concurrence avec deux locaux." },
    { title: "Rénovation entrepôts portuaires zone 3", clientId: C[1]!.id, stage: "proposal", value: "320000000", probability: 55, assignedToId: commercial.id, expectedCloseDate: D(60), notes: "Visite technique réalisée. Cahier des charges reçu." },
    { title: "Maintenance lourde four cimentier #2", clientId: C[2]!.id, stage: "qualified", value: "95000000", probability: 40, assignedToId: manager.id, expectedCloseDate: D(90), notes: "Budget annuel à valider." },
    { title: "Postes HTA — extension réseau Kpalimé", clientId: C[3]!.id, stage: "won", value: "210000000", probability: 100, assignedToId: commercial.id, expectedCloseDate: D(-15), notes: "Marché attribué. Notification reçue." },
    { title: "Déploiement fibre quartier Adidogomé", clientId: C[4]!.id, stage: "proposal", value: "78000000", probability: 50, assignedToId: commercial.id, expectedCloseDate: D(30), notes: "Phase pilote 1500 ménages." },
    { title: "Rénovation agences BTCI — lot Lomé Sud", clientId: C[5]!.id, stage: "negotiation", value: "62000000", probability: 70, assignedToId: manager.id, expectedCloseDate: D(20), notes: "Conditions de paiement à ajuster." },
    { title: "Audit énergétique usine BB Lomé", clientId: C[6]!.id, stage: "lead", value: "18500000", probability: 25, assignedToId: commercial.id, expectedCloseDate: D(120), notes: "Premier contact via salon SIAL." },
    { title: "Convoyage minéralier — Kara/Lomé", clientId: C[7]!.id, stage: "qualified", value: "145000000", probability: 35, assignedToId: manager.id, expectedCloseDate: D(75), notes: "Étude de marché en cours." },
    { title: "Réhabilitation bloc opératoire CHU", clientId: C[8]!.id, stage: "won", value: "280000000", probability: 100, assignedToId: admin.id, expectedCloseDate: D(-30), notes: "Bailleur : BAD. Démarrage T2." },
    { title: "Construction amphithéâtre 500 places", clientId: C[9]!.id, stage: "proposal", value: "165000000", probability: 60, assignedToId: commercial.id, expectedCloseDate: D(40), notes: "Financement Banque Mondiale." },
    { title: "Sécurisation périmétrique agences", clientId: C[10]!.id, stage: "negotiation", value: "42000000", probability: 75, assignedToId: commercial.id, expectedCloseDate: D(15), notes: "Validation finale comité." },
    { title: "Voirie quartier Adakpamé — phase II", clientId: C[11]!.id, stage: "qualified", value: "510000000", probability: 30, assignedToId: manager.id, expectedCloseDate: D(180), notes: "Appel d'offres national à venir." },
    { title: "Entrepôt frigorifique 8000 m²", clientId: C[12]!.id, stage: "proposal", value: "385000000", probability: 55, assignedToId: commercial.id, expectedCloseDate: D(55), notes: "Conception-réalisation." },
    { title: "Résidence sécurisée 24 logements Akpakpa", clientId: C[13]!.id, stage: "lead", value: "920000000", probability: 20, assignedToId: commercial.id, expectedCloseDate: D(150), notes: "Étude foncière en cours." },
    { title: "Maintenance ginnerie cotonnière", clientId: C[14]!.id, stage: "qualified", value: "67000000", probability: 35, assignedToId: manager.id, expectedCloseDate: D(95), notes: "RDV technique programmé." },
    { title: "Centre tri cacao — Aflao", clientId: C[15]!.id, stage: "lead", value: "240000000", probability: 15, assignedToId: commercial.id, expectedCloseDate: D(200), notes: "Mission de prospection mi-année." },
    { title: "Levés topographiques zone portuaire", clientId: C[1]!.id, stage: "won", value: "32000000", probability: 100, assignedToId: commercial.id, expectedCloseDate: D(-60), notes: "Livré T1." },
    { title: "Étude géotechnique — site Tabligbo", clientId: C[2]!.id, stage: "lost", value: "14000000", probability: 0, assignedToId: commercial.id, expectedCloseDate: D(-45), notes: "Perdu sur prix. Concurrent local." },
    { title: "Fourniture matériel chantier Q2", clientId: C[0]!.id, stage: "won", value: "47500000", probability: 100, assignedToId: commercial.id, expectedCloseDate: D(-20), notes: "Commande passée et livrée." },
    { title: "Diagnostic structure hôpital — secours", clientId: C[8]!.id, stage: "proposal", value: "22000000", probability: 65, assignedToId: manager.id, expectedCloseDate: D(25), notes: "Devis envoyé semaine dernière." },
  ]).returning();

  // ───────── ACTIVITÉS CRM (60) ─────────
  console.log("  • Activités CRM (60)");
  const actTypes = ["call", "email", "meeting", "demo", "site_visit", "proposal"];
  const actData: any[] = [];
  for (let i = 0; i < 60; i++) {
    const o = opps[i % opps.length]!;
    const t = pick(actTypes, i);
    const user = pick(allUsers, i);
    const dayOffset = rand(-90, 30);
    actData.push({
      type: t,
      subject:
        t === "call" ? `Appel suivi — ${o.title.slice(0, 40)}` :
        t === "email" ? `Relance — ${o.title.slice(0, 40)}` :
        t === "meeting" ? `Réunion projet — ${o.title.slice(0, 40)}` :
        t === "demo" ? `Démo solution — ${o.title.slice(0, 40)}` :
        t === "site_visit" ? `Visite chantier — ${o.title.slice(0, 40)}` :
        `Envoi proposition — ${o.title.slice(0, 40)}`,
      description: `Activité ${t} — opportunité ${o.title}`,
      clientId: o.clientId,
      opportunityId: o.id,
      userId: user.id,
      scheduledAt: DT(dayOffset),
      completedAt: dayOffset < 0 ? DT(dayOffset) : null,
    });
  }
  await db.insert(activitiesTable).values(actData);

  // ───────── COLLABORATEURS (15 nouveaux) ─────────
  console.log("  • Collaborateurs (15 togolais)");
  const newCollabs = await db.insert(collaboratorsTable).values([
    { firstName: "Komi", lastName: "Dogbé", email: "k.dogbe@gameasu.tg", phone: "+228 90 11 22 01", position: "Directeur des Opérations", department: "Direction", hireDate: "2019-03-15", employmentStatus: "active", baseSalary: "1850000", isAvailable: true },
    { firstName: "Akossiwa", lastName: "Adzo", email: "a.adzo@gameasu.tg", phone: "+228 90 11 22 02", position: "Chef de Projet Senior", department: "Projets", hireDate: "2020-06-01", employmentStatus: "active", baseSalary: "1250000", isAvailable: false, currentProjectsCount: 2 },
    { firstName: "Yawo", lastName: "Klutsè", email: "y.klutse@gameasu.tg", phone: "+228 90 11 22 03", position: "Ingénieur Génie Civil", department: "Projets", hireDate: "2021-02-10", employmentStatus: "active", baseSalary: "850000", isAvailable: true },
    { firstName: "Edem", lastName: "Tchalla", email: "e.tchalla@gameasu.tg", phone: "+228 90 11 22 04", position: "Conducteur de Travaux", department: "Travaux", hireDate: "2018-09-20", employmentStatus: "active", baseSalary: "720000", isAvailable: false, currentProjectsCount: 3 },
    { firstName: "Afi", lastName: "Mensah", email: "afi.mensah@gameasu.tg", phone: "+228 90 11 22 05", position: "Responsable Commerciale", department: "Commercial", hireDate: "2019-11-04", employmentStatus: "active", baseSalary: "950000", isAvailable: true },
    { firstName: "Mawuli", lastName: "Ahlonkoba", email: "m.ahlonkoba@gameasu.tg", phone: "+228 90 11 22 06", position: "Comptable Senior", department: "Finance", hireDate: "2017-04-12", employmentStatus: "active", baseSalary: "780000", isAvailable: true },
    { firstName: "Sika", lastName: "Avoulété", email: "s.avoulete@gameasu.tg", phone: "+228 90 11 22 07", position: "Architecte DPLG", department: "Études", hireDate: "2020-01-15", employmentStatus: "active", baseSalary: "1100000", isAvailable: true },
    { firstName: "Komlan", lastName: "Bokovi", email: "k.bokovi@gameasu.tg", phone: "+228 90 11 22 08", position: "Chef d'Équipe Maçonnerie", department: "Travaux", hireDate: "2016-08-22", employmentStatus: "active", baseSalary: "520000", isAvailable: false, currentProjectsCount: 1 },
    { firstName: "Délali", lastName: "Sossou", email: "d.sossou@gameasu.tg", phone: "+228 90 11 22 09", position: "Assistante Administrative", department: "Administration", hireDate: "2022-03-01", employmentStatus: "active", baseSalary: "380000", isAvailable: true },
    { firstName: "Eyram", lastName: "Apélété", email: "e.apelete@gameasu.tg", phone: "+228 90 11 22 10", position: "Responsable HSE", department: "Sécurité", hireDate: "2021-07-19", employmentStatus: "active", baseSalary: "890000", isAvailable: true },
    { firstName: "Adjowa", lastName: "Vovor", email: "a.vovor@gameasu.tg", phone: "+228 90 11 22 11", position: "Chargée Marketing Digital", department: "Marketing", hireDate: "2022-09-12", employmentStatus: "active", baseSalary: "650000", isAvailable: true },
    { firstName: "Kossi", lastName: "Adjété", email: "kossi.adjete@gameasu.tg", phone: "+228 90 11 22 12", position: "Magasinier-Chef", department: "Logistique", hireDate: "2019-05-30", employmentStatus: "active", baseSalary: "450000", isAvailable: true },
    { firstName: "Yao", lastName: "Komlanvi", email: "y.komlanvi@gameasu.tg", phone: "+228 90 11 22 13", position: "Chauffeur PL", department: "Logistique", hireDate: "2018-11-04", employmentStatus: "active", baseSalary: "320000", isAvailable: false },
    { firstName: "Akouvi", lastName: "Tévi", email: "a.tevi@gameasu.tg", phone: "+228 90 11 22 14", position: "Géomètre-Topographe", department: "Études", hireDate: "2020-10-08", employmentStatus: "active", baseSalary: "780000", isAvailable: true },
    { firstName: "Senyo", lastName: "Doe", email: "s.doe@gameasu.tg", phone: "+228 90 11 22 15", position: "Stagiaire BTS Génie Civil", department: "Études", hireDate: "2025-09-01", employmentStatus: "active", baseSalary: "120000", isAvailable: true },
  ]).returning();

  // ───────── PROJETS (10 nouveaux) ─────────
  console.log("  • Projets (10)");
  const projects = await db.insert(projectsTable).values([
    { name: "Extension siège Lomé Construction R+3", description: "Construction d'une extension R+3 sur 1200 m² au siège social. Béton armé, façade aluminium, climatisation centralisée.", status: "active", clientId: C[0]!.id, managerId: manager.id, leadCollaboratorId: newCollabs[1]!.id, startDate: D(-45), endDate: D(180), progress: 28, budget: "185000000" },
    { name: "Hangars Port Autonome — Zone 3", description: "Rénovation lourde de 3 hangars de stockage zone portuaire 3. Reprise charpente, étanchéité, sols industriels.", status: "active", clientId: C[1]!.id, managerId: manager.id, leadCollaboratorId: newCollabs[3]!.id, startDate: D(-90), endDate: D(120), progress: 55, budget: "320000000" },
    { name: "Postes HTA Kpalimé — Extension réseau", description: "Pose de 4 postes HTA 20kV et raccordement BT sur 6 km. Coordination CEET.", status: "active", clientId: C[3]!.id, managerId: admin.id, leadCollaboratorId: newCollabs[2]!.id, startDate: D(-30), endDate: D(150), progress: 18, budget: "210000000" },
    { name: "Rénovation agences BTCI — Lot Sud", description: "Rénovation intérieure de 6 agences (Bè, Tokoin, Hédzranawoé, Adidogomé, Agoé, Baguida). Mobilier, électricité, climatisation.", status: "active", clientId: C[5]!.id, managerId: manager.id, leadCollaboratorId: newCollabs[6]!.id, startDate: D(-15), endDate: D(90), progress: 12, budget: "62000000" },
    { name: "Bloc opératoire CHU Sylvanus Olympio", description: "Réhabilitation complète bloc opératoire. Normes BAD. Salles, fluides médicaux, stérilisation.", status: "active", clientId: C[8]!.id, managerId: admin.id, leadCollaboratorId: newCollabs[1]!.id, startDate: D(-20), endDate: D(240), progress: 8, budget: "280000000" },
    { name: "Sécurisation périmétrique ECOBANK", description: "Installation clôtures anti-intrusion, contrôle d'accès biométrique, vidéosurveillance sur 8 agences.", status: "planning", clientId: C[10]!.id, managerId: manager.id, leadCollaboratorId: newCollabs[9]!.id, startDate: D(10), endDate: D(100), progress: 0, budget: "42000000" },
    { name: "Fourniture matériel chantier Lomé Construction Q2", description: "Livraison équipement de chantier T2 2026 : 2 grues, 4 mini-pelles, échafaudages.", status: "completed", clientId: C[0]!.id, managerId: commercial.id, leadCollaboratorId: newCollabs[11]!.id, startDate: D(-120), endDate: D(-30), progress: 100, budget: "47500000" },
    { name: "Voirie zone industrielle Adidogomé", description: "Réfection voirie 3 km, bordures, signalisation, éclairage solaire LED.", status: "active", clientId: C[11]!.id, managerId: manager.id, leadCollaboratorId: newCollabs[3]!.id, startDate: D(-60), endDate: D(60), progress: 72, budget: "98000000" },
    { name: "Diagnostic structure CHU bloc B", description: "Étude diagnostique structurelle, sondages, modélisation. Rapport et préconisations.", status: "active", clientId: C[8]!.id, managerId: manager.id, leadCollaboratorId: newCollabs[6]!.id, startDate: D(-10), endDate: D(45), progress: 35, budget: "22000000" },
    { name: "Étude faisabilité résidence Akpakpa Cotonou", description: "Étude de faisabilité résidence sécurisée 24 logements. Foncier, géotechnique, esquisses.", status: "planning", clientId: C[13]!.id, managerId: manager.id, leadCollaboratorId: newCollabs[6]!.id, startDate: D(15), endDate: D(105), progress: 0, budget: "12000000" },
  ]).returning();

  // ───────── PHASES DE PROJET (~50) ─────────
  console.log("  • Phases (~50)");
  const phaseTemplates = [
    ["Études & conception", "Préparation du chantier", "Gros œuvre", "Second œuvre", "Finitions & livraison"],
    ["Diagnostic initial", "Plans d'exécution", "Approvisionnement", "Réalisation", "Réception"],
    ["Topographie & implantation", "Terrassement", "Génie civil", "Équipements", "Mise en service"],
  ];
  const phaseRows: any[] = [];
  projects.forEach((p, i) => {
    const tpl = phaseTemplates[i % phaseTemplates.length]!;
    tpl.forEach((name, idx) => {
      const status = p.progress! >= (idx + 1) * 20 ? "completed" : p.progress! >= idx * 20 ? "in_progress" : "pending";
      phaseRows.push({ projectId: p.id, name, status, order: idx });
    });
  });
  await db.insert(projectPhasesTable).values(phaseRows);

  // ───────── TÂCHES (70+) ─────────
  console.log("  • Tâches (70+)");
  const taskTitles = [
    "Préparer dossier d'appel d'offres", "Visite technique site", "Rédaction CCTP", "Chiffrage matériaux",
    "Plans d'exécution validés", "Commande béton prêt à l'emploi", "Coulage dalle RDC", "Pose des banches",
    "Réception ferraillage", "Levé topographique complémentaire", "Étude géotechnique", "Note de calcul charpente",
    "Mobilisation équipe chantier", "Installation base vie", "Branchement provisoire CEET", "Sondages structure",
    "Devis sous-traitant peinture", "Commande menuiserie aluminium", "Pose carrelage 1er étage", "Test pression réseau",
    "Réception travaux phase 1", "Levée des réserves", "Facturation situation n°3", "PV chantier hebdomadaire",
    "Mise à jour planning Gantt", "Réunion coordination MOE", "Audit HSE mensuel", "Formation port EPI",
    "Relance fournisseur ciment", "Contrôle béton 28j",
  ];
  const priorities = ["low", "medium", "high", "urgent"];
  const statuses = ["todo", "in_progress", "review", "done"];
  const taskRows: any[] = [];
  projects.forEach((p) => {
    const n = p.progress === 100 ? 4 : rand(6, 9);
    for (let i = 0; i < n; i++) {
      const status = p.progress === 100 ? "done" : pick(statuses, i + p.name.length);
      const offset = rand(-30, 45);
      taskRows.push({
        title: `${pick(taskTitles, i + p.name.length)} — ${p.name.slice(0, 25)}`,
        description: `Tâche liée au projet ${p.name}.`,
        status,
        priority: pick(priorities, i),
        projectId: p.id,
        assigneeId: pick(allUsers, i).id,
        dueDate: D(offset),
        completedAt: status === "done" ? DT(offset - 2) : null,
      });
    }
  });
  // Tâches transversales sans projet
  for (let i = 0; i < 12; i++) {
    taskRows.push({
      title: pick([
        "Mise à jour CRM", "Reporting mensuel direction", "Renouvellement assurance flotte",
        "Audit fournisseurs T2", "Préparation conseil d'administration", "Veille appels d'offres BOAD",
        "Mise à jour grille tarifaire", "Audit RGPD données clients", "Plan formation 2026", "Inventaire annuel matériel",
        "Réunion CSE trimestrielle", "Refonte site vitrine",
      ], i),
      description: "Tâche transversale interne.",
      status: pick(statuses, i),
      priority: pick(priorities, i + 1),
      assigneeId: pick(allUsers, i).id,
      dueDate: D(rand(0, 60)),
    });
  }
  const insertedTasks = await db.insert(tasksTable).values(taskRows).returning();

  // Commentaires de tâches
  const commentRows: any[] = [];
  insertedTasks.slice(0, 30).forEach((t, i) => {
    commentRows.push({
      taskId: t.id, userId: pick(allUsers, i).id,
      content: pick([
        "Validé en réunion ce matin, je passe à l'étape suivante.",
        "Attention à bien vérifier les côtes avant exécution.",
        "Le client a demandé une variante — voir mail joint.",
        "Fournisseur confirme livraison vendredi.",
        "OK pour moi, je relance demain si pas de retour.",
        "Photos prises sur site, dispo dans le drive projet.",
      ], i),
    });
  });
  await db.insert(taskCommentsTable).values(commentRows);

  // ───────── CATÉGORIES & ÉQUIPEMENT (24 nouveaux) ─────────
  console.log("  • Équipement (24 + catégories)");
  const cats = await db.insert(equipmentCategoriesTable).values([
    { name: "Grues & levage", description: "Grues à tour, mobiles, treuils." },
    { name: "Engins TP", description: "Pelles, chargeurs, bulldozers, niveleuses." },
    { name: "Compactage", description: "Rouleaux, plaques vibrantes, dameuses." },
    { name: "Bétonnage", description: "Centrales à béton, malaxeurs, pompes." },
    { name: "Échafaudages & coffrage", description: "Tubulaires, banches, étais." },
    { name: "Outillage électroportatif", description: "Perforateurs, scies, meuleuses." },
    { name: "Manutention", description: "Chariots élévateurs, transpalettes, treuils." },
    { name: "Énergie chantier", description: "Groupes électrogènes, compresseurs, mâts d'éclairage." },
  ]).returning();

  const equipments = await db.insert(equipmentTable).values([
    { name: "Grue à tour Liebherr 132 EC-H", code: "GRUE-001", categoryId: cats[0]!.id, status: "rented", quantity: 1, availableQuantity: 0, dailyRate: "450000", location: "Chantier siège Lomé Construction" },
    { name: "Grue mobile Manitowoc 80T", code: "GRUE-002", categoryId: cats[0]!.id, status: "available", quantity: 2, availableQuantity: 2, dailyRate: "380000", location: "Dépôt Adidogomé" },
    { name: "Pelle hydraulique Caterpillar 320D", code: "PELLE-001", categoryId: cats[1]!.id, status: "rented", quantity: 3, availableQuantity: 1, dailyRate: "185000", location: "Port Autonome zone 3" },
    { name: "Chargeur Volvo L90H", code: "CHARG-001", categoryId: cats[1]!.id, status: "available", quantity: 2, availableQuantity: 2, dailyRate: "165000", location: "Dépôt Adidogomé" },
    { name: "Bulldozer Cat D6T", code: "BULL-001", categoryId: cats[1]!.id, status: "maintenance", quantity: 1, availableQuantity: 0, dailyRate: "210000", location: "Atelier Lomé" },
    { name: "Niveleuse Komatsu GD555", code: "NIV-001", categoryId: cats[1]!.id, status: "available", quantity: 1, availableQuantity: 1, dailyRate: "175000", location: "Dépôt Adidogomé" },
    { name: "Rouleau compacteur Bomag BW213", code: "COMP-001", categoryId: cats[2]!.id, status: "rented", quantity: 2, availableQuantity: 1, dailyRate: "95000", location: "Chantier voirie Adidogomé" },
    { name: "Plaque vibrante Wacker WP1550", code: "COMP-002", categoryId: cats[2]!.id, status: "available", quantity: 5, availableQuantity: 5, dailyRate: "12000", location: "Magasin central" },
    { name: "Dameuse Wacker DPU6555", code: "COMP-003", categoryId: cats[2]!.id, status: "available", quantity: 3, availableQuantity: 3, dailyRate: "18000", location: "Magasin central" },
    { name: "Centrale à béton mobile 60 m³/h", code: "BETON-001", categoryId: cats[3]!.id, status: "rented", quantity: 1, availableQuantity: 0, dailyRate: "280000", location: "Chantier siège Lomé Construction" },
    { name: "Malaxeur portatif 350L", code: "BETON-002", categoryId: cats[3]!.id, status: "available", quantity: 8, availableQuantity: 6, dailyRate: "8500", location: "Magasin central" },
    { name: "Pompe à béton Putzmeister BSA 1409", code: "BETON-003", categoryId: cats[3]!.id, status: "available", quantity: 1, availableQuantity: 1, dailyRate: "145000", location: "Dépôt Adidogomé" },
    { name: "Échafaudage multidirectionnel — lot 100 m²", code: "ECHA-001", categoryId: cats[4]!.id, status: "rented", quantity: 12, availableQuantity: 4, dailyRate: "15000", location: "Multiples chantiers" },
    { name: "Banches métalliques Hussor 3m", code: "BANCH-001", categoryId: cats[4]!.id, status: "rented", quantity: 40, availableQuantity: 12, dailyRate: "3500", location: "Chantier siège Lomé Construction" },
    { name: "Étais télescopiques 4m — lot 50", code: "ETAI-001", categoryId: cats[4]!.id, status: "available", quantity: 8, availableQuantity: 8, dailyRate: "2500", location: "Magasin central" },
    { name: "Perforateur Hilti TE 60", code: "OUT-001", categoryId: cats[5]!.id, status: "available", quantity: 6, availableQuantity: 5, dailyRate: "6500", location: "Magasin central" },
    { name: "Scie circulaire Makita 235mm", code: "OUT-002", categoryId: cats[5]!.id, status: "available", quantity: 10, availableQuantity: 9, dailyRate: "4500", location: "Magasin central" },
    { name: "Meuleuse Bosch GWS 22", code: "OUT-003", categoryId: cats[5]!.id, status: "available", quantity: 12, availableQuantity: 10, dailyRate: "3500", location: "Magasin central" },
    { name: "Chariot élévateur Toyota 3T diesel", code: "CHAR-001", categoryId: cats[6]!.id, status: "available", quantity: 2, availableQuantity: 2, dailyRate: "55000", location: "Dépôt Adidogomé" },
    { name: "Transpalette électrique Linde 1,6T", code: "CHAR-002", categoryId: cats[6]!.id, status: "available", quantity: 4, availableQuantity: 4, dailyRate: "18000", location: "Magasin central" },
    { name: "Groupe électrogène SDMO 250 kVA", code: "GE-001", categoryId: cats[7]!.id, status: "rented", quantity: 2, availableQuantity: 1, dailyRate: "85000", location: "CHU Sylvanus Olympio" },
    { name: "Groupe électrogène Cummins 100 kVA", code: "GE-002", categoryId: cats[7]!.id, status: "available", quantity: 3, availableQuantity: 3, dailyRate: "45000", location: "Dépôt Adidogomé" },
    { name: "Compresseur Atlas Copco XAS 88", code: "COMPR-001", categoryId: cats[7]!.id, status: "available", quantity: 2, availableQuantity: 2, dailyRate: "35000", location: "Magasin central" },
    { name: "Mât d'éclairage diesel 4×1000W", code: "ECL-001", categoryId: cats[7]!.id, status: "rented", quantity: 6, availableQuantity: 2, dailyRate: "22000", location: "Chantiers actifs" },
  ]).returning();

  // ───────── LOCATIONS + ITEMS + INSPECTIONS + LOGISTIQUE ─────────
  console.log("  • Locations (10) + items + inspections + logistique");
  const rentals = await db.insert(rentalsTable).values([
    { referenceNumber: "LOC-2026-0042", clientId: C[0]!.id, status: "active", startDate: D(-30), endDate: D(60), totalCost: "27000000", notes: "Chantier extension R+3" },
    { referenceNumber: "LOC-2026-0043", clientId: C[1]!.id, status: "active", startDate: D(-60), endDate: D(30), totalCost: "16650000", notes: "Hangars zone 3" },
    { referenceNumber: "LOC-2026-0044", clientId: C[11]!.id, status: "active", startDate: D(-45), endDate: D(15), totalCost: "5700000", notes: "Voirie Adidogomé" },
    { referenceNumber: "LOC-2026-0045", clientId: C[8]!.id, status: "active", startDate: D(-15), endDate: D(75), totalCost: "7650000", notes: "Groupe secours CHU" },
    { referenceNumber: "LOC-2026-0046", clientId: C[2]!.id, status: "completed", startDate: D(-120), endDate: D(-60), totalCost: "4200000", notes: "Maintenance four #2 — terminée" },
    { referenceNumber: "LOC-2026-0047", clientId: C[5]!.id, status: "pending", startDate: D(10), endDate: D(70), totalCost: "3100000", notes: "Rénovation agences — démarrage prochain" },
    { referenceNumber: "LOC-2026-0048", clientId: C[6]!.id, status: "completed", startDate: D(-180), endDate: D(-150), totalCost: "1850000", notes: "Audit énergétique — terminée" },
    { referenceNumber: "LOC-2026-0049", clientId: C[9]!.id, status: "pending", startDate: D(20), endDate: D(140), totalCost: "12400000", notes: "Construction amphithéâtre" },
    { referenceNumber: "LOC-2026-0050", clientId: C[12]!.id, status: "active", startDate: D(-7), endDate: D(45), totalCost: "5950000", notes: "Manutention entrepôt frigo" },
    { referenceNumber: "LOC-2026-0051", clientId: C[13]!.id, status: "cancelled", startDate: D(-40), endDate: D(-10), totalCost: "0", notes: "Annulé suite report projet Cotonou" },
  ]).returning();

  const rentalItemRows: any[] = [];
  rentalItemRows.push(
    { rentalId: rentals[0]!.id, equipmentId: equipments[0]!.id, quantity: 1, dailyRate: "450000", subtotal: "13500000" },
    { rentalId: rentals[0]!.id, equipmentId: equipments[9]!.id, quantity: 1, dailyRate: "280000", subtotal: "8400000" },
    { rentalId: rentals[0]!.id, equipmentId: equipments[13]!.id, quantity: 25, dailyRate: "3500", subtotal: "2625000" },
    { rentalId: rentals[1]!.id, equipmentId: equipments[2]!.id, quantity: 2, dailyRate: "185000", subtotal: "11100000" },
    { rentalId: rentals[1]!.id, equipmentId: equipments[12]!.id, quantity: 5, dailyRate: "15000", subtotal: "2250000" },
    { rentalId: rentals[2]!.id, equipmentId: equipments[6]!.id, quantity: 1, dailyRate: "95000", subtotal: "2850000" },
    { rentalId: rentals[2]!.id, equipmentId: equipments[23]!.id, quantity: 2, dailyRate: "22000", subtotal: "1320000" },
    { rentalId: rentals[3]!.id, equipmentId: equipments[20]!.id, quantity: 1, dailyRate: "85000", subtotal: "7650000" },
    { rentalId: rentals[4]!.id, equipmentId: equipments[10]!.id, quantity: 2, dailyRate: "8500", subtotal: "1020000" },
    { rentalId: rentals[4]!.id, equipmentId: equipments[15]!.id, quantity: 4, dailyRate: "6500", subtotal: "780000" },
    { rentalId: rentals[5]!.id, equipmentId: equipments[18]!.id, quantity: 1, dailyRate: "55000", subtotal: "3300000" },
    { rentalId: rentals[8]!.id, equipmentId: equipments[18]!.id, quantity: 1, dailyRate: "55000", subtotal: "2860000" },
    { rentalId: rentals[8]!.id, equipmentId: equipments[19]!.id, quantity: 2, dailyRate: "18000", subtotal: "1872000" },
  );
  await db.insert(rentalItemsTable).values(rentalItemRows);

  await db.insert(inspectionsTable).values([
    { rentalId: rentals[0]!.id, type: "pre_rental", conductedById: collab.id, notes: "Matériel en bon état, contrôle complet effectué.", hasDispute: "false" },
    { rentalId: rentals[1]!.id, type: "pre_rental", conductedById: collab.id, notes: "Pelles vérifiées, niveaux OK." },
    { rentalId: rentals[1]!.id, type: "intermediate", conductedById: collab.id, notes: "Contrôle intermédiaire mi-parcours, RAS." },
    { rentalId: rentals[4]!.id, type: "pre_rental", conductedById: collab.id, notes: "Matériel récupéré en bon état initial." },
    { rentalId: rentals[4]!.id, type: "post_rental", conductedById: collab.id, notes: "Restitution : malaxeur #2 avec usure normale. Petite caution retenue.", hasDispute: "false", retentionAmount: "45000" },
    { rentalId: rentals[6]!.id, type: "post_rental", conductedById: manager.id, notes: "Restitution sans litige.", hasDispute: "false" },
  ]);

  await db.insert(logisticsOperationsTable).values([
    { type: "delivery", status: "completed", rentalId: rentals[0]!.id, responsibleId: collab.id, address: "Boulevard du Mono, Bè, Lomé", scheduledAt: DT(-30), completedAt: DT(-30), notes: "Livraison grue tour + accessoires" },
    { type: "delivery", status: "completed", rentalId: rentals[1]!.id, responsibleId: collab.id, address: "Port Autonome zone 3, Lomé", scheduledAt: DT(-60), completedAt: DT(-60) },
    { type: "delivery", status: "completed", rentalId: rentals[2]!.id, responsibleId: collab.id, address: "Zone industrielle Adidogomé, Lomé", scheduledAt: DT(-45), completedAt: DT(-45) },
    { type: "delivery", status: "in_progress", rentalId: rentals[3]!.id, responsibleId: collab.id, address: "CHU Sylvanus Olympio, Tokoin, Lomé", scheduledAt: DT(-15), completedAt: DT(-15) },
    { type: "pickup", status: "completed", rentalId: rentals[4]!.id, responsibleId: collab.id, address: "Cimenterie WACEM, Tabligbo", scheduledAt: DT(-60), completedAt: DT(-60) },
    { type: "delivery", status: "scheduled", rentalId: rentals[5]!.id, responsibleId: collab.id, address: "Agence BTCI Hédzranawoé, Lomé", scheduledAt: DT(10) },
    { type: "pickup", status: "completed", rentalId: rentals[6]!.id, responsibleId: collab.id, address: "Usine BB Lomé, Baguida", scheduledAt: DT(-150), completedAt: DT(-150) },
    { type: "delivery", status: "scheduled", rentalId: rentals[7]!.id, responsibleId: manager.id, address: "Campus Université de Lomé", scheduledAt: DT(20) },
    { type: "delivery", status: "completed", rentalId: rentals[8]!.id, responsibleId: collab.id, address: "Entrepôt Bolloré, Port Lomé", scheduledAt: DT(-7), completedAt: DT(-7) },
  ]);

  // ───────── COMMANDES / PROFORMAS / FACTURES / PAIEMENTS ─────────
  console.log("  • Commandes / proformas / factures / paiements");
  const orders = await db.insert(ordersTable).values([
    { referenceNumber: "BC-2026-0101", clientId: C[0]!.id, status: "confirmed", totalAmount: "47500000", currency: "XOF", notes: "Fourniture matériel Q2" },
    { referenceNumber: "BC-2026-0102", clientId: C[1]!.id, status: "confirmed", totalAmount: "320000000", currency: "XOF", notes: "Hangars Port zone 3" },
    { referenceNumber: "BC-2026-0103", clientId: C[3]!.id, status: "confirmed", totalAmount: "210000000", currency: "XOF", notes: "Postes HTA Kpalimé" },
    { referenceNumber: "BC-2026-0104", clientId: C[5]!.id, status: "draft", totalAmount: "62000000", currency: "XOF", notes: "Rénovation BTCI" },
    { referenceNumber: "BC-2026-0105", clientId: C[8]!.id, status: "confirmed", totalAmount: "280000000", currency: "XOF", notes: "Bloc opératoire CHU" },
    { referenceNumber: "BC-2026-0106", clientId: C[10]!.id, status: "draft", totalAmount: "42000000", currency: "XOF", notes: "Sécurisation ECOBANK" },
    { referenceNumber: "BC-2026-0107", clientId: C[11]!.id, status: "confirmed", totalAmount: "98000000", currency: "XOF", notes: "Voirie Adidogomé" },
    { referenceNumber: "BC-2026-0108", clientId: C[8]!.id, status: "confirmed", totalAmount: "22000000", currency: "XOF", notes: "Diagnostic CHU bloc B" },
    { referenceNumber: "BC-2026-0109", clientId: C[1]!.id, status: "confirmed", totalAmount: "32000000", currency: "XOF", notes: "Levés topographiques port" },
    { referenceNumber: "BC-2026-0110", clientId: C[2]!.id, status: "confirmed", totalAmount: "4200000", currency: "XOF", notes: "Maintenance four cimentier" },
    { referenceNumber: "BC-2026-0111", clientId: C[6]!.id, status: "confirmed", totalAmount: "1850000", currency: "XOF", notes: "Audit énergétique BB" },
    { referenceNumber: "BC-2026-0112", clientId: C[12]!.id, status: "confirmed", totalAmount: "5950000", currency: "XOF", notes: "Location manutention" },
  ]).returning();

  const proformas = await db.insert(proformasTable).values(orders.map((o, i) => ({
    referenceNumber: `PRO-2026-${(2001 + i).toString()}`,
    orderId: o.id, clientId: o.clientId, status: i < 9 ? "accepted" : "sent",
    totalAmount: o.totalAmount, currency: "XOF", validUntil: D(30),
    paymentTerms: "30% à la commande, 40% à mi-parcours, 30% à la livraison",
    durationDays: 90, caution: i < 4 ? "5000000" : null,
  }))).returning();

  const invoices = await db.insert(invoicesTable).values([
    { referenceNumber: "FAC-2026-0301", proformaId: proformas[0]!.id, clientId: C[0]!.id, status: "paid", totalAmount: "47500000", paidAmount: "47500000", currency: "XOF", dueDate: D(-15), issuedAt: D(-45), notes: "Réglée par virement BTCI." },
    { referenceNumber: "FAC-2026-0302", proformaId: proformas[1]!.id, clientId: C[1]!.id, status: "partial", totalAmount: "160000000", paidAmount: "80000000", currency: "XOF", dueDate: D(15), issuedAt: D(-30), notes: "Acompte 50% reçu." },
    { referenceNumber: "FAC-2026-0303", proformaId: proformas[2]!.id, clientId: C[3]!.id, status: "partial", totalAmount: "63000000", paidAmount: "30000000", currency: "XOF", dueDate: D(20), issuedAt: D(-25) },
    { referenceNumber: "FAC-2026-0304", proformaId: proformas[4]!.id, clientId: C[8]!.id, status: "paid", totalAmount: "84000000", paidAmount: "84000000", currency: "XOF", dueDate: D(-5), issuedAt: D(-40), notes: "Avance de démarrage 30% — encaissée." },
    { referenceNumber: "FAC-2026-0305", proformaId: proformas[6]!.id, clientId: C[11]!.id, status: "paid", totalAmount: "29400000", paidAmount: "29400000", currency: "XOF", dueDate: D(-10), issuedAt: D(-50), notes: "Situation phase 1 voirie." },
    { referenceNumber: "FAC-2026-0306", proformaId: proformas[7]!.id, clientId: C[8]!.id, status: "issued", totalAmount: "22000000", paidAmount: "0", currency: "XOF", dueDate: D(25), issuedAt: D(-5) },
    { referenceNumber: "FAC-2026-0307", proformaId: proformas[8]!.id, clientId: C[1]!.id, status: "paid", totalAmount: "32000000", paidAmount: "32000000", currency: "XOF", dueDate: D(-30), issuedAt: D(-75) },
    { referenceNumber: "FAC-2026-0308", proformaId: proformas[9]!.id, clientId: C[2]!.id, status: "paid", totalAmount: "4200000", paidAmount: "4200000", currency: "XOF", dueDate: D(-90), issuedAt: D(-120) },
    { referenceNumber: "FAC-2026-0309", proformaId: proformas[10]!.id, clientId: C[6]!.id, status: "paid", totalAmount: "1850000", paidAmount: "1850000", currency: "XOF", dueDate: D(-140), issuedAt: D(-170) },
    { referenceNumber: "FAC-2026-0310", proformaId: proformas[11]!.id, clientId: C[12]!.id, status: "issued", totalAmount: "2975000", paidAmount: "0", currency: "XOF", dueDate: D(20), issuedAt: D(-2) },
    { referenceNumber: "FAC-2026-0311", proformaId: proformas[1]!.id, clientId: C[1]!.id, status: "overdue", totalAmount: "80000000", paidAmount: "0", currency: "XOF", dueDate: D(-12), issuedAt: D(-50), notes: "Relance niveau 2 envoyée." },
    { referenceNumber: "FAC-2026-0312", proformaId: proformas[2]!.id, clientId: C[3]!.id, status: "issued", totalAmount: "63000000", paidAmount: "0", currency: "XOF", dueDate: D(35), issuedAt: D(-3) },
  ]).returning();

  await db.insert(paymentsTable).values([
    { invoiceId: invoices[0]!.id, amount: "47500000", currency: "XOF", method: "bank_transfer", reference: "VIR-BTCI-20260112-4521", paidAt: DT(-15), notes: "Virement reçu" },
    { invoiceId: invoices[1]!.id, amount: "50000000", currency: "XOF", method: "bank_transfer", reference: "VIR-PAL-20260202-1180", paidAt: DT(-25), notes: "Acompte 1/2 reçu Port Autonome" },
    { invoiceId: invoices[1]!.id, amount: "30000000", currency: "XOF", method: "bank_transfer", reference: "VIR-PAL-20260315-2244", paidAt: DT(-10), notes: "Acompte 2/2" },
    { invoiceId: invoices[2]!.id, amount: "30000000", currency: "XOF", method: "bank_transfer", reference: "VIR-CEET-20260225-7891", paidAt: DT(-18), notes: "Avance CEET HTA Kpalimé" },
    { invoiceId: invoices[3]!.id, amount: "84000000", currency: "XOF", method: "bank_transfer", reference: "VIR-BAD-CHU-20260128", paidAt: DT(-32), notes: "Avance BAD 30% bloc opératoire" },
    { invoiceId: invoices[4]!.id, amount: "29400000", currency: "XOF", method: "bank_transfer", reference: "VIR-MAIRIE-LOME-20260218", paidAt: DT(-12), notes: "Situation 1 voirie" },
    { invoiceId: invoices[6]!.id, amount: "32000000", currency: "XOF", method: "bank_transfer", reference: "VIR-PAL-20251215-0078", paidAt: DT(-72), notes: "Levés topo port" },
    { invoiceId: invoices[7]!.id, amount: "4200000", currency: "XOF", method: "mobile_money", reference: "TMONEY-20251015-9921", paidAt: DT(-95), notes: "Paiement Mixx by Yas" },
    { invoiceId: invoices[8]!.id, amount: "1850000", currency: "XOF", method: "mobile_money", reference: "FLOOZ-20250920-3344", paidAt: DT(-140), notes: "Paiement Flooz BB" },
  ]);

  // ───────── CONVERSATIONS & MESSAGES ─────────
  console.log("  • Conversations & messages");
  const convs = await db.insert(conversationsTable).values([
    { title: null, type: "direct", createdBy: admin.id, lastMessage: "Reçu, je valide ce soir.", lastMessageAt: DT(-1) },
    { title: null, type: "direct", createdBy: manager.id, lastMessage: "OK pour le chantier de demain.", lastMessageAt: DT(-1) },
    { title: "Équipe Chantier Port Lomé", type: "group", createdBy: manager.id, lastMessage: "Photos partagées dans le drive.", lastMessageAt: DT(0) },
    { title: "Direction & Pilotage", type: "group", createdBy: admin.id, lastMessage: "Reporting hebdo envoyé.", lastMessageAt: DT(-2) },
    { title: "Coordination CHU Sylvanus", type: "group", createdBy: admin.id, lastMessage: "RDV confirmé jeudi 10h.", lastMessageAt: DT(0) },
    { title: "Commercial — Pipeline T2", type: "group", createdBy: commercial.id, lastMessage: "Relancer CEET aujourd'hui.", lastMessageAt: DT(-1) },
    { title: null, type: "direct", createdBy: commercial.id, lastMessage: "Merci, on en reparle demain.", lastMessageAt: DT(-3) },
    { title: "Sécurité chantier — HSE", type: "group", createdBy: admin.id, lastMessage: "Audit OK, RAS.", lastMessageAt: DT(-4) },
    { title: "Atelier matériel & maintenance", type: "group", createdBy: manager.id, lastMessage: "Bulldozer Cat D6 OK.", lastMessageAt: DT(-2) },
    { title: "Bureau d'études", type: "group", createdBy: manager.id, lastMessage: "Plans v3 transmis.", lastMessageAt: DT(-5) },
  ]).returning();

  // Participants
  const partRows: any[] = [];
  // Directs (1-on-1)
  partRows.push(
    { conversationId: convs[0]!.id, userId: admin.id, unreadCount: 0, lastReadAt: DT(-1) },
    { conversationId: convs[0]!.id, userId: manager.id, unreadCount: 1, lastReadAt: DT(-3) },
    { conversationId: convs[1]!.id, userId: manager.id, unreadCount: 0, lastReadAt: DT(-1) },
    { conversationId: convs[1]!.id, userId: collab.id, unreadCount: 2, lastReadAt: DT(-4) },
    { conversationId: convs[6]!.id, userId: commercial.id, unreadCount: 0, lastReadAt: DT(-3) },
    { conversationId: convs[6]!.id, userId: admin.id, unreadCount: 0, lastReadAt: DT(-3) },
  );
  // Groupes — tous les users dans tous les groupes
  [2, 3, 4, 5, 7, 8, 9].forEach((ci) => {
    allUsers.forEach((u, idx) => {
      partRows.push({ conversationId: convs[ci]!.id, userId: u.id, unreadCount: idx === 0 ? 0 : rand(0, 3), isAdmin: idx === 0, lastReadAt: DT(-rand(0, 4)) });
    });
  });
  await db.insert(conversationParticipantsTable).values(partRows);

  // Messages — 8 à 15 par conversation
  const msgRows: any[] = [];
  const dmTemplates: string[][] = [
    ["Salut, est-ce que la proposition pour BTCI est prête ?", "Oui, je te l'envoie d'ici midi.", "Parfait merci 👍", "On vise une signature avant le 15.", "Reçu, je valide ce soir."],
    ["Tu as eu le retour du chef chantier port ?", "Pas encore, je relance.", "OK garde-moi au courant.", "Il vient de répondre, RDV demain 9h.", "OK pour le chantier de demain."],
    ["Bonjour, devis Lomé Construction reçu ?", "Oui validé hier.", "Super, on peut lancer la commande.", "Je m'en occupe.", "Merci, on en reparle demain."],
  ];
  const groupTemplates: Record<string, string[]> = {
    chantier: ["Bonjour à tous, point chantier ce matin.", "Coulage de la dalle terminé à 11h.", "Photos prises, je partage.", "Le ferraillage de la dalle 2 démarre demain.", "Attention, livraison ciment décalée à jeudi.", "OK noté.", "Réception prévue mardi prochain.", "Photos partagées dans le drive."],
    direction: ["Reporting hebdomadaire à préparer.", "Je l'envoie vendredi 16h.", "Pensez à inclure la trésorerie.", "OK, intégré.", "Réunion conseil mardi 10h salle 1.", "Présent.", "Présente également.", "Reporting hebdo envoyé."],
    chu: ["Démarrage prévu lundi.", "Équipe mobilisée ?", "Oui, 8 ouvriers + chef de chantier.", "Plans validés par l'architecte hospitalier.", "Bon, on peut y aller.", "RDV confirmé jeudi 10h."],
    commercial: ["Pipeline T2 : 1,2 Md FCFA en cours.", "WACEM toujours en stand-by ?", "Oui, RDV mi-mars.", "CEET attribué hier 🎉", "Excellente nouvelle !", "Bravo l'équipe 👏", "Relancer CEET aujourd'hui."],
    hse: ["Audit mensuel cette semaine.", "Tous les EPI vérifiés ?", "Oui, contrôle ce matin.", "Une remarque sur le chantier port : casques manquants.", "Réglé, livraison faite.", "Audit OK, RAS."],
    atelier: ["Bulldozer Cat D6 en maintenance.", "Disponible quand ?", "Vendredi normalement.", "OK, on planifie le retour chantier.", "Pièces commandées chez Tractafric.", "Bulldozer Cat D6 OK."],
    etudes: ["Plans extension R+3 en revue.", "Quelques ajustements en cote 8.40.", "Je modifie.", "V2 envoyée.", "Bien, juste un détail sur les fondations.", "Corrigé, V3 en route.", "Plans v3 transmis."],
  };

  // DMs
  [0, 1, 6].forEach((ci, idx) => {
    const tpl = dmTemplates[idx]!;
    const pairUsers = [convs[ci]!.createdBy!, idx === 0 ? manager.id : idx === 1 ? collab.id : admin.id];
    tpl.forEach((content, mi) => {
      msgRows.push({
        conversationId: convs[ci]!.id,
        senderId: pairUsers[mi % 2]!,
        content,
        kind: "text",
        createdAt: DT(-tpl.length + mi),
      });
    });
  });
  // Groupes
  const groupMap: Array<[number, string]> = [
    [2, "chantier"], [3, "direction"], [4, "chu"], [5, "commercial"], [7, "hse"], [8, "atelier"], [9, "etudes"],
  ];
  groupMap.forEach(([ci, key]) => {
    const tpl = groupTemplates[key]!;
    tpl.forEach((content, mi) => {
      msgRows.push({
        conversationId: convs[ci]!.id,
        senderId: pick(allUsers, mi).id,
        content,
        kind: "text",
        createdAt: DT(-tpl.length + mi),
      });
    });
  });
  await db.insert(messagesTable).values(msgRows);

  // ───────── NOTIFICATIONS (40) ─────────
  console.log("  • Notifications (40)");
  const notifRows: any[] = [];
  const notifTpl = [
    { title: "Nouvelle opportunité gagnée 🎉", body: "Postes HTA Kpalimé — 210 M FCFA attribués par CEET.", type: "success" },
    { title: "Facture en retard", body: "FAC-2026-0311 — relance Port Autonome de Lomé (12 j).", type: "warning" },
    { title: "Paiement reçu", body: "Virement 80 M FCFA — Port Autonome (FAC-2026-0302).", type: "success" },
    { title: "Tâche assignée", body: "Vous êtes assigné à : Coulage dalle RDC — extension R+3.", type: "info" },
    { title: "Réunion bloc opératoire CHU", body: "Jeudi 10h — coordination travaux secondaires.", type: "info" },
    { title: "Audit HSE prévu", body: "Visite mensuelle planifiée vendredi 8h sur chantier port.", type: "info" },
    { title: "Devis accepté", body: "Proforma PRO-2026-2003 acceptée par CEET.", type: "success" },
    { title: "Stock bas — Ciment Diamond", body: "Stock central < seuil. À recommander.", type: "warning" },
    { title: "Maintenance équipement", body: "Bulldozer Cat D6T : retour atelier ce vendredi.", type: "info" },
    { title: "Inspection à programmer", body: "Restitution location LOC-2026-0048 ce mois-ci.", type: "info" },
    { title: "Anniversaire collaborateur", body: "Délali Sossou — pensez à lui souhaiter.", type: "info" },
    { title: "Nouvelle activité CRM", body: "Visite chantier programmée — Lomé Construction.", type: "info" },
    { title: "Validation requise", body: "Bon de commande BC-2026-0104 en attente.", type: "warning" },
    { title: "Tâche en retard", body: "Relance fournisseur ciment dépassée de 3 jours.", type: "warning" },
    { title: "Nouvelle facture émise", body: "FAC-2026-0312 — CEET — 63 M FCFA.", type: "info" },
    { title: "Document signé", body: "Convention de partenariat WACEM signée électroniquement.", type: "success" },
    { title: "Nouveau message", body: "Nouveau message dans Équipe Chantier Port Lomé.", type: "info" },
    { title: "Trésorerie alerte", body: "Solde compte BTCI — projection J+15 sous seuil.", type: "warning" },
    { title: "Rapport mensuel disponible", body: "Reporting mars 2026 — direction.", type: "info" },
    { title: "Audit fournisseur planifié", body: "Tractafric Motors Togo — visite 25 mars.", type: "info" },
  ];
  allUsers.forEach((u) => {
    notifTpl.slice(0, 10).forEach((n, i) => {
      notifRows.push({
        userId: u.id, title: n.title, body: n.body, type: n.type,
        isRead: i < 3 ? "false" : "true",
      });
    });
  });
  await db.insert(notificationsTable).values(notifRows);

  // ───────── SERVICES (15) ─────────
  console.log("  • Services catalogue (15)");
  await db.insert(servicesTable).values([
    { code: "SRV-001", name: "Étude technique & dimensionnement", category: "Études", unit: "jour", unitPrice: "185000", description: "Étude technique d'ouvrage par ingénieur senior." },
    { code: "SRV-002", name: "Plan architectural & permis", category: "Études", unit: "forfait", unitPrice: "2500000", description: "Plans architecturaux + dossier de permis de construire." },
    { code: "SRV-003", name: "Levé topographique", category: "Études", unit: "hectare", unitPrice: "350000", description: "Levé topographique par géomètre-expert." },
    { code: "SRV-004", name: "Étude géotechnique", category: "Études", unit: "forfait", unitPrice: "1850000", description: "Sondages + rapport géotechnique G2." },
    { code: "SRV-005", name: "Maîtrise d'œuvre", category: "Projets", unit: "%", unitPrice: "8", description: "Maîtrise d'œuvre travaux (8% du montant)." },
    { code: "SRV-006", name: "Conduite de travaux", category: "Travaux", unit: "mois", unitPrice: "1450000", description: "Conducteur de travaux dédié." },
    { code: "SRV-007", name: "Gros œuvre béton armé", category: "Travaux", unit: "m³", unitPrice: "185000", description: "Fourniture + pose béton armé." },
    { code: "SRV-008", name: "Maçonnerie agglos", category: "Travaux", unit: "m²", unitPrice: "12500", description: "Murs en agglos 15." },
    { code: "SRV-009", name: "Couverture tôle bac acier", category: "Travaux", unit: "m²", unitPrice: "18500", description: "Pose couverture tôle bac acier 0,75 mm." },
    { code: "SRV-010", name: "Carrelage grès cérame", category: "Finitions", unit: "m²", unitPrice: "22500", description: "Fourniture + pose carrelage grès cérame." },
    { code: "SRV-011", name: "Peinture intérieure", category: "Finitions", unit: "m²", unitPrice: "4500", description: "Peinture mate 2 couches après préparation." },
    { code: "SRV-012", name: "Menuiserie aluminium", category: "Finitions", unit: "m²", unitPrice: "85000", description: "Fenêtres et portes aluminium vitrage 4-12-4." },
    { code: "SRV-013", name: "Audit énergétique bâtiment", category: "Services", unit: "forfait", unitPrice: "1850000", description: "Audit énergétique norme ISO 50001." },
    { code: "SRV-014", name: "Formation HSE chantier", category: "Services", unit: "session", unitPrice: "650000", description: "Formation sécurité chantier — 1 journée." },
    { code: "SRV-015", name: "Inspection technique périodique", category: "Services", unit: "visite", unitPrice: "350000", description: "Inspection technique périodique d'ouvrage." },
  ]).onConflictDoNothing();

  // ───────── DOCUMENTS (30) ─────────
  console.log("  • Documents (30)");
  const docCats = ["contract", "invoice", "report", "plan", "photo", "certificate", "other"];
  const docRows: any[] = [];
  for (let i = 0; i < 30; i++) {
    const cat = pick(docCats, i);
    const ext = cat === "photo" ? "jpg" : cat === "plan" ? "dwg" : cat === "report" ? "pdf" : "pdf";
    const p = pick(projects, i);
    docRows.push({
      name: `${cat === "contract" ? "Contrat" : cat === "invoice" ? "Facture" : cat === "report" ? "Rapport" : cat === "plan" ? "Plan" : cat === "photo" ? "Photo" : cat === "certificate" ? "Certificat" : "Document"} ${p.name.slice(0, 25)}.${ext}`,
      fileUrl: `/uploads/docs/${cat}-${i + 1}-${Date.now()}.${ext}`,
      mimeType: ext === "jpg" ? "image/jpeg" : ext === "dwg" ? "application/acad" : "application/pdf",
      size: rand(50_000, 4_500_000),
      category: cat,
      entityType: "project",
      entityId: p.id,
      description: `Document ${cat} associé au projet ${p.name}.`,
      tags: [cat, p.status, "2026"],
      uploadedBy: pick(allUsers, i).id,
      signatureStatus: cat === "contract" ? (i % 3 === 0 ? "signed" : "pending") : "none",
      signedAt: cat === "contract" && i % 3 === 0 ? DT(-rand(5, 60)) : null,
    });
  }
  await db.insert(documentsTable).values(docRows);

  // ───────── FOURNISSEURS (8) + factures fournisseurs (12) ─────────
  console.log("  • Fournisseurs (8) + factures fournisseurs (12)");
  const sups = await db.insert(suppliersTable).values([
    { code: "F0010", name: "Tractafric Motors Togo", email: "ventes@tractafric.tg", phone: "+228 22 25 30 10", address: "Zone portuaire, Lomé", taxId: "TG0210456", paymentTerms: "30 jours" },
    { code: "F0011", name: "Cimenterie WACEM (intra-groupe)", email: "ventes@wacem.tg", phone: "+228 22 26 84 30", address: "Tabligbo", taxId: "TG0210512", paymentTerms: "45 jours" },
    { code: "F0012", name: "Diamond Cement Togo", email: "commercial@diamond.tg", phone: "+228 22 27 02 14", address: "Avédji, Lomé", paymentTerms: "30 jours" },
    { code: "F0013", name: "Société Togolaise de Sidérurgie (STS)", email: "commercial@sts.tg", phone: "+228 22 25 14 30", address: "Zone portuaire, Lomé", paymentTerms: "30 jours" },
    { code: "F0014", name: "Total Energies Marketing Togo", email: "b2b@totalenergies.tg", phone: "+228 22 23 56 10", address: "Boulevard du Mono, Lomé", paymentTerms: "30 jours" },
    { code: "F0015", name: "CFAO Motors Togo", email: "info@cfao.tg", phone: "+228 22 21 31 04", address: "Boulevard du 13 Janvier, Lomé", paymentTerms: "45 jours" },
    { code: "F0016", name: "SOBOA Carrières (granulats)", email: "ventes@soboa-carrieres.tg", phone: "+228 24 41 22 11", address: "Davié", paymentTerms: "30 jours" },
    { code: "F0017", name: "Quincaillerie Centrale du Togo", email: "info@qct.tg", phone: "+228 22 22 14 05", address: "Marché d'Adawlato, Lomé", paymentTerms: "15 jours" },
  ]).returning();

  await db.insert(supplierInvoicesTable).values([
    { referenceNumber: "FF-TRAC-2026-001", supplierId: sups[0]!.id, status: "paid", invoiceDate: D(-60), dueDate: D(-30), totalAmount: "8500000", paidAmount: "8500000", taxAmount: "1377000", notes: "Pièces détachées pelle CAT" },
    { referenceNumber: "FF-WACEM-2026-001", supplierId: sups[1]!.id, status: "paid", invoiceDate: D(-45), dueDate: D(0), totalAmount: "12400000", paidAmount: "12400000", taxAmount: "2008800", notes: "1200 sacs ciment CPJ 35" },
    { referenceNumber: "FF-DIAM-2026-001", supplierId: sups[2]!.id, status: "pending", invoiceDate: D(-15), dueDate: D(15), totalAmount: "9800000", paidAmount: "0", taxAmount: "1587600", notes: "950 sacs ciment Diamond" },
    { referenceNumber: "FF-STS-2026-001", supplierId: sups[3]!.id, status: "pending", invoiceDate: D(-10), dueDate: D(20), totalAmount: "18500000", paidAmount: "0", taxAmount: "2997000", notes: "Fers à béton TOR" },
    { referenceNumber: "FF-TOTAL-2026-003", supplierId: sups[4]!.id, status: "paid", invoiceDate: D(-30), dueDate: D(0), totalAmount: "4200000", paidAmount: "4200000", taxAmount: "680400", notes: "Carburant flotte mars" },
    { referenceNumber: "FF-TOTAL-2026-004", supplierId: sups[4]!.id, status: "pending", invoiceDate: D(-5), dueDate: D(25), totalAmount: "3800000", paidAmount: "0", taxAmount: "615600", notes: "Carburant flotte avril" },
    { referenceNumber: "FF-CFAO-2026-001", supplierId: sups[5]!.id, status: "paid", invoiceDate: D(-90), dueDate: D(-45), totalAmount: "22500000", paidAmount: "22500000", taxAmount: "3645000", notes: "Acquisition Toyota Hilux 4x4" },
    { referenceNumber: "FF-SOBOA-2026-001", supplierId: sups[6]!.id, status: "paid", invoiceDate: D(-25), dueDate: D(5), totalAmount: "5400000", paidAmount: "5400000", taxAmount: "874800", notes: "Gravier 0/15 — 180 m³" },
    { referenceNumber: "FF-SOBOA-2026-002", supplierId: sups[6]!.id, status: "pending", invoiceDate: D(-3), dueDate: D(27), totalAmount: "3200000", paidAmount: "0", taxAmount: "518400", notes: "Sable lagunaire 120 m³" },
    { referenceNumber: "FF-QCT-2026-001", supplierId: sups[7]!.id, status: "paid", invoiceDate: D(-20), dueDate: D(-5), totalAmount: "1850000", paidAmount: "1850000", taxAmount: "299700", notes: "Outillage divers" },
    { referenceNumber: "FF-QCT-2026-002", supplierId: sups[7]!.id, status: "overdue", invoiceDate: D(-50), dueDate: D(-35), totalAmount: "950000", paidAmount: "0", taxAmount: "153900", notes: "Quincaillerie — relance" },
    { referenceNumber: "FF-TRAC-2026-002", supplierId: sups[0]!.id, status: "pending", invoiceDate: D(-7), dueDate: D(23), totalAmount: "11200000", paidAmount: "0", taxAmount: "1814400", notes: "Maintenance bulldozer D6T" },
  ]);

  console.log("✓ Seed enrichi terminé avec succès.");
  console.log(`  • ${C.length} clients, ${opps.length} opportunités, ${actData.length} activités CRM`);
  console.log(`  • ${projects.length} projets, ${insertedTasks.length} tâches, ${newCollabs.length} collaborateurs`);
  console.log(`  • ${equipments.length} équipements, ${rentals.length} locations`);
  console.log(`  • ${orders.length} commandes, ${invoices.length} factures, ${convs.length} conversations`);
  console.log(`  • ${sups.length} fournisseurs, 12 factures fournisseurs, 30 documents, 40 notifications`);
  }); // fin transaction
}

// ─────────────────────────────────────────────────────────────────
// Exécution standalone
// ─────────────────────────────────────────────────────────────────
const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  seedRich()
    .then(() => { console.log("Done."); process.exit(0); })
    .catch((err) => { console.error("Erreur seed enrichi:", err); process.exit(1); });
}
