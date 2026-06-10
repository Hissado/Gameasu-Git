---
name: Object storage URL convention
description: How to construct the public serve URL from the objectPath returned by the presigned upload endpoint
---

POST `/api/storage/uploads/request-url` returns `{ uploadURL, objectPath }`.

`objectPath` looks like `/objects/uploads/abc123.pdf`.

The storage GET route is mounted at `/api/storage/objects/*path`, where the wildcard captures everything after `/objects/`.

**To build the serve URL:** `"/api/storage" + objectPath`
→ e.g. `/api/storage/objects/uploads/abc123.pdf` ✓

**Why:** The route handler prepends `/objects/` to the wildcard match, so the full objectPath (`/objects/uploads/...`) maps cleanly to `/api/storage` + objectPath.

**How to apply:** In any file upload flow that uses the presigned URL endpoint, set `fileUrl = "/api/storage" + objectPath` after the PUT to `uploadURL` succeeds.
