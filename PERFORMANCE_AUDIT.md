# Audit performance et UX Gameasu — 2026-07-24

## État initial mesuré

Mesures réalisées localement sur le build Vite de production, en environnement sans backend API démarré. Les temps API, exports PDF/Excel et scénarios authentifiés devront être rejoués sur staging avec données réelles.

| Zone | Constat initial | Impact | Priorité |
| --- | --- | --- | --- |
| Build ERP | Le build échouait sans `PORT` et `BASE_PATH`, empêchant toute mesure production reproductible. | Risque de configuration différente entre développement et production. | Critique |
| Bundle ERP | Le build produit de nombreux chunks par route, mais conservait un chunk vendor générique très volumineux avant optimisation manuelle. | Téléchargement initial et cache navigateur moins efficaces. | Important |
| Runtime overlay | Le plugin d'overlay Replit était chargé dans la liste des plugins sans garde directe de production. | Code/outillage développement inutilement éligible au pipeline production. | Important |
| API frontend ERP/Cockpit | Les helpers `apiFetch` ne dédupliquaient pas les GET simultanés et n'imposaient pas de timeout. | Requêtes répétées, attente interminable et ressenti d'application bloquée. | Critique |
| Changement d'organisation | Le changement de tenant invalidait les requêtes mais ne vidait pas explicitement tout le cache ni les GET en vol. | Risque d'affichage transitoire de données de l'ancienne organisation. | Critique |
| Pages blanches | Le Cockpit dispose d'une boundary globale ; l'ERP a une boundary autour des modules authentifiés, mais pas autour des pages publiques. | Risque résiduel sur login/inscription/paiement. | Important |
| Responsive/listes | Les composants table existent, mais l'audit statique montre beaucoup de pages métier indépendantes ; les corrections complètes nécessitent des scénarios visuels. | Risque de débordement mobile selon module. | Important |

## Corrections appliquées

### Critique

- Le helper API ERP déduplique désormais les requêtes GET identiques en vol, applique un timeout par défaut de 30 s, expose une annulation globale et retire les entrées du registre après résolution.
- Le helper API Cockpit applique la même stratégie de déduplication/timeout/annulation.
- Le changement d'organisation ERP annule les requêtes frontend en cours, annule les requêtes React Query, vide le cache, puis recharge uniquement l'identité du nouveau contexte.

### Importante

- Les configs Vite ERP et Cockpit excluent l'overlay Replit en production.
- Le build ERP n'exige plus `PORT` et `BASE_PATH` pour une compilation production locale/staging reproductible ; des valeurs par défaut sûres sont utilisées.
- Les bundles Vite sont découpés en familles vendor stables : React/router, TanStack Query, Radix UI, icônes, graphiques et reste vendor.
- Les builds désactivent les sourcemaps production, conservent le code splitting CSS et fixent un seuil d'alerte explicite sur les chunks lourds.

## Gains mesurés après correction

| Mesure | Résultat après correction |
| --- | --- |
| Build ERP | Succès en 39,42 s lors de la première mesure post-correction. |
| Build Cockpit | Succès en 10,70 s lors de la première mesure post-correction. |
| Cockpit vendor principal | Plus gros vendor Cockpit mesuré à 321,36 kB minifié / 81,56 kB gzip pour les graphiques ; React isolé à 256,98 kB / 79,67 kB gzip. |
| ERP chunks route | La majorité des routes ERP sont servies en chunks indépendants de quelques kB à quelques dizaines de kB. |
| Robustesse API | Les GET identiques simultanés partagent une promesse unique ; les requêtes bloquées sont interrompues après 30 s par défaut. |

## Risques résiduels et recommandations

- Installer des tests E2E de performance avec backend staging et jeux de données volumineux : clients, écritures, audit, factures, collaborateurs et paie.
- Ajouter des budgets Lighthouse/Playwright par viewport : 320, 375, 430, 768, 1024, 1280 et 1440 px.
- Étendre l'Error Boundary ERP aux pages publiques critiques : login, inscription, paiement, invitation et facture publique.
- Ajouter une virtualisation ou des vues cartes mobiles aux tables les plus volumineuses après priorisation par données réelles.
- Mesurer les requêtes SQL côté serveur avec `organization_id`, pagination et index composites par module métier.
