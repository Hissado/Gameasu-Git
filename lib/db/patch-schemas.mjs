#!/usr/bin/env node
// Patches all historical schema files to add `organizationId NOT NULL` column.
// Idempotent: skips files that already contain `organization_id`.
import fs from "node:fs";
import path from "node:path";

const SCHEMA_DIR = "src/schema";

// Files to skip — already partitioned, or contain only global tables.
const SKIP = new Set([
  "saas.ts",
  "attendance.ts",
  "intelligence.ts",
  "operations.ts",
  "inventory.ts",
  "governance.ts",
  "rbac.ts",
  "index.ts",
]);

const ORG_COLUMN_LINE = `  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),`;
const ID_LINE_RE = /^( {2}id: uuid\("id"\)\.primaryKey\(\)\.defaultRandom\(\),)$/gm;

let totalFiles = 0, totalInjections = 0;
for (const f of fs.readdirSync(SCHEMA_DIR)) {
  if (SKIP.has(f)) continue;
  if (!f.endsWith(".ts")) continue;
  const filePath = path.join(SCHEMA_DIR, f);
  let src = fs.readFileSync(filePath, "utf8");

  if (src.includes("organization_id")) {
    console.log(`skip ${f} (already has organization_id)`);
    continue;
  }

  // 1) Add import for organizationsTable if missing.
  if (!src.includes('from "./saas"') && !src.includes("organizationsTable")) {
    // Inject after the LAST import line of the file.
    const lines = src.split("\n");
    let lastImport = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("import ")) lastImport = i;
    }
    if (lastImport < 0) {
      console.log(`WARN ${f}: no import lines found, skipping`);
      continue;
    }
    lines.splice(lastImport + 1, 0, `import { organizationsTable } from "./saas";`);
    src = lines.join("\n");
  }

  // 2) Inject organizationId column right after the id line of EVERY pgTable.
  const before = src;
  src = src.replace(ID_LINE_RE, (m, idLine) => `${idLine}\n${ORG_COLUMN_LINE}`);
  const injections = (src.match(/organization_id/g) || []).length;
  if (src === before) {
    console.log(`skip ${f}: no id lines matched`);
    continue;
  }

  fs.writeFileSync(filePath, src);
  totalFiles++;
  totalInjections += injections;
  console.log(`patched ${f}: +${injections} organizationId columns`);
}

console.log(`\n✓ Patched ${totalFiles} schema files, ${totalInjections} columns added.`);
