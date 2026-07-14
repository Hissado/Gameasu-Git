/**
 * Dictionnaire centralisé des descriptions contextuelles.
 * Couvre tous les onglets, sous-sections et fonctionnalités de l'ERP.
 * Modifier ici pour mettre à jour automatiquement tous les affichages.
 */
export const HELP_CONTENT: Record<string, string> = {

  /* ─── Paramètres ────────────────────────────────────────────────── */
  "settings.profile":
    "Modifiez vos informations personnelles : nom, photo, adresse e-mail et langue d'affichage.",
  "settings.security":
    "Gérez votre mot de passe, l'authentification à deux facteurs et les appareils de confiance.",
  "settings.subscription":
    "Consultez votre formule Gaméasù, les modules inclus et les options de mise à niveau disponibles.",
  "settings.notifications":
    "Choisissez les événements qui vous envoient une notification et le canal utilisé (e-mail, in-app).",
  "settings.regional":
    "Configurez le fuseau horaire, la langue et le format des dates et montants pour votre espace.",
  "settings.attendance":
    "Paramétrez les règles de pointage : horaires, tolérance de retard et méthodes d'identification.",
  "settings.modules":
    "Activez ou désactivez les modules disponibles dans votre formule selon les besoins de l'organisation.",
  "settings.permissions":
    "Définissez les droits d'accès par rôle : quelles actions chaque profil peut réaliser dans l'ERP.",
  "settings.comptabilite":
    "Configurez le référentiel comptable : exercice fiscal, plan de comptes SYSCOHADA et journaux actifs.",
  "settings.danger":
    "Actions irréversibles : réinitialisation des données, suppression de l'organisation ou transfert de propriété.",

  /* ─── Rapports financiers ───────────────────────────────────────── */
  "reports.billing":
    "Synthèse des ventes facturées : revenus par période, clients, projets et répartition par statut de paiement.",
  "reports.decaissements":
    "Analyse des sorties de trésorerie : paiements fournisseurs, dépenses et charges par catégorie.",
  "reports.balance":
    "Balance générale des comptes : soldes débiteurs, créditeurs et contrôle de l'équilibre comptable.",
  "reports.income_statement":
    "Compte de résultat SYSCOHADA : produits, charges, résultat net et comparaison avec l'exercice précédent.",
  "reports.balance_sheet":
    "Bilan comptable : actif (immobilisations, créances, trésorerie) et passif (capitaux, dettes) à une date donnée.",
  "reports.cash_flow":
    "Tableau des flux de trésorerie : encaissements, décaissements et variation de la position de cash.",
  "reports.fiscal":
    "Synthèse fiscale : TVA collectée et déductible, retenues à la source et obligations déclaratives.",
  "reports.reconciliation":
    "Rapprochement bancaire : concordance entre les relevés bancaires et les écritures comptables.",
  "reports.management":
    "Rapport de gestion complet : KPIs exécutifs, analyse de performance et commentaires de direction.",

  /* ─── CRM ───────────────────────────────────────────────────────── */
  "crm.pipeline":
    "Suivi des opportunités commerciales en kanban : stade, valeur, probabilité et prochaine action planifiée.",
  "crm.scoring":
    "Classement automatique des opportunités selon leur potentiel : score de chaleur, signaux d'achat et priorités.",
  "crm.ia":
    "Recommandations IA sur le pipeline : opportunités à relancer, risques de perte et actions suggérées.",

  /* ─── Congés ────────────────────────────────────────────────────── */
  "hr.leaves.demandes":
    "Liste de toutes les demandes de congés : en attente, approuvées, refusées et en cours.",
  "hr.leaves.soldes":
    "Soldes de congés par collaborateur : droits acquis, pris, restants et report d'une période à l'autre.",

  /* ─── Avantages et conformité RH ────────────────────────────────── */
  "hr.benefits.benefits":
    "Avantages accordés aux collaborateurs : mutuelle, primes, véhicule de fonction et autres bénéfices.",
  "hr.benefits.signatures":
    "Contrats et documents à signer électroniquement : statut de signature et historique des validations.",
  "hr.benefits.declarations":
    "Déclarations fiscales et sociales : récapitulatifs des retenues à la source et des cotisations patronales.",

  /* ─── Onboarding collaborateurs ─────────────────────────────────── */
  "hr.onboarding.processes":
    "Parcours d'intégration en cours : étapes complétées, actions en attente et responsables assignés.",
  "hr.onboarding.completed":
    "Intégrations terminées : historique des collaborateurs ayant achevé leur parcours d'entrée.",
  "hr.onboarding.templates":
    "Modèles de parcours d'intégration réutilisables : créez et personnalisez des listes d'étapes types.",

  /* ─── Réclamations RH ───────────────────────────────────────────── */
  "hr.reclamations.all":
    "Vue complète de toutes les réclamations soumises, quel que soit leur statut.",
  "hr.reclamations.soumise":
    "Réclamations nouvellement soumises, en attente d'une première prise en charge.",
  "hr.reclamations.en_cours":
    "Réclamations assignées à un responsable et en cours d'analyse.",
  "hr.reclamations.resolue":
    "Réclamations pour lesquelles une réponse ou une solution a été apportée.",
  "hr.reclamations.cloturee":
    "Réclamations officiellement closes et archivées.",

  /* ─── Détail projet ─────────────────────────────────────────────── */
  "projects.detail.overview":
    "Résumé du projet : avancement global, budget consommé, équipe affectée et prochains jalons.",
  "projects.detail.timeline":
    "Calendrier des phases et tâches du projet : visualisez les dépendances et les délais critiques.",
  "projects.detail.intelligence":
    "Analyse IA du projet : risques détectés, recommandations de planning et comparaison avec des projets similaires.",

  /* ─── Détail collaborateur ──────────────────────────────────────── */
  "collaborators.detail.identity":
    "Informations d'identité : nom, photo, contacts, adresse et pièces d'identité.",
  "collaborators.detail.pro":
    "Informations professionnelles : poste, département, date d'embauche, manager et statut contractuel.",
  "collaborators.detail.salary":
    "Rémunération : salaire de base, primes, retenues et historique des révisions salariales.",
  "collaborators.detail.bank":
    "Coordonnées bancaires pour le virement de la paie : IBAN, banque et agence.",
  "collaborators.detail.emergency":
    "Contact d'urgence à prévenir en cas d'incident : nom, lien de parenté et numéro de téléphone.",

  /* ─── Comptabilité analytique ───────────────────────────────────── */
  "accounting.analytical.cc":
    "Répartition des charges et produits par centre de coût : identifiez les unités rentables et déficitaires.",
  "accounting.analytical.project":
    "Résultats financiers par projet : revenus, dépenses, marge brute et taux de réalisation budgétaire.",
  "accounting.analytical.client":
    "Analyse de la rentabilité par client : chiffre d'affaires, coûts directs et contribution marginale.",
  "accounting.analytical.contribution":
    "Tableau de contribution : calcul de la marge sur coûts variables par activité ou segment.",
  "accounting.analytical.income":
    "Compte de résultat analytique : décomposition du résultat par centre ou activité.",

  /* ─── Paie ──────────────────────────────────────────────────────── */
  "hr.payroll.cycles":
    "Cycles de paie en cours : préparation, contrôle et validation des bulletins du mois.",
  "hr.payroll.bulletins":
    "Bulletins de paie générés : accès aux documents PDF et historique par collaborateur.",
  "hr.payroll.corrections":
    "Corrections de paie : ajustements d'éléments variables après la clôture initiale.",
  "hr.payroll.declarations":
    "Déclarations sociales et fiscales liées à la paie : CNSS, retenues à la source et bordereau.",

  /* ─── Recrutement ───────────────────────────────────────────────── */
  "hr.recruitment.offers":
    "Offres d'emploi publiées : postes ouverts, candidatures reçues et statut de chaque annonce.",
  "hr.recruitment.pipeline":
    "Pipeline de recrutement : candidats en cours d'évaluation, entretiens planifiés et décisions.",
  "hr.recruitment.interviews":
    "Entretiens programmés : date, heure, intervieweurs et notes d'évaluation après chaque rencontre.",

  /* ─── Équipements ───────────────────────────────────────────────── */
  "equipment.list":
    "Inventaire complet des équipements : état, catégorie, responsable et localisation actuelle.",
  "equipment.availability":
    "Calendrier de disponibilité : créneaux libres et occupés pour chaque équipement.",
  "equipment.maintenance":
    "Historique et planification des maintenances préventives et correctives.",

  /* ─── Trésorerie ────────────────────────────────────────────────── */
  "finance.tresorerie.overview":
    "Position de trésorerie en temps réel : soldes bancaires, encaissements et décaissements du jour.",
  "finance.tresorerie.forecast":
    "Prévisions de trésorerie sur 30, 60 et 90 jours : anticipez les besoins de financement.",
  "finance.tresorerie.reconciliation":
    "Rapprochement des relevés bancaires avec les écritures : identifiez les écarts non justifiés.",

  /* ─── FP&A ──────────────────────────────────────────────────────── */
  "fpa.dashboard":
    "Tableau de bord FP&A : taux d'exécution budgétaire, écarts significatifs et projection de fin d'année.",
  "fpa.budgets":
    "Budgets versionnés : créez, activez et comparez les différentes versions de vos prévisions.",
  "fpa.variance":
    "Analyse des écarts budget/réalisé : identifiez les postes en dépassement ou sous-consommation.",
  "fpa.forecast":
    "Forecast glissant : actualisez les prévisions en intégrant les réalisations récentes.",
  "fpa.by_project":
    "Synthèse budgétaire par projet : charges, produits, marge et consommation du budget alloué.",
  "fpa.by_department":
    "Répartition budgétaire par département : performance des centres de responsabilité.",

  /* ─── Achats / Dashboard ────────────────────────────────────────── */
  "achats.dashboard":
    "Tableau de bord achats : dépenses du mois, fournisseurs actifs, commandes en cours et alertes d'échéances.",
  "achats.rapports.aging":
    "Balance âgée fournisseurs : créances classées par ancienneté pour identifier les retards de paiement.",
  "achats.rapports.by_period":
    "Évolution des achats par période : tendances mensuelles et saisonnalités des dépenses fournisseurs.",
  "achats.rapports.by_supplier":
    "Analyse par fournisseur : volumes d'achat, délais de paiement et part dans les dépenses totales.",
  "achats.rapports.unpaid":
    "Factures fournisseurs impayées : montants en souffrance et délais de règlement dépassés.",

  /* ─── Portail Expert ────────────────────────────────────────────── */
  "expert.dashboard":
    "Vue consolidée du cabinet : clients actifs, documents en attente et missions en cours.",
  "expert.clients":
    "Liste de vos clients connectés : accès à leur espace, statut de synchronisation et dernière activité.",
  "expert.documents":
    "Demandes de documents envoyées à vos clients : statut de réception et relances en attente.",

  /* ─── Recouvrement ──────────────────────────────────────────────── */
  "recouvrement.all":
    "Toutes les créances clients, quel que soit leur retard.",
  "recouvrement.1_30":
    "Créances en retard de 1 à 30 jours : zone de surveillance — des relances préventives sont recommandées.",
  "recouvrement.31_60":
    "Créances en retard de 31 à 60 jours : risque modéré — engagez une relance formelle.",
  "recouvrement.61_90":
    "Créances en retard de 61 à 90 jours : risque élevé — envisagez une mise en demeure.",
  "recouvrement.90plus":
    "Créances de plus de 90 jours : risque critique — actions juridiques ou provisionnement à considérer.",
};

/**
 * Récupère la description d'un élément par sa clé.
 * Retourne undefined si la clé n'existe pas dans le dictionnaire.
 */
export function getHelpContent(key: string): string | undefined {
  return HELP_CONTENT[key];
}
