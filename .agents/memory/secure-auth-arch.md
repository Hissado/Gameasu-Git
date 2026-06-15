---
name: Secure Auth Architecture
description: UUID session tokens in DB + bcrypt passwords + 2FA email OTP + trusted devices (60-day bypass)
---

## Architecture

Three new DB tables in `lib/db/src/schema/auth.ts`:
- `auth_sessions` — UUID token, userId FK, expiresAt (30 days), userAgent, ipAddress
- `two_factor_codes` — tempToken (hex), userId FK, codeHash (bcrypt), expiresAt (10 min), used flag
- `trusted_devices` — userId FK, deviceTokenHash (bcrypt), label, expiresAt (60 days), revokedAt

## Login flow

Step 1 — POST /api/auth/login:
- Bcrypt verify password (with transparent migration for plaintext legacy passwords)
- Check trusted device (deviceToken from localStorage, bcrypt-compare against all user's active devices)
  - If trusted → skip 2FA, return session token directly
- Generate 6-digit OTP (randomInt(100000, 1000000)), hash with bcrypt(rounds=10)
- Store in two_factor_codes with 32-byte hex tempToken
- Send email via buildTwoFactorEmail() in email.ts
- Return `{status: "2fa_required", tempToken}`

Step 2 — POST /api/auth/login/verify-2fa:
- Lookup tempToken in two_factor_codes (must be unused and not expired)
- Bcrypt compare code
- Mark as used
- Create session in auth_sessions (randomUUID(), 30-day expiry)
- If rememberMe: create trusted device, return deviceToken to client
- Return `{token, user, ...permissions}`

## Middleware strategy

`artifacts/api-server/src/middlewares/auth.ts` — resolveToken():
1. UUID v4 regex match → lookup auth_sessions (preferred)
2. Fallback: Base64 decode → userId:email → direct user lookup (legacy backward compat)

## Password migration

- verifyPassword() detects bcrypt ($2b$/$2a$ prefix) vs plaintext
- On successful plaintext login → hash with bcrypt(rounds=12) and update DB immediately

## Client storage

- `gameasu_device_token` — 32-byte hex raw device token (edole-admin localStorage)
- `cockpit_device_token` — 32-byte hex raw device token (cockpit localStorage)
- `auth_token` — UUID session token (edole-admin localStorage)
- `cockpit_token` — UUID session token (cockpit localStorage)

**Why:** Base64 userId:email was trivially forgeable. UUID sessions require DB lookup, expire after 30 days, and can be explicitly revoked (logout). 2FA prevents credential stuffing.

**How to apply:** Any new auth-related feature should use the session-based approach. To manually create sessions in tests, insert directly into auth_sessions with a UUID token.
