# Audit comparatif — Hissado Workspace Management vs Edole Admin

Date : 20 avril 2026
Source Hissado : `https://workspace-management.replit.app/` (compte issa@hissado.com)
Source Edole : `artifacts/edole-admin/` + `artifacts/api-server/`
Périmètre Edole figé par le client : Pilotage, Operations, Materiel, Commercial, Marketing, RH, Comptabilité OHADA, Documents, Alertes. **Hors périmètre** : CRM (chat), Messagerie, Appels, Réunions vidéo.

---

## 1. Cartographie Hissado

Modules détectés dans le bundle JS et la matrice de permissions :

| Module | Pages | Statut |
|---|---|---|
| Auth | Sign in, Set Password (premier accès) | ✅ |
| Dashboard | Vue d'ensemble | ✅ |
| Services | Catalogue prestations (Edit/Delete) | ✅ |
| Projects | All Projects, New Project, Edit/Delete | ✅ |
| Tasks | My Tasks, Create/Edit Task | ✅ |
| Messages / Team Chat | Chat, Draw a Message | ✅ (hors périmètre Edole) |
| Files & Documents | Folders, Upload, Delete | ✅ |
| Calendar | Échéances tâches | ✅ |
| Reports & Analytics | Performance projets/équipe | ✅ |
| Team | Members, Edit, Remove, Departments, Roles | ✅ |
| Clients | Active Clients, Invite Portal User, Brand Color | ✅ |
| Settings | Account, Security, Notifications | ✅ |
| Meetings & Calls | Instant Meeting | ✅ (hors périmètre Edole) |
| Support & Requests | Tickets internes | ✅ |
| Notifications | Centre de notifications | ✅ |
| PWA | manifest, install, share | ✅ |

Architecture Hissado : SPA React avec données quasi entièrement en `localStorage` (3 endpoints serveur seulement : `/api/auth/login`, `/api/signal/send`, `/api/translate`). Bilingue FR/EN.

Roles : Admin, Manager, Member.
Permissions granulaires (40 permissions catalogées) : View Dashboard, Create Project, Upload File, Delete Folder, Invite Member, Send Drawing, etc.

---

## 2. Cartographie Edole Admin

Edole Admin couvre **un périmètre métier beaucoup plus large** que Hissado (plateforme BTP B2B vs workspace générique). Modules présents :

- Pilotage : Dashboard, Reports JSON+PDF, Carte Leaflet, Alertes auto, Documents
- Opérations : Chantiers, Tâches Liste/Kanban/Calendrier
- Matériel : Inventaire, QR Codes, Locations, Inspections (compare avant/après), Logistique
- Commercial : Clients, Services, Pipeline CRM, Bons commande, Devis (proforma), Factures, Encaissements
- Marketing : Campagnes Email/SMS, Prospects
- RH : Tableau, Collaborateurs, Départements, Postes, Affectations, Contrats, Documents RH, Utilisateurs
- Comptabilité OHADA : Plan SYSCOHADA, Écritures, Grand livre, Balance, Bilan, Résultat, Comptes clients/fournisseurs, Banques, Immobilisations
- Notifications, Settings

Stack : Express + Drizzle + Postgres, React + Vite + TanStack Query + wouter, Tailwind + shadcn/ui.

---

## 3. Analyse d'écart

### A. Fonctionnalités Hissado utiles mais absentes dans Edole

| # | Fonctionnalité Hissado | Statut Edole | Niveau d'écart | Action retenue |
|---|---|---|---|---|
| 1 | **Changement de mot de passe utilisateur** (Security tab) | ❌ Aucune UI ni endpoint | P0 critique | **À implémenter** : `PUT /auth/password` + onglet Sécurité dans Settings |
| 2 | **Vue matrice des rôles & permissions** (admin) | ❌ RBAC hardcodé, aucune UI de visualisation | P1 important | **À implémenter** : page Settings → Permissions, lecture seule |
| 3 | **Internal Tickets / Support & Requests** | ❌ Inexistant | P1 important | **À implémenter** : table `tickets` + API + page `/tickets` |
| 4 | **PWA installable** (manifest, theme color, install prompt) | ❌ Pas de manifest.json | P2 quick win | **À implémenter** : `public/manifest.json` + meta tags |
| 5 | **First-login forced password change** | ❌ Pas de flag | P2 sécurité | Reporté (nécessite migration users + flow login) |
| 6 | **Folders dans Documents** | ⚠️ Edole utilise rattachement par entité (plus puissant) | P3 cosmétique | Non retenu — l'approche Edole est supérieure |
| 7 | **Switcher de langue FR/EN** | ❌ FR uniquement (par spec) | Hors scope | Non retenu — produit explicitement francophone |
| 8 | **Brand color par client** | ❌ | P3 cosmétique | Reporté |
| 9 | **Invite Client Portal User** (accès limité client) | ⚠️ flag `isClient` existe sur users mais pas de flow d'invitation | P2 utile B2B | Reporté (nécessite flow email + tokens) |

### B. Fonctionnalités Hissado **hors périmètre Edole** (exclues par le client)

| # | Fonctionnalité Hissado | Décision |
|---|---|---|
| 1 | Team Chat / Messages | NE PAS toucher (existe dans Edole en façade, hors scope) |
| 2 | Draw a Message (canvas) | NE PAS toucher |
| 3 | Meetings & Calls / Instant Meeting | NE PAS toucher |
| 4 | Emoji picker | Non pertinent |

### C. Domaines où **Edole dépasse Hissado**

Pour mémoire — ces domaines n'existent **pas** dans Hissado :

- Comptabilité OHADA complète (Plan SYSCOHADA, états financiers)
- Inventaire matériel + QR codes + inspections photos avant/après + comparateur de litige
- Pipeline commercial Devis → Bon → Facture → Encaissement avec automatisation comptable
- Carte géographique des chantiers et du parc
- Reporting parc auto JSON + PDF + workload collaborateur
- Marketing campagnes Email/SMS + base prospects
- 5 rôles RBAC (vs 3 chez Hissado)
- Module Locations matériel avec détection conflits temporels et caution

---

## 4. Implémentation livrée

### 4.1 Changement de mot de passe sécurisé
- **Backend** : `PUT /api/auth/password` (body : `{ currentPassword, newPassword }`)
- **Frontend** : nouvel onglet "Sécurité" dans `/settings` avec formulaire de changement, validation longueur ≥ 8 caractères, confirmation

### 4.2 Matrice des rôles & permissions
- **Frontend** : nouvel onglet "Permissions" dans `/settings` — affiche la matrice 5 rôles × 12 modules (lecture seule pour tous, gérée pour info)
- **Source** : reflète exactement la matrice hardcodée dans `middlewares/auth.ts`

### 4.3 Module Tickets / Support & Requests
- **Schéma** : nouvelle table `tickets` (`id`, `subject`, `description`, `category`, `priority`, `status`, `createdById`, `assigneeId`, `resolvedAt`, timestamps)
- **API** : `routes/tickets.ts` — GET liste, GET détail, POST créer, PUT mettre à jour, DELETE
- **Frontend** : page `/tickets` — liste filtrable + dialog création + assignation + changement statut
- **Navigation** : nouvel item "Support" dans Pilotage

### 4.4 PWA installable
- **Manifest** : `artifacts/edole-admin/public/manifest.json` (orange #FF6B00, mode standalone)
- **HTML** : ajout des meta tags dans `index.html` (theme-color, apple-touch-icon, manifest link)

### 4.5 Refonte de la page Settings
- Refactor en page à onglets : **Profil** | **Sécurité** | **Notifications** | **Régionales** | **Permissions** | **Zone sensible**
- Préserve toutes les fonctionnalités existantes

---

## 5. Tableau récapitulatif des modifications techniques

### Fichiers créés
- `lib/db/src/schema/tickets.ts`
- `artifacts/api-server/src/routes/tickets.ts`
- `artifacts/edole-admin/src/pages/tickets/index.tsx`
- `artifacts/edole-admin/public/manifest.json`
- `AUDIT_HISSADO_VS_EDOLE.md` (ce document)

### Fichiers modifiés
- `lib/db/src/schema/index.ts` (export tickets)
- `artifacts/api-server/src/routes/auth.ts` (endpoint changement mot de passe)
- `artifacts/api-server/src/routes/index.ts` (mount router tickets)
- `artifacts/edole-admin/src/pages/settings/index.tsx` (onglets + Sécurité + Permissions)
- `artifacts/edole-admin/src/components/Layout.tsx` (item Support)
- `artifacts/edole-admin/src/App.tsx` (routes /tickets)
- `artifacts/edole-admin/index.html` (manifest, theme-color)

### Migrations DB
- Table `tickets` créée via `pnpm --filter @workspace/db push`

---

## 5bis. Itération 2 — durcissement et compléments (avril 2026)

Suite à la revue de code et au plan client (T1–T12), audit complémentaire de l'existant :

### Déjà couvert avant cette itération (rien à faire)
| # plan | Fonctionnalité | État réel |
|---|---|---|
| T2 | equipment.photos, orders.attachmentUrl, proformas.caution/paymentTerms/durationDays, projects.documentLinks, taskHistoryTable, equipmentMovementsTable, rentals.photos | ✅ déjà en schéma |
| T3 | Upload photos via multer disk storage `/upload`, `/upload/multi`, statique `/uploads/*` | ✅ |
| T4 | Reporting parc auto `/reports/stock-daily` JSON + PDF (PDFKit, charte EDOLE) + `/reports/workload` | ✅ |
| T5 | Vues Kanban/Calendrier/sous-tâches/historique : pages `/tasks` (liste+kanban+calendrier), sous-tâches via `parentTaskId`, historique via `taskHistoryTable` retourné par `GET /tasks/:id` | ✅ |
| T6 | Blocage temporel stock : `/equipment/:id/availability-window?from&to` avec détection de chevauchement multi-locations | ✅ |
| T9 | Carte localisation : page `/map` (react-leaflet) | ✅ |
| T12 | Charge collaborateur : `/reports/workload` + page UI | ✅ |

### Compléments livrés dans cette itération
- **T1 — RBAC tickets durci** : `PUT /tickets/:id` exige désormais `manager+/admin` pour modifier `status`/`priority`/`category`/`assigneeId`. Les utilisateurs standards ne peuvent éditer que `subject`/`description` de leurs propres tickets. Validation enum stricte.
- **T2 — schéma complété** : `equipment.qrCode` (text), `inspections.beforePhotos` + `inspections.afterPhotos` (jsonb), nouvelle table `daily_stock_reports` (snapshots historiques).
- **T8 — QR code matériel** :
  - `GET /equipment/:id/qrcode` → renvoie un PNG (320×320) avec payload `{id, code, name}`
  - `POST /equipment/:id/qrcode` (manager+) → régénère et persiste un dataURL dans `equipment.qrCode`
- **T7 — comparateur états des lieux** : `GET /rentals/:id/inspections/compare` → renvoie `{ departure, return, diff: { beforePhotosCount, afterPhotosCount, photoDelta, hasDispute, retentionAmount, disputeNotes, ready } }`
- **T2/T4 — snapshots stock** :
  - `POST /reports/stock-daily/snapshot` (manager+) → capture le rapport courant dans `daily_stock_reports`
  - `GET /reports/stock-daily/history` → 30 derniers snapshots

### Reportés (hors scope immédiat)
| # plan | Raison |
|---|---|
| T10 (proforma → facture auto + caution) | Chaîne comptable complexe, à isoler dans une itération dédiée — `caution` est en schéma mais l'automatisation OHADA reste à câbler |
| T11 (Documents Drive links UI) | `projects.documentLinks` existe déjà côté schéma, UI dédiée à concevoir |

---

## 6. Conclusion

L'audit confirme que **Edole Admin couvre un périmètre métier nettement supérieur à Hissado** (plateforme BTP B2B francophone vs workspace générique). Les seules fonctionnalités utiles de Hissado **dans le périmètre figé** sont la sécurité (changement mot de passe), la gouvernance (matrice permissions), un module ticketing interne et l'installabilité PWA — toutes livrées dans cette itération.

Les modules Hissado de chat, dessin et visio ont été délibérément exclus conformément au périmètre client (Edole conserve ses propres façades CRM/Messagerie/Appels en l'état, sans modification).
