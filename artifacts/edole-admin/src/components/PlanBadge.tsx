import { Sparkles, Crown, Rocket, Building2, Zap } from "lucide-react";

const COLOR_MAP: Record<string, string> = {
  // Plans actuels
  STARTER:    "bg-white/[0.06] text-slate-200 ring-white/15",
  BUSINESS:   "bg-[#1B5E5E]/30 text-emerald-200 ring-emerald-400/25",
  PREMIUM:    "bg-[#2563EB]/15 text-[#93c5fd] ring-[#2563EB]/40",
  ENTERPRISE: "bg-[#3E2C5F]/40 text-violet-200 ring-violet-300/30",
  // Alias anciens codes (rétrocompatibilité)
  GROWTH:       "bg-[#1B5E5E]/30 text-emerald-200 ring-emerald-400/25",
  PROFESSIONAL: "bg-[#2563EB]/15 text-[#93c5fd] ring-[#2563EB]/40",
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  STARTER:      Sparkles,
  BUSINESS:     Rocket,
  PREMIUM:      Crown,
  ENTERPRISE:   Building2,
  // Alias anciens codes
  GROWTH:       Rocket,
  PROFESSIONAL: Crown,
};

// Noms d'affichage normalisés
const NAME_MAP: Record<string, string> = {
  GROWTH:       "Business",
  PROFESSIONAL: "Premium",
};

export function PlanBadge({
  code, name, compact = false, light = false,
}: { code?: string; name?: string; compact?: boolean; light?: boolean }) {
  if (!code) return null;
  const upper = code.toUpperCase();
  const Icon = ICON_MAP[upper] ?? Zap;
  const cls = light
    ? "bg-[#2563EB]/12 text-[#1e40af] ring-[#2563EB]/40"
    : (COLOR_MAP[upper] ?? COLOR_MAP.STARTER);
  const displayName = name ?? NAME_MAP[upper] ?? code;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold tracking-wide ring-1 ${cls}`}>
      <Icon className="w-3 h-3" />
      {displayName}
    </span>
  );
}
