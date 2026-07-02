/**
 * Catalogue de permissions FP&A / RBAC Gameasu.
 * Ce fichier est la source de vérité — chaque code de permission utilisé dans
 * le code (middleware requirePermission, UI, etc.) doit y figurer.
 *
 * Convention de code : `<domaine>.<action>`
 *   - actions standards : read, create, update, delete, manage (= toutes)
 *   - actions spéciales : invite, export, approve, …
 */

export type PermissionDef = { code: string; label: string; category: string; description?: string };

export const PERMISSIONS: PermissionDef[] = [
  // ─── Plateforme / Administration ────────────────────────────────
  { code: "admin.access", label: "Accéder au panneau d'administration", category: "Administration" },
  { code: "audit.read", label: "Consulter le journal d'audit", category: "Administration" },

  // ─── Utilisateurs & rôles ───────────────────────────────────────
  { code: "users.read", label: "Voir les utilisateurs", category: "Utilisateurs" },
  { code: "users.create", label: "Créer un utilisateur", category: "Utilisateurs" },
  { code: "users.update", label: "Modifier un utilisateur", category: "Utilisateurs" },
  { code: "users.delete", label: "Supprimer / désactiver un utilisateur", category: "Utilisateurs" },
  { code: "users.invite", label: "Inviter un nouvel utilisateur", category: "Utilisateurs" },
  { code: "users.assign_projects", label: "Gérer les accès projets d'un utilisateur", category: "Utilisateurs" },
  { code: "roles.read", label: "Voir les rôles & permissions", category: "Utilisateurs" },
  { code: "roles.manage", label: "Créer / modifier / supprimer les rôles & permissions", category: "Utilisateurs" },

  // ─── Départements & RH ─────────────────────────────────────────
  { code: "departments.read", label: "Voir les départements", category: "Départements" },
  { code: "departments.manage", label: "Gérer les départements (créer/modifier/supprimer)", category: "Départements" },
  { code: "hr.read", label: "Consulter les données RH", category: "RH" },
  { code: "hr.manage", label: "Gérer les contrats, postes, documents RH", category: "RH" },

  // ─── Projets ────────────────────────────────────────────────────
  { code: "projects.read", label: "Voir les projets (filtré par accès)", category: "Projets" },
  { code: "projects.read_all", label: "Voir TOUS les projets sans restriction d'accès", category: "Projets" },
  { code: "projects.create", label: "Créer un projet", category: "Projets" },
  { code: "projects.update", label: "Modifier un projet", category: "Projets" },
  { code: "projects.delete", label: "Supprimer / archiver un projet", category: "Projets" },

  // ─── Tâches ─────────────────────────────────────────────────────
  { code: "tasks.read", label: "Voir les tâches", category: "Tâches" },
  { code: "tasks.manage", label: "Créer / modifier / supprimer des tâches", category: "Tâches" },

  // ─── Clients (workspace racine) ────────────────────────────────
  { code: "clients.read", label: "Voir les clients (filtré par accès)", category: "Clients" },
  { code: "clients.read_all", label: "Voir TOUS les clients sans restriction d'accès", category: "Clients" },
  { code: "clients.manage", label: "Créer / modifier / supprimer des clients", category: "Clients" },

  // ─── Services (engagements récurrents) ─────────────────────────
  { code: "services.read", label: "Voir les engagements de service", category: "Services" },
  { code: "services.manage", label: "Créer / modifier / supprimer des engagements", category: "Services" },

  // ─── Commercial ─────────────────────────────────────────────────
  { code: "commercial.read", label: "Voir le pipeline commercial", category: "Commercial" },
  { code: "commercial.manage", label: "Gérer clients, opportunités, devis, commandes", category: "Commercial" },

  // ─── Matériel ───────────────────────────────────────────────────
  { code: "equipment.read", label: "Voir le matériel", category: "Matériel" },
  { code: "equipment.manage", label: "Gérer matériel, locations, inspections", category: "Matériel" },

  // ─── Comptabilité ───────────────────────────────────────────────
  { code: "accounting.read", label: "Consulter la comptabilité", category: "Comptabilité" },
  { code: "accounting.manage", label: "Saisir des écritures, gérer les périodes", category: "Comptabilité" },

  // ─── FP&A ──────────────────────────────────────────────────────
  { code: "fpa.read", label: "Consulter les budgets et reportings FP&A", category: "FP&A" },
  { code: "fpa.manage", label: "Créer / modifier / activer des budgets", category: "FP&A" },

  // ─── Documents ──────────────────────────────────────────────────
  { code: "documents.read", label: "Voir les documents (filtré par projet)", category: "Documents" },
  { code: "documents.manage", label: "Téléverser / supprimer des documents", category: "Documents" },

  // ─── Messagerie ────────────────────────────────────────────────
  { code: "messaging.use", label: "Utiliser la messagerie (filtré par projets/équipe)", category: "Messagerie" },
  { code: "messaging.moderate", label: "Modérer la messagerie (épingler/supprimer messages d'autrui)", category: "Messagerie" },

  // ─── Marketing ─────────────────────────────────────────────────
  { code: "marketing.read", label: "Voir les campagnes marketing", category: "Marketing" },
  { code: "marketing.manage", label: "Gérer les campagnes marketing", category: "Marketing" },

  // ─── Paramètres ────────────────────────────────────────────────
  { code: "settings.read", label: "Voir les paramètres", category: "Paramètres" },
  { code: "settings.manage", label: "Modifier les paramètres globaux", category: "Paramètres" },

  // ─── Intelligence & Automatisation (Phase 2-12) ────────────────
  { code: "ai.view_insights", label: "Voir les insights IA", category: "Intelligence" },
  { code: "ai.view_recommendations", label: "Voir les recommandations IA", category: "Intelligence" },
  { code: "ai.view_risk_flags", label: "Voir les drapeaux de risque", category: "Intelligence" },
  { code: "ai.manage_predictive", label: "Gérer les fonctions prédictives", category: "Intelligence" },
  { code: "ai.manage_reports", label: "Gérer les rapports intelligents", category: "Intelligence" },
  { code: "ai.manage_translation", label: "Gérer les outils de traduction", category: "Intelligence" },
  { code: "ai.manage_whatsapp", label: "Gérer les liens WhatsApp / canaux", category: "Intelligence" },
  { code: "automation.read", label: "Voir les règles d'automatisation", category: "Intelligence" },
  { code: "automation.manage", label: "Gérer les règles d'automatisation", category: "Intelligence" },

  // ─── Scoring & santé (Phases 5-8, 14) ──────────────────────────
  { code: "scoring.view_client_health", label: "Voir le score de santé client", category: "Scoring" },
  { code: "scoring.view_project_risk", label: "Voir le score de risque projet", category: "Scoring" },
  { code: "scoring.view_financial_forecasts", label: "Voir les prévisions financières", category: "Scoring" },

  // ─── Présence / Pointage (Phase 18) ────────────────────────────
  { code: "attendance.view", label: "Voir les pointages", category: "Présences" },
  { code: "attendance.manage", label: "Gérer les pointages", category: "Présences" },
  { code: "attendance.clock", label: "Effectuer ses propres pointages", category: "Présences" },
  { code: "attendance.view_anomalies", label: "Voir les anomalies de présence", category: "Présences" },
  { code: "attendance.manage_settings", label: "Configurer le module présence", category: "Présences" },

  // ─── Opérations & Logistique ────────────────────────────────────
  { code: "operations.view", label: "Voir les missions et opérations", category: "Opérations" },
  { code: "operations.manage", label: "Créer / modifier / archiver les missions", category: "Opérations" },
  { code: "operations.assign", label: "Affecter responsable, équipe, véhicule", category: "Opérations" },
  { code: "operations.dispatch", label: "Accéder au tableau de dispatching", category: "Opérations" },
  { code: "operations.checkin", label: "Check-in / check-out terrain", category: "Opérations" },
  { code: "operations.incidents", label: "Gérer les incidents terrain", category: "Opérations" },
  { code: "operations.checklists", label: "Gérer les checklists opérationnelles", category: "Opérations" },
  { code: "operations.performance", label: "Consulter les KPI opérationnels", category: "Opérations" },

  // ─── Inventaire & Stock (produits destinés à la revente) ───────
  { code: "inventory.read", label: "Voir les produits, stocks et mouvements", category: "Inventaire" },
  { code: "inventory.manage", label: "Gérer produits, catégories, bons de commande et lignes de vente", category: "Inventaire" },
  { code: "inventory.receive", label: "Réceptionner les bons de commande", category: "Inventaire" },
  { code: "inventory.adjust", label: "Ajuster manuellement le stock (inventaire physique)", category: "Inventaire" },

  // ─── Achats / AP (comptes fournisseurs) ─────────────────────────
  { code: "purchases.read", label: "Consulter les achats, fournisseurs et factures", category: "Achats" },
  { code: "purchases.write", label: "Créer / modifier des factures, bons de commande et fournisseurs", category: "Achats" },
  { code: "purchases.approve", label: "Approuver des factures et bons de commande", category: "Achats" },
  { code: "purchases.pay", label: "Enregistrer des paiements fournisseurs", category: "Achats" },
  { code: "purchases.manage", label: "Accès complet au module Achats", category: "Achats" },
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
    description: "Gestion des utilisateurs, rôles, départements, configuration.",
    level: 90,
    isSystem: true,
    permissions: "*",
  },
  {
    code: "manager",
    name: "Manager / Chef de projet",
    description: "Pilotage des projets assignés, équipes, FP&A, achats.",
    level: 50,
    isSystem: true,
    permissions: [
      "users.read", "departments.read", "hr.read", "hr.manage",
      "clients.read", "clients.manage",
      "services.read", "services.manage",
      "projects.read", "projects.create", "projects.update",
      "tasks.read", "tasks.manage",
      "commercial.read", "commercial.manage",
      "equipment.read", "equipment.manage",
      "accounting.read",
      "fpa.read", "fpa.manage",
      "documents.read", "documents.manage",
      "messaging.use", "messaging.moderate",
      "marketing.read",
      "settings.read",
      "ai.view_insights", "ai.view_recommendations", "ai.view_risk_flags", "ai.manage_predictive", "ai.manage_reports",
      "automation.read", "automation.manage",
      "scoring.view_client_health", "scoring.view_project_risk", "scoring.view_financial_forecasts",
      "attendance.view", "attendance.manage", "attendance.clock", "attendance.view_anomalies",
      "operations.view", "operations.manage", "operations.assign", "operations.dispatch",
      "operations.checkin", "operations.incidents", "operations.checklists", "operations.performance",
      "inventory.read", "inventory.manage", "inventory.receive", "inventory.adjust",
      "purchases.read", "purchases.write", "purchases.approve", "purchases.pay", "purchases.manage",
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
      "accounting.read", "accounting.manage",
      "fpa.read", "fpa.manage",
      "documents.read", "documents.manage",
      "messaging.use",
      "purchases.read", "purchases.write", "purchases.approve", "purchases.pay",
      "inventory.read",
      "attendance.clock",
    ],
  },
  {
    code: "commercial",
    name: "Commercial",
    description: "Gestion du pipeline, clients, devis, commandes.",
    level: 30,
    isSystem: true,
    permissions: [
      "users.read", "departments.read",
      "clients.read", "clients.manage",
      "services.read", "services.manage",
      "projects.read",
      "tasks.read",
      "commercial.read", "commercial.manage",
      "documents.read", "documents.manage",
      "messaging.use",
      "marketing.read", "marketing.manage",
      "ai.view_insights", "ai.view_recommendations",
      "scoring.view_client_health",
      "attendance.clock",
      "operations.view",
      "inventory.read", "inventory.manage",
    ],
  },
  {
    code: "rh",
    name: "Gestionnaire RH",
    description: "Gestion des ressources humaines, contrats, présences et paie.",
    level: 45,
    isSystem: true,
    permissions: [
      "users.read", "users.invite",
      "departments.read", "departments.manage",
      "hr.read", "hr.manage",
      "attendance.view", "attendance.manage", "attendance.clock", "attendance.view_anomalies", "attendance.manage_settings",
      "projects.read", "tasks.read",
      "clients.read",
      "services.read",
      "documents.read", "documents.manage",
      "messaging.use",
      "settings.read",
      "ai.view_insights",
    ],
  },
  {
    code: "financier",
    name: "Responsable Financier",
    description: "Comptabilité, FP&A, achats fournisseurs et reporting financier.",
    level: 42,
    isSystem: true,
    permissions: [
      "users.read", "departments.read",
      "clients.read", "clients.read_all",
      "services.read",
      "projects.read",
      "tasks.read",
      "commercial.read", "commercial.manage",
      "equipment.read",
      "accounting.read", "accounting.manage",
      "fpa.read", "fpa.manage",
      "documents.read", "documents.manage",
      "messaging.use",
      "purchases.read", "purchases.write", "purchases.approve", "purchases.pay",
      "inventory.read",
      "attendance.clock",
      "audit.read",
      "ai.view_insights", "ai.view_recommendations",
      "scoring.view_financial_forecasts",
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
      "equipment.read", "equipment.manage",
      "operations.view", "operations.manage", "operations.assign", "operations.dispatch",
      "operations.checkin", "operations.incidents", "operations.checklists", "operations.performance",
      "inventory.read", "inventory.manage", "inventory.receive", "inventory.adjust",
      "documents.read", "documents.manage",
      "messaging.use",
      "attendance.clock",
    ],
  },
  {
    code: "auditeur",
    name: "Auditeur (lecture seule)",
    description: "Accès en lecture seule à tous les modules. Ne peut pas créer, modifier ni supprimer.",
    level: 15,
    isSystem: true,
    permissions: [
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
      "tasks.read", "tasks.manage",
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
