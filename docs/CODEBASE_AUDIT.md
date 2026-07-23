# Audit de la base de code — Gaméasù

_Date : 23 juillet 2026 · Périmètre : monorepo complet (`erp.gameasu.com`)._

Ce document recense les problèmes détectés lors de l'audit, les corrections
appliquées et les points restant à traiter. Il complète le rapport de synthèse
placé en fin de fichier.

---

## 1. Vue d'ensemble du dépôt

| Indicateur                 | Avant audit | Après audit |
| -------------------------- | ----------- | ----------- |
| Fichiers versionnés        | 1517        | 894         |
| Contenu versionné (hors `.git`) | ~150 Mo | ~21 Mo      |
| `attached_assets/`         | 619 fichiers / 133 Mo (inutilisés) | supprimé |
| Uploads runtime versionnés | 4 fichiers `.webm` (428 Ko) | supprimés + ignorés |
| Erreurs de typecheck (api-server) | 122 | 65 |
| Erreurs de typecheck (edole-admin) | 24 | 24 (documentées) |

Architecture : **monorepo pnpm** — 5 applications (`artifacts/*`) + 4 paquets
partagés (`lib/*`) + outillage (`scripts/`). Stack : Express 5 / React 19 /
Vite 7 / Drizzle / PostgreSQL. Voir [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## 2. Problèmes détectés

### 2.1 Sécurité

| # | Sévérité | Constat | Statut |
| - | -------- | ------- | ------ |
| S1 | **Critique** | `CLOUD_STORAGE_ENCRYPTION_KEY` (clé AES-256 en clair) versionnée dans `.replit`. | **À traiter** — documenté ([`SECURITY.md`](SECURITY.md)) ; non retiré automatiquement pour ne pas casser le déchiffrement en production (rotation + Secrets requis). |
| S2 | Moyenne | Fichiers `/uploads` protégés par authentification mais **sans contrôle d'accès par ressource** : tout utilisateur authentifié accède à tout média. | À traiter (recommandation) |
| S3 | Moyenne | Uploads utilisateurs (`artifacts/api-server/uploads/*.webm`) versionnés dans git. | **Corrigé** — supprimés + dossier ajouté au `.gitignore` |
| S4 | Faible | Seed de démonstration à mots de passe par défaut (`admin123`…) activable en production via `SEED_HISSADO_DEMO`. | Documenté ([`SECURITY.md`](SECURITY.md), [`DEPLOYMENT.md`](DEPLOYMENT.md)) |

**Point positif :** aucun secret en dur dans le code applicatif — toutes les
valeurs sensibles sont lues via `process.env` (vérifié par balayage). Le
frontend n'expose que des variables `VITE_*` publiques. Webhooks de paiement
avec vérification de signature HMAC (Stripe, CinetPay). En-têtes `helmet`, HSTS
en production, logs pino sans query-string.

### 2.2 Qualité / compilation

| # | Constat | Statut |
| - | ------- | ------ |
| Q1 | `pnpm run typecheck` échoue : **122 erreurs** dans `api-server`, **24** dans `edole-admin`. Le runtime fonctionne car le build passe par esbuild/Vite (transpilation sans vérification de types). | **Partiellement corrigé** (voir §3) |
| Q2 | Cause racine dominante : le type du paramètre `req.id` du helper `audit()` (`string`) ne couvrait pas le type `ReqId` de pino (`string \| number \| object`) → ~57 erreurs en cascade. | **Corrigé** |
| Q3 | Erreurs résiduelles hétérogènes : propriétés Drizzle inexistantes (`grantedById` sur `role_permissions`), surcharges d'`insert` incompatibles, résultats de requêtes typés `unknown` côté frontend non désérialisés. | À traiter (dette suivie, §4) |

### 2.3 Cohérence / nommage

| # | Constat | Statut |
| - | ------- | ------ |
| N1 | **Dérive de marque** : trois appellations coexistent — `EDOLE` (héritage), `Nexora` (transition), `Gaméasù` (actif). 13 fichiers mentionnent « nexora », 4 « edole ». | Documenté ; `.env.example` et `README` réalignés sur Gaméasù |
| N2 | Le paquet applicatif principal s'appelle toujours `@workspace/edole-admin` alors que le produit est Gaméasù. | À traiter (renommage invasif — recommandation) |
| N3 | `.env.example` obsolète : branding « Nexora », ~20 variables réellement utilisées manquantes (Stripe, CinetPay, Google, emails, `VITE_STRIPE_PUBLISHABLE_KEY`…). | **Corrigé** — réécrit à partir des `process.env` réels |

### 2.4 Fichiers / assets inutilisés

| # | Constat | Statut |
| - | ------- | ------ |
| F1 | `attached_assets/` : 619 fichiers (133 Mo) — uploads de conversation, **aucune référence** dans le code (ni import `@assets`, ni service statique, ni seed). | **Supprimé** |
| F2 | Alias Vite `@assets` déclaré dans 3 `vite.config.ts` mais **jamais importé**. | **Supprimé** |
| F3 | Documents internes en racine (`PRESENTATION_CLIENT.md`, `AUDIT_HISSADO_VS_EDOLE.md`) — supports commerciaux/audit, non liés au code. | **Déplacés** vers `docs/archive/` |
| F4 | 15 scripts de seed (`seed-*.ts`) et 6 scripts `migrate-*.ts` one-shot dans `lib/db/src/` — utiles au dev/démo mais encombrants et potentiellement redondants. | Conservés (dev) — à rationaliser (recommandation) |

### 2.5 Dépendances & configuration

| # | Constat | Statut |
| - | ------- | ------ |
| D1 | Gestion propre : versions communes centralisées dans le `catalog` de `pnpm-workspace.yaml` ; séparation prod/dev correcte dans chaque `package.json`. | OK |
| D2 | Détection fine des dépendances inutilisées non réalisée (nécessite `knip`/`depcheck` en CI, non disponible dans cet environnement d'audit). | Recommandation (§5) |

---

## 3. Corrections appliquées dans cet audit

1. **`.env.example` réécrit** — aligné sur Gaméasù, complété avec l'intégralité
   des variables réellement lues par le code (backend + `VITE_*`), commentées et
   marquées `(requis)` / `(option)`. Aucune valeur secrète.
2. **`README.md` réécrit** — document de reprise complet (présentation, stack,
   architecture commentée, installation, scripts, déploiement, contribution,
   maintenance).
3. **Documentation `docs/`** créée : `ARCHITECTURE.md`, `DEPLOYMENT.md`,
   `CONTRIBUTING.md`, `SECURITY.md`, ce fichier ; `CHANGELOG.md` conservé en racine.
4. **`attached_assets/` supprimé** (133 Mo, inutilisés — vérifié) et **alias
   Vite `@assets`** retiré des 3 configs.
5. **Uploads runtime** (`artifacts/api-server/uploads/*.webm`) supprimés du suivi
   git et le dossier **ajouté au `.gitignore`** (recréé automatiquement au
   démarrage par `fs.mkdirSync`).
6. **Documents internes** déplacés en `docs/archive/`.
7. **Correction de type sûre** dans `api-server/src/lib/audit.ts** (type de
   `req.id` aligné sur `ReqId`) : **122 → 65** erreurs de typecheck, sans aucun
   impact runtime (correction purement typographique).

> Aucune fonctionnalité applicative n'a été modifiée : les changements portent
> sur la documentation, la configuration, des fichiers vérifiés comme inutilisés
> et une annotation de type sans effet à l'exécution.

---

## 4. Dette technique restante (à traiter progressivement)

| Priorité | Élément | Piste de résolution |
| -------- | ------- | ------------------- |
| Haute | **Rotation du secret S1** + retrait de `.replit` + purge d'historique | Voir [`SECURITY.md`](SECURITY.md) §1 |
| Haute | **65 erreurs de typecheck `api-server`** (schéma Drizzle vs code) | Traiter par fichier ; corriger `grantedById`, surcharges `insert`, propriétés manquantes |
| Haute | **24 erreurs de typecheck `edole-admin`** (résultats de requêtes `unknown`) | Typer les retours du client API (générer via `api-spec`/Zod plutôt que `unknown`) |
| Moyenne | **Contrôle d'accès par ressource** sur `/uploads` (S2) | Vérifier l'appartenance (ownership/organisation) avant de servir le fichier |
| Moyenne | **Isolation multi-tenant** : tables métier non partitionnées par `organization_id` | Ajouter la colonne + filtrage systématique par organisation |
| Basse | **Unification de la marque** (N1/N2) : supprimer les mentions `EDOLE`/`Nexora`, renommer `edole-admin` | Renommage de paquet + recherche/remplacement contrôlés |
| Basse | **Rationalisation des seeds/migrations** (F4) | Regrouper sous `lib/db/src/seeds/` et `migrations/` ; archiver les migrations appliquées |

---

## 5. Recommandations pour la suite

1. **Rendre le typecheck bloquant en CI** une fois les 89 erreurs résiduelles
   corrigées (`pnpm run typecheck`), pour empêcher toute régression de typage.
2. **Ajouter un linter** (ESLint) et **Prettier en pre-commit** (Husky +
   lint-staged) pour uniformiser le formatage automatiquement.
3. **Détecter les dépendances/exports morts** avec `knip` ou `depcheck` en CI.
4. **Ajouter des tests** sur les fonctions critiques : moteurs de paie/fiscalité
   (`payroll-engine.ts`, `fiscal-engine.ts`), calcul de facturation, RBAC.
5. **Externaliser tous les secrets** vers le gestionnaire de secrets (aucune
   valeur sensible dans un fichier versionné, `.replit` inclus).
6. **Générer le client API typé** de bout en bout (`lib/api-spec` → hooks) pour
   éliminer les `unknown` côté frontend.

---

## 6. Rapport de synthèse

**Problèmes détectés :** secret AES exposé dans `.replit` (critique) ; absence de
contrôle d'accès par ressource sur les médias ; uploads runtime versionnés ;
typecheck en échec (146 erreurs cumulées) ; dérive de marque EDOLE/Nexora/Gaméasù ;
133 Mo d'assets inutilisés ; `.env.example` obsolète et incomplet.

**Fichiers supprimés :** `attached_assets/` (619 fichiers, 133 Mo) ; 4 uploads
`.webm` runtime ; alias Vite `@assets` (3 configs). **Déplacés :** 2 documents
internes vers `docs/archive/`.

**Dépendances :** aucune suppression (gestion `catalog` déjà saine) ; détection
fine des inutilisées recommandée en CI.

**Composants refactorisés :** correction de type sûre du helper `audit()`
(−57 erreurs). Aucune modification de comportement applicatif.

**Réorganisation :** documentation professionnelle centralisée (`README` + `docs/`) ;
racine du dépôt désencombrée.

**Sécurité corrigée :** uploads runtime retirés du suivi + ignorés ; secret
critique documenté avec procédure de remédiation ; `.env.example` sans valeur
sensible.

**Performance :** contenu versionné allégé de ~86 % (~150 → ~21 Mo hors `.git`),
image de déploiement réduite d'autant. Lockfile nettoyé d'un importer fantôme
(`artifacts/edole-deck`).

**Restant à traiter / risques :** rotation du secret S1 (intervention infra) ;
89 erreurs de typecheck résiduelles ; contrôle d'accès médias ; isolation
multi-tenant stricte ; unification de la marque. Détail et priorités en §4.
