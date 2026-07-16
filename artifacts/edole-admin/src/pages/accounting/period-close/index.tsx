/**
 * Clôture des périodes financières — Gameasu
 * Month-end close, checklist, audit trail, year-end close.
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Lock, LockOpen, CheckCircle2, Clock, AlertTriangle, RotateCcw,
  CalendarCheck, ChevronRight, Loader2, History, FileText,
  CircleDot, CheckSquare, BookOpen, Layers,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/format";

// ── Types ─────────────────────────────────────────────────────────────────────

type MonthStatus = "open" | "review" | "closed" | "locked";

type PeriodMonth = {
  id: string | null;
  month: string;
  status: MonthStatus;
  closedAt?: string | null;
  closedByName?: string | null;
  approvedAt?: string | null;
  approvedByName?: string | null;
  reopenReason?: string | null;
  notes?: string | null;
};

type ChecklistItem = {
  id: string;
  itemKey: string;
  label: string;
  description: string | null;
  status: "pending" | "in_progress" | "done" | "na";
  assignedToName: string | null;
  completedAt: string | null;
  completedByName: string | null;
  dueDate: string | null;
  comments: string | null;
  sortOrder: number;
};

type MonthStats = {
  invoices: { total: number; pending: number };
  payments: { total: number };
  supplierInvoices: { total: number };
  journalEntries: { total: number; posted: number };
  payslips: { total: number };
  expenses: { total: number; pending: number };
};

type MonthDetail = {
  period: PeriodMonth;
  checklist: ChecklistItem[];
  stats: MonthStats;
  checklistProgress: number;
};

type FiscalYear = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  closedAt?: string | null;
  closedMonths: number;
  totalMonths: number;
  allMonthsClosed: boolean;
};

type AuditLog = {
  id: string;
  action: string;
  userName: string | null;
  month: string | null;
  reason: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

function monthLabel(m: string) {
  const [, mm] = m.split("-");
  return MONTH_NAMES[parseInt(mm) - 1] ?? m;
}

function fullMonthLabel(m: string) {
  const [yyyy, mm] = m.split("-");
  const names = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  return `${names[parseInt(mm) - 1]} ${yyyy}`;
}

const STATUS_CFG: Record<MonthStatus, { label: string; cls: string; icon: React.ReactNode; pill: string }> = {
  open:   { label: "Ouvert",   cls: "text-muted-foreground",  icon: <CircleDot className="w-4 h-4" />, pill: "bg-muted text-muted-foreground border" },
  review: { label: "En revue", cls: "text-amber-600",  icon: <BookOpen className="w-4 h-4" />, pill: "bg-amber-50 text-amber-700 border-amber-200" },
  closed: { label: "Clôturé",  cls: "text-blue-600",   icon: <CheckCircle2 className="w-4 h-4" />, pill: "bg-blue-50 text-blue-700 border-blue-200" },
  locked: { label: "Verrouillé", cls: "text-emerald-600", icon: <Lock className="w-4 h-4" />, pill: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const ITEM_STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pending:     { label: "À faire",     cls: "bg-muted text-muted-foreground border" },
  in_progress: { label: "En cours",   cls: "bg-amber-50 text-amber-700 border-amber-200" },
  done:        { label: "Fait",        cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  na:          { label: "N/A",         cls: "bg-muted/50 text-muted-foreground/60 border" },
};

const ACTION_LABELS: Record<string, string> = {
  month_opened:      "Revue démarrée",
  month_closed:      "Mois clôturé",
  month_approved:    "Mois approuvé",
  month_locked:      "Mois verrouillé",
  month_reopened:    "Mois réouvert",
  year_closed:       "Exercice clôturé",
  year_reopened:     "Exercice réouvert",
  checklist_updated: "Checklist mise à jour",
};

// ── Main component ────────────────────────────────────────────────────────────

export default function PeriodClosePage() {
  const qc = useQueryClient();
  const currentYear = String(new Date().getFullYear());
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [tab, setTab] = useState("calendar");

  // Dialogs
  const [closeDialog, setCloseDialog] = useState(false);
  const [reopenDialog, setReopenDialog] = useState(false);
  const [yearCloseDialog, setYearCloseDialog] = useState<FiscalYear | null>(null);
  const [yearReopenDialog, setYearReopenDialog] = useState<FiscalYear | null>(null);
  const [notes, setNotes] = useState("");
  const [reopenReason, setReopenReason] = useState("");

  // Data queries
  const { data: monthsData, isLoading: loadingMonths } = useQuery<{
    fiscalPeriod: FiscalYear | null;
    months: PeriodMonth[];
    summary: { closed: number; total: number };
  }>({
    queryKey: ["period-close-months", selectedYear],
    queryFn: () => apiFetch(`/api/period-close/months?year=${selectedYear}`),
    staleTime: 30_000,
  });

  const { data: monthDetail, isLoading: loadingDetail } = useQuery<MonthDetail>({
    queryKey: ["period-close-month-detail", selectedMonth],
    queryFn: () => apiFetch(`/api/period-close/months/${selectedMonth}`),
    enabled: !!selectedMonth,
    staleTime: 10_000,
  });

  const { data: yearsData } = useQuery<{ years: FiscalYear[] }>({
    queryKey: ["period-close-years"],
    queryFn: () => apiFetch(`/api/period-close/years`),
    staleTime: 60_000,
  });

  const { data: auditData, isLoading: loadingAudit } = useQuery<{ logs: AuditLog[] }>({
    queryKey: ["period-close-audit", selectedMonth],
    queryFn: () => apiFetch(`/api/period-close/audit${selectedMonth ? `?month=${selectedMonth}` : ""}&limit=50`),
    enabled: tab === "audit",
    staleTime: 15_000,
  });

  // Mutations
  const startReview = useMutation({
    mutationFn: (month: string) => apiFetch(`/api/period-close/months/${month}/start-review`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["period-close-months"] }); qc.invalidateQueries({ queryKey: ["period-close-month-detail"] }); toast.success("Revue démarrée — checklist créée"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeMonth = useMutation({
    mutationFn: ({ month, notes }: { month: string; notes?: string }) =>
      apiFetch(`/api/period-close/months/${month}/close`, { method: "POST", body: JSON.stringify({ notes }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["period-close-months"] }); qc.invalidateQueries({ queryKey: ["period-close-month-detail"] }); toast.success("Mois clôturé avec succès"); setCloseDialog(false); setNotes(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  const reopenMonth = useMutation({
    mutationFn: ({ month, reason }: { month: string; reason: string }) =>
      apiFetch(`/api/period-close/months/${month}/reopen`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["period-close-months"] }); qc.invalidateQueries({ queryKey: ["period-close-month-detail"] }); toast.success("Mois réouvert"); setReopenDialog(false); setReopenReason(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveMonth = useMutation({
    mutationFn: (month: string) => apiFetch(`/api/period-close/months/${month}/approve`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["period-close-months"] }); qc.invalidateQueries({ queryKey: ["period-close-month-detail"] }); toast.success("Mois approuvé et verrouillé"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateChecklist = useMutation({
    mutationFn: ({ id, status, comments }: { id: string; status: string; comments?: string }) =>
      apiFetch(`/api/period-close/checklist/${id}`, { method: "PATCH", body: JSON.stringify({ status, comments }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["period-close-month-detail"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeYear = useMutation({
    mutationFn: ({ id, reason, force }: { id: string; reason?: string; force?: boolean }) =>
      apiFetch(`/api/period-close/years/${id}/close`, { method: "POST", body: JSON.stringify({ reason, force }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["period-close-years"] }); toast.success("Exercice clôturé"); setYearCloseDialog(null); setNotes(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  const reopenYear = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch(`/api/period-close/years/${id}/reopen`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["period-close-years"] }); toast.success("Exercice réouvert"); setYearReopenDialog(null); setReopenReason(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  const months = monthsData?.months ?? [];
  const period = monthDetail?.period;
  const checklist = monthDetail?.checklist ?? [];
  const stats = monthDetail?.stats;
  const selectedMonthData = months.find(m => m.month === selectedMonth);

  const yearOptions = useMemo(() => {
    const y: string[] = [];
    for (let yr = 2015; yr <= 2030; yr++) y.push(String(yr));
    return y;
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        icon={CalendarCheck}
        title="Clôture des périodes"
        subtitle="Month-end close, checklist de clôture et verrouillage des exercices"
        actions={
          <Select value={selectedYear} onValueChange={v => { setSelectedYear(v); setSelectedMonth(null); }}>
            <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Mois clôturés", value: `${monthsData?.summary.closed ?? 0} / 12`, icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" /> },
          { label: "Exercice", value: monthsData?.fiscalPeriod?.name ?? `Exercice ${selectedYear}`, icon: <Layers className="w-5 h-5 text-indigo-500" /> },
          { label: "Statut exercice", value: monthsData?.fiscalPeriod?.status === "closed" ? "Clôturé" : "Ouvert", icon: monthsData?.fiscalPeriod?.status === "closed" ? <Lock className="w-5 h-5 text-blue-500" /> : <LockOpen className="w-5 h-5 text-muted-foreground/60" /> },
          { label: "Mois sélectionné", value: selectedMonth ? fullMonthLabel(selectedMonth) : "—", icon: <Clock className="w-5 h-5 text-amber-500" /> },
        ].map(k => (
          <Card key={k.label} className="border shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              {k.icon}
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="font-semibold text-sm leading-tight">{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="calendar"><CalendarCheck className="w-4 h-4 mr-1.5" />Calendrier</TabsTrigger>
          <TabsTrigger value="checklist" disabled={!selectedMonth}><CheckSquare className="w-4 h-4 mr-1.5" />Checklist{selectedMonth ? ` — ${fullMonthLabel(selectedMonth)}` : ""}</TabsTrigger>
          <TabsTrigger value="years"><Layers className="w-4 h-4 mr-1.5" />Exercices</TabsTrigger>
          <TabsTrigger value="audit"><History className="w-4 h-4 mr-1.5" />Audit trail</TabsTrigger>
        </TabsList>

        {/* ─── TAB CALENDRIER ──────────────────────────────────────────── */}
        <TabsContent value="calendar" className="mt-4">
          <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
            {loadingMonths && Array.from({ length: 12 }).map((_, i) => (
              <Card key={i} className="border shadow-sm animate-pulse h-28" />
            ))}
            {!loadingMonths && months.map(m => {
              const cfg = STATUS_CFG[m.status as MonthStatus] ?? STATUS_CFG.open;
              const isSelected = m.month === selectedMonth;
              const now = new Date().toISOString().slice(0, 7);
              const isCurrent = m.month === now;
              return (
                <Card
                  key={m.month}
                  onClick={() => { setSelectedMonth(m.month); setTab("checklist"); }}
                  className={`border shadow-sm cursor-pointer transition-all hover:shadow-md hover:border-primary/50 ${isSelected ? "ring-2 ring-primary border-primary" : ""} ${isCurrent ? "border-amber-300" : ""}`}
                >
                  <CardContent className="p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{monthLabel(m.month)}</span>
                      {isCurrent && <Badge className="text-[10px] px-1 py-0 bg-amber-100 text-amber-700 border-amber-200">Actuel</Badge>}
                    </div>
                    <div className={`flex items-center gap-1.5 ${cfg.cls}`}>
                      {cfg.icon}
                      <span className="text-xs font-medium">{cfg.label}</span>
                    </div>
                    {m.closedByName && (
                      <p className="text-[10px] text-muted-foreground truncate">par {m.closedByName}</p>
                    )}
                    {m.closedAt && (
                      <p className="text-[10px] text-muted-foreground">{formatDate(m.closedAt)}</p>
                    )}
                    <ChevronRight className="w-3 h-3 text-muted-foreground self-end" />
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {selectedMonth && (
            <div className="mt-4 flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setTab("checklist")}>
                <FileText className="w-4 h-4 mr-1.5" />Ouvrir la checklist
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ─── TAB CHECKLIST ───────────────────────────────────────────── */}
        <TabsContent value="checklist" className="mt-4">
          {!selectedMonth && (
            <div className="text-center py-16 text-muted-foreground">
              <CalendarCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Sélectionnez un mois dans le calendrier</p>
            </div>
          )}

          {selectedMonth && (
            <div className="space-y-4">
              {/* Entête du mois */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold">{fullMonthLabel(selectedMonth)}</h2>
                  {period && (
                    <Badge className={STATUS_CFG[period.status as MonthStatus]?.pill ?? ""}>
                      {STATUS_CFG[period.status as MonthStatus]?.label ?? period.status}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {/* Boutons selon l'état */}
                  {(!period || period.status === "open") && (
                    <Button size="sm" onClick={() => startReview.mutate(selectedMonth)} disabled={startReview.isPending}>
                      {startReview.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <BookOpen className="w-4 h-4 mr-1.5" />}
                      Démarrer la revue
                    </Button>
                  )}
                  {period?.status === "review" && (
                    <Button size="sm" onClick={() => setCloseDialog(true)}>
                      <Lock className="w-4 h-4 mr-1.5" />Clôturer le mois
                    </Button>
                  )}
                  {period?.status === "closed" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setReopenDialog(true)}>
                        <RotateCcw className="w-4 h-4 mr-1.5" />Réouvrir
                      </Button>
                      <Button size="sm" onClick={() => approveMonth.mutate(selectedMonth)} disabled={approveMonth.isPending}>
                        {approveMonth.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                        Approuver & Verrouiller
                      </Button>
                    </>
                  )}
                  {period?.status === "locked" && (
                    <Button size="sm" variant="outline" onClick={() => setReopenDialog(true)}>
                      <LockOpen className="w-4 h-4 mr-1.5" />Réouvrir (admin)
                    </Button>
                  )}
                </div>
              </div>

              {/* Stats du mois */}
              {stats && (
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {[
                    { label: "Factures", value: stats.invoices.total, warn: stats.invoices.pending > 0, warnMsg: `${stats.invoices.pending} en attente` },
                    { label: "Encaissements", value: stats.payments.total },
                    { label: "Fact. fourn.", value: stats.supplierInvoices.total },
                    { label: "Écritures", value: stats.journalEntries.total, warn: stats.journalEntries.total > stats.journalEntries.posted, warnMsg: `${stats.journalEntries.total - stats.journalEntries.posted} brouillons` },
                    { label: "Bulletins", value: stats.payslips.total },
                    { label: "Notes de frais", value: stats.expenses.total, warn: stats.expenses.pending > 0, warnMsg: `${stats.expenses.pending} en cours` },
                  ].map(s => (
                    <Card key={s.label} className="border shadow-sm">
                      <CardContent className="p-2 text-center">
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                        <p className="text-lg font-bold">{s.value}</p>
                        {s.warn && s.warnMsg && (
                          <p className="text-[10px] text-amber-600 flex items-center justify-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" />{s.warnMsg}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Barre de progression checklist */}
              {checklist.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progression checklist</span>
                    <span className="font-semibold">{monthDetail?.checklistProgress ?? 0}%</span>
                  </div>
                  <Progress value={monthDetail?.checklistProgress ?? 0} className="h-2" />
                </div>
              )}

              {/* Checklist */}
              {loadingDetail && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}
              {!loadingDetail && checklist.length === 0 && period?.status === "open" && (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">Démarrez la revue pour initialiser la checklist.</p>
                </div>
              )}
              {checklist.length > 0 && (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Tâche</TableHead>
                        <TableHead className="w-32">Statut</TableHead>
                        <TableHead className="w-40">Responsable</TableHead>
                        <TableHead className="w-32">Validé le</TableHead>
                        <TableHead className="w-32 text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {checklist.map(item => {
                        const sCfg = ITEM_STATUS_CFG[item.status] ?? ITEM_STATUS_CFG.pending;
                        const canEdit = period && !["locked"].includes(period.status);
                        return (
                          <TableRow key={item.id} className={item.status === "done" ? "opacity-70" : ""}>
                            <TableCell className="text-muted-foreground text-xs">{item.sortOrder}</TableCell>
                            <TableCell>
                              <p className="font-medium text-sm leading-tight">{item.label}</p>
                              {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                              {item.comments && <p className="text-xs text-blue-600 mt-0.5 italic">"{item.comments}"</p>}
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-xs ${sCfg.cls}`}>{sCfg.label}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{item.assignedToName ?? "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {item.completedAt ? formatDate(item.completedAt) : "—"}
                              {item.completedByName && <span className="block">{item.completedByName}</span>}
                            </TableCell>
                            <TableCell className="text-right">
                              {canEdit && (
                                <div className="flex gap-1 justify-end">
                                  {item.status !== "done" && item.status !== "na" && (
                                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-emerald-600"
                                      onClick={() => updateChecklist.mutate({ id: item.id, status: "done" })}>
                                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Fait
                                    </Button>
                                  )}
                                  {item.status !== "na" && item.status !== "pending" && (
                                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                                      onClick={() => updateChecklist.mutate({ id: item.id, status: "pending" })}>
                                      <RotateCcw className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                  {item.status === "pending" && (
                                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground/60"
                                      onClick={() => updateChecklist.mutate({ id: item.id, status: "na" })}>
                                      N/A
                                    </Button>
                                  )}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Infos de clôture */}
              {period?.closedAt && (
                <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-100 rounded p-2">
                  Clôturé le {formatDate(period.closedAt)}{period.closedByName ? ` par ${period.closedByName}` : ""}
                  {period.notes && ` — ${period.notes}`}
                </div>
              )}
              {period?.reopenReason && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded p-2">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />Réouvert : {period.reopenReason}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ─── TAB EXERCICES ───────────────────────────────────────────── */}
        <TabsContent value="years" className="mt-4">
          <div className="space-y-3">
            {(yearsData?.years ?? []).map(y => (
              <Card key={y.id} className="border shadow-sm">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="min-w-0">
                      <p className="font-semibold">{y.name}</p>
                      <p className="text-xs text-muted-foreground">{y.startDate} → {y.endDate}</p>
                    </div>
                    <Badge className={y.status === "closed" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-muted text-muted-foreground border"}>
                      {y.status === "closed" ? "Clôturé" : "Ouvert"}
                    </Badge>
                    <div className="flex items-center gap-2 flex-1 max-w-xs">
                      <Progress value={(y.closedMonths / 12) * 100} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{y.closedMonths}/12 mois</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {y.status === "open" && (
                      <Button size="sm" variant={y.allMonthsClosed ? "default" : "outline"} onClick={() => setYearCloseDialog(y)}>
                        <Lock className="w-4 h-4 mr-1.5" />Clôturer l'exercice
                      </Button>
                    )}
                    {y.status === "closed" && (
                      <Button size="sm" variant="outline" onClick={() => setYearReopenDialog(y)}>
                        <LockOpen className="w-4 h-4 mr-1.5" />Réouvrir
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ─── TAB AUDIT ───────────────────────────────────────────────── */}
        <TabsContent value="audit" className="mt-4">
          {loadingAudit && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}
          {!loadingAudit && (auditData?.logs ?? []).length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Aucune action enregistrée</p>
            </div>
          )}
          {(auditData?.logs ?? []).length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(auditData?.logs ?? []).map(log => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge className={
                          log.action.includes("closed") || log.action.includes("approved") ? "bg-blue-50 text-blue-700 border-blue-200" :
                          log.action.includes("reopened") ? "bg-amber-50 text-amber-700 border-amber-200" :
                          log.action.includes("opened") ? "bg-muted text-muted-foreground border" :
                          "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }>
                          {ACTION_LABELS[log.action] ?? log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{log.month ? fullMonthLabel(log.month) : "—"}</TableCell>
                      <TableCell className="text-sm">{log.userName ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground italic max-w-xs truncate">{log.reason ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(log.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Dialog : Clôturer le mois ─────────────────────────────────── */}
      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clôturer {selectedMonth ? fullMonthLabel(selectedMonth) : ""}</DialogTitle>
            <DialogDescription>
              Cette action marque la période comme clôturée. Elle restera modifiable jusqu'à l'approbation finale.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes (optionnel)</label>
            <Textarea placeholder="Observations de clôture…" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialog(false)}>Annuler</Button>
            <Button onClick={() => selectedMonth && closeMonth.mutate({ month: selectedMonth, notes })} disabled={closeMonth.isPending}>
              {closeMonth.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Lock className="w-4 h-4 mr-1.5" />}
              Confirmer la clôture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog : Réouvrir le mois ─────────────────────────────────── */}
      <Dialog open={reopenDialog} onOpenChange={setReopenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réouvrir {selectedMonth ? fullMonthLabel(selectedMonth) : ""}</DialogTitle>
            <DialogDescription>
              La réouverture est enregistrée dans l'audit trail et nécessite un motif obligatoire.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Motif de réouverture *</label>
            <Textarea placeholder="Ex: Correction d'une écriture de TVA…" value={reopenReason} onChange={e => setReopenReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopenDialog(false)}>Annuler</Button>
            <Button variant="destructive" onClick={() => selectedMonth && reopenMonth.mutate({ month: selectedMonth, reason: reopenReason })} disabled={!reopenReason.trim() || reopenMonth.isPending}>
              {reopenMonth.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <LockOpen className="w-4 h-4 mr-1.5" />}
              Réouvrir le mois
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog : Clôturer l'exercice ──────────────────────────────── */}
      {yearCloseDialog && (
        <Dialog open onOpenChange={() => setYearCloseDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clôturer l'exercice {yearCloseDialog.name}</DialogTitle>
              <DialogDescription>
                {yearCloseDialog.allMonthsClosed
                  ? "Tous les mois sont clôturés. Cette action verrouille définitivement l'exercice fiscal."
                  : `Attention : ${12 - yearCloseDialog.closedMonths} mois ne sont pas encore clôturés. Vous pouvez forcer la clôture.`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label className="text-sm font-medium">Motif (optionnel)</label>
              <Textarea placeholder="Clôture annuelle exercice N…" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setYearCloseDialog(null)}>Annuler</Button>
              {!yearCloseDialog.allMonthsClosed && (
                <Button variant="outline" onClick={() => closeYear.mutate({ id: yearCloseDialog.id, reason: notes, force: true })} disabled={closeYear.isPending}>
                  Forcer la clôture
                </Button>
              )}
              <Button onClick={() => closeYear.mutate({ id: yearCloseDialog.id, reason: notes })} disabled={closeYear.isPending}>
                {closeYear.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Lock className="w-4 h-4 mr-1.5" />}
                Clôturer l'exercice
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ─── Dialog : Réouvrir l'exercice ──────────────────────────────── */}
      {yearReopenDialog && (
        <Dialog open onOpenChange={() => setYearReopenDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Réouvrir l'exercice {yearReopenDialog.name}</DialogTitle>
              <DialogDescription>Action enregistrée dans l'audit trail. Motif obligatoire.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label className="text-sm font-medium">Motif *</label>
              <Textarea placeholder="Motif de réouverture…" value={reopenReason} onChange={e => setReopenReason(e.target.value)} rows={3} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setYearReopenDialog(null)}>Annuler</Button>
              <Button variant="destructive" onClick={() => reopenYear.mutate({ id: yearReopenDialog.id, reason: reopenReason })} disabled={!reopenReason.trim() || reopenYear.isPending}>
                {reopenYear.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <LockOpen className="w-4 h-4 mr-1.5" />}
                Réouvrir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
