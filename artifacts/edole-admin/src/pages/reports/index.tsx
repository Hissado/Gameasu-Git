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
  planning: "En planification", active: "Active", in_progress: "En cours",
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
  manager: "Manager", commercial: "Commercial", collaborator: "Collaborateur", viewer: "Lecteur",
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

function FinanceTab({ periodQuery }: { periodQuery: string }) {
  const { data, isLoading } = useQuery<FinanceReport>({
    queryKey: ["report", "finance", periodQuery],
    queryFn: () => apiFetch(`/api/reports/finance?${periodQuery}`),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => downloadAuthed(`/api/reports/finance/export.xlsx?${periodQuery}`, `rapport-finance-${new Date().toISOString().slice(0, 10)}.xlsx`)} className="bg-primary hover:bg-primary/90">
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
              <CardHeader><CardTitle>Top clients (facturé)</CardTitle></CardHeader>
              <CardContent>
                {data.topClients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune facturation sur la période.</p>
                ) : (
                  <div className="space-y-2">
                    {data.topClients.map((c) => (
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
              <CardHeader><CardTitle>Répartition par statut</CardTitle></CardHeader>
              <CardContent>
                {Object.keys(data.byStatus).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune facture sur la période.</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(data.byStatus).map(([s, v]) => (
                      <div key={s} className="flex items-center justify-between p-3 border rounded-md">
                        <Badge variant="outline" className="capitalize">{INVOICE_STATUS_LABELS[s] || s}</Badge>
                        <div className="text-sm"><strong>{v.count}</strong> · {formatFCFA(v.amount)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {data.overdueList.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-500" /> Factures en retard</CardTitle>
                <CardDescription>10 plus gros restes dus.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.overdueList.map((o) => (
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
// Ventes
// ────────────────────────────────────────────────────────────────

function SalesTab({ periodQuery }: { periodQuery: string }) {
  const { data, isLoading } = useQuery<SalesReport>({
    queryKey: ["report", "sales", periodQuery],
    queryFn: () => apiFetch(`/api/reports/sales?${periodQuery}`),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => downloadAuthed(`/api/reports/sales/export.xlsx?${periodQuery}`, `rapport-ventes-${new Date().toISOString().slice(0, 10)}.xlsx`)} className="bg-primary hover:bg-primary/90">
          <Download className="w-4 h-4 mr-2" /> Exporter Excel
        </Button>
      </div>
      {isLoading || !data ? <Skeleton className="h-96 w-full" /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi label="Commandes" value={String(data.kpi.ordersCount)} hint={formatFCFA(data.kpi.ordersAmount)} accent="primary" />
            <Kpi label="Proformas" value={String(data.kpi.proformasCount)} hint={formatFCFA(data.kpi.proformasAmount)} />
            <Kpi label="Conversion proforma" value={`${data.kpi.conversionRate} %`} hint={`${data.kpi.proformasConverted} converties`} accent="success" />
            <Kpi label="Pipeline" value={formatFCFA(data.kpi.pipelineValue)} hint={`${data.kpi.pipelineCount} opportunité(s)`} />
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
              <CardHeader><CardTitle>Top clients (commandes)</CardTitle></CardHeader>
              <CardContent>
                {data.topClients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune commande sur la période.</p>
                ) : (
                  <div className="space-y-2">
                    {data.topClients.map((c) => (
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
              <CardHeader><CardTitle>Pipeline opportunités</CardTitle></CardHeader>
              <CardContent>
                {Object.keys(data.pipeline).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune opportunité.</p>
                ) : (
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(data.pipeline).map(([stage, v]) => ({ name: PIPELINE_STAGE_LABELS[stage] || stage, value: v.value, count: v.count }))}
                          dataKey="value" nameKey="name" outerRadius={80} label={(e) => e.name}
                        >
                          {Object.keys(data.pipeline).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
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
  const { data, isLoading } = useQuery<ProjectsReport>({
    queryKey: ["report", "projects", periodQuery],
    queryFn: () => apiFetch(`/api/reports/projects?${periodQuery}`),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => downloadAuthed(`/api/reports/projects/export.xlsx?${periodQuery}`, `rapport-projets-${new Date().toISOString().slice(0, 10)}.xlsx`)} className="bg-primary hover:bg-primary/90">
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
              <CardHeader><CardTitle>Répartition par statut</CardTitle></CardHeader>
              <CardContent>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(data.byStatus).map(([s, n]) => ({ name: PROJECT_STATUS_LABELS[s] || s, value: n }))}
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
              <CardHeader><CardTitle>Top projets par budget</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.topProjects.slice(0, 6).map((p) => (
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
              </CardContent>
            </Card>
          </div>

          {data.overdueList.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-500" /> Projets en retard</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.overdueList.map((p) => (
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
  const { data, isLoading } = useQuery<HrReport>({
    queryKey: ["report", "hr", periodQuery],
    queryFn: () => apiFetch(`/api/reports/hr?${periodQuery}`),
  });

  const { data: workload } = useQuery<WorkloadEntry[]>({
    queryKey: ["report", "workload"],
    queryFn: () => apiFetch("/api/reports/workload"),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => downloadAuthed(`/api/reports/hr/export.xlsx?${periodQuery}`, `rapport-rh-${new Date().toISOString().slice(0, 10)}.xlsx`)} className="bg-primary hover:bg-primary/90">
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
              <CardHeader><CardTitle>Effectif par département</CardTitle></CardHeader>
              <CardContent>
                {Object.keys(data.byDepartment).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun département renseigné.</p>
                ) : (
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={Object.entries(data.byDepartment).map(([d, n]) => ({ dept: d, effectif: n }))} layout="vertical">
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
              <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5 text-primary" /> Top collaborateurs — heures pointées</CardTitle>
            </CardHeader>
            <CardContent>
              {data.topPerformers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun pointage sur la période.</p>
              ) : (
                <div className="space-y-2">
                  {data.topPerformers.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 border rounded-md">
                      <span className="font-semibold text-sm">{p.name}</span>
                      <Badge className="bg-primary/10 text-primary border-primary/30">{p.hours} h</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {data.expiringList.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500" /> Contrats expirants (≤ 60 jours)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.expiringList.map((c) => (
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

          {workload && workload.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> Charge de travail (tâches & projets)</CardTitle>
                <CardDescription>Indicateur transversal, indépendant de la période.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {workload.map((u) => (
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
