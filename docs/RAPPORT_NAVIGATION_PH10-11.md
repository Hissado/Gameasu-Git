# Rapport — Navigation & architecture (phases 10-11)

_Date : 23 juillet 2026 · Branche : `claude/gameasu-erp-audit-refactor-cz172i`_

Phases 10 (architecture cible en 5 pôles + simplification) et 11
(repositionnement des fonctionnalités) du brief initial, traitées par **étapes
prudentes et vérifiables** (garde `check-routes` après chaque modification).

## Constat : la navigation est déjà largement conforme

La cartographie de `components/Layout.tsx` (`NAV_GROUPS`) montre une structure
proche des 5 pôles attendus — la restructuration lourde évoquée par l'audit a
en grande partie déjà eu lieu (commits « Restructure … navigation »).

| Pôle audit | Groupe de navigation actuel |
| --- | --- |
| 1 — Pilotage | **Accueil** (tableau de bord, alertes) |
| 2 — Cycle de vente | **Ventes** (CRM, devis, commandes, factures, encaissements, recouvrement) |
| 3 — Cycle d'achat | **Achats** |
| 4 — Capital humain | **Ressources Humaines** |
| 5 — Comptabilité & Finance | **Finance** (Intelligence, Comptabilité, Trésorerie, Planification, Fiscalité) |
| Transverses | **Admin**, **Logistique**, **Projets**, **Portail Expert** |

## Repositionnements de la phase 11 — état

| Élément (audit §G) | Attendu | État constaté / action |
| --- | --- | --- |
| **États financiers** (Bilan, Résultat, Balance) | Comptabilité → États financiers, raccourci depuis Rapports | Les pages existent sous `/comptabilite/*` mais **n'étaient pas exposées dans la barre latérale** (accessibles seulement via Rapports / le tableau de bord compta). **Corrigé** : Bilan, Compte de résultat et Balance ajoutés comme entrées de la section **Comptabilité** ; ils restent accessibles en lecture depuis Rapports. |
| **Trésorerie & Recouvrement** | Finance → Trésorerie unifiée | **Déjà en place** : section « Trésorerie & Recouvrement » sous le groupe Finance (Trésorerie + Recouvrement). |
| **Synthèse fiscale / TVA** | Fiscalité & Conformité (source) | **Déjà en place** : section « Fiscalité & Conformité » (Moteur fiscal, Contrôle fiscal, Conformité docs). |
| **Simulateur de coût employeur** | RH → Paie → Simulateurs | **Déjà en place** : « Simulateur paie » sous Ressources Humaines. |
| **Avances sur salaire** | Paie (gestion) + Mon espace (lecture) | **Déjà en place** : « Avances sur salaire » sous Paie et mentionné dans Mon espace. |
| **Doublons Résultat/Bilan** (« Vue d'ensemble » / « Pour mon comptable ») | Un seul état | **Aucun doublon** trouvé dans le code actuel — déjà résolu. |

## Modification apportée

- `components/Layout.tsx` : section **Comptabilité** enrichie de trois entrées
  directes — **Bilan** (`/comptabilite/bilan`), **Compte de résultat**
  (`/comptabilite/compte-de-resultat`) et **Balance générale**
  (`/comptabilite/balance`) — rattachant explicitement les états financiers au
  module qui les produit (audit phase 11). Description du « Grand livre »
  ajustée en conséquence.

Vérifié : `check-routes` vert (488 fichiers, 200 routes), typecheck frontend
inchangé (24 = base).

## Non traité — nécessite une validation visuelle (risque assumé)

Deux points de l'audit §J relèvent d'un chantier UI avec navigateur, non
réalisable de façon sûre sans rendu visuel :

1. **Duplication « barre bleue » / « panneau blanc »** : la barre supérieure
   répéterait la catégorie de la barre latérale. Diagnostic et correction
   demandent un rendu réel (structure de `Layout` + en-tête).
2. **Menus RH « surchargés » (30+ entrées)** : un regroupement repliable plus
   agressif est possible, mais réordonner/masquer des entrées sans validation
   visuelle risque de dégrader des parcours existants.

Recommandation : traiter ces deux points dans une session avec préproduction
et captures d'écran, en s'appuyant sur la structure `NavGroup → NavSection →
NavItem` déjà en place (repliable, gating par module/permission).
