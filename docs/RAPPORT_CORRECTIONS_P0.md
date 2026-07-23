# Rapport de correction — Chantiers P0 (audit consolidé du 22 juillet 2026)

_Date : 23 juillet 2026 · Branche : `claude/gameasu-erp-audit-refactor-cz172i`_
_Référence : « Rapport d'audit consolidé — fiabilité des données, cohérence inter-modules et comptabilité SYSCOHADA »._

Ce rapport suit la structure exigée par la phase 17 : problème → cause racine →
correction → fichiers → migration → tests → résultat → risques résiduels.
Les chantiers sont traités dans l'ordre P0 imposé par l'audit.

---

## P0.a — Moteur d'écritures en partie double

**Problème identifié (audit §C).** Les modules opérationnels ne déversent pas
leurs écritures dans la comptabilité ; les états sont calculés sur des agrégats.

**Cause racine (constatée dans le code).** Le moteur d'écritures existait déjà
(`api-server/src/services/postings.ts` : équilibre débit/crédit vérifié côté
backend, idempotence par index unique `(sourceType, sourceId)`, verrous
d'accès concurrent, contrôle d'exercice clôturé, contre-passation). Le défaut
n'était **pas l'absence de moteur mais son branchement incomplet** :

1. **La paie ne générait aucune écriture** — aucun `postPayrollRun` n'existait ;
   la validation d'un cycle s'arrêtait aux bulletins. → CNSS/IRPP = 0 en
   fiscalité, charges de personnel absentes du compte de résultat (classe 6 = 0).
2. **Deux des quatre chemins d'émission de facture avalaient l'échec de
   comptabilisation** (`catch` « non bloquant » dans
   `orders.ts /proformas/:id/generate-invoice` et `/orders/:id/generate-invoice`) :
   une facture pouvait exister sans écriture, silencieusement. → grand livre
   quasi vide face à un bilan alimenté par les agrégats.
3. **Aucune écriture ne portait la TVA** (voir P0.d).

**Corrections apportées.**

| Correction | Fichiers |
| --- | --- |
| Nouvelle fonction `postPayrollRun` : Débit 661 (brut) + 664 (patronales) / Crédit 421 (net) + 431 (CNSS sal.+pat.) + 4471 (IRPP) + 4472 (IPTS si non nul) ; idempotente (`sourceType=payroll_run`) ; équilibre garanti par l'identité du bulletin et re-vérifié par `postEntryTx` | `api-server/src/services/postings.ts` |
| Branchement **atomique** aux deux points de validation de paie : bulletins + totaux + écriture dans une même transaction — si la comptabilisation échoue, la validation est annulée | `api-server/src/routes/payroll-v2.ts` (`POST /payroll/runs/:id/submit`), `api-server/src/routes/payroll.ts` (`POST /payroll/runs/:id/validate`) |
| Suppression des deux « non bloquant » : l'échec de comptabilisation annule désormais la facture générée et renvoie une erreur explicite | `api-server/src/routes/orders.ts` |
| Comptes 4471/4472 ajoutés au plan seedé + helper `ensureAccount` (idempotent) pour les organisations dont le plan a été seedé avant cet ajout | `api-server/src/services/syscohada-seed.ts`, `postings.ts` |

**Résultat attendu en production.** Toute paie validée alimente désormais le
compte de résultat (661/664), les dettes sociales (431), fiscales (4471) et le
personnel (421) ; la Synthèse fiscale (déjà branchée sur 431x/447x — point
d'excellence relevé par l'audit §E.1) affichera CNSS et IRPP non nuls dès le
premier cycle validé. Plus aucune facture ne peut exister sans écriture.

---

## P0.b — Bilan équilibré, capitaux propres et report du résultat

**Constat de code.** Les endpoints d'états (`/accounting/balance-sheet`,
`/accounting/income-statement`, `/reports/finance/*`) lisent **déjà** le grand
livre réel et intègrent le résultat calculé (classes 6/7) au passif. Le
déséquilibre de 143,2 M constaté en production ne vient pas de ces endpoints
mais : (1) d'écritures historiques asymétriques créées par les données de
démonstration, et (2) du grand livre lacunaire (cf. P0.a) face à des KPI
d'agrégats. La correction du branchement (P0.a) traite la cause ; la reprise
des à-nouveaux (capital initial, report) sur le tenant réel est une **opération
de données** à réaliser en préproduction avec l'expert-comptable (voir
« Risques résiduels »).

---

## P0.c — Comptabilisation des charges (achats, paie, dépenses)

- **Paie** : couverte par P0.a (661/664 au débit).
- **Achats** : `postSupplierInvoice` existait et était branché ; il comptabilise
  désormais la charge **HT** et la TVA récupérable séparément (voir P0.d).
- **Dépenses / notes de frais / immobilisations** : `postAmortization` existait ;
  le branchement systématique des notes de frais reste à faire (P1 — voir
  « Restant à traiter »).

---

## P0.d — TVA sur les cycles vente et achat

**Problème identifié (audit §F #9, §E.2).** HT = TTC sur les achats ; TVA
collectée = 0 malgré des factures ; la structure de facture client ne portait
**aucun champ de TVA** (constat de schéma : `invoices` n'avait que `totalAmount`).

**Corrections.**

| Correction | Fichiers |
| --- | --- |
| Colonnes additives `subtotal_amount` (HT), `tax_rate`, `tax_amount` sur `invoices` (nullables : les factures historiques restent valides) | `lib/db/src/schema/orders.ts` + migration idempotente `lib/db/src/migrate-invoice-vat.ts` |
| Écriture de vente éclatée : Débit 411 TTC / Crédit 706 HT / Crédit **4431 TVA facturée** quand la TVA est renseignée ; garde de cohérence HT + TVA = TTC (±1 FCFA) côté backend | `api-server/src/services/postings.ts` (`postCustomerInvoice`) |
| Écriture d'achat éclatée : Débit charge HT / Débit **4452 TVA récupérable** / Crédit 401 TTC (le champ `taxAmount` existait déjà sur les factures fournisseurs mais était ignoré) | `postings.ts` (`postSupplierInvoice`) |
| Acceptation et validation des champs TVA à la création/édition de facture | `api-server/src/routes/orders.ts` |

**Résultat attendu.** La Synthèse fiscale (branchée sur 443x/445x) calculera la
TVA collectée, déductible et nette depuis les écritures réelles — phase 6 de
la demande satisfaite pour les flux vente/achat.

---

## P0.e — Moteur de paie unique, table de barèmes unique

**Problème identifié (audit §F #4).** Règles divergentes : CNSS 9 % vs 4 % ;
IRPP progressif (2 barèmes différents !) vs approximations à taux fixe ;
patronales 22,5 % vs 16,4 % (et un défaut par-collaborateur à 18,4 %).

**Cause racine (localisée précisément).**

| Source | CNSS sal. | Patronal | IRPP | IPTS |
| --- | --- | --- | --- | --- |
| `lib/payroll-engine.ts` (moteur documenté, validé contre le modèle Excel client ; utilisé par le simulateur et la paie v1) | 9 % | 22,5 % | barème mensuel CGI 8 tranches, abattement 28 %, personnes à charge | — |
| `payroll-v2.ts` (cycle actif) + `payroll-extended.ts` — **copies locales recodées** | 4 % | 16,4 % | barème annuel approximatif 7 tranches, sans abattement | 2 % (en doublon de l'IRPP) |
| Prime hors cycle (`payroll-extended.ts`) | 4 % | — | « approx 15 % marginal » à taux fixe | 2 % |

**Décision d'unification.** L'audit qualifie le simulateur de
« mathématiquement juste » (§J) — il repose sur `payroll-engine.ts`. Ce moteur
(déjà utilisé par la paie v1) devient **l'unique moteur** ; les copies locales
divergentes de v2/extended sont supprimées et remplacées par des appels au
moteur.

**Corrections.**

| Correction | Fichiers |
| --- | --- |
| **Table de barèmes versionnée** `payroll_rate_scales` (pays, régime, version, dates d'effet, CNSS sal./pat., abattement, déduction/personne, SMIG, taux IPTS, tranches IRPP mensuelles en JSONB ; `organization_id NULL` = barème national) | `lib/db/src/schema/payroll.ts`, migration + seed du barème national `lib/db/src/migrate-payroll-scales.ts` |
| Moteur paramétré par barème : `brutVersNet`/`netVersBrut`/`calcIrppMensuel` acceptent un `PayrollScale` (défaut = barème intégré TG-2026.01, valeurs inchangées) ; `getActivePayrollScale(orgId, date)` lit le barème actif en base avec repli intégré (robuste si la migration n'est pas encore passée) ; `computePayslipAmounts` devient l'unique point d'entrée « bulletin » | `api-server/src/lib/payroll-engine.ts` |
| Suppression des copies locales : v2 (`computePayslipAmounts` 4 %/16,4 %/2 %, `computeIrppAnnuel` 7 tranches, `IRPP_TRANCHES`+`irppDetail` recodés), extended (prime hors cycle « approx 15 % »), v1 (wrapper local) — tous délèguent au moteur | `payroll-v2.ts`, `payroll-extended.ts`, `payroll.ts` |
| Libellés d'exports Excel/API dérivés du barème actif (plus de « 4 % / 16,4 % » en dur ; version du barème affichée) | `payroll-v2.ts` (déclarations CNSS/IRPP/annuelles) |
| **Transparence (§4.4)** : `GET /payroll/rates` (barème actif : version, source, taux, tranches) et `GET /payroll/simulate?gross=&dependents=` (calcul détaillé tranche par tranche, arrondis, version) | `payroll-v2.ts` |
| Simulateur frontend synchronisé sur `GET /payroll/rates` (ses valeurs par défaut étaient déjà celles du moteur ; il suit désormais aussi tout barème personnalisé du tenant) | `edole-admin/src/pages/hr/simulateur.tsx` |

**⚠️ Changement fonctionnel assumé (à valider par l'expert-comptable avant
production).** Les cycles de paie v2 calculaient jusqu'ici avec 4 %/16,4 %/IPTS
2 % et un barème IRPP approximatif. Ils appliquent désormais le barème de
référence (9 %/22,5 %, IRPP CGI mensuel, IPTS 0). **Les bulletins déjà validés
ne sont pas modifiés** (données stockées) ; seuls les cycles futurs changent.
Si l'organisation doit conserver d'autres taux, il suffit de créer un barème
d'organisation dans `payroll_rate_scales` (aucun redéploiement nécessaire).

---

## Tests réalisés

**Tests de non-régression paie** — `api-server/src/scripts/payroll-selftest.ts`
(`pnpm --filter @workspace/api-server run test:payroll`), exécutés avec succès
(28/28) :

- cas de référence validé contre le modèle Excel : base 86 000 → IRPP 330 FCFA ;
- salaire sous SMIG (alerte, IRPP nul), salaire élevé (toutes tranches),
  personnes à charge (IRPP réduit, jamais négatif) ;
- inversion Net → Brut (convergence à ±1 FCFA) ;
- **identité d'équilibre comptable** brut + patronal = net + CNSS + IRPP + IPTS
  sur 6 niveaux de salaire (c'est cette identité qui garantit l'équilibre de
  l'écriture `postPayrollRun`) ;
- barème personnalisé (les taux de la table sont bien appliqués, équilibre conservé).

**Typecheck** — aucune nouvelle erreur : `api-server` 65 → 65 (erreurs
pré-existantes documentées dans `CODEBASE_AUDIT.md`), `edole-admin` 24 → 24.

**Limite assumée.** Cet environnement d'audit n'a pas de base PostgreSQL ni
d'accès à la production : les scénarios de bout en bout (phase 15 : facture →
écriture → bilan → TVA) doivent être rejoués en **préproduction** avec les
données du tenant Hissado Consulting avant fusion (phase 0 de la demande).

## Migrations à appliquer (préproduction puis production)

Toutes additives et idempotentes ; le hook post-merge (`drizzle push-force`)
applique le schéma automatiquement, et le moteur fonctionne même sans la ligne
de barème (repli intégré) :

```bash
cd lib/db
pnpm exec tsx src/migrate-payroll-scales.ts   # table + barème national TG-2026.01
pnpm exec tsx src/migrate-invoice-vat.ts      # colonnes TVA sur invoices
```

Retour arrière documenté en tête de chaque script (DROP TABLE / DROP COLUMN —
aucune donnée existante modifiée).

## Risques résiduels et restant à traiter

| Prio | Sujet | Détail |
| --- | --- | --- |
| P0 (données) | **Reprise des à-nouveaux du tenant réel** | Le code intègre désormais le résultat au bilan, mais l'historique de production (créances 71,7 M, banque 91,8 M sans contrepartie) doit être régularisé par une écriture d'ouverture (capital/report) validée par l'expert-comptable, en préproduction d'abord. |
| P0 (validation) | **Choix des taux de paie** | Le barème unifié (9 %/22,5 %) doit être confirmé par l'expert paie ; sinon, créer le barème d'organisation adapté dans `payroll_rate_scales`. |
| P1 | Factures clients historiques sans écriture | Écrire un script de rattrapage idempotent (re-poster les factures `!= draft` sans écriture) — à exécuter en préproduction. |
| P1 | Notes de frais / petite caisse → écritures | Brancher les flux de dépenses restants sur `postEntry`. |
| P1 | Matrice de droits / catalogue de permissions (audit §D) | Non traité dans ce lot (backend comptable prioritaire) — prochain chantier. |
| P1 | Liens inertes, source unique des KPI (91,8 M vs 0) | Non traités dans ce lot — le dictionnaire d'indicateurs (phase 3) est la suite logique. |
| P2 | Saisie TVA côté interface de facturation client | Le backend accepte et comptabilise HT/TVA/TTC ; le formulaire frontend doit exposer les champs. |
| P2 | Numérotation, dates, purge démo, pages 404, navigation | Phases 8-13 — non traitées dans ce lot. |

## Recommandations

1. Rejouer les 3 scénarios de la phase 15 (vente, achat, paie) en préproduction
   et vérifier : balance équilibrée, classe 6 alimentée, TVA et CNSS/IRPP non
   nuls en Synthèse fiscale, `Actif = Passif` après écriture d'ouverture.
2. Rendre `test:payroll` bloquant en CI, puis étendre la même approche aux
   écritures (tests d'équilibre sur base de test).
3. Traiter ensuite les P1 dans l'ordre de l'audit : permissions, liens inertes,
   dictionnaire de KPI, amont du cycle d'achat (BC/réception/rapprochement).
