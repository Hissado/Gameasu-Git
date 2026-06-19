---
name: Public base URL for email links
description: How to build absolute URLs for emails/links; never trust the request Host header behind the Replit proxy.
---

# Public base URL resolution

All absolute URLs embedded in emails (invitations, password resets, cockpit
invites) must be built from a single helper, `lib/url.ts`
(`getPublicBaseUrl()` / `getCockpitBaseUrl()` in api-server), NOT from the
request's `Host` / `x-forwarded-proto` headers.

Resolution priority: `PUBLIC_BASE_URL` → `REPLIT_DOMAINS.split(",")[0]` →
`REPLIT_DEV_DOMAIN` → `localhost`.

**Why:** behind Replit's mTLS reverse proxy the `Host` header can be the internal
proxy host, producing broken links in delivered emails. `REPLIT_DOMAINS` is set
automatically in production to the real public domain, so the fallback chain is
correct in prod WITHOUT any manual env var. Set `PUBLIC_BASE_URL` explicitly only
for a custom domain; set `COCKPIT_PUBLIC_BASE_URL` only if the Cockpit lives on a
separate domain.

**How to apply:** any new link-building code calls the helper. Never reintroduce
`req.headers.host` for link construction — grep `headers.host` /
`x-forwarded-proto` after adding email features to confirm none crept back in.
The startup warning in index.ts only fires when neither PUBLIC_BASE_URL nor
REPLIT_DOMAINS exists (genuine misconfig), not on every boot.
