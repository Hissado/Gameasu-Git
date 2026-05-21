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

const SIZES: Record<
  Size,
  { mark: string; word: string; slogan: string; gap: string; rule: string; pad: string }
> = {
  sm: { mark: "w-7 h-7",   word: "text-[18px]", slogan: "text-[8.5px]  tracking-[0.20em]", gap: "gap-1.5", rule: "w-5",  pad: "mt-1" },
  md: { mark: "w-9 h-9",   word: "text-[22px]", slogan: "text-[9px]    tracking-[0.22em]", gap: "gap-2",   rule: "w-6",  pad: "mt-1.5" },
  lg: { mark: "w-12 h-12", word: "text-[30px]", slogan: "text-[10px]   tracking-[0.26em]", gap: "gap-2.5", rule: "w-7",  pad: "mt-2" },
  xl: { mark: "w-16 h-16", word: "text-[44px]", slogan: "text-[11px]   tracking-[0.30em]", gap: "gap-3",   rule: "w-9",  pad: "mt-2.5" },
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
      <div className={`inline-flex items-center ${s.gap}`}>
        <NexoraMark className={`${s.mark} rounded-md`} variant={variant} />
        <span
          className={`font-display font-bold leading-none tracking-[-0.035em] ${s.word} ${wordColor}`}
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
