import { BRANDING } from "@/config/branding";

/**
 * Verrouillage logotype Gameasu.
 * Le logo officiel (mark « G » + mot « ameasu » + filet or + slogan) est livré
 * comme une seule image. On le pose directement sur le support, sans cartouche :
 * la version transparente est utilisée partout, avec un voile d'opacité réduit
 * sur fond sombre pour un rendu subtil et premium.
 */
export const GAMEASU_SLOGAN = "Gérer aujourd'hui. Construire demain.";

type Size = "sm" | "md" | "lg" | "xl";
type Variant = "dark" | "light";

const SIZES: Record<Size, { h: string }> = {
  sm: { h: "h-7" },
  md: { h: "h-9" },
  lg: { h: "h-12" },
  xl: { h: "h-16" },
};

export function GameasuLockup({
  size = "md",
  variant = "light",
  className = "",
}: {
  size?: Size;
  variant?: Variant;
  /** Conservé pour rétrocompatibilité — sans effet : le slogan fait partie de l'image. */
  showSlogan?: boolean;
  /** Conservé pour rétrocompatibilité — sans effet. */
  slogan?: string;
  className?: string;
}) {
  const s = SIZES[size];
  // Sur fond sombre, on ne peut pas afficher le logo navy tel quel (navy/navy
  // illisible). On le convertit en silhouette claire avec une opacité réduite
  // pour un rendu « watermark » : grand mais discret, sans cartouche blanc.
  // Sur fond clair, on garde le logo original avec une opacité légèrement
  // adoucie pour qu'il s'intègre au design sans dominer.
  const style =
    variant === "dark"
      ? { filter: "brightness(0) invert(1)", opacity: 0.7 }
      : { opacity: 0.95 };
  return (
    <span className={`inline-flex items-center ${className}`}>
      <img
        src={BRANDING.logoFullTransparent}
        alt={BRANDING.appName}
        draggable={false}
        style={style}
        className={`inline-block w-auto object-contain select-none ${s.h}`}
      />
    </span>
  );
}
