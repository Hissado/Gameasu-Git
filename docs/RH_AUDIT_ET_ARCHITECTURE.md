# Module Ressources Humaines — audit de l'existant & architecture cible

> Restructuration du module RH autour d'une **source unique de vérité** (SSOT)
> qui génère menu secondaire, routes, fils d'Ariane, titres et permissions.
> Principe : **rien n'est cassé** — toute route existante reste valide (page
> `ready`) ; les nouveaux nœuds pointent vers un gabarit propre (`planned`,
> jamais de page blanche ni de lien inerte).
>
> Branche : `claude/gameasu-erp-audit-refactor-cz172i`

## 1. Inventaire de l'existant (audit §1)

**44 routes RH** enregistrées dans `App.tsx`, **40 pages** sous
`artifacts/edole-admin/src/pages/hr/`. Pages opérationnelles existantes :

| Page (composant) | Route actuelle | Rattachement cible |
|------------------|----------------|--------------------|
| `index` (Vue d'ensemble) | `/rh` | 1. Vue d'ensemble |
| `simulateur` | `/rh/simulateur` | 2. Simulateur de coût |
| `recruitment` | `/rh/recrutement` | 3. Recrutement (accueil) |
| `onboarding` | `/rh/integration` | 4. Intégration (accueil) |
| `documents` | `/rh/documents` | 5.1 Documents du personnel |
| `legal-register` | `/rh/registre-legal` | 5.2 Registre du personnel |
| `leave-policies` | `/rh/politiques-conges` | 6.1 Paramètres de congés |
| `btp-settings` | `/rh/btp-parametres` | 6. Paramètres (sectoriel) |
| `tax-settings` | `/rh/fiscalite` | 6.3 / Fiscalité RH |
| `contract-templates` | `/rh/modeles-contrats` | 7.1 Modèles (bibliothèque) |
| `contracts` | `/rh/contrats` | 7.2 Contrats signés |
| `positions` | `/rh/postes` | 8.1 Postes |
| `departments` | `/rh/departements` | 8.2 Départements |
| `movements` | `/rh/mouvements` | 8.3 Mouvements du personnel |
| `orgchart` | `/rh/organigramme` | 8.4 Organigramme |
| `assignments` | `/rh/affectations` | 8. Structure (affectations) |
| `indicators` | `/rh/indicateurs` | 9.1 Indicateurs |
| `reports` | `/rh/rapports` | 9.2 Rapports |
| `evaluations` | `/rh/evaluations` | 9. Notation (évaluations) |
| `training` | `/rh/formations` | 9. Notation (formations) |
| `intelligence` | `/rh/intelligence` | 9. Notation (intelligence) |
| `btp-pointage` | `/rh/btp-pointage` | 10. Pointage (grille) |
| `timesheets` | `/rh/feuilles-temps` | 10. Pointage (feuilles) |
| `team-calendar` | `/rh/calendrier-equipe` | 10. Pointage (calendrier) |
| `leaves` | `/rh/conges` | 10. Pointage (absences & congés) |
| `payroll` | `/rh/paie` | 11.2 Bulletins de paie |
| `payroll-calendar` | `/rh/paie/calendrier` | 11.1 Calendrier de paie |
| `payroll-declarations` | `/rh/paie/declarations` | 12. Formalités (déclarations) |
| `payroll-corrections` | `/rh/paie/corrections` | 11.7 Correction |
| `payroll-off-cycle` | `/rh/paie/hors-cycle` | 11. Paie (hors-cycle) |
| `payroll-run` | `/rh/paie/run/:id` | 11. Paie (exécution) |
| `etats-salaires` | `/rh/etats-paie` | 11. Paie (états) |
| `transfer-orders` | `/rh/virements` | 11.6 Paiement (virements) |
| `salary-advances` | `/rh/avances-salaire` | 11. Paie (avances) |
| `benefits` | `/rh/avantages` | 11. Paie (avantages) |
| `expenses` | `/rh/notes-frais` | 11. Paie (notes de frais) |
| `reclamations` / `reclamation-detail` | `/rh/reclamations` | 14. Réclamations & Suggestions |
| `audit-log` | `/rh/journal-audit` | 15. Journal d'audit |
| `my-space` | `/rh/mon-espace` | Mon espace (employé) |

**Permissions RH existantes** : `hr.read`, `hr.manage`, `hr.view_salary`,
`hr.manage_payroll`, `hr.manage_leaves`, `hr.manage_contracts`,
`hr.view_sensitive`, `hr.manage_expenses`, `hr.approve_expenses`, `hr.export` +
`attendance.view/manage/clock/view_anomalies/manage_settings`.

**Vestige sectoriel** : `btp-pointage`, `btp-settings`, `/rh/btp-paie`
(déjà redirigé vers `/rh/etats-paie`).

## 2. Source unique de vérité (SSOT §3)

Fichier : `artifacts/edole-admin/src/config/rh-navigation.ts`.

Un arbre `RhNode` (module → sous-module → sous-sous-module, `elements[]` pour le
niveau 4) où chaque nœud porte : `key`, `label`, `route`, `permission`,
`pageType` (`standalone|tabs|workflow|library|group`), `status`
(`ready|planned`) et `component` (clé de registre pour les pages existantes).

Consommateurs générés depuis ce fichier :
- **Routes** — `rhRouteEntries()` produit la liste route→composant (ready) ou
  gabarit (planned), consommée par `App.tsx`.
- **Menu secondaire** — `HrShell` construit ses groupes repliables depuis l'arbre.
- **Fils d'Ariane** — `rhBreadcrumb(path)` remonte l'arbre.
- **Titres de page & permissions** — portés par le nœud.

## 3. Stratégie de non-régression

- Toute route existante = nœud `ready` conservé à l'identique (aucune
  redirection nécessaire, aucune donnée perdue, §10).
- Les ~40 nouveaux nœuds = `planned` → gabarit `hr/_placeholder.tsx` (titre,
  description, fil d'Ariane, état vide, statut « en cours ») — jamais de page
  blanche ni de bouton inerte (§7).
- Les routes suggérées du brief qui dupliqueraient une page existante réutilisent
  la route existante plutôt que d'en créer une seconde (évite les doublons, §4).

## 4. Reste à faire (phases suivantes)

- Redirections des routes suggérées vers les routes canoniques si l'on décide de
  renommer les URLs existantes.
- Développement métier de chaque nœud `planned` (workflows Demande→Étude→Pièces,
  bibliothèques de modèles, composantes de bulletin, modes de paiement).
- Permissions fines par sous-module (backend + frontend) et tests automatisés
  (routes, fils d'Ariane, états actifs, mobile, multi-tenant).
