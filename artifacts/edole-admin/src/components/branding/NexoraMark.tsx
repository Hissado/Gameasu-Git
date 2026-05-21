import { BRANDING } from "@/config/branding";

/**
 * Nexora — marque officielle.
 * Affiche le « N » du logo officiel (PNG fourni par la marque).
 * Sur fond navy (variant="dark"), la pastille reste cream pour rester fidèle
 * au visuel d'origine ; sur fond clair (variant="light") on est transparent.
 */
export function NexoraMark({
  className = "w-10 h-10",
  variant = "light",
}: {
  className?: string;
  /** dark = pastille cream (à utiliser sur fond navy) — light = transparent (sur fond ivoire/blanc) */
  variant?: "dark" | "light";
}) {
  const isDark = variant === "dark";
  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-lg overflow-hidden shrink-0 ${className}`}
      style={{ background: isDark ? "#F5F1E8" : "transparent" }}
      aria-hidden="true"
    >
      <img
        src={BRANDING.logoMark}
        alt=""
        draggable={false}
        className="w-[86%] h-[86%] object-contain"
      />
    </span>
  );
}
