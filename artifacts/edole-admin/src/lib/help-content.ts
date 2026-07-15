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

  /* ─── Mon espace (portail RH collaborateur) ─────────────────────── */
  "myspace.conges":
    "Soumettez et suivez vos demandes de congés : planifiées, en attente de validation ou approuvées.",
  "myspace.soldes":
    "Visualisez vos droits acquis, les jours pris et votre solde restant pour chaque type de congé.",
  "myspace.bulletins":
    "Accédez à vos bulletins de paie mensuels et téléchargez-les en PDF.",
  "myspace.cotisations":
    "Détail de vos cotisations CNSS et fiscales prélevées chaque mois sur votre rémunération.",
  "myspace.documents":
    "Documents RH vous concernant : contrats, avenants et pièces administratives conservées dans l'ERP.",
  "myspace.attestations":
    "Demandez et téléchargez vos attestations de travail, de salaire ou de présence.",
  "myspace.virements":
    "Historique de vos virements de salaire et coordonnées de votre compte bancaire de paiement.",
  "myspace.reclamations":
    "Soumettez une réclamation ou un signalement et suivez son traitement par le service RH.",

  /* ─── Mon espace général (portail employé) ──────────────────────── */
  "monespace.travaux":
    "Vos tâches et actions en cours : activités assignées, priorités et avancement de vos travaux.",
  "monespace.dashboard":
    "Tableau de bord RH personnel : vos indicateurs de performance, absences et points clés du mois.",
  "monespace.payslips":
    "Vos bulletins de paie mensuels : consultez et téléchargez vos fiches de rémunération.",
  "monespace.leaves":
    "Gérez vos demandes de congés et consultez vos soldes par type de congé.",
  "monespace.contract":
    "Détails de votre contrat de travail : type, dates, rémunération et avenant en vigueur.",
  "monespace.documents":
    "Vos documents RH : contrats, attestations et pièces administratives partagées par l'entreprise.",
  "monespace.training":
    "Vos formations suivies et à venir : progression, certificats obtenus et plan de développement.",
  "monespace.reclamations":
    "Soumettez une réclamation ou consultez le suivi des demandes que vous avez déposées.",
  "monespace.profil":
    "Vos informations personnelles et professionnelles : mettez à jour vos coordonnées et préférences.",

  /* ─── Finance Intelligence ──────────────────────────────────────── */
  "finance.intelligence.forecast":
    "Projection des entrées et sorties de trésorerie sur les 30, 60 et 90 prochains jours.",
  "finance.intelligence.aging":
    "Classement des créances et dettes par ancienneté : identifiez les retards les plus critiques.",
  "finance.intelligence.anomalies":
    "Transactions inhabituelles détectées automatiquement : montants atypiques, doublons suspects et erreurs.",
  "finance.intelligence.collections":
    "Actions de recouvrement en cours : clients relancés, montants en attente et prochaines étapes.",

  /* ─── Fiche client ───────────────────────────────────────────────── */
  "clients.detail.360":
    "Vue synthétique du client : activité récente, KPIs financiers et historique des interactions.",
  "clients.detail.tree":
    "Structure du client : hiérarchie, contacts clés et entités rattachées à ce compte.",
  "clients.detail.engagements":
    "Missions et services en cours pour ce client : avancement, livrables et responsables assignés.",
  "clients.detail.projects":
    "Projets actifs et passés pour ce client : budget, calendrier et statut d'avancement.",
  "clients.detail.communication":
    "Historique des échanges avec ce client : e-mails envoyés, notes et documents partagés.",
  "clients.detail.messaging":
    "Messagerie directe avec ce client : fil de conversation et pièces jointes échangées.",
  "clients.detail.notes":
    "Notes internes sur ce client : observations, mémos et points de contact de l'équipe commerciale.",
  "clients.detail.journal":
    "Journal d'activité complet : toutes les actions et événements enregistrés sur ce compte client.",

  /* ─── Achats — Approbations ─────────────────────────────────────── */
  "achats.approbations.invoices":
    "Factures fournisseurs en attente de validation : approuvez ou rejetez chaque demande de paiement.",
  "achats.approbations.pos":
    "Bons de commande soumis pour approbation : vérifiez les montants, fournisseurs et justifications.",
  "achats.approbations.expenses":
    "Notes de frais en attente : validez les dépenses soumises par vos collaborateurs.",

  /* ─── Réclamations RH — statuts supplémentaires ─────────────────── */
  "hr.reclamations.infos_complementaires":
    "Réclamations en attente d'informations supplémentaires de la part du collaborateur.",
  "hr.reclamations.en_traitement":
    "Réclamations prises en charge et en cours d'instruction par le service compétent.",
};

/**
 * Récupère la description d'un élément par sa clé.
 * Retourne undefined si la clé n'existe pas dans le dictionnaire.
 */
export function getHelpContent(key: string): string | undefined {
  return HELP_CONTENT[key];
}
