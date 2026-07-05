/**
 * Koffi — Assistant conversationnel intelligent de Gameasu.
 *  - POST /api/assistant/ask  { question, context? }
 *
 * Koffi comprend toutes les sections de la plateforme : Pilotage, Commercial,
 * Projets & Opérations, Finance, Équipe & RH, Administration, Messagerie,
 * Inventaire, Locations, Documents, Intelligence IA, Automatisations.
 */
import { Router, type IRouter } from "express";
import {
  db, clientsTable, projectsTable, tasksTable, invoicesTable,
  collaboratorsTable, riskFlagsTable, recommendationsTable, insightsTable,
  equipmentTable, ordersTable, proformasTable, documentsTable,
  conversationsTable, paymentsTable,
  // Marketing
  marketingCampaignsTable, prospectsTable,
  // RH étendu
  contractsTable, departmentsTable, jobOffersTable,
  // Présences
  attendanceRecordsTable, attendanceFlagsTable,
  // Opérations & stock
  operationsMissionsTable, productsTable, stockMovementsTable,
} from "@workspace/db";
import { and, eq, isNull, sql, desc, inArray, ilike } from "drizzle-orm";
import { z } from "zod/v4";
import { summarize, aiAvailable } from "../lib/ai";
import { hasPermission, userAccessibleProjectIds, userAccessibleClientIds } from "../lib/rbac/permissions";
import { getCurrentOrganizationId } from "../lib/tenant";

const router: IRouter = Router();

type Intent =
  | "kpi_overview"
  | "clients"
  | "projects"
  | "tasks"
  | "finance"
  | "hr"
  | "attendance"
  | "equipment"
  | "inventory"
  | "operations"
  | "marketing"
  | "orders"
  | "intelligence"
  | "messaging"
  | "documents"
  | "approvals"
  | "search"
  | "navigation"
  | "help"
  | "unknown";

function detectIntent(q: string): Intent {
  const s = q.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // retirer les accents pour la correspondance
    .toLowerCase();

  // Help / navigation / explication d'usage
  if (/(bonjour|salut|aide|help|qui es.tu|que peux.tu|presente.toi|comment\s+(?:utiliser|fonctionne|faire|naviguer|aller|acceder|trouver|creer|ajouter|modifier|supprimer)|explique|c.est quoi|qu.est.ce|koffi)/.test(s)) return "help";
  if (/(menu|navigation|aller\s+sur|acceder\s+a|page\s+de|section|module|ou\s+(?:est|se trouve|trouver|puis.je))/.test(s)) return "navigation";

  // Intelligence & risques (priorité haute)
  if (/(risque|insight|recommandation|alerte|intelligence|cockpit|anomalie|signal|fraude|drift|irregularit)/.test(s)) return "intelligence";

  // Finance — avant kpi_overview car "chiffre" peut matcher les deux
  if (/(facture|paiement|tresorerie|cash|finance|recouvrement|impaye|encours|avoir|devis|proforma|budget|comptabilit|bilan|resultat|fiscal|taxe|fpa|prevision|chiffre.d.affaires|chiffre.affaires|revenu|recette|encaissement|marge|benefice|ca\s+(?:du|de|par|mensuel|annuel|total|global)|premier\s+client|meilleur\s+client|top\s+client|contribu|apport)/.test(s)) return "finance";

  // Marketing — avant crm/clients
  if (/(marketing|campagne|campaign|email\s+(?:blast|mass)|sms\s+(?:campagne|mass)|whatsapp\s+(?:campagne)|prospect\s+(?:converti|qualifi)|audience|template|emailing|publipostage)/.test(s)) return "marketing";

  // KPI globaux
  if (/(kpi|tableau\s+de\s+bord|vue\s+d.ensemble|globale|sante\s+(?:de|du)|activite\s+(?:de|du)|resume\s+(?:de|du)|statistique|performance\s+(?:globale|generale))/.test(s)) return "kpi_overview";

  // Commercial & clients
  if (/(client|prospect(?!\s+converti)|crm|pipeline|opportunite|lead|contact\s+(?:client|commercial)|partenaire)/.test(s)) return "clients";

  // Projets & portefeuille
  if (/(projet|chantier|phase|planning|gantt|portefeuille|workload|charge\s+(?:d.equipe|du\s+projet)|mission\s+(?:de\s+projet)|service\s+(?:projet))/.test(s)) return "projects";

  // Tâches
  if (/(tache|task|backlog|urgence(?!\s+de)|priorite|sous.tache|mention|todo|to.do)/.test(s)) return "tasks";

  // Présences & pointage (avant RH pour prioriser)
  if (/(presence|point(?:age|er|e\s|es\s|ent\s)|clock.in|clock.out|absence|conge|retard\s+(?:de|du|ce|aujourd)|anomalie\s+(?:de\s+presence|pointage)|heure\s+(?:travaill|suppl)|planning\s+(?:de\s+presence)|qui\s+(?:est|sont)\s+(?:present|absent))/.test(s)) return "attendance";

  // Opérations & missions terrain
  if (/(operation|mission\s+(?:terrain|en\s+cours|livraison|collecte|intervention)|livraison|collecte|dispatch|tournee|chauffeur|technicien\s+terrain|checklist\s+terrain|incident\s+terrain|preuve|photo\s+terrain)/.test(s)) return "operations";

  // Stock & inventaire (avant equipment)
  if (/(stock|inventaire|produit\s+(?:en\s+stock|rupture|disponible)|rupture|approvisionnement|mouvement\s+de\s+stock|bon\s+de\s+commande\s+fournisseur|achat\s+fournisseur|entree\s+stock|sortie\s+stock|niveau\s+(?:de\s+stock|minimal))/.test(s)) return "inventory";

  // Équipements & locations
  if (/(equipement|materiel|machine|parc|location\s+(?:de\s+)?(?:materiel|equipement)|inspection|locat|engin|vehicule\s+(?:parc)|qr.code)/.test(s)) return "equipment";

  // RH & ressources humaines
  if (/(rh|ressource.humaine|collaborateur|effectif|absent|contrat\s+(?:de\s+travail|cdi|cdd|expire)|paie|salaire|recrutement|offre\s+d.emploi|candidature|formation|evaluation|organigramme|poste|departement|service\s+(?:rh))/.test(s)) return "hr";

  // Messagerie
  if (/(message|messagerie|conversation|discussion|chat|mp|groupe\s+(?:de\s+discussion)|vocal|audio\s+(?:message))/.test(s)) return "messaging";

  // Documents
  if (/(document|fichier|contrat\s+(?:document|signe)|signature|archiv|bibliotheque|pdf|rapport\s+(?:document))/.test(s)) return "documents";

  // Approbations
  if (/(approbation|approuver|valider|validation|en\s+attente\s+(?:de|d.)|signer|file\s+(?:d.approbation|de\s+validation))/.test(s)) return "approvals";

  // Commandes
  if (/(commande|order|bon\s+de\s+commande|achat\s+(?:client|commande)|vente\s+(?:commande))/.test(s)) return "orders";

  // Recherche
  if (/(cherche|trouve|recherch|ou\s+est|find|localise)/.test(s)) return "search";

  return "unknown";
}

// ── Connaissance complète de l'application ────────────────────────────────────
const APP_KNOWLEDGE = `
PLATEFORME GAMEASU — GUIDE COMPLET POUR KOFFI

## Structure générale
Gameasu est un ERP SaaS B2B pour les organisations d'Afrique de l'Ouest francophone.
La navigation se fait via la barre latérale gauche, organisée en groupes :

## PILOTAGE (/)
- **Tableau de bord** (/) : KPI globaux, graphiques, tâches à venir, factures en retard
- **Briefing du jour** (/briefing) : Résumé exécutif généré par IA chaque matin. Narrative + tâches en retard + factures impayées + risques + recommandations
- **Cockpit IA** (/intelligence) : Centre d'intelligence — insights, recommandations, risques, résumés exécutifs. 4 onglets avec actions (marquer lu, épingler, ignorer, résoudre, appliquer)
- **Approbations** (/approvals) : File de validation centralisée — devis brouillons, factures à émettre, documents en attente de signature, contrats expirant, opportunités à clôturer

## COMMERCIAL
- **Pipeline & opportunités** (/crm) : Kanban CRM avec stages (qualification, proposition, négociation, closing). Voir les opportunités, les faire avancer, créer des activités
- **Clients** (/clients) : Fiches clients complètes, historique, contacts, projets associés
- **Calculateur tarifaire** (/pricing) : Simulateur de prix et marges
- **Devis / Proformas** (/proformas) : Création et gestion des devis. Statuts : brouillon → envoyé → accepté → facturé
- **Commandes** (/orders) : Bons de commande clients
- **Factures** (/invoices) : Facturation, suivi des paiements, relances. Statuts : brouillon → envoyée → partielle → payée
- **Encaissements** (/payments) : Saisie et suivi des paiements reçus
- **Avoirs** (/credit-notes) : Notes de crédit et remboursements
- **Marketing** (/marketing) : Campagnes et actions commerciales

## PROJETS & OPÉRATIONS
- **Projets** (/projects) : Liste et détail des projets. Chaque projet a des phases, des tâches, un budget, un RAG status (rouge/orange/vert), un Gantt
- **Portefeuille** (/portfolio) : Vue grille multi-projets avec statut RAG
- **Charge d'équipe** (/workload) : Heatmap des collaborateurs par semaine, pour voir qui est disponible
- **Tâches** (/tasks) : Hub de toutes les tâches. Sous-tâches, @mentions, récurrence, priorités, commentaires
- **Missions & services** (/services) : Engagements clients récurrents ou ponctuels
- **Opérations & logistique** (/operations) : Centre de commande opérationnel, livraisons, enlèvements
- **Parc & équipements** (/equipment) : Inventaire du matériel, catégories, QR codes, états
- **Produits & stock** (/inventory) : Stocks de produits, mouvements d'entrée/sortie, alertes de rupture
- **Locations & inspections** (/rentals) : Gestion des locations de matériel. États des lieux avant/après
- **Documents** (/documents) : Bibliothèque documentaire, signatures électroniques, IA sur les documents

## FINANCE
- **Comptabilité** (/accounting) : Plan comptable SYSCOHADA, saisie d'écritures, grand livre, bilan, compte de résultat, rapprochement bancaire
- **Planification financière** (/fpa) : Budgets versionnés, forecast vs réalisé, variance, projections fin d'année, exports Excel
- **Rapports & analytique** (/reports) : Tableaux de bord analytiques, rapports personnalisés

## ÉQUIPE & COMMUNICATION
- **Équipe & RH** (/hr) : Gestion des ressources humaines — contrats, postes, départements, paie, recrutement, évaluations, formations
- **Collaborateurs** (/collaborators) : Fiches collaborateurs, profils, compétences
- **Présences & pointage** (/attendance) : Gestion des présences, absences, congés
- **Messagerie** (/messaging) : Hub conversationnel — messages texte/image/vidéo/audio/fichier, réactions emoji, réponses citées, présence temps réel, appels
- **Appels** (/calls) : Historique des appels WebRTC

## ADMINISTRATION
- **Console admin** (/admin) : Gestion des utilisateurs, rôles, permissions
- **Automatisations** (/automations) : Règles d'automatisation — déclencheurs, conditions, actions
- **Abonnement & facturation** (/billing) : Plans (Starter 4 000 FCFA/Business 7 000 FCFA/Premium 10 000 FCFA TTC/util/mois — Personnalisée sur devis), remises périodicité (−10 %/−15 %/−20 %), modules activés, historique de facturation
- **Paramètres de l'espace** (/workspace-settings) : Configuration de l'organisation, logo, devise, fuseau horaire
- **Support** (/tickets) : Tickets de support et demandes d'aide

## ACTIONS COURANTES
- Créer un client : aller dans Clients → bouton "Nouveau client"
- Créer un projet : Projets → bouton "Nouveau projet"
- Créer une tâche : Tâches → bouton "Nouvelle tâche", ou depuis le détail d'un projet
- Créer un devis : Devis/Proformas → "Nouveau devis" → sélectionner client → ajouter lignes → envoyer
- Créer une facture : depuis un devis accepté ou directement dans Factures
- Saisir un paiement : Encaissements → "Nouveau paiement" → lier à la facture
- Ajouter un collaborateur : Collaborateurs → "Nouveau collaborateur"
- Voir les tâches urgentes : Tâches → filtre priorité "Urgente"
- Voir les factures impayées : Factures → filtre statut "En retard"
- Générer un résumé IA : Cockpit IA → onglet "Résumés exécutifs" → "Générer"

## DEVISE & LOCALISATION
Toutes les sommes sont en FCFA (Franc CFA — XOF). La plateforme est en français.

## CONNEXION & RÔLES
Rôles disponibles : Super Admin, Admin, Manager, Commercial, Collaborateur, Comptable, Client.
Chaque rôle a des permissions différentes sur les modules.
`;

async function buildContext(intent: Intent, userId: string, q: string): Promise<{ text: string; citations: Array<{ label: string; url: string }> }> {
  const citations: Array<{ label: string; url: string }> = [];
  const lines: string[] = [];

  const clientIds = await userAccessibleClientIds(userId);
  const projectIds = await userAccessibleProjectIds(userId);
  const orgId = await getCurrentOrganizationId(userId);

  // ── Navigation / aide générale → on passe le knowledge base ──────────────────
  if (intent === "help" || intent === "navigation") {
    lines.push(APP_KNOWLEDGE);
    citations.push({ label: "Tableau de bord", url: "/" });
    citations.push({ label: "Projets", url: "/projects" });
    citations.push({ label: "CRM", url: "/crm" });
    return { text: lines.join("\n"), citations };
  }

  // ── KPI globaux ───────────────────────────────────────────────────────────────
  if (intent === "kpi_overview" || intent === "unknown") {
    try {
      const clientConds = [isNull(clientsTable.deletedAt)];
      if (clientIds?.length) clientConds.push(inArray(clientsTable.id, clientIds));
      const [clientCount] = await db.select({ c: sql<number>`count(*)::int` }).from(clientsTable).where(and(...clientConds));

      const projConds = [isNull(projectsTable.deletedAt)];
      if (projectIds?.length) projConds.push(inArray(projectsTable.id, projectIds));
      const [projCount] = await db.select({ c: sql<number>`count(*)::int` }).from(projectsTable).where(and(...projConds));
      const [activeProj] = await db.select({ c: sql<number>`count(*)::int` }).from(projectsTable).where(and(...projConds, sql`${projectsTable.status} = 'active'`));

      const taskConds = [isNull(tasksTable.deletedAt)];
      if (projectIds?.length) taskConds.push(inArray(tasksTable.projectId, projectIds));
      const [openTasks] = await db.select({ c: sql<number>`count(*)::int` }).from(tasksTable).where(and(...taskConds, sql`${tasksTable.status} not in ('done','completed','cancelled')`));
      const [urgentTasks] = await db.select({ c: sql<number>`count(*)::int` }).from(tasksTable).where(and(...taskConds, sql`${tasksTable.status} not in ('done','completed','cancelled')`, eq(tasksTable.priority, "urgent")));

      lines.push(`KPI : ${clientCount?.c ?? 0} clients, ${activeProj?.c ?? 0} projets actifs (${projCount?.c ?? 0} total), ${openTasks?.c ?? 0} tâches ouvertes dont ${urgentTasks?.c ?? 0} urgentes.`);
      citations.push({ label: "Tableau de bord", url: "/" });
    } catch { /* ignore */ }
  }

  // ── Clients ───────────────────────────────────────────────────────────────────
  if (intent === "clients" || intent === "kpi_overview") {
    try {
      const conds = [isNull(clientsTable.deletedAt)];
      if (clientIds && clientIds.length) conds.push(inArray(clientsTable.id, clientIds));
      const rows = await db.select({ id: clientsTable.id, name: clientsTable.name, industry: clientsTable.industry, status: clientsTable.status })
        .from(clientsTable).where(and(...conds)).orderBy(desc(clientsTable.createdAt)).limit(6);
      if (rows.length) {
        lines.push("Derniers clients : " + rows.map((r) => `${r.name} (${r.status || "actif"})`).join(", ") + ".");
        // Citations individuelles uniquement pour l'intent "clients" pour éviter les noms de données de test
        if (intent === "clients") {
          rows.slice(0, 3).forEach((r) => citations.push({ label: r.name, url: `/clients/${r.id}` }));
        }
        citations.push({ label: "Tous les clients", url: "/clients" });
      }
    } catch { /* ignore */ }
  }

  // ── Projets ───────────────────────────────────────────────────────────────────
  if (intent === "projects") {
    try {
      const conds = [isNull(projectsTable.deletedAt)];
      if (projectIds && projectIds.length) conds.push(inArray(projectsTable.id, projectIds));
      const rows = await db.select({ id: projectsTable.id, name: projectsTable.name, status: projectsTable.status, progress: projectsTable.progress, budget: projectsTable.budget })
        .from(projectsTable).where(and(...conds)).orderBy(desc(projectsTable.updatedAt)).limit(6);
      lines.push("Projets actifs : " + rows.map((r) => `${r.name} (${r.status}, ${r.progress ?? 0}%)`).join(", "));
      rows.slice(0, 3).forEach((r) => citations.push({ label: r.name, url: `/projects/${r.id}` }));
      citations.push({ label: "Tous les projets", url: "/projects" });
    } catch { /* ignore */ }
  }

  // ── Tâches ────────────────────────────────────────────────────────────────────
  if (intent === "tasks") {
    try {
      const conds: any[] = [isNull(tasksTable.deletedAt), sql`${tasksTable.status} not in ('done','completed','cancelled')`];
      if (projectIds && projectIds.length) conds.push(inArray(tasksTable.projectId, projectIds));
      const rows = await db.select({ id: tasksTable.id, title: tasksTable.title, status: tasksTable.status, priority: tasksTable.priority, dueDate: tasksTable.dueDate })
        .from(tasksTable).where(and(...conds)).orderBy(desc(tasksTable.priority)).limit(8);
      const today = new Date().toISOString().slice(0, 10);
      const overdue = rows.filter(r => r.dueDate && r.dueDate < today);
      lines.push(`${rows.length} tâche(s) ouvertes dont ${overdue.length} en retard. Top : ` + rows.slice(0, 5).map((r) => `« ${r.title} » (${r.priority ?? "normal"}, échéance ${r.dueDate ?? "non définie"})`).join("; "));
      citations.push({ label: "Tâches", url: "/tasks" });
    } catch { /* ignore */ }
  }

  // ── Finance ───────────────────────────────────────────────────────────────────
  if (intent === "finance" && await hasPermission(userId, "accounting.read")) {
    try {
      const fmtFCFA = (n: number) => Math.round(n).toLocaleString("fr-FR") + " FCFA";

      // Factures en retard
      const overdueConds = [
        sql`${invoicesTable.status} not in ('draft','paid','cancelled')`,
        sql`${invoicesTable.dueDate} is not null`,
        sql`${invoicesTable.dueDate}::date < now()::date`,
      ];
      if (clientIds && clientIds.length) overdueConds.push(inArray(invoicesTable.clientId, clientIds));
      const overdue = (clientIds && clientIds.length === 0) ? [] : await db.select({
        id: invoicesTable.id, ref: invoicesTable.referenceNumber, total: invoicesTable.totalAmount, paid: invoicesTable.paidAmount,
      }).from(invoicesTable).where(and(...overdueConds)).limit(5);
      const totalOverdue = overdue.reduce((s, r) => s + (Number(r.total) - Number(r.paid ?? 0)), 0);

      // CA du mois en cours
      const [caThisMonth] = await db.select({ total: sql<number>`coalesce(sum(amount),0)::bigint` })
        .from(paymentsTable).where(sql`date_trunc('month', paid_at) = date_trunc('month', now())`);

      // CA du mois précédent
      const [caLastMonth] = await db.select({ total: sql<number>`coalesce(sum(amount),0)::bigint` })
        .from(paymentsTable).where(sql`date_trunc('month', paid_at) = date_trunc('month', now() - interval '1 month')`);

      // CA YTD
      const [caYtd] = await db.select({ total: sql<number>`coalesce(sum(amount),0)::bigint` })
        .from(paymentsTable).where(sql`date_part('year', paid_at) = date_part('year', now())`);

      // Top clients par CA (via paiements reçus → factures → clients)
      const topClientsRows = await db.execute(sql`
        SELECT c.name, coalesce(sum(p.amount), 0) AS total_paid
        FROM payments p
        JOIN invoices i ON i.id = p.invoice_id
        JOIN clients c ON c.id = i.client_id
        WHERE c.deleted_at IS NULL
        GROUP BY c.id, c.name
        ORDER BY total_paid DESC
        LIMIT 5
      `);
      const topClients = topClientsRows as unknown as { name: string; total_paid: string }[];

      const [draftCount] = await db.select({ c: sql<number>`count(*)::int` }).from(proformasTable).where(eq(proformasTable.status, "draft"));
      const [orderCount] = await db.select({ c: sql<number>`count(*)::int` }).from(ordersTable).where(isNull(ordersTable.deletedAt));

      lines.push(
        `Finance : ` +
        `CA mois en cours = ${fmtFCFA(Number(caThisMonth?.total ?? 0))}. ` +
        `CA mois précédent = ${fmtFCFA(Number(caLastMonth?.total ?? 0))}. ` +
        `CA YTD = ${fmtFCFA(Number(caYtd?.total ?? 0))}. ` +
        `${overdue.length} facture(s) en retard (encours impayé : ${fmtFCFA(totalOverdue)}). ` +
        `${draftCount?.c ?? 0} devis en brouillon. ${orderCount?.c ?? 0} commandes.`
      );

      if (topClients.length) {
        lines.push(
          `Top clients par CA (année en cours) : ` +
          topClients.map((c, i) => `${i + 1}. ${c.name} (${fmtFCFA(Number(c.total_paid))})`).join(" | ")
        );
      }

      citations.push({ label: "Factures", url: "/invoices" });
      citations.push({ label: "Encaissements", url: "/payments" });
      citations.push({ label: "Planification financière", url: "/fpa" });
      citations.push({ label: "Clients", url: "/clients" });
    } catch { /* ignore */ }
  }

  // ── Équipements & locations ───────────────────────────────────────────────────
  if (intent === "equipment") {
    try {
      const [eqTotal] = await db.select({ c: sql<number>`count(*)::int` }).from(equipmentTable).where(isNull(equipmentTable.deletedAt));
      const [eqAvail] = await db.select({ c: sql<number>`count(*)::int` }).from(equipmentTable).where(and(isNull(equipmentTable.deletedAt), eq(equipmentTable.status, "available")));
      const [eqRented] = await db.select({ c: sql<number>`count(*)::int` }).from(equipmentTable).where(and(isNull(equipmentTable.deletedAt), eq(equipmentTable.status, "rented")));
      const [eqMaint] = await db.select({ c: sql<number>`count(*)::int` }).from(equipmentTable).where(and(isNull(equipmentTable.deletedAt), eq(equipmentTable.status, "maintenance")));
      lines.push(`Parc & équipements : ${eqTotal?.c ?? 0} équipements total — ${eqAvail?.c ?? 0} disponibles, ${eqRented?.c ?? 0} en location, ${eqMaint?.c ?? 0} en maintenance.`);
      citations.push({ label: "Parc & équipements", url: "/equipment" });
      citations.push({ label: "Locations", url: "/rentals" });
      citations.push({ label: "Produits & stock", url: "/inventory" });
    } catch { /* ignore */ }
  }

  // ── Inventaire & stock ────────────────────────────────────────────────────────
  if (intent === "inventory") {
    try {
      const [prodTotal] = await db.select({ c: sql<number>`count(*)::int` }).from(productsTable).where(isNull(productsTable.deletedAt));
      // Produits dont le stock calculé (somme des mouvements) est en dessous du seuil min
      const lowStockRows = await db.execute(sql`
        SELECT p.name, p.sku, p.min_stock,
               coalesce(sum(sm.quantity), 0) AS current_stock
        FROM products p
        LEFT JOIN stock_movements sm ON sm.product_id = p.id
        WHERE p.deleted_at IS NULL
        GROUP BY p.id, p.name, p.sku, p.min_stock
        HAVING coalesce(sum(sm.quantity), 0) <= p.min_stock
        ORDER BY (coalesce(sum(sm.quantity), 0) - p.min_stock) ASC
        LIMIT 8
      `);
      const lowStock = (lowStockRows as unknown as { name: string; sku: string; current_stock: string; min_stock: string }[]);
      const [mvtCount] = await db.select({ c: sql<number>`count(*)::int` }).from(stockMovementsTable);
      lines.push(`Stock & inventaire : ${prodTotal?.c ?? 0} produits référencés, ${mvtCount?.c ?? 0} mouvements enregistrés.`);
      if (lowStock.length > 0) {
        lines.push(`Produits en rupture ou sous seuil minimal (${lowStock.length}) : ` +
          lowStock.map(p => `${p.name} (SKU: ${p.sku}, stock: ${Number(p.current_stock).toFixed(0)}, min: ${Number(p.min_stock).toFixed(0)})`).join(" | "));
      }
      citations.push({ label: "Produits & stock", url: "/inventory" });
    } catch { /* ignore */ }
  }

  // ── Marketing & campagnes ─────────────────────────────────────────────────────
  if (intent === "marketing" && orgId) {
    try {
      const campaigns = await db.select({
        name: marketingCampaignsTable.name,
        channel: marketingCampaignsTable.channel,
        status: marketingCampaignsTable.status,
      }).from(marketingCampaignsTable)
        .where(eq(marketingCampaignsTable.organizationId, orgId))
        .orderBy(desc(marketingCampaignsTable.createdAt)).limit(8);

      const [prospCount] = await db.select({ c: sql<number>`count(*)::int` })
        .from(prospectsTable).where(eq(prospectsTable.organizationId, orgId));

      const byStatus = campaigns.reduce<Record<string, number>>((acc, c) => {
        acc[c.status] = (acc[c.status] ?? 0) + 1; return acc;
      }, {});

      lines.push(
        `Marketing : ${campaigns.length} campagne(s) — ` +
        Object.entries(byStatus).map(([s, n]) => `${n} ${s}`).join(", ") +
        `. ${prospCount?.c ?? 0} prospect(s) dans le CRM.`
      );
      if (campaigns.length) {
        lines.push("Campagnes : " + campaigns.slice(0, 5).map(c => `« ${c.name} » (${c.channel}, ${c.status})`).join(" | "));
      }
      citations.push({ label: "Marketing", url: "/marketing" });
      citations.push({ label: "CRM & pipeline", url: "/crm" });
    } catch { /* ignore */ }
  }

  // ── Opérations terrain ────────────────────────────────────────────────────────
  if (intent === "operations" && orgId && await hasPermission(userId, "operations.view")) {
    try {
      const missions = await db.select({
        title: operationsMissionsTable.title,
        kind: operationsMissionsTable.kind,
        status: operationsMissionsTable.status,
        priority: operationsMissionsTable.priority,
      }).from(operationsMissionsTable)
        .where(eq(operationsMissionsTable.organizationId, orgId))
        .orderBy(desc(operationsMissionsTable.createdAt)).limit(8);

      const byStatus = missions.reduce<Record<string, number>>((acc, m) => {
        acc[m.status] = (acc[m.status] ?? 0) + 1; return acc;
      }, {});
      const urgent = missions.filter(m => m.priority === "urgent" || m.priority === "high");

      lines.push(
        `Opérations terrain : ${missions.length} mission(s) — ` +
        Object.entries(byStatus).map(([s, n]) => `${n} ${s}`).join(", ") + "."
      );
      if (urgent.length) {
        lines.push(`Missions urgentes/haute priorité : ` + urgent.slice(0, 3).map(m => `« ${m.title} » (${m.kind}, ${m.status})`).join(" | "));
      }
      citations.push({ label: "Opérations & logistique", url: "/operations" });
    } catch { /* ignore */ }
  }

  // ── Présences & pointage ──────────────────────────────────────────────────────
  if (intent === "attendance" && orgId && await hasPermission(userId, "attendance.view")) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [clockInsToday] = await db.select({ c: sql<number>`count(*)::int` })
        .from(attendanceRecordsTable)
        .where(and(
          eq(attendanceRecordsTable.organizationId, orgId),
          eq(attendanceRecordsTable.kind, "clock_in"),
          sql`occurred_at::date = ${today}::date`,
        ));

      const flags = await db.select({
        kind: attendanceFlagsTable.kind,
        severity: attendanceFlagsTable.severity,
        workDate: attendanceFlagsTable.workDate,
      }).from(attendanceFlagsTable)
        .where(and(
          eq(attendanceFlagsTable.organizationId, orgId),
          sql`work_date >= (now() - interval '7 days')::date`,
        ))
        .orderBy(desc(attendanceFlagsTable.workDate)).limit(8);

      lines.push(`Présences aujourd'hui : ${clockInsToday?.c ?? 0} pointage(s) d'entrée enregistrés.`);
      if (flags.length) {
        const byKind = flags.reduce<Record<string, number>>((acc, f) => {
          acc[f.kind] = (acc[f.kind] ?? 0) + 1; return acc;
        }, {});
        lines.push(`Anomalies de présence (7 derniers jours) : ` +
          Object.entries(byKind).map(([k, n]) => `${n} ${k.replace(/_/g, " ")}`).join(", ") + ".");
      }
      citations.push({ label: "Présences & pointage", url: "/attendance" });
      citations.push({ label: "Équipe & RH", url: "/hr" });
    } catch { /* ignore */ }
  }

  // ── Intelligence ──────────────────────────────────────────────────────────────
  if (intent === "intelligence" && orgId && await hasPermission(userId, "ai.view_risk_flags")) {
    try {
      const risks = await db.select({ severity: riskFlagsTable.severity, title: riskFlagsTable.title })
        .from(riskFlagsTable).where(and(eq(riskFlagsTable.organizationId, orgId), eq(riskFlagsTable.isResolved, false)))
        .orderBy(desc(riskFlagsTable.createdAt)).limit(5);
      const recos = await db.select({ title: recommendationsTable.title, priority: recommendationsTable.priority })
        .from(recommendationsTable).where(and(eq(recommendationsTable.organizationId, orgId), eq(recommendationsTable.isApplied, false), eq(recommendationsTable.isDismissed, false)))
        .limit(3);
      const insights = await db.select({ title: insightsTable.title, severity: insightsTable.severity })
        .from(insightsTable).where(and(eq(insightsTable.organizationId, orgId), eq(insightsTable.isDismissed, false)))
        .orderBy(desc(insightsTable.createdAt)).limit(5);

      if (risks.length) lines.push("Risques ouverts : " + risks.map(r => `[${r.severity}] ${r.title}`).join(" | "));
      if (recos.length) lines.push("Recommandations actives : " + recos.map(r => `${r.title} (${r.priority ?? ""})`).join(" / "));
      if (insights.length) lines.push("Insights récents : " + insights.map(i => i.title).join(" / "));
      citations.push({ label: "Cockpit IA", url: "/intelligence" });
    } catch { /* ignore */ }
  }

  // ── RH & équipe ───────────────────────────────────────────────────────────────
  if (intent === "hr" && await hasPermission(userId, "hr.read")) {
    try {
      const [active] = await db.select({ c: sql<number>`count(*)::int` })
        .from(collaboratorsTable).where(and(isNull(collaboratorsTable.deletedAt), eq(collaboratorsTable.employmentStatus, "active")));
      const [onLeave] = await db.select({ c: sql<number>`count(*)::int` })
        .from(collaboratorsTable).where(and(isNull(collaboratorsTable.deletedAt), eq(collaboratorsTable.employmentStatus, "on_leave")));

      // Contrats expirant dans les 30 prochains jours
      const [expiringContracts] = await db.select({ c: sql<number>`count(*)::int` })
        .from(contractsTable)
        .where(and(
          eq(contractsTable.status, "active"),
          sql`end_date is not null`,
          sql`end_date::date between now()::date and (now() + interval '30 days')::date`,
        ));

      // Offres d'emploi ouvertes
      const [openJobs] = await db.select({ c: sql<number>`count(*)::int` })
        .from(jobOffersTable)
        .where(eq(jobOffersTable.status, "published"));

      // Départements
      const depts = await db.select({ name: departmentsTable.name })
        .from(departmentsTable).limit(10);

      lines.push(
        `Équipe & RH : ${active?.c ?? 0} collaborateur(s) actif(s)` +
        (onLeave?.c ? `, ${onLeave.c} en congé` : "") +
        `. ${expiringContracts?.c ?? 0} contrat(s) expirant dans 30 jours. ` +
        `${openJobs?.c ?? 0} offre(s) d'emploi active(s).`
      );
      if (depts.length) {
        lines.push(`Départements : ${depts.map(d => d.name).join(", ")}.`);
      }
      citations.push({ label: "Collaborateurs", url: "/collaborators" });
      citations.push({ label: "Équipe & RH", url: "/hr" });
      citations.push({ label: "Présences & pointage", url: "/attendance" });
    } catch { /* ignore */ }
  }

  // ── Messagerie ────────────────────────────────────────────────────────────────
  if (intent === "messaging") {
    try {
      const [convCount] = await db.select({ c: sql<number>`count(*)::int` }).from(conversationsTable);
      lines.push(`Messagerie : ${convCount?.c ?? 0} conversation(s) dans la plateforme. Accédez à la messagerie pour DM, groupes, partage de fichiers, messages vocaux.`);
      citations.push({ label: "Messagerie", url: "/messaging" });
    } catch { /* ignore */ }
  }

  // ── Documents ────────────────────────────────────────────────────────────────
  if (intent === "documents") {
    try {
      const [docCount] = await db.select({ c: sql<number>`count(*)::int` }).from(documentsTable).where(isNull(documentsTable.deletedAt));
      const [pendingSig] = await db.select({ c: sql<number>`count(*)::int` }).from(documentsTable).where(and(isNull(documentsTable.deletedAt), eq(documentsTable.signatureStatus, "pending")));
      lines.push(`Documents : ${docCount?.c ?? 0} document(s) dans la bibliothèque, ${pendingSig?.c ?? 0} en attente de signature.`);
      citations.push({ label: "Documents", url: "/documents" });
    } catch { /* ignore */ }
  }

  // ── Approbations ─────────────────────────────────────────────────────────────
  if (intent === "approvals") {
    lines.push("La file d'approbations (/approvals) centralise les éléments nécessitant une validation : devis brouillons, factures à émettre, documents en attente de signature, contrats expirant dans 30 jours, opportunités à clôturer. Chaque item est classé par sévérité (urgent, élevé, moyen, faible).");
    citations.push({ label: "Approbations", url: "/approvals" });
  }

  // ── Commandes ────────────────────────────────────────────────────────────────
  if (intent === "orders") {
    try {
      const [orderCount] = await db.select({ c: sql<number>`count(*)::int` }).from(ordersTable).where(isNull(ordersTable.deletedAt));
      lines.push(`${orderCount?.c ?? 0} commande(s) enregistrée(s).`);
      citations.push({ label: "Commandes", url: "/orders" });
    } catch { /* ignore */ }
  }

  // ── Recherche ────────────────────────────────────────────────────────────────
  if (intent === "search") {
    try {
      const m = q.match(/(?:cherche|trouve|recherch[a-z]*)\s+(.+?)(?:\?|$|\.)/i);
      const term = (m?.[1] ?? "").trim();
      if (term.length >= 2) {
        const pattern = `%${term}%`;
        const clientConds = [isNull(clientsTable.deletedAt), ilike(clientsTable.name, pattern)];
        if (clientIds && clientIds.length) clientConds.push(inArray(clientsTable.id, clientIds));
        const cs = (clientIds && clientIds.length === 0) ? [] : await db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable).where(and(...clientConds)).limit(3);
        if (cs.length) {
          lines.push("Clients trouvés : " + cs.map((c) => c.name).join(", "));
          cs.forEach((c) => citations.push({ label: c.name, url: `/clients/${c.id}` }));
        }
        const projConds2 = [isNull(projectsTable.deletedAt), ilike(projectsTable.name, pattern)];
        if (projectIds && projectIds.length) projConds2.push(inArray(projectsTable.id, projectIds));
        const ps = (projectIds && projectIds.length === 0) ? [] : await db.select({ id: projectsTable.id, name: projectsTable.name }).from(projectsTable).where(and(...projConds2)).limit(3);
        if (ps.length) {
          lines.push("Projets trouvés : " + ps.map((p) => p.name).join(", "));
          ps.forEach((p) => citations.push({ label: p.name, url: `/projects/${p.id}` }));
        }
        if (!cs.length && !ps.length) lines.push(`Aucun résultat pour « ${term} ».`);
      }
      citations.push({ label: "Recherche universelle", url: "/search" });
    } catch { /* ignore */ }
  }

  // ── Risques transversaux (exclus : intelligence traite déjà tous les risques) ─
  if (intent !== "intelligence" && orgId && await hasPermission(userId, "ai.view_risk_flags")) {
    try {
      const risks = await db.select({ severity: riskFlagsTable.severity, title: riskFlagsTable.title })
        .from(riskFlagsTable).where(and(
          eq(riskFlagsTable.organizationId, orgId),
          eq(riskFlagsTable.isResolved, false),
          inArray(riskFlagsTable.severity, ["high", "critical"]),
        )).orderBy(desc(riskFlagsTable.createdAt)).limit(3);
      if (risks.length) {
        lines.push("Risques prioritaires signalés : " + risks.map((r) => `[${r.severity}] ${r.title}`).join(" / "));
        citations.push({ label: "Cockpit IA", url: "/intelligence" });
      }
    } catch { /* ignore */ }
  }

  return { text: lines.join("\n"), citations };
}

function heuristicAnswer(intent: Intent, ctx: string, q: string): string {
  if (intent === "help" || intent === "navigation") {
    return `Je suis Koffi, votre assistant Gameasu. Voici ce que je peux faire pour vous :
• Répondre aux questions sur n'importe quel module (Projets, CRM, Finance, RH, Équipements…)
• Expliquer comment utiliser une fonctionnalité étape par étape
• Retrouver des données : clients, projets, tâches, factures, risques
• Guider la navigation dans l'application

Exemples de questions : « Comment créer une facture ? », « Combien de projets actifs ? », « Où sont mes tâches urgentes ? », « État des factures impayées ».`;
  }
  if (!ctx.trim()) {
    return "Je n'ai pas trouvé d'éléments correspondants dans vos données. Reformulez votre question ou utilisez la recherche universelle (/search).";
  }
  return ctx;
}

const askSchema = z.object({
  question: z.string().min(1).max(1000),
});

router.post("/assistant/ask", async (req, res, next) => {
  try {
    const parsed = askSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "question_required" });
    const { question } = parsed.data;
    const userId = req.authUser!.id;

    const intent = detectIntent(question);
    const { text, citations } = await buildContext(intent, userId, question);

    let answer: string | null = null;
    let provider: "openai" | "heuristic" = "heuristic";

    if (aiAvailable()) {
      const summary = await summarize({
        system: `Tu es Koffi, l'assistant intelligent intégré à la plateforme ERP Gameasu (SaaS B2B, solution multi-pays et multi-secteurs).

CONNAISSANCE DE L'APPLICATION :
${APP_KNOWLEDGE}

INSTRUCTIONS :
- Réponds TOUJOURS en français professionnel, clair et concis (3-8 phrases max)
- Utilise les données du contexte quand elles sont disponibles (priorité aux faits réels)
- Quand tu expliques comment faire quelque chose, donne les étapes concrètes
- Indique le chemin de navigation précis (ex: "Allez dans Projets → cliquez Nouveau projet")
- Si le contexte est vide mais que tu sais répondre depuis ta connaissance de l'app, réponds quand même
- Ne dis jamais "je ne suis qu'un assistant" — tu es Koffi, l'expert Gameasu
- Pas de markdown, pas de préambule, pas de disclaimer`,
        context: `Question utilisateur : ${question}\n\nDonnées en temps réel :\n${text || "(aucune donnée pertinente récupérée — réponds depuis ta connaissance de l'application)"}`,
        maxTokens: 500,
      });
      if (summary) { answer = summary; provider = "openai"; }
    }

    if (!answer) answer = heuristicAnswer(intent, text, question);

    return res.json({
      intent,
      answer,
      citations,
      provider,
    });
  } catch (e) { return next(e); }
});

export default router;
