import { db } from "./index";
import {
  usersTable, clientsTable, clientContactsTable, opportunitiesTable, activitiesTable,
  projectsTable, projectPhasesTable, tasksTable, taskCommentsTable,
  collaboratorsTable, equipmentCategoriesTable, equipmentTable,
  rentalsTable, rentalItemsTable, inspectionsTable, logisticsOperationsTable,
  ordersTable, proformasTable, invoicesTable, paymentsTable,
  conversationsTable, conversationParticipantsTable, messagesTable, notificationsTable,
} from "./schema";

async function seed() {
  console.log("Seeding database...");

  // USERS
  const [admin] = await db.insert(usersTable).values({
    email: "admin@edole.africa",
    password: "admin123",
    firstName: "Jacques",
    lastName: "Mballa",
    role: "super_admin",
    phone: "+237 677 000 001",
    isClient: false,
    isActive: true,
  }).returning().catch(() => db.select().from(usersTable).limit(1));

  const [manager] = await db.insert(usersTable).values({
    email: "manager@edole.africa",
    password: "manager123",
    firstName: "Aissatou",
    lastName: "Bah",
    role: "manager",
    phone: "+237 677 000 002",
    isClient: false,
    isActive: true,
  }).returning().catch(() => db.select().from(usersTable).limit(1));

  const [commercial] = await db.insert(usersTable).values({
    email: "commercial@edole.africa",
    password: "commercial123",
    firstName: "Kofi",
    lastName: "Asante",
    role: "commercial",
    phone: "+237 677 000 003",
    isClient: false,
    isActive: true,
  }).returning().catch(() => db.select().from(usersTable).limit(1));

  const [collab1] = await db.insert(usersTable).values({
    email: "collab@edole.africa",
    password: "collab123",
    firstName: "Marie",
    lastName: "Nguema",
    role: "collaborator",
    phone: "+237 677 000 004",
    isClient: false,
    isActive: true,
  }).returning().catch(() => db.select().from(usersTable).limit(1));

  // CLIENTS
  const [client1] = await db.insert(clientsTable).values({
    name: "SOGELEC Cameroun",
    email: "contact@sogelec.cm",
    phone: "+237 222 500 100",
    industry: "Énergie & Électricité",
    address: "Boulevard du 20 Mai, Yaoundé",
    website: "https://sogelec.cm",
    status: "active",
  }).returning().catch(() => db.select().from(clientsTable).limit(1));

  const [client2] = await db.insert(clientsTable).values({
    name: "BTP Gabon SARL",
    email: "info@btpgabon.ga",
    phone: "+241 011 700 200",
    industry: "Construction & BTP",
    address: "Avenue Omar Bongo, Libreville",
    website: "https://btpgabon.ga",
    status: "active",
  }).returning().catch(() => db.select().from(clientsTable).limit(1));

  const [client3] = await db.insert(clientsTable).values({
    name: "CONLOG Côte d'Ivoire",
    email: "direction@conlog.ci",
    phone: "+225 27 20 222 333",
    industry: "Logistique & Transport",
    address: "Zone Industrielle de Vridi, Abidjan",
    website: "https://conlog.ci",
    status: "prospect",
  }).returning().catch(() => db.select().from(clientsTable).limit(1));

  const [client4] = await db.insert(clientsTable).values({
    name: "MinesCorp RDC",
    email: "ops@minescorp.cd",
    phone: "+243 81 000 5050",
    industry: "Mines & Ressources",
    address: "Avenue de la Victoire, Kinshasa",
    website: "https://minescorp.cd",
    status: "active",
  }).returning().catch(() => db.select().from(clientsTable).limit(1));

  // CONTACTS
  if (client1?.id) {
    await db.insert(clientContactsTable).values([
      { clientId: client1.id, firstName: "Pierre", lastName: "Atangana", email: "p.atangana@sogelec.cm", phone: "+237 699 111 001", role: "Directeur Général", isPrimary: "true" },
      { clientId: client1.id, firstName: "Sophie", lastName: "Owono", email: "s.owono@sogelec.cm", phone: "+237 699 111 002", role: "Responsable Achats", isPrimary: "false" },
    ]).catch(() => {});

    // OPPORTUNITIES
    const [opp1] = await db.insert(opportunitiesTable).values({
      title: "Installation réseau électrique site minier",
      clientId: client1.id,
      stage: "proposal",
      value: "45000000",
      currency: "XOF",
      probability: 65,
      assignedToId: commercial?.id,
      expectedCloseDate: "2026-06-30",
      notes: "Projet d'envergure — 3 phases de déploiement",
    }).returning().catch(() => []);

    const [opp2] = await db.insert(opportunitiesTable).values({
      title: "Maintenance équipements industriels annuelle",
      clientId: client2?.id,
      stage: "qualified",
      value: "12500000",
      currency: "XOF",
      probability: 80,
      assignedToId: commercial?.id,
      expectedCloseDate: "2026-05-15",
    }).returning().catch(() => []);

    await db.insert(opportunitiesTable).values({
      title: "Fourniture générateurs de secours",
      clientId: client3?.id,
      stage: "lead",
      value: "28000000",
      currency: "XOF",
      probability: 30,
      assignedToId: commercial?.id,
      expectedCloseDate: "2026-08-31",
    }).catch(() => {});

    await db.insert(opportunitiesTable).values({
      title: "Contrat logistique transport matériel lourd",
      clientId: client4?.id,
      stage: "negotiation",
      value: "67500000",
      currency: "XOF",
      probability: 90,
      assignedToId: manager?.id,
      expectedCloseDate: "2026-04-30",
    }).catch(() => {});

    // ACTIVITIES
    if (opp1 && opp1[0]) {
      await db.insert(activitiesTable).values([
        { type: "call", subject: "Appel de qualification", description: "Discussion sur les besoins en installation électrique", clientId: client1.id, opportunityId: opp1[0].id, scheduledAt: new Date("2026-04-10 10:00"), completedAt: new Date("2026-04-10 10:45") },
        { type: "meeting", subject: "Réunion de présentation de l'offre", description: "Présentation de la proposition technique et financière", clientId: client1.id, opportunityId: opp1[0].id, scheduledAt: new Date("2026-04-18 14:00") },
      ]).catch(() => {});
    }
  }

  // PROJECTS
  const [proj1] = await db.insert(projectsTable).values({
    name: "Déploiement réseau Sogelec Phase 1",
    description: "Installation du réseau électrique haute tension sur le site principal",
    status: "active",
    clientId: client1?.id,
    managerId: manager?.id,
    startDate: "2026-03-01",
    endDate: "2026-07-31",
    budget: "35000000",
    currency: "XOF",
    progress: 35,
  }).returning().catch(() => []);

  const [proj2] = await db.insert(projectsTable).values({
    name: "Maintenance BTP Gabon Q2",
    description: "Maintenance préventive et corrective des équipements lourds",
    status: "active",
    clientId: client2?.id,
    managerId: manager?.id,
    startDate: "2026-04-01",
    endDate: "2026-06-30",
    budget: "8750000",
    currency: "XOF",
    progress: 20,
  }).returning().catch(() => []);

  const [proj3] = await db.insert(projectsTable).values({
    name: "Audit logistique CONLOG",
    description: "Audit complet des processus logistiques et recommandations",
    status: "planning",
    clientId: client3?.id,
    managerId: admin?.id,
    startDate: "2026-05-01",
    endDate: "2026-06-15",
    budget: "5500000",
    currency: "XOF",
    progress: 0,
  }).returning().catch(() => []);

  // PHASES
  if (proj1 && proj1[0]) {
    await db.insert(projectPhasesTable).values([
      { projectId: proj1[0].id, name: "Étude préliminaire", status: "completed", startDate: "2026-03-01", endDate: "2026-03-15", order: 1 },
      { projectId: proj1[0].id, name: "Approvisionnement matériel", status: "active", startDate: "2026-03-16", endDate: "2026-04-30", order: 2 },
      { projectId: proj1[0].id, name: "Installation sur site", status: "pending", startDate: "2026-05-01", endDate: "2026-07-15", order: 3 },
      { projectId: proj1[0].id, name: "Tests & Commissioning", status: "pending", startDate: "2026-07-16", endDate: "2026-07-31", order: 4 },
    ]).catch(() => {});

    // TASKS
    await db.insert(tasksTable).values([
      { title: "Définir les spécifications techniques", description: "Rédiger le cahier des charges détaillé", status: "done", priority: "high", projectId: proj1[0].id, assigneeId: manager?.id, dueDate: "2026-03-10" },
      { title: "Commander transformateurs 630 KVA", description: "Commande urgente auprès du fournisseur ABB", status: "done", priority: "urgent", projectId: proj1[0].id, assigneeId: collab1?.id, dueDate: "2026-03-20" },
      { title: "Préparer le site de stockage", description: "Aménagement zone de stockage temporaire", status: "in_progress", priority: "medium", projectId: proj1[0].id, assigneeId: collab1?.id, dueDate: "2026-04-25" },
      { title: "Coordination avec équipe terrain", description: "Briefing équipes locales sur les procédures de sécurité", status: "in_progress", priority: "high", projectId: proj1[0].id, assigneeId: manager?.id, dueDate: "2026-04-30" },
      { title: "Rédiger rapport d'avancement Phase 1", description: "Rapport mensuel pour le client", status: "todo", priority: "medium", projectId: proj1[0].id, assigneeId: manager?.id, dueDate: "2026-05-05" },
    ]).catch(() => {});
  }

  if (proj2 && proj2[0]) {
    await db.insert(tasksTable).values([
      { title: "Inventaire équipements à maintenir", description: "Inventaire exhaustif des équipements sur site Libreville", status: "done", priority: "high", projectId: proj2[0].id, assigneeId: collab1?.id, dueDate: "2026-04-05" },
      { title: "Maintenance grue Liebherr LTM 1060", description: "Révision complète moteur et système hydraulique", status: "in_progress", priority: "urgent", projectId: proj2[0].id, assigneeId: collab1?.id, dueDate: "2026-04-22" },
      { title: "Remplacement pneus chariots élévateurs", description: "8 chariots Toyota — pneus pleins", status: "todo", priority: "medium", projectId: proj2[0].id, assigneeId: collab1?.id, dueDate: "2026-05-10" },
    ]).catch(() => {});
  }

  // Standalone tasks (no project)
  if (admin?.id) {
    await db.insert(tasksTable).values([
      { title: "Préparer présentation CA trimestrielle", description: "Slides bilan Q1 2026 pour le Conseil d'Administration", status: "in_progress", priority: "high", assigneeId: admin.id, dueDate: "2026-04-25" },
      { title: "Renouveler assurance flotte véhicules", description: "Contrat à renouveler avant expiration fin avril", status: "todo", priority: "urgent", assigneeId: admin.id, dueDate: "2026-04-28" },
      { title: "Former équipe sur le nouveau CRM", description: "Session de formation 2h avec toute l'équipe commerciale", status: "todo", priority: "medium", assigneeId: manager?.id, dueDate: "2026-05-03" },
    ]).catch(() => {});
  }

  // COLLABORATORS
  await db.insert(collaboratorsTable).values([
    { firstName: "Robert", lastName: "Essomba", email: "r.essomba@edole.africa", phone: "+237 677 200 001", position: "Technicien Électricien Senior", department: "Technique", skills: ["Électrotechnique", "HTA/HTB", "SCADA"], isAvailable: true, currentProjectsCount: 1 },
    { firstName: "Fatima", lastName: "Diallo", email: "f.diallo@edole.africa", phone: "+237 677 200 002", position: "Ingénieure Mécanique", department: "Technique", skills: ["Maintenance industrielle", "Pneumatique", "Hydraulique"], isAvailable: true, currentProjectsCount: 1 },
    { firstName: "Jean-Baptiste", lastName: "Mfoumou", email: "jb.mfoumou@edole.africa", phone: "+237 677 200 003", position: "Chef de Chantier", department: "Opérations", skills: ["Gestion de chantier", "HSE", "Coordination équipes"], isAvailable: false, currentProjectsCount: 2 },
    { firstName: "Amina", lastName: "Touré", email: "a.toure@edole.africa", phone: "+237 677 200 004", position: "Logisticienne", department: "Logistique", skills: ["Supply chain", "Douanes CEMAC", "Transport lourd"], isAvailable: true, currentProjectsCount: 0 },
    { firstName: "Olivier", lastName: "Bekono", email: "o.bekono@edole.africa", phone: "+237 677 200 005", position: "Soudeur Certifié", department: "Technique", skills: ["Soudage TIG/MIG", "Tuyauterie industrielle", "Contrôle qualité"], isAvailable: true, currentProjectsCount: 1 },
  ]).catch(() => {});

  // EQUIPMENT CATEGORIES
  const [cat1] = await db.insert(equipmentCategoriesTable).values({ name: "Grues & Levage", description: "Grues mobiles, grues à tour, palans" }).returning().catch(() => []);
  const [cat2] = await db.insert(equipmentCategoriesTable).values({ name: "Générateurs", description: "Groupes électrogènes et UPS industriels" }).returning().catch(() => []);
  const [cat3] = await db.insert(equipmentCategoriesTable).values({ name: "Véhicules Spéciaux", description: "Camions, semi-remorques, engins de chantier" }).returning().catch(() => []);
  const [cat4] = await db.insert(equipmentCategoriesTable).values({ name: "Outillage Électrique", description: "Transformateurs, armoires, câbles industriels" }).returning().catch(() => []);

  // EQUIPMENT
  const equipItems: any[] = [];
  if (cat1?.[0]) {
    const [e1] = await db.insert(equipmentTable).values({ name: "Grue Mobile Liebherr LTM 1060-3.1", code: "GRU-001", categoryId: cat1[0].id, description: "Grue mobile 60T, flèche 51m, certificat CACES", status: "available", quantity: 1, availableQuantity: 1, dailyRate: "750000", location: "Dépôt Yaoundé" }).returning().catch(() => []);
    const [e2] = await db.insert(equipmentTable).values({ name: "Grue à Flèche Grove GMK 3060L", code: "GRU-002", categoryId: cat1[0].id, description: "Grue tout-terrain 60T, configuration routière", status: "rented", quantity: 1, availableQuantity: 0, dailyRate: "850000", location: "Site BTP Gabon" }).returning().catch(() => []);
    if (e1?.[0]) equipItems.push(e1[0]);
    if (e2?.[0]) equipItems.push(e2[0]);
  }
  if (cat2?.[0]) {
    const [e3] = await db.insert(equipmentTable).values({ name: "Générateur Caterpillar C18 ACERT 750 kVA", code: "GEN-001", categoryId: cat2[0].id, description: "Groupe électrogène industriel 750 kVA, cabine insonorisée", status: "available", quantity: 2, availableQuantity: 2, dailyRate: "350000", location: "Dépôt Yaoundé" }).returning().catch(() => []);
    const [e4] = await db.insert(equipmentTable).values({ name: "Groupe Électrogène Perkins 500 kVA", code: "GEN-002", categoryId: cat2[0].id, description: "Générateur portable 500 kVA, démarrage automatique", status: "maintenance", quantity: 1, availableQuantity: 0, dailyRate: "280000", location: "Atelier Maintenance" }).returning().catch(() => []);
    if (e3?.[0]) equipItems.push(e3[0]);
    if (e4?.[0]) equipItems.push(e4[0]);
  }
  if (cat3?.[0]) {
    await db.insert(equipmentTable).values({ name: "Camion Porte-Engin MAN TGX 26.480", code: "VEH-001", categoryId: cat3[0].id, description: "Porte-engin 40T, plateau hydraulique basculant", status: "available", quantity: 1, availableQuantity: 1, dailyRate: "450000", location: "Dépôt Douala" }).catch(() => {});
    await db.insert(equipmentTable).values({ name: "Semi-remorque Plateau Lowboy 60T", code: "VEH-002", categoryId: cat3[0].id, description: "Lowboy pour transport de grues et engins lourds", status: "available", quantity: 2, availableQuantity: 2, dailyRate: "200000", location: "Dépôt Douala" }).catch(() => {});
  }
  if (cat4?.[0]) {
    await db.insert(equipmentTable).values({ name: "Transformateur ABB 630 kVA 15kV/400V", code: "TRF-001", categoryId: cat4[0].id, description: "Transformateur HTA/BT immergé huile, réseau 15kV", status: "available", quantity: 3, availableQuantity: 3, dailyRate: "180000", location: "Stock Électrique Yaoundé" }).catch(() => {});
  }

  // RENTALS
  if (equipItems.length > 0 && client2?.id) {
    const [rental1] = await db.insert(rentalsTable).values({
      referenceNumber: "RNT-20260401-001",
      clientId: client2.id,
      status: "active",
      startDate: "2026-04-01",
      endDate: "2026-05-31",
      totalCost: "51000000",
      currency: "XOF",
      notes: "Chantier route Libreville - Owendo. Livraison sur site incluse.",
    }).returning().catch(() => []);

    if (rental1?.[0] && equipItems[1]) {
      await db.insert(rentalItemsTable).values({
        rentalId: rental1[0].id,
        equipmentId: equipItems[1].id,
        quantity: 1,
        dailyRate: "850000",
        subtotal: "51000000",
      }).catch(() => {});

      await db.insert(inspectionsTable).values({
        rentalId: rental1[0].id,
        type: "pre_rental",
        notes: "État général: excellent. Tous les systèmes opérationnels. Carburant plein. Carnet entretien à jour.",
        hasDispute: "false",
        photos: ["https://placehold.co/800x600?text=Inspection+Photo+1"],
      }).catch(() => {});

      await db.insert(logisticsOperationsTable).values({
        type: "delivery",
        status: "completed",
        rentalId: rental1[0].id,
        address: "Chantier Route Libreville-Owendo, KM 12",
        scheduledAt: new Date("2026-04-01 08:00"),
        completedAt: new Date("2026-04-01 14:30"),
        notes: "Livraison effectuée sans incident. Grue en position de travail.",
        responsibleId: collab1?.id,
      }).catch(() => {});
    }
  }

  // ORDERS & FINANCIALS
  if (client1?.id) {
    const [order1] = await db.insert(ordersTable).values({
      referenceNumber: "ORD-20260315-001",
      clientId: client1.id,
      status: "confirmed",
      totalAmount: "45000000",
      currency: "XOF",
      notes: "Commande installation réseau électrique Projet Sogelec Phase 1",
    }).returning().catch(() => []);

    if (order1?.[0]) {
      const [pro1] = await db.insert(proformasTable).values({
        referenceNumber: "PRO-20260315-001",
        orderId: order1[0].id,
        clientId: client1.id,
        status: "accepted",
        totalAmount: "45000000",
        currency: "XOF",
        validUntil: "2026-05-31",
        notes: "Proforma acceptée par email le 20/03/2026",
      }).returning().catch(() => []);

      if (pro1?.[0]) {
        const [inv1] = await db.insert(invoicesTable).values({
          referenceNumber: "INV-20260401-001",
          proformaId: pro1[0].id,
          clientId: client1.id,
          status: "partial",
          totalAmount: "45000000",
          paidAmount: "22500000",
          currency: "XOF",
          dueDate: "2026-05-01",
          notes: "Facture acompte 50%",
        }).returning().catch(() => []);

        if (inv1?.[0]) {
          await db.insert(paymentsTable).values({
            invoiceId: inv1[0].id,
            amount: "22500000",
            currency: "XOF",
            method: "bank_transfer",
            reference: "VIR-SGBC-20260402-7751",
            paidAt: new Date("2026-04-02"),
            notes: "Virement reçu. Réf SGBC Cameroun.",
          }).catch(() => {});
        }
      }
    }

    const [order2] = await db.insert(ordersTable).values({
      referenceNumber: "ORD-20260402-002",
      clientId: client4?.id,
      status: "pending",
      totalAmount: "67500000",
      currency: "XOF",
      notes: "Contrat logistique transport matériel lourd RDC",
    }).returning().catch(() => []);
  }

  // CONVERSATIONS & MESSAGES
  const [convo1] = await db.insert(conversationsTable).values({
    title: "Équipe Projet Sogelec",
    type: "group",
    projectId: proj1?.[0]?.id,
    lastMessage: "Bonjour, le matériel est arrivé sur site ce matin.",
    lastMessageAt: new Date("2026-04-19 09:30"),
  }).returning().catch(() => []);

  if (convo1?.[0] && admin?.id) {
    await db.insert(conversationParticipantsTable).values([
      { conversationId: convo1[0].id, userId: admin.id },
      { conversationId: convo1[0].id, userId: manager?.id || admin.id },
    ]).catch(() => {});

    await db.insert(messagesTable).values([
      { conversationId: convo1[0].id, senderId: manager?.id || admin.id, content: "Bonjour à tous, le matériel est arrivé sur site ce matin. Début de l'installation demain à 7h." },
      { conversationId: convo1[0].id, senderId: admin.id, content: "Parfait ! Assurez-vous que toutes les mesures de sécurité HSE sont respectées." },
      { conversationId: convo1[0].id, senderId: manager?.id || admin.id, content: "Bien entendu. Les EPI ont été distribués à toute l'équipe." },
    ]).catch(() => {});
  }

  const [convo2] = await db.insert(conversationsTable).values({
    title: "Commercial - Prospects",
    type: "group",
    lastMessage: "J'ai un RDV confirmé avec CONLOG CI jeudi prochain.",
    lastMessageAt: new Date("2026-04-18 16:45"),
  }).returning().catch(() => []);

  if (convo2?.[0] && admin?.id) {
    await db.insert(conversationParticipantsTable).values([
      { conversationId: convo2[0].id, userId: admin.id },
      { conversationId: convo2[0].id, userId: commercial?.id || admin.id },
    ]).catch(() => {});

    await db.insert(messagesTable).values([
      { conversationId: convo2[0].id, senderId: commercial?.id || admin.id, content: "J'ai un RDV confirmé avec CONLOG CI jeudi prochain. Ils sont très intéressés par notre offre de générateurs." },
      { conversationId: convo2[0].id, senderId: admin.id, content: "Excellent ! Prépare une offre commerciale détaillée. Je serai disponible pour la réunion si nécessaire." },
    ]).catch(() => {});
  }

  // NOTIFICATIONS
  if (admin?.id) {
    await db.insert(notificationsTable).values([
      { userId: admin.id, type: "task_assigned", title: "Nouvelle tâche assignée", message: "La tâche 'Présentation CA trimestrielle' vous a été assignée", entityType: "task", isRead: "false" },
      { userId: admin.id, type: "opportunity_update", title: "Opportunité mise à jour", message: "L'opportunité 'Contrat logistique MinesCorp' est en phase de négociation (90%)", entityType: "opportunity", isRead: "false" },
      { userId: admin.id, type: "payment_received", title: "Paiement reçu", message: "Paiement de 22 500 000 FCFA reçu de Sogelec Cameroun (INV-20260401-001)", entityType: "invoice", isRead: "false" },
      { userId: admin.id, type: "rental_expiring", title: "Location bientôt expirée", message: "La location RNT-20260401-001 (Grue Grove) expire dans 43 jours", entityType: "rental", isRead: "true" },
      { userId: admin.id, type: "project_milestone", title: "Jalon projet atteint", message: "Phase 'Étude préliminaire' du projet Sogelec Phase 1 complétée", entityType: "project", isRead: "true" },
    ]).catch(() => {});
  }

  console.log("✅ Seeding complete!");
}

seed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
