---
name: Static route-link guard
description: How the edole-admin/api-server monorepo prevents broken internal navigation links (wrong route literals, links to non-existent detail pages) from recurring.
---

`pnpm run check-routes` (delegates to `scripts/src/check-routes.ts`, runnable directly as `pnpm --filter @workspace/scripts run check-routes`) statically extracts every `<Route path="...">` from `artifacts/edole-admin/src/App.tsx` (source of truth) and scans all `.ts/.tsx` files under `artifacts/edole-admin/src` and `artifacts/api-server/src` for internal link literals (`href=`, `navigate(`, `setLocation(`, `window.location.href=`, `linkedPath:`). It fails if any literal — static or template-literal with a dynamic `:param` segment — doesn't match a registered route. It's wired as the final step of the root `pnpm run typecheck` chain.

**Why:** a recurring bug class was hardcoded English route literals (e.g. `/projects/`, `/collaborators/`) in a French-routed app, plus links to detail pages that were never built (no equipment/invoice/document detail route exists — those must point to the nearest valid list route instead, e.g. `/equipements`, `/factures`, `/documents`).

**How to apply:** run `pnpm run check-routes` after adding/editing any navigation link or after adding/removing a route in `App.tsx`. When a Link/navigate target has no matching detail page, redirect to the parent list route rather than inventing a page. If a link carries query-param state meant to prefill another page's create-dialog (e.g. timesheet → proforma), wire actual prefill support (read `window.location.search` in the target page) rather than silently dropping the params.
