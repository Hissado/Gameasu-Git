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
      className="inline-flex items-center shrink-0 select-none"
    >
      {/* Conteneur recadré : aspect-ratio 1672/678 = top 72 % de l'image.
          À 200 px de large → hauteur naturelle 200×(941/1672)=112 px,
          container visible = 112×0.72 = 81 px. Slogan masqué. */}
      <div
        className="overflow-hidden"
        style={{ width: 200, aspectRatio: "1672 / 678" }}
      >
        <img
          src={BRANDING.logoFullTransparent}
          alt={BRANDING.appName}
          draggable={false}
          className="w-full h-auto object-cover object-top block select-none"
          style={{
            filter: "brightness(0) invert(1)",
            opacity: 0.93,
          }}
        />
      </div>
    </Link>
  );
}
