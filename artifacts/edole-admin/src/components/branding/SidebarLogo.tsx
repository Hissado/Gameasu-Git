import { Link } from "wouter";
import { BRANDING } from "@/config/branding";

/**
 * Logo sidebar — PNG source en blanc intégral.
 * - Fond supprimé (RGBA), filtre brightness(0) invert(1) → silhouette blanche.
 * - Crop CSS : on affiche uniquement les ~72 % supérieurs de l'image
 *   (ratio container 1672/678) pour masquer le filet or + slogan du bas.
 * - Left-aligné, compact, sans cartouche.
 */
export function SidebarLogo({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/"
      onClick={onNavigate}
      aria-label={BRANDING.appName}
      className="flex w-full items-center justify-center select-none"
    >
      {/* Conteneur à hauteur fixe : à 200 px de large, l'image mesure
          200 × (941/1672) = 112 px de haut. On en affiche 66 px (59 %)
          depuis le haut → slogan + filet masqués, G mark + wordmark visibles. */}
      <div style={{ width: 232, height: 76, overflow: "hidden" }}>
        <img
          src={BRANDING.logoFullTransparent}
          alt={BRANDING.appName}
          draggable={false}
          style={{
            width: 232,
            height: "auto",
            display: "block",
            userSelect: "none",
            opacity: 0.97,
          }}
        />
      </div>
    </Link>
  );
}
