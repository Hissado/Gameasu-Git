# Nexora

**Le pilotage d'entreprise nouvelle génération.**

Nexora est une plateforme SaaS B2B multi-tenant conçue pour les organisations du Togo et d'Afrique de l'Ouest francophone. Elle réunit dans un seul espace de travail le pilotage commercial, projet, comptable, RH, opérationnel et financier — facturé en FCFA.

> Nexora est issu d'une refonte du socle EDOLE Africa, dont elle reprend la base technique (Express + Vite + Drizzle + Postgres) et ajoute :
> organisations multi-tenant, plans d'abonnement, catalogue de modules, facturation, paramétrage de l'espace de travail et identité visuelle dédiée.

## Stack

| Couche             | Technologie                                                       |
| ------------------ | ----------------------------------------------------------------- |
| Monorepo           | pnpm workspaces                                                   |
| Backend            | Node.js 24 · Express 5 · TypeScript 5.9 (port 8080)               |
| Frontend           | React + Vite + shadcn/ui + Tailwind CSS (port 25655)              |
| Base de données    | PostgreSQL + Drizzle ORM                                          |
| Validation         | Zod (`zod/v4`), `drizzle-zod`                                     |
| API codegen        | Orval (depuis l'OpenAPI spec)                                     |
| Build              | esbuild (CJS bundle)                                              |
| Realtime           | Socket.IO sur `/api/realtime`                                     |
| Charts             | Recharts                                                          |
| Routing            | Wouter                                                            |

## Démarrage rapide

```bash
# Pré-requis : Node 24 + pnpm + PostgreSQL accessible via DATABASE_URL
cp .env.example .env
pnpm install
pnpm --filter @workspace/db run push        # applique le schéma
pnpm --filter @workspace/api-server run dev # ou via les workflows Replit
```

L'API démarre sur le port `8080` et exécute automatiquement les seeds idempotents :
RBAC (rôles + permissions), HR (départements + postes) et **SaaS Nexora**
(catalogue de modules, 4 plans, organisation par défaut, abonnement Professional, modules activés, historique de facturation de démo).

Identifiants de démonstration :

| Rôle              | Email                          | Mot de passe   |
| ----------------- | ------------------------------ | -------------- |
| Super Admin       | `admin@edole.africa`           | `admin123`     |
| Manager           | `manager@edole.africa`         | `manager123`   |
| Commercial        | `commercial@edole.africa`      | `commercial123`|
| Collaborateur     | `collab@edole.africa`          | `collab123`    |

## Architecture

```
artifacts/
  api-server/                Express API server (port 8080)
    src/routes/              Route handlers
      organizations.ts       /api/organizations(/current|/:id) + membres
      subscriptions.ts       /api/subscription-plans, /api/subscriptions/*,
                             /api/organization-modules/*, /api/billing/*,
                             /api/workspace-settings/*
      …                      auth, users, clients, crm, projects, tasks,
                             accounting, fpa, messaging, equipment, rentals, etc.
    src/lib/tenant.ts        getCurrentOrganizationId / getCurrentSubscription

  edole-admin/               React + Vite frontend (port 25655)
    src/config/branding.ts   Identité Nexora (logo, slogan, couleurs)
    src/lib/saas.ts          Hooks SaaS (plans, abonnement, modules, billing)
    src/components/
      Layout.tsx             Sidebar Nexora 3 groupes + PlanBadge + module gating
      PlanBadge.tsx          Badge plan (Starter/Growth/Professional/Enterprise)
      FeatureGate.tsx        Gating par module + UpgradeRequired
      branding/AppLogo.tsx
    src/pages/
      billing.tsx            Abonnement, plans, cycle, historique
      workspace-settings.tsx Identité, branding, préférences, modules
      upgrade-required.tsx   Écran upsell pour module non inclus

lib/
  api-spec/                  OpenAPI spec + Orval codegen
  api-client-react/          Hooks React Query générés
  api-zod/                   Schémas Zod générés
  db/                        Drizzle schema + DB client
    src/schema/saas.ts       organizations, organization_members,
                             module_catalog, subscription_plans (+ features),
                             organization_subscriptions, organization_modules,
                             billing_events, workspace_invitations
    src/seed-saas.ts         Seed SaaS idempotent
```

## Modèle SaaS

### Plans (FCFA, par utilisateur)

| Code            | /mois     | /an       | Setup       | Cible                                        |
| --------------- | --------- | --------- | ----------- | -------------------------------------------- |
| `STARTER`       | 8 000     | 80 000    | 0           | Petites équipes structurant leur activité    |
| `GROWTH`        | 18 000    | 180 000   | 250 000     | Organisations en expansion (ventes + compta) |
| `PROFESSIONAL`  | 35 000    | 350 000   | 750 000     | Structures multi-services (finance + ops)    |
| `ENTERPRISE`    | 60 000    | 600 000   | 2 500 000   | Groupes & grandes organisations              |

### Modules

20 modules organisés en trois catégories : `core` (toujours inclus), `business`
(à la carte selon le plan) et `admin` (toujours inclus). Le gating est appliqué
côté frontend (sidebar + écran *Upgrade required*) et côté backend (`/api/organization-modules/:key/toggle` renvoie 403 si le plan ne couvre pas le module).

## Endpoints clés (SaaS)

| Méthode | Route                                            | Description                                 |
| ------- | ------------------------------------------------ | ------------------------------------------- |
| GET     | `/api/organizations/current`                     | Organisation de l'utilisateur courant       |
| PATCH   | `/api/organizations/current`                     | Mise à jour (admin)                         |
| GET     | `/api/organization-members`                      | Membres de l'espace de travail              |
| GET     | `/api/subscription-plans`                        | Tous les plans publics + features           |
| GET     | `/api/subscriptions/current`                     | Abonnement courant + plan                   |
| POST    | `/api/subscriptions/change-plan`                 | Change la formule (recalcule les modules)   |
| POST    | `/api/subscriptions/change-billing-cycle`        | Mensuel ↔ Annuel                            |
| GET     | `/api/organization-modules`                      | Liste des modules de l'organisation         |
| PATCH   | `/api/organization-modules/:moduleKey/toggle`    | Activer/désactiver un module                |
| GET     | `/api/billing/summary`                           | Résumé facturation + 12 derniers évènements |
| GET     | `/api/billing/events`                            | Historique complet                          |
| GET     | `/api/billing/usage`                             | Sièges utilisés vs sièges totaux            |
| GET     | `/api/workspace-settings`                        | Org + abonnement + plan + modules           |
| PATCH   | `/api/workspace-settings/{general\|branding\|preferences}` | MAJ par section          |

## Variables d'environnement

Voir `.env.example`. Les principales :

- `DATABASE_URL` — connexion PostgreSQL (obligatoire)
- `APP_NAME`, `APP_TAGLINE_FR`, `APP_TAGLINE_EN` — identité produit (override possible côté frontend via `VITE_APP_*`)
- `BILLING_CURRENCY` (`XOF`), `DEFAULT_BILLING_CYCLE`, `DEFAULT_PLAN_CODE`
- `SENDGRID_API_KEY` / `RESEND_API_KEY` — email transactionnel (fallback `preview`)
- `OPENAI_API_KEY` / `OPENAI_BASE_URL` — IA (auto-traduction + transcription, optionnel)

## Commandes utiles

- `pnpm run typecheck` — typecheck complet
- `pnpm run build` — typecheck + build
- `pnpm --filter @workspace/api-spec run codegen` — regénère les hooks et Zod schemas
- `pnpm --filter @workspace/db run push` — pousse le schéma en DB (dev)
- `cd lib/db && pnpm exec tsx src/seed.ts` — seed métier (clients, projets, etc.)
- `cd lib/db && pnpm exec tsx src/seed-saas.ts` — seed SaaS manuel (idempotent)

## Roadmap technique

Les tables métier existantes (clients, projets, factures, etc.) n'ont pas encore
été partitionnées par `organization_id`. Elles vivent implicitement dans
l'organisation par défaut (`nexora-demo`). L'introduction d'une colonne
`organizationId` sur ces tables et le filtrage automatique dans chaque route
constituent la prochaine étape pour un multi-tenant strict.
