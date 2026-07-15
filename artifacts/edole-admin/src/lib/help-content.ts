/**
 * Dictionnaire centralisé des descriptions contextuelles.
 * Couvre tous les onglets, sous-sections et fonctionnalités de l'ERP.
 * Style uniforme : verbe d'action à l'impératif + éléments gérés + bénéfice.
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
    "Procédez aux actions irréversibles : réinitialisation des données, suppression ou transfert de propriété.",

  /* ─── Rapports financiers ───────────────────────────────────────── */
  "reports.billing":
    "Analysez vos ventes facturées : revenus par période, clients, projets et répartition par statut de paiement.",
  "reports.decaissements":
    "Analysez vos sorties de trésorerie : paiements fournisseurs, dépenses et charges par catégorie.",
  "reports.balance":
    "Consultez la balance générale de vos comptes : soldes débiteurs, créditeurs et équilibre comptable.",
  "reports.income_statement":
    "Générez votre compte de résultat SYSCOHADA : produits, charges, résultat net et comparaison annuelle.",
  "reports.balance_sheet":
    "Éditez votre bilan comptable : actif (immobilisations, créances, trésorerie) et passif (capitaux, dettes) à une date donnée.",
  "reports.cash_flow":
    "Visualisez votre tableau des flux de trésorerie : encaissements, décaissements et variation de position de cash.",
  "reports.fiscal":
    "Consultez votre synthèse fiscale : TVA collectée et déductible, retenues à la source et obligations déclaratives.",
  "reports.reconciliation":
    "Effectuez votre rapprochement bancaire : vérifiez la concordance entre relevés bancaires et écritures comptables.",
  "reports.management":
    "Générez votre rapport de gestion complet : KPIs exécutifs, analyse de performance et commentaires de direction.",

  /* ─── CRM ───────────────────────────────────────────────────────── */
  "crm.pipeline":
    "Suivez vos opportunités commerciales en kanban : stade, valeur, probabilité et prochaine action planifiée.",
  "crm.scoring":
    "Priorisez vos opportunités grâce au scoring automatique : score de chaleur, signaux d'achat et recommandations.",
  "crm.ia":
    "Exploitez les recommandations IA sur votre pipeline : opportunités à relancer, risques de perte et actions suggérées.",

  /* ─── Congés ────────────────────────────────────────────────────── */
  "hr.leaves.demandes":
    "Consultez et traitez toutes les demandes de congés : en attente, approuvées, refusées et en cours.",
  "hr.leaves.soldes":
    "Consultez les soldes de congés par collaborateur : droits acquis, jours pris, restants et reports.",

  /* ─── Avantages et conformité RH ────────────────────────────────── */
  "hr.benefits.benefits":
    "Gérez les avantages accordés à vos collaborateurs : mutuelle, primes, véhicule de fonction et bénéfices divers.",
  "hr.benefits.signatures":
    "Gérez les signatures électroniques de vos contrats et documents : statut et historique des validations.",
  "hr.benefits.declarations":
    "Consultez et téléchargez vos déclarations fiscales et sociales : retenues à la source et cotisations patronales.",

  /* ─── Onboarding collaborateurs ─────────────────────────────────── */
  "hr.onboarding.processes":
    "Suivez les parcours d'intégration en cours : étapes complétées, actions en attente et responsables assignés.",
  "hr.onboarding.completed":
    "Consultez les intégrations terminées : historique des collaborateurs ayant achevé leur parcours d'entrée.",
  "hr.onboarding.templates":
    "Créez et personnalisez vos modèles de parcours d'intégration réutilisables : listes d'étapes types.",

  /* ─── Réclamations RH ───────────────────────────────────────────── */
  "hr.reclamations.all":
    "Consultez toutes les réclamations soumises, quel que soit leur statut.",
  "hr.reclamations.soumise":
    "Traitez les réclamations nouvellement soumises, en attente d'une première prise en charge.",
  "hr.reclamations.en_cours":
    "Suivez les réclamations assignées à un responsable et en cours d'analyse.",
  "hr.reclamations.resolue":
    "Consultez les réclamations pour lesquelles une réponse ou une solution a été apportée.",
  "hr.reclamations.cloturee":
    "Consultez les réclamations officiellement closes et archivées.",

  /* ─── Détail projet ─────────────────────────────────────────────── */
  "projects.detail.overview":
    "Consultez le résumé du projet : avancement global, budget consommé, équipe affectée et prochains jalons.",
  "projects.detail.timeline":
    "Visualisez le calendrier des phases et tâches : dépendances, chemin critique et délais du projet.",
  "projects.detail.intelligence":
    "Exploitez l'analyse IA du projet : risques détectés, recommandations de planning et benchmarks sectoriels.",

  /* ─── Détail collaborateur ──────────────────────────────────────── */
  "collaborators.detail.identity":
    "Consultez et mettez à jour les informations d'identité : nom, photo, contacts, adresse et pièces.",
  "collaborators.detail.pro":
    "Gérez les informations professionnelles : poste, département, date d'embauche, manager et statut contractuel.",
  "collaborators.detail.salary":
    "Consultez la rémunération : salaire de base, primes, retenues et historique des révisions salariales.",
  "collaborators.detail.bank":
    "Renseignez les coordonnées bancaires pour le virement de la paie : IBAN, banque et agence.",
  "collaborators.detail.emergency":
    "Enregistrez le contact d'urgence à prévenir en cas d'incident : nom, lien de parenté et numéro.",

  /* ─── Comptabilité analytique ───────────────────────────────────── */
  "accounting.analytical.cc":
    "Analysez la répartition des charges et produits par centre de coût : identifiez les unités rentables et déficitaires.",
  "accounting.analytical.project":
    "Analysez les résultats financiers par projet : revenus, dépenses, marge brute et taux de réalisation budgétaire.",
  "accounting.analytical.client":
    "Mesurez la rentabilité par client : chiffre d'affaires, coûts directs et contribution marginale.",
  "accounting.analytical.contribution":
    "Calculez et visualisez votre tableau de contribution : marge sur coûts variables par activité ou segment.",
  "accounting.analytical.income":
    "Éditez votre compte de résultat analytique : décomposition du résultat par centre ou activité.",

  /* ─── Paie ──────────────────────────────────────────────────────── */
  "hr.payroll.cycles":
    "Préparez, contrôlez et validez les cycles de paie en cours et les bulletins du mois.",
  "hr.payroll.bulletins":
    "Accédez aux bulletins de paie générés : téléchargez les PDF et consultez l'historique par collaborateur.",
  "hr.payroll.corrections":
    "Saisissez les corrections de paie : ajustez les éléments variables après la clôture initiale.",
  "hr.payroll.declarations":
    "Générez vos déclarations sociales et fiscales liées à la paie : CNSS, retenues à la source et bordereaux.",

  /* ─── Recrutement ───────────────────────────────────────────────── */
  "hr.recruitment.offers":
    "Publiez et gérez vos offres d'emploi : postes ouverts, candidatures reçues et statut de chaque annonce.",
  "hr.recruitment.pipeline":
    "Suivez votre pipeline de recrutement : candidats en évaluation, entretiens planifiés et décisions.",
  "hr.recruitment.interviews":
    "Planifiez et suivez vos entretiens : date, heure, intervieweurs et notes d'évaluation après chaque rencontre.",

  /* ─── Équipements ───────────────────────────────────────────────── */
  "equipment.list":
    "Consultez l'inventaire complet de vos équipements : état, catégorie, responsable et localisation actuelle.",
  "equipment.availability":
    "Consultez le calendrier de disponibilité : créneaux libres et occupés pour chaque équipement.",
  "equipment.maintenance":
    "Planifiez et suivez les maintenances préventives et correctives de vos équipements.",

  /* ─── Trésorerie ────────────────────────────────────────────────── */
  "finance.tresorerie.overview":
    "Consultez votre position de trésorerie en temps réel : soldes bancaires, encaissements et décaissements du jour.",
  "finance.tresorerie.forecast":
    "Anticipez vos besoins de financement grâce aux prévisions de trésorerie sur 30, 60 et 90 jours.",
  "finance.tresorerie.reconciliation":
    "Rapprochez vos relevés bancaires avec les écritures comptables : identifiez les écarts non justifiés.",

  /* ─── FP&A ──────────────────────────────────────────────────────── */
  "fpa.dashboard":
    "Pilotez votre FP&A : taux d'exécution budgétaire, écarts significatifs et projection de fin d'année.",
  "fpa.budgets":
    "Créez, activez et comparez vos budgets versionnés et les différentes versions de vos prévisions.",
  "fpa.variance":
    "Analysez les écarts budget/réalisé : identifiez les postes en dépassement ou en sous-consommation.",
  "fpa.forecast":
    "Actualisez votre forecast glissant en intégrant les réalisations récentes dans vos prévisions.",
  "fpa.by_project":
    "Analysez la synthèse budgétaire par projet : charges, produits, marge et consommation du budget alloué.",
  "fpa.by_department":
    "Analysez la répartition budgétaire par département et la performance de vos centres de responsabilité.",

  /* ─── Achats / Dashboard ────────────────────────────────────────── */
  "achats.dashboard":
    "Consultez vos indicateurs achats : dépenses du mois, fournisseurs actifs, commandes en cours et alertes d'échéances.",
  "achats.rapports.aging":
    "Analysez la balance âgée de vos fournisseurs : créances classées par ancienneté pour identifier les retards.",
  "achats.rapports.by_period":
    "Suivez l'évolution de vos achats par période : tendances mensuelles et saisonnalités des dépenses fournisseurs.",
  "achats.rapports.by_supplier":
    "Analysez vos achats par fournisseur : volumes, délais de paiement et part dans les dépenses totales.",
  "achats.rapports.unpaid":
    "Identifiez vos factures fournisseurs impayées : montants en souffrance et délais de règlement dépassés.",

  /* ─── Portail Expert ────────────────────────────────────────────── */
  "expert.dashboard":
    "Consultez votre tableau de bord cabinet : clients actifs, documents en attente et missions en cours.",
  "expert.clients":
    "Accédez à la liste de vos clients connectés : espace client, statut de synchronisation et dernière activité.",
  "expert.documents":
    "Gérez vos demandes de documents auprès de vos clients : statut de réception et relances en attente.",

  /* ─── Recouvrement ──────────────────────────────────────────────── */
  "recouvrement.all":
    "Consultez toutes vos créances clients, quel que soit leur retard.",
  "recouvrement.1_30":
    "Surveillez vos créances en retard de 1 à 30 jours et lancez des relances préventives.",
  "recouvrement.31_60":
    "Traitez vos créances en retard de 31 à 60 jours : risque modéré — engagez une relance formelle.",
  "recouvrement.61_90":
    "Traitez vos créances en retard de 61 à 90 jours : risque élevé — envisagez une mise en demeure.",
  "recouvrement.90plus":
    "Agissez sur vos créances de plus de 90 jours : risque critique — envisagez des actions juridiques ou un provisionnement.",

  /* ─── Mon espace (portail RH collaborateur) ─────────────────────── */
  "myspace.conges":
    "Soumettez et suivez vos demandes de congés : planifiées, en attente de validation ou approuvées.",
  "myspace.soldes":
    "Visualisez vos droits acquis, les jours pris et votre solde restant pour chaque type de congé.",
  "myspace.bulletins":
    "Accédez à vos bulletins de paie mensuels et téléchargez-les en PDF.",
  "myspace.cotisations":
    "Consultez le détail de vos cotisations CNSS et fiscales prélevées chaque mois sur votre rémunération.",
  "myspace.documents":
    "Consultez vos documents RH : contrats, avenants et pièces administratives conservées dans l'ERP.",
  "myspace.attestations":
    "Demandez et téléchargez vos attestations de travail, de salaire ou de présence.",
  "myspace.virements":
    "Consultez l'historique de vos virements de salaire et vos coordonnées bancaires de paiement.",
  "myspace.reclamations":
    "Soumettez une réclamation ou un signalement et suivez son traitement par le service RH.",

  /* ─── Mon espace général (portail employé) ──────────────────────── */
  "monespace.travaux":
    "Consultez et gérez vos tâches en cours : activités assignées, priorités et avancement de vos travaux.",
  "monespace.dashboard":
    "Consultez votre tableau de bord RH personnel : indicateurs de performance, absences et points clés du mois.",
  "monespace.payslips":
    "Consultez et téléchargez vos bulletins de paie mensuels et fiches de rémunération.",
  "monespace.leaves":
    "Gérez vos demandes de congés et consultez vos soldes par type de congé.",
  "monespace.contract":
    "Consultez les détails de votre contrat de travail : type, dates, rémunération et avenant en vigueur.",
  "monespace.documents":
    "Accédez à vos documents RH : contrats, attestations et pièces administratives partagées par l'entreprise.",
  "monespace.training":
    "Suivez vos formations en cours et à venir : progression, certificats obtenus et plan de développement.",
  "monespace.reclamations":
    "Soumettez une réclamation ou consultez le suivi des demandes que vous avez déposées.",
  "monespace.profil":
    "Mettez à jour vos informations personnelles et professionnelles : coordonnées et préférences d'affichage.",

  /* ─── Finance Intelligence ──────────────────────────────────────── */
  "finance.intelligence.forecast":
    "Anticipez vos flux en visualisant la projection des entrées et sorties de trésorerie sur 30, 60 et 90 jours.",
  "finance.intelligence.aging":
    "Identifiez vos retards les plus critiques grâce au classement des créances et dettes par ancienneté.",
  "finance.intelligence.anomalies":
    "Détectez les transactions inhabituelles signalées automatiquement : montants atypiques, doublons suspects et erreurs.",
  "finance.intelligence.collections":
    "Gérez vos actions de recouvrement en cours : clients relancés, montants en attente et prochaines étapes.",

  /* ─── Fiche client ───────────────────────────────────────────────── */
  "clients.detail.360":
    "Consultez la vue 360° du client : activité récente, KPIs financiers et historique des interactions.",
  "clients.detail.tree":
    "Visualisez la structure organisationnelle du client : hiérarchie, contacts clés et entités rattachées.",
  "clients.detail.engagements":
    "Suivez les missions et services en cours pour ce client : avancement, livrables et responsables assignés.",
  "clients.detail.projects":
    "Consultez les projets actifs et passés pour ce client : budget, calendrier et statut d'avancement.",
  "clients.detail.communication":
    "Consultez l'historique des échanges avec ce client : e-mails envoyés, notes et documents partagés.",
  "clients.detail.messaging":
    "Échangez directement avec ce client via la messagerie : fil de conversation et pièces jointes.",
  "clients.detail.notes":
    "Rédigez et consultez les notes internes sur ce client : observations, mémos et points de contact.",
  "clients.detail.journal":
    "Consultez le journal d'activité complet : toutes les actions et événements enregistrés sur ce compte.",

  /* ─── Achats — Approbations ─────────────────────────────────────── */
  "achats.approbations.invoices":
    "Approuvez ou rejetez les factures fournisseurs en attente de validation.",
  "achats.approbations.pos":
    "Vérifiez et validez les bons de commande soumis : montants, fournisseurs et justifications.",
  "achats.approbations.expenses":
    "Validez les notes de frais soumises par vos collaborateurs.",

  /* ─── Réclamations RH — statuts supplémentaires ─────────────────── */
  "hr.reclamations.infos_complementaires":
    "Consultez les réclamations en attente d'informations complémentaires de la part du collaborateur.",
  "hr.reclamations.en_traitement":
    "Suivez les réclamations prises en charge et en cours d'instruction par le service compétent.",
};

/**
 * Récupère la description d'un élément par sa clé.
 * Retourne undefined si la clé n'existe pas dans le dictionnaire.
 */
export function getHelpContent(key: string): string | undefined {
  return HELP_CONTENT[key];
}
