# Rapport de correction — Chantiers P3 (audit consolidé du 22 juillet 2026)

_Date : 23 juillet 2026 · Branche : `claude/gameasu-erp-audit-refactor-cz172i`_
_Dernier lot. Suite de P0, P1 et P2 (`RAPPORT_CORRECTIONS_P0/P1/P2.md`)._

Le lot P3 regroupe les optimisations secondaires et l'harmonisation du
vocabulaire (audit §I et §F #17-19).

---

## P3.a — Localisation française des statuts (audit §I, §F #17)

**Problème.** Des valeurs de statut techniques (stockées en anglais : `pending`,
`posted`, `paid`, `overdue`, `active`…) s'affichaient brutes dans plusieurs
écrans ; le sous-titre de la Clôture affichait « Month-end close ».

**Correction.**

| Correction | Fichiers |
| --- | --- |
| **Dictionnaire central de libellés** `statusLabel()` : ~40 statuts traduits en français, repli propre (capitalisation) pour l'inconnu — plus jamais de code brut à l'écran | `edole-admin/src/lib/status-labels.ts` |
| Appliqué aux écrans qui affichaient le statut brut : écritures comptables, fournisseurs (compta + achats), fiches clients, clients commerciaux, opérations | `accounting/entries.tsx`, `accounting/suppliers.tsx`, `achats/fournisseurs.tsx`, `clients/detail.tsx`, `commercial/clients.tsx`, `operations/index.tsx` |
| « Month-end close » → « Clôture mensuelle » | `accounting/period-close/index.tsx` |

La plupart des écrans localisaient déjà leurs statuts ; le dictionnaire fournit
désormais une source unique pour les cas restants et les futurs écrans.

---

## P3.b — Vestige sectoriel `/rh/btp-paie` (audit §F #18)

**Problème.** La fonctionnalité générique « États de salaires » vivait sous une
URL sectorielle héritée du BTP (`/rh/btp-paie`), avec un vocabulaire « chantier ».

**Correction.**

- Page renommée `hr/btp-paie.tsx` → `hr/etats-salaires.tsx`, vocabulaire
  générique (« chantier » retiré) ;
- route `/rh/etats-paie` enregistrée ; **redirection** de l'ancienne
  `/rh/btp-paie` vers la nouvelle (les favoris existants ne cassent pas) ;
- lien de navigation RH mis à jour.

Fichiers : `edole-admin/src/App.tsx`, `pages/hr/_layout.tsx`,
`pages/hr/etats-salaires.tsx`. Garde `check-routes` vert (aucun lien orphelin).

---

## P3.c — Graphie unique « Gameasu » (audit §I)

**Problème.** La marque apparaissait avec accents (« Gaméasù ») dans des chaînes
en dur, alors que l'identité centralisée (`config/branding.ts`) utilise
« Gameasu » sans accents.

**Correction.** Normalisation de toutes les occurrences en dur « Gaméasù » →
« Gameasu » dans le code applicatif (16 occurrences, 13 fichiers frontend +
libs backend). L'identité reste pilotée par `branding.ts` (rebrandable en un
seul endroit).

---

## P3.d — Alignement des KPI dettes fournisseurs (audit §F #19)

**Problème.** Le tableau de bord Comptabilité affichait des dettes fournisseurs
contradictoires (20,3 M vs 1,25 M) : la carte KPI et un autre agrégat ne
partageaient pas la même source.

**Correction (déjà livrée au lot P1.h, confirmée ici).** La carte « Dettes
fournisseurs » du tableau de bord lit désormais le **dictionnaire central**
(`getPayablesBalance` — solde créditeur des comptes 401 du grand livre),
exactement comme le bilan. Vérifié : aucun autre écran du tableau de bord
Comptabilité ne calcule un total de dettes divergent ; le tableau de bord
principal n'expose pas de KPI dettes. La liste « Top dettes fournisseurs »
reste une vue des factures ouvertes (métrique distincte et libellée comme
telle), qui converge avec le solde 401 une fois les factures comptabilisées
(approbation → écriture, lots P0/P1).

---

## Navigation secondaire (audit §F #16) — recommandation maintenue

Comme indiqué au lot P2, la rationalisation de la navigation (duplication
barre/panneau, menus RH) reste un chantier UI dédié à mener avec validation
visuelle ; non inclus pour ne pas risquer de régressions d'affichage.

---

## Tests et vérifications

- **Typecheck** : backend 41 = base, frontend 24 = base (zéro nouvelle erreur).
- **`check-routes`** : 488 fichiers, 200 routes, aucun lien cassé (redirection
  `/rh/btp-paie` incluse).
- **`test:payroll`** 28/28 ; **`test:p2`** 9/9.

## Risques résiduels / suite

| Prio | Sujet |
| --- | --- |
| P3 | Étendre `statusLabel()` aux écrans restants affichant un statut (map/marketing/training…) — mécanique, sans risque. |
| P2/P3 | Navigation secondaire : chantier UI dédié. |
| — | Vérifier en préproduction l'affichage francisé et la redirection `/rh/btp-paie`. |
