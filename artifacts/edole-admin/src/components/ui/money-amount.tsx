import { cn } from "@/lib/utils";

/**
 * MoneyAmount — affichage uniforme des montants FCFA dans toute l'application.
 *
 * Hiérarchie visuelle :
 *  • Le chiffre est en gras, police display, chiffres tabulaires (alignement parfait en colonne).
 *  • « FCFA » est plus petit et légèrement atténué → le cerveau lit le nombre en premier.
 *
 * Usage :
 *   <MoneyAmount amount={325_200_000} size="lg" />
 *   <MoneyAmount amount={payment} size="xl" color="success" showSign />
 *   <MoneyAmount amount={balance} size="2xl" color="white" compactMobile />
 */

type Size = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
type Color = "default" | "success" | "danger" | "warning" | "muted" | "white";

interface MoneyAmountProps {
  amount: number | null | undefined;
  size?: Size;
  color?: Color;
  className?: string;
  showSign?: boolean;
  compact?: boolean;
  /** Sur mobile (< sm), affiche le montant en format compact (k / M / Md).
   *  Sur sm+ affiche le montant complet. Remplace `compact` quand les deux sont passés. */
  compactMobile?: boolean;
}

const NUM_SIZE: Record<Size, string> = {
  xs:  "text-xs",
  sm:  "text-sm",
  md:  "text-base",
  lg:  "text-xs sm:text-lg",
  xl:  "text-sm sm:text-xl",
  "2xl": "text-sm sm:text-2xl",
};

const CUR_SIZE: Record<Size, string> = {
  xs:  "text-[0.72em]",
  sm:  "text-[0.72em]",
  md:  "text-[0.70em]",
  lg:  "text-[0.65em]",
  xl:  "text-[0.60em]",
  "2xl": "text-[0.55em]",
};

const NUM_COLOR: Record<Color, string> = {
  default: "text-foreground",
  success: "text-emerald-600",
  danger:  "text-rose-600",
  warning: "text-amber-600",
  muted:   "text-muted-foreground",
  white:   "text-white",
};

const CUR_COLOR: Record<Color, string> = {
  default: "text-muted-foreground/60",
  success: "text-emerald-400",
  danger:  "text-rose-400",
  warning: "text-amber-400",
  muted:   "text-muted-foreground/60",
  white:   "text-white/50",
};

function formatNumber(amount: number, compact: boolean): string {
  if (compact) {
    if (Math.abs(amount) >= 1_000_000_000) {
      return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(amount / 1_000_000_000) + "\u202FMd";
    }
    if (Math.abs(amount) >= 1_000_000) {
      return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(amount / 1_000_000) + "\u202FM";
    }
    if (Math.abs(amount) >= 1_000) {
      return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount / 1_000) + "\u202Fk";
    }
  }
  return new Intl.NumberFormat("fr-FR", {
    style: "decimal",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function MoneyAmount({
  amount,
  size = "md",
  color = "default",
  className,
  showSign = false,
  compact = false,
  compactMobile = false,
}: MoneyAmountProps) {
  const value = amount ?? 0;
  const isNegative = value < 0;
  const abs = Math.abs(value);
  const sign = showSign && value > 0 ? "+" : isNegative ? "−" : "";
  const effectiveColor: Color = isNegative && color === "default" ? "danger" : color;

  const baseSpanClass = cn(
    "inline-flex items-baseline flex-wrap gap-x-1 gap-y-0 font-display font-bold tracking-tight leading-tight tabular-nums min-w-0",
    NUM_SIZE[size],
    NUM_COLOR[effectiveColor],
    className,
  );

  const curSpanClass = cn(
    "font-semibold uppercase tracking-wider not-italic whitespace-nowrap",
    CUR_SIZE[size],
    CUR_COLOR[effectiveColor],
  );

  if (compactMobile) {
    const compactNum = formatNumber(abs, true);
    const fullNum = formatNumber(abs, false);
    return (
      <span className={baseSpanClass} style={{ fontVariantNumeric: "tabular-nums" }}>
        {sign && <span className="opacity-70">{sign}</span>}
        {/* Mobile : compact */}
        <span className="sm:hidden">{compactNum}</span>
        {/* sm+ : complet */}
        <span className="hidden sm:inline">{fullNum}</span>
        <span className={curSpanClass}>FCFA</span>
      </span>
    );
  }

  const formatted = formatNumber(abs, compact);

  return (
    <span
      className={baseSpanClass}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {sign && <span className="opacity-70">{sign}</span>}
      <span>{formatted}</span>
      <span className={curSpanClass}>FCFA</span>
    </span>
  );
}
