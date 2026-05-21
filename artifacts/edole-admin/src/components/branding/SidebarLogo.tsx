import { Link } from "wouter";
import { BRANDING } from "@/config/branding";

/**
 * Logo sidebar — centrage chirurgical.
 *
 * PNG 1672×941. Sans padding parent → largeur réelle = 268 px → image rendue 150.8 px de haut.
 * Logo (G+wordmark) : y_orig 150–640 → rendu 24–102 px. Centre ≈ 63 px.
 * Slogan : y_orig ≈ 680 → rendu ≈ 109 px.
 * marginTop = -(63 – 32) = –31 px → fenêtre visible 31–95 px.
 * Slogan (109 px) hors fenêtre. Logo centré dans h=64 px.
 */
export function SidebarLogo({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/"
      onClick={onNavigate}
      aria-label={BRANDING.appName}
      style={{ display: "block", width: "100%", overflow: "hidden", height: 64 }}
    >
      <img
        src={BRANDING.logoFullTransparent}
        alt={BRANDING.appName}
        draggable={false}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          marginTop: -31,
          userSelect: "none",
          opacity: 0.97,
        }}
      />
    </Link>
  );
}
