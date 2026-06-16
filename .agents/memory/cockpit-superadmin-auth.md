---
name: Cockpit super_admin auth model
description: Security invariants for the platform Cockpit super_admin account and its invite flow.
---

# Cockpit super_admin auth model

The platform Cockpit (`artifacts/gameasu-cockpit`, served at `/cockpit/`) is administered by a real
super_admin (`cockpit@gameasu.com`) living in the dedicated internal org `gameasu-platform`.

## Rules
- The bootstrap (`ensure-admin.ts`) creates the account with a **random unusable bcrypt password** and
  **never overwrites** an existing password. The admin sets it via the "forgot password" → emailed link.
- **Never leave a known/usable password on `cockpit@gameasu.com`, even in dev.** After any smoke test that
  set a temporary password (e.g. via reset), reset it back to a random unusable hash and purge the test
  `auth_sessions` / `two_factor_codes` / `trusted_devices` rows for that user. A known dev password is a
  real prod risk if that DB is ever deployed.
- The team-invite endpoint must treat an **existing tenant (non-super_admin) account** as a *secure
  upgrade*, not a silent role flip: reparent to the platform org, set an unusable password +
  `mustChangePassword`, issue a 7-day set-password token (same `/cockpit/reset-password` link), and
  **delete the user's existing sessions + trusted devices** so an old tenant password can't grant
  super-admin access.

**Why:** the whole task goal was "no hardcoded/known password". A leftover test password or a silent
upgrade that keeps the old tenant credential both defeat that goal.

**How to apply:** when touching the cockpit bootstrap, invite, or any auth smoke test, re-check these
invariants before finishing. Mirror the create-branch template in `cockpitTeam.ts` for the upgrade branch.
