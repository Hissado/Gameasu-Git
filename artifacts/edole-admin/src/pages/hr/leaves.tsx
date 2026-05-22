import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { HrShell } from "./_layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Plus, CheckCircle2, XCircle, Clock, Filter, User, Loader2 } from "lucide-react";

type LeaveRequest = {
  id: string;
  collaboratorId: string;
  collaboratorName: string;
  collaboratorAvatar?: string | null;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string | null;
  notes?: string | null;
  status: string;
  rejectionReason?: string | null;
  approvedAt?: string | null;
  createdAt: string;
};

type Stats = {
  pendingCount: number;
  approvedCount: number;
  approvedDays: number;
  byType: Array<{ type: string; count: number; days: number }>;
};

type Collaborator = { id: string; firstName: string; lastName: string; avatarUrl?: string | null };

const TYPE_LABELS: Record<string, string> = {
  congé_payé: "Congé payé",
  RTT: "RTT",
  maladie: "Maladie",
  maternité: "Maternité",
  paternité: "Paternité",
  sans_solde: "Sans solde",
  formation: "Formation",
  exceptionnel: "Exceptionnel",
  autre: "Autre",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  cancelled: "bg-slate-100 text-slate-600 border-slate-200",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  approved: "Approuvé",
  rejected: "Refusé",
  cancelled: "Annulé",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3 h-3" />,
  approved: <CheckCircle2 className="w-3 h-3" />,
  rejected: <XCircle className="w-3 h-3" />,
  cancelled: <XCircle className="w-3 h-3" />,
};

function calcDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start), e = new Date(end);
  let d = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) d++;
    cur.setDate(cur.getDate() + 1);
  }
  return d;
}

const CURRENT_YEAR = new Date().getFullYear();

export default function LeavesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState(String(CURRENT_YEAR));
  const [collabFilter, setCollabFilter] = useState("all");

  const [openCreate, setOpenCreate] = useState(false);
  const [openDecide, setOpenDecide] = useState<{ leave: LeaveRequest; action: "approve" | "reject" } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [form, setForm] = useState({
    collaboratorId: "",
    type: "congé_payé",
    startDate: "",
    endDate: "",
    days: "",
    reason: "",
    notes: "",
  });

  const { data: collabsData } = useQuery<{ data: Collaborator[] }>({
    queryKey: ["collaborators-list"],
    queryFn: () => apiFetch("/api/collaborators"),
  });
  const collaborators = collabsData?.data ?? [];

  const qParams = new URLSearchParams();
  if (statusFilter !== "all") qParams.set("status", statusFilter);
  if (yearFilter) qParams.set("year", yearFilter);
  if (collabFilter !== "all") qParams.set("collaboratorId", collabFilter);

  const { data: leavesData, isLoading } = useQuery<{ data: LeaveRequest[] }>({
    queryKey: ["hr-leaves", statusFilter, yearFilter, collabFilter],
    queryFn: () => apiFetch(`/api/hr/leaves?${qParams.toString()}`),
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["hr-leaves-stats", yearFilter],
    queryFn: () => apiFetch(`/api/hr/leaves/stats?year=${yearFilter}`),
  });

  const createMutation = useMutation({
    mutationFn: () => apiFetch("/api/hr/leaves", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        days: form.days ? Number(form.days) : calcDays(form.startDate, form.endDate),
      }),
    }),
    onSuccess: () => {
      toast({ title: "Demande de congé enregistrée" });
      setOpenCreate(false);
      setForm({ collaboratorId: "", type: "congé_payé", startDate: "", endDate: "", days: "", reason: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["hr-leaves"] });
      qc.invalidateQueries({ queryKey: ["hr-leaves-stats"] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, rejectionReason }: { id: string; status: string; rejectionReason?: string }) =>
      apiFetch(`/api/hr/leaves/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, rejectionReason }) }),
    onSuccess: (_, vars) => {
      const label = vars.status === "approved" ? "Demande approuvée" : "Demande refusée";
      toast({ title: label });
      setOpenDecide(null);
      setRejectReason("");
      qc.invalidateQueries({ queryKey: ["hr-leaves"] });
      qc.invalidateQueries({ queryKey: ["hr-leaves-stats"] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const autoCalcDays = () => {
    if (form.startDate && form.endDate && !form.days) {
      setForm(f => ({ ...f, days: String(calcDays(f.startDate, f.endDate)) }));
    }
  };

  const leaves = leavesData?.data ?? [];

  return (
    <HrShell
      title="Absences & Congés"
      subtitle="Gestion des demandes de congé, RTT, maladie et absences des collaborateurs"
      actions={
        <Button onClick={() => setOpenCreate(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />Nouvelle demande
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs uppercase text-muted-foreground">En attente</div>
              <div className="text-2xl font-bold mt-1 text-amber-600">{stats?.pendingCount ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs uppercase text-muted-foreground">Approuvées {yearFilter}</div>
              <div className="text-2xl font-bold mt-1 text-emerald-600">{stats?.approvedCount ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs uppercase text-muted-foreground">Jours approuvés</div>
              <div className="text-2xl font-bold mt-1">{stats?.approvedDays ?? 0} j</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs uppercase text-muted-foreground">Types distincts</div>
              <div className="text-2xl font-bold mt-1">{stats?.byType.length ?? 0}</div>
            </CardContent>
          </Card>
        </div>

        {(stats?.byType?.length ?? 0) > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Répartition par type — {yearFilter}</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                {stats!.byType.map((t) => (
                  <div key={t.type} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                    <span className="text-sm font-medium">{TYPE_LABELS[t.type] ?? t.type}</span>
                    <Badge variant="secondary">{t.count} dem.</Badge>
                    <span className="text-xs text-muted-foreground">{t.days} j</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-3 items-center">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="approved">Approuvés</SelectItem>
              <SelectItem value="rejected">Refusés</SelectItem>
              <SelectItem value="cancelled">Annulés</SelectItem>
            </SelectContent>
          </Select>

          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={collabFilter} onValueChange={setCollabFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Tous les collaborateurs" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les collaborateurs</SelectItem>
              {collaborators.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
              </div>
            ) : leaves.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3 text-muted-foreground">
                <CalendarDays className="w-10 h-10 opacity-30" />
                <span className="text-sm italic">Aucune demande pour ces critères</span>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-muted-foreground border-b">
                  <tr>
                    <th className="text-left px-4 py-3">Collaborateur</th>
                    <th className="text-left px-4 py-3">Type</th>
                    <th className="text-left px-4 py-3">Période</th>
                    <th className="text-center px-4 py-3">Jours</th>
                    <th className="text-left px-4 py-3">Motif</th>
                    <th className="text-center px-4 py-3">Statut</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map((l) => (
                    <tr key={l.id} className="border-t hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-7 h-7 border border-border">
                            {l.collaboratorAvatar && <AvatarImage src={l.collaboratorAvatar} />}
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                              {l.collaboratorName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground">{l.collaboratorName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs font-normal">
                          {TYPE_LABELS[l.type] ?? l.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <div>{new Date(l.startDate).toLocaleDateString("fr-FR")}</div>
                        <div>→ {new Date(l.endDate).toLocaleDateString("fr-FR")}</div>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold">{l.days}</td>
                      <td className="px-4 py-3 max-w-[180px] truncate text-muted-foreground text-xs">{l.reason ?? "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[l.status] ?? ""}`}>
                          {STATUS_ICONS[l.status]}
                          {STATUS_LABELS[l.status] ?? l.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {l.status === "pending" && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline"
                              className="h-7 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                              onClick={() => setOpenDecide({ leave: l, action: "approve" })}>
                              <CheckCircle2 className="w-3 h-3 mr-1" />Approuver
                            </Button>
                            <Button size="sm" variant="outline"
                              className="h-7 text-xs text-red-700 border-red-300 hover:bg-red-50"
                              onClick={() => setOpenDecide({ leave: l, action: "reject" })}>
                              <XCircle className="w-3 h-3 mr-1" />Refuser
                            </Button>
                          </div>
                        )}
                        {l.status === "rejected" && l.rejectionReason && (
                          <span className="text-xs text-red-600 italic">{l.rejectionReason}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle demande de congé</DialogTitle>
            <DialogDescription>Saisissez les informations de la demande d'absence.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs font-semibold mb-1 block">Collaborateur *</Label>
              <Select value={form.collaboratorId} onValueChange={(v) => setForm({ ...form, collaboratorId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un collaborateur" />
                </SelectTrigger>
                <SelectContent>
                  {collaborators.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-muted-foreground" />
                        {c.firstName} {c.lastName}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label className="text-xs font-semibold mb-1 block">Type de congé *</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold mb-1 block">Date de début *</Label>
              <Input type="date" value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value, days: "" })}
                onBlur={autoCalcDays} />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Date de fin *</Label>
              <Input type="date" value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value, days: "" })}
                onBlur={autoCalcDays} />
            </div>

            <div>
              <Label className="text-xs font-semibold mb-1 block">
                Jours ouvrables
                {form.startDate && form.endDate && !form.days && (
                  <span className="text-xs text-muted-foreground ml-1">
                    (estimé : {calcDays(form.startDate, form.endDate)} j)
                  </span>
                )}
              </Label>
              <Input type="number" min="0.5" step="0.5" value={form.days}
                placeholder={form.startDate && form.endDate ? String(calcDays(form.startDate, form.endDate)) : ""}
                onChange={(e) => setForm({ ...form, days: e.target.value })} />
            </div>

            <div className="col-span-2">
              <Label className="text-xs font-semibold mb-1 block">Motif</Label>
              <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Motif de l'absence…" />
            </div>

            <div className="col-span-2">
              <Label className="text-xs font-semibold mb-1 block">Notes internes</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Informations complémentaires…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>Annuler</Button>
            <Button
              disabled={!form.collaboratorId || !form.type || !form.startDate || !form.endDate || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              className="bg-primary hover:bg-primary/90">
              {createMutation.isPending && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!openDecide} onOpenChange={(o) => { if (!o) { setOpenDecide(null); setRejectReason(""); } }}>
        <DialogContent className="max-w-md">
          {openDecide && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {openDecide.action === "approve" ? "Approuver la demande" : "Refuser la demande"}
                </DialogTitle>
                <DialogDescription>
                  {openDecide.leave.collaboratorName} — {TYPE_LABELS[openDecide.leave.type] ?? openDecide.leave.type} —{" "}
                  {new Date(openDecide.leave.startDate).toLocaleDateString("fr-FR")} au{" "}
                  {new Date(openDecide.leave.endDate).toLocaleDateString("fr-FR")} ({openDecide.leave.days} j)
                </DialogDescription>
              </DialogHeader>

              {openDecide.action === "reject" && (
                <div>
                  <Label className="text-xs font-semibold mb-1 block">Motif du refus</Label>
                  <Textarea rows={2} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Expliquer la raison du refus…" />
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => { setOpenDecide(null); setRejectReason(""); }}>Annuler</Button>
                <Button
                  disabled={statusMutation.isPending}
                  onClick={() => statusMutation.mutate({
                    id: openDecide.leave.id,
                    status: openDecide.action === "approve" ? "approved" : "rejected",
                    rejectionReason: rejectReason || undefined,
                  })}
                  className={openDecide.action === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-red-600 hover:bg-red-700"
                  }>
                  {statusMutation.isPending && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                  {openDecide.action === "approve" ? "Approuver" : "Refuser"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
