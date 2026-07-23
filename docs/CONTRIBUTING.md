# Contribution — Gaméasù

## 1. Prérequis

- Node.js 24, pnpm 9+, PostgreSQL 16.
- Lire [`README.md`](../README.md) et [`ARCHITECTURE.md`](ARCHITECTURE.md).

## 2. Workflow git

1. Créer une branche à partir de `main` :
   - `feature/<sujet>` — nouvelle fonctionnalité
   - `fix/<sujet>` — correction de bug
   - `chore/<sujet>` — maintenance, outillage, docs
2. Committer par petites unités cohérentes.
3. Ouvrir une Pull Request vers `main`.

### Convention de commits

Format recommandé — [Conventional Commits](https://www.conventionalcommits.org/) :

```
<type>(<portée>): <description à l'impératif>

feat(crm): ajoute le filtre par statut sur le pipeline
fix(billing): corrige le calcul du prorata annuel
docs(readme): met à jour la procédure d'installation
chore(deps): met à jour drizzle-orm
```

Types courants : `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`.

## 3. Qualité de code

Avant de pousser :

```bash
pnpm run typecheck          # doit passer sans erreur
pnpm exec prettier --write . # formatage
```

Conventions :

- **TypeScript strict** — pas de `any` implicite ; typer les entrées/sorties.
- **Nommage** : composants React en `PascalCase`, hooks en `useCamelCase`,
  fichiers utilitaires en `kebab-case` ou `camelCase` selon le voisinage.
- **Validation** : toute entrée d'API validée par un schéma **Zod**
  (`lib/api-zod`).
- **États** : gérer explicitement les états *loading / error / success* côté
  frontend (TanStack Query).
- **Composants** : privilégier des composants courts, à responsabilité unique ;
  extraire la logique réutilisable dans des hooks (`src/hooks/`).
- **Pas de secret** dans le code ni dans les logs.

## 4. Pull requests

Une PR doit indiquer :

- l'objectif du changement ;
- les éventuelles migrations de schéma ;
- les impacts UI (captures d'écran si pertinent) ;
- les points d'attention pour la revue.

La revue vérifie : cohérence avec l'architecture, typage, gestion des erreurs,
sécurité (permissions/validation), absence de code mort.

## 5. Ajouter…

- **Une page frontend** : `artifacts/edole-admin/src/pages/<domaine>/`, puis
  l'enregistrer dans le routeur.
- **Un composant partagé** : `artifacts/edole-admin/src/components/`
  (UI générique dans `components/ui/`).
- **Une route API** : `artifacts/api-server/src/routes/<nom>.ts`, montée dans
  `routes/index.ts`, avec schéma Zod associé et contrôle de permission.
- **Une table** : `lib/db/src/schema/`, migration, schéma Zod correspondant.
- **Une variable d'environnement** : l'ajouter à `.env.example` (commentée),
  la lire via `process.env` / `import.meta.env`, la documenter.
