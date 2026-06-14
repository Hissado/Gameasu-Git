---
name: Fiscal year auto-seed removed
description: History and fix for the auto-seed bug on GET /accounting/fiscal-periods
---

# Fiscal year auto-seed — supprimé

## Règle
Ne jamais auto-créer des exercices fiscaux dans un endpoint GET. L'auto-seed sur GET provoquait des duplicatas à chaque restart serveur.

**Why:** Le GET /accounting/fiscal-periods créait les exercices 2015–2030 si manquants → chaque restart ou nouvelle org créait des doublons massifs.

**How to apply:**
- `syscohada-seed.ts` : seed **uniquement** si `periods.length === 0` (bootstrapping d'une nouvelle org)
- La création manuelle se fait via POST /accounting/fiscal-periods (avec validation overlap)
- La progression se fait via POST /accounting/fiscal-periods/:id/create-next (après clôture)
- La suppression via DELETE /accounting/fiscal-periods/:id (seulement si aucune FK : entries/budgets/months = 0)
- Le GET retourne `isDeletable: boolean` pour que le frontend affiche le bouton poubelle
