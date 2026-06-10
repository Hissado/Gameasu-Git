import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { HrShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock, Users, Timer, AlertTriangle, Loader2 } from "lucide-react";

type TimesheetSession = {
  id: string; collaboratorId: string; collaboratorName: string;
  collaboratorAvatar: string | null; departmentName: string | null;
  workDate: string; clockInAt: string | null; clockOutAt: string | null;
  totalMinutes: number; effectiveMinutes: number; expectedMinutes: number;
  isLate: boolean; isEarlyLeave: boolean;
  approvalStatus: string; approvedByName: string | null; approvalNote: string | null;
  flagCount: number;
};

type WeekStats = {
  totalSessions: number; pendingApproval: number;
  totalHours: number; lateCount: number; flaggedCount: number;
};

function getWeekStart(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function fmtTime(ts: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function fmtDuration(minutes: number) {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return `${h}h${m > 0 ? String(m).padStart(2, "0") : ""}`;
}
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-300",
  approved: "bg-emerald-100 text-emerald-700 border-emerald-300",
  rejected: "bg-red-100 text-red-700 border-red-300",
};
const STATUS_LABELS: Record<string, string> = { pending: "En attente", approved: "Approuvé", rejected: "Rejeté" };

export default function TimesheetsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [decision, setDecision] = useState<{ session: TimesheetSession; action: "approve" | "reject" } | null>(null);
  const [note, setNote] = useState("");

  const weekEnd = addDays(weekStart, 6);
  const weekLabel = `${weekStart.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} — ${weekEnd.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;

  const qParams = new URLSearchParams({ start: fmtDate(weekStart), end: fmtDate(weekEnd) });
  if (deptFilter !== "all") qParams.set("departmentId", deptFilter);
  if (statusFilter !== "all") qParams.set("approvalStatus", statusFilter);

  const { data, isLoading } = useQuery<{ data: TimesheetSession[]; stats: WeekStats }>({
    queryKey: ["hr-timesheets", fmtDate(weekStart), deptFilter, statusFilter],
    queryFn: () => apiFetch(`/api/hr/timesheets?${qParams}`),
  });

  const { data: deptData } = useQuery<{ departments: any[] }>({
    queryKey: ["hr-orgchart"],
    queryFn: () => apiFetch("/api/hr/orgchart"),
  });

  const approveMut = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note: string }) =>
      apiFetch(`/api/hr/timesheets/${id}/approve`, { method: "PATCH", body: JSON.stringify({ status, note }) }),
    onSuccess: (_, vars) => {
      toast({ title: vars.status === "approved" ? "Feuille approuvée" : "Feuille rejetée" });
      setDecision(null); setNote("");
      qc.invalidateQueries({ queryKey: ["hr-timesheets"] });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const bulkApproveMut = useMutation({
    mutationFn: () => {
      const ids = (data?.data ?? []).filter(s => s.approvalStatus === "pending").map(s => s.id);
      return apiFetch("/api/hr/timesheets/bulk-approve", { method: "POST", body: JSON.stringify({ ids }) });
    },
    onSuccess: () => { toast({ title: "Toutes les feuilles approuvées" }); qc.invalidateQueries({ queryKey: ["hr-timesheets"] }); },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const sessions = data?.data ?? [];
  const stats = data?.stats;
  const depts = deptData?.departments ?? [];
  const pendingCount = sessions.filter(s => s.approvalStatus === "pending").length;

  return (
    <HrShell
      title="Feuilles de temps"
      subtitle="Approbation des heures pointées par semaine"
      actions={
        <div className="flex gap-2">
          {pendingCount > 0 && (
            <Button variant="outline" onClick={() => bulkApproveMut.mutate()} disabled={bulkApproveMut.isPending} size="sm">
              {bulkApproveMut.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
              Tout approuver ({pendingCount})
            </Button>
          )}
        </div>
      }
    >
      {/* Navigation semaine */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekStart(d => addDays(d, -7))}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm font-semibold min-w-[200px] text-center">{weekLabel}</span>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(d => addDays(d, 7))}><ChevronRight className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setWeekStart(getWeekStart(new Date()))}>Cette semaine</Button>
        </div>
        <div className="flex gap-2">
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-40 h-8 text-sm"><SelectValue placeholder="Département" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {depts.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="approved">Approuvés</SelectItem>
              <SelectItem value="rejected">Rejetés</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
          {[
            { label: "Sessions", value: stats.totalSessions, icon: Users, color: "" },
            { label: "En attente", value: stats.pendingApproval, icon: Clock, color: "text-amber-600" },
            { label: "Heures totales", value: fmtDuration(stats.totalHours * 60), icon: Timer, color: "" },
            { label: "Retards", value: stats.lateCount, icon: AlertTriangle, color: "text-red-500" },
            { label: "Anomalies", value: stats.flaggedCount, icon: AlertTriangle, color: "text-orange-500" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}><CardContent className="p-3 flex items-center gap-2">
              <Icon className={`w-4 h-4 shrink-0 text-slate-400 ${color}`} />
              <div><p className="text-xs text-muted-foreground">{label}</p><p className={`text-lg font-bold ${color}`}>{value}</p></div>
            </CardContent></Card>
          ))}
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p>Aucune feuille de temps pour cette semaine</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground border-b">
                <tr>
                  <th className="text-left px-4 py-2.5">Collaborateur</th>
                  <th className="text-left px-4 py-2.5">Date</th>
                  <th className="text-center px-4 py-2.5">Entrée</th>
                  <th className="text-center px-4 py-2.5">Sortie</th>
                  <th className="text-center px-4 py-2.5">Effectif</th>
                  <th className="text-center px-4 py-2.5">Attendu</th>
                  <th className="text-center px-4 py-2.5">Flags</th>
                  <th className="text-center px-4 py-2.5">Statut</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => {
                  const pct = s.expectedMinutes > 0 ? Math.round((s.effectiveMinutes / s.expectedMinutes) * 100) : 0;
                  const under = pct < 80;
                  return (
                    <tr key={s.id} className="border-t hover:bg-muted/20">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-6 h-6">
                            {s.collaboratorAvatar && <AvatarFallback />}
                            <AvatarFallback className="text-[10px] bg-slate-600 text-white">
                              {s.collaboratorName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-xs">{s.collaboratorName}</p>
                            {s.departmentName && <p className="text-xs text-muted-foreground">{s.departmentName}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs">{new Date(s.workDate).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</td>
                      <td className="px-4 py-2.5 text-center text-xs font-mono">{fmtTime(s.clockInAt)}{s.isLate && <span className="ml-1 text-red-500 text-[9px]">⏰</span>}</td>
                      <td className="px-4 py-2.5 text-center text-xs font-mono">{fmtTime(s.clockOutAt)}{s.isEarlyLeave && <span className="ml-1 text-amber-500 text-[9px]">⬆</span>}</td>
                      <td className={`px-4 py-2.5 text-center font-semibold text-xs ${under ? "text-red-600" : "text-emerald-700"}`}>{fmtDuration(s.effectiveMinutes)}</td>
                      <td className="px-4 py-2.5 text-center text-xs text-muted-foreground">{fmtDuration(s.expectedMinutes)}</td>
                      <td className="px-4 py-2.5 text-center">
                        {s.flagCount > 0 && <Badge variant="destructive" className="text-[10px] h-4 px-1">{s.flagCount}</Badge>}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-[10px] font-medium border px-1.5 py-0.5 rounded-full ${STATUS_COLORS[s.approvalStatus] ?? ""}`}>
                          {STATUS_LABELS[s.approvalStatus] ?? s.approvalStatus}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {s.approvalStatus === "pending" && (
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="outline" className="h-6 text-[10px] text-emerald-700 border-emerald-300" onClick={() => setDecision({ session: s, action: "approve" })}>
                              <CheckCircle2 className="w-3 h-3 mr-0.5" />OK
                            </Button>
                            <Button size="sm" variant="outline" className="h-6 text-[10px] text-red-700 border-red-300" onClick={() => setDecision({ session: s, action: "reject" })}>
                              <XCircle className="w-3 h-3 mr-0.5" />Non
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!decision} onOpenChange={o => { if (!o) { setDecision(null); setNote(""); } }}>
        <DialogContent className="max-w-md">
          {decision && (
            <>
              <DialogHeader>
                <DialogTitle>{decision.action === "approve" ? "Approuver la feuille" : "Rejeter la feuille"}</DialogTitle>
                <DialogDescription>
                  {decision.session.collaboratorName} — {new Date(decision.session.workDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                  {" — "}{fmtDuration(decision.session.effectiveMinutes)} effectif
                </DialogDescription>
              </DialogHeader>
              <div>
                <label className="text-xs font-semibold">Note (optionnelle)</label>
                <Textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Commentaire pour le collaborateur…" />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setDecision(null); setNote(""); }}>Annuler</Button>
                <Button
                  className={decision.action === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}
                  disabled={approveMut.isPending}
                  onClick={() => approveMut.mutate({ id: decision.session.id, status: decision.action === "approve" ? "approved" : "rejected", note })}>
                  {approveMut.isPending && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                  {decision.action === "approve" ? "Approuver" : "Rejeter"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
