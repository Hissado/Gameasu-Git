# Rapport de correction — Chantiers P1 (audit consolidé du 22 juillet 2026)

_Date : 23 juillet 2026 · Branche : `claude/gameasu-erp-audit-refactor-cz172i`_
_Suite de [`RAPPORT_CORRECTIONS_P0.md`](RAPPORT_CORRECTIONS_P0.md)._

---

## P1.a — Rattrapage des opérations historiques sans écriture

**Problème.** Les factures, paiements et paies validés AVANT le branchement du
moteur d'écritures (P0) n'ont pas d'écriture comptable — le grand livre de
production est lacunaire.

**Correction.** Script `api-server/src/scripts/backfill-postings.ts`
(`pnpm --filter @workspace/api-server run backfill:postings`) :

- couvre : factures clients émises, encaissements confirmés, factures
  fournisseurs, paiements fournisseurs, cycles de paie validés/payés ;
- **simulation par défaut** (liste ce qui serait posté), `--apply` pour écrire ;
- idempotent (s'appuie sur l'index unique `sourceType+sourceId`) — ré-exécutable ;
- échecs unitaires collectés et rapportés sans interrompre le lot.

À exécuter en préproduction d'abord (phase 0), puis en production.

---

## P1.b — Matrice de droits et catalogue de permissions (audit §D)

**Cause racine découverte — le bug le plus structurant du lot.** Deux modèles
de données RBAC contradictoires coexistaient dans le code :

| Élément | Schéma Drizzle (imposé en base par `push-force`) | Code (seed, routes admin, SQL brut) |
| --- | --- | --- |
| `permissions` | `name`, `module` | `label`, `category` |
| `role_permissions` | `permission_code` TEXT | `permission_id` UUID, `granted_by_id` |
| Surcharges | table `user_perm_overrides`, booléen `granted` | table `user_permission_overrides`, `type` grant/deny + `expires_at` |

Conséquences en production :
- le **seed RBAC échouait silencieusement** à chaque démarrage
  (`.catch(console.warn)`) — insertion sur colonnes inexistantes, violation
  NOT NULL sur `name` → **catalogue des 133 droits vide** ;
- les routes admin (`GET /admin/permissions`, matrice, duplication)
  produisaient des erreurs SQL → **panneau de rôles figé, échec silencieux** ;
- les permissions ajoutées après la dérive n'ont jamais été semées → des
  entrées de navigation gated par ces permissions restaient invisibles ou
  inertes pour les rôles non-admin (lien direct avec P1.c) ;
- 24 des 65 erreurs de typecheck pré-existantes provenaient de cette dérive.

**Corrections.**

| Correction | Fichiers |
| --- | --- |
| **Migration de réconciliation** `migrate-rbac-align.ts` : amène n'importe quel état historique vers le modèle canonique (renommages sans perte, backfill `permission_code` depuis `permission_id`, réconciliation `user_permission_overrides`, dédoublonnage + contrainte d'unicité) | `lib/db/src/migrate-rbac-align.ts` |
| **Seed RBAC réparé** : insère sur les colonnes réelles (`name`/`module`), liens rôle↔permission par **code** | `api-server/src/lib/rbac/seed.ts` |
| **Résolution des droits** : requête typée sur `permission_code`, avec repli transitoire sur l'ancien modèle tant que la migration n'est pas passée (continuité de service) | `api-server/src/lib/rbac/permissions.ts` |
| **Routes admin alignées** (catalogue avec alias `label`/`category` pour le frontend, matrice par codes, duplication, permissions effectives) | `api-server/src/routes/admin.ts` |
| **Schéma des surcharges corrigé** pour refléter la table réelle (`type`, `reason`, `expires_at`) | `lib/db/src/schema/rbac.ts` |
| **Différenciation Super Admin / Admin** (audit §D, recommandation reprise telle quelle) : l'Administrateur perd `roles.manage` (garde `roles.read`) — la gestion des rôles devient l'apanage du Super Administrateur | `api-server/src/lib/rbac/catalog.ts` |
| **Fin des échecs silencieux côté UI** : état d'erreur explicite + bouton réessayer sur le catalogue ; message clair sur la matrice quand le catalogue est indisponible | `edole-admin/src/pages/admin/permissions.tsx`, `roles.tsx` |

---

## P1.c — Les cinq « liens inertes »

**Constat de code.** Les cinq cibles de l'audit (Bons de commande, Simulateur
de coût, Trésorerie & Recouvrement, Ouvrir cycle de paie, États de salaires)
ont **toutes une route déclarée et une page réelle** dans le code actuel :
`/achats/bons-de-commande`, `/rh/simulateur`, `/finance/tresorerie` +
`/recouvrement`, `/rh/paie/run/:id`, `/rh/btp-paie`. Le garde-fou statique
`check-routes` (exécuté dans le typecheck racine) valide **483 fichiers → 199
routes, zéro lien cassé**.

**Analyse.** Les liens inertes constatés le 22/07 en production relèvent de
deux causes, toutes deux traitées : (1) des permissions jamais semées (seed
RBAC cassé — corrigé en P1.b) qui gataient la navigation ; (2) des correctifs
de navigation déjà livrés dans les commits de la veille (« Restructure HR
navigation… »), pas encore déployés au moment de l'audit. **À revalider par un
clic réel sur les 5 liens en préproduction après déploiement.**

---

## P1.d — Source unique de vérité : trésorerie (91,8 M vs 0)

**Cause racine.** La page « Trésorerie prévisionnelle » sommait les soldes des
seuls comptes bancaires **déclarés et rattachés** (`bank_accounts.accountId`),
tandis que le bilan somme le solde grand livre de **toute la classe 5**. Un
solde comptable porté par un compte 5xx non rattaché à un compte bancaire
déclaré (cas du tenant audité : 91,8 M) disparaissait de la trésorerie.

**Corrections.**

| Correction | Fichiers |
| --- | --- |
| **Dictionnaire central des indicateurs** (début de la phase 3) : `getTreasuryPosition` (solde classe 5 = définition unique de « Trésorerie disponible », identique au bilan par construction, avec ventilation par compte et part « non rattachée » jamais masquée), `getReceivablesBalance` (411), `getPayablesBalance` (401) | `api-server/src/services/kpis.ts` |
| Endpoint `GET /finance/treasury-position` | `api-server/src/routes/financeIntelligence.ts` |
| Page Trésorerie branchée sur cette source : la « Position actuelle » affiche le solde comptable, mentionne la part non rattachée à un compte bancaire | `edole-admin/src/pages/finance/tresorerie.tsx` |

**Restant (phase 3 complète).** Étendre le dictionnaire aux autres KPI
(CA, charges, masse salariale, TVA) et y brancher tableau de bord, rapports et
Cockpit — chantier suivant.

---

## P1.e — Notes de frais → comptabilité

**Problème.** L'approbation et le paiement d'une note de frais ne changeaient
que le statut : aucune charge, aucune dette, aucun décaissement comptabilisés.

**Corrections.**

| Correction | Fichiers |
| --- | --- |
| `postExpenseReport` (approbation) : Débit **618** Divers frais / Crédit **421** Personnel — idempotent (`expense_report`) | `api-server/src/services/postings.ts` |
| `postExpensePayment` (remboursement) : Débit 421 / Crédit **521** Banque ou **571** Caisse (`method` dans le corps de requête) — idempotent (`expense_report_payment`) | `postings.ts` |
| Approbation et paiement **atomiques** (statut + écriture dans une transaction) | `api-server/src/routes/hr-expenses.ts` |
| Compte 618 ajouté au plan seedé (+ création idempotente pour les organisations existantes) | `syscohada-seed.ts` |

---

## P1.g — Cycle d'achat amont : rapprochement 3 pièces (audit phase 5)

**Constat de code.** Le squelette du cycle achat existe déjà et est plus complet
que ne le laissait voir l'audit : **bons de commande** (`purchase_orders` +
lignes, statuts draft→sent→partial→received), **réception** partielle/totale
(`POST /inventory/purchase-orders/:id/receive` → `stock_movements`,
`quantity_received` par ligne), **seuil d'approbation** paramétrable, **TVA**
sur les factures fournisseurs (`tax_amount`, éclatée au 4452 depuis le lot P0).
Ce qui manquait : le **rapprochement 3 pièces** (contrôle de conformité BC ↔
réception ↔ facture) et la **comptabilisation à l'approbation** dans le module
Achats (seul le module Comptabilité postait les factures fournisseurs).

**Corrections.**

| Correction | Fichiers |
| --- | --- |
| Service `threeWayMatch` : détecte facture sans BC, facture sans réception, réception partielle, écart de prix (HT facturé vs BC, tolérance 1 % / 1 000 FCFA), doublon probable (même référence, ou même montant ±1 FCFA à < 30 j chez le même fournisseur), dépassement du seuil d'approbation. Chaque anomalie porte une sévérité `error` (bloquante) ou `warning`. | `api-server/src/services/three-way-match.ts` |
| `GET /purchases/invoices/:id/three-way-match` (rapport pour une facture) et `GET /purchases/three-way-match/exceptions` (factures ouvertes à anomalies) | `api-server/src/routes/purchases.ts` |
| **Contrôle bloquant à l'approbation** : passer une facture fournisseur en statut approuvé lance le rapprochement ; toute anomalie bloquante renvoie **422** avec le détail, sauf approbation en force explicitement motivée (`forceApproval` + `approvalComment`, tracée dans l'historique de statut) | `purchases.ts` (`PATCH /purchases/invoices/:id`) |
| **Comptabilisation à l'approbation** dans le module Achats (l'absence était une source de factures approuvées sans écriture) : `postSupplierInvoice` idempotent, statut rétabli si l'écriture échoue | `purchases.ts` |

**Restant (chantier fonctionnel à part).** La demande d'achat formelle
(workflow d'approbation en amont du BC) et l'appariement **ligne à ligne**
(vs agrégat) restent à construire ; le rapprochement actuel opère sur les
totaux et les quantités agrégées, ce qui couvre les cas de l'audit.

---

## P1.h — Dictionnaire KPI au tableau de bord comptable (audit §13.4)

**Problème.** Sur le tableau de bord Comptabilité, le bloc « Activité du mois »
et le graphique « Produits vs Charges » pouvaient afficher des valeurs
contradictoires ; la trésorerie du tableau de bord ne coïncidait pas avec le
bilan.

**Correction.** Le tableau de bord (`GET /accounting/dashboard`) lit désormais
la trésorerie, les créances et les dettes via le **dictionnaire central**
(`services/kpis.ts` — `getTreasuryPosition`, `getReceivablesBalance`,
`getPayablesBalance`), exactement comme le bilan et la page Trésorerie : **une
seule définition, une seule valeur partout**. Les produits/charges du mois et
le graphique 6 mois proviennent tous deux de la même requête grand livre
(classes 6/7 postées) — plus deux valeurs contradictoires sur un même écran.
Point de vigilance : la trésorerie affichée est le solde grand livre (classe 5)
et non plus le champ `openingBalance` des comptes bancaires ; les à-nouveaux
non journalisés doivent être repris par une écriture d'ouverture (cf. P0.b).

---

## Tests et vérifications

- **Typecheck backend : 65 → 41 erreurs** — les 24 erreurs résolues sont
  exactement la dérive RBAC (admin.ts, rbac/seed.ts, delete-organization.ts) ;
  zéro nouvelle erreur introduite par les lots P1.a→P1.h. Frontend : 24 = base
  inchangée.
- **`check-routes`** : 484 fichiers scannés, 199 routes, aucun lien cassé.
- **`test:payroll`** : 28/28 après les modifications du lot.

## Migrations à appliquer (préproduction puis production)

```bash
cd lib/db
pnpm exec tsx src/migrate-rbac-align.ts       # réconciliation RBAC (P1.b)
# puis, déjà listées au lot P0 :
pnpm exec tsx src/migrate-payroll-scales.ts
pnpm exec tsx src/migrate-invoice-vat.ts
# après déploiement du code + redémarrage (seed RBAC OK) :
pnpm --filter @workspace/api-server run backfill:postings          # simulation
pnpm --filter @workspace/api-server run backfill:postings -- --apply
```

Ordre important : `migrate-rbac-align` AVANT le redémarrage du serveur pour que
le seed RBAC réussisse (le repli intégré de la résolution évite toute coupure
si l'ordre n'est pas respecté).

## Risques résiduels

| Prio | Sujet |
| --- | --- |
| P1 | Valider en préproduction : catalogue des 133 droits visible, matrice consultable pour les 10 rôles, les 5 liens de l'audit cliquables, trésorerie = bilan = tableau de bord. |
| P1 | Rapprochement 3 pièces **ligne à ligne** + workflow de demande d'achat formelle en amont du BC (le rapprochement actuel opère sur les totaux/quantités agrégés). |
| P1 | UI de contrôle 3 pièces : exposer `three-way-match/exceptions` dans le module Achats (le backend est prêt, l'écran reste à câbler). |
| P2 | Surcharges de permissions : la table réconciliée doit être revalidée (grant/deny/expiration) en préproduction. |
| P2 | L'Administrateur perd `roles.manage` : communiquer ce changement aux organisations (comportement voulu par l'audit). |
| P2 | Reprise des à-nouveaux bancaires : le tableau de bord et la trésorerie affichent le solde grand livre ; poster les à-nouveaux non journalisés (écriture d'ouverture). |
