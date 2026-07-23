# Rapport de correction — Chantiers P2 (audit consolidé du 22 juillet 2026)

_Date : 23 juillet 2026 · Branche : `claude/gameasu-erp-audit-refactor-cz172i`_
_Suite de [`RAPPORT_CORRECTIONS_P0.md`](RAPPORT_CORRECTIONS_P0.md) et [`RAPPORT_CORRECTIONS_P1.md`](RAPPORT_CORRECTIONS_P1.md)._

> Rappel : la **différenciation Super Administrateur / Administrateur**
> (audit §F #14, listée en P2) a déjà été livrée au lot P1.b.

---

## P2.a — Contrôles de chronologie des dates (audit §F #11)

**Problème.** Aucune validation n'empêchait des incohérences comme une échéance
antérieure à l'émission d'une facture.

**Correction.** Helper pur et testable `lib/date-guards.ts` (fonctions renvoyant
un message français ou `null`), branché sur les points de saisie où
l'utilisateur fournit des dates :

| Contrôle | Endpoint |
| --- | --- |
| Échéance ≥ date d'émission | `POST /invoices` (`orders.ts`) |
| Règlement ≥ date de la facture | `POST /payments` (`orders.ts`) |
| Fin de contrat ≥ début | `POST /hr/contracts` (`hr.ts`) |
| Réception ≥ commande | helper prêt (`receptionDateError`) — l'endpoint de réception ne permet pas de date antérieure (réception « maintenant »), donc non déclenché |
| Écriture dans un exercice clôturé | **déjà** bloqué par le moteur d'écritures (`postEntryTx` refuse une période `closed`) |

Toute violation renvoie **400** avec un message clair en français. Couvert par
9 tests purs (`pnpm --filter @workspace/api-server run test:p2`).

---

## P2.b — Numérotation unifiée et configurable (audit §F #15)

**Problème.** Trois formats de facture coexistaient (`HC-FAC`, `FAC-HC`,
`INV-<base36>`). Les documents clients (facture, commande, devis, avoir)
étaient générés avec `Date.now().toString(36)` → références illisibles et non
séquentielles (« INV-MRT2DFPX »). Les rares numéros séquentiels (BC, facture
fournisseur) reposaient sur un `COUNT(*)` fragile (numéros dupliqués possibles
après suppression de lignes).

**Correction.**

| Correction | Fichiers |
| --- | --- |
| **Service de numérotation atomique** : format `{PRÉFIXE}-{AAAA}-{NNNNN}` ; allocation par `INSERT … ON CONFLICT DO UPDATE … RETURNING` (unicité garantie sous concurrence, robuste aux suppressions) ; préfixes par défaut homogènes (FAC, CMD, DEV, AV, FF, BC, PAY, ECR) | `api-server/src/services/numbering.ts` |
| Tables `document_number_sequences` (compteur) et `document_number_settings` (préfixe/padding **configurables par organisation**) + migration idempotente qui **amorce** les compteurs au-dessus des numéros séquentiels existants | `lib/db/src/schema/numbering.ts`, `lib/db/src/migrate-document-numbering.ts` |
| Documents clients (facture, commande, devis, avoir) et fournisseurs (facture, bon de commande) branchés sur le service — fin des `Date.now().toString(36)` et des `COUNT(*)` | `orders.ts`, `accounting.ts`, `purchases.ts` |
| Écran de configuration : `GET /admin/numbering`, `PUT /admin/numbering/:docType` (permission `settings.read` / `settings.manage`) | `admin.ts` |

**Notes.** Les écritures comptables (`ECR`) conservent leur numérotation
séquentielle atomique **par journal** (`VTE-2026-0001`, `ACH-…`), déjà
correcte et plus informative qu'un préfixe générique. Les bons de commande
passent du préfixe `PO` à `BC` (intention de l'audit) — sans collision avec
l'historique (préfixe distinct). Les anciens numéros restent valides et
cohabitent avec les nouveaux.

---

## P2.c — Page d'erreur / 404 en français (audit §F #13)

**Problème.** La page « not found » affichait un message de développement en
anglais : *« 404 Page Not Found — Did you forget to add the page to the
router? »*.

**Correction.** `edole-admin/src/pages/not-found.tsx` réécrite : titre et texte
en français, trois actions (**Réessayer**, **Retour**, **Tableau de bord**),
**référence d'erreur** courte affichée pour le support, détail technique
journalisé en console uniquement (jamais exposé à l'utilisateur).

---

## P2.d — Purge des données de démonstration en production (audit §F #12)

**Cause racine.** Le fichier `.replit` définissait `SEED_HISSADO_DEMO = "true"`
dans **`[userenv.production]`** : à chaque démarrage en production, le jeu de
démonstration complet « Hissado Consulting » (≈200 tiers de test) était
ré-injecté — exactement la pollution constatée par l'audit.

**Correction.** Retrait de `SEED_HISSADO_DEMO` de la section production de
`.replit` (conservé en développement). Désormais :

- en production, seul le **catalogue de référence** (plans, modules, RBAC) est
  semé (inconditionnel, idempotent) ; **aucune** donnée métier de démo ;
- le jeu de démo reste disponible en développement (`SEED_HISSADO_DEMO=true`) ;
- pour purger un **reliquat déjà présent** en production : réinitialisation
  usine via le Cockpit (`POST /super-admin/factory-reset`, déjà existant).

Conformément à l'audit, les données Hissado peuvent demeurer comme **jeu de
démonstration** si elles sont réalistes et cohérentes — elles ne seront
simplement plus **re-semées** automatiquement.

---

## Navigation secondaire (audit §F #16) — non traité, décision assumée

L'audit relève une duplication barre/panneau et des menus RH surchargés. La
navigation a été restructurée dans des commits récents (« Restructure HR
navigation… »). Une refonte transverse de la navigation est **risquée**
(nombreux écrans, gating par module/permission) et sort du périmètre « ne rien
casser » ; elle mérite un chantier UI dédié avec validation visuelle. Laissé en
recommandation P2 pour un lot ultérieur.

---

## Tests et vérifications

- **Typecheck backend : 41 = base** (zéro nouvelle erreur), **frontend : 24 =
  base**.
- **`check-routes`** : 486 fichiers scannés, 199 routes, aucun lien cassé.
- **`test:payroll`** : 28/28 ; **`test:p2`** : 9/9 (contrôles de dates).

## Migrations à appliquer (préproduction puis production)

```bash
cd lib/db
pnpm exec tsx src/migrate-document-numbering.ts   # numérotation (P2.b)
# rappel des lots précédents :
pnpm exec tsx src/migrate-rbac-align.ts
pnpm exec tsx src/migrate-payroll-scales.ts
pnpm exec tsx src/migrate-invoice-vat.ts
```

## Risques résiduels

| Prio | Sujet |
| --- | --- |
| P2 | Écran frontend de configuration de la numérotation (le backend `GET/PUT /admin/numbering` est prêt ; l'UI reste à câbler dans Paramètres). |
| P2 | Navigation secondaire (duplication barre/panneau, menus RH) — chantier UI dédié. |
| P2 | Purge du reliquat de démo en production : décider (garder comme démo documentée vs factory-reset) avec le métier. |
| P3 | Harmonisation complète du vocabulaire (français/anglais), graphie unique « Gameasu », vestige `/rh/btp-paie`. |
