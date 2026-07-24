/**
 * Catalogue de permissions Gameasu.
 * Ce fichier est la source de vérité — chaque code de permission utilisé dans
 * le code (middleware requirePermission, UI, etc.) doit y figurer.
 *
 * Convention de code : `<domaine>.<action>`
 *   - actions standards : read, create, update, delete, manage (= toutes)
 *   - actions spéciales : invite, export, approve, import, view_sensitive…
 */

export type PermissionDef = { code: string; label: string; category: string; description?: string };

export const PERMISSIONS: PermissionDef[] = [

  // ─── Tableau de bord ────────────────────────────────────────────
  { code: "dashboard.view_financial_kpis", label: "Voir les KPI financiers", category: "Tableau de bord" },
  { code: "dashboard.view_hr_kpis",        label: "Voir les KPI RH",          category: "Tableau de bord" },
  { code: "dashboard.export",              label: "Exporter le tableau de bord", category: "Tableau de bord" },

  // ─── Administration ─────────────────────────────────────────────
  { code: "admin.access",  label: "Accéder au panneau d'administration", category: "Administration" },
  { code: "audit.read",    label: "Consulter le journal d'audit",          category: "Administration" },
  { code: "support.read",  label: "Consulter les tickets support",          category: "Administration" },
  { code: "support.manage",label: "Gérer les tickets support",              category: "Administration" },
  { code: "notifications.manage", label: "Gérer les notifications et alertes", category: "Administration" },

  // ─── Utilisateurs & rôles ───────────────────────────────────────
  { code: "users.read",            label: "Voir les utilisateurs",                       category: "Utilisateurs" },
  { code: "users.create",          label: "Créer un utilisateur",                        category: "Utilisateurs" },
  { code: "users.update",          label: "Modifier un utilisateur",                     category: "Utilisateurs" },
  { code: "users.delete",          label: "Supprimer / désactiver un utilisateur",       category: "Utilisateurs" },
  { code: "users.invite",          label: "Inviter un nouvel utilisateur",               category: "Utilisateurs" },
  { code: "users.assign_projects", label: "Gérer les accès projets d'un utilisateur",   category: "Utilisateurs" },
  { code: "roles.read",            label: "Voir les rôles & permissions",                category: "Utilisateurs" },
  { code: "roles.manage",          label: "Créer / modifier / supprimer les rôles",     category: "Utilisateurs" },

  // ─── Paramètres ────────────────────────────────────────────────
  { code: "settings.read",   label: "Voir les paramètres", category: "Paramètres" },
  { code: "settings.manage", label: "Modifier les paramètres globaux", category: "Paramètres" },

  // ─── Départements ──────────────────────────────────────────────
  { code: "departments.read",   label: "Voir les départements",                          category: "Départements" },
  { code: "departments.manage", label: "Gérer les départements (créer/modifier/supprimer)", category: "Départements" },

  // ─── Clients (workspace racine) ────────────────────────────────
  { code: "clients.read",             label: "Voir les clients (filtrés par accès)",      category: "Clients" },
  { code: "clients.read_all",         label: "Voir TOUS les clients sans restriction",    category: "Clients" },
  { code: "clients.create",           label: "Créer un client",                          category: "Clients" },
  { code: "clients.update",           label: "Modifier un client",                       category: "Clients" },
  { code: "clients.delete",           label: "Supprimer un client",                      category: "Clients" },
  { code: "clients.export",           label: "Exporter la liste des clients",            category: "Clients" },
  { code: "clients.view_history",     label: "Voir l'historique complet client",         category: "Clients" },
  { code: "clients.view_confidential",label: "Voir les données confidentielles client",  category: "Clients" },
  { code: "clients.manage",           label: "Accès complet clients (admin)",            category: "Clients" },

  // ─── Commercial / CRM ──────────────────────────────────────────
  { code: "commercial.read",   label: "Voir le pipeline CRM",                   category: "Commercial" },
  { code: "commercial.create", label: "Créer des opportunités",                  category: "Commercial" },
  { code: "commercial.update", label: "Modifier des opportunités",               category: "Commercial" },
  { code: "commercial.delete", label: "Supprimer des opportunités",              category: "Commercial" },
  { code: "commercial.export", label: "Exporter le pipeline et les données CRM", category: "Commercial" },
  { code: "commercial.manage", label: "Accès complet CRM (admin)",              category: "Commercial" },

  // ─── Ventes (devis / commandes / factures / encaissements) ─────
  { code: "sales.create_quote",      label: "Créer un devis / proforma",             category: "Ventes" },
  { code: "sales.approve_quote",     label: "Valider et approuver un devis",         category: "Ventes" },
  { code: "sales.create_order",      label: "Créer une commande",                    category: "Ventes" },
  { code: "sales.create_invoice",    label: "Émettre une facture",                   category: "Ventes" },
  { code: "sales.cancel_invoice",    label: "Annuler une facture",                   category: "Ventes" },
  { code: "sales.record_payment",    label: "Enregistrer un encaissement",           category: "Ventes" },
  { code: "sales.manage_credit_notes",label: "Gérer les avoirs",                    category: "Ventes" },
  { code: "sales.export",            label: "Exporter les documents commerciaux",    category: "Ventes" },
  { code: "sales.view_pricing",      label: "Accéder au calculateur de prix",        category: "Ventes" },

  // ─── Services ──────────────────────────────────────────────────
  { code: "services.read",   label: "Voir les engagements de service", category: "Services" },
  { code: "services.manage", label: "Créer / modifier / supprimer des engagements", category: "Services" },

  // ─── Projets ────────────────────────────────────────────────────
  { code: "projects.read",         label: "Voir les projets (filtrés par accès)",        category: "Projets" },
  { code: "projects.read_all",     label: "Voir TOUS les projets sans restriction",      category: "Projets" },
  { code: "projects.create",       label: "Créer un projet",                            category: "Projets" },
  { code: "projects.update",       label: "Modifier un projet",                         category: "Projets" },
  { code: "projects.delete",       label: "Supprimer / archiver un projet",              category: "Projets" },
  { code: "projects.approve",      label: "Approuver les étapes et livrables",          category: "Projets" },
  { code: "projects.manage_budget",label: "Gérer les budgets de projet",                category: "Projets" },
  { code: "projects.export",       label: "Exporter les données projets",               category: "Projets" },

  // ─── Tâches ─────────────────────────────────────────────────────
  { code: "tasks.read",   label: "Voir les tâches",                    category: "Tâches" },
  { code: "tasks.create", label: "Créer des tâches",                   category: "Tâches" },
  { code: "tasks.update", label: "Modifier des tâches",                category: "Tâches" },
  { code: "tasks.delete", label: "Supprimer des tâches",               category: "Tâches" },
  { code: "tasks.manage", label: "Accès complet tâches (admin)",       category: "Tâches" },

  // ─── RH ─────────────────────────────────────────────────────────
  { code: "hr.read",             label: "Consulter les données RH",                      category: "RH" },
  { code: "hr.manage",           label: "Gérer les données RH (général)",                category: "RH" },
  { code: "hr.view_salary",      label: "Voir les salaires et la paie",                  category: "RH" },
  { code: "hr.manage_payroll",   label: "Gérer la paie et les bulletins",                category: "RH" },
  { code: "hr.manage_leaves",    label: "Gérer les congés et absences",                  category: "RH" },
  { code: "hr.manage_contracts", label: "Gérer les contrats de travail",                 category: "RH" },
  { code: "hr.view_sensitive",   label: "Voir les données RH sensibles (salaires, médical)", category: "RH" },
  { code: "hr.manage_expenses",  label: "Gérer les notes de frais",                      category: "RH" },
  { code: "hr.approve_expenses", label: "Approuver les notes de frais",                  category: "RH" },
  { code: "hr.export",           label: "Exporter les données RH",                       category: "RH" },

  // ─── Présence / Pointage ────────────────────────────────────────
  { code: "attendance.view",            label: "Voir les pointages",                 category: "Présences" },
  { code: "attendance.manage",          label: "Gérer les pointages",                category: "Présences" },
  { code: "attendance.clock",           label: "Effectuer ses propres pointages",    category: "Présences" },
  { code: "attendance.view_anomalies",  label: "Voir les anomalies de présence",     category: "Présences" },
  { code: "attendance.manage_settings", label: "Configurer le module présence",      category: "Présences" },

  // ─── Matériel & Locations ───────────────────────────────────────
  { code: "equipment.read",               label: "Voir le matériel",                      category: "Matériel" },
  { code: "equipment.manage",             label: "Gérer le matériel (créer/modifier)",    category: "Matériel" },
  { code: "equipment.manage_inspections", label: "Gérer les inspections de matériel",     category: "Matériel" },
  { code: "equipment.manage_rentals",     label: "Gérer les locations de matériel",       category: "Matériel" },
  { code: "equipment.export",             label: "Exporter les données matériel",         category: "Matériel" },

  // ─── Comptabilité ───────────────────────────────────────────────
  { code: "accounting.read",           label: "Consulter la comptabilité",              category: "Comptabilité" },
  { code: "accounting.manage",         label: "Saisir des écritures, gérer les périodes", category: "Comptabilité" },
  { code: "accounting.manage_chart",   label: "Gérer le plan comptable (comptes, statuts)", category: "Comptabilité" },
  { code: "accounting.manage_mapping", label: "Configurer le mappage comptable des modules", category: "Comptabilité" },
  { code: "accounting.approve_entries",label: "Valider des écritures comptables",       category: "Comptabilité" },
  { code: "accounting.manage_banks",   label: "Gérer les comptes bancaires",            category: "Comptabilité" },
  { code: "accounting.import",         label: "Importer des écritures comptables",      category: "Comptabilité" },
  { code: "accounting.export",         label: "Exporter les documents comptables",      category: "Comptabilité" },
  { code: "accounting.view_sensitive", label: "Voir les données financières sensibles", category: "Comptabilité" },

  // ─── FP&A ──────────────────────────────────────────────────────
  { code: "fpa.read",    label: "Consulter les budgets et reportings FP&A",         category: "FP&A" },
  { code: "fpa.manage",  label: "Créer / modifier / activer des budgets",            category: "FP&A" },
  { code: "fpa.approve", label: "Approuver et activer les budgets",                  category: "FP&A" },
  { code: "fpa.export",  label: "Exporter les budgets et rapports FP&A en Excel",   category: "FP&A" },

  // ─── Achats / AP ─────────────────────────────────────────────────
  { code: "purchases.read",    label: "Consulter les achats, fournisseurs et factures",                category: "Achats" },
  { code: "purchases.write",   label: "Créer / modifier des factures, bons de commande et fournisseurs", category: "Achats" },
  { code: "purchases.approve", label: "Approuver des factures et bons de commande",                    category: "Achats" },
  { code: "purchases.pay",     label: "Enregistrer des paiements fournisseurs",                        category: "Achats" },
  { code: "purchases.export",  label: "Exporter les données achats",                                   category: "Achats" },
  { code: "purchases.manage",  label: "Accès complet au module Achats",                               category: "Achats" },

  // ─── Inventaire & Stock ─────────────────────────────────────────
  { code: "inventory.read",               label: "Voir les produits, stocks et mouvements",              category: "Inventaire" },
  { code: "inventory.manage",             label: "Gérer produits, catégories et lignes de vente",        category: "Inventaire" },
  { code: "inventory.receive",            label: "Réceptionner les bons de commande",                    category: "Inventaire" },
  { code: "inventory.adjust",             label: "Ajuster manuellement le stock (inventaire physique)",  category: "Inventaire" },
  { code: "inventory.manage_warehouses",  label: "Gérer les entrepôts",                                  category: "Inventaire" },
  { code: "inventory.export",             label: "Exporter les données de stock",                        category: "Inventaire" },

  // ─── Opérations & Logistique ────────────────────────────────────
  { code: "operations.view",         label: "Voir les missions et opérations",          category: "Opérations" },
  { code: "operations.manage",       label: "Créer / modifier / archiver les missions", category: "Opérations" },
  { code: "operations.assign",       label: "Affecter responsable, équipe, véhicule",  category: "Opérations" },
  { code: "operations.dispatch",     label: "Accéder au tableau de dispatching",        category: "Opérations" },
  { code: "operations.checkin",      label: "Check-in / check-out terrain",             category: "Opérations" },
  { code: "operations.incidents",    label: "Gérer les incidents terrain",              category: "Opérations" },
  { code: "operations.checklists",   label: "Gérer les checklists opérationnelles",     category: "Opérations" },
  { code: "operations.performance",  label: "Consulter les KPI opérationnels",          category: "Opérations" },
  { code: "operations.export",       label: "Exporter les données opérationnelles",     category: "Opérations" },

  // ─── Documents ──────────────────────────────────────────────────
  { code: "documents.read",   label: "Voir les documents (filtrés par projet)", category: "Documents" },
  { code: "documents.manage", label: "Téléverser / supprimer des documents",    category: "Documents" },

  // ─── Messagerie ────────────────────────────────────────────────
  { code: "messaging.use",      label: "Utiliser la messagerie",                           category: "Messagerie" },
  { code: "messaging.moderate", label: "Modérer la messagerie (épingler/supprimer d'autrui)", category: "Messagerie" },

  // ─── Marketing ─────────────────────────────────────────────────
  { code: "marketing.read",   label: "Voir les campagnes marketing",   category: "Marketing" },
  { code: "marketing.manage", label: "Gérer les campagnes marketing",  category: "Marketing" },

  // ─── Rapports & Exports ─────────────────────────────────────────
  { code: "reports.view",          label: "Consulter les rapports",                category: "Rapports" },
  { code: "reports.export_pdf",    label: "Exporter les rapports en PDF",          category: "Rapports" },
  { code: "reports.export_excel",  label: "Exporter les rapports en Excel",        category: "Rapports" },
  { code: "reports.management",    label: "Accéder aux rapports de direction",     category: "Rapports" },

  // ─── Intelligence & Automatisation ─────────────────────────────
  { code: "ai.view_insights",         label: "Voir les insights IA",                category: "Intelligence" },
  { code: "ai.view_recommendations",  label: "Voir les recommandations IA",         category: "Intelligence" },
  { code: "ai.view_risk_flags",       label: "Voir les drapeaux de risque IA",      category: "Intelligence" },
  { code: "ai.manage_predictive",     label: "Gérer les fonctions prédictives",     category: "Intelligence" },
  { code: "ai.manage_reports",        label: "Gérer les rapports intelligents",     category: "Intelligence" },
  { code: "ai.manage_translation",    label: "Gérer les outils de traduction",      category: "Intelligence" },
  { code: "ai.manage_whatsapp",       label: "Gérer les canaux WhatsApp",           category: "Intelligence" },
  { code: "automation.read",          label: "Voir les règles d'automatisation",    category: "Intelligence" },
  { code: "automation.manage",        label: "Gérer les règles d'automatisation",   category: "Intelligence" },

  // ─── Scoring & Santé ────────────────────────────────────────────
  { code: "scoring.view_client_health",       label: "Voir le score de santé client",    category: "Scoring" },
  { code: "scoring.view_project_risk",        label: "Voir le score de risque projet",   category: "Scoring" },
  { code: "scoring.view_financial_forecasts", label: "Voir les prévisions financières",  category: "Scoring" },
];

/**
 * Mapping des rôles système vers leurs permissions.
 * `*` = toutes les permissions du catalogue (super_admin / admin).
 */
export type RoleSeed = {
  code: string;
  name: string;
  description: string;
  level: number;
  isSystem: boolean;
  permissions: string[] | "*";
};

export const SYSTEM_ROLES: RoleSeed[] = [
  {
    code: "super_admin",
    name: "Super Administrateur",
    description: "Accès intégral à la plateforme. Non supprimable.",
    level: 100,
    isSystem: true,
    permissions: "*",
  },
  {
    code: "admin",
    name: "Administrateur",
    description: "Gestion des utilisateurs, départements et configuration. La gestion des rôles reste réservée au Super Administrateur.",
    level: 90,
    isSystem: true,
    // Différenciation demandée par l'audit (§D) : l'Administrateur détient tout
    // SAUF la gestion des rôles (roles.manage), réservée au Super Administrateur.
    // Il conserve roles.read pour consulter la matrice.
    permissions: PERMISSIONS.map((p) => p.code).filter((c) => c !== "roles.manage"),
  },
  {
    code: "manager",
    name: "Manager / Chef de projet",
    description: "Pilotage des projets assignés, équipes, FP&A, achats.",
    level: 50,
    isSystem: true,
    permissions: [
      "dashboard.view_financial_kpis", "dashboard.view_hr_kpis",
      "users.read", "departments.read",
      "hr.read", "hr.manage", "hr.manage_leaves", "hr.manage_contracts",
      "clients.read", "clients.create", "clients.update", "clients.view_history",
      "services.read", "services.manage",
      "projects.read", "projects.create", "projects.update", "projects.approve", "projects.manage_budget", "projects.export",
      "tasks.read", "tasks.create", "tasks.update", "tasks.delete", "tasks.manage",
      "commercial.read", "commercial.create", "commercial.update", "commercial.export",
      "sales.create_quote", "sales.approve_quote", "sales.create_order", "sales.create_invoice", "sales.record_payment", "sales.export",
      "equipment.read", "equipment.manage", "equipment.manage_rentals",
      "accounting.read", "accounting.export",
      "fpa.read", "fpa.manage", "fpa.approve", "fpa.export",
      "documents.read", "documents.manage",
      "messaging.use", "messaging.moderate",
      "marketing.read",
      "settings.read",
      "reports.view", "reports.export_pdf", "reports.export_excel", "reports.management",
      "ai.view_insights", "ai.view_recommendations", "ai.view_risk_flags", "ai.manage_predictive", "ai.manage_reports",
      "automation.read", "automation.manage",
      "scoring.view_client_health", "scoring.view_project_risk", "scoring.view_financial_forecasts",
      "attendance.view", "attendance.manage", "attendance.clock", "attendance.view_anomalies",
      "operations.view", "operations.manage", "operations.assign", "operations.dispatch",
      "operations.checkin", "operations.incidents", "operations.checklists", "operations.performance",
      "inventory.read", "inventory.manage", "inventory.receive", "inventory.adjust", "inventory.export",
      "purchases.read", "purchases.write", "purchases.approve", "purchases.pay", "purchases.manage", "purchases.export",
    ],
  },
  {
    code: "comptable",
    name: "Comptable / Contrôleur financier",
    description: "Gestion comptable, achats, facturation et reporting financier.",
    level: 40,
    isSystem: true,
    permissions: [
      "users.read", "departments.read",
      "clients.read",
      "services.read",
      "projects.read",
      "tasks.read",
      "commercial.read",
      "equipment.read",
      "accounting.read", "accounting.manage", "accounting.manage_chart", "accounting.manage_mapping", "accounting.approve_entries", "accounting.manage_banks", "accounting.export",
      "fpa.read", "fpa.manage", "fpa.export",
      "documents.read", "documents.manage",
      "messaging.use",
      "purchases.read", "purchases.write", "purchases.approve", "purchases.pay", "purchases.export",
      "inventory.read",
      "attendance.clock",
      "reports.view", "reports.export_pdf", "reports.export_excel",
      "sales.create_invoice", "sales.cancel_invoice", "sales.record_payment", "sales.export",
    ],
  },
  {
    code: "commercial",
    name: "Commercial",
    description: "Gestion du pipeline, clients, devis, commandes.",
    level: 30,
    isSystem: true,
    permissions: [
      "dashboard.view_financial_kpis",
      "users.read", "departments.read",
      "clients.read", "clients.create", "clients.update", "clients.view_history", "clients.export",
      "services.read", "services.manage",
      "projects.read",
      "tasks.read",
      "commercial.read", "commercial.create", "commercial.update", "commercial.export", "commercial.manage",
      "sales.create_quote", "sales.approve_quote", "sales.create_order", "sales.view_pricing", "sales.export",
      "documents.read", "documents.manage",
      "messaging.use",
      "marketing.read", "marketing.manage",
      "ai.view_insights", "ai.view_recommendations",
      "scoring.view_client_health",
      "attendance.clock",
      "operations.view",
      "inventory.read", "inventory.manage",
      "reports.view", "reports.export_pdf",
    ],
  },
  {
    code: "rh",
    name: "Gestionnaire RH",
    description: "Gestion des ressources humaines, contrats, présences et paie.",
    level: 45,
    isSystem: true,
    permissions: [
      "dashboard.view_hr_kpis",
      "users.read", "users.invite",
      "departments.read", "departments.manage",
      "hr.read", "hr.manage", "hr.view_salary", "hr.manage_payroll", "hr.manage_leaves",
      "hr.manage_contracts", "hr.view_sensitive", "hr.manage_expenses", "hr.approve_expenses", "hr.export",
      "attendance.view", "attendance.manage", "attendance.clock", "attendance.view_anomalies", "attendance.manage_settings",
      "projects.read", "tasks.read",
      "clients.read",
      "services.read",
      "documents.read", "documents.manage",
      "messaging.use",
      "settings.read",
      "ai.view_insights",
      "reports.view", "reports.export_pdf", "reports.export_excel",
    ],
  },
  {
    code: "financier",
    name: "Responsable Financier",
    description: "Comptabilité, FP&A, achats fournisseurs et reporting financier.",
    level: 42,
    isSystem: true,
    permissions: [
      "dashboard.view_financial_kpis",
      "users.read", "departments.read",
      "clients.read", "clients.read_all",
      "services.read",
      "projects.read",
      "tasks.read",
      "commercial.read", "commercial.manage",
      "equipment.read",
      "accounting.read", "accounting.manage", "accounting.manage_chart", "accounting.manage_mapping", "accounting.approve_entries", "accounting.manage_banks", "accounting.export", "accounting.view_sensitive",
      "fpa.read", "fpa.manage", "fpa.approve", "fpa.export",
      "documents.read", "documents.manage",
      "messaging.use",
      "purchases.read", "purchases.write", "purchases.approve", "purchases.pay", "purchases.export",
      "inventory.read",
      "attendance.clock",
      "audit.read",
      "ai.view_insights", "ai.view_recommendations",
      "scoring.view_financial_forecasts",
      "reports.view", "reports.export_pdf", "reports.export_excel", "reports.management",
      "sales.create_invoice", "sales.cancel_invoice", "sales.record_payment", "sales.export",
    ],
  },
  {
    code: "logistique",
    name: "Gestionnaire Logistique",
    description: "Opérations terrain, équipements, stock et locations.",
    level: 35,
    isSystem: true,
    permissions: [
      "users.read", "departments.read",
      "clients.read",
      "services.read",
      "projects.read", "tasks.read",
      "equipment.read", "equipment.manage", "equipment.manage_inspections", "equipment.manage_rentals", "equipment.export",
      "operations.view", "operations.manage", "operations.assign", "operations.dispatch",
      "operations.checkin", "operations.incidents", "operations.checklists", "operations.performance", "operations.export",
      "inventory.read", "inventory.manage", "inventory.receive", "inventory.adjust", "inventory.export",
      "documents.read", "documents.manage",
      "messaging.use",
      "attendance.clock",
      "reports.view",
    ],
  },
  {
    code: "auditeur",
    name: "Auditeur (lecture seule)",
    description: "Accès en lecture seule à tous les modules. Ne peut pas créer, modifier ni supprimer.",
    level: 15,
    isSystem: true,
    permissions: [
      "dashboard.view_financial_kpis", "dashboard.view_hr_kpis",
      "admin.access",
      "audit.read",
      "users.read",
      "departments.read",
      "roles.read",
      "hr.read",
      "clients.read", "clients.read_all",
      "services.read",
      "projects.read", "projects.read_all",
      "tasks.read",
      "commercial.read",
      "equipment.read",
      "accounting.read",
      "fpa.read",
      "documents.read",
      "messaging.use",
      "marketing.read",
      "settings.read",
      "ai.view_insights", "ai.view_recommendations", "ai.view_risk_flags",
      "automation.read",
      "scoring.view_client_health", "scoring.view_project_risk", "scoring.view_financial_forecasts",
      "attendance.view", "attendance.clock",
      "operations.view", "operations.performance",
      "inventory.read",
      "purchases.read",
      "reports.view",
    ],
  },
  {
    code: "collaborator",
    name: "Collaborateur",
    description: "Accès aux projets assignés, tâches et messagerie de son équipe.",
    level: 10,
    isSystem: true,
    permissions: [
      "users.read", "departments.read",
      "clients.read",
      "services.read",
      "projects.read",
      "tasks.read", "tasks.create", "tasks.update", "tasks.manage",
      "equipment.read",
      "documents.read",
      "messaging.use",
      "ai.view_insights",
      "attendance.clock",
      "operations.view", "operations.checkin",
      "inventory.read",
    ],
  },
];
