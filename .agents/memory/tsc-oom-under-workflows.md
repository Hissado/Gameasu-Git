---
name: tsc OOM under running workflows
description: Full TypeScript typecheck gets cgroup-OOM-killed when all dev-server workflows run; how to verify code without it
---

## Symptom
Any full `tsc` run — `pnpm run typecheck`, `typecheck:libs`, a per-package `tsc --noEmit`, or `tsc --build` — is SIGKILLed (exit 137) part-way, often with no output. Even a trivial bash command can be OOM-killed during the spike. `free -m` shows ~4.4 GB "available" at idle, but tsc's peak plus the running dev servers exceeds the container's ~7.9 GB cgroup limit.

**Why:** this monorepo runs several Vite/tsx dev-server workflows at once (api-server + 3-4 frontends + mockup-sandbox). tsc resolving the large `@workspace/db` source schema peaks high; combined with the dev servers it trips the cgroup OOM killer. Heap-capping tsc (`--max-old-space-size`) did not reliably help; detached/`setsid` runs die too (the whole process group is killed, so no sentinel file is written).

**How to apply:** don't burn many attempts re-running tsc. Verify another way:
- Backend: restart the api-server workflow — it runs a one-shot **esbuild** bundle (`node ./build.mjs`) at startup, which fails loudly on syntax/import errors (esbuild ≠ typecheck, but catches structural breakage). A clean "Done in …ms" + "Server listening" is a strong signal.
- Resolve type-critical references by grep: confirm new imports, table columns, constants, and SELECTed fields exist.
- Frontend: Vite strips types, so a page load validates runtime, not types — rely on grep + mirroring existing already-typed lines.
- If a real full typecheck is essential, it likely needs the dev-server workflows stopped first to free memory.
