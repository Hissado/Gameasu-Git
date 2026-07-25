/**
 * Ressources Humaines — SOURCE UNIQUE DE VÉRITÉ de la navigation (§3).
 *
 * Ce fichier est le SEUL endroit où la hiérarchie du module RH est définie.
 * Il génère : le menu secondaire (HrShell), les routes (App.tsx), les fils
 * d'Ariane, les titres de page et les permissions.
 *
 * Hiérarchie : Module → Sous-module → Sous-sous-module, avec `elements[]` pour
 * le niveau 4 (types de documents / étapes de processus, rendus DANS la page).
 *
 * Non-régression : chaque nœud `ready` réutilise une page existante à sa route
 * actuelle (aucune URL cassée) ; chaque nœud `planned` pointe vers le gabarit
 * `hr/_placeholder.tsx` (jamais de page blanche ni de lien inerte, §7).
 */

export type RhPageType = "standalone" | "tabs" | "workflow" | "library" | "group";
export type RhStatus = "ready" | "planned";

export type RhNode = {
  key: string;
  label: string;
  description?: string;
  /** Route absolue (kebab-case). Absente pour un groupe pur sans page propre. */
  route?: string;
  /** Nom d'icône lucide-react (résolu par le consommateur). */
  icon?: string;
  /** Code de permission requis (frontend + backend). */
  permission?: string;
  pageType?: RhPageType;
  status?: RhStatus;
  /** Clé de registre d'un composant existant (nœuds `ready`). */
  component?: string;
  /** Niveau 4 : types de documents, étapes de processus, contenus internes. */
  elements?: string[];
  children?: RhNode[];
};

const READ = "hr.read";

export const RH_MODULE: { label: string; route: string; icon: string; children: RhNode[] } = {
  label: "Ressources Humaines",
  route: "/rh",
  icon: "UsersRound",
  children: [
    // 1 ─ Vue d'ensemble
    { key: "overview", label: "Vue d'ensemble", route: "/rh", icon: "LayoutDashboard", permission: READ, pageType: "standalone", status: "ready", component: "HrDashboard",
      description: "Vision générale du module RH : effectif, recrutements, présences, paie, mouvements, alertes et actions prioritaires." },

    // 2 ─ Simulateur de coût
    { key: "cost-simulator", label: "Simulateur de coût", route: "/rh/simulateur", icon: "Calculator", permission: READ, pageType: "standalone", status: "ready", component: "HrSimulateur",
      description: "Estimez le coût total employeur d'un collaborateur selon les règles de paie de l'organisation." },

    // 3 ─ Recrutement
    { key: "recruitment", label: "Recrutement", route: "/rh/recrutement", icon: "Briefcase", permission: "recruitment.read", pageType: "tabs", status: "ready", component: "HrRecruitment",
      description: "Pipeline de recrutement : offres, candidatures, entretiens et décisions.",
      children: [
        { key: "recruitment-applications", label: "Dossier de candidature", route: "/rh/recrutement/dossier-candidature", permission: "recruitment.read", pageType: "tabs", status: "ready", component: "HrRecruitmentApplications",
          description: "Candidatures, fiche candidat, poste, CV, lettre de motivation, entretiens, appréciations et décision." },
        { key: "recruitment-offer-letter", label: "Lettre d'embauche", route: "/rh/recrutement/lettre-embauche", permission: "recruitment.read", pageType: "workflow", status: "planned",
          elements: ["Modèles", "Génération", "Validation", "Signature", "Envoi", "Archivage"] },
        { key: "recruitment-medical", label: "Visite médicale", route: "/rh/recrutement/visite-medicale", permission: "recruitment.read", pageType: "workflow", status: "planned",
          elements: ["Demande", "Rendez-vous", "Résultat", "Aptitude", "Restrictions", "Documents justificatifs"] },
      ] },

    // 4 ─ Intégration
    { key: "onboarding", label: "Intégration", route: "/rh/integration", icon: "UserPlus", permission: READ, pageType: "tabs", status: "ready", component: "HrOnboarding",
      description: "Parcours d'intégration des nouvelles recrues.",
      children: [
        { key: "onboarding-employee-info", label: "Informations de l'employé", route: "/rh/integration/informations-employe", permission: READ, pageType: "tabs", status: "planned",
          elements: ["Informations personnelles", "Coordonnées", "Poste", "Département", "Manager", "Type de contrat", "Date d'entrée", "Salaire", "Documents", "Compte utilisateur"] },
        { key: "onboarding-insurance", label: "Création du numéro d'assurance", route: "/rh/integration/numero-assurance", permission: READ, pageType: "workflow", status: "planned",
          elements: ["Demande", "Statut", "Numéro obtenu", "Date", "Document justificatif"] },
        { key: "onboarding-nif", label: "Création du NIF", route: "/rh/integration/nif", permission: READ, pageType: "workflow", status: "planned",
          elements: ["Demande", "Statut", "Numéro fiscal", "Date", "Document justificatif"] },
      ] },

    // 5 ─ Documents légaux
    { key: "legal-docs", label: "Documents légaux", icon: "Scale", permission: READ, pageType: "group",
      description: "Documents légaux et administratifs liés au personnel.",
      children: [
        { key: "legal-personnel-docs", label: "Documents du personnel", route: "/rh/documents", permission: READ, pageType: "library", status: "ready", component: "HrDocuments" },
        { key: "legal-register", label: "Registre du personnel", route: "/rh/registre-legal", permission: READ, pageType: "standalone", status: "ready", component: "HrLegalRegister" },
        { key: "legal-labor-standards", label: "Normes de travail", route: "/rh/documents-legaux/normes-travail", permission: READ, pageType: "library", status: "planned",
          elements: ["Code du travail", "Conventions collectives", "Règlement intérieur"] },
      ] },

    // 6 ─ Paramètres
    { key: "settings", label: "Paramètres", icon: "Settings2", permission: "hr.manage", pageType: "group",
      description: "Configuration du module RH.",
      children: [
        { key: "settings-leaves", label: "Paramètres de congés", route: "/rh/politiques-conges", permission: "hr.manage_leaves", pageType: "standalone", status: "ready", component: "HrLeavePolicies" },
        { key: "settings-attendance", label: "Paramètres de pointage", route: "/rh/parametres/pointage", permission: "attendance.manage_settings", pageType: "tabs", status: "planned",
          elements: ["Horaires", "Retards", "Heures supplémentaires", "Kiosques", "Méthodes de pointage", "Tolérances", "Équipes"] },
        { key: "settings-payroll", label: "Paramètres de paie", route: "/rh/parametres/paie", permission: "hr.manage_payroll", pageType: "tabs", status: "planned",
          elements: ["Calendrier", "Règles", "Barèmes", "Éléments fixes", "Éléments variables", "Modes de paiement", "Règles d'arrondi"] },
        { key: "settings-appraisal", label: "Paramètres de notation et objectifs", route: "/rh/parametres/notation", permission: "hr.manage", pageType: "tabs", status: "planned",
          elements: ["Cycles d'évaluation", "Critères", "Objectifs", "Pondérations", "Échelles de notation", "Workflows d'approbation"] },
        { key: "settings-tax", label: "Fiscalité RH", route: "/rh/fiscalite", permission: "hr.manage_payroll", pageType: "standalone", status: "ready", component: "HrTaxSettings" },
        { key: "settings-sector", label: "Paramètres sectoriels", route: "/rh/btp-parametres", permission: "hr.manage", pageType: "standalone", status: "ready", component: "BtpSettings" },
      ] },

    // 7 ─ Documents du personnel
    { key: "personnel-docs", label: "Documents du personnel", icon: "FileSignature", permission: "hr.manage_contracts", pageType: "group",
      children: [
        { key: "personnel-templates", label: "Modèles", route: "/rh/modeles-contrats", permission: "hr.manage_contracts", pageType: "library", status: "ready", component: "HrContractTemplates",
          elements: ["CDI", "CDD", "Contrat de projet", "Contrat saisonnier", "Contrat à temps partiel", "Contrat de tâcheronnat", "Contrat d'apprentissage", "Convention de stage", "Attestation de travail", "Certificat de travail"] },
        { key: "personnel-signed", label: "Contrats signés", route: "/rh/contrats", permission: "hr.manage_contracts", pageType: "standalone", status: "ready", component: "HrContracts",
          elements: ["En attente", "Signés", "Expirés", "Renouvellements", "Téléchargements", "Historique"] },
        { key: "personnel-sanctions", label: "Sanctions", route: "/rh/documents-personnel/sanctions", permission: "hr.manage", pageType: "workflow", status: "planned",
          elements: ["Processus de sanction", "Blâme", "Lettre d'avertissement", "Mise à pied simple", "Mise à pied aggravée", "Mutation d'office", "Rétrogradation", "Licenciement pour motif personnel", "Licenciement pour motif économique"] },
      ] },

    // 8 ─ Structure
    { key: "structure", label: "Structure", icon: "Network", permission: READ, pageType: "group",
      children: [
        { key: "structure-positions", label: "Postes", route: "/rh/postes", permission: READ, pageType: "standalone", status: "ready", component: "HrPositions" },
        { key: "structure-departments", label: "Départements", route: "/rh/departements", permission: "departments.read", pageType: "standalone", status: "ready", component: "HrDepartments" },
        { key: "structure-movements", label: "Mouvements du personnel", route: "/rh/mouvements", permission: READ, pageType: "workflow", status: "ready", component: "HrMovements",
          elements: ["Formation", "Affectation", "Promotion", "Départs (démission, licenciement, rupture conventionnelle, décès, fin de CDD, force majeure)", "Retraite"] },
        { key: "structure-assignments", label: "Affectations", route: "/rh/affectations", permission: READ, pageType: "standalone", status: "ready", component: "HrAssignments" },
        { key: "structure-orgchart", label: "Organigramme", route: "/rh/organigramme", permission: READ, pageType: "standalone", status: "ready", component: "HrOrgchart" },
      ] },

    // 9 ─ Notation & Rapports
    { key: "appraisal-reports", label: "Notation & Rapports", icon: "BarChart3", permission: READ, pageType: "group",
      children: [
        { key: "reports-indicators", label: "Indicateurs", route: "/rh/indicateurs", permission: READ, pageType: "standalone", status: "ready", component: "HrIndicators",
          elements: ["Effectif", "Absentéisme", "Rotation", "Masse salariale", "Ancienneté", "Recrutement", "Performance", "Formation"] },
        { key: "reports-reports", label: "Rapports", route: "/rh/rapports", permission: "hr.export", pageType: "standalone", status: "ready", component: "HrReports" },
        { key: "reports-evaluations", label: "Évaluations", route: "/rh/evaluations", permission: READ, pageType: "standalone", status: "ready", component: "HrEvaluations" },
        { key: "reports-training", label: "Formations", route: "/rh/formations", permission: READ, pageType: "standalone", status: "ready", component: "HrTraining" },
        { key: "reports-intelligence", label: "Intelligence RH", route: "/rh/intelligence", permission: READ, pageType: "standalone", status: "ready", component: "HrIntelligence" },
      ] },

    // 10 ─ Pointage
    { key: "attendance", label: "Pointage", icon: "ClipboardCheck", permission: "attendance.view", pageType: "group",
      children: [
        { key: "attendance-kiosk", label: "Kiosque", route: "/kiosques", permission: "attendance.manage_settings", pageType: "standalone", status: "ready", component: "KioskManagement" },
        { key: "attendance-presence", label: "Présence & absence", route: "/presences", permission: "attendance.view", pageType: "standalone", status: "ready", component: "AttendancePage" },
        { key: "attendance-grid", label: "Grille de pointage", route: "/rh/btp-pointage", permission: "attendance.view", pageType: "standalone", status: "ready", component: "BtpPointage" },
        { key: "attendance-timesheets", label: "Feuilles de temps", route: "/rh/feuilles-temps", permission: "attendance.view", pageType: "standalone", status: "ready", component: "HrTimesheets" },
        { key: "attendance-calendar", label: "Calendrier d'équipe", route: "/rh/calendrier-equipe", permission: READ, pageType: "standalone", status: "ready", component: "HrTeamCalendar" },
        { key: "attendance-leaves", label: "Absences & congés", route: "/rh/conges", permission: "hr.manage_leaves", pageType: "standalone", status: "ready", component: "HrLeaves" },
        { key: "attendance-sickness", label: "Maladie", route: "/rh/pointage/maladie", permission: "attendance.view", pageType: "workflow", status: "planned",
          elements: ["Déclaration de la maladie", "Pièces justificatives"] },
        { key: "attendance-accident", label: "Accident", route: "/rh/pointage/accident", permission: "attendance.view", pageType: "workflow", status: "planned",
          elements: ["Déclaration de l'accident", "Pièces justificatives"] },
        { key: "attendance-permissions", label: "Permissions", route: "/rh/pointage/permissions", permission: "attendance.view", pageType: "workflow", status: "planned",
          elements: ["Demande", "Étude de la demande", "Pièces justificatives"] },
        { key: "attendance-travel", label: "Déplacement professionnel", route: "/rh/pointage/deplacements", permission: "attendance.view", pageType: "workflow", status: "planned",
          elements: ["Demande", "Étude de la demande", "Pièces justificatives"] },
        { key: "attendance-mission", label: "Mission", route: "/rh/pointage/missions", permission: "attendance.view", pageType: "workflow", status: "planned",
          elements: ["Demande", "Étude de la demande", "Pièces justificatives"] },
      ] },

    // 11 ─ Paie
    { key: "payroll", label: "Paie", icon: "Banknote", permission: "hr.manage_payroll", pageType: "group",
      children: [
        { key: "payroll-calendar", label: "Calendrier de paie", route: "/rh/paie/calendrier", permission: "hr.manage_payroll", pageType: "standalone", status: "ready", component: "HrPayrollCalendar" },
        { key: "payroll-payslips", label: "Bulletins de paie", route: "/rh/paie", permission: "hr.manage_payroll", pageType: "tabs", status: "ready", component: "HrPayroll",
          elements: ["Salaire de base", "Sursalaire", "Avantages en nature", "Primes", "Indemnités", "Avance sur salaire", "Note de frais"] },
        { key: "payroll-states", label: "États de salaires", route: "/rh/etats-paie", permission: "hr.manage_payroll", pageType: "standalone", status: "ready", component: "EtatsSalaires" },
        { key: "payroll-advances", label: "Avances sur salaire", route: "/rh/avances-salaire", permission: "hr.manage_payroll", pageType: "standalone", status: "ready", component: "HrSalaryAdvances" },
        { key: "payroll-benefits", label: "Avantages", route: "/rh/avantages", permission: "hr.manage_payroll", pageType: "standalone", status: "ready", component: "HrBenefits" },
        { key: "payroll-expenses", label: "Notes de frais", route: "/rh/notes-frais", permission: "hr.manage_expenses", pageType: "standalone", status: "ready", component: "HrExpenses" },
        { key: "payroll-ordinary-leave", label: "Congés ordinaires", route: "/rh/paie/conges-ordinaires", permission: "hr.manage_payroll", pageType: "tabs", status: "planned",
          elements: ["Indemnités de congés", "Congés acquis", "Congés jouis"] },
        { key: "payroll-maternity-leave", label: "Congés de maternité", route: "/rh/paie/conges-maternite", permission: "hr.manage_payroll", pageType: "standalone", status: "planned" },
        { key: "payroll-sick-leave", label: "Congés maladie", route: "/rh/paie/conges-maladie", permission: "hr.manage_payroll", pageType: "standalone", status: "planned" },
        { key: "payroll-payments", label: "Paiement", route: "/rh/paie/paiements", permission: "hr.manage_payroll", pageType: "workflow", status: "planned",
          elements: ["En espèces", "Par chèque", "Par mobile money", "Par virement"] },
        { key: "payroll-transfers", label: "Virements", route: "/rh/virements", permission: "hr.manage_payroll", pageType: "standalone", status: "ready", component: "HrTransferOrders" },
        { key: "payroll-corrections", label: "Correction", route: "/rh/paie/corrections", permission: "hr.manage_payroll", pageType: "standalone", status: "ready", component: "HrPayrollCorrections" },
        { key: "payroll-off-cycle", label: "Hors-cycle", route: "/rh/paie/hors-cycle", permission: "hr.manage_payroll", pageType: "standalone", status: "ready", component: "HrPayrollOffCycle" },
        { key: "payroll-final-settlement", label: "Solde de tout compte", route: "/rh/paie/solde-tout-compte", permission: "hr.manage_payroll", pageType: "workflow", status: "planned",
          elements: ["Calcul", "Congés restants", "Salaires dus", "Retenues", "Indemnités", "Validation", "Génération du document", "Paiement"] },
      ] },

    // 12 ─ Formalités administratives
    { key: "admin-formalities", label: "Formalités administratives", icon: "ClipboardList", permission: "hr.manage_payroll", pageType: "group",
      children: [
        { key: "formalities-social", label: "Cotisations sociales", route: "/rh/formalites-administratives/cotisations-sociales", permission: "hr.manage_payroll", pageType: "workflow", status: "planned",
          elements: ["Calcul", "Déclaration", "Échéance", "Paiement", "Pièces justificatives", "Historique"] },
        { key: "formalities-irpp", label: "IRPP", route: "/rh/formalites-administratives/irpp", permission: "hr.manage_payroll", pageType: "workflow", status: "planned",
          elements: ["Calcul", "Période", "Déclaration", "Paiement", "Régularisation"] },
        { key: "formalities-declarations", label: "Déclarations sociales", route: "/rh/paie/declarations", permission: "hr.manage_payroll", pageType: "standalone", status: "ready", component: "HrPayrollDeclarations" },
        { key: "formalities-das", label: "DAS", route: "/rh/formalites-administratives/das", permission: "hr.manage_payroll", pageType: "workflow", status: "planned",
          elements: ["Préparation", "Contrôle", "Validation", "Export", "Archivage"] },
      ] },

    // 13 ─ Archivage
    { key: "archiving", label: "Archivage", route: "/rh/archivage", icon: "Archive", permission: "hr.view_sensitive", pageType: "standalone", status: "planned",
      description: "Dossiers archivés, contrats, collaborateurs sortis, bulletins, documents légaux et sanctions.",
      elements: ["Dossiers archivés", "Contrats", "Collaborateurs sortis", "Bulletins", "Documents légaux", "Sanctions", "Recherche", "Restauration", "Durée de conservation"] },

    // 14 ─ Réclamations & Suggestions
    { key: "claims", label: "Réclamations & Suggestions", route: "/rh/reclamations", icon: "MessageSquareWarning", permission: READ, pageType: "standalone", status: "ready", component: "HrReclamations" },

    // 15 ─ Journal d'audit
    { key: "audit-log", label: "Journal d'audit", route: "/rh/journal-audit", icon: "ShieldCheck", permission: "audit.read", pageType: "standalone", status: "ready", component: "HrAuditLog" },
  ],
};

// ── Dérivés (consommés par App.tsx, HrShell, breadcrumbs) ────────────────────

export type RhRouteEntry = { route: string; component?: string; node: RhNode; trail: RhNode[] };

/** Aplatit l'arbre en liste de routes (nœuds portant une `route`). */
export function rhRouteEntries(): RhRouteEntry[] {
  const out: RhRouteEntry[] = [];
  const walk = (nodes: RhNode[], trail: RhNode[]) => {
    for (const n of nodes) {
      const nextTrail = [...trail, n];
      if (n.route) out.push({ route: n.route, component: n.component, node: n, trail: nextTrail });
      if (n.children) walk(n.children, nextTrail);
    }
  };
  walk(RH_MODULE.children, []);
  return out;
}

/** Fil d'Ariane pour une route donnée : Ressources Humaines → … → page. */
export function rhBreadcrumb(path: string): { label: string; route?: string }[] {
  const entry = rhRouteEntries().find((e) => e.route === path);
  const crumbs: { label: string; route?: string }[] = [{ label: RH_MODULE.label, route: RH_MODULE.route }];
  if (!entry) return crumbs;
  for (const n of entry.trail) {
    if (n.route === RH_MODULE.route) continue; // évite le doublon « Ressources Humaines »
    crumbs.push({ label: n.label, route: n.route });
  }
  return crumbs;
}
