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

// ────────────────────────────────────────────────────────────────
// Sélecteur de période
// ────────────────────────────────────────────────────────────────

type PeriodPreset = "month" | "quarter" | "year" | "custom";

function computePeriod(preset: PeriodPreset, customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (preset === "custom" && customFrom && customTo) return { from: customFrom, to: customTo };
  if (preset === "year") {
    return { from: fmt(new Date(now.getFullYear(), 0, 1)), to: fmt(new Date(now.getFullYear(), 11, 31)) };
  }
  if (preset === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    return { from: fmt(new Date(now.getFullYear(), q * 3, 1)), to: fmt(new Date(now.getFullYear(), q * 3 + 3, 0)) };
  }
  return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
}

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
  expiringList: Array<{ id: string; collaborator: string; type: string; endDate: string | null; jobTitle: string | null }>;
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
  const [preset, setPreset] = useState<PeriodPreset>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const period = useMemo(() => computePeriod(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const periodQuery = `from=${period.from}&to=${period.to}`;
  const periodLabel = `${new Date(period.from).toLocaleDateString("fr-FR")} → ${new Date(period.to).toLocaleDateString("fr-FR")}`;

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
        <div className="flex flex-wrap items-center gap-2">
          <Select value={preset} onValueChange={(v) => setPreset(v as PeriodPreset)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mois en cours</SelectItem>
              <SelectItem value="quarter">Trimestre en cours</SelectItem>
              <SelectItem value="year">Année en cours</SelectItem>
              <SelectItem value="custom">Période personnalisée</SelectItem>
            </SelectContent>
          </Select>
          {preset === "custom" && (
            <>
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-[150px]" />
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-[150px]" />
            </>
          )}
          <Badge variant="outline" className="text-xs px-3 py-1.5 border-primary/30 text-primary bg-primary/5">
            <Calendar className="w-3 h-3 mr-1.5" /> {periodLabel}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid grid-cols-3 md:grid-cols-6 mb-6">
          <TabsTrigger value="overview"><TrendingUp className="w-4 h-4 mr-1.5" />Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="finance"><Banknote className="w-4 h-4 mr-1.5" />Finance</TabsTrigger>
          <TabsTrigger value="sales"><ShoppingCart className="w-4 h-4 mr-1.5" />Ventes</TabsTrigger>
          <TabsTrigger value="projects"><Briefcase className="w-4 h-4 mr-1.5" />Projets</TabsTrigger>
          <TabsTrigger value="hr"><Users className="w-4 h-4 mr-1.5" />RH</TabsTrigger>
          <TabsTrigger value="parc"><Wrench className="w-4 h-4 mr-1.5" />Parc</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab periodQuery={periodQuery} /></TabsContent>
        <TabsContent value="finance"><FinanceTab periodQuery={periodQuery} /></TabsContent>
        <TabsContent value="sales"><SalesTab periodQuery={periodQuery} /></TabsContent>
        <TabsContent value="projects"><ProjectsTab periodQuery={periodQuery} /></TabsContent>
        <TabsContent value="hr"><HrTab periodQuery={periodQuery} /></TabsContent>
        <TabsContent value="parc"><ParcTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Vue d'ensemble
// ────────────────────────────────────────────────────────────────

function OverviewTab({ periodQuery }: { periodQuery: string }) {
  const { data, isLoading } = useQuery<{
    finance: { kpi: FinanceReport["kpi"]; series: FinanceReport["series"] };
    sales: { kpi: SalesReport["kpi"]; series: SalesReport["series"] };
    projects: { kpi: ProjectsReport["kpi"] };
    hr: { kpi: HrReport["kpi"] };
  }>({
    queryKey: ["report", "overview", periodQuery],
    queryFn: () => apiFetch(`/api/reports/overview?${periodQuery}`),
  });

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Chiffre d'affaires facturé" value={formatFCFA(data.finance.kpi.invoicedAmount)} hint={`${data.finance.kpi.invoicedCount} facture(s)`} accent="primary" />
        <Kpi label="Encaissements" value={formatFCFA(data.finance.kpi.collectedAmount)} hint={`Taux : ${data.finance.kpi.collectionRate} %`} accent="success" />
        <Kpi label="Encours en retard" value={formatFCFA(data.finance.kpi.overdueAmount)} hint={`${data.finance.kpi.overdueCount} facture(s)`} accent="danger" />
        <Kpi label="Pipeline ventes" value={formatFCFA(data.sales.kpi.pipelineValue)} hint={`${data.sales.kpi.pipelineCount} opportunité(s)`} accent="default" />
        <Kpi label="Projets actifs" value={String(data.projects.kpi.activeCount)} hint={`${data.projects.kpi.overdueCount} en retard`} accent={data.projects.kpi.overdueCount > 0 ? "warning" : "default"} />
        <Kpi label="Avancement moyen" value={`${data.projects.kpi.avgProgress} %`} accent="default" />
        <Kpi label="Effectif actif" value={String(data.hr.kpi.active)} hint={`${data.hr.kpi.onLeave} en congé`} accent="default" />
        <Kpi label="Heures pointées" value={String(data.hr.kpi.totalHours)} hint={`${data.hr.kpi.unresolvedFlags} anomalie(s) ouverte(s)`} accent={data.hr.kpi.unresolvedFlags > 0 ? "warning" : "default"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" /> Évolution facturation vs encaissement</CardTitle>
          <CardDescription>Les 6 derniers mois — montants en FCFA.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
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

function FinanceTab({ periodQuery }: { periodQuery: string }) {
  const [clientSearch, setClientSearch] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState("all");
  const [supplierSearch, setSupplierSearch] = useState("");

  const { data, isLoading } = useQuery<FinanceReport>({
    queryKey: ["report", "finance", periodQuery],
    queryFn: () => apiFetch(`/api/reports/finance?${periodQuery}`),
  });
  const { data: aged } = useQuery<AgedReceivables>({
    queryKey: ["report", "aged-receivables"],
    queryFn: () => apiFetch("/api/reports/aged-receivables"),
  });
  const { data: agedPayables } = useQuery<AgedPayables>({
    queryKey: ["report", "aged-payables"],
    queryFn: () => apiFetch("/api/reports/aged-payables"),
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

  const filteredAgedByClient = useMemo(() =>
    (aged?.byClient ?? []).filter(c => !clientSearch || c.client.toLowerCase().includes(clientSearch.toLowerCase())),
    [aged, clientSearch]);

  const filteredAgedBySupplier = useMemo(() =>
    (agedPayables?.bySupplier ?? []).filter(s => !supplierSearch || s.supplier.toLowerCase().includes(supplierSearch.toLowerCase())),
    [agedPayables, supplierSearch]);

  const hasFilters = !!(clientSearch || invoiceStatus !== "all" || supplierSearch);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <FilterBar onClear={hasFilters ? () => { setClientSearch(""); setInvoiceStatus("all"); setSupplierSearch(""); } : undefined}>
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
      {isLoading || !data ? <Skeleton className="h-96 w-full" /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi label="Facturé" value={formatFCFA(data.kpi.invoicedAmount)} hint={`${data.kpi.invoicedCount} facture(s)`} accent="primary" />
            <Kpi label="Encaissé" value={formatFCFA(data.kpi.collectedAmount)} accent="success" />
            <Kpi label="Encours total" value={formatFCFA(data.kpi.outstandingAmount)} hint={`${data.kpi.outstandingCount} facture(s)`} accent="warning" />
            <Kpi label="En retard" value={formatFCFA(data.kpi.overdueAmount)} hint={`${data.kpi.overdueCount} facture(s)`} accent="danger" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Évolution mensuelle</CardTitle>
              <CardDescription>Facturation et encaissement — 12 derniers mois.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
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

          {/* ── Balance âgée clients ─────────────────────────── */}
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
                  <Clock className="w-8 h-8 opacity-30" />
                  <p className="text-sm font-medium">Aucune créance impayée</p>
                  <p className="text-xs">Toutes les factures sont soldées, ou aucune facture n'a encore été émise.</p>
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
                  {filteredAgedByClient.length > 0 && (
                    <div>
                      <SectionTitle icon={Users}>Par client {clientSearch && <span className="text-primary normal-case font-normal text-xs">(filtrés)</span>}</SectionTitle>
                      <div className="space-y-1">
                        {filteredAgedByClient.slice(0, 8).map((c) => (
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

          {/* ── Balance âgée fournisseurs ─────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" /> Balance âgée — dettes fournisseurs
                  </CardTitle>
                  {agedPayables && agedPayables.totalOutstanding > 0
                    ? <CardDescription className="mt-1">Total dû : <strong>{formatFCFA(agedPayables.totalOutstanding)}</strong> — répartition par ancienneté.</CardDescription>
                    : <CardDescription className="mt-1">Répartition des factures fournisseurs impayées par ancienneté.</CardDescription>}
                </div>
                <FilterInput placeholder="Fournisseur…" value={supplierSearch} onChange={setSupplierSearch} />
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {!agedPayables || agedPayables.totalOutstanding === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground gap-2">
                  <CheckCircle2 className="w-8 h-8 opacity-30 text-green-500" />
                  <p className="text-sm font-medium">Aucune dette fournisseur en cours</p>
                  <p className="text-xs">Toutes les factures fournisseurs sont réglées, ou aucune n'a encore été enregistrée.</p>
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
                      <SectionTitle icon={Users}>Par fournisseur {supplierSearch && <span className="text-primary normal-case font-normal text-xs">(filtrés)</span>}</SectionTitle>
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
                      <SectionTitle icon={FileText}>Détail des factures</SectionTitle>
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
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Ventes
// ────────────────────────────────────────────────────────────────

function SalesTab({ periodQuery }: { periodQuery: string }) {
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
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Projets
// ────────────────────────────────────────────────────────────────

function ProjectsTab({ periodQuery }: { periodQuery: string }) {
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

function HrTab({ periodQuery }: { periodQuery: string }) {
  const [collabSearch, setCollabSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");

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
    (data?.expiringList ?? []).filter(c =>
      !collabSearch || c.collaborator.toLowerCase().includes(collabSearch.toLowerCase())
    ), [data, collabSearch]);

  const filteredWorkload = useMemo(() =>
    (workload ?? []).filter(u =>
      !collabSearch || u.name.toLowerCase().includes(collabSearch.toLowerCase())
    ), [workload, collabSearch]);

  const filteredByDepartment = useMemo(() => {
    if (!data) return {};
    if (deptFilter === "all") return data.byDepartment;
    return Object.fromEntries(Object.entries(data.byDepartment).filter(([d]) => d === deptFilter));
  }, [data, deptFilter]);

  const hasFilters = !!(collabSearch || deptFilter !== "all");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <FilterBar onClear={hasFilters ? () => { setCollabSearch(""); setDeptFilter("all"); } : undefined}>
          <FilterInput placeholder="Collaborateur…" value={collabSearch} onChange={setCollabSearch} />
          <FilterSelect placeholder="Tous les départements" value={deptFilter} onChange={setDeptFilter} options={deptOptions} />
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
