---
name: Custom domain routing (multi-artifact deployment)
description: How custom domains behave on this path-routed multi-artifact Replit deployment, and how to make email links use a custom domain.
---

# Custom domains on this deployment

This monorepo deploys as ONE Replit deployment (autoscale). All artifacts are
**path-routed**, not host-routed: edole-admin owns `/` (ERP), cockpit `/cockpit/`,
kiosk `/kiosk/`, api-server `/api`. Routing is decided by URL **path**, never by the
subdomain/Host.

**Rule:** Every custom domain/subdomain you attach in Publishing → Domains points to
the *same* deployment, and the path still decides which app shows. So attaching
`erp.`, `cockpit.`, `kiosk.` as-is would make ALL THREE show the ERP at `/`. A
subdomain alone cannot select an app.

**Why:** Replit serves all linked domains from one deployment; artifact `paths` in
`.replit-artifact/artifact.toml` are shared dev/prod and only one service can own `/`.
True per-subdomain apps would require a host-aware Node gateway owning `/` (an
"aiguilleur") — a real engineering change, not a config toggle. Docs confirm: no
wildcard certs (add each subdomain individually), `replit-verify` TXT must stay
permanently, A + TXT records required.

**How to apply:**
- Easiest setup the user can accept = one domain + paths (e.g. `erp.gameasu.com`,
  `/cockpit`, `/kiosk`). Zero code changes — already works.
- For correct email/invitation links on a custom domain, set `PUBLIC_BASE_URL`
  (e.g. `https://erp.gameasu.com`) as a **production-only** env var (NOT shared —
  dev must keep using REPLIT_DEV_DOMAIN). Takes effect only on next Publish.
- Do NOT set `COCKPIT_PUBLIC_BASE_URL` to `<domain>/cockpit`: `getCockpitBaseUrl()`
  returns the bare base and call sites append `/cockpit/` themselves, so a path-suffixed
  value would double to `/cockpit/cockpit/`. Leave it unset on a single-domain setup.
- `getPublicBaseUrl()` priority: `PUBLIC_BASE_URL` → first of `REPLIT_DOMAINS` →
  `REPLIT_DEV_DOMAIN` → localhost. REPLIT_DOMAINS ordering isn't guaranteed, so the
  explicit `PUBLIC_BASE_URL` is the deterministic choice.
