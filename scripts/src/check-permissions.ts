/**
 * Contrôle de cohérence des permissions & rôles — Gameasu (audit §13).
 *
 * Source de vérité : `artifacts/api-server/src/lib/rbac/catalog.ts`
 *   - PERMISSIONS : catalogue des codes de permission
 *   - SYSTEM_ROLES : rôles système et les codes qu'ils accordent
 *
 * Ce garde-fou statique détecte quatre familles d'incohérences réclamées par
 * l'audit migration/rôles/permissions :
 *
 *   1. DUPLICATE      — un même code déclaré plusieurs fois dans PERMISSIONS.
 *   2. ROLE-STALE     — un rôle système accorde un code absent du catalogue
 *                       (« ancien code » / code renommé non répercuté).
 *   3. ENFORCE-UNKNOWN— un point d'application (requirePermission côté API,
 *                       usePermissions côté UI) référence un code inexistant :
 *                       la route/route-garde ne protège rien de réel.
 *   4. ORPHAN         — un code du catalogue n'est accordé à aucun rôle ET
 *                       n'est appliqué nulle part (ni API ni UI) : permission
 *                       morte, à retirer ou à câbler (signalé en avertissement).
 *
 * Les catégories 1-3 sont bloquantes (exit 1). La catégorie 4 est informative
 * (n'échoue pas le build) car certaines permissions peuvent être réservées à un
 * usage futur ou accordées dynamiquement.
 *
 * Lancer avec : pnpm --filter @workspace/scripts run check-permissions
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";
import { pathToFileURL } from "url";

const ROOT = join(import.meta.dirname, "..", "..");
const CATALOG = join(ROOT, "artifacts/api-server/src/lib/rbac/catalog.ts");
const API_SRC = join(ROOT, "artifacts/api-server/src");
const UI_SRC = join(ROOT, "artifacts/edole-admin/src");
// Page admin qui maintient une copie durcie (« hardcodée ») du catalogue pour
// afficher la matrice de droits (MODULE_DEFS) et des presets (ROLE_TEMPLATES).
// Elle doit rester alignée sur le catalogue backend, sinon des permissions
// deviennent inassignables (absentes de la grille) ou fantômes (grille → id
// inexistant). On la contrôle explicitement.
const UI_ROLE_MATRIX = join(ROOT, "artifacts/edole-admin/src/pages/admin/roles.tsx");

// ── Types miroir du catalogue (structurel, pas d'import de types) ─────────────
type PermissionDef = { code: string; label: string; category: string };
type RoleSeed = { code: string; name: string; permissions: string[] | "*" };

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === "build") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if ([".ts", ".tsx"].includes(extname(full))) out.push(full);
  }
  return out;
}

/**
 * Extrait tout code de permission `<domaine>.<action>` référencé par un point
 * d'application (API ou UI) et renvoie où il est utilisé. On capture chaque
 * argument chaîne des helpers d'application connus, y compris les variadiques
 * (requireAnyPermission, hasAny, hasAll, canWriteAny).
 */
function extractEnforcedCodes(files: string[]): Map<string, string[]> {
  // Helpers dont les arguments chaîne sont des codes de permission.
  const callRe =
    /\b(?:requirePermission|requireAnyPermission|perms?\.(?:has|hasAny|hasAll|canWrite|canWriteAny))\s*\(([^)]*)\)/g;
  const strRe = /["'`]([a-z_]+\.[a-z_]+)["'`]/g;
  const found = new Map<string, string[]>();

  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const rel = file.replace(ROOT + "/", "");
    const lines = src.split("\n");
    lines.forEach((line, idx) => {
      callRe.lastIndex = 0;
      let call: RegExpExecArray | null;
      while ((call = callRe.exec(line))) {
        const args = call[1];
        strRe.lastIndex = 0;
        let s: RegExpExecArray | null;
        while ((s = strRe.exec(args))) {
          const code = s[1]!;
          const where = `${rel}:${idx + 1}`;
          const list = found.get(code) ?? [];
          list.push(where);
          found.set(code, list);
        }
      }
    });
  }
  return found;
}

async function main() {
  // 1) Charger le catalogue (fichier sans dépendance externe → import direct).
  const mod = (await import(pathToFileURL(CATALOG).href)) as {
    PERMISSIONS: PermissionDef[];
    SYSTEM_ROLES: RoleSeed[];
  };
  const { PERMISSIONS, SYSTEM_ROLES } = mod;

  const catalogCodes = new Set(PERMISSIONS.map((p) => p.code));

  type Problem = { kind: string; blocking: boolean; message: string };
  const problems: Problem[] = [];

  // ── 1. Doublons dans le catalogue ────────────────────────────────────────
  const seen = new Map<string, number>();
  for (const p of PERMISSIONS) seen.set(p.code, (seen.get(p.code) ?? 0) + 1);
  for (const [code, n] of seen) {
    if (n > 1) problems.push({ kind: "DUPLICATE", blocking: true, message: `Code déclaré ${n} fois dans PERMISSIONS : « ${code} »` });
  }

  // ── 2. Rôles accordant des codes hors catalogue (anciens codes) ──────────
  // On distingue les grants « métier » (rôle fonctionnel ciblant un sous-ensemble)
  // des grants « fourre-tout » (super_admin/admin qui détiennent quasi tout) :
  // seuls les premiers sauvent une permission du statut d'orpheline. Un rôle est
  // considéré fourre-tout s'il accorde ≥ 90 % du catalogue.
  const CATCH_ALL_THRESHOLD = 0.9 * PERMISSIONS.length;
  const grantedByRoles = new Set<string>();       // tous rôles confondus
  const grantedByFunctionalRoles = new Set<string>(); // hors rôles fourre-tout
  for (const role of SYSTEM_ROLES) {
    const codes = role.permissions === "*" ? PERMISSIONS.map((p) => p.code) : role.permissions;
    const isCatchAll = role.permissions === "*" || codes.length >= CATCH_ALL_THRESHOLD;
    for (const c of codes) {
      grantedByRoles.add(c);
      if (!isCatchAll) grantedByFunctionalRoles.add(c);
      if (!catalogCodes.has(c)) {
        problems.push({ kind: "ROLE-STALE", blocking: true, message: `Rôle « ${role.code} » accorde un code inconnu du catalogue : « ${c} »` });
      }
    }
  }

  // ── 3. Points d'application référençant un code inconnu ──────────────────
  const apiFiles = walk(API_SRC).filter((f) => !f.endsWith("rbac/catalog.ts"));
  const uiFiles = walk(UI_SRC);
  const enforced = extractEnforcedCodes([...apiFiles, ...uiFiles]);

  for (const [code, wheres] of enforced) {
    if (!catalogCodes.has(code)) {
      problems.push({ kind: "ENFORCE-UNKNOWN", blocking: true, message: `Permission appliquée mais absente du catalogue : « ${code} » (${wheres[0]}${wheres.length > 1 ? ` +${wheres.length - 1}` : ""})` });
    }
  }

  // ── 3bis. Cohérence de la grille UI (admin/roles.tsx) avec le catalogue ──
  // La grille de droits hardcode ses propres entrées `{ code: "x.y" }` et des
  // presets `permCodes: ["x.y", …]`. Un code fantôme (grille → catalogue absent)
  // afficherait une case à cocher qui ne correspond à aucune permission réelle.
  const uiSrc = readFileSync(UI_ROLE_MATRIX, "utf8");
  const uiRel = UI_ROLE_MATRIX.replace(ROOT + "/", "");
  const gridCodeRe = /\bcode:\s*["'`]([a-z_]+\.[a-z_]+)["'`]/g;
  const anyCodeRe = /["'`]([a-z_]+\.[a-z_]+)["'`]/g;
  const uiGridCodes = new Set<string>();
  let gm: RegExpExecArray | null;
  while ((gm = gridCodeRe.exec(uiSrc))) uiGridCodes.add(gm[1]!);
  const uiAllCodes = new Set<string>();
  let am: RegExpExecArray | null;
  while ((am = anyCodeRe.exec(uiSrc))) uiAllCodes.add(am[1]!);
  for (const code of uiAllCodes) {
    if (!catalogCodes.has(code)) {
      problems.push({ kind: "UI-STALE", blocking: true, message: `Grille de droits (${uiRel}) référence un code absent du catalogue : « ${code} »` });
    }
  }
  const uiUnlisted = PERMISSIONS.map((p) => p.code).filter((c) => !uiGridCodes.has(c));

  // ── 4. Permissions orphelines (informatif) ───────────────────────────────
  // Orpheline = jamais appliquée (ni API ni UI) ET accordée uniquement par les
  // rôles fourre-tout (super_admin/admin) : aucun rôle métier ne s'en sert et
  // aucune route/garde ne la contrôle → permission décorative, à câbler ou retirer.
  const orphans: string[] = [];
  for (const p of PERMISSIONS) {
    const inFunctionalRole = grantedByFunctionalRoles.has(p.code);
    const inCode = enforced.has(p.code);
    if (!inFunctionalRole && !inCode) orphans.push(p.code);
  }

  // ── Rapport ───────────────────────────────────────────────────────────────
  const blocking = problems.filter((p) => p.blocking);

  console.log(`check-permissions — Gameasu (audit §13)`);
  console.log(`  Catalogue : ${PERMISSIONS.length} permissions, ${SYSTEM_ROLES.length} rôles système`);
  console.log(`  Points d'application scannés : ${apiFiles.length} fichiers API + ${uiFiles.length} fichiers UI`);
  console.log(`  Codes distincts appliqués : ${enforced.size}`);
  console.log("");

  if (blocking.length > 0) {
    console.error(`✗ ${blocking.length} incohérence(s) bloquante(s) :\n`);
    for (const p of blocking) console.error(`  [${p.kind}] ${p.message}`);
    console.error("");
  }

  if (orphans.length > 0) {
    console.warn(`⚠ ${orphans.length} permission(s) orpheline(s) (déclarée(s) mais accordée/appliquée nulle part) :`);
    for (const c of orphans) console.warn(`  [ORPHAN] ${c}`);
    console.warn("");
  }

  if (uiUnlisted.length > 0) {
    console.warn(`⚠ ${uiUnlisted.length} permission(s) du catalogue absente(s) de la grille UI (admin/roles.tsx) — non assignable(s) via l'écran Rôles :`);
    for (const c of uiUnlisted) console.warn(`  [UI-UNLISTED] ${c}`);
    console.warn("");
  }

  if (blocking.length === 0) {
    console.log(`✓ check-permissions : aucune incohérence bloquante. Catalogue, rôles et points d'application sont alignés.`);
    process.exit(0);
  }
  console.error(`Corrigez les incohérences bloquantes ci-dessus (catalogue = source de vérité : ${CATALOG.replace(ROOT + "/", "")}).`);
  process.exit(1);
}

main().catch((e) => {
  console.error("check-permissions a échoué :", e);
  process.exit(2);
});
