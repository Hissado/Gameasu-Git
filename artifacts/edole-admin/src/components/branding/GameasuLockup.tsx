import { BRANDING } from "@/config/branding";

/**
 * Verrouillage logotype Gaméasù.
 * Le logo officiel (mark « G » + mot « améasù » + filet or + slogan) est livré
 * comme une seule image — on l'affiche telle quelle, en sélectionnant la version
 * pleine (fond clair) ou transparente (fond sombre).
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

export function GaméasùLockup({
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
  const img = (
    <img
      src={BRANDING.logoFull}
      alt={BRANDING.appName}
      draggable={false}
      className={`inline-block w-auto object-contain select-none ${s.h}`}
    />
  );
  if (variant === "dark") {
    return (
      <span className={`inline-flex items-center rounded-xl bg-white px-3 py-1.5 shadow-sm ring-1 ring-white/10 ${className}`}>
        {img}
      </span>
    );
  }
  return <span className={`inline-flex items-center ${className}`}>{img}</span>;
}
