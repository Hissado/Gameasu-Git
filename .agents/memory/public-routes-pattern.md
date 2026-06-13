---
name: Public API routes before requireAuth
description: How to add API routes accessible without authentication in this Express app.
---

# Public API routes pattern

## The rule
Any route that must be accessible without a JWT token must be placed in a **separate Router** that is registered **before** `router.use(requireAuth)` in `artifacts/api-server/src/routes/index.ts`.

**Why:** `app.use("/api", router)` mounts the single main router. Inside that router, `requireAuth` middleware (line ~88) intercepts everything registered after it. Routes registered before it (lines 77–88) bypass auth.

**How to apply:**
1. Create `artifacts/api-server/src/routes/<feature>-public.ts` with just the public handler(s)
2. Import it in `routes/index.ts` alongside the other public imports
3. Add `router.use(<featurePublicRouter>)` **before** `router.use(requireAuth)`

## Example
`orders-public.ts` exposes `GET /public/invoices/:token` — the token-based shareable invoice page.
The duplicate route that was in `orders.ts` (behind auth) was removed.

## Existing public routers (reference)
- `healthRouter`
- `authRouter`
- `publicOnboardingRouter`
- `kioskPublicRouter`
- `storageRouter`
- `marketingPublicRouter`
- `pricingPublicRouter`
- `ordersPublicRouter` ← added for /public/invoices/:token
