# Rapport d'audit — Migration / Import & Rôles / Permissions (Gameasu)

> Périmètre : revue complète des modèles de migration & d'importation, du
> catalogue des permissions et des rôles système, de la cohérence
> API ↔ UI ↔ catalogue, et du cloisonnement multi-tenant.
> Livrable §20 : constat classé **P0 → P3** + corrections appliquées + reste à faire.
>
> Branche : `claude/gameasu-erp-audit-refactor-cz172i`

---

## 0. Synthèse

| Sévérité | Nb constats | Corrigé dans ce lot | Reste à faire |
|----------|:-----------:|:-------------------:|:-------------:|
| **P0** — bloquant / corruption | 0 | — | — |
| **P1** — grave (fonction cassée / intégrité) | 3 | **2** | 1 |
| **P2** — important (fiabilité / gouvernance) | 5 | 1 (contrôle §13) | 4 |
| **P3** — cosmétique / dette | 2 | — | 2 |

Deux correctifs à fort impact ont été appliqués et vérifiés dans ce lot :

1. **Déverrouillage des surcharges de permissions** (`users.manage` → `roles.manage`) —
   deux endpoints d'administration étaient inaccessibles à *tout* utilisateur,
   super-admin compris.
2. **Correction du rattachement des contacts à l'import** — tous les contacts
   étaient silencieusement liés au *premier* client de l'organisation.

Un **contrôle automatique de cohérence** (`check-permissions`) a été créé pour
détecter en continu les permissions orphelines, les routes protégées par un code
inexistant, les doublons, les rôles utilisant d'anciens codes et la dérive entre
la grille UI et le catalogue backend.

---

## 1. Inventaire des modèles de migration / import

Source : `artifacts/api-server/src/lib/migration-engine.ts` (`MODULES`), templates
Excel `artifacts/api-server/src/lib/migration-templates.ts`, routes
`artifacts/api-server/src/routes/migration.ts`.

**18 modèles d'import** sont disponibles (Administration → Migration & Import) :

| # (ordre reco.) | Module | `id` | Dépendance parent | Dédoublonnage à l'import |
|:--:|--------|------|-------------------|--------------------------|
| 1 | Départements | `departments` | — | `onConflictDoNothing` (code) |
| 2 | Utilisateurs | `users` | — | `onConflictDoNothing` (email) |
| 3 | Plan comptable | `chart_of_accounts` | — | `onConflictDoNothing` (code) |
| 4 | Centres analytiques | `cost_centers` | — | `onConflictDoNothing` (code) |
| 5 | Banques & Caisses | `bank_accounts` | Plan comptable (521/571) | ❌ aucun |
| 6 | Balance d'ouverture | `opening_balance` | Journal AN + période fiscale + PC | ❌ non idempotent |
| 7 | Clients | `clients` | — | ❌ aucun |
| 8 | Contacts | `contacts` | **Clients** | ❌ aucun |
| 9 | Fournisseurs | `suppliers` | — | `onConflictDoNothing` (code) |
| 10 | Produits & Services | `services` | — | `onConflictDoNothing` (code) |
| 11 | Stock initial | `stock_initial` | **Produits** | ❌ aucun |
| 12 | Factures clients | `invoices` | Clients (souple) | ❌ aucun |
| 13 | Encaissements | `payments` | **Factures** | ❌ aucun |
| 14 | Collaborateurs | `collaborators` | Départements (souple) | ❌ aucun |
| 15 | Soldes de congés | `leave_balances` | **Collaborateurs+users** | `onConflictDoNothing` |
| 16 | Projets | `projects` | Clients (souple) | ❌ aucun |
| 17 | Équipements | `equipment` | — | ❌ aucun |
| 18 | Budgets | `budgets` | Plan comptable + période fiscale | `onConflictDoNothing` (ligne) |

**Points forts constatés** (à préserver) :

- Chaque exécuteur écrit systématiquement `organizationId` → **pas de fuite
  cross-tenant** détectée (cf. §14).
- Auto-mapping des colonnes par alias (`suggestMapping`) + validation par type
  (`validateRows`) + rapport d'erreurs Excel (`generateErrorReport`).
- Un onglet **« Guide d'intégration »** du classeur complet
  (`generateCompleteTemplate`) déclare l'**ordre d'importation recommandé** avec
  les notes de dépendance (les 18 lignes du tableau ci-dessus).

---

## 2. Constats classés

### 🔴 P1 — Graves

#### P1-1 — Surcharges de permissions inaccessibles (`users.manage` inexistant) — ✅ CORRIGÉ
`routes/admin.ts` protégeait `POST`/`DELETE /admin/users/:id/permission-overrides`
par `requirePermission("users.manage")`. Or **`users.manage` n'existe pas** dans
le catalogue (`catalog.ts`). Comme `hasPermission()` est une stricte appartenance
d'ensemble **sans bypass admin** (les droits proviennent uniquement des
`role_permissions` semés), *aucun* rôle — pas même `super_admin` (`"*"` =
tous les codes *du catalogue*) — ne pouvait franchir la garde. Résultat :
**403 pour tout le monde**, l'attribution de surcharges individuelles était
totalement inutilisable.
**Correctif** : garde alignée sur `roles.manage` (domaine gestion des droits,
réservé au super-admin — cohérent avec la décision d'audit §D). La lecture reste
sur `users.read`. Vérifié par le nouveau contrôle §13 (plus d'`ENFORCE-UNKNOWN`).

#### P1-2 — Contacts rattachés au mauvais client à l'import — ✅ CORRIGÉ
`importContacts.getClientId(name)` **ignorait le nom** : le cache était indexé
`id→id` et `match.find(() => true)` renvoyait le **premier** client de l'org
(commentaire `// simplified` laissé en place). Chaque contact importé était donc
silencieusement rattaché au premier client, quelle que soit la colonne
« Client associé ».
**Correctif** : résolution par nom normalisé via une map `name→id`, à l'identique
des imports factures/projets. Un client introuvable est désormais signalé ligne
par ligne au lieu d'être mal rattaché.

#### P1-3 — Catalogue de permissions dupliqué côté frontend (dérive) — ⏳ À FAIRE
`pages/admin/roles.tsx` maintient sa **propre copie durcie** du catalogue
(`MODULE_DEFS`, la grille de droits) *en plus* de récupérer le vrai catalogue via
`/api/admin/permissions`. La grille s'affiche à partir du tableau hardcodé →
toute permission absente de `MODULE_DEFS` devient **inassignable** via l'écran
Rôles. Dérive actuelle mesurée par le contrôle §13 : **6 permissions** du
catalogue backend absentes de la grille (`services.read`, `services.manage`,
`tasks.manage`, `clients.manage`, `commercial.manage`, `notifications.manage`).
`ROLE_TEMPLATES` (presets « Direction », « Resp. Finance »…) est également une
liste hardcodée qui diverge des `SYSTEM_ROLES` backend.
**Recommandation** : piloter la grille à partir du catalogue chargé
(`permsData`) + un simple mapping de regroupement/icônes, afin de supprimer la
seconde source de vérité. Non fait dans ce lot (changement UI structurant à
valider visuellement).

### 🟠 P2 — Importants

#### P2-1 — Contrôle automatique de cohérence permissions/rôles/routes — ✅ LIVRÉ (§13)
Voir §3. `scripts/src/check-permissions.ts` +
`pnpm --filter @workspace/scripts run check-permissions`.

#### P2-2 — Ré-import non idempotent (pas de clé de rapprochement) — ⏳ À FAIRE
`clients`, `contacts`, `invoices`, `payments`, `projects`, `equipment`,
`bank_accounts` insèrent sans clé d'unicité → **re-lancer un import duplique
toutes les lignes**. Le besoin métier §8 (détection de doublons / mode
mise-à-jour avec clé de rapprochement réaliste : nom+email pour clients,
n° de facture pour factures…) n'est pas couvert.
**Recommandation** : ajouter une clé naturelle par module (upsert
`onConflictDoUpdate`) et un choix « ignorer / mettre à jour » à l'exécution.

#### P2-3 — Balance d'ouverture non idempotente + postée directement — ⏳ À FAIRE
`importOpeningBalance` crée une écriture `sourceType:"opening"` **sans
`sourceId`** et en statut `posted` d'emblée → un second import crée un
deuxième à-nouveau en double, sans garde-fou. Absence de `batch-id` / de
réversibilité (§9 : historique d'import + annulation avec sauvegarde).
**Recommandation** : rattacher un `sourceId` unique par exercice + refuser un
2ᵉ à-nouveau sur une période déjà dotée ; brouillon avant validation.

#### P2-4 — Ordre d'import advisory, non contrôlé + double source d'ordre — ⏳ À FAIRE
L'ordre recommandé (§5/§6) existe *en documentation* dans le classeur, mais :
(a) il n'est **pas vérifié à l'exécution** — importer « Contacts » avant
« Clients » échoue au fil de l'eau sans pré-contrôle global ; (b) les onglets du
classeur complet sont ajoutés dans l'ordre de `MODULES`, **pas** dans l'ordre
recommandé ; (c) le tableau `ORDER` de `migration-templates.ts` est une
**seconde liste hardcodée** pouvant diverger de `MODULES`.
**Recommandation** : porter l'ordre + les dépendances dans `ModuleDef`
(`order`, `dependsOn[]`), générer les onglets dans cet ordre, et exposer une
**pré-validation croisée** avant import (« N clients requis, 0 présents »).

#### P2-5 — Pas de dictionnaire de données central unique — ⏳ À FAIRE
Le besoin §2 (dictionnaire central : entité → champ → type → obligatoire →
règle → relation) est aujourd'hui éclaté entre `MODULES` (import), le schéma
Drizzle (`@workspace/db/schema`) et le catalogue de permissions.
**Recommandation** : générer un dictionnaire à partir de `MODULES` + schéma
(script de documentation), source unique réutilisée par les templates et l'UI.

### 🟡 P3 — Cosmétique / dette

#### P3-1 — 13 permissions orphelines dans le catalogue — ⏳ À ARBITRER
Déclarées mais accordées à aucun rôle métier et appliquées nulle part
(ni API ni UI) : `dashboard.export`, `support.read`, `support.manage`,
`notifications.manage`, `clients.delete`, `clients.view_confidential`,
`commercial.delete`, `sales.manage_credit_notes`, `projects.delete`,
`accounting.import`, `inventory.manage_warehouses`, `ai.manage_translation`,
`ai.manage_whatsapp`. À **câbler** (si la fonction existe) ou **retirer** du
catalogue. Listées par `check-permissions` (bloc `ORPHAN`).

#### P3-2 — Formats de date d'import limités — ⏳ À FAIRE
`parseDate` n'accepte que `YYYY-MM-DD`, `DD/MM/YYYY`, `DD-MM-YYYY`. Les exports
comptables locaux en `DD.MM.YYYY` ou dates Excel sérielles ne sont pas couverts.

---

## 3. Contrôle automatique livré (§13)

`scripts/src/check-permissions.ts` — lancer :

```bash
pnpm --filter @workspace/scripts run check-permissions
```

Source de vérité : `artifacts/api-server/src/lib/rbac/catalog.ts`
(importé directement — fichier sans dépendance). Le contrôle scanne
149 fichiers API + 338 fichiers UI et rapporte :

| Code | Sévérité | Détection |
|------|----------|-----------|
| `DUPLICATE` | bloquant | Un code déclaré plusieurs fois dans `PERMISSIONS`. |
| `ROLE-STALE` | bloquant | Un rôle système accorde un code **absent du catalogue** (ancien code). |
| `ENFORCE-UNKNOWN` | bloquant | `requirePermission` / `usePermissions` référence un code inexistant (route qui « protège » un code fantôme). |
| `UI-STALE` | bloquant | La grille `admin/roles.tsx` référence un code absent du catalogue. |
| `ORPHAN` | avert. | Permission déclarée mais accordée/appliquée nulle part. |
| `UI-UNLISTED` | avert. | Permission du catalogue absente de la grille UI → non assignable. |

**État actuel** : ✅ 0 incohérence bloquante ; ⚠ 13 `ORPHAN` (P3-1) + 6
`UI-UNLISTED` (P1-3). Le contrôle échoue le build (exit 1) sur toute nouvelle
incohérence bloquante — filet anti-régression permanent, à ajouter au CI aux
côtés de `check-routes`.

---

## 4. Rôles & permissions — état

- **Catalogue** : 133 permissions, 24 catégories métier.
- **Rôles système** : 10 (`super_admin`, `admin`, `manager`, `comptable`,
  `commercial`, `rh`, `financier`, `logistique`, `auditeur`, `collaborator`).
- `super_admin` = `"*"` (tout) ; `admin` = tout **sauf** `roles.manage`
  (réservé super-admin, décision d'audit §D) — cohérent.
- Enforcement backend strict (`requirePermission` / `requireAnyPermission`,
  aucun bypass wildcard) ; UI purement décorative (`usePermissions`), le backend
  reste l'autorité. **Bon modèle de sécurité.**
- Surcharges individuelles (`user_permission_overrides`, grant/deny + expiration)
  désormais réellement pilotables (P1-1 corrigé).

---

## 5. Multi-tenant (§14)

Tous les exécuteurs d'import et toutes les résolutions de parents filtrent par
`organizationId`. Les insertions posent `organizationId: orgId` (issu de
`req.authUser.organizationId`). **Aucune fuite inter-organisation détectée** dans
le périmètre migration/permissions. À conserver comme invariant testé.

---

## 6. Reste à faire (hors périmètre « safe » de ce lot)

Nécessitent des décisions produit et/ou un environnement de préprod/DB :

1. **P1-3** — Unifier la grille de droits UI sur le catalogue backend (retirer
   `MODULE_DEFS`/`ROLE_TEMPLATES` hardcodés) — validation visuelle requise.
2. **P2-2/P2-3** — Clés de rapprochement + upsert + idempotence des à-nouveaux
   (mode « ignorer/mettre à jour », `batch-id`, réversibilité §8/§9).
3. **P2-4** — `order`/`dependsOn` dans `ModuleDef` + pré-validation croisée +
   onglets ordonnés (§5/§6).
4. **P2-5** — Générateur de dictionnaire de données central (§2).
5. **P3-1** — Arbitrer les 13 permissions orphelines (câbler ou retirer).
6. **P3-2** — Élargir `parseDate` (formats `.`, dates Excel sérielles).

---

## 7. Vérifications de ce lot

| Contrôle | Résultat |
|----------|----------|
| `check-permissions` (nouveau) | ✅ 0 bloquant (avant correctif : 1 `ENFORCE-UNKNOWN`) |
| `check-routes` | ✅ 488 fichiers / 200 routes |
| Typecheck `@workspace/scripts` | ✅ 0 erreur |
| Typecheck `@workspace/api-server` | ✅ 41 (baseline inchangée) |

Fichiers modifiés : `scripts/src/check-permissions.ts` (nouveau),
`scripts/package.json`, `artifacts/api-server/src/routes/admin.ts`,
`artifacts/api-server/src/lib/migration-engine.ts`.
