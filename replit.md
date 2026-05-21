# Gaméasù — Le pilotage d'entreprise nouvelle génération

## Overview

Plateforme SaaS B2B **multi-tenant** rebrandée **Gaméasù**, conçue pour les organisations du Togo et d'Afrique de l'Ouest francophone. Issue d'une refonte du socle EDOLE Africa, elle ajoute organisations, plans d'abonnement (Starter/Growth/Professional/Enterprise en FCFA), catalogue de modules, événements de facturation, paramétrage de l'espace de travail, gating par module et identité visuelle dédiée.

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5 (port 8080)
- **Frontend**: React + Vite + shadcn/ui + Tailwind CSS (port 25655)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Charts**: Recharts
- **Routing**: Wouter
- **Realtime**: Socket.IO (server `socket.io`, client `socket.io-client`) sur `/api/realtime`
- **AI (optionnel)**: OpenAI (intégration Replit AI proxy) pour auto-traduction et transcription vocale — variables `OPENAI_API_KEY` / `OPENAI_BASE_URL`. Si absent, les endpoints `/api/messages/:id/translate` et `/transcribe` renvoient 503 avec message explicatif.

## Architecture

```
artifacts/
  api-server/          Express API server (port 8080)
    src/routes/        Route handlers (auth, users, clients, crm, projects, tasks, collaborators, equipment, rentals, orders, messaging, dashboard)
    src/lib/realtime.ts Socket.IO server (auth, presence, conv rooms, typing, broadcasts)
    src/lib/translate.ts OpenAI translate + transcribe wrappers (no-op si pas de clé)
  edole-admin/         React + Vite frontend (port 25655)
    src/pages/         Page components (dashboard, projects, tasks, crm, equipment, rentals, inspections, logistics, orders, proformas, invoices, payments, messaging, calls, collaborators, users, notifications, settings)
    src/components/    Layout + shadcn/ui components
    src/lib/           Auth context, utilities

lib/
  api-spec/            OpenAPI spec (openapi.yaml) + Orval codegen config
  api-client-react/    Generated React Query hooks (@workspace/api-client-react)
  api-zod/             Generated Zod schemas (@workspace/api-zod)
  db/                  Drizzle schema + DB client (@workspace/db)
```

## Modules / Pages

- **Dashboard** (`/`) — KPI cards, charts (revenue by month, projects by status, tasks by priority)
- **Projects** (`/projects`) — List + detail with phases, tasks, budget
- **Tasks** (`/tasks`) — List + detail with comments, subtasks
- **CRM** (`/crm`) — Kanban pipeline, Clients list/detail, Activities
- **Equipment** (`/equipment`) — Inventory with categories, status tracking, availability stats
- **Collaborators** (`/collaborators`) — HR profiles, workload view
- **Rentals** (`/rentals`) — Rental management + detail with items
- **Inspections** (`/inspections`) — Pre/post rental inspections
- **Logistics** (`/logistics`) — Delivery/pickup operations
- **Orders** (`/orders`) — Sales orders
- **Proformas** (`/proformas`) — Proforma invoices
- **Invoices** (`/invoices`) — Invoices + partial payment tracking
- **Payments** (`/payments`) — Payment records
- **Messaging** (`/messaging`) — **Hub conversationnel complet** : DM/groupes, messages texte/image/vidéo/audio/fichier/localisation, recherche globale et locale, réactions emoji, réponses citées, édition/suppression, ✓✓ accusés de lecture, présence temps réel, indicateur "écrit…", épinglage/sourdine/archivage, pièces jointes multi (jusqu'à 25 Mo, audio/vidéo/Office/PDF), messages vocaux (MediaRecorder), partage de position GPS, auto-traduction (FR/EN/AR/PT/ES) et transcription vocale via OpenAI proxy. Realtime WebSocket via Socket.IO (`/api/realtime`). Endpoints : `/api/conversations`, `/api/conversations/:id/{read,participants}`, `/api/conversations/:id/messages`, `/api/messages/:id/{reactions,translate,transcribe}`, `/api/messages/search`, `/api/presence`. Schéma : tables `conversations`, `conversation_participants` (unread/archived/muted/pinned/lastReadAt), `messages` (kind/metadata/replyTo/translations/edited/deleted), `message_attachments`, `message_reads`, `message_reactions`, `message_mentions`, `user_presence`, `push_subscriptions`, `whatsapp_channels`.
- **Calls** (`/calls`) — WebRTC call session logs
- **Users** (`/users`) — User management
- **Notifications** (`/notifications`) — Notification center
- **Settings** (`/settings`) — App settings
- **Pilotage financier / FP&A** (`/fpa`) — **Reporting & Planning financier** : budgets versionnés multi-périmètre (entreprise/projet/département/service/activité), distinction Budget vs Forecast, statut draft/active/archived avec activation exclusive par périmètre, duplication pour création de versions dérivées (`basedOnId`). Dashboard avec KPI exécution, courbe Budget vs Réalisé mensuelle et top écarts. Grille éditable compte SYSCOHADA × mois (sticky headers, filtres par classe 6/7/2/4/5, répartition uniforme). Analyse de variance triple budget/réalisé/écart par compte × mois, avec actuels calculés à la volée depuis `journal_entry_lines` (filtrage statut posted, période fiscale, projets associés, sens normal du compte). Section forecast vs réalisé + projection fin d'année (atterrissage = YTD + budget restant, projection linéaire = extrapolation YTD). Synthèses par projet (budget/charges/produits/marge/conso) et par département. **4 exports Excel professionnels** (exceljs, header orange EDOLE, format FCFA) : budget détail (matrice), variance (synthèse + détail 2 onglets), forecast vs réalisé, synthèse projets. Schéma : tables `budgets` (kind, scope, scopeId, versionNumber unique, status, projectIds[], basedOnId) + `budget_lines` (budgetId, accountId, period YYYY-MM, amount, unique cellule). Endpoints : `/api/fpa/{summary,budgets,variance,actual-vs-forecast,year-end-projection,by-project,by-department}` + `/api/fpa/export/{budget,variance,forecast,by-project}/:id.xlsx`.

## Auth

Simple token-based auth (base64 userId:email). Token stored in localStorage as `auth_token`.

Demo credentials:
- Super Admin: `admin@edole.africa` / `admin123` (Jacques Mballa)
- Manager: `manager@edole.africa` / `manager123` (Aissatou Bah)
- Commercial: `commercial@edole.africa` / `commercial123` (Kofi Asante)
- Collaborator: `collab@edole.africa` / `collab123` (Marie Nguema)

## Vite Proxy

The frontend proxies `/api` requests to the API server on port 8080.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `cd lib/db && pnpm exec tsx src/seed.ts` — re-seed the database
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Database

PostgreSQL accessed via `DATABASE_URL` environment variable. Full Drizzle schema covering all modules. Soft deletes via `deletedAt` field. Currency default: **XOF / FCFA** (West African Franc) — use `formatFCFA()` from `artifacts/edole-admin/src/lib/format.ts` for all monetary display.

## Branding & Localization

- **Identity**: Premium BTP/construction operations platform — orange (#F37021-class) accent on near-black sidebar, derived from the `édolé` logo (`src/assets/edole-logo.png`). Palette defined in `artifacts/edole-admin/src/index.css`.
- **Language**: Entire UI is in professional French. No English strings in user-facing copy.
- **Currency**: All amounts displayed in FCFA via `formatFCFA(value)`. DB stores currency as `XOF`.
- **Auth wiring**: `src/main.tsx` calls `setAuthTokenGetter(() => localStorage.getItem("auth_token"))` so all generated hooks send the Bearer token. `src/lib/auth.tsx` exposes `user` from `useGetMe()` (`/api/auth/me`).

## Seeded Data

- 4 clients (SOGELEC Cameroun, BTP Gabon SARL, CONLOG CI, MinesCorp RDC)
- 4 opportunities across pipeline stages
- 3 projects with phases and tasks
- 5 collaborators
- 6 equipment items in 4 categories
- 1 active rental with inspection and logistics
- 2 orders, 1 proforma, 1 invoice, 1 payment
- 2 conversations with messages
- 5 notifications

## Recent Changes

L'historique détaillé des évolutions (transformation SaaS Gaméasù, gouvernance & sécurité, intelligence/automatisation, modules Operations / Attendance / FP&A / Inventory…) est désormais consigné dans [`CHANGELOG.md`](./CHANGELOG.md).
