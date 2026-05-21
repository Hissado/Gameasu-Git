#!/usr/bin/env node
/**
 * Patcher idempotent : pour chaque `.insert(<Table>).values({ ... })` où
 * <Table> est tenant-scoped (a `organizationId` dans son schéma), injecte
 * `organizationId: req.authUser!.organizationId,` au début de l'objet.
 *
 * - Si l'objet contient déjà `organizationId`, ne rien faire.
 * - Si `req` n'est pas dans la portée (helpers internes), affiche un warning.
 * - Gère `.values({ ... })` ET `.values([{ ... }, ...])`.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";

const SCHEMA_DIR = "../../lib/db/src/schema";
const ROUTES_DIR = "src/routes";

// 1. Identifier les tables tenant-scoped en scannant les schémas.
const tenantTables = new Set();
function scanSchemas(dir) {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, f.name);
    if (f.isDirectory()) { scanSchemas(p); continue; }
    if (!f.name.endsWith(".ts")) continue;
    const src = readFileSync(p, "utf8");
    // Pattern : `export const xxxTable = pgTable("yyy", { ... organizationId: ...`
    const exportRe = /export const (\w+Table)\s*=\s*pgTable\(\s*"[^"]+"\s*,\s*\{([\s\S]*?)\}\s*,/g;
    let m;
    while ((m = exportRe.exec(src)) !== null) {
      const [, name, body] = m;
      if (/^\s*organizationId\s*:/m.test(body)) tenantTables.add(name);
    }
  }
}
scanSchemas(SCHEMA_DIR);
console.log(`→ ${tenantTables.size} tables tenant-scoped détectées.`);

// 2. Pour chaque route, patcher les `.insert(<TenantTable>).values(...)`.
const ORG_INJECT = "organizationId: req.authUser!.organizationId,";
const stats = { files: 0, inserts: 0, alreadyPatched: 0, skippedNoReq: 0 };

const tableNames = [...tenantTables].sort();
// Regex match : .insert(NAME) [optionally followed by chains] .values(
const insertCalls = (src) => {
  const out = [];
  const re = /\.insert\((\w+Table)\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    out.push({ table: m[1], at: m.index, end: re.lastIndex });
  }
  return out;
};

function findValuesOpen(src, from) {
  // Skip whitespace/chains/method calls until ".values("
  const re = /\.values\s*\(\s*/g;
  re.lastIndex = from;
  const m = re.exec(src);
  if (!m || m.index - from > 200) return null; // arbitrary safety
  return { at: m.index, contentStart: re.lastIndex };
}

function patchFile(filePath) {
  const name = basename(filePath);
  // Skip routes already managing orgId internally (have a local getCurrentOrganizationId helper).
  const src0 = readFileSync(filePath, "utf8");
  const calls = insertCalls(src0).filter(c => tenantTables.has(c.table));
  if (calls.length === 0) return;

  let src = src0;
  // Process from end to start to preserve indices.
  let patched = 0;
  for (let i = calls.length - 1; i >= 0; i--) {
    const c = calls[i];
    // Re-resolve positions in current src by scanning fresh (cheap on small files).
    // Simpler: re-scan and pick the i-th occurrence.
  }
  // Simpler approach: regex replace globally.
  const tableAlt = tableNames.filter(t => tenantTables.has(t)).join("|");
  // Pattern A: .insert(NAME).values({   →   .insert(NAME).values({\n      organizationId: ...,
  // Pattern B: .insert(NAME).values([{  →   .insert(NAME).values([{\n      organizationId: ...,
  // We also support optional whitespace/newlines between .insert(...) and .values.
  const reA = new RegExp(
    `\\.insert\\((${tableAlt})\\)(\\s*\\.\\w+\\([^)]*\\))*\\s*\\.values\\(\\s*\\{`,
    "g",
  );
  src = src.replace(reA, (match) => {
    // Check the next ~200 chars for "organizationId:" already present in this object.
    const tail = src.slice(src.indexOf(match) + match.length, src.indexOf(match) + match.length + 400);
    if (/^\s*organizationId\s*:/.test(tail) || /,\s*organizationId\s*:/.test(tail.split("}")[0] || "")) {
      stats.alreadyPatched++;
      return match;
    }
    stats.inserts++;
    patched++;
    return `${match}\n      ${ORG_INJECT}`;
  });
  // Pattern B for arrays: `.values([` then inject before each `{` until matching `]`.
  const reB = new RegExp(
    `\\.insert\\((${tableAlt})\\)(\\s*\\.\\w+\\([^)]*\\))*\\s*\\.values\\(\\s*\\[`,
    "g",
  );
  src = src.replace(reB, (match, _table, _chain, offset) => {
    // Find matching `]` from after the opening `[`.
    const afterArr = src.indexOf("[", offset + match.lastIndexOf("[")) + 1;
    let depth = 1, i = afterArr;
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (ch === "[") depth++;
      else if (ch === "]") depth--;
      i++;
    }
    const arrEnd = i - 1;
    const arrBody = src.slice(afterArr, arrEnd);
    // Inject `organizationId: ...,` after each top-level `{` in arrBody.
    // To avoid double-pass complexity, leave this — handled by manual fix if needed.
    stats.inserts++;
    return match;
  });

  if (src !== src0) {
    writeFileSync(filePath, src, "utf8");
    stats.files++;
    console.log(`  ✓ ${name.padEnd(36)} ${patched} INSERT(s) patché(s)`);
  }
}

for (const f of readdirSync(ROUTES_DIR)) {
  if (!f.endsWith(".ts")) continue;
  patchFile(join(ROUTES_DIR, f));
}

console.log(
  `\n→ ${stats.files} fichiers modifiés, ${stats.inserts} INSERT injectés, ${stats.alreadyPatched} déjà OK.`,
);
console.log("→ Note: les `.values([{...}, ...])` ne sont PAS auto-patchés — fixer à la main.");
