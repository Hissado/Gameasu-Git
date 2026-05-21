import { NexoraMark } from "./NexoraMark";

/**
 * Verrouillage logotype Nexora.
 * Le monogramme « N » (NexoraMark) tient lieu de première lettre du mot
 * « Nexora » : on n'écrit donc QUE « exora » à droite de l'icône, jamais
 * « Nexora » (sinon le N est dupliqué). Slogan optionnel sous le lockup.
 */
export const NEXORA_SLOGAN = "Gérer aujourd'hui. Construire demain.";

type Size = "sm" | "md" | "lg" | "xl";
type Variant = "dark" | "light";

/**
 * Proportions calées sur le logo de référence : le « N » majuscule mesure
 * ≈ 1.4× la hauteur d'x des minuscules « exora » et dépasse légèrement au-dessus
 * comme en-dessous du bandeau de texte (descendeur or). Pas un carré qui colle
 * la hauteur totale du texte.
 */
const SIZES: Record<
  Size,
  { mark: string; word: string; slogan: string; gap: string; rule: string; pad: string }
> = {
  sm: { mark: "h-[14px] w-auto", word: "text-[18px]", slogan: "text-[8.5px] tracking-[0.20em]", gap: "ml-[1px]",  rule: "w-5",  pad: "mt-1.5" },
  md: { mark: "h-[18px] w-auto", word: "text-[22px]", slogan: "text-[9px]   tracking-[0.22em]", gap: "ml-[1px]",  rule: "w-6",  pad: "mt-2" },
  lg: { mark: "h-[24px] w-auto", word: "text-[30px]", slogan: "text-[10px]  tracking-[0.26em]", gap: "ml-[1.5px]", rule: "w-7",  pad: "mt-2.5" },
  xl: { mark: "h-[34px] w-auto", word: "text-[44px]", slogan: "text-[11px]  tracking-[0.30em]", gap: "ml-[2px]",  rule: "w-9",  pad: "mt-3" },
};

export function NexoraLockup({
  size = "md",
  variant = "dark",
  showSlogan = true,
  className = "",
  slogan = NEXORA_SLOGAN,
}: {
  size?: Size;
  variant?: Variant;
  showSlogan?: boolean;
  className?: string;
  slogan?: string;
}) {
  const s = SIZES[size];
  const wordColor = variant === "dark" ? "text-white" : "text-[#0F1A3A]";
  const sloganColor = variant === "dark" ? "text-[#C8A24B]" : "text-[#8A6A22]";
  const ruleColor = variant === "dark" ? "bg-[#C8A24B]" : "bg-[#C8A24B]";

  return (
    <div className={`inline-flex flex-col ${className}`}>
      <div className="inline-flex items-center">
        <NexoraMark className={s.mark} variant={variant} />
        <span
          className={`font-display font-bold leading-none tracking-[-0.04em] ${s.word} ${wordColor} ${s.gap}`}
          style={{ fontFeatureSettings: '"ss01"' }}
        >
          exora
        </span>
      </div>
      {showSlogan && (
        <div className={`inline-flex items-center gap-2 ${s.pad}`}>
          <span className={`h-px ${s.rule} ${ruleColor}`} aria-hidden="true" />
          <p className={`uppercase font-semibold ${s.slogan} ${sloganColor}`}>
            {slogan}
          </p>
        </div>
      )}
    </div>
  );
}
