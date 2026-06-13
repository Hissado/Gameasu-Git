#!/bin/bash
set -e
pnpm install --frozen-lockfile
echo "yes" | pnpm --filter db push || true
