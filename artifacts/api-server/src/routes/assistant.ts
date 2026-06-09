/**
 * Koffi — Assistant conversationnel intelligent de Gaméasù.
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
  conversationsTable,
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
  | "equipment"
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
  const s = q.toLowerCase();
  // Help / navigation / explication d'usage
  if (/(bonjour|salut|aide|help|qui es|que peux|présente|comment\s+(?:utiliser|fonctionne|faire|naviguer|aller|accéder|trouver|créer|ajouter|modifier|supprimer)|explique|c'est quoi|qu'est.ce)/.test(s)) return "help";
  if (/(menu|navigation|aller\s+sur|accéder\s+à|page\s+de|section|module|où\s+(?:est|se trouve|trouver))/.test(s)) return "navigation";
  // Intelligence & risques
  if (/(risque|insight|recommandation|alerte|intelligence|cockpit|anomalie|signal)/.test(s)) return "intelligence";
  // KPI globaux
  if (/(kpi|tableau\s+de\s+bord|vue\s+d'ensemble|globale|santé|activité|résumé|bilan|statistique|chiffre)/.test(s)) return "kpi_overview";
  // Commercial & clients
  if (/(client|prospect|crm|pipeline|opportunité|lead|contact|partenaire)/.test(s)) return "clients";
  // Projets & opérations
  if (/(projet|chantier|phase|planning|gantt|portefeuille|workload|charge|mission|service)/.test(s)) return "projects";
  // Tâches
  if (/(tâche|task|backlog|urgence|priorité|sous.tâche|mention)/.test(s)) return "tasks";
  // Finance
  if (/(facture|paiement|trésorerie|cash|finance|recouvrement|impayé|encours|avoir|devis|proforma|commande|budget|comptabilité|bilan|résultat|fiscal|taxe|fpa|prévision)/.test(s)) return "finance";
  // Équipements & stock
  if (/(équipement|matériel|machine|parc|stock|inventaire|produit|location|inspection|locat)/.test(s)) return "equipment";
  // RH & équipe
  if (/(rh|collaborateur|équipe|absent|retard|pointage|congé|contrat|paie|salaire|recrutement|formation|évaluation|mouvement|organigramme|poste|département)/.test(s)) return "hr";
  // Messagerie
  if (/(message|messagerie|conversation|discussion|chat|mp|groupe)/.test(s)) return "messaging";
  // Documents
  if (/(document|fichier|contrat|signature|archiv|bibliothèque|pdf|rapport)/.test(s)) return "documents";
  // Approbations
  if (/(approbation|approuver|valider|validation|en\s+attente|signer|file)/.test(s)) return "approvals";
  // Commandes
  if (/(commande|order|vente|bon\s+de\s+commande|achat)/.test(s)) return "orders";
  // Recherche
  if (/(cherche|trouve|recherch|où\s+est|find)/.test(s)) return "search";
  return "unknown";
}

// ── Connaissance complète de l'application ────────────────────────────────────
const APP_KNOWLEDGE = `
PLATEFORME GAMÉASÙ — GUIDE COMPLET POUR KOFFI

## Structure générale
Gaméasù est un ERP SaaS B2B pour les organisations d'Afrique de l'Ouest francophone.
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
- **Abonnement & facturation** (/billing) : Plans (Starter/Growth/Professional/Enterprise), modules activés, historique de facturation
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
        rows.slice(0, 3).forEach((r) => citations.push({ label: r.name, url: `/clients/${r.id}` }));
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

      const [draftCount] = await db.select({ c: sql<number>`count(*)::int` }).from(proformasTable).where(eq(proformasTable.status, "draft"));
      const [orderCount] = await db.select({ c: sql<number>`count(*)::int` }).from(ordersTable).where(isNull(ordersTable.deletedAt));

      lines.push(`Finance : ${overdue.length} facture(s) en retard, encours ${Math.round(totalOverdue).toLocaleString("fr-FR")} FCFA. ${draftCount?.c ?? 0} devis en brouillon. ${orderCount?.c ?? 0} commandes.`);
      citations.push({ label: "Factures", url: "/invoices" });
      citations.push({ label: "Devis", url: "/proformas" });
      citations.push({ label: "Planification financière", url: "/fpa" });
    } catch { /* ignore */ }
  }

  // ── Équipements & stock ───────────────────────────────────────────────────────
  if (intent === "equipment") {
    try {
      const [eqTotal] = await db.select({ c: sql<number>`count(*)::int` }).from(equipmentTable).where(isNull(equipmentTable.deletedAt));
      const [eqAvail] = await db.select({ c: sql<number>`count(*)::int` }).from(equipmentTable).where(and(isNull(equipmentTable.deletedAt), eq(equipmentTable.status, "available")));
      lines.push(`Parc & équipements : ${eqTotal?.c ?? 0} équipements au total, ${eqAvail?.c ?? 0} disponibles.`);
      citations.push({ label: "Parc & équipements", url: "/equipment" });
      citations.push({ label: "Locations", url: "/rentals" });
      citations.push({ label: "Produits & stock", url: "/inventory" });
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
      const [active] = await db.select({ c: sql<number>`count(*)::int` }).from(collaboratorsTable).where(and(isNull(collaboratorsTable.deletedAt), eq(collaboratorsTable.employmentStatus, "active")));
      lines.push(`Effectif actif : ${active?.c ?? 0} collaborateur(s).`);
      citations.push({ label: "Collaborateurs", url: "/collaborators" });
      citations.push({ label: "Équipe & RH", url: "/hr" });
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

  // ── Risques transversaux ──────────────────────────────────────────────────────
  if (intent !== "help" && intent !== "navigation" && intent !== "intelligence" && orgId && await hasPermission(userId, "ai.view_risk_flags")) {
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
    return `Je suis Koffi, votre assistant Gaméasù. Voici ce que je peux faire pour vous :
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
        system: `Tu es Koffi, l'assistant intelligent intégré à la plateforme ERP Gaméasù (SaaS B2B, Togo/Afrique de l'Ouest francophone).

CONNAISSANCE DE L'APPLICATION :
${APP_KNOWLEDGE}

INSTRUCTIONS :
- Réponds TOUJOURS en français professionnel, clair et concis (3-8 phrases max)
- Utilise les données du contexte quand elles sont disponibles (priorité aux faits réels)
- Quand tu expliques comment faire quelque chose, donne les étapes concrètes
- Indique le chemin de navigation précis (ex: "Allez dans Projets → cliquez Nouveau projet")
- Si le contexte est vide mais que tu sais répondre depuis ta connaissance de l'app, réponds quand même
- Ne dis jamais "je ne suis qu'un assistant" — tu es Koffi, l'expert Gaméasù
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
  } catch (e) { next(e); }
});

export default router;
