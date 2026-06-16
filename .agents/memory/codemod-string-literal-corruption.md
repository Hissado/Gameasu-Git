---
name: Codemod string-literal corruption
description: Text-based casts of req.params/query/headers.X can corrupt identical-looking strings inside runtime config literals (e.g. Pino redact paths).
---

A text/regex codemod that rewrites `req.headers.X` / `req.params.X` / `req.query.X` into
`(... as string)` will ALSO match those identifiers when they appear inside **string literals**,
not just in code expressions. The cast is meaningless there and silently corrupts runtime config.

**Concrete incident:** Pino's `redact: ["req.headers.authorization", "req.headers.cookie", ...]`
got rewritten to `"(req.headers.authorization as string)"`. Pino treats redact entries as literal
object-paths, so the corrupted paths matched nothing → Authorization/Cookie headers stopped being
redacted in logs. A silent **security regression** with zero typecheck/boot error.

**Why:** `as string` is runtime-erased in code, so most such casts are harmless — but inside a
string literal the text is the actual data, and a wrong path just no-ops without throwing.

**How to apply:** After any blanket cast codemod over `req.(params|query|headers).IDENT`, grep for
the corruption signature `['"\`]\(req\.` (a quote/backtick immediately before `(req.`). Audit every
hit: legitimate casts are bare expressions (`(req.params.id as string)` as a function arg / object
value); corruption lives inside config arrays/objects whose strings are interpreted at runtime
(Pino redact, route path strings, SQL fragments, OpenAPI paths, log-message templates).
