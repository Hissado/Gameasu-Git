#!/bin/bash
set -e
pnpm install --frozen-lockfile

# Pre-flight: ensure invoices.public_token has a full unique constraint
# (drizzle schema uses .unique() which differs from the partial index WHERE IS NOT NULL)
psql "$DATABASE_URL" <<'SQL'
DO $$
BEGIN
  -- Drop partial unique index if present, replace with full unique constraint
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_public_token_unique'
  ) THEN
    ALTER TABLE invoices DROP CONSTRAINT invoices_public_token_unique;
  END IF;
  -- Also drop any standalone index with same name (created as partial index)
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'invoices' AND indexname = 'invoices_public_token_unique'
  ) THEN
    DROP INDEX IF EXISTS invoices_public_token_unique;
  END IF;
  -- Add the column if it doesn't exist yet
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'public_token'
  ) THEN
    ALTER TABLE invoices ADD COLUMN public_token text;
  END IF;
  -- Add full unique constraint (matches drizzle .unique())
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_public_token_unique'
  ) THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_public_token_unique UNIQUE (public_token);
  END IF;
END $$;
SQL

pnpm --filter @workspace/db run push-force
