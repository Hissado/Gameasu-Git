#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push &
PUSH_PID=$!
wait $PUSH_PID || true
