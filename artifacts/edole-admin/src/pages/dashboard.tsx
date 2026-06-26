import React from "react";
import { Link } from "wouter";
import {
  useGetDashboardKpis,
  useGetDashboardCharts,
  useGetRecentActivity,
  useListProjects,
  useListTasks,
  useListInvoices,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  FileText,
  FileSignature,
  FolderKanban,
  LineChart as LineChartIcon,
  Plus,
  Receipt,
  Settings2,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatFCFA, formatFCFACompact } from "@/lib/format";
import { MoneyAmount } from "@/components/ui/money-amount";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { IntelligenceWidget } from "@/components/IntelligenceWidget";
import { QuickClockWidget } from "@/components/QuickClockWidget";

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function fullDateFr(d = new Date()) {
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function shortDateFr(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function daysBetween(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

const PROJECT_STATUS_LABELS: Record<string, string> = {
  planning: "Planification",
  active: "En cours",
  on_hold: "En attente",
  completed: "Terminés",
  cancelled: "Annulés",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Faible",
  medium: "Normale",
  high: "Élevée",
  urgent: "Urgente",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "#94a3b8",
  medium: "#60a5fa",
  high: "#f59e0b",
  urgent: "#ef4444",
};

const STATUS_COLORS: Record<string, string> = {
  planning: "#94a3b8",
  active: "#f97316",
  on_hold: "#facc15",
  completed: "#22c55e",
  cancelled: "#94a3b8",
};

// ───────────────────────────────────────────────────────────────────────────
// KPI Strip — Configurable Bloomberg-style horizontal bar
// ───────────────────────────────────────────────────────────────────────────

type KpiDirection = "up" | "down" | "flat" | "none";

type KpiData = {
  value: React.ReactNode;
  rawValue?: number;
  direction: KpiDirection;
  pct?: number;
  vs: string;
  highlight?: boolean;
};

type DashboardKpisShape = {
  activeProjects: number;
  totalProjects: number;
  lateProjects: number;
  totalClients: number;
  tasksTodo: number;
  tasksInProgress: number;
  tasksCompleted: number;
  openOpportunities: number;
  totalOpportunities: number;
  wonOpportunities: number;
  pipelineValue: number;
  monthlyRevenue: number;
  outstandingInvoices: number;
  overdueInvoicesCount: number;
  activeRentals: number;
  equipmentAvailable: number;
  unreadMessages: number;
  totalCollaborators: number;
  pendingLeaves: number;
  currency: string;
};

type KpiDef = {
  id: string;
  label: string;
  category: "finance" | "crm" | "operations" | "rh";
  categoryLabel: string;
  compute: (k: DashboardKpisShape) => KpiData;
  defaultVisible: boolean;
};

const KPI_CATALOG: KpiDef[] = [
  // Finance
  {
    id: "encaissements",
    label: "Encaissements (cumul)",
    category: "finance",
    categoryLabel: "Finance",
    defaultVisible: true,
    compute: (k) => ({
      value: formatFCFACompact(k.monthlyRevenue),
      rawValue: k.monthlyRevenue,
      direction: k.monthlyRevenue > 0 ? "up" : "flat",
      vs: "paiements reçus",
    }),
  },
  {
    id: "creances",
    label: "Créances ouvertes",
    category: "finance",
    categoryLabel: "Finance",
    defaultVisible: true,
    compute: (k) => {
      const total = k.monthlyRevenue + k.outstandingInvoices;
      const ratio = total > 0 ? Math.round((k.outstandingInvoices / total) * 100) : 0;
      return {
        value: formatFCFACompact(k.outstandingInvoices),
        rawValue: k.outstandingInvoices,
        direction: k.outstandingInvoices > total * 0.4 ? "down" : k.outstandingInvoices > 0 ? "flat" : "up",
        pct: ratio > 0 ? ratio : undefined,
        vs: "du CA facturé",
      };
    },
  },
  {
    id: "ca_facture",
    label: "CA Total facturé",
    category: "finance",
    categoryLabel: "Finance",
    defaultVisible: true,
    compute: (k) => {
      const total = k.monthlyRevenue + k.outstandingInvoices;
      return {
        value: formatFCFACompact(total),
        rawValue: total,
        direction: total > 0 ? "up" : "flat",
        vs: "CA total facturé",
      };
    },
  },
  {
    id: "taux_recouvrement",
    label: "Taux de recouvrement",
    category: "finance",
    categoryLabel: "Finance",
    defaultVisible: true,
    compute: (k) => {
      const total = k.monthlyRevenue + k.outstandingInvoices;
      const rate = total > 0 ? Math.round((k.monthlyRevenue / total) * 100) : 0;
      return {
        value: `${rate}%`,
        rawValue: rate,
        direction: rate >= 75 ? "up" : rate >= 40 ? "flat" : "down",
        pct: rate > 0 ? rate : undefined,
        vs: "encaissé / facturé",
      };
    },
  },
  {
    id: "factures_retard",
    label: "Factures en retard",
    category: "finance",
    categoryLabel: "Finance",
    defaultVisible: false,
    compute: (k) => ({
      value: k.overdueInvoicesCount,
      rawValue: k.overdueInvoicesCount,
      direction: k.overdueInvoicesCount > 0 ? "down" : "up",
      vs: "factures échues impayées",
    }),
  },
  // CRM / Ventes
  {
    id: "pipeline_crm",
    label: "Pipeline CRM",
    category: "crm",
    categoryLabel: "CRM & Ventes",
    defaultVisible: true,
    compute: (k) => {
      const ratio = k.monthlyRevenue > 0 ? Math.round((k.pipelineValue / k.monthlyRevenue) * 100) : 0;
      return {
        value: formatFCFACompact(k.pipelineValue),
        rawValue: k.pipelineValue,
        direction: k.pipelineValue > 0 ? "up" : "flat",
        pct: ratio > 0 ? ratio : undefined,
        vs: "vs encaissements",
        highlight: true,
      };
    },
  },
  {
    id: "opportunites",
    label: "Opportunités ouvertes",
    category: "crm",
    categoryLabel: "CRM & Ventes",
    defaultVisible: false,
    compute: (k) => ({
      value: k.openOpportunities,
      rawValue: k.openOpportunities,
      direction: k.openOpportunities > 0 ? "up" : "flat",
      vs: `sur ${k.totalClients} clients`,
    }),
  },
  {
    id: "clients",
    label: "Clients totaux",
    category: "crm",
    categoryLabel: "CRM & Ventes",
    defaultVisible: false,
    compute: (k) => ({
      value: k.totalClients,
      rawValue: k.totalClients,
      direction: k.totalClients > 0 ? "up" : "flat",
      vs: "dans le CRM",
    }),
  },
  {
    id: "taux_conversion",
    label: "Taux de conversion",
    category: "crm",
    categoryLabel: "CRM & Ventes",
    defaultVisible: false,
    compute: (k) => {
      const rate = k.totalOpportunities > 0
        ? Math.round((k.wonOpportunities / k.totalOpportunities) * 100)
        : 0;
      return {
        value: `${rate}%`,
        rawValue: rate,
        direction: rate >= 30 ? "up" : rate >= 15 ? "flat" : "down",
        pct: rate > 0 ? rate : undefined,
        vs: `${k.wonOpportunities} opp. gagnées`,
      };
    },
  },
  // Opérations
  {
    id: "projets_actifs",
    label: "Projets actifs",
    category: "operations",
    categoryLabel: "Opérations",
    defaultVisible: true,
    compute: (k) => ({
      value: k.activeProjects,
      rawValue: k.activeProjects,
      direction: k.activeProjects > 0 ? "up" : "flat",
      vs: `sur ${k.totalClients} clients`,
    }),
  },
  {
    id: "projets_retard",
    label: "Projets en retard",
    category: "operations",
    categoryLabel: "Opérations",
    defaultVisible: false,
    compute: (k) => ({
      value: k.lateProjects,
      rawValue: k.lateProjects,
      direction: k.lateProjects > 0 ? "down" : "up",
      vs: "dépassement d'échéance",
    }),
  },
  {
    id: "taches_en_cours",
    label: "Tâches en cours",
    category: "operations",
    categoryLabel: "Opérations",
    defaultVisible: false,
    compute: (k) => ({
      value: k.tasksInProgress,
      rawValue: k.tasksInProgress,
      direction: k.tasksInProgress > 0 ? "up" : "flat",
      vs: `${k.tasksTodo} à faire`,
    }),
  },
  {
    id: "locations_actives",
    label: "Locations actives",
    category: "operations",
    categoryLabel: "Opérations",
    defaultVisible: false,
    compute: (k) => ({
      value: k.activeRentals,
      rawValue: k.activeRentals,
      direction: k.activeRentals > 0 ? "up" : "flat",
      vs: "contrats en cours",
    }),
  },
  {
    id: "equipements_dispo",
    label: "Équipements disponibles",
    category: "operations",
    categoryLabel: "Opérations",
    defaultVisible: false,
    compute: (k) => ({
      value: k.equipmentAvailable,
      rawValue: k.equipmentAvailable,
      direction: k.equipmentAvailable > 0 ? "up" : "flat",
      vs: "prêts à l'emploi",
    }),
  },
  // RH
  {
    id: "collaborateurs",
    label: "Collaborateurs actifs",
    category: "rh",
    categoryLabel: "Ressources Humaines",
    defaultVisible: false,
    compute: (k) => ({
      value: k.totalCollaborators,
      rawValue: k.totalCollaborators,
      direction: k.totalCollaborators > 0 ? "up" : "flat",
      vs: "dans l'effectif",
    }),
  },
  {
    id: "conges_attente",
    label: "Congés en attente",
    category: "rh",
    categoryLabel: "Ressources Humaines",
    defaultVisible: false,
    compute: (k) => ({
      value: k.pendingLeaves,
      rawValue: k.pendingLeaves,
      direction: k.pendingLeaves > 0 ? "flat" : "up",
      vs: "demandes à traiter",
    }),
  },
  {
    id: "messages",
    label: "Messages non lus",
    category: "rh",
    categoryLabel: "Messagerie",
    defaultVisible: false,
    compute: (k) => ({
      value: k.unreadMessages,
      rawValue: k.unreadMessages,
      direction: k.unreadMessages > 0 ? "flat" : "up",
      vs: "conversations actives",
    }),
  },
];

const DEFAULT_KPI_IDS = KPI_CATALOG.filter((k) => k.defaultVisible).map((k) => k.id);

// ─── Config hook (localStorage-backed) ────────────────────────────────────

function useKpiConfig(userId?: string) {
  const key = `gameasu_kpi_config_${userId ?? "default"}`;
  const [orderedIds, setOrderedIds] = React.useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
        const valid = parsed.filter((id) => KPI_CATALOG.some((k) => k.id === id));
        if (valid.length > 0) return valid;
      }
    } catch { /* ignore */ }
    return DEFAULT_KPI_IDS;
  });

  const persist = React.useCallback((ids: string[]) => {
    setOrderedIds(ids);
    try { localStorage.setItem(key, JSON.stringify(ids)); } catch { /* ignore */ }
  }, [key]);

  const toggle = (id: string) => {
    if (orderedIds.includes(id)) {
      if (orderedIds.length <= 1) return;
      persist(orderedIds.filter((x) => x !== id));
    } else {
      persist([...orderedIds, id]);
    }
  };

  const moveUp = (id: string) => {
    const i = orderedIds.indexOf(id);
    if (i <= 0) return;
    const next = [...orderedIds];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    persist(next);
  };

  const moveDown = (id: string) => {
    const i = orderedIds.indexOf(id);
    if (i < 0 || i >= orderedIds.length - 1) return;
    const next = [...orderedIds];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    persist(next);
  };

  const reset = () => persist(DEFAULT_KPI_IDS);

  return { orderedIds, toggle, moveUp, moveDown, reset };
}

// ─── Config sheet ─────────────────────────────────────────────────────────

const CAT_TABS = [
  { id: "all",        label: "Tous" },
  { id: "finance",    label: "Finance" },
  { id: "crm",        label: "CRM & Ventes" },
  { id: "operations", label: "Opérations" },
  { id: "rh",         label: "RH" },
] as const;

function KpiConfigSheet({
  open, onClose, orderedIds, toggle, moveUp, moveDown, reset,
}: {
  open: boolean;
  onClose: () => void;
  orderedIds: string[];
  toggle: (id: string) => void;
  moveUp: (id: string) => void;
  moveDown: (id: string) => void;
  reset: () => void;
}) {
  const [catFilter, setCatFilter] = React.useState<string>("all");

  const visibleInFilter = orderedIds.filter((id) => {
    const def = KPI_CATALOG.find((k) => k.id === id);
    return def && (catFilter === "all" || def.category === catFilter);
  });

  const hiddenInFilter = KPI_CATALOG.filter(
    (k) => !orderedIds.includes(k.id) && (catFilter === "all" || k.category === catFilter)
  );

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Settings2 className="w-4 h-4 text-primary shrink-0" />
            Personnaliser les indicateurs
          </SheetTitle>
          <p className="text-sm text-slate-500 font-normal leading-snug mt-1">
            Activez ou masquez les KPI et réordonnez-les selon vos priorités.
          </p>
        </SheetHeader>

        {/* Category filter */}
        <div className="flex gap-1.5 px-4 py-3 border-b overflow-x-auto shrink-0 bg-slate-50/70">
          {CAT_TABS.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCatFilter(cat.id)}
              className={cn(
                "text-[11px] font-semibold px-3 py-1.5 rounded-full whitespace-nowrap transition-colors",
                catFilter === cat.id
                  ? "bg-primary text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100",
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto">
          {/* Visible section */}
          {visibleInFilter.length > 0 && (
            <div className="px-4 pt-4 pb-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 px-1">
                Affichés ({orderedIds.length})
              </div>
              <div className="space-y-1.5">
                {visibleInFilter.map((id) => {
                  const def = KPI_CATALOG.find((k) => k.id === id)!;
                  const globalIdx = orderedIds.indexOf(id);
                  return (
                    <div key={id} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-800 truncate">{def.label}</div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">{def.categoryLabel}</div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => moveUp(id)}
                          disabled={globalIdx === 0}
                          className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-25 transition-colors"
                          title="Remonter"
                        >
                          <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                        </button>
                        <button
                          onClick={() => moveDown(id)}
                          disabled={globalIdx === orderedIds.length - 1}
                          className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-25 transition-colors"
                          title="Descendre"
                        >
                          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                        </button>
                        <Switch
                          checked={true}
                          onCheckedChange={() => toggle(id)}
                          className="scale-90 ml-1"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Hidden section */}
          {hiddenInFilter.length > 0 && (
            <div className="px-4 pt-1 pb-6">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 px-1">
                Masqués
              </div>
              <div className="space-y-1.5">
                {hiddenInFilter.map((def) => (
                  <div key={def.id} className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-500 truncate">{def.label}</div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">{def.categoryLabel}</div>
                    </div>
                    <Switch
                      checked={false}
                      onCheckedChange={() => toggle(def.id)}
                      className="scale-90 shrink-0"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex items-center justify-between bg-slate-50/70 shrink-0">
          <button
            onClick={reset}
            className="text-sm text-slate-500 hover:text-primary transition-colors hover:underline underline-offset-2"
          >
            Restaurer par défaut
          </button>
          <button
            onClick={onClose}
            className="bg-primary text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
          >
            Terminé
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Trend chip ────────────────────────────────────────────────────────────

function TrendChip({ direction, pct }: { direction: KpiDirection; pct?: number }) {
  if (direction === "none") return null;
  const up   = direction === "up";
  const down = direction === "down";
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[11px] font-bold",
      up   && "text-emerald-600",
      down && "text-rose-600",
      !up && !down && "text-slate-400",
    )}>
      {up   && <span style={{ fontSize: 9 }}>▲</span>}
      {down && <span style={{ fontSize: 9 }}>▼</span>}
      {!up && !down && <span style={{ fontSize: 9 }}>●</span>}
      {pct !== undefined && <span>{pct > 0 ? "+" : ""}{pct}%</span>}
    </span>
  );
}

// ─── The strip itself ──────────────────────────────────────────────────────

function ExecutiveKpiStrip({
  kpis,
  loading,
  orderedIds,
  onConfigure,
}: {
  kpis: DashboardKpisShape | undefined;
  loading: boolean;
  orderedIds: string[];
  onConfigure: () => void;
}) {
  const visibleDefs = orderedIds
    .map((id) => KPI_CATALOG.find((k) => k.id === id))
    .filter((d): d is KpiDef => !!d);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <div className="flex divide-x divide-slate-100" style={{ minWidth: `${visibleDefs.length * 148 + 52}px` }}>
          {visibleDefs.map((def) => {
            const cell = kpis ? def.compute(kpis) : null;
            return (
              <div
                key={def.id}
                className={cn(
                  "flex-1 min-w-[148px] px-4 py-4 flex flex-col",
                  cell?.highlight && "bg-primary/[0.03]",
                )}
              >
                <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400 truncate leading-none">
                  {def.label}
                </div>
                {loading ? (
                  <Skeleton className="h-7 w-24 mt-3" />
                ) : (
                  <div className={cn(
                    "font-black tracking-tight mt-2 leading-none text-[1.4rem] xl:text-[1.55rem]",
                    cell?.highlight ? "text-primary" : "text-slate-900",
                  )}>
                    {cell?.value ?? "—"}
                  </div>
                )}
                <div className="flex items-center gap-1.5 mt-2">
                  {!loading && cell && <TrendChip direction={cell.direction} pct={cell.pct} />}
                  {loading && <Skeleton className="h-3 w-14" />}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 leading-none truncate">
                  {cell?.vs ?? ""}
                </div>
              </div>
            );
          })}

          {/* Config button */}
          <div className="w-12 shrink-0 flex items-center justify-center border-l border-slate-100">
            <button
              onClick={onConfigure}
              title="Personnaliser les indicateurs"
              className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors"
            >
              <Settings2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Section header
// ───────────────────────────────────────────────────────────────────────────

function SectionHeader({
  eyebrow, title, action, icon: Icon,
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4">
      <div>
        {eyebrow && (
          <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-bold">{eyebrow}</div>
        )}
        <div className="flex items-center gap-2 mt-1">
          {Icon && <Icon className="w-5 h-5 text-slate-700" />}
          <h2 className="font-display text-xl md:text-2xl font-bold text-slate-900 tracking-tight">{title}</h2>
        </div>
      </div>
      {action}
    </div>
  );
}

function chartTooltipStyle() {
  return {
    contentStyle: {
      backgroundColor: "white",
      border: "1px solid #e2e8f0",
      borderRadius: 8,
      fontSize: 12,
      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    },
    labelStyle: { color: "#475569", fontWeight: 600, marginBottom: 4 },
  } as const;
}

// ───────────────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const firstName = user?.firstName || "";
  const [kpiConfigOpen, setKpiConfigOpen] = React.useState(false);
  const { orderedIds, toggle, moveUp, moveDown, reset } = useKpiConfig(user?.id);

  const { data: kpis, isLoading: loadingKpis } = useGetDashboardKpis();
  const { data: charts, isLoading: loadingCharts } = useGetDashboardCharts();
  const { data: activity } = useGetRecentActivity({ limit: 6 });
  const { data: projects } = useListProjects();
  const { data: tasks } = useListTasks();
  const { data: invoices } = useListInvoices();

  const projectList = (projects as any)?.data || (projects as any) || [];
  const taskList = (tasks as any)?.data || (tasks as any) || [];
  const invoiceList = (invoices as any)?.data || (invoices as any) || [];

  const monthlyRevenue = Number(kpis?.monthlyRevenue || 0);
  const outstanding = Number(kpis?.outstandingInvoices || 0);
  const pipeline = Number(kpis?.pipelineValue || 0);

  const collectionRate = (() => {
    const total = monthlyRevenue + outstanding;
    if (!total) return 0;
    return Math.round((monthlyRevenue / total) * 100);
  })();

  const upcomingTasks = React.useMemo(() => {
    const now = new Date();
    return [...taskList]
      .filter((t: any) => t.dueDate && t.status !== "done" && !t.deletedAt)
      .map((t: any) => ({ ...t, _due: new Date(t.dueDate), _delta: daysBetween(new Date(t.dueDate), now) }))
      .sort((a, b) => a._due.getTime() - b._due.getTime())
      .slice(0, 6);
  }, [taskList]);

  const overdueInvoices = React.useMemo(() => {
    const now = new Date();
    return [...invoiceList]
      .filter((i: any) => i.status !== "paid" && i.status !== "cancelled" && i.dueDate && new Date(i.dueDate) < now)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);
  }, [invoiceList]);

  const activeProjects = React.useMemo(() => {
    return [...projectList]
      .filter((p: any) => p.status === "active")
      .sort((a, b) => Number(b.budget || 0) - Number(a.budget || 0))
      .slice(0, 5);
  }, [projectList]);

  const revenueData = (charts as any)?.revenueByMonth || [];
  const projectsByStatus = ((charts as any)?.projectsByStatus || []).map((s: any) => ({
    ...s,
    label: PROJECT_STATUS_LABELS[s.status] || s.status,
    color: STATUS_COLORS[s.status] || "#94a3b8",
  }));
  const tasksByPriority = ((charts as any)?.tasksByPriority || []).map((p: any) => ({
    ...p,
    label: PRIORITY_LABELS[p.priority] || p.priority,
    color: PRIORITY_COLORS[p.priority] || "#94a3b8",
  }));

  const tt = chartTooltipStyle();

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">

      {/* ─── Bandeau exécutif ─── */}
      <header className="rounded-2xl overflow-hidden border border-slate-800 shadow-xl"
        style={{ background: "linear-gradient(135deg, #0d1424 0%, #111827 50%, #0f172a 100%)" }}
      >
        <div className="px-7 py-8 md:px-10 md:py-9 relative">
          {/* Accent glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-2/3 h-full"
              style={{ background: "radial-gradient(ellipse at 80% 30%, rgba(243,112,33,0.07) 0%, transparent 60%)" }} />
            <div className="absolute bottom-0 left-0 w-1/2 h-1/2"
              style={{ background: "radial-gradient(ellipse at 20% 100%, rgba(99,102,241,0.05) 0%, transparent 60%)" }} />
          </div>

          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            {/* Left — greeting */}
            <div>
              <div className="text-[10px] uppercase tracking-[0.35em] font-bold"
                style={{ color: "rgba(243,112,33,0.85)" }}>
                Tableau de bord exécutif · {fullDateFr()}
              </div>
              <h1 className="mt-3 text-[2rem] md:text-[2.5rem] font-black tracking-tight text-white leading-none">
                {getGreeting()}{firstName ? `, ${firstName}` : ""}
              </h1>
            </div>

          </div>
        </div>
      </header>

      {/* ─── Barre KPI configurable ─── */}
      <ExecutiveKpiStrip
        kpis={kpis as DashboardKpisShape | undefined}
        loading={loadingKpis}
        orderedIds={orderedIds}
        onConfigure={() => setKpiConfigOpen(true)}
      />
      <KpiConfigSheet
        open={kpiConfigOpen}
        onClose={() => setKpiConfigOpen(false)}
        orderedIds={orderedIds}
        toggle={toggle}
        moveUp={moveUp}
        moveDown={moveDown}
        reset={reset}
      />

      {/* ─── Actions rapides ─── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider shrink-0">Créer :</span>
        {([
          { label: "Facture",  href: "/invoices",  icon: FileText },
          { label: "Client",   href: "/clients",   icon: Building2 },
          { label: "Projet",   href: "/projects",  icon: FolderKanban },
          { label: "Devis",    href: "/proformas", icon: FileSignature },
          { label: "Tâche",    href: "/tasks",     icon: ClipboardList },
        ] as { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[]).map((a) => (
          <Button key={a.label} variant="outline" size="sm"
            className="gap-1.5 h-8 text-[12.5px] border-slate-200 hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-colors"
            asChild>
            <Link href={a.href}>
              <Plus className="w-3 h-3" />
              {a.label}
            </Link>
          </Button>
        ))}
      </div>

      {/* ─── Pointage rapide ─── */}
      <QuickClockWidget />

      {/* ─── Copilote exécutif ─── */}
      <IntelligenceWidget />

      {/* ─── Graphiques ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-slate-200">
          <CardHeader className="pb-3 flex flex-row items-start justify-between">
            <div>
              <CardTitle className="font-display text-lg font-bold tracking-tight">
                Évolution du chiffre d'affaires
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                Facturation vs encaissements consolidés (12 derniers mois)
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-primary" />Encaissé
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />Facturé
              </span>
            </div>
          </CardHeader>
          <CardContent className="h-[300px] pt-2">
            {loadingCharts ? (
              <Skeleton className="w-full h-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false}
                    tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : `${v / 1000}k`}
                  />
                  <RTooltip {...tt} formatter={(v: number, name) => [formatFCFA(v), name === "revenue" ? "Encaissé" : "Facturé"]} />
                  <Area type="monotone" dataKey="invoiced" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" fill="transparent" />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#gradRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg font-bold tracking-tight">
              Répartition des projets
            </CardTitle>
            <p className="text-xs text-slate-500 mt-1">Statut du portefeuille</p>
          </CardHeader>
          <CardContent className="h-[300px] pt-2">
            {loadingCharts ? (
              <Skeleton className="w-full h-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={projectsByStatus.filter((d: any) => d.count > 0)}
                    dataKey="count" nameKey="label"
                    innerRadius={55} outerRadius={90} paddingAngle={2}
                  >
                    {projectsByStatus.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <RTooltip {...tt} formatter={(v: number, name) => [v, name as string]} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle"
                    formatter={(v) => <span className="text-xs text-slate-600">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ─── Charge + Synthèse commerciale ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg font-bold tracking-tight">Charge par priorité</CardTitle>
            <p className="text-xs text-slate-500 mt-1">Tâches et engagements actifs</p>
          </CardHeader>
          <CardContent className="h-[260px]">
            {loadingCharts ? (
              <Skeleton className="w-full h-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tasksByPriority} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis dataKey="label" type="category" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} width={80} />
                  <RTooltip {...tt} formatter={(v: number) => [v, "Tâches"]} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {tasksByPriority.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Synthèse commerciale */}
        <Card className="shadow-sm border-slate-200"
          style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}>
          <CardHeader className="pb-3 flex flex-row items-start justify-between">
            <div>
              <CardTitle className="font-display text-lg font-bold tracking-tight text-white">
                Synthèse commerciale
              </CardTitle>
              <p className="text-xs text-slate-400 mt-1">Pipeline et conversion</p>
            </div>
            <Button variant="secondary" size="sm"
              className="bg-white/10 hover:bg-white/20 text-white border-0" asChild>
              <Link href="/crm">Ouvrir le CRM</Link>
            </Button>
          </CardHeader>
          <CardContent className="text-white space-y-5">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Pipeline qualifié
                </span>
                <span className="font-display text-base sm:text-2xl font-extrabold text-primary">
                  {formatFCFACompact(pipeline)}
                </span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-primary"
                  style={{ width: `${Math.min(100, (pipeline / Math.max(monthlyRevenue || 1, pipeline)) * 100)}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-2 border-t border-white/10">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Opportunités</div>
                <div className="font-display text-xl font-extrabold mt-1">{kpis?.openOpportunities || 0}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Clients actifs</div>
                <div className="font-display text-xl font-extrabold mt-1">{kpis?.totalClients || 0}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Taux recouvrement</div>
                <div className="font-display text-xl font-extrabold mt-1">{collectionRate}%</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ─── Échéances + Alertes ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-slate-200">
          <CardHeader className="pb-3 flex flex-row items-start justify-between">
            <div>
              <CardTitle className="font-display text-lg font-bold tracking-tight flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-primary" /> Échéances à venir
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">Tâches et livrables des 7 prochains jours</p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/tasks">Tout voir <ChevronRight className="w-4 h-4 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-2">
            {upcomingTasks.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">
                Aucune échéance critique à court terme.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {upcomingTasks.map((t: any) => {
                  const overdue = t._delta < 0;
                  const today = t._delta === 0;
                  const soon = t._delta > 0 && t._delta <= 3;
                  return (
                    <Link
                      key={t.id}
                      href={`/tasks/${t.id}`}
                      className="flex items-center gap-4 py-3 hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors"
                    >
                      <div className={cn(
                        "w-1 h-10 rounded-full shrink-0",
                        overdue ? "bg-rose-500" : today ? "bg-amber-500" : soon ? "bg-primary" : "bg-slate-300",
                      )} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">{t.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {PRIORITY_LABELS[t.priority] || t.priority || "Normale"}
                          {t.assigneeName ? ` · ${t.assigneeName}` : ""}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={cn(
                          "text-xs font-bold",
                          overdue ? "text-rose-600" : today ? "text-amber-700" : "text-slate-700",
                        )}>
                          {shortDateFr(t._due)}
                        </div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">
                          {overdue ? `Retard ${Math.abs(t._delta)}j` : today ? "Aujourd'hui" : `Dans ${t._delta}j`}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3 flex flex-row items-start justify-between">
            <div>
              <CardTitle className="font-display text-lg font-bold tracking-tight flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-700" /> Alertes prioritaires
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">Points d'attention immédiate</p>
            </div>
            {overdueInvoices.length > 0 && (
              <Badge variant="destructive" className="font-bold">{overdueInvoices.length}</Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {outstanding > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
                <Receipt className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-900">Créances ouvertes</div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {formatFCFA(outstanding)} en attente d'encaissement
                  </div>
                </div>
              </div>
            )}
            {overdueInvoices.slice(0, 3).map((inv: any) => (
              <Link
                key={inv.id}
                href={`/invoices/${inv.id}`}
                className="flex items-start gap-3 p-3 rounded-lg border border-rose-200 bg-rose-50/60 hover:bg-rose-50 transition-colors"
              >
                <FileText className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-900 truncate">
                    Facture {inv.invoiceNumber || inv.number || `#${(inv.id || "").slice(0, 6)}`}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {formatFCFA(Number(inv.totalAmount || 0))} · {inv.clientName || "Client"} · échue {shortDateFr(inv.dueDate)}
                  </div>
                </div>
              </Link>
            ))}
            {outstanding === 0 && overdueInvoices.length === 0 && (
              <div className="py-6 text-center text-sm text-slate-500">
                Aucune alerte en cours.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ─── Projets stratégiques + Activité ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-slate-200">
          <CardHeader className="pb-3 flex flex-row items-start justify-between">
            <div>
              <CardTitle className="font-display text-lg font-bold tracking-tight flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-primary" /> Projets stratégiques
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">Projets actifs à plus forte valeur</p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/projects">Tous les projets <ChevronRight className="w-4 h-4 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-2">
            {activeProjects.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">Aucun projet actif.</div>
            ) : (
              <div className="space-y-3">
                {activeProjects.map((p: any) => {
                  const progress = Number(p.progress || 0);
                  const budget = Number(p.budget || 0);
                  return (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      className="block p-4 rounded-lg border border-slate-200 hover:border-primary/40 hover:bg-slate-50/60 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-slate-900 truncate group-hover:text-primary transition-colors">
                            {p.name}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {p.clientName || "Client interne"} · {p.location || "—"}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-display text-sm font-extrabold text-slate-900">
                            {formatFCFA(budget)}
                          </div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">budget</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={progress} className="h-1.5 flex-1" />
                        <span className="text-xs font-semibold text-slate-700 w-10 text-right">{progress}%</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg font-bold tracking-tight flex items-center gap-2">
              <LineChartIcon className="w-5 h-5 text-slate-700" /> Activité récente
            </CardTitle>
            <p className="text-xs text-slate-500 mt-1">Derniers événements consolidés</p>
          </CardHeader>
          <CardContent className="pt-2">
            {!activity || (activity as any[]).length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">Aucune activité récente.</div>
            ) : (
              <div className="space-y-3">
                {(activity as any[]).slice(0, 6).map((a) => (
                  <div key={a.id} className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-slate-800 truncate">{a.description}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {a.userName || "Système"} · {shortDateFr(a.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
