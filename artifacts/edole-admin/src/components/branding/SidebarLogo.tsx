import { Link } from "wouter";
import { BRANDING } from "@/config/branding";

/**
 * Logo sidebar — composition en deux éléments :
 * 1. G mark : portion gauche (~36 %) du PNG recadrée, technique double couche
 *    pour préserver l'or (accent doré du G) sur fond sombre.
 * 2. Wordmark HTML : « Gaméasù » avec é/ù en or #C8A24B, reste blanc.
 *    Font : Inter Tight Bold, alignée sur la marque.
 *
 * Ratio source PNG : 1672 × 941.
 * Crop largeur : 36 % → G mark seul.
 * Crop hauteur : 72 % → slogan masqué.
 */

const GOLD = "#C8A24B";

export function SidebarLogo({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/"
      onClick={onNavigate}
      aria-label={BRANDING.appName}
      className="inline-flex items-center gap-2.5 shrink-0 select-none"
    >
      {/* ── G mark ─────────────────────────────────────────────────────────── */}
      {/* Container : montre uniquement la partie gauche (G circulaire).
          Largeur image affichée : 130 px → 36 % = ~47 px de G visible.
          Hauteur : 130 × (941/1672) × 72 % ≈ 53 px → slogan masqué. */}
      <div
        style={{ width: 47, height: 53, overflow: "hidden", position: "relative", flexShrink: 0 }}
      >
        {/* Couche 1 — silhouette blanche : rend le G lisible sur fond sombre */}
        <img
          src={BRANDING.logoFullTransparent}
          alt=""
          aria-hidden
          draggable={false}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 130,
            height: "auto",
            filter: "brightness(0) invert(1)",
            opacity: 0.9,
          }}
        />
        {/* Couche 2 — couleurs d'origine, mix-blend multiply :
            or × blanc (dessous) = or → accent doré conservé.
            navy × blanc = navy → corps du G légèrement foncé, accepté. */}
        <img
          src={BRANDING.logoFullTransparent}
          alt=""
          aria-hidden
          draggable={false}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 130,
            height: "auto",
            mixBlendMode: "multiply",
          }}
        />
      </div>

      {/* ── Wordmark ────────────────────────────────────────────────────────── */}
      <span
        style={{
          fontFamily: "'Inter Tight', 'Inter', system-ui, sans-serif",
          fontWeight: 700,
          fontSize: 19,
          letterSpacing: "-0.03em",
          lineHeight: 1,
          display: "inline-flex",
          alignItems: "baseline",
        }}
      >
        <span style={{ color: "rgba(255,255,255,0.96)" }}>Gam</span>
        <span style={{ color: GOLD }}>é</span>
        <span style={{ color: "rgba(255,255,255,0.96)" }}>as</span>
        <span style={{ color: GOLD }}>ù</span>
      </span>
    </Link>
  );
}
