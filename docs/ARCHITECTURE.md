# Architecture technique — Gaméasù

Ce document décrit l'architecture technique de la plateforme Gaméasù pour un
développeur qui découvre le projet.

## 1. Vue d'ensemble

Gaméasù est un **monorepo pnpm** composé de plusieurs applications frontend, d'un
serveur d'API unique et de bibliothèques partagées. Le tout est écrit en
**TypeScript**.

```
┌──────────────────────────────────────────────────────────────────┐
│                        Navigateur (SPA React)                      │
│  edole-admin (ERP)   gameasu-cockpit (plateforme)   kiosk (pointage)│
└───────────────┬──────────────────┬──────────────────┬─────────────┘
                │  HTTP /api/*       │  WebSocket        │
                ▼                    ▼                   ▼
        ┌───────────────────────────────────────────────────────┐
        │         api-server (Express 5, port 8080)              │
        │  helmet · cors · pino · requireAuth · RBAC · routes/*  │
        └───────────────┬───────────────────────────────────────┘
                        │ Drizzle ORM
                        ▼
                ┌───────────────────┐      Services externes :
                │  PostgreSQL 16    │      Stripe · CinetPay · Google Drive
                └───────────────────┘      Resend/SendGrid · OpenAI
```

## 2. Paquets du monorepo

Déclarés dans `pnpm-workspace.yaml` (`artifacts/*`, `lib/*`, `lib/integrations/*`, `scripts`).

### Applications (`artifacts/`)

| Paquet                     | Rôle                                                        |
| -------------------------- | ----------------------------------------------------------- |
| `@workspace/api-server`    | API REST + WebSocket. Unique backend, source de vérité.     |
| `@workspace/edole-admin`   | Frontend ERP principal (le produit vu par les clients).     |
| `@workspace/gameasu-cockpit` | Cockpit super-admin plateforme (orgs, plans, facturation).|
| `@workspace/kiosk`         | Borne de pointage (QR / photo / GPS) pour les équipes.      |
| `@workspace/mockup-sandbox`| Maquettes et prototypes. **Non déployé en production.**     |

### Bibliothèques partagées (`lib/`)

| Paquet                        | Rôle                                                    |
| ----------------------------- | ------------------------------------------------------- |
| `@workspace/db`               | Schéma Drizzle, client DB, migrations, seeds.           |
| `@workspace/api-zod`          | Schémas de validation Zod partagés front/back.          |
| `@workspace/api-spec`         | Spécification d'API.                                     |
| `@workspace/api-client-react` | Client API typé (hooks React Query).                    |

Le `catalog` de `pnpm-workspace.yaml` centralise les versions communes (React,
Vite, Tailwind, Drizzle, Zod…) pour garantir la cohérence entre paquets.

## 3. Backend — `api-server`

### Chaîne de traitement (`src/app.ts`)

1. `trust proxy` (derrière le proxy Replit, lecture de `X-Forwarded-For`).
2. `helmet` — en-têtes de sécurité (HSTS en production uniquement).
3. `pino-http` — logs structurés (URL sans query-string).
4. `cors`.
5. Webhooks paiement montés **avant** `express.json()` (corps brut requis pour la
   vérification de signature HMAC : Stripe, CinetPay).
6. `express.json({ limit: "5mb" })`.
7. `/uploads` et `/api/uploads` — fichiers statiques protégés par `requireAuth`.
8. `/api` → routeur principal.
9. Middleware d'erreur global (masque les erreurs 5xx, journalise via pino).

### Organisation des routes (`src/routes/`)

~97 modules, un par domaine métier (`auth`, `crm`, `hr`, `billing-stripe`,
`attendance`, `accounting`, `fpa`, `cloud-storage`…), montés dans
`src/routes/index.ts`. Chaque module exporte un `Router` Express.

### Bibliothèques internes (`src/lib/`)

- `email.ts` — envoi transactionnel (Resend/SendGrid, templates).
- `stripe.ts`, `cinetpay.ts` — passerelles de paiement.
- `cloud-storage/` — OAuth Google Drive, chiffrement AES des tokens (`encryption.ts`).
- `audit.ts` — journal d'audit (niveaux de sévérité par action).
- `realtime.ts` — Socket.IO (`/api/realtime`).
- `rbac/` — catalogue de permissions, seed des rôles.
- `tenant.ts` — résolution de l'organisation / abonnement courant.
- `payroll-engine.ts`, `fiscal-engine.ts`, `pricing.ts` — moteurs métier.
- `logger.ts` — instance pino partagée.

### Middlewares (`src/middlewares/`)

- `auth.ts` — `requireAuth` : valide le Bearer token, charge l'utilisateur.
- `permissions.ts` — contrôle RBAC par permission/rôle.

## 4. Frontend — `edole-admin`

- **SPA React 19 + Vite 7.** Routing via **Wouter**.
- **Données serveur** via **TanStack Query** (cache, états loading/error/success).
- **UI** : Tailwind CSS 4 + composants **shadcn/ui** (`src/components/ui/`).
- **Identité** centralisée dans `src/config/branding.ts` (nom, slogan, couleurs,
  logo) — rebrandable en un seul endroit, surchargée par `VITE_APP_*`.
- **Pages** (`src/pages/`) organisées par domaine métier (crm, hr, invoices,
  projects, finance…).
- **Aucun secret** côté frontend : seules les variables `VITE_*` (publiques) sont
  exposées au navigateur.

## 5. Données — `lib/db`

- **Drizzle ORM**, schéma découpé par domaine dans `src/schema/` (`saas.ts`,
  `hr.ts`, `crm.ts`, `accounting.ts`, `rbac.ts`, `attendance.ts`…).
- Migrations et scripts de seed (`seed-gameasu-master.ts`, `seed-rich.ts`…).
- Application du schéma en développement : `pnpm --filter @workspace/db run push`.

## 6. Multi-tenant & modèle SaaS

- Tables `organizations`, `organization_members`, `subscription_plans`,
  `organization_subscriptions`, `organization_modules`, `billing_events`.
- **4 plans** (Starter / Growth / Professional / Enterprise) en FCFA.
- **Gating par module** : appliqué côté frontend (sidebar + écran *Upgrade*) et
  backend (403 si le plan ne couvre pas le module).
- **État connu (dette technique) :** certaines tables métier historiques ne sont pas
  encore partitionnées par `organization_id` ; elles vivent implicitement dans
  l'organisation par défaut. Le filtrage strict par organisation est la
  prochaine étape d'isolation multi-tenant (voir `CODEBASE_AUDIT.md`).

## 7. Authentification & autorisation

- **Session par Bearer token** vérifié par `requireAuth` (token → utilisateur).
- **RBAC** : rôles (`super_admin`, `manager`, `commercial`, `collaborateur`…)
  et permissions déclarés dans `src/lib/rbac/catalog.ts`, appliqués par le
  middleware `permissions.ts`.
- Mots de passe hachés avec `bcryptjs`.
- Fichiers `/uploads` accessibles uniquement authentifié (pas encore de contrôle
  d'accès par ressource — voir `SECURITY.md`).

## 8. Temps réel

Socket.IO exposé sous `/api/realtime` (`src/lib/realtime.ts`) : notifications,
mises à jour de présence/pointage, alertes.

## 9. Intégrations externes

| Service       | Usage                                | Variables                                    |
| ------------- | ------------------------------------ | -------------------------------------------- |
| Stripe        | Paiement carte                       | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| CinetPay      | Mobile Money (Afrique de l'Ouest)    | `CINETPAY_*`                                 |
| Google Drive  | Synchronisation documentaire (OAuth) | `GOOGLE_CLIENT_ID/SECRET`, `CLOUD_STORAGE_ENCRYPTION_KEY` |
| Resend/SendGrid | Emails transactionnels             | `RESEND_API_KEY` / `SENDGRID_API_KEY`        |
| OpenAI        | Assistant IA, traduction             | `OPENAI_API_KEY`, `OPENAI_BASE_URL`          |
