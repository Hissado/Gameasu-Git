# Plan comptable propre à chaque organisation — état des lieux & feuille de route

> Revue de la logique du plan comptable (COA) dans Gameasu au regard du cahier
> des charges en 18 points, avec ce qui **existe déjà**, ce qui est **partiel**,
> ce qui **reste à construire**, et une feuille de route par phases (P0 → P3).
>
> Branche : `claude/gameasu-erp-audit-refactor-cz172i`

## Constat central (rassurant)

**L'objectif principal est déjà atteint sur le plan architectural** : le plan
comptable n'est **pas** une table globale partagée. Chaque organisation possède
sa **propre copie isolée**, semée depuis un **modèle par référentiel** :

- `chart_of_accounts` est **multi-tenant strict** : `organization_id NOT NULL` +
  index unique `(organization_id, code)`. Une modification de l'Organisation A
  n'apparaît jamais chez l'Organisation B (§2, §exigence d'isolation : **OK**).
- À la création d'une organisation, `seedAccountingFrameworkForOrg(orgId, framework)`
  (`services/accounting-framework.ts`) crée une copie propre du modèle : comptes,
  journaux, exercice fiscal, comptes banque/caisse — **idempotent**.
- Le référentiel est choisi par **type d'organisation** (`ORG_TYPE_TO_FRAMEWORK`)
  parmi **9 référentiels** : SYSCOHADA, SYSCOHADA SMT, SYCEBNL, PCB UMOA, SFD
  microfinance, CIMA, CIPRES, PCE, autre.
- Hiérarchie de comptes (`parentId`), nœuds non imputables (`isPostable`),
  activation (`isActive`), et tag `applicableFrameworks` sont déjà en place.

Autrement dit : « utiliser le modèle recommandé » (§1) fonctionne déjà, et
l'isolation multi-tenant réclamée est **native**. Le reste du cahier des charges
consiste à **enrichir** ce socle (personnalisation avancée, versions, mapping,
protection, permissions, UI, Cockpit/Expert, tests).

## Tableau de couverture (18 sections)

| § | Sujet | État |
|---|-------|------|
| 1 | Choix du mode de config à la création (recommandé / personnaliser / importer / from scratch) | **Partiel** — « recommandé » OK ; les 3 autres modes à exposer |
| 2 | Modèle ≠ structure partagée (copie par tenant, réf. au modèle source) | **OK** (copie/isolation) ; **manque** la référence au modèle source (`sourceFramework`/`sourceModelRef`) |
| 3 | Structure riche d'un compte (18 attributs) | **Partiel** — ~9/18 présents ; manque libellé perso, niveau, collectif/auxiliaire, devise, isSystem/origine, dates de désactivation, créateur/modificateur, centre analytique défaut, règles fiscales, note |
| 4 | Personnalisation (ajout, sous-compte, libellé, déplacement, activer/désactiver, fusion, comptes par défaut, mapping module, import/export, historique) | **Partiel** — CRUD basique (POST/PUT) ; manque fusion, déplacement contrôlé, historique, import/export dédiés |
| 5 | Protection des comptes utilisés (pas de suppression si écritures, code non modifiable, désactivation OK, journalisation) | **Fait (socle)** — `DELETE` refuse un compte mouvementé (message normalisé) ou avec sous-comptes ; désactivation via `PUT` autorisée ; `code` non modifiable ; endpoint `/usage` (nb écritures) ; **reste** garde compte système + journalisation dédiée |
| 6 | Comptes système vs personnalisés + badges (Système / Modèle / Personnalisé / Importé) | **À construire** — pas de flag `isSystem`/`origin` ni badges |
| 7 | Mapping comptable des modules (Ventes/Achats/Paie/Trésorerie → comptes) | **À construire** — comptes aujourd'hui résolus par **code en dur** (411, 401, 521, 571, 4431, 4452…) dans `postings.ts` |
| 8 | Import du plan (Excel/CSV) avec validation, hiérarchie, doublons, mapping système | **À construire** — module `chart_of_accounts` **absent** du moteur d'import (`migration-engine.ts`) |
| 9 | Versions du plan (brouillon / validation / actif / remplacé / archivé) + date d'effet | **À construire** — pas de table de versions |
| 10 | Changement de référentiel sécurisé (workflow 11 étapes) | **À construire** |
| 11 | États financiers sur le plan actif du tenant | **OK** (déjà filtrés par `organization_id`) ; regroupements configurables : à construire |
| 12 | Synchronisation tous modules sur le plan du tenant | **Partiel** — filtrage tenant OK, mais **codes en dur** dans les automatisations (à remplacer par le mapping §7) |
| 13 | Cockpit : gérer modèles, référentiels, versions, comptes système obligatoires, règles | **À construire** (côté Cockpit) |
| 14 | Portail Expert : configurer le plan d'un client attribué | **Partiel** — accès expert existant ; écran de config COA à construire |
| 15 | Permissions granulaires COA | **À construire** — aujourd'hui `accounting.manage`/`.import`/`.export` seulement |
| 16 | Journal d'audit COA (créé/modifié/désactivé/mapping/import/version/migration) | **Partiel** — audit général présent ; événements COA dédiés à ajouter |
| 17 | UI (hiérarchie + tableau, filtres, badges, nb écritures, bannière référentiel/version) | **Partiel** — page `chart-of-accounts.tsx` existe ; enrichissements à faire |
| 18 | Tests obligatoires (création, perso, import, protection, mapping, écritures, multi-tenant…) | **À construire** |

## Feuille de route proposée (par phases sûres et vérifiables)

> Principe : ne jamais modifier le plan actif d'un tenant contenant des
> écritures sans workflow ; chaque phase est additive, testée (typecheck +
> `check-permissions` + tests ciblés) et documentée.

### Phase A — Socle « compte enrichi + protection + permissions » (P0/P1)
1. **Modèle de compte enrichi** (schéma additif) : `customLabel`, `level`,
   `isCollective`, `currency`, `origin` (`system|template|custom|imported`),
   `isSystem`, `deactivatedAt`, `createdById`/`updatedById`,
   `defaultCostCenterId`, `defaultTaxId`, `description`, `sourceFramework`.
2. **Protection des comptes utilisés** (§5) : blocage de désactivation d'un
   compte système sans substitut, refus de toute suppression, `code`
   non modifiable, message normalisé, **journalisation** des changements.
3. **Permissions granulaires** (§15) câblées sur les routes + rôles + catalogue,
   contrôlées par `check-permissions` (pas d'orphelines).
4. **Badges** (§6) exposés par l'API (`origin`) pour l'UI.

### Phase B — Import & mapping (P1/P2)
5. **Import du plan comptable** (§8) : nouveau module `chart_of_accounts` dans
   le moteur d'import, avec pré-validation (doublons, hiérarchie, parents,
   comptes système requis) et rapport bloquant.
6. **Mapping comptable des modules** (§7, §12) : table `account_mappings`
   (role → accountId par organisation) + remplacement progressif des codes en
   dur de `postings.ts` par une résolution via le mapping du tenant.

### Phase C — Versions & référentiel (P2)
7. **Versions du plan** (§9) : table `chart_versions` (statut + date d'effet +
   sauvegarde), écritures historiques figées.
8. **Changement de référentiel** (§10) : workflow sécurisé avec simulation,
   rapport d'impact, validation, sauvegarde, contrôle d'équilibre.

### Phase D — UI, Cockpit, Portail Expert, tests (P2/P3)
9. **UI** (§17) : vue hiérarchique/tableau, filtres, badges, nb d'écritures,
   bannière (référentiel / modèle / version / date d'effet / statut), 4 modes de
   configuration (§1).
10. **Cockpit** (§13) et **Portail Expert** (§14) : gestion des modèles et
    configuration assistée par client attribué, avec journalisation.
11. **Tests** (§18) : jeu de tests multi-tenant (isolation, protection, mapping,
    écritures équilibrées, import, versions).

## Ce qui nécessite une préproduction / décision produit

- Toute phase touchant le **schéma** (A, B.6, C) implique une **migration
  Drizzle** à appliquer d'abord en préproduction.
- Le **remplacement des codes en dur** par le mapping (§7/§12) doit être
  progressif et couvert par les tests comptables E2E (vente→écriture→bilan).
- Les **modèles Cockpit** et le **workflow de changement de référentiel**
  supposent des choix de gouvernance (qui valide, quels comptes système
  obligatoires par référentiel).
