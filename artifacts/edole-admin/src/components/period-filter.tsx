import React, { useMemo, useState } from "react";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowLeftRight, X, ChevronDown } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type PeriodPreset =
  | "today"
  | "week" | "month" | "quarter" | "semester" | "year"
  | "ytd" | "mtd"
  | "prev-week" | "prev-month" | "prev-quarter" | "prev-semester" | "prev-year"
  | "rolling-30" | "rolling-90" | "rolling-180" | "rolling-365"
  | "custom";

export type CompareMode =
  | "none"
  | "mom" | "yoy" | "qoq"
  | "ytd-vs-prior-ytd" | "mtd-vs-prior-mtd"
  | "current-vs-previous"
  | "custom";

export type DateRange = { from: string; to: string };

export const PRESET_LABELS: Record<PeriodPreset, string> = {
  today:         "Aujourd'hui",
  week:          "Semaine en cours",
  month:         "Mois en cours",
  quarter:       "Trimestre en cours",
  semester:      "Semestre en cours",
  year:          "Année en cours",
  ytd:           "YTD — Depuis le 1er janvier",
  mtd:           "MTD — Depuis le 1er du mois",
  "prev-week":   "Semaine précédente",
  "prev-month":  "Mois précédent",
  "prev-quarter":"Trimestre précédent",
  "prev-semester":"Semestre précédent",
  "prev-year":   "Année précédente",
  "rolling-30":  "30 derniers jours",
  "rolling-90":  "90 derniers jours",
  "rolling-180": "6 derniers mois",
  "rolling-365": "12 derniers mois",
  custom:        "Période personnalisée",
};

export const COMPARE_LABELS: Record<CompareMode, string> = {
  none:                  "Pas de comparaison",
  mom:                   "MoM — Mois précédent",
  yoy:                   "YoY — Même période N-1",
  qoq:                   "QoQ — Trimestre précédent",
  "ytd-vs-prior-ytd":    "YTD vs YTD N-1",
  "mtd-vs-prior-mtd":    "MTD vs MTD N-1",
  "current-vs-previous": "Période courante vs précédente",
  custom:                "Période de comparaison personnalisée",
};

// ─────────────────────────────────────────────────────────────────────────────
// Utilitaires date (sans dépendance timezone — dates locales uniquement)
// ─────────────────────────────────────────────────────────────────────────────

export function fmtLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fmtLabel(iso: string): string {
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("fr-FR");
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const dow = r.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  r.setDate(r.getDate() + diff);
  return r;
}

export function computePeriod(
  preset: PeriodPreset,
  customFrom = "",
  customTo = "",
): DateRange {
  if (preset === "custom" && customFrom && customTo) return { from: customFrom, to: customTo };

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (preset) {
    case "today":
      return { from: fmtLocal(now), to: fmtLocal(now) };
    case "week": {
      const mon = startOfWeek(now);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { from: fmtLocal(mon), to: fmtLocal(sun) };
    }
    case "month":
      return { from: fmtLocal(new Date(y, m, 1)), to: fmtLocal(new Date(y, m + 1, 0)) };
    case "quarter": {
      const q = Math.floor(m / 3);
      return { from: fmtLocal(new Date(y, q * 3, 1)), to: fmtLocal(new Date(y, q * 3 + 3, 0)) };
    }
    case "semester": {
      const s = m < 6 ? 0 : 1;
      return { from: fmtLocal(new Date(y, s * 6, 1)), to: fmtLocal(new Date(y, s * 6 + 6, 0)) };
    }
    case "year":
      return { from: fmtLocal(new Date(y, 0, 1)), to: fmtLocal(new Date(y, 11, 31)) };
    case "ytd":
      return { from: fmtLocal(new Date(y, 0, 1)), to: fmtLocal(now) };
    case "mtd":
      return { from: fmtLocal(new Date(y, m, 1)), to: fmtLocal(now) };
    case "prev-week": {
      const mon = startOfWeek(now);
      const prevMon = new Date(mon); prevMon.setDate(mon.getDate() - 7);
      const prevSun = new Date(prevMon); prevSun.setDate(prevMon.getDate() + 6);
      return { from: fmtLocal(prevMon), to: fmtLocal(prevSun) };
    }
    case "prev-month":
      return { from: fmtLocal(new Date(y, m - 1, 1)), to: fmtLocal(new Date(y, m, 0)) };
    case "prev-quarter": {
      const q = Math.floor(m / 3);
      const pq = q === 0 ? 3 : q - 1;
      const py = q === 0 ? y - 1 : y;
      return { from: fmtLocal(new Date(py, pq * 3, 1)), to: fmtLocal(new Date(py, pq * 3 + 3, 0)) };
    }
    case "prev-semester": {
      const s = m < 6 ? 1 : 0;
      const py = m < 6 ? y - 1 : y;
      return { from: fmtLocal(new Date(py, s * 6, 1)), to: fmtLocal(new Date(py, s * 6 + 6, 0)) };
    }
    case "prev-year":
      return { from: fmtLocal(new Date(y - 1, 0, 1)), to: fmtLocal(new Date(y - 1, 11, 31)) };
    case "rolling-30": {
      const f = new Date(now); f.setDate(f.getDate() - 29);
      return { from: fmtLocal(f), to: fmtLocal(now) };
    }
    case "rolling-90": {
      const f = new Date(now); f.setDate(f.getDate() - 89);
      return { from: fmtLocal(f), to: fmtLocal(now) };
    }
    case "rolling-180": {
      const f = new Date(now); f.setDate(f.getDate() - 179);
      return { from: fmtLocal(f), to: fmtLocal(now) };
    }
    case "rolling-365": {
      const f = new Date(now); f.setDate(f.getDate() - 364);
      return { from: fmtLocal(f), to: fmtLocal(now) };
    }
    default:
      return { from: fmtLocal(new Date(y, m, 1)), to: fmtLocal(new Date(y, m + 1, 0)) };
  }
}

export function computeComparePeriod(
  mode: CompareMode,
  period: DateRange,
  customFrom = "",
  customTo = "",
): DateRange | null {
  if (mode === "none") return null;
  if (mode === "custom" && customFrom && customTo) return { from: customFrom, to: customTo };

  const [fy, fm, fd] = period.from.split("-").map(Number);
  const [ty, tm, td] = period.to.split("-").map(Number);
  const f = new Date(fy, fm - 1, fd);
  const t = new Date(ty, tm - 1, td);
  const days = Math.round((t.getTime() - f.getTime()) / 86400000);

  switch (mode) {
    case "mom": {
      const f2 = new Date(f); f2.setMonth(f2.getMonth() - 1);
      const t2 = new Date(t); t2.setMonth(t2.getMonth() - 1);
      return { from: fmtLocal(f2), to: fmtLocal(t2) };
    }
    case "yoy": {
      const f2 = new Date(f); f2.setFullYear(f2.getFullYear() - 1);
      const t2 = new Date(t); t2.setFullYear(t2.getFullYear() - 1);
      return { from: fmtLocal(f2), to: fmtLocal(t2) };
    }
    case "qoq": {
      const f2 = new Date(f); f2.setMonth(f2.getMonth() - 3);
      const t2 = new Date(t); t2.setMonth(t2.getMonth() - 3);
      return { from: fmtLocal(f2), to: fmtLocal(t2) };
    }
    case "ytd-vs-prior-ytd":
    case "mtd-vs-prior-mtd": {
      const f2 = new Date(f); f2.setFullYear(f2.getFullYear() - 1);
      const t2 = new Date(t); t2.setFullYear(t2.getFullYear() - 1);
      return { from: fmtLocal(f2), to: fmtLocal(t2) };
    }
    case "current-vs-previous": {
      const t2 = new Date(f); t2.setDate(t2.getDate() - 1);
      const f2 = new Date(t2); f2.setDate(f2.getDate() - days);
      return { from: fmtLocal(f2), to: fmtLocal(t2) };
    }
    default:
      return null;
  }
}

export function periodQuery(p: DateRange): string {
  return `from=${p.from}&to=${p.to}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook usePeriodFilter
// ─────────────────────────────────────────────────────────────────────────────

export function usePeriodFilter(defaultPreset: PeriodPreset = "month") {
  const [preset, setPreset] = useState<PeriodPreset>(defaultPreset);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [compareMode, setCompareMode] = useState<CompareMode>("none");
  const [customCompareFrom, setCustomCompareFrom] = useState("");
  const [customCompareTo, setCustomCompareTo] = useState("");

  const period = useMemo(
    () => computePeriod(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  const comparePeriod = useMemo(
    () => computeComparePeriod(compareMode, period, customCompareFrom, customCompareTo),
    [compareMode, period, customCompareFrom, customCompareTo],
  );

  const pQuery = useMemo(() => periodQuery(period), [period]);
  const cQuery = useMemo(() => comparePeriod ? periodQuery(comparePeriod) : null, [comparePeriod]);

  return {
    preset, setPreset,
    customFrom, setCustomFrom,
    customTo, setCustomTo,
    compareMode, setCompareMode,
    customCompareFrom, setCustomCompareFrom,
    customCompareTo, setCustomCompareTo,
    period,
    comparePeriod,
    periodQuery: pQuery,
    comparePeriodQuery: cQuery,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant PeriodFilter
// ─────────────────────────────────────────────────────────────────────────────

interface PeriodFilterProps {
  preset: PeriodPreset;
  onPresetChange: (p: PeriodPreset) => void;
  customFrom: string;
  onCustomFromChange: (v: string) => void;
  customTo: string;
  onCustomToChange: (v: string) => void;
  compareMode?: CompareMode;
  onCompareModeChange?: (m: CompareMode) => void;
  customCompareFrom?: string;
  onCustomCompareFromChange?: (v: string) => void;
  customCompareTo?: string;
  onCustomCompareToChange?: (v: string) => void;
  period: DateRange;
  comparePeriod?: DateRange | null;
  showCompare?: boolean;
  className?: string;
}

export function PeriodFilter({
  preset, onPresetChange,
  customFrom, onCustomFromChange,
  customTo, onCustomToChange,
  compareMode = "none", onCompareModeChange,
  customCompareFrom = "", onCustomCompareFromChange,
  customCompareTo = "", onCustomCompareToChange,
  period, comparePeriod,
  showCompare = true,
  className = "",
}: PeriodFilterProps) {
  const periodLabel = `${fmtLabel(period.from)} → ${fmtLabel(period.to)}`;
  const comparePeriodLabel = comparePeriod
    ? `${fmtLabel(comparePeriod.from)} → ${fmtLabel(comparePeriod.to)}`
    : null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {/* Sélecteur de période */}
      <Select value={preset} onValueChange={(v) => onPresetChange(v as PeriodPreset)}>
        <SelectTrigger className="w-[210px] h-9 text-sm bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="w-[240px]">
          <SelectGroup>
            <SelectLabel className="text-[10px] uppercase tracking-wider text-slate-400 py-1">Périodes en cours</SelectLabel>
            <SelectItem value="today">Aujourd'hui</SelectItem>
            <SelectItem value="week">Semaine en cours</SelectItem>
            <SelectItem value="month">Mois en cours</SelectItem>
            <SelectItem value="quarter">Trimestre en cours</SelectItem>
            <SelectItem value="semester">Semestre en cours</SelectItem>
            <SelectItem value="year">Année en cours</SelectItem>
          </SelectGroup>
          <SelectGroup>
            <SelectLabel className="text-[10px] uppercase tracking-wider text-slate-400 py-1">À ce jour</SelectLabel>
            <SelectItem value="ytd">YTD — Depuis le 1er janvier</SelectItem>
            <SelectItem value="mtd">MTD — Depuis le 1er du mois</SelectItem>
          </SelectGroup>
          <SelectGroup>
            <SelectLabel className="text-[10px] uppercase tracking-wider text-slate-400 py-1">Périodes précédentes</SelectLabel>
            <SelectItem value="prev-week">Semaine précédente</SelectItem>
            <SelectItem value="prev-month">Mois précédent</SelectItem>
            <SelectItem value="prev-quarter">Trimestre précédent</SelectItem>
            <SelectItem value="prev-semester">Semestre précédent</SelectItem>
            <SelectItem value="prev-year">Année précédente</SelectItem>
          </SelectGroup>
          <SelectGroup>
            <SelectLabel className="text-[10px] uppercase tracking-wider text-slate-400 py-1">Rolling</SelectLabel>
            <SelectItem value="rolling-30">30 derniers jours</SelectItem>
            <SelectItem value="rolling-90">90 derniers jours</SelectItem>
            <SelectItem value="rolling-180">6 derniers mois glissants</SelectItem>
            <SelectItem value="rolling-365">12 derniers mois glissants</SelectItem>
          </SelectGroup>
          <SelectGroup>
            <SelectLabel className="text-[10px] uppercase tracking-wider text-slate-400 py-1">Personnalisée</SelectLabel>
            <SelectItem value="custom">Période personnalisée…</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      {/* Dates custom */}
      {preset === "custom" && (
        <div className="flex items-center gap-1">
          <Input
            type="date" value={customFrom}
            onChange={(e) => onCustomFromChange(e.target.value)}
            className="h-9 w-[140px] text-sm"
          />
          <span className="text-slate-400 text-sm">→</span>
          <Input
            type="date" value={customTo}
            onChange={(e) => onCustomToChange(e.target.value)}
            className="h-9 w-[140px] text-sm"
          />
        </div>
      )}

      {/* Badge période */}
      <Badge
        variant="outline"
        className="text-xs px-3 py-1.5 border-amber-200 text-amber-700 bg-amber-50 font-medium gap-1.5 shrink-0"
      >
        <Calendar className="w-3 h-3" /> {periodLabel}
      </Badge>

      {/* Comparaison */}
      {showCompare && onCompareModeChange && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`h-9 text-xs gap-1.5 ${compareMode !== "none" ? "border-blue-300 bg-blue-50 text-blue-700" : ""}`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              {compareMode === "none" ? "Comparer" : COMPARE_LABELS[compareMode]}
              <ChevronDown className="w-3 h-3 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-2 space-y-1" align="end">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 pt-1 pb-0.5">Mode de comparaison</p>
            {(Object.keys(COMPARE_LABELS) as CompareMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => onCompareModeChange(mode)}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                  compareMode === mode
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "hover:bg-slate-50 text-slate-700"
                }`}
              >
                {COMPARE_LABELS[mode]}
              </button>
            ))}

            {compareMode === "custom" && onCustomCompareFromChange && onCustomCompareToChange && (
              <div className="pt-2 space-y-1.5 border-t mt-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">Période de comparaison</p>
                <div className="flex gap-1 px-1">
                  <Input
                    type="date" value={customCompareFrom}
                    onChange={(e) => onCustomCompareFromChange(e.target.value)}
                    className="h-8 text-xs flex-1"
                  />
                  <Input
                    type="date" value={customCompareTo}
                    onChange={(e) => onCustomCompareToChange(e.target.value)}
                    className="h-8 text-xs flex-1"
                  />
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}

      {/* Badge comparaison active */}
      {comparePeriodLabel && compareMode !== "none" && (
        <Badge
          variant="outline"
          className="text-xs px-3 py-1.5 border-blue-200 text-blue-700 bg-blue-50 font-medium gap-1.5 shrink-0"
        >
          <ArrowLeftRight className="w-3 h-3" />
          vs {comparePeriodLabel}
          {onCompareModeChange && (
            <button
              onClick={() => onCompareModeChange("none")}
              className="ml-1 opacity-60 hover:opacity-100"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </Badge>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CompareBanner — bandeau affiché dans les tabs quand une comparaison est active
// ─────────────────────────────────────────────────────────────────────────────

export function CompareBanner({
  period, comparePeriod, compareMode,
}: {
  period: DateRange;
  comparePeriod: DateRange;
  compareMode: CompareMode;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 text-sm text-blue-800 mb-4">
      <ArrowLeftRight className="w-4 h-4 shrink-0" />
      <span>
        <strong>Comparaison {COMPARE_LABELS[compareMode]} active</strong> —{" "}
        Période principale : {fmtLabel(period.from)} → {fmtLabel(period.to)} ·{" "}
        Période de référence : {fmtLabel(comparePeriod.from)} → {fmtLabel(comparePeriod.to)}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DeltaBadge — affiche l'évolution entre deux valeurs numériques
// ─────────────────────────────────────────────────────────────────────────────

export function DeltaBadge({
  current, compare, format = (n) => n.toLocaleString("fr-FR"),
}: {
  current: number;
  compare: number;
  format?: (n: number) => string;
}) {
  if (!compare && compare !== 0) return null;
  const delta = current - compare;
  const pct = compare !== 0 ? ((delta / Math.abs(compare)) * 100).toFixed(1) : null;
  const up = delta >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${
        up ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
      }`}
    >
      {up ? "▲" : "▼"} {pct !== null ? `${Math.abs(Number(pct))}%` : format(Math.abs(delta))}
    </span>
  );
}
