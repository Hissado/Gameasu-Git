---
name: Cloud Storage Integration
description: Architecture and pitfalls for the cloud storage (Google Drive + extensible) integration
---

# Cloud Storage Integration

## Architecture
- 3 DB tables: `cloud_storage_connections`, `cloud_synced_files`, `cloud_sync_queue`
- Provider interface `IStorageProvider` in `src/lib/cloud-storage/base.ts`
- Google Drive provider uses `googleapis` package (already in `build.mjs` external[] list)
- Token encryption: AES-256-GCM via `CLOUD_STORAGE_ENCRYPTION_KEY` (SHA-256 hash of env var → 32-byte key)
- Sync worker: `setInterval` 2 min in `sync-worker.ts`, started from `routes/index.ts`

## OAuth callback URL
Built from `REPLIT_DOMAINS` (first domain) or `PUBLIC_BASE_URL` env var:
`{base}/api/cloud-storage/oauth/google/callback`

## 2FA login endpoint for CLI testing
The verify endpoint is `/api/auth/login/verify-2fa` (not `/api/auth/verify-2fa`).
Use Python atomic subprocess to avoid OTP expiry between two curl calls.

## Adding new providers
1. Implement `IStorageProvider` interface
2. Add case in `getProvider()` factory in `index.ts`
3. Add entry to `PROVIDER_CATALOG` with `available: true`
4. Add OAuth route handler (start + callback)

**Why:** The provider catalog was designed for extensibility; available=false entries show "coming soon" in the UI without breaking anything.

## Env vars required
- `CLOUD_STORAGE_ENCRYPTION_KEY` — set as shared env var (not a secret); value = any 32+ char random string
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — optional; if absent provider is available=false; set in Google Cloud Console
