/**
 * Contrôle d'intégrité de la source unique de vérité RH (module Ressources
 * Humaines). Garantit que menu, routes, permissions et fils d'Ariane restent
 * cohérents — filet anti-régression (§3, §11).
 *
 * Vérifie :
 *  1. UNIQUE-ROUTE   — aucune route dupliquée dans l'arbre.
 *  2. PERM-UNKNOWN   — toute `permission` de nœud existe dans le catalogue RBAC.
 *  3. READY-INCOMPLETE — un nœud `ready` doit porter `component` ET `route`.
 *  4. READY-UNROUTED — la route d'un nœud `ready` est bien déclarée
 *     (`<Route path="…">`) dans App.tsx.
 *  5. PLANNED-NOROUTE — un nœud `planned` doit porter une `route` (sinon il
 *     n'est pas atteignable via le gabarit généré).
 *
 * Lancer : pnpm --filter @workspace/scripts run check-rh-nav
 */
import { readFileSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";

const ROOT = join(import.meta.dirname, "..", "..");
const RH_NAV = join(ROOT, "artifacts/edole-admin/src/config/rh-navigation.ts");
const CATALOG = join(ROOT, "artifacts/api-server/src/lib/rbac/catalog.ts");
const APP_TSX = join(ROOT, "artifacts/edole-admin/src/App.tsx");

type RhNode = {
  key: string; label: string; route?: string; permission?: string;
  status?: "ready" | "planned"; component?: string; children?: RhNode[];
};

async function main() {
  const nav = (await import(pathToFileURL(RH_NAV).href)) as {
    RH_MODULE: { children: RhNode[] };
    rhRouteEntries: () => Array<{ route: string; node: RhNode }>;
  };
  const cat = (await import(pathToFileURL(CATALOG).href)) as {
    PERMISSIONS: Array<{ code: string }>;
  };
  const catalogCodes = new Set(cat.PERMISSIONS.map((p) => p.code));
  const appSrc = readFileSync(APP_TSX, "utf8");
  const registeredLiterals = new Set<string>();
  for (const m of appSrc.matchAll(/<Route\s+path="([^"]+)"/g)) registeredLiterals.add(m[1]!);

  const problems: string[] = [];
  const routeCounts = new Map<string, number>();

  const walk = (nodes: RhNode[]) => {
    for (const n of nodes) {
      if (n.route) routeCounts.set(n.route, (routeCounts.get(n.route) ?? 0) + 1);
      if (n.permission && !catalogCodes.has(n.permission)) {
        problems.push(`[PERM-UNKNOWN]   nœud « ${n.key} » → permission absente du catalogue : « ${n.permission} »`);
      }
      if (n.status === "ready") {
        if (!n.component) problems.push(`[READY-INCOMPLETE] nœud « ${n.key} » (ready) sans component`);
        if (!n.route) problems.push(`[READY-INCOMPLETE] nœud « ${n.key} » (ready) sans route`);
        else if (!registeredLiterals.has(n.route)) {
          problems.push(`[READY-UNROUTED]  nœud « ${n.key} » (ready) : route « ${n.route} » non déclarée dans App.tsx`);
        }
      }
      if (n.status === "planned" && !n.route) {
        problems.push(`[PLANNED-NOROUTE] nœud « ${n.key} » (planned) sans route → inatteignable`);
      }
      if (n.children) walk(n.children);
    }
  };
  walk(nav.RH_MODULE.children);

  for (const [route, count] of routeCounts) {
    if (count > 1) problems.push(`[UNIQUE-ROUTE]    route déclarée ${count} fois dans l'arbre RH : « ${route} »`);
  }

  const total = nav.rhRouteEntries().length;
  console.log(`check-rh-nav — source unique de vérité RH`);
  console.log(`  ${total} nœuds routés ; ${routeCounts.size} routes distinctes ; ${catalogCodes.size} permissions au catalogue`);

  if (problems.length === 0) {
    console.log(`✓ check-rh-nav : arbre RH cohérent (routes, permissions, composants alignés).`);
    process.exit(0);
  }
  console.error(`\n✗ ${problems.length} incohérence(s) dans l'arbre RH :\n`);
  for (const p of problems) console.error(`  ${p}`);
  console.error(`\nCorrigez la source unique de vérité : ${RH_NAV.replace(ROOT + "/", "")}`);
  process.exit(1);
}

main().catch((e) => { console.error("check-rh-nav a échoué :", e); process.exit(2); });
