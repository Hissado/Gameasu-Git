# Nexora — Le pilotage d'entreprise nouvelle génération

## Overview

Plateforme SaaS B2B **multi-tenant** rebrandée **Nexora**, conçue pour les organisations du Togo et d'Afrique de l'Ouest francophone. Issue d'une refonte du socle EDOLE Africa, elle ajoute organisations, plans d'abonnement (Starter/Growth/Professional/Enterprise en FCFA), catalogue de modules, événements de facturation, paramétrage de l'espace de travail, gating par module et identité visuelle dédiée.

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

## Recent Changes — mai 2026

### Operations Command Center (refonte `/logistics` → `/operations`) — mai 2026
- **Schéma** (`lib/db/src/schema/operations.ts`) : 9 tables tenant-scoped (`organizationId NOT NULL` + index) :
  - `operations_missions` (reference, kind 8 types, status 9 valeurs, priority, origin/destinationAddress + lat/lng, scheduledStart/End, actualStart/End, responsibleUserId, teamUserIds[], vehicleEquipmentId, clientId, projectId, payloadJson, estimatedCost/actualCostFcfa, isBillable, summaryJson, sla).
  - `operations_mission_stops` (multi-arrêts par mission avec séquence + état).
  - `operations_checkins` (`check_in`/`check_out`/`break_start`/`break_end` avec GPS + accuracyMeters).
  - `operations_proofs` (signature, photos, recipientName, comment, status valid/disputed/rejected).
  - `operations_incidents` (11 types : delay, breakdown, absence, client_unavailable, missing_material, accident, etc. ; sévérité low→critical ; status open/in_progress/resolved/cancelled).
  - `operations_checklists` + `operations_checklist_items` (phases pre_departure/loading/arrival/execution/end/return).
  - `operations_costs` (kind fuel/labor/transport/etc., amountFcfa, isEstimate).
  - `operations_playbooks` (templates métier réutilisables par secteur).
- **Backend** (`artifacts/api-server/src/routes/operations.ts`, ~25 endpoints) :
  - `/api/operations/{overview,performance,dispatch,calendar,map,playbooks}` — agrégateurs et vues transverses.
  - `/api/operations/missions` (GET liste filtrée + POST create avec auto-référence `OPS-YYYY-NNNN`, instancie DEFAULT_CHECKLISTS selon kind), `/api/operations/missions/:id` (GET détail + PATCH + DELETE soft).
  - `/api/operations/missions/:id/{assign,status,check-in,proof,incident,cost,summary}` — actions terrain.
  - `/api/operations/incidents` (GET liste) + `/api/operations/incidents/:id` (PATCH résolution / corrective action).
  - `/api/operations/checklist-items/:id` (PATCH toggle done) — recalcul automatique des compteurs.
  - Isolation tenant stricte via `organizationId` sur tous les WHERE et INSERT.
- **RBAC** (`lib/rbac/catalog.ts`) : 8 permissions ajoutées (`operations.view/manage/assign/dispatch/checkin/incidents/checklists/performance`), câblées sur manager (`*`), commercial (view), collaborator (view + checkin). Super_admin/admin → `*`.
- **Frontend** (`artifacts/edole-admin/src/pages/operations/index.tsx`) : page complète à 10 onglets — Vue d'ensemble (KPI + activité récente + alertes), Missions (table filtrée), Dispatching (file + dispo équipe), Suivi terrain (kanban 6 colonnes par statut), Incidents (résolution inline), Checklists, Preuves, Coûts & performance (KPI complétion/ponctualité/incidents + tableaux par type/responsable), Carte (liste géolocalisée + lien OSM), Calendrier (groupé par jour). Dialogue de détail riche : check-in GPS, génération résumé final, toggle items checklist, signalement d'incident, transitions de statut. Routes `/operations` et `/logistics` (rétrocompat). Sidebar : entrée renommée « Opérations & Logistique » → `/operations`.
- **Seed démo** (`lib/db/src/seed-operations.ts`, idempotent, exécuté au boot) : 7 missions couvrant tous les statuts/types (livraison ciment Lomé Plateau, install groupe électrogène Kara, intervention climatisation, collecte fin de chantier, approvisionnement carburant, transfert inter-dépôts bloqué, visite technique), avec checklists pré-remplies, check-ins GPS autour de Lomé/Kara/Tsévié/Aného/Atakpamé, 2 incidents (trafic + panne), preuves d'exécution pour les missions terminées, coûts éclatés (carburant 25 % + main-d'œuvre 50 % + transport 25 %).


### Phase 7 — Intelligence projet & tâches — mai 2026
- **Backend** (`artifacts/api-server/src/routes/projectIntelligence.ts`, monté avant `tasksRouter` pour éviter la collision `/tasks/priority` ↔ `/tasks/:id`) :
  - `GET /api/projects/:id/intelligence` — agrégateur santé projet : projet enrichi (clientName/managerName), score `smart_scores` lu ou recalculé (schedule 40 % + tâches 30 % + risques 20 % + vélocité 10 %, bornes 0-100), schedule (`on_track`/`at_risk`/`delayed`/`unknown` calculé sur startDate/endDate vs progress), stats tâches (active/done/inProgress/todo/blocked/overdue/dueSoon + completionRate + vélocité 14 j ramenée à la semaine), risques/recos/insights filtrés par scope projet, dernier résumé IA + synthèse heuristique de secours, budget alloué. ACL `projects.read` + `userHasProjectAccess` + isolation tenant stricte.
  - `GET /api/tasks/priority?mine=1` — backlog priorisé : exclut done/completed/cancelled + soft-deletes, filtre via `userAccessibleProjectIds` (null = pas de restriction), score combiné priorité 40 % + urgence d'échéance 35 % + âge 15 % + statut 10 %, tri décroissant, top 100, tier dérivé via `tierForScore`. ACL `tasks.read`.
- **Frontend** :
  - `pages/projects/ProjectIntelligenceTab.tsx` — synthèse IA + score avec 4 facteurs en barres, badges schedule (réel vs attendu + écart en pts) et vélocité, 4 KPI tâches (active, terminées + %, retard, échéance proche), panneaux risques (résoudre) + recommandations (appliquer/ignorer) avec mutations PATCH, insights et carte budget.
  - `pages/projects/detail.tsx` — refondu avec `Tabs` (Vue d'ensemble / Intelligence).
  - `pages/tasks/Focus.tsx` — page `/tasks/focus` : 3 KPI (à traiter, critiques, en retard), toggle « Mes tâches / Toutes », liste classée par rang avec score + tier coloré, 4 facteurs en barres, badges projet/assignee/échéance avec compteur jours.
  - Route `/tasks/focus` enregistrée dans `App.tsx`, entrée sidebar « Focus tâches » (icône Flame, module `tasks`) dans le groupe Business.

### Phases 5 & 6 — Clients 360° + Scoring commercial — mai 2026
- **Phase 5 — Vue 360° client** : nouvel endpoint agrégateur `GET /api/clients/:id/360` (`artifacts/api-server/src/routes/client360.ts`) qui retourne en une requête : fiche client + contacts, score santé (lu depuis `smart_scores` ou recalculé heuristiquement à la volée — facteurs paiement/activité/projets/risques pondérés 35/20/20/25), risques ouverts (`risk_flags`), recommandations actives, insights, dernier résumé IA persisté (`assistant_summaries`) + synthèse heuristique de secours, KPI financiers (CA facturé/payé/encours/retard + nombre/délai max factures en retard, pipeline commercial valorisé), KPI opérations (projets, tâches ouvertes/retard, commandes, proformas, opportunités), et listes récentes (factures, projets, opportunités, activités). ACL `clients.read` + `userHasClientAccess` + isolation tenant stricte (organizationId).
- **Frontend** : nouveau composant `pages/clients/Client360Tab.tsx` (cartes synthèse + score avec facteurs détaillés, 8 KPI colorés selon état, panneau risques/recommandations avec mutations `apply`/`dismiss`/`resolve`, dernières factures, activités récentes). Onglet « Vue 360° » ajouté en première position dans `pages/clients/detail.tsx`.
- **Phase 6 — Scoring commercial** : endpoint `GET /api/sales/opportunities-scoring` (même fichier) qui priorise toutes les opportunités ouvertes en combinant stade pipeline (35 %), montant log-scaled (25 %), urgence d'échéance (20 %) et probabilité saisie (20 %). Tri décroissant + tier (`critical`→`excellent`). Permission `commercial.read`.
- **Frontend** : page `/sales/scoring` (`pages/sales/scoring.tsx`) avec 4 KPI (opps actives, pipeline total, pipeline « chaud », revenu pondéré attendu) et liste classée affichant pour chaque opportunité le score global, les 4 facteurs en barres de progression, le client lié, le stade et la date de clôture. Sidebar : nouvelle entrée « Scoring commercial » (icône `Flame`, groupe Business, module `sales_crm`).

### Phase 18 — Présences & Pointage géolocalisé — mai 2026
- **Schéma** (`lib/db/src/schema/attendance.ts`) : 3 tables tenant-scoped (`organizationId NOT NULL`) :
  - `attendance_sessions` (collaborator, date, status open/closed/abandoned, clockIn/Out, totalMinutes, breakMinutes, effectiveMinutes, isLate, isEarlyLeave, projectId).
  - `attendance_records` (timeline détaillée : clock_in / clock_out / break_start / break_end + lat/lng/accuracy/locationLabel/sourceDevice).
  - `attendance_flags` (anomalies typées : late, early_leave, missing_clock_in/out, long_break, out_of_zone, duplicate, suspicious + severity low/medium/high).
  - Schéma gouvernance complémentaire (`lib/db/src/schema/governance.ts`) : `role_templates`, `sector_presets`, `plan_usage_insights`.
- **Backend** (`artifacts/api-server/src/routes/attendance.ts`) :
  - `POST /api/attendance/{clock-in,clock-out,break-start,break-end}` — pointage avec capture GPS optionnelle (latitude/longitude/accuracyMeters/locationLabel), création/mise à jour automatique de la `session` du jour et insertion du `record` typé. Helper `recomputeSession()` recalcule totalMinutes/breakMinutes/effectiveMinutes à chaque événement.
  - `GET /api/attendance/me/today` — session courante + records du jour pour l'utilisateur (résout collaboratorId via userId).
  - `GET /api/attendance/me/history?limit=` — 30 derniers jours de l'utilisateur courant.
  - `GET /api/attendance/dashboard?date=` — vue RH (sessions du jour, KPI : total/présents/retards/clôturés/heures totales) — permission `attendance.read_all`.
  - `GET /api/attendance/anomalies?resolved=` — drapeaux ouverts ou résolus.
  - `POST /api/attendance/anomalies/:id/resolve` — clôture une anomalie (manager+).
  - `POST /api/attendance/scan` — relance heuristique de détection (oublis, pauses trop longues, etc.) (admin).
- **Permissions** (`lib/rbac/catalog.ts`) : 4 codes ajoutés (`attendance.read`, `attendance.read_all`, `attendance.manage`, `attendance.admin`) + `ai.*`, `automation.*`, `scoring.*`. Câblés sur les rôles manager / commercial / collaborator.
- **Frontend** :
  - `src/lib/attendance.ts` — hooks react-query typés (`useMyAttendanceToday`, `useMyAttendanceHistory`, `useAttendanceDashboard`, `useAttendanceAnomalies`, `useClockMutation`, `useResolveAttendanceFlag`) + helpers `captureGeolocation()` (timeout 8 s, `enableHighAccuracy`) et `formatMinutes()`.
  - `src/pages/attendance/index.tsx` — page complète à 4 onglets :
    1. **Mon pointage** : 4 boutons grand format (arrivée / début pause / fin pause / départ) avec capture GPS automatique, badge retard, présence/pause cumulées en temps réel, timeline du jour avec lien OpenStreetMap par pointage.
    2. **Tableau RH** : sélecteur de date, 5 KPI (total/présents/retards/clôturés/heures totales), tableau collaborateur × département × arrivée/départ/pause/présence/statut.
    3. **Anomalies** : liste des drapeaux ouverts avec sévérité colorée + bouton "Résoudre".
    4. **Mon historique** : 30 derniers jours avec cumul d'heures et nombre de retards.
  - Route `/attendance` enregistrée dans `App.tsx`, entrée sidebar "Présences & Pointage" (icône `Clock`) ajoutée au groupe Business sous module `team_hr`.

### Seed démo intelligence — mai 2026
- `lib/db/src/seed-intelligence.ts` (exécuté au boot après `seedSaas`, idempotent) :
  - 29 scores polymorphes (santé clients, risque projets, priorité tâches) avec facteurs explicatifs (poids/valeur/raison).
  - 4 drapeaux de risque (impayés client, glissement projet, opportunité upsell, surcharge RH).
  - 4 insights (tendance recouvrement, attrition client, prospects chauds non traités, oublis pointage).
  - 4 recommandations next-best-action avec impact (commercial/financial/operational/retention) et CTA contextuels.
  - Historique de pointages démo sur 14 jours pour 5 collaborateurs (lat/lng autour de Lomé + jitter, retards aléatoires, drapeaux générés).

### Couche Intelligence & Automatisation Nexora (Phases 1-4) — mai 2026
- **Phase 1 — Marketing intelligent** : commit antérieur (116975a).
- **Phase 2 — Socle intelligence/automatisation (DB + backend)** :
  - Schéma `lib/db/src/schema/intelligence.ts` : 7 tables (`smart_scores`, `risk_flags`, `insights`, `recommendations`, `assistant_summaries`, `automation_rules`, `automation_logs`) avec `organizationId NOT NULL` partout (isolation tenant stricte). Helper `tierForScore(value)`.
  - `lib/ai.ts` : wrappers OpenAI proxy avec fallback heuristique (`summarize`, `generateList`, `aiAvailable`).
  - `lib/automation.ts` : moteur d'événements (17 triggers — invoice/payment/project/task/client/lead/etc.) et 12 actions (email, SMS, WhatsApp, tâche, notifications, statut, tag, résumé/recommandation/insight IA, webhook). `triggerEvent(orgId, type, payload)` évalue les conditions et exécute. **Garde SSRF** `isSafeWebhookUrl` (refuse non-http(s), localhost, IP RFC1918, loopback, link-local 169.254 — Cloud metadata, IPv6 ULA/link-local) + timeout 5 s + `redirect: "error"`.
  - Routes `/api/intelligence/{overview,insights,recommendations,risks,scores,summaries,summaries/generate}` (CRUD + isolation tenant stricte sur `WHERE id AND organization_id`) + `/api/automation/{catalog,rules,rules/:id,rules/:id/run,trigger,logs}` (mutations sous `requireAdmin` pour bloquer la création de webhooks par tout authentifié).
- **Phase 3 — Cockpit Intelligence (frontend)** : 
  - `lib/intelligence.ts` (hooks react-query typés).
  - Page `/intelligence` (4 onglets : insights, recommandations, risques, scores) + page `/automations` (rule builder + journal).
  - Composant `IntelligenceWidget` posé sur le dashboard.
  - Entrées sidebar dans « Espace de travail ».
- **Phase 4 — Communications intelligentes (backend)** : endpoints `POST /api/conversations/:id/summarize` + `GET /api/conversations/:id/summaries` (résumé IA d'une conversation avec fallback heuristique, persistance dans `assistant_summaries`).
- **Hardening sécurité** (code review architect) : isolation tenant ajoutée sur tous les mutations by-id (insights, recommendations apply/dismiss, risks resolve, automation rules patch/delete/run), retours 404 si la ressource n'appartient pas à l'organisation courante. SSRF + admin gate sur automation. `organizationId NOT NULL` poussé en DB.

### Transformation SaaS Nexora — mai 2026
- **Schéma multi-tenant** (`lib/db/src/schema/saas.ts`) : `organizations`, `organization_members`, `module_catalog`, `subscription_plans`, `subscription_plan_features`, `organization_subscriptions`, `organization_modules`, `billing_events`, `workspace_invitations`.
- **Seed SaaS** (`lib/db/src/seed-saas.ts`, idempotent, exécuté au boot de l'API) : 20 modules (core/business/admin), 4 plans (Starter 8k/mois, Growth 18k, Professional 35k, Enterprise 60k — FCFA par utilisateur), organisation par défaut `nexora-demo`, membership de tous les utilisateurs existants, abonnement Professional 25 sièges mensuel, 3 factures de démo + frais d'installation. Inserts en `onConflictDoUpdate` pour résister aux runs concurrents.
- **Backend** : `artifacts/api-server/src/lib/tenant.ts` (helpers `getCurrentOrganizationId` / `getCurrentSubscription`) + nouvelles routes `artifacts/api-server/src/routes/{organizations,subscriptions}.ts` :
  - `/api/organizations/current` + PATCH (admin), `/api/organizations`, `/api/organization-members`.
  - `/api/subscription-plans`, `/api/subscriptions/current` + PATCH, `/api/subscriptions/change-plan`, `/api/subscriptions/change-billing-cycle`.
  - `/api/organization-modules`, `/api/organization-modules/:moduleKey/toggle` (403 `upgrade_required` si module hors plan).
  - `/api/billing/summary`, `/api/billing/events`, `/api/billing/usage`.
  - `/api/workspace-settings`, `/api/workspace-settings/{general,branding,preferences}` (PATCH admin).
- **Frontend Nexora** :
  - Identité centralisée : `src/config/branding.ts` (nom, slogan, couleurs, logo) lue depuis `VITE_APP_*` avec fallback.
  - Assets : `public/branding/nexora-logo.svg`, `nexora-mark.svg`, manifest PWA et `index.html` rebrandés.
  - Composants : `branding/AppLogo.tsx`, `PlanBadge.tsx` (badge plan coloré par tier), `FeatureGate.tsx` (hook `useModuleEnabled` + écran `UpgradeRequired`).
  - Hooks SaaS centralisés dans `src/lib/saas.ts` : `useCurrentOrganization`, `useCurrentSubscription`, `useSubscriptionPlans`, `useOrganizationModules`, `useBillingSummary`, `useBillingEvents`, `useBillingUsage`, `useWorkspaceSettings`, mutations `useChangePlan`, `useChangeBillingCycle`, `useToggleModule`, `useUpdateWorkspaceSettings`. Mapping route ↔ module via `ROUTE_MODULE_MAP` / `moduleKeyForPath`.
  - Pages : `/billing` (formule active, plans comparés, cycle, modules inclus, historique), `/workspace-settings` (général, identité visuelle, préférences régionales, toggle modules, lien vers admin/rôles), `/upgrade-required?module=…` (écran upsell).
  - Sidebar refondue (`components/Layout.tsx`) : 3 groupes **Espace de travail / Business / Administration**, badge plan + nom de l'organisation, lock 🔒 sur les items dont le module est désactivé (redirige vers `/upgrade-required`), bandeau logo Nexora.
  - Login (`pages/login.tsx`) : panneau marque Nexora (slogan, baseline marché, 4 piliers), aucune mention EDOLE résiduelle.
- **Multi-tenant partiel** : les tables métier existantes (clients, projets, factures, etc.) ne sont pas encore partitionnées par `organization_id` — elles vivent implicitement dans l'organisation par défaut. Le partitionnement strict est listé en roadmap dans `README.md`.
- **Documentation & config** : `README.md` complet (architecture, plans, endpoints, env), `.env.example` racine avec toutes les variables `APP_*`, `BILLING_*`, `VITE_APP_*`.

## Recent Changes — avril 2026

### Chantier marathon « Gouvernance & Sécurité » (T01–T10) — avril 2026
- **RBAC dynamique** : 37 permissions (catalog par catégorie : Utilisateurs, Projets, Tâches, Documents, Comptabilité, FP&A, RH, Marketing, etc.) et 5 rôles système (`super_admin`, `admin`, `manager`, `commercial`, `collaborator`) seedés au boot. Helpers `hasPermission`, `userAccessibleProjectIds` (cache 30s).
- **Middlewares** : `requirePermission(code)`, `requireAnyPermission(...)`, `requireProjectAccess(idParam)`, `enforcePasswordChange` (renvoie 423 si `mustChangePassword`).
- **ACL projet** appliquée sur listings et détails : `/projects`, `/projects/:id`, `/projects/stats`, `/tasks`, `/tasks/:id`, `/tasks/:id/comments`, `/documents`, `/documents/stats`. Bypass via `projects.read_all`.
- **Onboarding** : `/auth/accept-invitation` (token 7j), `/auth/change-password`, `/auth/forgot-password`, `/auth/reset-password`. Login horodaté + audit + flag `mustChangePassword`.
- **Invitations email** : lib `email.ts` avec providers SendGrid/Resend (auto-détection), fallback `preview` (in-memory inbox accessible via `/admin/invitations`). Templates orange/noir.
- **Audit logs** : table `audit_logs` (qui, quoi, sur quoi, quand, IP, payload). Tracé : login, login_failed, invite, role_change, activate/deactivate, password_change, password_reset_*, permission_change. Endpoint paginé `/admin/audit?action=&entityType=&q=`.
- **Garde-fous critiques** sur `PUT/DELETE /users/:id` :
  - Refus auto-désactivation (`isActive=false` sur soi-même).
  - Refus auto-changement de rôle.
  - Protection « dernier admin actif » (`ensureNotLastAdmin`).
  - Suppression de rôle bloquée si utilisateurs encore assignés.
- **Frontend admin** : pages `/admin` (hub), `/admin/{users,invitations,roles,permissions,departments,audit}`, `/change-password`, `/accept-invitation`. Composant `ConfirmDialog` (avec type-to-confirm pour les actions destructives), hook `usePermissions`, redirection globale `mustChangePassword` (handler 423 dans `lib/api.ts` + garde dans `ProtectedRoute`). Section « Administration » dans la sidebar.
- **Schéma DB** : nouvelles tables `roles`, `permissions`, `role_permissions`, `user_project_access`, `audit_logs`. Champs `users` étendus : `mustChangePassword`, `passwordResetToken(+ExpiresAt)`, `invitedById`, `invitedAt`, `acceptedAt`, `lastLoginAt`, `departmentId`.

### Itération Hissado v2 (durcissement)
- **Tickets RBAC** : `PUT /tickets/:id` exige manager+/admin pour status/priority/category/assignee ; les owners peuvent éditer subject/description de leurs tickets uniquement.
- **Schéma** : `equipment.qrCode`, `inspections.beforePhotos`/`afterPhotos`, table `daily_stock_reports`.
- **QR codes matériel** : `GET /equipment/:id/qrcode` (PNG 320×320) + `POST /equipment/:id/qrcode` (régénère + persiste data URL, manager+).
- **Comparateur inspections** : `GET /rentals/:id/inspections/compare` retourne {departure, return, diff} pour gestion litige caution.
- **Snapshots stock** : `POST /reports/stock-daily/snapshot` (manager+) + `GET /reports/stock-daily/history` (30 derniers).
- Détails : `AUDIT_HISSADO_VS_EDOLE.md` §5bis.

### Itération Hissado v1
- Module Tickets (table + API + page `/tickets`), changement mot de passe (PUT /auth/password + onglet Sécurité), matrice rôles dans Settings, PWA manifest.
