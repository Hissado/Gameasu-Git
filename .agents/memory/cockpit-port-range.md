---
name: Cockpit port range
description: Replit workflow supervisor only detects ports in the 25xxx range reliably; ports like 22522 cause DIDNT_OPEN_A_PORT even when Vite starts correctly.
---

## Rule
Always allocate cockpit/new artifact ports in the 25xxx range (e.g. 25658, 25659…). Port 22522 was originally assigned by createArtifact() and caused the Replit workflow supervisor to repeatedly report DIDNT_OPEN_A_PORT even though Vite started successfully (HTTP 200 confirmed manually). Changing to 25658 fixed it immediately.

**Why:** The Replit workflow supervisor appears to have port-range-specific detection quirks. Ports 8080, 8081 (API/sandbox), 25655, 25657 (existing artifacts) all work. Ports in the 20xxx-22xxx range assigned by createArtifact() may not be reliably detected.

**How to apply:** When createArtifact() assigns a port outside 25xxx and the workflow keeps failing with DIDNT_OPEN_A_PORT despite Vite starting, change the port to 25658+ via verifyAndReplaceArtifactToml().
