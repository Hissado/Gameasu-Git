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
 *   <MoneyAmount amount={balance} size="2xl" color="white" />
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
}

const NUM_SIZE: Record<Size, string> = {
  xs:  "text-xs",
  sm:  "text-sm",
  md:  "text-base",
  lg:  "text-sm sm:text-lg",
  xl:  "text-base sm:text-xl",
  "2xl": "text-lg sm:text-2xl",
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
  default: "text-slate-900",
  success: "text-emerald-600",
  danger:  "text-rose-600",
  warning: "text-amber-600",
  muted:   "text-slate-500",
  white:   "text-white",
};

const CUR_COLOR: Record<Color, string> = {
  default: "text-slate-400",
  success: "text-emerald-400",
  danger:  "text-rose-400",
  warning: "text-amber-400",
  muted:   "text-slate-400",
  white:   "text-white/50",
};

function formatNumber(amount: number, compact: boolean): string {
  if (compact) {
    if (Math.abs(amount) >= 1_000_000_000) {
      return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(amount / 1_000_000_000) + " Md";
    }
    if (Math.abs(amount) >= 1_000_000) {
      return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(amount / 1_000_000) + " M";
    }
    if (Math.abs(amount) >= 1_000) {
      return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount / 1_000) + " k";
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
}: MoneyAmountProps) {
  const value = amount ?? 0;
  const formatted = formatNumber(Math.abs(value), compact);
  const sign = showSign && value > 0 ? "+" : value < 0 ? "−" : "";
  const isNegative = value < 0;

  const effectiveColor: Color = isNegative && color === "default" ? "danger" : color;

  return (
    <span
      className={cn(
        "inline-flex items-baseline flex-wrap gap-x-1.5 gap-y-0 font-display font-bold tracking-tight leading-tight tabular-nums min-w-0",
        NUM_SIZE[size],
        NUM_COLOR[effectiveColor],
        className,
      )}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {sign && <span className="opacity-70">{sign}</span>}
      <span>{formatted}</span>
      <span
        className={cn(
          "font-semibold uppercase tracking-wider not-italic whitespace-nowrap",
          CUR_SIZE[size],
          CUR_COLOR[effectiveColor],
        )}
      >
        FCFA
      </span>
    </span>
  );
}
