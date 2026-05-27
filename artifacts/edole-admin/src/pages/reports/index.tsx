import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  PeriodFilter, usePeriodFilter, CompareBanner, DeltaBadge,
  type DateRange, type CompareMode,
} from "@/components/period-filter";
import {
  Download,
  FileText,
  Wrench,
  Users,
  TrendingUp,
  Calendar,
  Banknote,
  ShoppingCart,
  Briefcase,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  X,
  SlidersHorizontal,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  BarChart2,
  Receipt,
  Building2,
  BookOpen,
  Percent,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// Sélecteur de période — logique déplacée dans src/components/period-filter.tsx

function downloadAuthed(url: string, filename: string) {
  const token = localStorage.getItem("auth_token");
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => {
      if (!r.ok) throw new Error("download failed");
      return r.blob();
    })
    .then((b) => {
      const u = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = u;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(u);
    })
    .catch(() => alert("Échec du téléchargement. Réessayez."));
}

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

type FinanceReport = {
  kpi: {
    invoicedAmount: number; invoicedCount: number; paidCount: number;
    collectedAmount: number; outstandingAmount: number; outstandingCount: number;
    overdueAmount: number; overdueCount: number; collectionRate: number;
  };
  series: Array<{ month: string; facture: number; encaisse: number }>;
  topClients: Array<{ id: string; name: string; amount: number; count: number }>;
  byStatus: Record<string, { count: number; amount: number }>;
  overdueList: Array<{ id: string; reference: string; clientName: string; dueDate: string | null; outstanding: number }>;
};

type SalesReport = {
  kpi: {
    ordersCount: number; ordersAmount: number; proformasCount: number; proformasAmount: number;
    proformasConverted: number; conversionRate: number; pipelineCount: number; pipelineValue: number;
  };
  series: Array<{ month: string; count: number; amount: number }>;
  topClients: Array<{ id: string; name: string; amount: number; count: number }>;
  pipeline: Record<string, { count: number; value: number }>;
};

type ProjectsReport = {
  kpi: {
    totalCount: number; activeCount: number; overdueCount: number;
    newInPeriod: number; completedInPeriod: number;
    totalBudget: number; activeBudget: number; avgProgress: number;
  };
  byStatus: Record<string, number>;
  topProjects: Array<{ id: string; name: string; status: string; progress: number; budget: number; clientName: string; endDate: string | null }>;
  overdueList: Array<{ id: string; name: string; endDate: string | null; progress: number; clientName: string }>;
};

type HrReport = {
  kpi: {
    total: number; active: number; onLeave: number; terminated: number;
    totalHours: number; distinctCollabs: number; lateCount: number; earlyLeaveCount: number;
    unresolvedFlags: number; flagsTotal: number; expiringContracts: number;
  };
  flagsByKind: Record<string, number>;
  topPerformers: Array<{ id: string; name: string; hours: number; minutes: number }>;
  byDepartment: Record<string, number>;
  expiringList: Array<{ id: string; collaborator: string; type: string; endDate: string | null; jobTitle: string | null; contractType?: string }>;
};

type StockReport = {
  generatedAt: string;
  totals: { total: number; available: number; rented: number; maintenance: number };
  byCategory: Record<string, { total: number; available: number; rented: number; maintenance: number }>;
  movements24h: number;
};

type WorkloadEntry = {
  userId: string; name: string; role: string;
  totalTasks: number; activeTasks: number; activeProjects: number; load: number;
};

// ────────────────────────────────────────────────────────────────
// Labels FR
// ────────────────────────────────────────────────────────────────

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", sent: "Envoyée", paid: "Payée", partial: "Partiellement payée",
  overdue: "En retard", cancelled: "Annulée", void: "Annulée",
};
const PROJECT_STATUS_LABELS: Record<string, string> = {
  planning: "En planification", active: "Actif", in_progress: "En cours",
  on_hold: "En pause", completed: "Terminée", cancelled: "Annulée",
};
const PIPELINE_STAGE_LABELS: Record<string, string> = {
  lead: "Prospect", qualified: "Qualifié", proposal: "Proposition",
  negotiation: "Négociation", won: "Gagnée", lost: "Perdue",
};
const FLAG_KIND_LABELS: Record<string, string> = {
  late: "Retard", early_leave: "Départ anticipé",
  missing_clock_out: "Pointage sortie manquant", missing_clock_in: "Pointage entrée manquant",
  long_break: "Pause prolongée", out_of_zone: "Hors zone", duplicate: "Doublon", suspicious: "Suspect",
};
const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super administrateur", admin: "Administrateur",
  manager: "Responsable", commercial: "Commercial", collaborator: "Collaborateur", viewer: "Lecteur",
};

const PIE_COLORS = ["#F26B1F", "#1F2937", "#10B981", "#3B82F6", "#F59E0B", "#8B5CF6", "#EF4444", "#06B6D4"];

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  CDI: "CDI", CDD: "CDD", freelance: "Freelance", stage: "Stage",
  interim: "Intérim", apprenti: "Apprentissage", consultant: "Consultant", other: "Autre",
};
const SUPPLIER_STATUS_LABELS: Record<string, string> = {
  pending: "En attente", paid: "Réglée", overdue: "En retard", partial: "Partiellement réglée", cancelled: "Annulée", draft: "Brouillon",
};

// ────────────────────────────────────────────────────────────────
// Petits composants UI
// ────────────────────────────────────────────────────────────────

function Kpi({ label, value, hint, accent = "default" }: { label: string; value: string; hint?: string; accent?: "default" | "success" | "warning" | "danger" | "primary" }) {
  const tone: Record<string, string> = {
    default: "bg-slate-50 border-slate-100 text-slate-800",
    success: "bg-green-50 border-green-100 text-green-700",
    warning: "bg-amber-50 border-amber-100 text-amber-700",
    danger: "bg-red-50 border-red-100 text-red-700",
    primary: "bg-orange-50 border-orange-100 text-orange-700",
  };
  return (
    <div className={`border p-3 sm:p-4 rounded-xl overflow-hidden min-w-0 ${tone[accent]}`}>
      <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1.5 opacity-80 leading-tight">{label}</div>
      <div className="text-xs sm:text-2xl font-bold leading-tight whitespace-nowrap overflow-hidden text-ellipsis">{value}</div>
      {hint && <div className="text-xs opacity-70 mt-1">{hint}</div>}
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 font-bold text-sm uppercase tracking-wider text-slate-500 mb-3">
      <Icon className="w-4 h-4 text-primary" /> {children}
    </h3>
  );
}

function FilterBar({ children, onClear }: { children: React.ReactNode; onClear?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 p-2.5 bg-slate-50/80 border border-slate-200 rounded-xl flex-1">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
        <SlidersHorizontal className="w-3 h-3" /> Filtres
      </div>
      {children}
      {onClear && (
        <button onClick={onClear} className="ml-auto flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700 transition-colors px-1">
          <X className="w-3 h-3" /> Réinitialiser
        </button>
      )}
    </div>
  );
}

function FilterInput({ placeholder, value, onChange }: { placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 pl-7 pr-6 w-44 text-xs"
      />
      {value && (
        <button onClick={() => onChange("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function FilterSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>; placeholder: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 w-44 text-xs"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

// ════════════════════════════════════════════════════════════════
// PAGE
// ════════════════════════════════════════════════════════════════

export default function ReportsPage() {
  const pf = usePeriodFilter("month");

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rapports & analytique</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pilotage transversal : finance, ventes, projets, RH et parc — exports PDF/Excel inclus.
          </p>
        </div>
        <PeriodFilter
          preset={pf.preset}
          onPresetChange={pf.setPreset}
          customFrom={pf.customFrom}
          onCustomFromChange={pf.setCustomFrom}
          customTo={pf.customTo}
          onCustomToChange={pf.setCustomTo}
          compareMode={pf.compareMode}
          onCompareModeChange={pf.setCompareMode}
          customCompareFrom={pf.customCompareFrom}
          onCustomCompareFromChange={pf.setCustomCompareFrom}
          customCompareTo={pf.customCompareTo}
          onCustomCompareToChange={pf.setCustomCompareTo}
          period={pf.period}
          comparePeriod={pf.comparePeriod}
          showCompare
        />
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid grid-cols-4 md:grid-cols-7 mb-6 h-auto gap-px">
          <TabsTrigger value="overview" className="text-xs"><TrendingUp className="w-3.5 h-3.5 mr-1" />Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="finance" className="text-xs"><Banknote className="w-3.5 h-3.5 mr-1" />Finance</TabsTrigger>
          <TabsTrigger value="sales" className="text-xs"><ShoppingCart className="w-3.5 h-3.5 mr-1" />Ventes</TabsTrigger>
          <TabsTrigger value="purchases" className="text-xs"><Package className="w-3.5 h-3.5 mr-1" />Achats</TabsTrigger>
          <TabsTrigger value="projects" className="text-xs"><Briefcase className="w-3.5 h-3.5 mr-1" />Projets</TabsTrigger>
          <TabsTrigger value="hr" className="text-xs"><Users className="w-3.5 h-3.5 mr-1" />RH</TabsTrigger>
          <TabsTrigger value="parc" className="text-xs"><Wrench className="w-3.5 h-3.5 mr-1" />Parc</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab
            periodQuery={pf.periodQuery}
            comparePeriod={pf.comparePeriod}
            compareMode={pf.compareMode}
            period={pf.period}
          />
        </TabsContent>
        <TabsContent value="finance">
          <FinanceTab
            periodQuery={pf.periodQuery}
            comparePeriod={pf.comparePeriod}
            compareMode={pf.compareMode}
            period={pf.period}
          />
        </TabsContent>
        <TabsContent value="sales">
          <SalesTab
            periodQuery={pf.periodQuery}
            comparePeriod={pf.comparePeriod}
            compareMode={pf.compareMode}
            period={pf.period}
          />
        </TabsContent>
        <TabsContent value="purchases">
          <PurchasesTab
            periodQuery={pf.periodQuery}
            comparePeriod={pf.comparePeriod}
            compareMode={pf.compareMode}
            period={pf.period}
          />
        </TabsContent>
        <TabsContent value="projects">
          <ProjectsTab
            periodQuery={pf.periodQuery}
            comparePeriod={pf.comparePeriod}
            compareMode={pf.compareMode}
            period={pf.period}
          />
        </TabsContent>
        <TabsContent value="hr">
          <HrTab
            periodQuery={pf.periodQuery}
            comparePeriod={pf.comparePeriod}
            compareMode={pf.compareMode}
            period={pf.period}
          />
        </TabsContent>
        <TabsContent value="parc"><ParcTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Vue d'ensemble
// ────────────────────────────────────────────────────────────────

type TabProps = { periodQuery: string; period: DateRange; comparePeriod?: DateRange | null; compareMode?: CompareMode };

function OverviewTab({ periodQuery, period, comparePeriod, compareMode = "none" }: TabProps) {
  const { data, isLoading } = useQuery<{
    finance: { kpi: FinanceReport["kpi"]; series: FinanceReport["series"] };
    sales: { kpi: SalesReport["kpi"]; series: SalesReport["series"] };
    projects: { kpi: ProjectsReport["kpi"] };
    hr: { kpi: HrReport["kpi"] };
  }>({
    queryKey: ["report", "overview", periodQuery],
    queryFn: () => apiFetch(`/api/reports/overview?${periodQuery}`),
  });
  const { data: payables } = useQuery<AgedPayables>({
    queryKey: ["report", "aged-payables"],
    queryFn: () => apiFetch("/api/reports/aged-payables"),
  });
  const { data: purchases } = useQuery<PurchasesReport>({
    queryKey: ["report", "purchases", periodQuery],
    queryFn: () => apiFetch(`/api/reports/purchases?${periodQuery}`),
  });

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      {comparePeriod && compareMode !== "none" && (
        <CompareBanner period={period} comparePeriod={comparePeriod} compareMode={compareMode} />
      )}
      {/* ── Bloc 1 : Revenus & recouvrements ────────────────── */}
      <div>
        <SectionTitle icon={ArrowUpRight}>Revenus & recouvrements</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi label="CA facturé" value={formatFCFA(data.finance.kpi.invoicedAmount)} hint={`${data.finance.kpi.invoicedCount} facture(s)`} accent="primary" />
          <Kpi label="Encaissé" value={formatFCFA(data.finance.kpi.collectedAmount)} hint={`Taux ${data.finance.kpi.collectionRate} %`} accent="success" />
          <Kpi label="Créances en retard" value={formatFCFA(data.finance.kpi.overdueAmount)} hint={`${data.finance.kpi.overdueCount} facture(s)`} accent="danger" />
          <Kpi label="Pipeline commercial" value={formatFCFA(data.sales.kpi.pipelineValue)} hint={`${data.sales.kpi.pipelineCount} opportunité(s)`} />
        </div>
      </div>

      {/* ── Bloc 2 : Dettes & engagements ───────────────────── */}
      <div>
        <SectionTitle icon={ArrowDownRight}>Dettes & engagements fournisseurs</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi label="Achats (période)" value={formatFCFA(purchases?.kpi.totalAmount ?? 0)} hint={`${purchases?.kpi.invoiceCount ?? 0} facture(s)`} accent="default" />
          <Kpi label="Réglé fournisseurs" value={formatFCFA(purchases?.kpi.paidAmount ?? 0)} hint={`Taux ${purchases?.kpi.paymentRate ?? 0} %`} accent="success" />
          <Kpi label="Dettes encours" value={formatFCFA(payables?.totalOutstanding ?? 0)} hint="Toutes échéances" accent="warning" />
          <Kpi label="Dettes en retard" value={formatFCFA(payables?.buckets.filter(b => b.key !== "current").reduce((s, b) => s + b.amount, 0) ?? 0)} hint={`${payables?.buckets.filter(b => b.key !== "current" && b.count > 0).length ?? 0} tranche(s)`} accent="danger" />
        </div>
      </div>

      {/* ── Bloc 3 : Opérations ──────────────────────────────── */}
      <div>
        <SectionTitle icon={Briefcase}>Opérations & RH</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi label="Projets actifs" value={String(data.projects.kpi.activeCount)} hint={`${data.projects.kpi.overdueCount} en retard`} accent={data.projects.kpi.overdueCount > 0 ? "warning" : "default"} />
          <Kpi label="Avancement moyen" value={`${data.projects.kpi.avgProgress} %`} />
          <Kpi label="Effectif actif" value={String(data.hr.kpi.active)} hint={`${data.hr.kpi.onLeave} en congé`} />
          <Kpi label="Anomalies ouvertes" value={String(data.hr.kpi.unresolvedFlags)} hint={`${data.hr.kpi.totalHours} h pointées`} accent={data.hr.kpi.unresolvedFlags > 0 ? "warning" : "default"} />
        </div>
      </div>

      {/* ── Graphique facturation / encaissement ─────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" /> Facturation clients vs encaissements</CardTitle>
          <CardDescription>12 derniers mois — montants en FCFA.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.finance.series}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => Intl.NumberFormat("fr-FR", { notation: "compact" }).format(v as number)} />
                <Tooltip formatter={(v: number) => formatFCFA(v)} />
                <Legend />
                <Line type="monotone" dataKey="facture" name="Facturé" stroke="#F26B1F" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="encaisse" name="Encaissé" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ── Balance âgée synthèse ────────────────────────────── */}
      {payables && payables.totalOutstanding > 0 && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="w-4 h-4 text-red-500" /> Dettes fournisseurs par ancienneté</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {payables.buckets.map((b) => {
                  const clr = b.key === "current" ? "#10b981" : b.key === "1-30" ? "#f59e0b" : b.key === "31-60" ? "#f97316" : b.key === "61-90" ? "#ef4444" : "#991b1b";
                  return (
                    <div key={b.key} className="flex items-center gap-2">
                      <span className="w-20 text-xs shrink-0 text-slate-600">{b.label}</span>
                      <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden">
                        <div className="h-full rounded" style={{ width: `${b.percent}%`, backgroundColor: clr }} />
                      </div>
                      <span className="text-xs font-bold w-28 text-right" style={{ color: clr }}>{formatFCFA(b.amount)}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Users className="w-4 h-4 text-primary" /> Top fournisseurs (encours)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {payables.bySupplier.slice(0, 6).map((s) => (
                  <div key={s.supplier} className="flex items-center justify-between p-2 border rounded text-sm">
                    <span className="font-medium text-slate-800 truncate">{s.supplier}</span>
                    <span className="font-bold text-red-600 shrink-0 ml-2">{formatFCFA(s.total)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Finance
// ────────────────────────────────────────────────────────────────

type AgedReceivables = {
  totalOutstanding: number;
  buckets: Array<{ key: string; label: string; amount: number; count: number; percent: number }>;
  byClient: Array<{ client: string; total: number; buckets: Record<string, number> }>;
  detail: Array<{ id: string; reference: string; client: string; outstanding: number; dueDate: string | null; daysOverdue: number; bucket: string }>;
};

type MasseSalariale = {
  period: { from: string; to: string };
  byMonth: Array<{ period: string; gross: number; net: number; cnssEmployer: number; irpp: number; count: number }>;
  byDepartment: Array<{ department: string; gross: number; net: number; count: number }>;
  kpi: { totalGross: number; totalNet: number; totalCnssEmployer: number; totalIrpp: number; employeeCount: number };
};

type TurnoverReport = {
  period: { from: string; to: string };
  kpi: { totalEffectif: number; exits: number; entries: number; turnoverRate: number; activeCount: number };
  byType: Record<string, number>;
};

type AgedPayables = {
  totalOutstanding: number;
  buckets: Array<{ key: string; label: string; amount: number; count: number; percent: number }>;
  bySupplier: Array<{ supplier: string; total: number }>;
  detail: Array<{ id: string; reference: string; supplier: string; outstanding: number; dueDate: string | null; daysOverdue: number; status: string; bucket: string }>;
};

type PurchasesReport = {
  period: { from: string; to: string };
  kpi: { totalAmount: number; paidAmount: number; outstanding: number; overdueAmount: number; overdueCount: number; taxTotal: number; invoiceCount: number; paymentRate: number };
  series: Array<{ month: string; achat: number; paye: number }>;
  topSuppliers: Array<{ id: string; name: string; amount: number; count: number; paid: number }>;
  byStatus: Record<string, { count: number; amount: number }>;
  overdueList: Array<{ id: string; supplier: string; dueDate: string | null; outstanding: number; status: string }>;
};

type IncomeStatement = {
  revenues: Array<{ code: string; label: string; amount: number }>;
  expenses: Array<{ code: string; label: string; amount: number }>;
  totalRevenue: number;
  totalExpense: number;
  netResult: number;
  series: Array<{ month: string; revenue: number; expense: number; result: number }>;
  hasData: boolean;
};

type BalanceSheet = {
  assets: {
    fixedAssets: Array<{ code: string; label: string; balance: number }>;
    stocks: Array<{ code: string; label: string; balance: number }>;
    receivables: Array<{ code: string; label: string; balance: number }>;
    treasury: Array<{ code: string; label: string; balance: number }>;
    total: number;
  };
  liabilities: {
    equity: Array<{ code: string; label: string; balance: number }>;
    payables: Array<{ code: string; label: string; balance: number }>;
    total: number;
  };
  balance: number;
  hasData: boolean;
};

type CashFlow = {
  hasData: boolean;
  opening: { cashAndEquivalents: number };
  closing: { cashAndEquivalents: number };
  operating: {
    netIncome: number; depreciation: number;
    workingCapitalChanges: { stocks: number; receivablesAndPayables: number };
    total: number;
  };
  investing: { fixedAssetChanges: number; total: number };
  financing: { debtChanges: number; total: number };
  netCashChange: number;
  series: Array<{ month: string; netFlow: number }>;
};

type ReconciliationReport = {
  period: { from: string; to: string };
  accounts: Array<{
    id: string; name: string; bankName: string | null; accountNumber: string | null;
    reconciledCount: number; unreconciledCount: number;
    reconciledAmount: number; unreconciledAmount: number;
    totalIn: number; totalOut: number;
  }>;
  kpi: {
    totalTransactions: number; reconciledCount: number; unreconciledCount: number;
    reconciliationRate: number; totalReconciled: number; totalUnreconciled: number;
    totalDebits: number; totalCredits: number;
  };
  unreconciledList: Array<{
    id: string; bankAccountId: string; bankAccountName: string;
    date: string; label: string; amount: number; reference: string | null;
  }>;
  hasData: boolean;
};

type ManagementReport = {
  period: { from: string; to: string };
  prev: { revenues: number; expenses: number; netResult: number; margin: number; from: string; to: string };
  finance: {
    revenues: number; expenses: number; netResult: number; ebitda: number;
    margin: number; grossProfit: number; grossMargin: number; operatingExpenseRatio: number;
    totalPurchases: number; cashIn: number; cashOut: number;
  };
  liquidity: {
    cashPosition: number; arOutstanding: number; arOverdue: number;
    apOutstanding: number; apOverdue: number; workingCapital: number;
    debtorsDays: number; creditorsDays: number;
  };
  series: Array<{ month: string; revenues: number; expenses: number; netResult: number }>;
  topArClients: Array<{ name: string; outstanding: number; overdue: number; percent: number }>;
  topApSuppliers: Array<{ name: string; outstanding: number; overdue: number; percent: number }>;
  expenseBreakdown: Array<{ code: string; label: string; amount: number; percent: number }>;
  operations: { activeProjects: number; overdueProjects: number; totalBudget: number; avgProgress: number; completedProjects: number; totalProjects: number };
  hr: { activeCollab: number; byContractType: Record<string, number> };
  hasData: boolean;
};

function FinanceTab({ periodQuery, period, comparePeriod, compareMode = "none" }: TabProps) {
  return (
    <Tabs defaultValue="billing" className="w-full">
      <TabsList className="grid grid-cols-3 md:grid-cols-9 mb-4 h-auto gap-px">
        <TabsTrigger value="billing" className="text-xs"><Receipt className="w-3.5 h-3.5 mr-1" />Facturation</TabsTrigger>
        <TabsTrigger value="decaissements" className="text-xs"><ArrowDownRight className="w-3.5 h-3.5 mr-1" />Décaissements</TabsTrigger>
        <TabsTrigger value="balance-gen" className="text-xs"><BookOpen className="w-3.5 h-3.5 mr-1" />Balance</TabsTrigger>
        <TabsTrigger value="income-statement" className="text-xs"><BarChart2 className="w-3.5 h-3.5 mr-1" />Résultat</TabsTrigger>
        <TabsTrigger value="balance-sheet" className="text-xs"><Scale className="w-3.5 h-3.5 mr-1" />Bilan</TabsTrigger>
        <TabsTrigger value="cash-flow" className="text-xs"><TrendingUp className="w-3.5 h-3.5 mr-1" />Flux de tréso.</TabsTrigger>
        <TabsTrigger value="fiscal" className="text-xs"><Percent className="w-3.5 h-3.5 mr-1" />Synthèse fiscale</TabsTrigger>
        <TabsTrigger value="reconciliation" className="text-xs"><CheckCircle2 className="w-3.5 h-3.5 mr-1" />Rapprochement</TabsTrigger>
        <TabsTrigger value="management" className="text-xs"><Briefcase className="w-3.5 h-3.5 mr-1" />Rapport de gestion</TabsTrigger>
      </TabsList>
      <TabsContent value="billing"><BillingSubTab periodQuery={periodQuery} /></TabsContent>
      <TabsContent value="decaissements"><DecaissementSubTab periodQuery={periodQuery} /></TabsContent>
      <TabsContent value="balance-gen"><BalanceGeneraleSubTab periodQuery={periodQuery} /></TabsContent>
      <TabsContent value="income-statement"><IncomeStatementSubTab periodQuery={periodQuery} /></TabsContent>
      <TabsContent value="balance-sheet"><BalanceSheetSubTab periodQuery={periodQuery} /></TabsContent>
      <TabsContent value="cash-flow"><CashFlowSubTab periodQuery={periodQuery} /></TabsContent>
      <TabsContent value="fiscal"><SyntheseFiscaleSubTab periodQuery={periodQuery} /></TabsContent>
      <TabsContent value="reconciliation"><ReconciliationSubTab periodQuery={periodQuery} /></TabsContent>
      <TabsContent value="management"><ManagementSubTab periodQuery={periodQuery} /></TabsContent>
    </Tabs>
  );
}

// ────────────────────────────────────────────────────────────────
// Sous-onglet : Facturation clients
// ────────────────────────────────────────────────────────────────
function BillingSubTab({ periodQuery }: { periodQuery: string }) {
  const [clientSearch, setClientSearch] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState("all");

  const { data, isLoading } = useQuery<FinanceReport>({
    queryKey: ["report", "finance", periodQuery],
    queryFn: () => apiFetch(`/api/reports/finance?${periodQuery}`),
  });

  const filteredTopClients = useMemo(() =>
    (data?.topClients ?? []).filter(c => !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase())),
    [data, clientSearch]);

  const filteredOverdueList = useMemo(() =>
    (data?.overdueList ?? []).filter(o =>
      (!clientSearch || o.clientName.toLowerCase().includes(clientSearch.toLowerCase()) || o.reference.toLowerCase().includes(clientSearch.toLowerCase()))),
    [data, clientSearch]);

  const filteredByStatus = useMemo(() => {
    if (!data) return {};
    if (invoiceStatus === "all") return data.byStatus;
    return Object.fromEntries(Object.entries(data.byStatus).filter(([s]) => s === invoiceStatus));
  }, [data, invoiceStatus]);

  const hasFilters = !!(clientSearch || invoiceStatus !== "all");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <FilterBar onClear={hasFilters ? () => { setClientSearch(""); setInvoiceStatus("all"); } : undefined}>
          <FilterInput placeholder="Client / référence…" value={clientSearch} onChange={setClientSearch} />
          <FilterSelect placeholder="Tous les statuts" value={invoiceStatus} onChange={setInvoiceStatus} options={[
            { value: "draft", label: "Brouillon" }, { value: "sent", label: "Envoyée" },
            { value: "paid", label: "Payée" }, { value: "partial", label: "Partiellement payée" },
            { value: "overdue", label: "En retard" }, { value: "cancelled", label: "Annulée" },
          ]} />
        </FilterBar>
        <Button onClick={() => downloadAuthed(`/api/reports/finance/export.xlsx?${periodQuery}`, `rapport-finance-${new Date().toISOString().slice(0, 10)}.xlsx`)} className="bg-primary hover:bg-primary/90 shrink-0">
          <Download className="w-4 h-4 mr-2" /> Exporter Excel
        </Button>
      </div>

      {/* ── Section 1 : Facturation clients ──────────────── */}
      <SectionTitle icon={Receipt}>Facturation clients</SectionTitle>
      {isLoading || !data ? <Skeleton className="h-64 w-full" /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi label="Facturé" value={formatFCFA(data.kpi.invoicedAmount)} hint={`${data.kpi.invoicedCount} facture(s)`} accent="primary" />
            <Kpi label="Encaissé" value={formatFCFA(data.kpi.collectedAmount)} accent="success" />
            <Kpi label="Encours total" value={formatFCFA(data.kpi.outstandingAmount)} hint={`${data.kpi.outstandingCount} facture(s)`} accent="warning" />
            <Kpi label="En retard" value={formatFCFA(data.kpi.overdueAmount)} hint={`${data.kpi.overdueCount} facture(s)`} accent="danger" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Évolution mensuelle — Facturation & Encaissements</CardTitle>
              <CardDescription>12 derniers mois, montants en FCFA.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.series}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(v) => Intl.NumberFormat("fr-FR", { notation: "compact" }).format(v as number)} />
                    <Tooltip formatter={(v: number) => formatFCFA(v)} />
                    <Legend />
                    <Bar dataKey="facture" name="Facturé" fill="#F26B1F" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="encaisse" name="Encaissé" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top clients {clientSearch && <Badge variant="secondary" className="ml-2 text-xs font-normal">filtrés</Badge>}</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredTopClients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{clientSearch ? "Aucun client ne correspond." : "Aucune facturation sur la période."}</p>
                ) : (
                  <div className="space-y-2">
                    {filteredTopClients.map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-3 border rounded-md">
                        <div>
                          <div className="font-semibold text-sm">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.count} facture(s)</div>
                        </div>
                        <div className="font-bold text-sm">{formatFCFA(c.amount)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Répartition par statut {invoiceStatus !== "all" && <Badge variant="secondary" className="ml-2 text-xs font-normal">{INVOICE_STATUS_LABELS[invoiceStatus]}</Badge>}</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(filteredByStatus).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune facture correspondant aux filtres.</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(filteredByStatus).map(([s, v]) => (
                      <div key={s} className="flex items-center justify-between p-3 border rounded-md">
                        <Badge variant="outline">{INVOICE_STATUS_LABELS[s] || s}</Badge>
                        <div className="text-sm"><strong>{v.count}</strong> · {formatFCFA(v.amount)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {filteredOverdueList.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" /> Factures en retard
                  {clientSearch && <Badge variant="secondary" className="text-xs font-normal">filtrées</Badge>}
                </CardTitle>
                <CardDescription>10 plus gros restes dus.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {filteredOverdueList.map((o) => (
                    <div key={o.id} className="flex items-center justify-between p-3 border rounded-md hover:bg-red-50/30">
                      <div>
                        <div className="font-semibold text-sm">{o.reference}</div>
                        <div className="text-xs text-muted-foreground">{o.clientName} · échéance {o.dueDate ? new Date(o.dueDate).toLocaleDateString("fr-FR") : "—"}</div>
                      </div>
                      <div className="font-bold text-sm text-red-600">{formatFCFA(o.outstanding)}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Sous-onglet : Compte de résultat
// ────────────────────────────────────────────────────────────────
function IncomeStatementSubTab({ periodQuery }: { periodQuery: string }) {
  const { data: incomeStatement, isLoading } = useQuery<IncomeStatement>({
    queryKey: ["report", "income-statement", periodQuery],
    queryFn: () => apiFetch(`/api/reports/finance/income-statement?${periodQuery}`),
  });

  return (
    <div className="space-y-6 pt-4">
      {isLoading ? <Skeleton className="h-64 w-full" /> : !incomeStatement?.hasData ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
          <BarChart2 className="w-8 h-8 opacity-30" />
          <p className="text-sm font-medium">Aucune écriture comptable validée sur la période</p>
          <p className="text-xs">Les produits et charges apparaîtront ici une fois les écritures postées.</p>
        </CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Kpi label="Total produits (cl. 7)" value={formatFCFA(incomeStatement!.totalRevenue)} accent="success" />
            <Kpi label="Total charges (cl. 6)" value={formatFCFA(incomeStatement!.totalExpense)} accent="danger" />
            <Kpi label="Résultat net" value={formatFCFA(incomeStatement!.netResult)} accent={incomeStatement!.netResult >= 0 ? "success" : "danger"}
              hint={incomeStatement!.netResult >= 0 ? "Bénéfice" : "Perte"} />
          </div>
          {incomeStatement!.series.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Produits vs Charges — évolution mensuelle</CardTitle></CardHeader>
              <CardContent>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={incomeStatement!.series}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis tickFormatter={(v) => Intl.NumberFormat("fr-FR", { notation: "compact" }).format(v as number)} />
                      <Tooltip formatter={(v: number) => formatFCFA(v)} />
                      <Legend />
                      <Bar dataKey="revenue" name="Produits" fill="#10B981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expense" name="Charges" fill="#EF4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base text-green-700">Produits (classe 7)</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {incomeStatement!.revenues.map(r => (
                    <div key={r.code} className="flex items-center justify-between p-2 border rounded text-sm">
                      <div><span className="font-mono text-xs text-slate-400 mr-2">{r.code}</span><span>{r.label}</span></div>
                      <span className="font-bold text-green-700 shrink-0 ml-2">{formatFCFA(r.amount)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-2 bg-green-50 rounded text-sm font-bold border-t-2 border-green-200">
                    <span>Total produits</span><span className="text-green-700">{formatFCFA(incomeStatement!.totalRevenue)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base text-red-700">Charges (classe 6)</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {incomeStatement!.expenses.map(e => (
                    <div key={e.code} className="flex items-center justify-between p-2 border rounded text-sm">
                      <div><span className="font-mono text-xs text-slate-400 mr-2">{e.code}</span><span>{e.label}</span></div>
                      <span className="font-bold text-red-700 shrink-0 ml-2">{formatFCFA(e.amount)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-2 bg-red-50 rounded text-sm font-bold border-t-2 border-red-200">
                    <span>Total charges</span><span className="text-red-700">{formatFCFA(incomeStatement!.totalExpense)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Sous-onglet : Bilan
// ────────────────────────────────────────────────────────────────
function BalanceSheetSubTab({ periodQuery }: { periodQuery: string }) {
  const { data: balanceSheet, isLoading } = useQuery<BalanceSheet>({
    queryKey: ["report", "balance-sheet", periodQuery],
    queryFn: () => apiFetch(`/api/reports/finance/balance-sheet?${periodQuery}`),
  });

  return (
    <div className="space-y-6 pt-4">
      {isLoading ? <Skeleton className="h-64 w-full" /> : !balanceSheet?.hasData ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
          <Scale className="w-8 h-8 opacity-30" />
          <p className="text-sm font-medium">Aucune écriture comptable validée</p>
          <p className="text-xs">Le bilan apparaîtra ici une fois les écritures postées.</p>
        </CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Kpi label="Total actif" value={formatFCFA(balanceSheet!.assets.total)} accent="primary" />
            <Kpi label="Total passif" value={formatFCFA(balanceSheet!.liabilities.total)} accent="default" />
          </div>
          {balanceSheet!.balance !== 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50/50">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-700">Déséquilibre actif / passif : <strong>{formatFCFA(Math.abs(balanceSheet!.balance))}</strong> — vérifiez vos écritures.</p>
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-bold text-slate-700 flex items-center gap-2"><ArrowUpRight className="w-4 h-4 text-blue-500" /> ACTIF</h4>
              {[
                { label: "Immobilisations (cl. 2)", items: balanceSheet!.assets.fixedAssets, color: "blue" },
                { label: "Stocks (cl. 3)", items: balanceSheet!.assets.stocks, color: "indigo" },
                { label: "Créances (cl. 4)", items: balanceSheet!.assets.receivables, color: "amber" },
                { label: "Trésorerie (cl. 5)", items: balanceSheet!.assets.treasury, color: "green" },
              ].map(({ label, items, color }) => items.length > 0 && (
                <Card key={label}>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-600">{label}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {items.map(i => (
                        <div key={i.code} className="flex items-center justify-between text-sm p-1.5 hover:bg-slate-50 rounded">
                          <div><span className="font-mono text-xs text-slate-400 mr-2">{i.code}</span>{i.label}</div>
                          <span className={`font-bold text-${color}-600 shrink-0 ml-2`}>{formatFCFA(i.balance)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg font-bold">
                <span>Total actif</span><span className="text-blue-700">{formatFCFA(balanceSheet!.assets.total)}</span>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="font-bold text-slate-700 flex items-center gap-2"><ArrowDownRight className="w-4 h-4 text-red-500" /> PASSIF</h4>
              {[
                { label: "Capitaux propres & emprunts (cl. 1)", items: balanceSheet!.liabilities.equity, color: "purple" },
                { label: "Dettes fournisseurs (cl. 4)", items: balanceSheet!.liabilities.payables, color: "red" },
              ].map(({ label, items, color }) => items.length > 0 && (
                <Card key={label}>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-600">{label}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {items.map(i => (
                        <div key={i.code} className="flex items-center justify-between text-sm p-1.5 hover:bg-slate-50 rounded">
                          <div><span className="font-mono text-xs text-slate-400 mr-2">{i.code}</span>{i.label}</div>
                          <span className={`font-bold text-${color}-600 shrink-0 ml-2`}>{formatFCFA(i.balance)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
              <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg font-bold">
                <span>Total passif</span><span className="text-red-700">{formatFCFA(balanceSheet!.liabilities.total)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Sous-onglet : Flux de trésorerie
// ────────────────────────────────────────────────────────────────
function CashFlowSubTab({ periodQuery }: { periodQuery: string }) {
  const { data, isLoading } = useQuery<CashFlow>({
    queryKey: ["report", "cash-flow", periodQuery],
    queryFn: () => apiFetch(`/api/reports/finance/cash-flow?${periodQuery}`),
  });

  const flowSign = (v: number) => v >= 0 ? "text-green-600" : "text-red-600";

  return (
    <div className="space-y-6 pt-4">
      {isLoading ? <Skeleton className="h-64 w-full" /> : !data?.hasData ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
          <TrendingUp className="w-8 h-8 opacity-30" />
          <p className="text-sm font-medium">Aucune écriture comptable validée sur la période</p>
          <p className="text-xs">Le tableau des flux de trésorerie apparaîtra ici une fois les écritures postées.</p>
        </CardContent></Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi label="Trésorerie ouverture" value={formatFCFA(data!.opening.cashAndEquivalents)} accent="default" />
            <Kpi label="Flux opérationnel" value={formatFCFA(data!.operating.total)} accent={data!.operating.total >= 0 ? "success" : "danger"} />
            <Kpi label="Variation nette" value={formatFCFA(data!.netCashChange)} accent={data!.netCashChange >= 0 ? "success" : "danger"} />
            <Kpi label="Trésorerie clôture" value={formatFCFA(data!.closing.cashAndEquivalents)} accent="primary" />
          </div>

          {/* Tableau détaillé */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><TrendingUp className="w-4 h-4" />Tableau des flux (méthode indirecte)</CardTitle>
              <CardDescription>Reconstitution à partir des écritures comptables postées.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between py-2 px-3 bg-slate-100 rounded font-semibold text-slate-700">
                  <span>A — Activités opérationnelles</span>
                  <span className={flowSign(data!.operating.total)}>{formatFCFA(data!.operating.total)}</span>
                </div>
                <div className="flex justify-between py-1.5 px-6 text-slate-600">
                  <span>Résultat net</span><span>{formatFCFA(data!.operating.netIncome)}</span>
                </div>
                <div className="flex justify-between py-1.5 px-6 text-slate-600">
                  <span>+ Dotations aux amortissements</span><span>{formatFCFA(data!.operating.depreciation)}</span>
                </div>
                <div className="flex justify-between py-1.5 px-6 text-slate-600">
                  <span>Variation stocks</span><span className={flowSign(data!.operating.workingCapitalChanges.stocks)}>{formatFCFA(data!.operating.workingCapitalChanges.stocks)}</span>
                </div>
                <div className="flex justify-between py-1.5 px-6 text-slate-600">
                  <span>Variation créances / dettes</span><span className={flowSign(data!.operating.workingCapitalChanges.receivablesAndPayables)}>{formatFCFA(data!.operating.workingCapitalChanges.receivablesAndPayables)}</span>
                </div>

                <div className="flex justify-between py-2 px-3 bg-slate-100 rounded font-semibold text-slate-700 mt-2">
                  <span>B — Activités d'investissement</span>
                  <span className={flowSign(data!.investing.total)}>{formatFCFA(data!.investing.total)}</span>
                </div>
                <div className="flex justify-between py-1.5 px-6 text-slate-600">
                  <span>Variation immobilisations nettes</span><span className={flowSign(data!.investing.fixedAssetChanges)}>{formatFCFA(data!.investing.fixedAssetChanges)}</span>
                </div>

                <div className="flex justify-between py-2 px-3 bg-slate-100 rounded font-semibold text-slate-700 mt-2">
                  <span>C — Activités de financement</span>
                  <span className={flowSign(data!.financing.total)}>{formatFCFA(data!.financing.total)}</span>
                </div>
                <div className="flex justify-between py-1.5 px-6 text-slate-600">
                  <span>Variation dettes financières</span><span className={flowSign(data!.financing.debtChanges)}>{formatFCFA(data!.financing.debtChanges)}</span>
                </div>

                <div className="flex justify-between py-2.5 px-3 rounded font-bold text-base border-t-2 border-slate-300 mt-2">
                  <span>Variation nette de trésorerie (A+B+C)</span>
                  <span className={flowSign(data!.netCashChange)}>{formatFCFA(data!.netCashChange)}</span>
                </div>
                <div className="flex justify-between py-1.5 px-3 text-slate-600">
                  <span>Trésorerie d'ouverture</span><span>{formatFCFA(data!.opening.cashAndEquivalents)}</span>
                </div>
                <div className="flex justify-between py-2 px-3 bg-primary/10 rounded font-bold border border-primary/20">
                  <span>Trésorerie de clôture</span>
                  <span className="text-primary">{formatFCFA(data!.closing.cashAndEquivalents)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Graphique flux mensuels */}
          {data!.series.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Flux de trésorerie mensuels (cl. 5)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data!.series}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis tickFormatter={(v) => Intl.NumberFormat("fr-FR", { notation: "compact" }).format(v as number)} />
                      <Tooltip formatter={(v: number) => formatFCFA(v)} />
                      <Bar dataKey="netFlow" name="Flux net" fill="#F37021" radius={[4, 4, 0, 0]}
                        label={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Sous-onglet : Synthèse fiscale
// ────────────────────────────────────────────────────────────────
type FiscalSummaryReport = {
  period: { from: string | null; to: string | null };
  tva: { collectee: number; deductible: number; due: number };
  irpp: number; aib: number; ipts: number; cnss: number;
  resultatFiscal: number; revenus: number; charges: number;
};

type TaxItem = { id: string; code: string; name: string; type: string; rate: string | null; isActive: boolean };

function FiscalKPI({ label, value, sub, icon: Icon, accent = "default" }: {
  label: string; value: string; sub?: string; icon: any;
  accent?: "success" | "danger" | "warning" | "default";
}) {
  const colors = {
    success: "bg-emerald-50 border-emerald-200 text-emerald-700",
    danger:  "bg-red-50 border-red-200 text-red-700",
    warning: "bg-amber-50 border-amber-200 text-amber-700",
    default: "bg-slate-50 border-slate-200 text-slate-700",
  };
  return (
    <div className={`border rounded-xl p-4 ${colors[accent]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wider opacity-70">{label}</span>
        <Icon className="w-4 h-4 opacity-60" />
      </div>
      <div className="text-xl font-bold">{value}</div>
      {sub && <div className="text-xs opacity-70 mt-1">{sub}</div>}
    </div>
  );
}

function SyntheseFiscaleSubTab({ periodQuery }: { periodQuery: string }) {
  const fromDate = useMemo(() => {
    const m = periodQuery.match(/from=([^&]+)/);
    return m ? m[1] : new Date().getFullYear() + "-01-01";
  }, [periodQuery]);
  const toDate = useMemo(() => {
    const m = periodQuery.match(/to=([^&]+)/);
    return m ? m[1] : new Date().getFullYear() + "-12-31";
  }, [periodQuery]);

  const { data: summary, isLoading: loadingSummary } = useQuery<FiscalSummaryReport>({
    queryKey: ["fiscal-summary-report", fromDate, toDate],
    queryFn: () => apiFetch(`/api/accounting/fiscal/summary?from=${fromDate}&to=${toDate}`),
  });

  const { data: taxesRes } = useQuery<{ data: TaxItem[] }>({
    queryKey: ["taxes-for-report"],
    queryFn: () => apiFetch("/api/accounting/taxes"),
  });
  const taxes = taxesRes?.data ?? [];
  const isTax = taxes.find(t => t.type === "income_tax" && t.isActive);
  const isRate = isTax ? parseFloat(isTax.rate ?? "28") : 28;
  const isAmount = summary ? (summary.resultatFiscal > 0 ? summary.resultatFiscal * (isRate / 100) : 0) : null;

  if (loadingSummary) return (
    <div className="space-y-4 pt-4">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );

  return (
    <div className="space-y-5 pt-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Synthèse fiscale</h3>
          <p className="text-xs text-muted-foreground">
            Obligations fiscales temps réel · SYSCOHADA TOGO/UEMOA · {fromDate} – {toDate}
          </p>
        </div>
        {isTax && (
          <Badge variant="outline" className="text-xs gap-1">
            <Percent className="w-3 h-3" /> IS {isRate.toFixed(0)}% — {isTax.code}
          </Badge>
        )}
      </div>

      {!summary ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
          <Percent className="w-8 h-8 opacity-30" />
          <p className="text-sm font-medium">Données indisponibles</p>
        </CardContent></Card>
      ) : (
        <>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">TVA & Retenues</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <FiscalKPI label="TVA collectée" value={formatFCFA(summary.tva.collectee)} sub="Compte 443x" icon={TrendingUp} accent="default" />
              <FiscalKPI label="TVA déductible" value={formatFCFA(summary.tva.deductible)} sub="Compte 445x" icon={Receipt} accent="default" />
              <FiscalKPI label="TVA nette due" value={formatFCFA(summary.tva.due)}
                sub={summary.tva.due > 0 ? "À décaisser" : "Crédit de TVA"} icon={Percent}
                accent={summary.tva.due > 0 ? "warning" : "success"} />
              <FiscalKPI label="IRPP retenu" value={formatFCFA(summary.irpp)} sub="Compte 4473x" icon={Users} accent="default" />
              <FiscalKPI label="IPTS" value={formatFCFA(summary.ipts)} sub="Compte 4471x" icon={Building2} accent="default" />
              <FiscalKPI label="AIB" value={formatFCFA(summary.aib)} sub="Compte 4472x" icon={Receipt} accent="default" />
              <FiscalKPI label="CNSS" value={formatFCFA(summary.cnss)} sub="Compte 431x" icon={Users} accent="default" />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Résultat fiscal & IS</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <FiscalKPI label="Revenus (Cl. 7)" value={formatFCFA(summary.revenus)} icon={TrendingUp} accent="success" />
              <FiscalKPI label="Charges (Cl. 6)" value={formatFCFA(summary.charges)} icon={Receipt} accent="default" />
              <FiscalKPI label="Résultat fiscal" value={formatFCFA(summary.resultatFiscal)} icon={Building2}
                accent={summary.resultatFiscal >= 0 ? "success" : "danger"} />
              <FiscalKPI
                label={`IS estimé (${isRate.toFixed(0)}%${isTax ? ` — ${isTax.code}` : " — défaut"})`}
                value={isAmount !== null ? formatFCFA(isAmount) : "—"}
                sub={summary.resultatFiscal <= 0 ? "Résultat négatif" : "Projection sur résultat courant"}
                icon={Percent}
                accent={isAmount && isAmount > 0 ? "warning" : "default"}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            {isTax
              ? <>Taux IS lu depuis le référentiel fiscal ({isTax.name} — {isTax.code}). Modifiable dans <strong>Comptabilité → Fiscal → Référentiel fiscal</strong>.</>
              : <>Taux IS par défaut 28%. Configurez vos taxes dans <strong>Comptabilité → Fiscal → Référentiel fiscal</strong>.</>
            }
          </p>
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Sous-onglet : Balance générale
// ────────────────────────────────────────────────────────────────
type BalanceRow = { code: string; label: string; classNum: number; totalDebit: number; totalCredit: number; soldDebit: number; soldCredit: number };
type BalanceGenReport = { data: BalanceRow[]; totalDebit: number; totalCredit: number };

const CLASS_LABELS: Record<number, string> = {
  1: "Classe 1 — Capitaux", 2: "Classe 2 — Actif immobilisé",
  3: "Classe 3 — Stocks", 4: "Classe 4 — Tiers",
  5: "Classe 5 — Trésorerie", 6: "Classe 6 — Charges",
  7: "Classe 7 — Produits", 8: "Classe 8 — Comptes spéciaux",
};

function BalanceGeneraleSubTab({ periodQuery }: { periodQuery: string }) {
  const [classFilter, setClassFilter] = useState("all");
  const [search, setSearch] = useState("");

  const fromDate = useMemo(() => {
    const m = periodQuery.match(/from=([^&]+)/);
    return m ? m[1] : new Date().getFullYear() + "-01-01";
  }, [periodQuery]);
  const toDate = useMemo(() => {
    const m = periodQuery.match(/to=([^&]+)/);
    return m ? m[1] : new Date().getFullYear() + "-12-31";
  }, [periodQuery]);

  const { data, isLoading } = useQuery<BalanceGenReport>({
    queryKey: ["balance-gen", fromDate, toDate],
    queryFn: () => apiFetch(`/api/accounting/balance?from=${fromDate}&to=${toDate}`),
  });

  const rows = useMemo(() => {
    if (!data) return [];
    return data.data.filter(r => {
      const matchClass = classFilter === "all" || String(r.classNum) === classFilter;
      const matchSearch = !search || r.code.includes(search) || r.label.toLowerCase().includes(search.toLowerCase());
      return matchClass && matchSearch;
    });
  }, [data, classFilter, search]);

  const isBalanced = data ? Math.abs(data.totalDebit - data.totalCredit) < 0.01 : false;

  if (isLoading) return <div className="space-y-3 pt-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Balance générale des comptes</h3>
          <p className="text-xs text-muted-foreground">Cumuls débits/crédits et soldes SYSCOHADA · {fromDate} – {toDate}</p>
        </div>
        {data && (
          <Badge variant={isBalanced ? "default" : "destructive"} className="text-xs">
            {isBalanced ? "✓ Balance équilibrée" : "⚠ Déséquilibre détecté"}
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Compte ou libellé…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 px-3 text-sm border rounded-md w-48 focus:outline-none focus:ring-1 focus:ring-amber-400"
        />
        <select
          value={classFilter}
          onChange={e => setClassFilter(e.target.value)}
          className="h-8 px-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-amber-400"
        >
          <option value="all">Toutes les classes</option>
          {[1, 2, 3, 4, 5, 6, 7, 8].map(c => <option key={c} value={String(c)}>Classe {c}</option>)}
        </select>
        {(search || classFilter !== "all") && (
          <button onClick={() => { setSearch(""); setClassFilter("all"); }} className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground border rounded-md">
            Réinitialiser
          </button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 w-24">Compte</th>
                  <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500">Libellé</th>
                  <th className="py-2.5 px-4 text-right text-xs font-semibold text-slate-500">Total débit</th>
                  <th className="py-2.5 px-4 text-right text-xs font-semibold text-slate-500">Total crédit</th>
                  <th className="py-2.5 px-4 text-right text-xs font-semibold text-slate-500">Solde débiteur</th>
                  <th className="py-2.5 px-4 text-right text-xs font-semibold text-slate-500">Solde créditeur</th>
                </tr>
              </thead>
              <tbody>
                {!data || rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-slate-400 italic">
                      {!data ? "Aucun mouvement sur la période" : "Aucun compte ne correspond aux filtres"}
                    </td>
                  </tr>
                ) : (
                  (() => {
                    const groups: Record<number, BalanceRow[]> = {};
                    for (const r of rows) {
                      if (!groups[r.classNum]) groups[r.classNum] = [];
                      groups[r.classNum].push(r);
                    }
                    return Object.entries(groups).sort(([a], [b]) => Number(a) - Number(b)).map(([cls, items]) => (
                      <React.Fragment key={cls}>
                        <tr className="bg-amber-50 border-t border-amber-200">
                          <td colSpan={6} className="py-1.5 px-4 text-xs font-bold text-amber-800 uppercase tracking-wide">
                            {CLASS_LABELS[Number(cls)] ?? `Classe ${cls}`}
                          </td>
                        </tr>
                        {items.map(r => (
                          <tr key={r.code} className="border-t border-slate-100 hover:bg-slate-50">
                            <td className="py-2 px-4 font-mono font-semibold text-slate-700">{r.code}</td>
                            <td className="py-2 px-4 text-slate-600">{r.label}</td>
                            <td className="py-2 px-4 text-right font-mono tabular-nums text-slate-700">{formatFCFA(r.totalDebit)}</td>
                            <td className="py-2 px-4 text-right font-mono tabular-nums text-slate-700">{formatFCFA(r.totalCredit)}</td>
                            <td className="py-2 px-4 text-right font-mono tabular-nums text-blue-700">{r.soldDebit ? formatFCFA(r.soldDebit) : "—"}</td>
                            <td className="py-2 px-4 text-right font-mono tabular-nums text-red-600">{r.soldCredit ? formatFCFA(r.soldCredit) : "—"}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ));
                  })()
                )}
              </tbody>
              {data && rows.length > 0 && (
                <tfoot className="bg-slate-100 border-t-2 border-amber-400">
                  <tr>
                    <td colSpan={2} className="py-2.5 px-4 text-sm font-bold text-slate-700 text-right">Totaux généraux</td>
                    <td className="py-2.5 px-4 text-right font-bold font-mono tabular-nums text-slate-800">{formatFCFA(data.totalDebit)}</td>
                    <td className="py-2.5 px-4 text-right font-bold font-mono tabular-nums text-slate-800">{formatFCFA(data.totalCredit)}</td>
                    <td colSpan={2} className="py-2.5 px-4 text-right text-xs font-semibold text-slate-500">
                      {isBalanced ? "✓ Équilibrée" : `Écart : ${formatFCFA(Math.abs(data.totalDebit - data.totalCredit))}`}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Sous-onglet : Décaissements
// ────────────────────────────────────────────────────────────────
type DecaissementsReport = {
  period: { from: string; to: string };
  total: number;
  count: number;
  topSuppliers: Array<{ name: string; total: number; count: number; percent: number }>;
  methodBreakdown: Array<{ method: string; amount: number; percent: number }>;
  series: Array<{ month: string; amount: number }>;
  transactions: Array<{ id: string; date: string; supplier: string; invoiceRef: string; method: string; amount: number; reference: string }>;
  hasData: boolean;
};

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Virement bancaire", cash: "Espèces", check: "Chèque",
  mobile_money: "Mobile Money", card: "Carte bancaire", other: "Autre",
};

function DecaissementSubTab({ periodQuery }: { periodQuery: string }) {
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");

  const { data, isLoading } = useQuery<DecaissementsReport>({
    queryKey: ["report", "decaissements", periodQuery],
    queryFn: () => apiFetch(`/api/reports/finance/decaissements?${periodQuery}`),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.transactions.filter(t => {
      const matchSearch = !search || t.supplier.toLowerCase().includes(search.toLowerCase()) || t.invoiceRef.toLowerCase().includes(search.toLowerCase()) || t.reference.toLowerCase().includes(search.toLowerCase());
      const matchMethod = methodFilter === "all" || t.method === methodFilter;
      return matchSearch && matchMethod;
    });
  }, [data, search, methodFilter]);

  if (isLoading) return <div className="space-y-4 pt-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;

  if (!data) return (
    <Card className="mt-4"><CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
      <ArrowDownRight className="w-8 h-8 opacity-30" />
      <p className="text-sm font-medium">Données indisponibles</p>
    </CardContent></Card>
  );

  const periodLabel = `${new Date(data.period.from).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })} – ${new Date(data.period.to).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`;
  const hasFilters = !!(search || methodFilter !== "all");

  return (
    <div className="space-y-6 pt-4">

      {/* KPIs rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Total décaissé" value={formatFCFA(data.total)} accent="danger" hint={`${data.count} paiement${data.count > 1 ? "s" : ""}`} />
        <Kpi label="Fournisseurs payés" value={String(data.topSuppliers.length)} accent="default" />
        <Kpi label="Montant moyen" value={data.count > 0 ? formatFCFA(Math.round(data.total / data.count)) : "—"} accent="default" />
        <Kpi label="Mode principal" value={data.methodBreakdown[0] ? (METHOD_LABELS[data.methodBreakdown[0].method] ?? data.methodBreakdown[0].method) : "—"} accent="default" hint={data.methodBreakdown[0] ? `${data.methodBreakdown[0].percent}%` : undefined} />
      </div>

      {!data.hasData ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
          <ArrowDownRight className="w-8 h-8 opacity-30" />
          <p className="text-sm font-medium">Aucun décaissement sur la période</p>
          <p className="text-xs text-center max-w-xs">Les paiements fournisseurs enregistrés apparaîtront ici.</p>
        </CardContent></Card>
      ) : (
        <>
          {/* Graphique mensuel + ventilation méthode */}
          <div className="grid md:grid-cols-2 gap-4">
            {data.series.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Décaissements mensuels</CardTitle>
                  <CardDescription>{periodLabel}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.series} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={v => Intl.NumberFormat("fr-FR", { notation: "compact" }).format(v as number)} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: number) => formatFCFA(v)} />
                        <Bar dataKey="amount" name="Décaissements" fill="#F97316" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {data.methodBreakdown.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Répartition par mode de paiement</CardTitle>
                  <CardDescription>Total : {formatFCFA(data.total)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2.5 mt-1">
                    {data.methodBreakdown.map(m => (
                      <div key={m.method} className="flex items-center gap-3">
                        <span className="text-sm text-slate-600 w-36 shrink-0">{METHOD_LABELS[m.method] ?? m.method}</span>
                        <div className="flex-1">
                          <div className="h-2 bg-slate-100 rounded-full">
                            <div className="h-2 rounded-full bg-orange-400" style={{ width: `${Math.min(m.percent, 100)}%` }} />
                          </div>
                        </div>
                        <span className="text-sm font-semibold tabular-nums w-28 text-right">{formatFCFA(m.amount)}</span>
                        <span className="text-xs text-slate-400 w-8 text-right">{m.percent}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Top fournisseurs */}
          {data.topSuppliers.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  Top fournisseurs payés
                </CardTitle>
                <CardDescription>Montants décaissés par fournisseur sur la période</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="py-2 px-4 text-left text-xs font-semibold text-slate-500">Fournisseur</th>
                      <th className="py-2 px-4 text-center text-xs font-semibold text-slate-500">Paiements</th>
                      <th className="py-2 px-4 text-right text-xs font-semibold text-slate-500">Montant</th>
                      <th className="py-2 px-4 text-right text-xs font-semibold text-slate-500">% Total</th>
                      <th className="py-2 px-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topSuppliers.map(s => (
                      <tr key={s.name} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-medium text-slate-800">{s.name}</td>
                        <td className="py-2.5 px-4 text-center text-slate-500">{s.count}</td>
                        <td className="py-2.5 px-4 text-right font-semibold tabular-nums">{formatFCFA(s.total)}</td>
                        <td className="py-2.5 px-4 text-right text-slate-500 tabular-nums">{s.percent}%</td>
                        <td className="py-2.5 px-4">
                          <div className="h-1.5 bg-slate-100 rounded-full w-20 ml-auto">
                            <div className="h-1.5 rounded-full bg-orange-400" style={{ width: `${Math.min(s.percent, 100)}%` }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Journal des transactions */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-sm">Journal des décaissements</CardTitle>
                  <CardDescription>{data.count} paiement{data.count > 1 ? "s" : ""} sur la période</CardDescription>
                </div>
                <FilterBar onClear={hasFilters ? () => { setSearch(""); setMethodFilter("all"); } : undefined}>
                  <FilterInput placeholder="Fournisseur, référence…" value={search} onChange={setSearch} />
                  <FilterSelect placeholder="Tous les modes" value={methodFilter} onChange={setMethodFilter}
                    options={data.methodBreakdown.map(m => ({ value: m.method, label: METHOD_LABELS[m.method] ?? m.method }))} />
                </FilterBar>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">Aucun résultat pour ces filtres.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="py-2 px-4 text-left text-xs font-semibold text-slate-500">Date</th>
                      <th className="py-2 px-4 text-left text-xs font-semibold text-slate-500">Fournisseur</th>
                      <th className="py-2 px-4 text-left text-xs font-semibold text-slate-500">Réf. facture</th>
                      <th className="py-2 px-4 text-left text-xs font-semibold text-slate-500">Mode</th>
                      <th className="py-2 px-4 text-left text-xs font-semibold text-slate-500">Référence</th>
                      <th className="py-2 px-4 text-right text-xs font-semibold text-slate-500">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(t => (
                      <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2.5 px-4 text-slate-500 tabular-nums">{new Date(t.date).toLocaleDateString("fr-FR")}</td>
                        <td className="py-2.5 px-4 font-medium text-slate-800">{t.supplier}</td>
                        <td className="py-2.5 px-4 text-slate-500 font-mono text-xs">{t.invoiceRef}</td>
                        <td className="py-2.5 px-4">
                          <Badge variant="outline" className="text-xs">{METHOD_LABELS[t.method] ?? t.method}</Badge>
                        </td>
                        <td className="py-2.5 px-4 text-slate-400 text-xs font-mono">{t.reference || "—"}</td>
                        <td className="py-2.5 px-4 text-right font-semibold tabular-nums text-red-600">{formatFCFA(t.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t">
                      <td colSpan={5} className="py-2 px-4 text-sm font-semibold text-slate-600">Total affiché</td>
                      <td className="py-2 px-4 text-right font-bold tabular-nums text-red-700">{formatFCFA(filtered.reduce((s, t) => s + t.amount, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Sous-onglet : Rapprochement bancaire
// ────────────────────────────────────────────────────────────────
function ReconciliationSubTab({ periodQuery }: { periodQuery: string }) {
  const { data, isLoading } = useQuery<ReconciliationReport>({
    queryKey: ["report", "reconciliation", periodQuery],
    queryFn: () => apiFetch(`/api/reports/finance/reconciliation?${periodQuery}`),
  });

  return (
    <div className="space-y-6 pt-4">
      {isLoading ? <Skeleton className="h-64 w-full" /> : !data?.hasData ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
          <CheckCircle2 className="w-8 h-8 opacity-30" />
          <p className="text-sm font-medium">Aucun mouvement bancaire sur la période</p>
          <p className="text-xs">Importez des relevés bancaires pour démarrer le rapprochement.</p>
        </CardContent></Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi label="Total mouvements" value={String(data!.kpi.totalTransactions)} accent="default" hint="sur la période" />
            <Kpi label="Taux rapprochement" value={`${data!.kpi.reconciliationRate}%`} accent={data!.kpi.reconciliationRate >= 90 ? "success" : data!.kpi.reconciliationRate >= 70 ? "warning" : "danger"} />
            <Kpi label="Rapprochés" value={formatFCFA(data!.kpi.totalReconciled)} hint={`${data!.kpi.reconciledCount} opération(s)`} accent="success" />
            <Kpi label="Non rapprochés" value={formatFCFA(data!.kpi.totalUnreconciled)} hint={`${data!.kpi.unreconciledCount} opération(s)`} accent={data!.kpi.unreconciledCount > 0 ? "danger" : "default"} />
          </div>

          {/* Par compte bancaire */}
          {data!.accounts.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Synthèse par compte bancaire</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data!.accounts.map(acc => (
                    <div key={acc.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="font-semibold text-sm">{acc.name}</span>
                          {acc.bankName && <span className="text-xs text-muted-foreground ml-2">{acc.bankName}</span>}
                          {acc.accountNumber && <span className="font-mono text-xs text-slate-400 ml-2">{acc.accountNumber}</span>}
                        </div>
                        <Badge variant={acc.unreconciledCount === 0 ? "default" : "destructive"} className="text-xs">
                          {acc.unreconciledCount === 0 ? "Équilibré" : `${acc.unreconciledCount} à traiter`}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs text-center">
                        <div className="bg-green-50 p-2 rounded">
                          <div className="font-bold text-green-700">{formatFCFA(acc.totalIn)}</div>
                          <div className="text-slate-500">Entrées</div>
                        </div>
                        <div className="bg-red-50 p-2 rounded">
                          <div className="font-bold text-red-700">{formatFCFA(acc.totalOut)}</div>
                          <div className="text-slate-500">Sorties</div>
                        </div>
                        <div className="bg-emerald-50 p-2 rounded">
                          <div className="font-bold text-emerald-700">{acc.reconciledCount}</div>
                          <div className="text-slate-500">Rapprochés</div>
                        </div>
                        <div className={`p-2 rounded ${acc.unreconciledCount > 0 ? "bg-red-50" : "bg-slate-50"}`}>
                          <div className={`font-bold ${acc.unreconciledCount > 0 ? "text-red-600" : "text-slate-400"}`}>{acc.unreconciledCount}</div>
                          <div className="text-slate-500">En attente</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Liste des non-rapprochés */}
          {data!.unreconciledList.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Mouvements non rapprochés
                  <Badge variant="secondary" className="text-xs ml-1">{data!.kpi.unreconciledCount}</Badge>
                </CardTitle>
                <CardDescription>Opérations bancaires sans écriture comptable correspondante.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data!.unreconciledList.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 border rounded-md hover:bg-amber-50/30">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm truncate">{t.label}</span>
                          <Badge variant="outline" className="text-xs shrink-0">{t.bankAccountName}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">{t.date} {t.reference ? `· réf. ${t.reference}` : ""}</div>
                      </div>
                      <div className={`font-bold text-sm shrink-0 ml-4 ${t.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {t.amount >= 0 ? "+" : ""}{formatFCFA(t.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Sous-onglet : Rapport de gestion
// ────────────────────────────────────────────────────────────────
// ── Helpers rapport de gestion ──────────────────────────────────
function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} Mrd`;
  if (abs >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)} M`;
  if (abs >= 1_000)         return `${(n / 1_000).toFixed(1)} k`;
  return n.toLocaleString("fr-FR");
}

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((curr - prev) / Math.abs(prev)) * 1000) / 10;
}

function TrendBadge({ curr, prev, higherIsBetter = true }: { curr: number; prev: number; higherIsBetter?: boolean }) {
  const pct = pctChange(curr, prev);
  if (pct === null) return <span className="text-xs text-slate-400">N/A vs N-1</span>;
  const isPositive = higherIsBetter ? pct >= 0 : pct <= 0;
  const sign = pct >= 0 ? "+" : "";
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded ${isPositive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
      {pct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {sign}{pct}% vs N-1
    </span>
  );
}

function HealthRow({ label, value, prev, target, targetLabel, importance, higherIsBetter = true }: {
  label: string; value: string | number; prev: string | number; target?: string; targetLabel?: string;
  importance: "Critique" | "Élevé" | "Moyen" | "Faible"; higherIsBetter?: boolean;
}) {
  const numVal = typeof value === "number" ? value : parseFloat(String(value));
  const numPrev = typeof prev === "number" ? prev : parseFloat(String(prev));
  const change = !isNaN(numVal) && !isNaN(numPrev) ? pctChange(numVal, numPrev) : null;
  const improving = change !== null ? (higherIsBetter ? change >= 0 : change <= 0) : null;
  const dot = improving === null ? "bg-slate-200" : improving ? "bg-emerald-400" : "bg-red-400";
  const importanceColor: Record<string, string> = {
    "Critique": "text-red-600 bg-red-50", "Élevé": "text-amber-600 bg-amber-50",
    "Moyen": "text-blue-600 bg-blue-50", "Faible": "text-slate-500 bg-slate-50",
  };
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
      <td className="py-2 px-3 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
        <span className="text-sm text-slate-700">{label}</span>
      </td>
      <td className="py-2 px-3 text-right text-sm font-semibold tabular-nums">{typeof value === "number" ? formatFCFA(value) : value}</td>
      <td className="py-2 px-3 text-right text-sm text-slate-500 tabular-nums">{typeof prev === "number" ? formatFCFA(prev) : prev}</td>
      <td className="py-2 px-3 text-center text-xs text-slate-400">{target ?? "—"}</td>
      <td className="py-2 px-3 text-center">
        {change !== null ? (
          <span className={`text-xs font-medium ${improving ? "text-emerald-600" : "text-red-500"}`}>
            {change >= 0 ? "+" : ""}{change}%
          </span>
        ) : <span className="text-xs text-slate-300">—</span>}
      </td>
      <td className="py-2 px-3">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${importanceColor[importance] ?? "text-slate-500"}`}>{importance}</span>
      </td>
    </tr>
  );
}

function ManagementSubTab({ periodQuery }: { periodQuery: string }) {
  const { data, isLoading } = useQuery<ManagementReport>({
    queryKey: ["report", "management", periodQuery],
    queryFn: () => apiFetch(`/api/reports/management?${periodQuery}`),
  });

  const generatedAt = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  if (isLoading) return (
    <div className="space-y-4 pt-4">
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );

  if (!data) return (
    <Card className="mt-4"><CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
      <Briefcase className="w-8 h-8 opacity-30" />
      <p className="text-sm font-medium">Données indisponibles</p>
    </CardContent></Card>
  );

  const d = data;
  const f = d.finance;
  const liq = d.liquidity;
  const ops = d.operations;
  const periodLabel = `${new Date(d.period.from).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })} – ${new Date(d.period.to).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`;

  // Insights auto-générés (résumé exécutif)
  const revenueChange = pctChange(f.revenues, d.prev.revenues);
  const expenseChange = pctChange(f.expenses, d.prev.expenses);
  const netChange = pctChange(f.netResult, d.prev.netResult);

  // ── Signaux de statut pour le résumé exécutif ────────────────
  const revenueSignal: "positive" | "neutral" | "warning" =
    revenueChange === null ? "neutral" : revenueChange >= 5 ? "positive" : revenueChange >= 0 ? "neutral" : "warning";
  const profitSignal: "positive" | "neutral" | "warning" =
    f.netResult > 0 ? "positive" : f.netResult === 0 ? "neutral" : "warning";
  const liquiditySignal: "positive" | "neutral" | "warning" =
    liq.cashPosition >= 0 && liq.workingCapital >= 0 ? "positive" : liq.cashPosition < 0 ? "warning" : "neutral";
  const opsSignal: "positive" | "neutral" | "warning" =
    ops.overdueProjects === 0 && ops.avgProgress >= 50 ? "positive" : ops.overdueProjects > 0 ? "warning" : "neutral";

  const signalConfig = {
    positive: { dot: "bg-emerald-400", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Situation favorable" },
    neutral:  { dot: "bg-sky-400",     badge: "bg-sky-50 text-sky-700 border-sky-200",             label: "Situation stable" },
    warning:  { dot: "bg-amber-400",   badge: "bg-amber-50 text-amber-700 border-amber-200",       label: "Point d'attention" },
  };

  // ── Textes narratifs — ton direction générale ─────────────────
  const revHeadline = revenueChange !== null
    ? revenueChange >= 0
      ? `Activité commerciale en progression de ${revenueChange}% sur la période`
      : `Activité commerciale en recul de ${Math.abs(revenueChange)}% par rapport à N-1`
    : f.revenues > 0
      ? `Activité commerciale active sur la période`
      : `Aucune donnée de produits enregistrée sur la période`;

  const revBody = (() => {
    const base = f.revenues > 0
      ? `Les produits de la période s'établissent à ${formatFCFA(f.revenues)}.`
      : `Aucun produit comptabilisé sur cette période — les données d'encaissements issus des factures indiquent toutefois une activité en cours.`;
    const comp = revenueChange !== null && d.prev.revenues > 0
      ? ` La période N-1 affichait ${formatFCFA(d.prev.revenues)}, soit un écart de ${revenueChange >= 0 ? "+" : ""}${revenueChange}%.`
      : "";
    const arNote = liq.arOutstanding > 0
      ? ` À noter : ${formatFCFA(liq.arOutstanding)} de créances clients restent à encaisser${liq.arOverdue > 0 ? `, dont ${formatFCFA(liq.arOverdue)} présentent un dépassement d'échéance` : ""}.`
      : "";
    return base + comp + arNote;
  })();

  const profitHeadline = f.netResult > 0
    ? `Résultat bénéficiaire — marge nette de ${f.margin}%`
    : f.netResult === 0
      ? `Résultat à l'équilibre sur la période`
      : `Résultat déficitaire — marge nette de ${f.margin}%`;

  const profitBody = (() => {
    const net = f.netResult !== 0
      ? `Le résultat net de la période est de ${formatFCFA(f.netResult)}`
      : `Le résultat net est à l'équilibre`;
    const margin = f.margin !== 0 ? `, représentant une marge nette de ${f.margin}%.` : ".";
    const ebitdaNote = f.ebitda !== 0 && f.ebitda !== f.netResult
      ? ` L'EBITDA s'établit à ${formatFCFA(f.ebitda)}, reflétant la capacité de génération de cash avant amortissements.`
      : "";
    const expNote = f.expenses > 0
      ? ` Le ratio charges / produits est de ${f.operatingExpenseRatio}%${f.operatingExpenseRatio < 80 ? " — niveau sain" : f.operatingExpenseRatio < 100 ? " — à surveiller" : " — supérieur à 100%, situation à redresser"}.`
      : "";
    const topExp = d.expenseBreakdown[0]
      ? ` Premier poste de charges : ${d.expenseBreakdown[0].label} (${d.expenseBreakdown[0].percent}% du total).`
      : "";
    return net + margin + ebitdaNote + expNote + topExp;
  })();

  const liquidityHeadline = liq.cashPosition >= 0
    ? liq.workingCapital >= 0
      ? `Trésorerie positive — fonds de roulement sain`
      : `Trésorerie positive mais fonds de roulement sous pression`
    : `Trésorerie négative — vigilance requise sur la liquidité`;

  const liquidityBody = (() => {
    const cash = liq.cashPosition !== 0
      ? `La position de trésorerie nette est de ${formatFCFA(liq.cashPosition)}.`
      : `La position de trésorerie est nulle sur la période.`;
    const wc = ` Le fonds de roulement s'établit à ${formatFCFA(liq.workingCapital)}, soit la marge disponible après couverture des engagements à court terme.`;
    const ap = liq.apOutstanding > 0
      ? ` Les dettes fournisseurs en cours représentent ${formatFCFA(liq.apOutstanding)}${liq.apOverdue > 0 ? `, dont ${formatFCFA(liq.apOverdue)} en dépassement d'échéance` : ""}.`
      : "";
    return cash + wc + ap;
  })();

  const opsHeadline = ops.activeProjects > 0
    ? ops.overdueProjects === 0
      ? `${ops.activeProjects} projets actifs — exécution dans les délais`
      : `${ops.activeProjects} projets actifs — ${ops.overdueProjects} projet${ops.overdueProjects > 1 ? "s" : ""} en retard à solder`
    : `Aucun projet actif enregistré sur la période`;

  const opsBody = (() => {
    const base = ops.totalProjects > 0
      ? `Le portefeuille compte ${ops.totalProjects} projets au total, dont ${ops.activeProjects} en cours et ${ops.completedProjects} achevés.`
      : `Aucun projet enregistré sur cette période.`;
    const budget = ops.totalBudget > 0 ? ` Le budget cumulé des projets actifs s'élève à ${formatFCFA(ops.totalBudget)}.` : "";
    const progress = ops.activeProjects > 0
      ? ` L'avancement moyen est de ${ops.avgProgress}%${ops.avgProgress >= 75 ? " — excellent rythme" : ops.avgProgress >= 40 ? " — progression régulière" : " — rythme à accélérer"}.`
      : "";
    const hr = d.hr.activeCollab > 0 ? ` L'équipe mobilisée compte ${d.hr.activeCollab} collaborateurs actifs.` : "";
    return base + budget + progress + hr;
  })();

  // Points d'attention
  const watchpoints: string[] = [];
  if (liq.arOverdue > 0) watchpoints.push(`${formatFCFA(liq.arOverdue)} de créances clients en dépassement d'échéance — recouvrement à prioriser.`);
  if (liq.apOverdue > 0) watchpoints.push(`${formatFCFA(liq.apOverdue)} de dettes fournisseurs en dépassement d'échéance — régularisation recommandée.`);
  if (ops.overdueProjects > 0) watchpoints.push(`${ops.overdueProjects} projet${ops.overdueProjects > 1 ? "s" : ""} actif${ops.overdueProjects > 1 ? "s" : ""} dépasse${ops.overdueProjects > 1 ? "nt" : ""} la date de livraison prévue.`);
  if (liq.cashPosition < 0) watchpoints.push(`La trésorerie est négative (${formatFCFA(liq.cashPosition)}) — un financement à court terme peut être nécessaire.`);
  if (f.netResult < 0) watchpoints.push(`Le résultat net est déficitaire. Une révision du plan de charges est à envisager.`);
  if (f.operatingExpenseRatio > 100) watchpoints.push(`Le ratio charges / produits dépasse 100% — les charges excèdent les produits sur la période.`);

  return (
    <div className="space-y-6 pt-4">

      {/* ── En-tête rapport ──────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
        <div className="bg-slate-900 text-white px-6 py-5 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Briefcase className="w-5 h-5 text-primary" />
              <span className="text-xs font-semibold tracking-widest text-slate-400 uppercase">Rapport de Gestion</span>
            </div>
            <h1 className="text-2xl font-bold leading-tight">Tableau de bord exécutif</h1>
            <p className="text-slate-400 text-sm mt-1">{periodLabel}</p>
          </div>
          <div className="text-right text-xs text-slate-500 mt-1">
            <div>Généré le {generatedAt}</div>
            <div className="mt-1 flex items-center justify-end gap-1.5">
              <span className={`w-2 h-2 rounded-full ${f.netResult >= 0 ? "bg-emerald-400" : "bg-red-400"}`} />
              <span className="text-slate-400">{f.netResult >= 0 ? "Performance positive" : "Résultat déficitaire"}</span>
            </div>
          </div>
        </div>

        {/* Barre résumé rapide */}
        <div className="bg-slate-800 px-6 py-3 grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-700">
          {[
            { label: "Produits", value: fmtCompact(f.revenues) + " FCFA", color: "text-emerald-400" },
            { label: "Charges", value: fmtCompact(f.expenses) + " FCFA", color: "text-red-400" },
            { label: "Résultat net", value: fmtCompact(f.netResult) + " FCFA", color: f.netResult >= 0 ? "text-emerald-400" : "text-red-400" },
            { label: "Trésorerie", value: fmtCompact(liq.cashPosition) + " FCFA", color: liq.cashPosition >= 0 ? "text-sky-400" : "text-red-400" },
          ].map(item => (
            <div key={item.label} className="px-4 first:pl-0">
              <div className="text-xs text-slate-500">{item.label}</div>
              <div className={`text-sm font-bold ${item.color}`}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Résumé exécutif ───────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-4 border-b border-slate-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Résumé exécutif
              </CardTitle>
              <CardDescription className="mt-0.5">{periodLabel} · Usage exclusif Direction &amp; Gouvernance</CardDescription>
            </div>
            <div className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-3 py-1">
              <span className={`w-1.5 h-1.5 rounded-full ${
                [revenueSignal, profitSignal, liquiditySignal, opsSignal].some(s => s === "warning") ? "bg-amber-400" : "bg-emerald-400"
              }`} />
              {[revenueSignal, profitSignal, liquiditySignal, opsSignal].some(s => s === "warning") ? "Points d'attention identifiés" : "Vue d'ensemble favorable"}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Sections thématiques */}
          {([
            { signal: revenueSignal,   icon: TrendingUp, headline: revHeadline,     body: revBody,     theme: "Performance commerciale" },
            { signal: profitSignal,    icon: BarChart2,  headline: profitHeadline,  body: profitBody,  theme: "Rentabilité" },
            { signal: liquiditySignal, icon: Banknote,   headline: liquidityHeadline, body: liquidityBody, theme: "Liquidité & Trésorerie" },
            { signal: opsSignal,       icon: Briefcase,  headline: opsHeadline,     body: opsBody,     theme: "Activité opérationnelle" },
          ] as const).map(({ signal, icon: Icon, headline, body, theme }) => {
            const cfg = signalConfig[signal];
            return (
              <div key={theme} className="flex gap-0 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                {/* Bande colorée latérale */}
                <div className={`w-1 shrink-0 ${signal === "positive" ? "bg-emerald-400" : signal === "warning" ? "bg-amber-400" : "bg-sky-400"}`} />
                <div className="flex-1 px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{theme}</span>
                    </div>
                    <span className={`shrink-0 text-xs font-medium border rounded-full px-2.5 py-0.5 ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 mb-1">{headline}</p>
                  <p className="text-sm text-slate-500 leading-relaxed">{body}</p>
                </div>
              </div>
            );
          })}

          {/* Points d'attention */}
          {watchpoints.length > 0 && (
            <div className="mx-5 my-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-sm font-semibold text-amber-800">
                  {watchpoints.length === 1 ? "Point d'attention" : `${watchpoints.length} points d'attention`}
                </span>
              </div>
              <ul className="space-y-1">
                {watchpoints.map((wp, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                    {wp}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Chiffres clés ─────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Chiffres clés</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              title: "Produits", value: fmtCompact(f.revenues) + " FCFA",
              trend: <TrendBadge curr={f.revenues} prev={d.prev.revenues} />,
              sub: `Les produits sur la période s'élèvent à ${formatFCFA(f.revenues)}.${revenueChange !== null ? ` C'est une ${revenueChange >= 0 ? "hausse" : "baisse"} de ${Math.abs(revenueChange)}% vs N-1 (${formatFCFA(d.prev.revenues)}).` : ""}`,
              color: "border-l-emerald-500",
            },
            {
              title: "Charges", value: fmtCompact(f.expenses) + " FCFA",
              trend: <TrendBadge curr={f.expenses} prev={d.prev.expenses} higherIsBetter={false} />,
              sub: `Les charges totales s'élèvent à ${formatFCFA(f.expenses)}.${expenseChange !== null ? ` Évolution de ${expenseChange >= 0 ? "+" : ""}${expenseChange}% vs N-1 (${formatFCFA(d.prev.expenses)}).` : ""}`,
              color: "border-l-red-400",
            },
            {
              title: "Ratio charges / produits", value: `${f.operatingExpenseRatio}%`,
              trend: <TrendBadge curr={f.operatingExpenseRatio} prev={d.prev.revenues > 0 ? Math.round((d.prev.expenses / d.prev.revenues) * 1000) / 10 : 0} higherIsBetter={false} />,
              sub: `Le ratio charges/produits de la période est de ${f.operatingExpenseRatio}%. Un ratio inférieur à 80% est généralement considéré sain.`,
              color: "border-l-amber-400",
            },
            {
              title: "Marge nette", value: `${f.margin}%`,
              trend: <TrendBadge curr={f.margin} prev={d.prev.margin} />,
              sub: `La marge nette de la période est de ${f.margin}%.${netChange !== null ? ` Résultat N-1 : ${formatFCFA(d.prev.netResult)} (marge : ${d.prev.margin}%).` : ""}`,
              color: f.margin >= 0 ? "border-l-primary" : "border-l-red-500",
            },
          ].map(item => (
            <div key={item.title} className={`bg-white border border-slate-200 rounded-lg p-4 border-l-4 ${item.color} shadow-sm`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{item.title}</span>
                {item.trend}
              </div>
              <div className="text-2xl font-bold text-slate-900 mb-2">{item.value}</div>
              <p className="text-xs text-slate-500 leading-relaxed">{item.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Santé financière ──────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary" />
              Santé financière
            </CardTitle>
            <CardDescription>{periodLabel} vs N-1</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-600">Indicateur</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-slate-600">Période</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-slate-600">N-1</th>
                  <th className="py-2 px-3 text-center text-xs font-semibold text-slate-600">Cible</th>
                  <th className="py-2 px-3 text-center text-xs font-semibold text-slate-600">Évolution</th>
                  <th className="py-2 px-3 text-center text-xs font-semibold text-slate-600">Importance</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-slate-50"><td colSpan={6} className="py-1.5 px-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Croissance</td></tr>
                <HealthRow label="Produits totaux" value={f.revenues} prev={d.prev.revenues} importance="Élevé" />
                <HealthRow label="Résultat net" value={f.netResult} prev={d.prev.netResult} importance="Élevé" />
                <HealthRow label="Marge nette" value={`${f.margin}%`} prev={`${d.prev.margin}%`} importance="Élevé" />
                <tr className="bg-slate-50"><td colSpan={6} className="py-1.5 px-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Rentabilité</td></tr>
                <HealthRow label="Ratio charges/produits" value={`${f.operatingExpenseRatio}%`} prev={d.prev.revenues > 0 ? `${Math.round((d.prev.expenses / d.prev.revenues) * 1000) / 10}%` : "N/A"} target="< 80%" importance="Élevé" higherIsBetter={false} />
                <HealthRow label="EBITDA" value={f.ebitda} prev={d.prev.netResult} importance="Moyen" />
                <HealthRow label="Marge brute" value={`${f.grossMargin}%`} prev="N/A" importance="Moyen" />
                <tr className="bg-slate-50"><td colSpan={6} className="py-1.5 px-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Liquidité</td></tr>
                <HealthRow label="Trésorerie" value={liq.cashPosition} prev={0} target="≥ 0" importance="Élevé" />
                <HealthRow label="Créances clients" value={liq.arOutstanding} prev={0} importance="Moyen" higherIsBetter={false} />
                <HealthRow label="Délai de recouvrement" value={`${liq.debtorsDays}j`} prev="—" target="< 60j" importance="Moyen" higherIsBetter={false} />
                <HealthRow label="Délai de règlement" value={`${liq.creditorsDays}j`} prev="—" target="< 90j" importance="Faible" />
                <tr className="bg-slate-50"><td colSpan={6} className="py-1.5 px-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Solvabilité</td></tr>
                <HealthRow label="Fonds de roulement" value={liq.workingCapital} prev={0} target="≥ 0" importance="Élevé" />
                <HealthRow label="Dettes fournisseurs" value={liq.apOutstanding} prev={0} importance="Moyen" higherIsBetter={false} />
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Produits vs Charges — graphique ────────────────────────── */}
      {d.series.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              Produits vs Charges — Évolution mensuelle
            </CardTitle>
            <CardDescription>
              {d.series.length > 0 && (() => {
                const bestMonth = [...d.series].sort((a, b) => b.revenues - a.revenues)[0];
                const worstMonth = [...d.series].sort((a, b) => a.revenues - b.revenues)[0];
                const totalRev = d.series.reduce((s, m) => s + m.revenues, 0);
                const avgRev = Math.round(totalRev / d.series.length);
                return `Produits cumulés : ${formatFCFA(totalRev)}. Moyenne mensuelle : ${formatFCFA(avgRev)}. Meilleur mois : ${bestMonth.month} (${formatFCFA(bestMonth.revenues)}) ; pire mois : ${worstMonth.month} (${formatFCFA(worstMonth.revenues)}).`;
              })()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.series} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => Intl.NumberFormat("fr-FR", { notation: "compact" }).format(v as number)} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatFCFA(v)} />
                  <Legend />
                  <Bar dataKey="revenues" name="Produits" fill="#10B981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expenses" name="Charges" fill="#F97316" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Créances clients (AR) ─────────────────────────────────── */}
      {d.topArClients.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" />
              Soldes clients — Créances en cours
            </CardTitle>
            <CardDescription>Clients avec encours non réglé · Total : {formatFCFA(liq.arOutstanding)}{liq.arOverdue > 0 ? ` dont ${formatFCFA(liq.arOverdue)} en retard` : ""}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="py-2 px-4 text-left text-xs font-semibold text-slate-500">Client</th>
                  <th className="py-2 px-4 text-right text-xs font-semibold text-slate-500">Encours</th>
                  <th className="py-2 px-4 text-right text-xs font-semibold text-slate-500">En retard</th>
                  <th className="py-2 px-4 text-right text-xs font-semibold text-slate-500">% Total</th>
                  <th className="py-2 px-4 text-left text-xs font-semibold text-slate-500"></th>
                </tr>
              </thead>
              <tbody>
                {d.topArClients.map((c) => (
                  <tr key={c.name} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-medium text-slate-800">{c.name}</td>
                    <td className="py-2.5 px-4 text-right font-semibold tabular-nums">{formatFCFA(c.outstanding)}</td>
                    <td className={`py-2.5 px-4 text-right tabular-nums ${c.overdue > 0 ? "text-red-600 font-semibold" : "text-slate-400"}`}>
                      {c.overdue > 0 ? formatFCFA(c.overdue) : "—"}
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-500 tabular-nums">{c.percent}%</td>
                    <td className="py-2.5 px-4">
                      <div className="h-1.5 bg-slate-100 rounded-full w-24 ml-auto">
                        <div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.min(c.percent, 100)}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* ── Charges par compte ────────────────────────────────────── */}
      {d.expenseBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowDownRight className="w-4 h-4 text-red-500" />
              Ventilation des charges
            </CardTitle>
            <CardDescription>Top postes de charges (classe 6) · Total : {formatFCFA(f.expenses)}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {d.expenseBreakdown.map((e) => (
                <div key={e.code} className="flex items-center gap-3">
                  <div className="w-28 shrink-0">
                    <span className="font-mono text-xs text-slate-400">{e.code}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm text-slate-700 truncate">{e.label}</span>
                      <span className="text-sm font-semibold tabular-nums shrink-0 ml-2">{formatFCFA(e.amount)}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full">
                      <div className="h-1.5 rounded-full bg-red-400" style={{ width: `${Math.min(e.percent, 100)}%` }} />
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 w-10 text-right shrink-0">{e.percent}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Soldes fournisseurs (AP) ───────────────────────────────── */}
      {d.topApSuppliers.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-amber-500" />
              Soldes fournisseurs — Dettes en cours
            </CardTitle>
            <CardDescription>Fournisseurs avec dettes non réglées · Total : {formatFCFA(liq.apOutstanding)}{liq.apOverdue > 0 ? ` dont ${formatFCFA(liq.apOverdue)} en retard` : ""}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="py-2 px-4 text-left text-xs font-semibold text-slate-500">Fournisseur</th>
                  <th className="py-2 px-4 text-right text-xs font-semibold text-slate-500">Encours</th>
                  <th className="py-2 px-4 text-right text-xs font-semibold text-slate-500">En retard</th>
                  <th className="py-2 px-4 text-right text-xs font-semibold text-slate-500">% Total</th>
                  <th className="py-2 px-4 text-left text-xs font-semibold text-slate-500"></th>
                </tr>
              </thead>
              <tbody>
                {d.topApSuppliers.map((s) => (
                  <tr key={s.name} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-medium text-slate-800">{s.name}</td>
                    <td className="py-2.5 px-4 text-right font-semibold tabular-nums">{formatFCFA(s.outstanding)}</td>
                    <td className={`py-2.5 px-4 text-right tabular-nums ${s.overdue > 0 ? "text-red-600 font-semibold" : "text-slate-400"}`}>
                      {s.overdue > 0 ? formatFCFA(s.overdue) : "—"}
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-500 tabular-nums">{s.percent}%</td>
                    <td className="py-2.5 px-4">
                      <div className="h-1.5 bg-slate-100 rounded-full w-24 ml-auto">
                        <div className="h-1.5 rounded-full bg-amber-400" style={{ width: `${Math.min(s.percent, 100)}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* ── Projets & Opérations ──────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-primary" />
              Projets & Opérations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Projets actifs", value: String(ops.activeProjects), note: `sur ${ops.totalProjects} total`, color: "text-primary" },
                { label: "Projets terminés", value: String(ops.completedProjects), note: "", color: "text-emerald-600" },
                { label: "Projets en retard", value: String(ops.overdueProjects), note: ops.overdueProjects > 0 ? "⚠ Action requise" : "", color: ops.overdueProjects > 0 ? "text-red-600" : "text-slate-400" },
                { label: "Budget total actifs", value: formatFCFA(ops.totalBudget), note: "", color: "text-slate-700" },
                { label: "Avancement moyen", value: `${ops.avgProgress}%`, note: ops.avgProgress >= 75 ? "Bon rythme" : ops.avgProgress >= 40 ? "En cours" : "Attention", color: ops.avgProgress >= 75 ? "text-emerald-600" : ops.avgProgress >= 40 ? "text-amber-600" : "text-red-600" },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <span className="text-sm text-slate-600">{item.label}</span>
                  <div className="text-right">
                    <span className={`font-semibold text-sm ${item.color}`}>{item.value}</span>
                    {item.note && <div className="text-xs text-slate-400">{item.note}</div>}
                  </div>
                </div>
              ))}
              {ops.avgProgress > 0 && (
                <div className="pt-1">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Avancement global</span><span>{ops.avgProgress}%</span>
                  </div>
                  <Progress value={ops.avgProgress} className="h-2" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Ressources Humaines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">Effectif actif</span>
                <span className="font-bold text-lg text-primary">{d.hr.activeCollab}</span>
              </div>
              {Object.entries(d.hr.byContractType).length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Contrats actifs</div>
                  {Object.entries(d.hr.byContractType).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                      <span className="text-sm text-slate-600">{type}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 bg-slate-100 rounded-full w-16">
                          <div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.round((count / d.hr.activeCollab) * 100)}%` }} />
                        </div>
                        <span className="text-sm font-semibold w-6 text-right">{count}</span>
                        <span className="text-xs text-slate-400 w-10">{Math.round((count / d.hr.activeCollab) * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {d.hr.activeCollab === 0 && (
                <p className="text-sm text-slate-400 py-4 text-center">Aucun collaborateur actif enregistré.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Note de bas de rapport ────────────────────────────────── */}
      <div className="text-center py-3 text-xs text-slate-400 border-t border-slate-200">
        Rapport généré le {generatedAt} · Données au {new Date(d.period.to).toLocaleDateString("fr-FR")} · Gaméasù Analytics
      </div>

    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Ventes
// ────────────────────────────────────────────────────────────────

function SalesTab({ periodQuery, period, comparePeriod, compareMode = "none" }: TabProps) {
  const [clientSearch, setClientSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");

  const { data, isLoading } = useQuery<SalesReport>({
    queryKey: ["report", "sales", periodQuery],
    queryFn: () => apiFetch(`/api/reports/sales?${periodQuery}`),
  });

  const filteredTopClients = useMemo(() =>
    (data?.topClients ?? []).filter(c => !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase())),
    [data, clientSearch]);

  const filteredPipeline = useMemo(() => {
    if (!data) return {};
    if (stageFilter === "all") return data.pipeline;
    return Object.fromEntries(Object.entries(data.pipeline).filter(([s]) => s === stageFilter));
  }, [data, stageFilter]);

  const hasFilters = !!(clientSearch || stageFilter !== "all");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <FilterBar onClear={hasFilters ? () => { setClientSearch(""); setStageFilter("all"); } : undefined}>
          <FilterInput placeholder="Client…" value={clientSearch} onChange={setClientSearch} />
          <FilterSelect placeholder="Toutes les étapes" value={stageFilter} onChange={setStageFilter}
            options={Object.entries(PIPELINE_STAGE_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
        </FilterBar>
        <Button onClick={() => downloadAuthed(`/api/reports/sales/export.xlsx?${periodQuery}`, `rapport-ventes-${new Date().toISOString().slice(0, 10)}.xlsx`)} className="bg-primary hover:bg-primary/90 shrink-0">
          <Download className="w-4 h-4 mr-2" /> Exporter Excel
        </Button>
      </div>
      {isLoading || !data ? <Skeleton className="h-96 w-full" /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi label="Commandes" value={String(data.kpi.ordersCount)} hint={formatFCFA(data.kpi.ordersAmount)} accent="primary" />
            <Kpi label="Proformas" value={String(data.kpi.proformasCount)} hint={formatFCFA(data.kpi.proformasAmount)} />
            <Kpi label="Conversion proforma" value={`${data.kpi.conversionRate} %`} hint={`${data.kpi.proformasConverted} converties`} accent="success" />
            <Kpi label="Opportunités" value={formatFCFA(data.kpi.pipelineValue)} hint={`${data.kpi.pipelineCount} opportunité(s)`} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Évolution des commandes</CardTitle>
              <CardDescription>12 derniers mois.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.series}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" tickFormatter={(v) => Intl.NumberFormat("fr-FR", { notation: "compact" }).format(v as number)} />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="amount" name="Montant" stroke="#F26B1F" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="count" name="Nombre" stroke="#3B82F6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top clients {clientSearch && <Badge variant="secondary" className="ml-2 text-xs font-normal">filtrés</Badge>}</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredTopClients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{clientSearch ? "Aucun client ne correspond." : "Aucune commande sur la période."}</p>
                ) : (
                  <div className="space-y-2">
                    {filteredTopClients.map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-3 border rounded-md">
                        <div>
                          <div className="font-semibold text-sm">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.count} commande(s)</div>
                        </div>
                        <div className="font-bold text-sm">{formatFCFA(c.amount)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pipeline {stageFilter !== "all" && <Badge variant="secondary" className="ml-2 text-xs font-normal">{PIPELINE_STAGE_LABELS[stageFilter]}</Badge>}</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(filteredPipeline).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune opportunité{stageFilter !== "all" ? " pour cette étape" : ""}.</p>
                ) : (
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(filteredPipeline).map(([stage, v]) => ({ name: PIPELINE_STAGE_LABELS[stage] || stage, value: v.value, count: v.count }))}
                          dataKey="value" nameKey="name" outerRadius={80} label={(e) => e.name}
                        >
                          {Object.keys(filteredPipeline).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatFCFA(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Balance âgée clients ─────────────────────── */}
          <AgedReceivablesSection clientSearch={clientSearch} />
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Composant réutilisable : balance âgée créances clients
// ────────────────────────────────────────────────────────────────

function AgedReceivablesSection({ clientSearch }: { clientSearch: string }) {
  const { data: aged } = useQuery<AgedReceivables>({
    queryKey: ["report", "aged-receivables"],
    queryFn: () => apiFetch("/api/reports/aged-receivables"),
  });
  const filteredByClient = useMemo(() =>
    (aged?.byClient ?? []).filter(c => !clientSearch || c.client.toLowerCase().includes(clientSearch.toLowerCase())),
    [aged, clientSearch]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-500" /> Balance âgée — créances clients
        </CardTitle>
        {aged && aged.totalOutstanding > 0
          ? <CardDescription>Total encours : <strong>{formatFCFA(aged.totalOutstanding)}</strong> — répartition par ancienneté.</CardDescription>
          : <CardDescription>Répartition des factures impayées par ancienneté.</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-5">
        {!aged || aged.totalOutstanding === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground gap-2">
            <CheckCircle2 className="w-8 h-8 opacity-30 text-green-500" />
            <p className="text-sm font-medium">Aucune créance impayée</p>
            <p className="text-xs">Toutes les factures clients sont soldées.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {aged.buckets.map((b) => {
                const clr = b.key === "current" ? "#10b981" : b.key === "1-30" ? "#f59e0b" : b.key === "31-60" ? "#f97316" : b.key === "61-90" ? "#ef4444" : "#991b1b";
                return (
                  <div key={b.key} className="flex items-center gap-3">
                    <div className="w-28 shrink-0 text-xs font-medium text-slate-600">{b.label}</div>
                    <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
                      <div className="h-full rounded transition-all" style={{ width: `${b.percent}%`, backgroundColor: clr }} />
                    </div>
                    <div className="w-32 text-right text-sm font-bold" style={{ color: clr }}>{formatFCFA(b.amount)}</div>
                    <div className="w-16 text-right text-xs text-slate-400">{b.count} fact.</div>
                  </div>
                );
              })}
            </div>
            {filteredByClient.length > 0 && (
              <div>
                <SectionTitle icon={Users}>Par client {clientSearch && <span className="text-primary normal-case font-normal text-xs">(filtrés)</span>}</SectionTitle>
                <div className="space-y-1">
                  {filteredByClient.slice(0, 8).map((c) => (
                    <div key={c.client} className="flex items-center justify-between p-2.5 border rounded-md text-sm hover:bg-slate-50/50">
                      <span className="font-medium text-slate-800">{c.client}</span>
                      <span className="font-bold text-primary">{formatFCFA(c.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────
// Achats / Fournisseurs
// ────────────────────────────────────────────────────────────────

function PurchasesTab({ periodQuery, period, comparePeriod, compareMode = "none" }: TabProps) {
  const [supplierSearch, setSupplierSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading } = useQuery<PurchasesReport>({
    queryKey: ["report", "purchases", periodQuery],
    queryFn: () => apiFetch(`/api/reports/purchases?${periodQuery}`),
  });
  const { data: agedPayables } = useQuery<AgedPayables>({
    queryKey: ["report", "aged-payables"],
    queryFn: () => apiFetch("/api/reports/aged-payables"),
  });

  const filteredTopSuppliers = useMemo(() =>
    (data?.topSuppliers ?? []).filter(s => !supplierSearch || s.name.toLowerCase().includes(supplierSearch.toLowerCase())),
    [data, supplierSearch]);

  const filteredByStatus = useMemo(() => {
    if (!data) return {};
    if (statusFilter === "all") return data.byStatus;
    return Object.fromEntries(Object.entries(data.byStatus).filter(([s]) => s === statusFilter));
  }, [data, statusFilter]);

  const filteredAgedBySupplier = useMemo(() =>
    (agedPayables?.bySupplier ?? []).filter(s => !supplierSearch || s.supplier.toLowerCase().includes(supplierSearch.toLowerCase())),
    [agedPayables, supplierSearch]);

  const filteredOverdueList = useMemo(() =>
    (data?.overdueList ?? []).filter(o => !supplierSearch || o.supplier.toLowerCase().includes(supplierSearch.toLowerCase())),
    [data, supplierSearch]);

  const hasFilters = !!(supplierSearch || statusFilter !== "all");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <FilterBar onClear={hasFilters ? () => { setSupplierSearch(""); setStatusFilter("all"); } : undefined}>
          <FilterInput placeholder="Fournisseur…" value={supplierSearch} onChange={setSupplierSearch} />
          <FilterSelect placeholder="Tous les statuts" value={statusFilter} onChange={setStatusFilter} options={
            Object.entries(SUPPLIER_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))
          } />
        </FilterBar>
      </div>

      {isLoading || !data ? <Skeleton className="h-64 w-full" /> : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi label="Achats (période)" value={formatFCFA(data.kpi.totalAmount)} hint={`${data.kpi.invoiceCount} facture(s)`} accent="primary" />
            <Kpi label="Réglé" value={formatFCFA(data.kpi.paidAmount)} hint={`Taux ${data.kpi.paymentRate} %`} accent="success" />
            <Kpi label="Reste à payer" value={formatFCFA(data.kpi.outstanding)} hint="sur la période" accent="warning" />
            <Kpi label="En retard" value={formatFCFA(data.kpi.overdueAmount)} hint={`${data.kpi.overdueCount} facture(s)`} accent="danger" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Kpi label="TVA déductible" value={formatFCFA(data.kpi.taxTotal)} hint="Classe 4457 — à vérifier" />
            <Kpi label="Taux de règlement" value={`${data.kpi.paymentRate} %`} accent={data.kpi.paymentRate >= 80 ? "success" : data.kpi.paymentRate >= 50 ? "warning" : "danger"} />
          </div>

          {/* Série mensuelle */}
          {data.series.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Évolution mensuelle des achats</CardTitle>
                <CardDescription>12 derniers mois — montants en FCFA.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.series}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis tickFormatter={(v) => Intl.NumberFormat("fr-FR", { notation: "compact" }).format(v as number)} />
                      <Tooltip formatter={(v: number) => formatFCFA(v)} />
                      <Legend />
                      <Bar dataKey="achat" name="Achats" fill="#F26B1F" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="paye" name="Réglé" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top fournisseurs + par statut */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top fournisseurs {supplierSearch && <Badge variant="secondary" className="ml-2 text-xs font-normal">filtrés</Badge>}</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredTopSuppliers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{supplierSearch ? "Aucun fournisseur ne correspond." : "Aucun achat sur la période."}</p>
                ) : (
                  <div className="space-y-2">
                    {filteredTopSuppliers.map(s => (
                      <div key={s.id} className="flex items-center justify-between p-3 border rounded-md">
                        <div>
                          <div className="font-semibold text-sm">{s.name}</div>
                          <div className="text-xs text-muted-foreground">{s.count} facture(s) · Réglé {formatFCFA(s.paid)}</div>
                        </div>
                        <div className="font-bold text-sm">{formatFCFA(s.amount)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Par statut {statusFilter !== "all" && <Badge variant="secondary" className="ml-2 text-xs font-normal">{SUPPLIER_STATUS_LABELS[statusFilter]}</Badge>}</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(filteredByStatus).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune facture correspondant aux filtres.</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(filteredByStatus).map(([s, v]) => (
                      <div key={s} className="flex items-center justify-between p-3 border rounded-md">
                        <Badge variant="outline">{SUPPLIER_STATUS_LABELS[s] || s}</Badge>
                        <div className="text-sm"><strong>{v.count}</strong> · {formatFCFA(v.amount)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Factures en retard */}
          {filteredOverdueList.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" /> Factures fournisseurs en retard
                  {supplierSearch && <Badge variant="secondary" className="text-xs font-normal">filtrées</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {filteredOverdueList.map(o => (
                    <div key={o.id} className="flex items-center justify-between p-3 border rounded-md hover:bg-red-50/30">
                      <div>
                        <div className="font-semibold text-sm">{o.supplier}</div>
                        <div className="text-xs text-muted-foreground">Échéance : {o.dueDate ? new Date(o.dueDate).toLocaleDateString("fr-FR") : "—"}</div>
                      </div>
                      <div className="font-bold text-sm text-red-600">{formatFCFA(o.outstanding)}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Balance âgée fournisseurs */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" /> Balance âgée — dettes fournisseurs
              </CardTitle>
              {agedPayables && agedPayables.totalOutstanding > 0
                ? <CardDescription className="mt-1">Total dû : <strong>{formatFCFA(agedPayables.totalOutstanding)}</strong> — répartition par ancienneté.</CardDescription>
                : <CardDescription className="mt-1">Aucune dette fournisseur en cours.</CardDescription>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {!agedPayables || agedPayables.totalOutstanding === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground gap-2">
              <CheckCircle2 className="w-8 h-8 opacity-30 text-green-500" />
              <p className="text-sm font-medium">Aucune dette fournisseur en cours</p>
              <p className="text-xs">Toutes les factures fournisseurs sont réglées.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {agedPayables.buckets.map((b) => {
                  const clr = b.key === "current" ? "#10b981" : b.key === "1-30" ? "#f59e0b" : b.key === "31-60" ? "#f97316" : b.key === "61-90" ? "#ef4444" : "#991b1b";
                  return (
                    <div key={b.key} className="flex items-center gap-3">
                      <div className="w-28 shrink-0 text-xs font-medium text-slate-600">{b.label}</div>
                      <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
                        <div className="h-full rounded transition-all" style={{ width: `${b.percent}%`, backgroundColor: clr }} />
                      </div>
                      <div className="w-32 text-right text-sm font-bold" style={{ color: clr }}>{formatFCFA(b.amount)}</div>
                      <div className="w-16 text-right text-xs text-slate-400">{b.count} fact.</div>
                    </div>
                  );
                })}
              </div>
              {filteredAgedBySupplier.length > 0 && (
                <div>
                  <SectionTitle icon={Building2}>Par fournisseur {supplierSearch && <span className="text-primary normal-case font-normal text-xs">(filtrés)</span>}</SectionTitle>
                  <div className="space-y-1">
                    {filteredAgedBySupplier.slice(0, 8).map((s) => (
                      <div key={s.supplier} className="flex items-center justify-between p-2.5 border rounded-md text-sm hover:bg-red-50/30">
                        <span className="font-medium text-slate-800">{s.supplier}</span>
                        <span className="font-bold text-red-600">{formatFCFA(s.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {agedPayables.detail.length > 0 && (
                <div>
                  <SectionTitle icon={FileText}>Détail</SectionTitle>
                  <div className="space-y-1">
                    {agedPayables.detail
                      .filter(d => !supplierSearch || d.supplier.toLowerCase().includes(supplierSearch.toLowerCase()))
                      .slice(0, 10)
                      .map((d) => (
                        <div key={d.id} className="grid grid-cols-4 items-center gap-2 p-2.5 border rounded-md text-xs hover:bg-slate-50/50">
                          <span className="font-medium text-slate-800 truncate">{d.reference}</span>
                          <span className="text-slate-500 truncate">{d.supplier}</span>
                          <span className="text-slate-400">{d.dueDate ? new Date(d.dueDate).toLocaleDateString("fr-FR") : "—"} · {d.daysOverdue > 0 ? `${d.daysOverdue}j retard` : "À échoir"}</span>
                          <span className="font-bold text-red-600 text-right">{formatFCFA(d.outstanding)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Projets
// ────────────────────────────────────────────────────────────────

function ProjectsTab({ periodQuery, period, comparePeriod, compareMode = "none" }: TabProps) {
  const [projectSearch, setProjectSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading } = useQuery<ProjectsReport>({
    queryKey: ["report", "projects", periodQuery],
    queryFn: () => apiFetch(`/api/reports/projects?${periodQuery}`),
  });

  const filteredTopProjects = useMemo(() =>
    (data?.topProjects ?? []).filter(p =>
      (statusFilter === "all" || p.status === statusFilter) &&
      (!projectSearch || p.name.toLowerCase().includes(projectSearch.toLowerCase()) || p.clientName.toLowerCase().includes(projectSearch.toLowerCase()))
    ), [data, projectSearch, statusFilter]);

  const filteredOverdueList = useMemo(() =>
    (data?.overdueList ?? []).filter(p =>
      !projectSearch || p.name.toLowerCase().includes(projectSearch.toLowerCase()) || p.clientName.toLowerCase().includes(projectSearch.toLowerCase())
    ), [data, projectSearch]);

  const hasFilters = !!(projectSearch || statusFilter !== "all");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <FilterBar onClear={hasFilters ? () => { setProjectSearch(""); setStatusFilter("all"); } : undefined}>
          <FilterInput placeholder="Projet / client…" value={projectSearch} onChange={setProjectSearch} />
          <FilterSelect placeholder="Tous les statuts" value={statusFilter} onChange={setStatusFilter}
            options={Object.entries(PROJECT_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
        </FilterBar>
        <Button onClick={() => downloadAuthed(`/api/reports/projects/export.xlsx?${periodQuery}`, `rapport-projets-${new Date().toISOString().slice(0, 10)}.xlsx`)} className="bg-primary hover:bg-primary/90 shrink-0">
          <Download className="w-4 h-4 mr-2" /> Exporter Excel
        </Button>
      </div>
      {isLoading || !data ? <Skeleton className="h-96 w-full" /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi label="Projets actifs" value={String(data.kpi.activeCount)} hint={`sur ${data.kpi.totalCount} au total`} accent="primary" />
            <Kpi label="En retard" value={String(data.kpi.overdueCount)} accent={data.kpi.overdueCount > 0 ? "danger" : "default"} />
            <Kpi label="Avancement moyen" value={`${data.kpi.avgProgress} %`} accent="default" />
            <Kpi label="Budget actif" value={formatFCFA(data.kpi.activeBudget)} hint={`${formatFCFA(data.kpi.totalBudget)} cumulé`} />
            <Kpi label="Créés sur la période" value={String(data.kpi.newInPeriod)} accent="success" />
            <Kpi label="Clôturés sur la période" value={String(data.kpi.completedInPeriod)} accent="success" />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Répartition par statut {statusFilter !== "all" && <Badge variant="secondary" className="ml-2 text-xs font-normal">{PROJECT_STATUS_LABELS[statusFilter]}</Badge>}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(data.byStatus)
                          .filter(([s]) => statusFilter === "all" || s === statusFilter)
                          .map(([s, n]) => ({ name: PROJECT_STATUS_LABELS[s] || s, value: n }))}
                        dataKey="value" nameKey="name" outerRadius={80} label={(e) => `${e.name} (${e.value})`}
                      >
                        {Object.keys(data.byStatus).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top projets {(projectSearch || statusFilter !== "all") && <Badge variant="secondary" className="ml-2 text-xs font-normal">filtrés</Badge>}</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredTopProjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun projet ne correspond aux filtres.</p>
                ) : (
                  <div className="space-y-2">
                    {filteredTopProjects.slice(0, 6).map((p) => (
                      <div key={p.id} className="p-3 border rounded-md">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="font-semibold text-sm">{p.name}</div>
                            <div className="text-xs text-muted-foreground">{p.clientName} · <Badge variant="outline" className="ml-1">{PROJECT_STATUS_LABELS[p.status] || p.status}</Badge></div>
                          </div>
                          <div className="font-bold text-sm">{formatFCFA(p.budget)}</div>
                        </div>
                        <Progress value={p.progress} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {filteredOverdueList.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" /> Projets en retard
                  {projectSearch && <Badge variant="secondary" className="text-xs font-normal">filtrés</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {filteredOverdueList.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 border rounded-md hover:bg-red-50/30">
                      <div>
                        <div className="font-semibold text-sm">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.clientName} · échéance {p.endDate ? new Date(p.endDate).toLocaleDateString("fr-FR") : "—"}</div>
                      </div>
                      <Badge variant="outline" className="text-red-600 border-red-200">{p.progress} %</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// RH
// ────────────────────────────────────────────────────────────────

function HrTab({ periodQuery, period, comparePeriod, compareMode = "none" }: TabProps) {
  const [collabSearch, setCollabSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [contractTypeFilter, setContractTypeFilter] = useState("all");

  const { data, isLoading } = useQuery<HrReport>({
    queryKey: ["report", "hr", periodQuery],
    queryFn: () => apiFetch(`/api/reports/hr?${periodQuery}`),
  });
  const { data: workload } = useQuery<WorkloadEntry[]>({
    queryKey: ["report", "workload"],
    queryFn: () => apiFetch("/api/reports/workload"),
  });
  const { data: masseSal } = useQuery<MasseSalariale>({
    queryKey: ["report", "masse-salariale", periodQuery],
    queryFn: () => apiFetch(`/api/reports/hr/masse-salariale?${periodQuery}`),
  });
  const { data: turnover } = useQuery<TurnoverReport>({
    queryKey: ["report", "turnover", periodQuery],
    queryFn: () => apiFetch(`/api/reports/hr/turnover?${periodQuery}`),
  });

  const deptOptions = useMemo(() =>
    Object.keys(data?.byDepartment ?? {}).map(d => ({ value: d, label: d })),
    [data]);

  const filteredTopPerformers = useMemo(() =>
    (data?.topPerformers ?? []).filter(p =>
      (!collabSearch || p.name.toLowerCase().includes(collabSearch.toLowerCase())) &&
      (deptFilter === "all")
    ), [data, collabSearch, deptFilter]);

  const filteredExpiringList = useMemo(() =>
    (data?.expiringList ?? []).filter(c => {
      const ctype = c.contractType || c.type;
      return (
        (!collabSearch || c.collaborator.toLowerCase().includes(collabSearch.toLowerCase())) &&
        (contractTypeFilter === "all" || ctype === contractTypeFilter)
      );
    }), [data, collabSearch, contractTypeFilter]);

  const filteredWorkload = useMemo(() =>
    (workload ?? []).filter(u =>
      !collabSearch || u.name.toLowerCase().includes(collabSearch.toLowerCase())
    ), [workload, collabSearch]);

  const filteredByDepartment = useMemo(() => {
    if (!data) return {};
    if (deptFilter === "all") return data.byDepartment;
    return Object.fromEntries(Object.entries(data.byDepartment).filter(([d]) => d === deptFilter));
  }, [data, deptFilter]);

  const contractTypeOptions = useMemo(() => {
    const types = new Set((data?.expiringList ?? []).map(c => c.contractType || c.type).filter(Boolean));
    return Array.from(types).map(t => ({ value: t, label: CONTRACT_TYPE_LABELS[t] || t }));
  }, [data]);

  const hasFilters = !!(collabSearch || deptFilter !== "all" || contractTypeFilter !== "all");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <FilterBar onClear={hasFilters ? () => { setCollabSearch(""); setDeptFilter("all"); setContractTypeFilter("all"); } : undefined}>
          <FilterInput placeholder="Collaborateur…" value={collabSearch} onChange={setCollabSearch} />
          <FilterSelect placeholder="Tous les départements" value={deptFilter} onChange={setDeptFilter} options={deptOptions} />
          {contractTypeOptions.length > 0 && (
            <FilterSelect placeholder="Type de contrat" value={contractTypeFilter} onChange={setContractTypeFilter} options={contractTypeOptions} />
          )}
        </FilterBar>
        <Button onClick={() => downloadAuthed(`/api/reports/hr/export.xlsx?${periodQuery}`, `rapport-rh-${new Date().toISOString().slice(0, 10)}.xlsx`)} className="bg-primary hover:bg-primary/90 shrink-0">
          <Download className="w-4 h-4 mr-2" /> Exporter Excel
        </Button>
      </div>
      {isLoading || !data ? <Skeleton className="h-96 w-full" /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi label="Effectif actif" value={String(data.kpi.active)} hint={`${data.kpi.total} au total`} accent="primary" />
            <Kpi label="En congé" value={String(data.kpi.onLeave)} />
            <Kpi label="Heures pointées" value={String(data.kpi.totalHours)} hint={`${data.kpi.distinctCollabs} collaborateur(s)`} accent="success" />
            <Kpi label="Anomalies ouvertes" value={String(data.kpi.unresolvedFlags)} hint={`${data.kpi.flagsTotal} sur la période`} accent={data.kpi.unresolvedFlags > 0 ? "warning" : "default"} />
            <Kpi label="Retards" value={String(data.kpi.lateCount)} accent={data.kpi.lateCount > 0 ? "warning" : "default"} />
            <Kpi label="Départs anticipés" value={String(data.kpi.earlyLeaveCount)} />
            <Kpi label="Contrats expirants ≤ 60 j" value={String(data.kpi.expiringContracts)} accent={data.kpi.expiringContracts > 0 ? "warning" : "default"} />
            <Kpi label="Sortis" value={String(data.kpi.terminated)} />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Effectif par département {deptFilter !== "all" && <Badge variant="secondary" className="ml-2 text-xs font-normal">{deptFilter}</Badge>}</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(filteredByDepartment).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun département renseigné.</p>
                ) : (
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={Object.entries(filteredByDepartment).map(([d, n]) => ({ dept: d, effectif: n }))} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="dept" width={140} />
                        <Tooltip />
                        <Bar dataKey="effectif" fill="#F26B1F" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Anomalies de pointage</CardTitle></CardHeader>
              <CardContent>
                {Object.keys(data.flagsByKind).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune anomalie sur la période.</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(data.flagsByKind).map(([k, n]) => (
                      <div key={k} className="flex items-center justify-between p-3 border rounded-md">
                        <span className="text-sm">{FLAG_KIND_LABELS[k] || k}</span>
                        <Badge variant="outline">{n}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" /> Top collaborateurs — heures pointées
                {collabSearch && <Badge variant="secondary" className="text-xs font-normal">filtrés</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredTopPerformers.length === 0 ? (
                <p className="text-sm text-muted-foreground">{collabSearch ? "Aucun collaborateur ne correspond." : "Aucun pointage sur la période."}</p>
              ) : (
                <div className="space-y-2">
                  {filteredTopPerformers.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 border rounded-md">
                      <span className="font-semibold text-sm">{p.name}</span>
                      <Badge className="bg-primary/10 text-primary border-primary/30">{p.hours} h</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {filteredExpiringList.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" /> Contrats expirants (≤ 60 jours)
                  {collabSearch && <Badge variant="secondary" className="text-xs font-normal">filtrés</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {filteredExpiringList.map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-3 border rounded-md">
                      <div>
                        <div className="font-semibold text-sm">{c.collaborator}</div>
                        <div className="text-xs text-muted-foreground">{c.jobTitle || "—"} · {c.type}</div>
                      </div>
                      <Badge variant="outline" className="text-amber-700 border-amber-300">{c.endDate ? new Date(c.endDate).toLocaleDateString("fr-FR") : "—"}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {filteredWorkload.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" /> Charge de travail
                  {collabSearch && <Badge variant="secondary" className="text-xs font-normal">filtrés</Badge>}
                </CardTitle>
                <CardDescription>Indicateur transversal, indépendant de la période.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredWorkload.map((u) => (
                    <div key={u.userId} className="border rounded-md p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-semibold">{u.name}</div>
                          <div className="text-xs text-muted-foreground">{ROLE_LABELS[u.role] || u.role}</div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-slate-600">Tâches actives <strong>{u.activeTasks}</strong></span>
                          <span className="text-slate-600">Projets <strong>{u.activeProjects}</strong></span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={u.load} className={`h-2 flex-1 ${u.load > 80 ? "[&>div]:bg-red-500" : u.load > 60 ? "[&>div]:bg-amber-500" : "[&>div]:bg-green-500"}`} />
                        <span className="text-xs font-bold w-10 text-right">{u.load}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Masse salariale ───────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-primary" /> Masse salariale
              </CardTitle>
              {masseSal && masseSal.kpi.employeeCount > 0 ? (
                <CardDescription>
                  Brut total : <strong>{formatFCFA(masseSal.kpi.totalGross)}</strong> · Net total : <strong>{formatFCFA(masseSal.kpi.totalNet)}</strong>
                </CardDescription>
              ) : (
                <CardDescription>Données calculées depuis les bulletins de paie validés.</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-5">
              {!masseSal || masseSal.kpi.employeeCount === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground gap-2">
                  <Banknote className="w-8 h-8 opacity-30" />
                  <p className="text-sm font-medium">Aucun bulletin de paie sur la période</p>
                  <p className="text-xs">Les données apparaîtront dès que des bulletins seront générés et validés dans le module Paie.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Kpi label="Brut total" value={formatFCFA(masseSal.kpi.totalGross)} hint={`${masseSal.kpi.employeeCount} bulletin(s)`} accent="primary" />
                    <Kpi label="Net total" value={formatFCFA(masseSal.kpi.totalNet)} accent="success" />
                    <Kpi label="Charges patronales" value={formatFCFA(masseSal.kpi.totalCnssEmployer)} accent="warning" />
                    <Kpi label="IRPP total" value={formatFCFA(masseSal.kpi.totalIrpp)} />
                  </div>
                  {masseSal.byMonth.length > 0 && (
                    <div>
                      <SectionTitle icon={TrendingUp}>Évolution mensuelle</SectionTitle>
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={masseSal.byMonth}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="period" />
                            <YAxis tickFormatter={(v) => Intl.NumberFormat("fr-FR", { notation: "compact" }).format(v as number)} />
                            <Tooltip formatter={(v: number) => formatFCFA(v)} />
                            <Legend />
                            <Bar dataKey="gross" name="Brut" fill="#F26B1F" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="net" name="Net" fill="#10B981" radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  {masseSal.byDepartment.length > 0 && (
                    <div>
                      <SectionTitle icon={Users}>Par département</SectionTitle>
                      <div className="space-y-1.5">
                        {masseSal.byDepartment.map((d) => (
                          <div key={d.department} className="flex items-center justify-between p-2.5 border rounded-md text-sm">
                            <span className="font-medium">{d.department}</span>
                            <div className="flex items-center gap-4">
                              <span className="text-slate-500">{d.count} sal.</span>
                              <span className="font-bold text-primary">{formatFCFA(d.gross)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* ── Turnover ─────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" /> Turnover & mouvements RH
              </CardTitle>
              <CardDescription>Analyse des entrées et sorties de personnel sur la période.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!turnover ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground gap-2">
                  <Users className="w-8 h-8 opacity-30" />
                  <p className="text-sm font-medium">Aucun mouvement RH sur la période</p>
                  <p className="text-xs">Les mouvements (départs, mutations, promotions…) apparaîtront dès qu'ils seront enregistrés.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Kpi label="Effectif total" value={String(turnover.kpi.totalEffectif)} accent="primary" />
                    <Kpi label="Taux de turnover" value={`${turnover.kpi.turnoverRate} %`} accent={turnover.kpi.turnoverRate > 15 ? "danger" : turnover.kpi.turnoverRate > 8 ? "warning" : "success"} />
                    <Kpi label="Sorties (période)" value={String(turnover.kpi.exits)} accent={turnover.kpi.exits > 0 ? "warning" : "default"} />
                    <Kpi label="Effectif actif" value={String(turnover.kpi.activeCount)} accent="success" />
                  </div>
                  {Object.keys(turnover.byType).length > 0 ? (
                    <div className="space-y-1.5">
                      <SectionTitle icon={Users}>Mouvements par type</SectionTitle>
                      {Object.entries(turnover.byType).map(([type, count]) => {
                        const labels: Record<string, string> = {
                          promotion: "Promotion", mutation: "Mutation", reclassification: "Reclassification",
                          departure: "Départ", retirement: "Retraite", disciplinary: "Disciplinaire",
                        };
                        return (
                          <div key={type} className="flex items-center justify-between p-2.5 border rounded-md text-sm">
                            <span>{labels[type] ?? type}</span>
                            <Badge variant="outline">{count}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Aucun mouvement de personnel enregistré sur la période.</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Parc (rapport existant)
// ────────────────────────────────────────────────────────────────

function ParcTab() {
  const { data: stock, isLoading } = useQuery<StockReport>({
    queryKey: ["report", "stock-daily"],
    queryFn: () => apiFetch("/api/reports/stock-daily"),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => downloadAuthed(`/api/reports/stock-daily/pdf`, `rapport-stock-${new Date().toISOString().slice(0, 10)}.pdf`)} className="bg-primary hover:bg-primary/90">
          <FileText className="w-4 h-4 mr-2" /> Exporter PDF
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wrench className="w-5 h-5 text-primary" /> Bilan journalier du parc</CardTitle>
          <CardDescription>Snapshot en temps réel — disponible, en location, en maintenance.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading || !stock ? <Skeleton className="h-40 w-full" /> : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Kpi label="Parc total" value={String(stock.totals.total)} />
                <Kpi label="Disponible" value={String(stock.totals.available)} accent="success" />
                <Kpi label="En location" value={String(stock.totals.rented)} accent="primary" />
                <Kpi label="Maintenance" value={String(stock.totals.maintenance)} accent="warning" />
              </div>

              <SectionTitle icon={CheckCircle2}>Détail par catégorie</SectionTitle>
              <div className="space-y-2">
                {Object.entries(stock.byCategory).map(([cat, s]) => (
                  <div key={cat} className="flex items-center justify-between p-3 border border-border rounded-md hover:bg-slate-50/50">
                    <div className="font-semibold text-sm">{cat}</div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-slate-500">Total <strong className="text-slate-800">{s.total}</strong></span>
                      <span className="text-green-600">Dispo <strong>{s.available}</strong></span>
                      <span className="text-blue-600">Loc. <strong>{s.rented}</strong></span>
                      <span className="text-yellow-600">Maint. <strong>{s.maintenance}</strong></span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
                <span><TrendingUp className="w-3 h-3 inline mr-1" /> {stock.movements24h} mouvement(s) sur les 24 dernières heures</span>
                <span>Généré le {new Date(stock.generatedAt).toLocaleString("fr-FR")}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
