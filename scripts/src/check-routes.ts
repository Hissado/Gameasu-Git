/**
 * Static guard against broken internal navigation links.
 *
 * Extracts every `<Route path="...">` declared in the edole-admin router
 * (source of truth for real French route paths) and every internal link
 * literal used across the frontend (href=, <Link href=, navigate(,
 * setLocation(, window.location.href=) and backend (linkedPath:) source
 * files, then reports any link literal that does not match a registered
 * route.
 *
 * Run with: pnpm --filter @workspace/scripts run check-routes
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

const ROOT = join(import.meta.dirname, "..", "..");
const APP_TSX = join(ROOT, "artifacts/edole-admin/src/App.tsx");
const SCAN_DIRS = [
  join(ROOT, "artifacts/edole-admin/src"),
  join(ROOT, "artifacts/api-server/src"),
];

const EXTERNAL_PREFIXES = ["http://", "https://", "mailto:", "tel:", "//", "#"];
const IGNORED_LITERAL_PATTERNS = [/^\/api\b/, /^\/$/];

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

function extractRegisteredRoutes(): string[] {
  const src = readFileSync(APP_TSX, "utf8");
  const routes: string[] = [];
  const re = /<Route\s+path="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) routes.push(m[1]);
  return routes;
}

function routeToRegex(route: string): RegExp {
  const escaped = route
    .split("/")
    .map(seg => (seg.startsWith(":") ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return new RegExp(`^${escaped}$`);
}

function extractLinkLiterals(filePath: string): { path: string; line: number; dynamic: boolean }[] {
  const src = readFileSync(filePath, "utf8");
  const lines = src.split("\n");
  const found: { path: string; line: number; dynamic: boolean }[] = [];
  // Captures the static prefix of a path literal, stopping at the closing
  // quote, a `${` interpolation, whitespace, or a query string.
  const patterns = [
    /\bhref=(?:\{)?["'`](\/[^"'`{}$\s?]*)/g,
    /\bnavigate\(\s*["'`](\/[^"'`$\s?]*)/g,
    /\bsetLocation\(\s*["'`](\/[^"'`$\s?]*)/g,
    /window\.location\.href\s*=\s*["'`](\/[^"'`$\s?]*)/g,
    /linkedPath:\s*["'`](\/[^"'`$\s?]*)/g,
  ];
  lines.forEach((line, idx) => {
    for (const re of patterns) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(line))) {
        let p = m[1];
        const matchEnd = m.index + m[0].length;
        const dynamic = line.slice(matchEnd, matchEnd + 2) === "${";
        if (dynamic) p = p.replace(/\/$/, "") || "/";
        if (EXTERNAL_PREFIXES.some(pre => p.startsWith(pre))) continue;
        if (IGNORED_LITERAL_PATTERNS.some(pat => pat.test(p))) continue;
        found.push({ path: p, line: idx + 1, dynamic });
      }
    }
  });
  return found;
}

/** True if `prefix` matches a registered route up to a dynamic (":param") segment. */
function isDynamicPrefixMatch(prefix: string, routes: string[]): boolean {
  const litSegs = prefix.split("/").filter(Boolean);
  return routes.some(r => {
    const segs = r.split("/").filter(Boolean);
    if (segs.length <= litSegs.length) return false;
    for (let i = 0; i < litSegs.length; i++) {
      if (segs[i] !== litSegs[i]) return false;
    }
    return segs[litSegs.length]!.startsWith(":");
  });
}

function main() {
  const routes = extractRegisteredRoutes();
  const routeRegexes = routes.map(r => ({ raw: r, re: routeToRegex(r) }));

  const files = SCAN_DIRS.flatMap(d => walk(d));
  const problems: { file: string; line: number; path: string }[] = [];

  for (const file of files) {
    if (file === APP_TSX) continue;
    for (const { path, line, dynamic } of extractLinkLiterals(file)) {
      const matches = dynamic
        ? isDynamicPrefixMatch(path, routes)
        : routeRegexes.some(r => r.re.test(path));
      if (!matches) problems.push({ file: file.replace(ROOT + "/", ""), line, path: dynamic ? `${path}/…` : path });
    }
  }

  if (problems.length === 0) {
    console.log(`✓ check-routes: all ${files.length} scanned files link only to the ${routes.length} registered routes.`);
    process.exit(0);
  }

  console.error(`✗ check-routes: found ${problems.length} link(s) pointing to unregistered routes:\n`);
  for (const p of problems) {
    console.error(`  ${p.file}:${p.line}  →  "${p.path}"`);
  }
  console.error(`\nEach path above must match one of the ${routes.length} routes declared in artifacts/edole-admin/src/App.tsx (French route names — see replit.md).`);
  process.exit(1);
}

main();
