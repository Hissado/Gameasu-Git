import { Sparkles, Crown, Rocket, Building2 } from "lucide-react";

const COLOR_MAP: Record<string, string> = {
  STARTER: "bg-white/[0.06] text-slate-200 ring-white/15",
  GROWTH: "bg-[#1B5E5E]/30 text-emerald-200 ring-emerald-400/25",
  PROFESSIONAL: "bg-primary/15 text-primary ring-primary/40",
  ENTERPRISE: "bg-[#3E2C5F]/40 text-violet-200 ring-violet-300/30",
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  STARTER: Sparkles,
  GROWTH: Rocket,
  PROFESSIONAL: Crown,
  ENTERPRISE: Building2,
};

export function PlanBadge({
  code, name, compact = false, light = false,
}: { code?: string; name?: string; compact?: boolean; light?: boolean }) {
  if (!code) return null;
  const Icon = ICON_MAP[code] ?? Sparkles;
  const cls = light
    ? "bg-primary/12 text-primary ring-primary/40"
    : (COLOR_MAP[code] ?? COLOR_MAP.STARTER);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold tracking-wide ring-1 ${cls}`}>
      <Icon className="w-3 h-3" />
      {name ?? code}
    </span>
  );
}
