#!/bin/bash
set -e
pnpm install --frozen-lockfile

# Apply any pending unique constraints directly via SQL to avoid interactive prompts
psql "$DATABASE_URL" -c "
  ALTER TABLE invoices ADD CONSTRAINT invoices_public_token_unique UNIQUE (public_token);
" 2>/dev/null || true

pnpm --filter @workspace/db run push-force <<< "$(printf 'no\n%.0s' {1..20})" || true
