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

## Deuxième passe — application des 5 pôles + désencombrement RH

Sur demande explicite, la structure a été alignée plus avant sur les 5 pôles et
le menu RH désencombré (audit §H et §J).

### Alignement des groupes sur les 5 pôles

| Pôle audit | Groupe de navigation |
| --- | --- |
| 1 — Pilotage | **Pilotage** (ex-« Accueil » : tableaux de bord, briefing, approbations, communication, IA) |
| 2 — Cycle de vente | **Ventes** (CRM, clients, devis, commandes, factures, encaissements, avoirs) |
| 3 — Cycle d'achat | **Achats** (fournisseurs, BC, réceptions, factures, approbations, paiements) |
| 4 — Capital humain | **Ressources Humaines** |
| 5 — Comptabilité & Finance | **Comptabilité & Finance** (ex-« Finance ») |
| Transverses | **Projets**, **Logistique**, **Portail Expert**, **Admin** (Documents, Rapports, Paramètres, Add-ons, Journal d'audit) |

Deux groupes renommés (`Accueil → Pilotage`, `Finance → Comptabilité &
Finance`) pour épouser le vocabulaire des pôles ; les autres portaient déjà le
bon intitulé. Projets et Logistique sont conservés comme modules métier
additionnels (hors des 5 pôles théoriques mais bien réels).

### Désencombrement du menu RH (§J « menus RH surchargés »)

Le groupe Ressources Humaines passait de **14 sections** (≈35 entrées, avec
doublons) à **8 rubriques** logiques, sans perdre aucune page :

| Rubrique consolidée | Regroupe |
| --- | --- |
| Mon espace | (self-service) |
| **Collaborateurs** | fiches, onboarding, contrats signés, documents RH, départements, postes, organigramme, affectations, mouvements (fusion de Collaborateurs + Intégration + Structure + Documents du personnel) |
| **Recrutement & Formation** | candidatures, modèles de contrats, formations |
| **Temps & Présence** | présence, feuilles de temps, calendrier, congés, politiques de congés, kiosques (fusion Temps & Présence + Congés + Paramètres) |
| **Paie** | bulletins, avances, notes de frais, avantages, virements, corrections, hors cycle, déclarations, états de salaires, paramètres fiscaux, simulateur (fusion Paie + Formalités + simulateur) |
| **Pilotage & Rapports** | évaluations, indicateurs, rapports, registre légal, intelligence RH |
| Réclamations & Suggestions | (inchangé) |
| Journal d'audit | (inchangé) |

**Doublons supprimés** : « Modèles de lettres » / « Modèles de contrats » (même
page `/rh/modeles-contrats`), « Fiche collaborateur » / « Collaborateurs » (même
page `/rh`). L'entrée « États de salaires » (`/rh/etats-paie`), orpheline après
le renommage du vestige BTP, est de nouveau exposée sous Paie.

Vérifié : `check-routes` vert (488 fichiers, 200 routes), typecheck frontend
inchangé (24 = base). Toutes les pages RH restent joignables.

## Reste : duplication « barre bleue / panneau blanc »

Dans le code **actuel**, la mise en page comporte **une seule barre latérale**
repliable (`<aside>`, hiérarchie `NavGroup → NavSection → NavItem`) + un en-tête
(logo, recherche, notifications) + un fil d'Ariane — il n'y a **pas** de second
rail de navigation « bleu » redondant. La duplication constatée par l'audit
correspondait à une mise en page antérieure, déjà consolidée. Aucune action
supplémentaire nécessaire ; à confirmer visuellement en préproduction.
