# Gaméasù

**Gérer aujourd'hui. Construire demain.**

Gaméasù est une plateforme **ERP SaaS B2B multi-tenant** conçue pour les
organisations du Togo et d'Afrique de l'Ouest francophone. Elle réunit dans un
seul espace de travail le pilotage **commercial (CRM), projet, comptable, RH,
opérationnel, logistique et financier**, facturé en FCFA (XOF).

En production : **[erp.gameasu.com](https://erp.gameasu.com)**.

> Gaméasù est issu d'une refonte du socle *EDOLE Africa*. On peut encore
> croiser d'anciennes appellations (« EDOLE », « Nexora ») dans quelques
> commentaires ou données historiques ; l'identité active du produit est
> **Gaméasù**, centralisée dans `artifacts/edole-admin/src/config/branding.ts`.

---

## 1. Fonctionnalités principales

| Domaine        | Contenu                                                                       |
| -------------- | ----------------------------------------------------------------------------- |
| **CRM & Ventes** | Clients, contacts, activités, pipeline commercial, devis, appels             |
| **Facturation**  | Factures, avoirs, commandes, paiements (Stripe + CinetPay Mobile Money)      |
| **Projets**      | Projets, tâches, suivi d'avancement, approbations                            |
| **RH**           | Collaborateurs, contrats, congés, notes de frais, avantages, onboarding, paie BTP |
| **Pointage**     | Application kiosque (borne QR / photo / GPS) pour le pointage des équipes    |
| **Comptabilité** | Écritures, fiscalité, recouvrement, exports comptables                       |
| **Finance / F&A**| Intelligence financière, anomalies, tableaux de bord, briefing quotidien     |
| **Logistique**   | Équipements, mouvements de stock, locations, achats                          |
| **Documents**    | GED, synchronisation cloud (Google Drive), intelligence documentaire         |
| **IA**           | Assistant IA, auto-traduction, détection d'anomalies                          |
| **Plateforme**   | Cockpit super-admin : organisations, plans, modules, facturation, équipe     |

**Public cible :** PME et organisations structurées (BTP, services, négoce)
d'Afrique de l'Ouest francophone cherchant un outil de gestion intégré en FCFA.

---

## 2. Stack technique

| Couche              | Technologie                                                        |
| ------------------- | ----------------------------------------------------------------- |
| **Monorepo**        | pnpm workspaces (`pnpm-workspace.yaml`)                            |
| **Backend**         | Node.js 24 · Express 5 · TypeScript 5.9 (port 8080)               |
| **Frontend**        | React 19 · Vite 7 · Tailwind CSS 4 · shadcn/ui                    |
| **Routing (front)** | Wouter                                                            |
| **Données serveur** | TanStack Query (React Query)                                      |
| **Base de données** | PostgreSQL 16 · Drizzle ORM                                       |
| **Validation**      | Zod (schémas partagés `@workspace/api-zod`)                       |
| **Temps réel**      | Socket.IO (`/api/realtime`)                                       |
| **Auth**            | Bearer token (session en base) · `bcryptjs` · RBAC maison        |
| **Emails**          | Resend (principal) / SendGrid (fallback) · templates maison       |
| **Paiement**        | Stripe (carte) · CinetPay (Mobile Money)                          |
| **Stockage cloud**  | Google Drive (OAuth2, tokens chiffrés AES-256-GCM)               |
| **IA**              | OpenAI / proxy IA Replit                                          |
| **Build**           | esbuild (backend, bundle ESM) · Vite (frontends)                 |
| **Hébergement**     | Replit Autoscale Deployment (`.replit`)                          |

---

## 3. Architecture du projet

Monorepo pnpm : **applications** dans `artifacts/*`, **bibliothèques
partagées** dans `lib/*`, **outillage** dans `scripts/`.

```
Gameasu-Git/
├── artifacts/                    # Applications déployables
│   ├── api-server/               # API REST + WebSocket (Express 5) — port 8080
│   │   └── src/
│   │       ├── routes/           # ~97 modules de routes (auth, crm, hr, billing…)
│   │       ├── services/         # Logique métier (seed démo, etc.)
│   │       ├── middlewares/      # auth, RBAC, gestion d'erreurs
│   │       ├── lib/              # email, paiement, cloud-storage, audit, realtime…
│   │       └── app.ts            # Assemblage Express (helmet, cors, routes)
│   ├── edole-admin/              # Frontend ERP principal (React) — port 25655
│   │   └── src/
│   │       ├── pages/            # ~211 pages, regroupées par domaine métier
│   │       ├── components/       # Composants (dont ui/ = shadcn)
│   │       ├── hooks/            # Hooks React réutilisables
│   │       ├── lib/              # Client API, helpers (saas, query…)
│   │       ├── config/           # branding.ts (identité centralisée)
│   │       └── assets/           # Logos et images de l'app
│   ├── gameasu-cockpit/          # Cockpit plateforme super-admin (React)
│   ├── kiosk/                    # Borne de pointage collaborateurs (React)
│   └── mockup-sandbox/           # Maquettes/prototypes — hors production
├── lib/                          # Paquets partagés (@workspace/*)
│   ├── db/                       # Schéma Drizzle + migrations + seeds
│   │   └── src/schema/           # Tables (saas, hr, crm, accounting…)
│   ├── api-zod/                  # Schémas de validation Zod partagés
│   ├── api-spec/                 # Spécification d'API
│   └── api-client-react/         # Client API typé (React Query)
├── scripts/                      # Outillage (vérification des routes, post-merge)
├── docs/                         # Documentation technique détaillée (voir §10)
├── .env.example                  # Modèle de configuration d'environnement
├── pnpm-workspace.yaml           # Déclaration des paquets + catalog de versions
└── .replit                       # Config d'hébergement Replit
```

### Logique générale

1. **Le frontend** (`edole-admin`) est une SPA React servie par Vite. Il ne
   contient **aucun secret** et communique avec le backend via `/api/*`.
2. **Le backend** (`api-server`) expose une API REST sous `/api` et un canal
   temps réel Socket.IO. Chaque domaine métier a son module de route dans
   `src/routes/`, monté dans `src/routes/index.ts`.
3. **L'authentification** repose sur un Bearer token vérifié par le middleware
   `requireAuth`, complété par un contrôle de permissions **RBAC**
   (`src/lib/rbac`, `src/middlewares`). Les routes protégées valident rôle et
   organisation courante.
4. **Les données** sont modélisées avec **Drizzle** dans `lib/db/src/schema`.
   Les validations d'entrée passent par **Zod** (`lib/api-zod`), partagé entre
   front et back pour une source de vérité unique.
5. **Le multi-tenant** s'articule autour des organisations
   (`organizations`, `organization_members`), des plans d'abonnement et d'un
   **gating par module** appliqué côté front (sidebar, écran *Upgrade*) et
   côté back (403 si le plan ne couvre pas le module).
6. **Les variables d'environnement** sont lues via `process.env` (backend) et
   `import.meta.env.VITE_*` (frontend). Voir `.env.example` — jamais de secret
   côté frontend.

Détails complets dans [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## 4. Installation locale

**Pré-requis :** Node.js 24, [pnpm](https://pnpm.io) 9+, PostgreSQL 16 accessible.

```bash
# 1. Cloner le dépôt
git clone <url-du-depot> && cd Gameasu-Git

# 2. Installer les dépendances (pnpm imposé — voir le hook preinstall)
pnpm install

# 3. Créer le fichier d'environnement
cp .env.example .env
#    puis renseigner au minimum DATABASE_URL

# 4. Appliquer le schéma de base de données
pnpm --filter @workspace/db run push

# 5. (Optionnel) Charger un jeu de données de démonstration
cd lib/db && pnpm exec tsx src/seed-gameasu-master.ts && cd -

# 6. Lancer le backend en développement
pnpm --filter @workspace/api-server run dev   # http://localhost:8080

# 7. Lancer un frontend (ex. l'ERP admin) dans un autre terminal
pnpm --filter @workspace/edole-admin run dev  # http://localhost:25655
```

### Comptes de démonstration (après seed)

| Rôle        | Email                     | Mot de passe    |
| ----------- | ------------------------- | --------------- |
| Super Admin | `admin@gameasu.com`       | `admin123`      |
| Manager     | `directeur@gameasu.com`   | `admin123`      |
| Commercial  | `commercial@gameasu.com`  | `commercial123` |
| Collaborateur | `collab@gameasu.com`    | `collab123`     |

> ⚠️ Identifiants de **démonstration uniquement**. Ne jamais activer le seed
> démo (`SEED_HISSADO_DEMO` / `SEED_DEMO_DATA`) sur une base de production
> réelle avec des comptes à mot de passe par défaut.

---

## 5. Scripts disponibles

Depuis la racine du monorepo :

| Commande                                             | Rôle                                             |
| ---------------------------------------------------- | ------------------------------------------------ |
| `pnpm install`                                       | Installe toutes les dépendances (pnpm requis)    |
| `pnpm run typecheck`                                 | Typecheck de l'ensemble du monorepo + routes     |
| `pnpm run build`                                     | Typecheck puis build de tous les paquets         |
| `pnpm run check-routes`                              | Vérifie la cohérence des routes déclarées        |
| `pnpm --filter @workspace/api-server run dev`        | Backend en développement                         |
| `pnpm --filter @workspace/api-server run build`      | Build backend (esbuild → `dist/`)                |
| `pnpm --filter @workspace/edole-admin run dev`       | Frontend ERP en développement                    |
| `pnpm --filter @workspace/edole-admin run build`     | Build frontend                                   |
| `pnpm --filter @workspace/db run push`               | Applique le schéma Drizzle en base               |
| `cd lib/db && pnpm exec tsx src/seed-gameasu-master.ts` | Charge le jeu de données de démonstration     |

Remplacer `edole-admin` par `gameasu-cockpit` ou `kiosk` pour les autres apps.

---

## 6. Déploiement

Le projet est déployé sur **Replit Autoscale** (voir `.replit`) sous
`erp.gameasu.com`.

- **Build de déploiement :** `pnpm run build` puis `pnpm store prune`
  (`deployment.postBuild`).
- **Variables d'environnement de production :** fournies via **Replit Secrets**
  (et non versionnées). La liste des variables attendues est dans `.env.example`.
- **Points d'attention avant mise en production :**
  - `DATABASE_URL` pointe vers la base de production.
  - `SEED_HISSADO_DEMO` / `SEED_DEMO_DATA` désactivés en production réelle.
  - Secrets Stripe/CinetPay/Google/`CLOUD_STORAGE_ENCRYPTION_KEY` renseignés
    via le gestionnaire de secrets — **jamais** dans un fichier versionné.
  - `NODE_ENV=production` (active HSTS + désactive les traces de debug).

Procédure détaillée : [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## 7. Contribution

- **Branches :** `feature/<sujet>`, `fix/<sujet>`, `chore/<sujet>` à partir de `main`.
- **Commits :** messages clairs et impératifs (idéalement
  [Conventional Commits](https://www.conventionalcommits.org/) : `feat:`, `fix:`, `docs:`…).
- **Avant de pousser :** `pnpm run typecheck` doit passer sans erreur.
- **Pull requests :** description du changement, captures si UI, mention des
  éventuelles migrations de schéma.
- **Formatage :** Prettier (`pnpm exec prettier --write .`).

Détails : [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md).

---

## 8. Maintenance

- **Mettre à jour les dépendances :** `pnpm update -r --latest` (par paquet),
  puis `pnpm run typecheck` et test manuel. Les versions communes sont pinnées
  dans le `catalog` de `pnpm-workspace.yaml`.
- **Ajouter une page (frontend) :** créer le composant dans
  `artifacts/edole-admin/src/pages/<domaine>/` et l'enregistrer dans le routeur.
- **Ajouter un composant réutilisable :** `artifacts/edole-admin/src/components/`
  (UI générique dans `components/ui/`).
- **Ajouter une route API :** créer `artifacts/api-server/src/routes/<nom>.ts`,
  la monter dans `routes/index.ts`, définir le schéma Zod dans `lib/api-zod`.
- **Ajouter une variable d'environnement :** l'ajouter à `.env.example` (avec
  commentaire), la lire via `process.env` / `import.meta.env`, la documenter.
- **Ajouter une table :** modifier `lib/db/src/schema/`, générer/appliquer la
  migration, ajouter le schéma Zod correspondant.

---

## 9. Sécurité

Points d'attention et bonnes pratiques : [`docs/SECURITY.md`](docs/SECURITY.md).
Aucun secret ne doit être committé ; les fichiers `.env` sont ignorés par git.

---

## 10. Documentation

| Fichier                                       | Contenu                                    |
| --------------------------------------------- | ------------------------------------------ |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)   | Architecture technique détaillée           |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)       | Procédure de déploiement                   |
| [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md)   | Règles de contribution                     |
| [`docs/SECURITY.md`](docs/SECURITY.md)           | Bonnes pratiques de sécurité               |
| [`docs/CODEBASE_AUDIT.md`](docs/CODEBASE_AUDIT.md) | Audit : problèmes détectés & corrections |
| [`CHANGELOG.md`](CHANGELOG.md)                   | Historique des modifications               |
