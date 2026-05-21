/**
 * Nexora — marque officielle.
 * Reproduit le « N » du logo : profils navy, diagonale gold inversée,
 * accent or pointe basse-gauche. Conserve un contraste lisible à 16-24px.
 */
export function NexoraMark({
  className = "w-10 h-10",
  variant = "dark",
}: {
  className?: string;
  /** dark = fond navy (sidebar, hero) — light = fond ivoire (cards, header) */
  variant?: "dark" | "light";
}) {
  const isDark = variant === "dark";
  // Fond, traits, accent
  const bg = isDark ? "#0F1A3A" : "#F5F1E8";
  const stroke = isDark ? "#F5F1E8" : "#0F1A3A";   // profils du N
  const diag = isDark ? "#3A4A78" : "#1B2A4E";     // diagonale (assez claire sur navy pour rester visible)
  const gold = "#C8A24B";

  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-lg overflow-hidden shrink-0 ${className}`}
      style={{ background: bg }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 40 44" className="w-[64%] h-[64%]">
        <path d="M0 0 L0 44 L8 44 L8 0 Z" fill={stroke} />
        <path d="M8 0 L32 44 L40 44 L16 0 Z" fill={diag} />
        <path d="M32 0 L32 44 L40 44 L40 0 Z" fill={stroke} />
        <path d="M0 30 L8 44 L0 44 Z" fill={gold} />
      </svg>
    </span>
  );
}
