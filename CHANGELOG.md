# Changelog Gaméasù

Historique détaillé des évolutions de la plateforme. Le fichier `replit.md` ne conserve que l'overview, l'architecture et les conventions courantes.

## Fiabilisation P1 : RBAC, KPI trésorerie, rattrapage comptable — juillet 2026

Corrections des chantiers **P1** du rapport d'audit consolidé (voir [`docs/RAPPORT_CORRECTIONS_P1.md`](docs/RAPPORT_CORRECTIONS_P1.md)).

- **RBAC réparé (cause racine de l'audit §D)** : le seed échouait silencieusement à cause d'une dérive schéma/code (`label/category` + `permission_id` vs `name/module` + `permission_code`) → catalogue des 133 droits vide et matrice de rôles figée. Seed, résolution des droits (avec repli transitoire), routes admin et schéma des surcharges alignés sur le modèle canonique ; migration de réconciliation `migrate-rbac-align.ts` ; états d'erreur explicites côté UI (plus d'échec silencieux). 24 erreurs de typecheck pré-existantes résolues (65 → 41).
- **Super Admin ≠ Administrateur** : l'Administrateur perd `roles.manage` (garde la lecture) — recommandation de l'audit appliquée.
- **Trésorerie — source unique (91,8 M vs 0)** : nouveau dictionnaire central des KPI (`services/kpis.ts`) — « Trésorerie disponible » = solde grand livre classe 5, identique au bilan par construction ; endpoint `GET /finance/treasury-position` ; page Trésorerie branchée dessus (part non rattachée à un compte bancaire affichée, jamais masquée).
- **Notes de frais → comptabilité** : approbation (D 618 / C 421) et remboursement (D 421 / C 5xx) comptabilisés atomiquement ; compte 618 ajouté au plan.
- **Rattrapage historique** : script idempotent `backfill:postings` (simulation par défaut, `--apply` pour écrire) re-postant factures, encaissements, factures fournisseurs, paiements et paies validés sans écriture.
- **Liens inertes** : les 5 cibles de l'audit ont toutes route + page réelles ; garde statique `check-routes` vert (483 fichiers, 199 routes). Cause résiduelle (permissions jamais semées) traitée par la réparation RBAC.

## Fiabilisation comptable P0 (audit consolidé) — juillet 2026

Corrections des chantiers **P0** du rapport d'audit consolidé du 22 juillet 2026 (voir [`docs/RAPPORT_CORRECTIONS_P0.md`](docs/RAPPORT_CORRECTIONS_P0.md)).

- **Paie → comptabilité** : nouvelle écriture automatique `postPayrollRun` (661/664 → 421/431/4471/4472), idempotente, générée **atomiquement** à la validation d'un cycle (v1 et v2). Comptes 4471/4472 ajoutés au plan seedé (+ `ensureAccount` pour les organisations existantes).
- **Aucune facture sans écriture** : les deux chemins d'émission qui avalaient l'échec de comptabilisation (« non bloquant ») annulent désormais la facture et renvoient une erreur explicite.
- **TVA ventes** : colonnes `subtotal_amount`/`tax_rate`/`tax_amount` sur `invoices` (additives), écriture éclatée 411 TTC / 706 HT / 4431 TVA, garde de cohérence backend HT + TVA = TTC.
- **TVA achats** : `postSupplierInvoice` comptabilise la charge HT et la TVA récupérable au 4452 (le champ existait, il était ignoré).
- **Moteur de paie unique** : suppression des copies locales divergentes (CNSS 4 % vs 9 %, patronal 16,4 % vs 22,5 %, double barème IRPP, IPTS 2 % en doublon) — `payroll-v2`, `payroll-extended` et `payroll` délèguent tous à `lib/payroll-engine` ; barèmes **versionnés** en base (`payroll_rate_scales`, org NULL = national) avec repli intégré ; endpoints de transparence `GET /payroll/rates` et `GET /payroll/simulate` ; simulateur frontend synchronisé sur le barème actif ; libellés d'exports dérivés du barème.
- **Tests** : `pnpm --filter @workspace/api-server run test:payroll` — 28 cas de non-régression (référence Excel IRPP 330 FCFA, équilibre débit/crédit du bulletin, inversion net→brut…).
- **Migrations** (additives, idempotentes) : `lib/db/src/migrate-payroll-scales.ts`, `lib/db/src/migrate-invoice-vat.ts`.
- ⚠️ Les cycles de paie futurs appliquent le barème de référence (9 %/22,5 %, IRPP CGI) au lieu des taux recodés (4 %/16,4 %) — bulletins historiques inchangés ; à valider par l'expert-comptable, ajustable par barème d'organisation sans redéploiement.

## Audit & nettoyage de la base de code — juillet 2026

Audit complet du monorepo en vue d'une reprise par un développeur externe (voir [`docs/CODEBASE_AUDIT.md`](docs/CODEBASE_AUDIT.md)).

- **Documentation** : `README.md` réécrit (reprise professionnelle) ; dossier `docs/` créé (`ARCHITECTURE`, `DEPLOYMENT`, `CONTRIBUTING`, `SECURITY`, `CODEBASE_AUDIT`).
- **`.env.example`** réaligné sur la marque Gaméasù et complété avec l'intégralité des variables réellement utilisées (Stripe, CinetPay, Google, emails, `VITE_*`), sans valeur secrète.
- **Nettoyage** : suppression de `attached_assets/` (619 fichiers, 133 Mo, inutilisés) et de l'alias Vite `@assets` ; retrait des uploads runtime versionnés (`api-server/uploads/*.webm`) + ajout au `.gitignore` ; déplacement des documents internes vers `docs/archive/` ; lockfile nettoyé (importer fantôme `edole-deck`). Contenu versionné réduit de ~150 à ~21 Mo (hors `.git`).
- **Typage** : correction sûre du type `req.id` (`ReqId`) dans `audit()` — erreurs de typecheck `api-server` ramenées de 122 à 65, sans impact runtime.
- **Sécurité** : documentation de la clé `CLOUD_STORAGE_ENCRYPTION_KEY` exposée dans `.replit` (rotation requise, voir `docs/SECURITY.md`). Aucun secret en dur détecté dans le code applicatif.

## Réinitialisation usine & base propre pour la production — juin 2026

Préparation de la **mise en production officielle** : purge complète des données (développement **et** production), tout en conservant la structure (schéma, migrations, routes, frontend, branding) et les données de référence.

- **Service de purge** (`api-server/src/services/factory-reset.ts`) : `TRUNCATE ... RESTART IDENTITY CASCADE` dynamique de **toutes** les tables applicatives (174 tables : comptes, organisations, abonnements, facturation, CRM, RH, paie, comptabilité, stock, locations, kiosk, messagerie, journaux métier…), **sauf** un ensemble de référence conservé : `subscription_plans`, `subscription_plan_features`, `module_catalog`, `permissions`, `roles`, `role_permissions`. Après la purge, ré-exécute `ensureCockpitAdmin` (super-admin plateforme), `seedHr` et `seedSyscohada` (structure par défaut de l'org plateforme). Renvoie un rapport `{ truncated[], kept[], recreated }`.
- **Endpoint protégé** (`superAdminCockpit.ts`) : `POST /super-admin/factory-reset`, réservé `super_admin` (middleware `sa`), exige la phrase de confirmation exacte **« RÉINITIALISER GAMEASU »** (sinon 400). Action tracée via `req.log.warn`.
- **UI Zone danger** (`gameasu-cockpit/src/pages/profile/index.tsx`) : carte « Zone danger — Réinitialisation usine » avec dialogue de confirmation (saisie de la phrase exacte). Après succès, déconnexion automatique (la purge supprime toutes les sessions) et redirection vers la connexion — l'accès se re-définit via « Mot de passe oublié » sur `cockpit@gameasu.com`.
- **Seeds de démo désactivés par défaut** (`routes/index.ts` + `lib/db/src/seed-saas.ts`) : au démarrage, seul le **catalogue** (plans + modules + RBAC) est semé, idempotent. Les données de démonstration (organisation « démo », intelligence, opérations, inventaire, kiosk) ne sont semées **que si `SEED_DEMO_DATA=true`**. Ainsi, en production comme après une réinitialisation usine, **la base vide le reste au redémarrage**. `seedSaas({ includeDemoData })` ne crée l'organisation de démonstration que sur demande explicite.
- **État final attendu** : 1 organisation interne (`gameasu-platform`, non facturable, `isDefault=false`) + 1 super-admin (`cockpit@gameasu.com`, sans mot de passe utilisable, `mustChangePassword=true`). Toutes les vues affichent des états vides propres (endpoints `/super-admin/{overview,health,organizations,revenue}` renvoient 200 avec compteurs à 0).

### Procédure de purge en production

1. Publier le déploiement (le nouveau code n'active aucun seed de démo : `SEED_DEMO_DATA` non défini).
2. Se connecter au Cockpit avec le super-admin (via « Mot de passe oublié » si nécessaire), ouvrir **Mon compte → Zone danger**, lancer la réinitialisation et saisir « RÉINITIALISER GAMEASU ».
3. Se reconnecter via « Mot de passe oublié » sur `cockpit@gameasu.com` pour redéfinir le mot de passe, puis activer la 2FA.

## Sécurisation du Cockpit plateforme — juin 2026

Finalisation et sécurisation du **Cockpit plateforme** (`artifacts/gameasu-cockpit`, servi sous `/cockpit/`) pour permettre au super-administrateur `cockpit@gameasu.com` de se connecter de façon **sécurisée après déploiement**, sans mot de passe en dur.

- **Bootstrap idempotent & sûr** (`api-server/src/services/ensure-admin.ts`) : organisation interne dédiée `gameasu-platform` (« Gaméasù Plateforme ») garantie au démarrage ; `cockpit@gameasu.com` rattaché à cette organisation, jamais à un tenant client. Le mot de passe n'est **jamais** écrasé (mot de passe aléatoire inutilisable à la création — l'admin le définit via lien sécurisé). Aucune élévation de privilège : un compte non-`super_admin` portant cet email n'est jamais promu (erreur loggée). Les adhésions résiduelles à un tenant de démo sont automatiquement purgées (`pruneForeignMemberships`).
- **Isolation de l'organisation plateforme** (`superAdminCockpit.ts`) : l'org interne est exclue de la liste des tenants et des compteurs de la vue d'ensemble ; son détail renvoie **404** et toute tentative de suspension/réactivation renvoie **403**.
- **Réinitialisation de mot de passe par rôle** (`auth.ts` `/auth/forgot-password`) : lien dérivé du rôle — `super_admin` → `${COCKPIT_PUBLIC_BASE_URL}/cockpit/reset-password`, utilisateur tenant → `${PUBLIC_BASE_URL}/reset-password`. Limitation anti-abus (5 demandes / 15 min par IP+email) et réponse générique constante (anti-énumération de comptes).
- **Parcours libre-service** (Cockpit) : page `/cockpit/reset-password` (lecture du `?token`), lien « Mot de passe oublié ? » sur l'écran de connexion, changement de mot de passe depuis le compte.
- **Invitations d'équipe sans mot de passe exposé** (`cockpitTeam.ts`) : l'invitation envoie un **lien à usage unique** de définition de mot de passe vers `/cockpit/reset-password` (valable 7 jours) ; aucun mot de passe temporaire n'est transmis par email. Compte créé avec mot de passe inutilisable + `mustChangePassword`. **Promotion d'un compte tenant existant sécurisée** : rattachement à l'org plateforme, mot de passe rendu inutilisable, redéfinition forcée via le même lien à usage unique, et invalidation des sessions/appareils de confiance hérités du tenant (impossible de réutiliser un ancien mot de passe tenant pour un accès super-admin).
- **2FA email + appareil de confiance 60 j** : connexion en deux temps (`/auth/login` → `2fa_required`, puis `/auth/login/verify-2fa`), code à usage unique haché en base, session UUID en table `auth_sessions`. **Anti-bruteforce** : au-delà de 5 codes erronés pour un même jeton temporaire, le code OTP est invalidé (HTTP 429) et l'utilisateur doit recommencer la connexion. Les anciens jetons Base64 sont **rejetés** (401).
- **Traçabilité** : actions du Cockpit auditées dans `cockpit_audit_logs` ; évènements d'authentification (demande/complétion de réinitialisation, envoi/succès/échec 2FA) dans `audit_logs`.

### Étape de déploiement (production / domaine personnalisé)

1. Définir les secrets `PUBLIC_BASE_URL` (origine de l'ERP) et, si le Cockpit a son propre domaine, `COCKPIT_PUBLIC_BASE_URL` (ex. futur `https://cockpit.gameasu.com`). Voir `.env.example`. Sans ces variables, les liens retombent sur `REPLIT_DEV_DOMAIN`.
2. Configurer l'envoi d'emails en production (connecteur Resend déjà installé, ou `RESEND_API_KEY`/`SENDGRID_API_KEY`).
3. Au premier démarrage, le bootstrap garantit le compte `cockpit@gameasu.com` (sans mot de passe utilisable). Utiliser « Mot de passe oublié ? » sur `/cockpit/` pour recevoir le lien de définition du mot de passe, puis activer la 2FA email à la connexion.
4. Domaine personnalisé `cockpit.gameasu.com` : pointer le domaine vers le déploiement, puis renseigner `COCKPIT_PUBLIC_BASE_URL=https://cockpit.gameasu.com` afin que les liens emails super-admin soient corrects.

## Recent Changes — mai 2026

### Inventory & Stock — produits, achats, mouvements — mai 2026
- **Schéma** (`lib/db/src/schema/inventory.ts`) : 6 tables tenant-scoped (`organizationId NOT NULL`) — `product_categories`, `products` (sku, prix achat/vente, taxRate, minStock, primarySupplierId), `purchase_orders` + `purchase_order_lines` (quantity/quantityReceived), `stock_movements` (kind in/out/adjust, quantity signée, unitCostFcfa, referenceType/Id), `sales_lines` (polymorphique parentType+parentId).
- **Backend** (`artifacts/api-server/src/routes/inventory.ts`, ~25 endpoints) : CRUD produits & catégories, bons de commande + réception partielle/totale (avec recalcul automatique du statut PO `draft|sent|partial|received`), `/stock/levels` & `/stock/alerts`, `/movements` + ajustement manuel signé, lignes de vente, `/commit-sale` (décrémentation atomique + idempotence par référence composite `parentType:parentId`), rapports `/reports/{valuation,top-sellers,purchases-vs-sales}`, `/overview` (KPI : valorisation totale, alertes, achats/ventes 30j).
- **RBAC** (`lib/rbac/catalog.ts`) : 4 permissions ajoutées (`inventory.read/manage/receive/adjust`), câblées sur manager (`*`), commercial (`read/manage`), collaborator (`read`). Super_admin/admin → `*`.
- **Frontend** (`artifacts/edole-admin/src/pages/inventory/index.tsx`) : page complète à 7 onglets — Vue d'ensemble (KPI + alertes), Produits (table + dialogue create/edit), Stock (niveaux + valorisation), Achats (PO + dialogue réception), Mouvements (timeline filtrée + ajustement), Alertes, Rapports (valorisation, top-sellers, achats vs ventes). Route `/inventory` + `/inventory/:tab`, sidebar « Produits & Stock » (icône Package) dans Projets & Opérations. Module `inventory_products` ajouté au plan Professional.
- **Seed démo** (`lib/db/src/seed-inventory.ts`, idempotent) : 4 catégories BTP, 8 produits (ciment, fer à béton, gants, casques, peinture, panneaux solaires…), 2 PO (1 réceptionné + 1 envoyé), stock initial valorisé à 2,7 M FCFA, ventes liées aux commandes existantes.
- **Hardening sécurité** (code review architect) :
  - PATCH `/products/:id` : strip `organizationId/id/createdAt/deletedAt` du body — empêche le déplacement cross-tenant.
  - POST `/sales-lines` : revalide `productId ∈ org` à la création.
  - POST `/commit-sale` : référence d'idempotence composite `parentType:parentId` (évite collisions UUID cross-types) + revalidation tenant sur tous les `productId` des lignes.
  - POST `/purchase-orders/:id/receive` : refuse les doublons de `lineId` dans la même réception (évite l'inflation de stock).

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
