import { Sparkles, Crown, Rocket, Building2 } from "lucide-react";

const COLOR_MAP: Record<string, string> = {
  STARTER: "bg-slate-500/15 text-slate-300 ring-slate-400/30",
  GROWTH: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  PROFESSIONAL: "bg-orange-500/15 text-orange-300 ring-orange-400/30",
  ENTERPRISE: "bg-violet-500/15 text-violet-300 ring-violet-400/30",
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
    ? "bg-orange-500/10 text-orange-700 ring-orange-300/50"
    : (COLOR_MAP[code] ?? COLOR_MAP.STARTER);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ring-1 ${cls}`}>
      <Icon className="w-3 h-3" />
      {compact ? code : (name ?? code)}
    </span>
  );
}
