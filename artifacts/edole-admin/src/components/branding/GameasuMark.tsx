import { BRANDING } from "@/config/branding";

/**
 * Gaméasù — monogramme officiel.
 * Sur fond clair comme sur fond sombre, on affiche la version transparente du
 * logo (le mark « G » navy + accent or supporte les deux contextes).
 */
export function GaméasùMark({
  className = "w-10 h-10",
}: {
  className?: string;
  /** Conservé pour rétrocompatibilité — sans effet. */
  variant?: "dark" | "light";
}) {
  return (
    <img
      src={BRANDING.logoMark}
      alt=""
      draggable={false}
      aria-hidden="true"
      className={`inline-block object-contain shrink-0 select-none ${className}`}
    />
  );
}
