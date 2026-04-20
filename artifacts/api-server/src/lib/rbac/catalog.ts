/**
 * Catalogue de permissions FP&A / RBAC EDOLE.
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
  { code: "projects.read_all", label: "Voir TOUS les projets (bypass ACL)", category: "Projets" },
  { code: "projects.create", label: "Créer un projet", category: "Projets" },
  { code: "projects.update", label: "Modifier un projet", category: "Projets" },
  { code: "projects.delete", label: "Supprimer / archiver un projet", category: "Projets" },

  // ─── Tâches ─────────────────────────────────────────────────────
  { code: "tasks.read", label: "Voir les tâches", category: "Tâches" },
  { code: "tasks.manage", label: "Créer / modifier / supprimer des tâches", category: "Tâches" },

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
      "users.read", "departments.read", "hr.read",
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
      "projects.read",
      "tasks.read",
      "commercial.read", "commercial.manage",
      "documents.read", "documents.manage",
      "messaging.use",
      "marketing.read", "marketing.manage",
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
      "projects.read",
      "tasks.read", "tasks.manage",
      "equipment.read",
      "documents.read",
      "messaging.use",
    ],
  },
];
