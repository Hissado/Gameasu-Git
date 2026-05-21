import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Truck, Map as MapIcon, AlertTriangle, ClipboardCheck, CheckCircle2, ShieldAlert,
  Calendar, Activity, Plus, Search, Users, Wrench, MapPin, Clock, Zap, FileText,
  PlayCircle, PauseCircle, XCircle, ChevronRight, Gauge, BarChart3,
} from "lucide-react";
import { formatFCFA } from "@/lib/format";
import { severityLabel } from "@/lib/intelligence";

const CHECKIN_KIND_LABELS: Record<string, string> = {
  arrival: "Arrivée", departure: "Départ", start: "Démarrage", stop: "Arrêt",
  pause: "Pause", resume: "Reprise", checkpoint: "Point d'étape", "check-in": "Check-in",
};

const KIND_LABELS: Record<string, string> = {
  delivery: "Livraison", collect: "Collecte", transfer: "Transfert",
  install: "Installation", intervention: "Intervention", supply: "Approvisionnement",
  site_visit: "Visite terrain", custom: "Mission personnalisée",
};
const STATUS_LABELS: Record<string, string> = {
  planned: "Planifiée", assigned: "Affectée", awaiting_departure: "En attente de départ",
  en_route: "En route", on_site: "Arrivé sur site", in_progress: "Intervention en cours",
  completed: "Terminée", blocked: "Bloquée", cancelled: "Annulée",
};
const PRIORITY_LABELS: Record<string, string> = { low: "Basse", normal: "Normale", high: "Haute", urgent: "Urgente" };
const INCIDENT_LABELS: Record<string, string> = {
  delay: "Retard", breakdown: "Panne", absence: "Absence", client_unavailable: "Client indisponible",
  missing_material: "Matériel manquant", loading_error: "Erreur de chargement", dispute: "Litige",
  accident: "Accident", non_conformity: "Non-conformité", site_blocked: "Blocage terrain", other: "Autre",
};
const SEVERITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-700", medium: "bg-amber-100 text-amber-800",
  high: "bg-orange-100 text-orange-800", critical: "bg-red-100 text-red-800",
};
const STATUS_COLORS: Record<string, string> = {
  planned: "bg-slate-100 text-slate-700", assigned: "bg-blue-100 text-blue-700",
  awaiting_departure: "bg-amber-100 text-amber-800", en_route: "bg-indigo-100 text-indigo-700",
  on_site: "bg-teal-100 text-teal-700", in_progress: "bg-violet-100 text-violet-700",
  completed: "bg-green-100 text-green-700", blocked: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

function get(url: string): Promise<any> { return apiFetch(url); }
function post(url: string, body?: any): Promise<any> { return apiFetch(url, { method: "POST", body }); }
function patch(url: string, body?: any): Promise<any> { return apiFetch(url, { method: "PATCH", body }); }

export default function OperationsCommandCenter() {
  const [tab, setTab] = useState("overview");
  const [missionDialog, setMissionDialog] = useState(false);
  const [detailMissionId, setDetailMissionId] = useState<string | null>(null);
  const qc = useQueryClient();

  const overview = useQuery({ queryKey: ["ops-overview"], queryFn: () => get("/api/operations/overview") });
  const missions = useQuery({ queryKey: ["ops-missions"], queryFn: () => get("/api/operations/missions") });
  const dispatch = useQuery({ queryKey: ["ops-dispatch"], queryFn: () => get("/api/operations/dispatch"), enabled: tab === "dispatch" });
  const incidents = useQuery({ queryKey: ["ops-incidents"], queryFn: () => get("/api/operations/incidents"), enabled: tab === "incidents" });
  const performance = useQuery({ queryKey: ["ops-perf"], queryFn: () => get("/api/operations/performance"), enabled: tab === "performance" });
  const calendar = useQuery({ queryKey: ["ops-cal"], queryFn: () => get("/api/operations/calendar"), enabled: tab === "calendar" });
  const mapPts = useQuery({ queryKey: ["ops-map"], queryFn: () => get("/api/operations/map"), enabled: tab === "map" });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["ops-overview"] });
    qc.invalidateQueries({ queryKey: ["ops-missions"] });
    qc.invalidateQueries({ queryKey: ["ops-dispatch"] });
    qc.invalidateQueries({ queryKey: ["ops-incidents"] });
    qc.invalidateQueries({ queryKey: ["ops-perf"] });
    qc.invalidateQueries({ queryKey: ["ops-cal"] });
    qc.invalidateQueries({ queryKey: ["ops-map"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Opérations & Logistique</h1>
          <p className="text-muted-foreground mt-1">
            Centre de commande terrain — missions, dispatching, suivi, preuves, incidents et performance.
          </p>
        </div>
        <Button onClick={() => setMissionDialog(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Nouvelle mission
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview" className="gap-1"><Activity className="w-4 h-4" />Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="missions" className="gap-1"><Truck className="w-4 h-4" />Missions</TabsTrigger>
          <TabsTrigger value="dispatch" className="gap-1"><Zap className="w-4 h-4" />Dispatching</TabsTrigger>
          <TabsTrigger value="tracking" className="gap-1"><MapPin className="w-4 h-4" />Suivi terrain</TabsTrigger>
          <TabsTrigger value="incidents" className="gap-1"><AlertTriangle className="w-4 h-4" />Incidents</TabsTrigger>
          <TabsTrigger value="checklists" className="gap-1"><ClipboardCheck className="w-4 h-4" />Checklists</TabsTrigger>
          <TabsTrigger value="proofs" className="gap-1"><FileText className="w-4 h-4" />Preuves</TabsTrigger>
          <TabsTrigger value="performance" className="gap-1"><Gauge className="w-4 h-4" />Coûts & performance</TabsTrigger>
          <TabsTrigger value="map" className="gap-1"><MapIcon className="w-4 h-4" />Carte</TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1"><Calendar className="w-4 h-4" />Calendrier</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4">
          <OverviewTab data={overview.data} onOpen={setDetailMissionId} />
        </TabsContent>

        {/* MISSIONS */}
        <TabsContent value="missions">
          <MissionsTable data={missions.data?.data ?? []} onOpen={setDetailMissionId} />
        </TabsContent>

        {/* DISPATCH */}
        <TabsContent value="dispatch">
          <DispatchTab data={dispatch.data} missions={missions.data?.data ?? []} onChanged={refreshAll} onOpen={setDetailMissionId} />
        </TabsContent>

        {/* TRACKING */}
        <TabsContent value="tracking">
          <TrackingBoard data={missions.data?.data ?? []} onOpen={setDetailMissionId} onChanged={refreshAll} />
        </TabsContent>

        {/* INCIDENTS */}
        <TabsContent value="incidents">
          <IncidentsTab data={incidents.data?.data ?? []} onChanged={refreshAll} />
        </TabsContent>

        {/* CHECKLISTS */}
        <TabsContent value="checklists">
          <ChecklistsTab missions={missions.data?.data ?? []} onOpen={setDetailMissionId} />
        </TabsContent>

        {/* PROOFS */}
        <TabsContent value="proofs">
          <ProofsTab missions={missions.data?.data ?? []} onOpen={setDetailMissionId} />
        </TabsContent>

        {/* PERFORMANCE */}
        <TabsContent value="performance">
          <PerformanceTab data={performance.data} />
        </TabsContent>

        {/* MAP */}
        <TabsContent value="map">
          <MapTab data={mapPts.data} />
        </TabsContent>

        {/* CALENDAR */}
        <TabsContent value="calendar">
          <CalendarTab items={calendar.data?.items ?? []} onOpen={setDetailMissionId} />
        </TabsContent>
      </Tabs>

      <NewMissionDialog open={missionDialog} onClose={() => setMissionDialog(false)} onCreated={() => { setMissionDialog(false); refreshAll(); }} />
      <MissionDetailDialog missionId={detailMissionId} onClose={() => setDetailMissionId(null)} onChanged={refreshAll} />
    </div>
  );
}

// ─── Overview ───────────────────────────────────────────────────────

function OverviewTab({ data, onOpen }: { data: any; onOpen: (id: string) => void }) {
  if (!data) return <Card><CardContent className="py-8 text-center text-muted-foreground">Chargement…</CardContent></Card>;
  const byStatus = data.counts?.byStatus ?? {};
  const total = Object.values(byStatus).reduce((s: number, v: any) => s + (v as number), 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<Truck />} label="Missions actives" value={(byStatus.assigned ?? 0) + (byStatus.en_route ?? 0) + (byStatus.on_site ?? 0) + (byStatus.in_progress ?? 0)} tone="primary" />
        <KpiCard icon={<Calendar />} label="Prévues aujourd'hui" value={data.counts?.today ?? 0} tone="info" />
        <KpiCard icon={<CheckCircle2 />} label="Terminées" value={byStatus.completed ?? 0} tone="success" />
        <KpiCard icon={<ShieldAlert />} label="Incidents ouverts" value={data.counts?.openIncidents ?? 0} tone={data.counts?.openIncidents ? "warning" : "muted"} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Activity className="w-5 h-5 text-primary" />Activité récente</CardTitle></CardHeader>
          <CardContent>
            {data.recent?.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune mission pour l'instant. Créez votre première mission.</p>
            ) : (
              <div className="space-y-2">
                {data.recent?.map((m: any) => (
                  <div key={m.id} onClick={() => onOpen(m.id)} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{m.reference}</Badge>
                        <span className="font-medium truncate">{m.title}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2">
                        <span>{KIND_LABELS[m.kind] ?? m.kind}</span>
                        <span>·</span>
                        <span>{m.destinationAddress ?? "—"}</span>
                        {m.scheduledStart && (<><span>·</span><span>{new Date(m.scheduledStart).toLocaleString("fr-FR")}</span></>)}
                      </div>
                    </div>
                    <Badge className={STATUS_COLORS[m.status]}>{STATUS_LABELS[m.status] ?? m.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-orange-500" />Alertes terrain</CardTitle></CardHeader>
          <CardContent>
            {data.alerts?.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune alerte. Tout est sous contrôle.</p>
            ) : (
              <div className="space-y-2">
                {data.alerts?.map((a: any, i: number) => (
                  <div key={i} onClick={() => onOpen(a.missionId)} className="p-2 rounded border-l-4 border-orange-400 bg-orange-50 cursor-pointer">
                    <div className="text-xs font-semibold uppercase text-orange-700">
                      {a.kind === "late_departure" ? "Retard de départ" : "Mission bloquée"}
                    </div>
                    <div className="text-sm truncate">{a.reference} · {a.title}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number | string; tone: "primary" | "info" | "success" | "warning" | "muted" }) {
  const toneCls = {
    primary: "bg-primary/10 text-primary", info: "bg-blue-100 text-blue-600",
    success: "bg-green-100 text-green-600", warning: "bg-orange-100 text-orange-600",
    muted: "bg-slate-100 text-slate-500",
  }[tone];
  return (
    <Card>
      <CardContent className="pt-6 flex items-center gap-4">
        <div className={`p-3 rounded-lg ${toneCls}`}>{icon}</div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Missions table ─────────────────────────────────────────────────

function MissionsTable({ data, onOpen }: { data: any[]; onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const filtered = useMemo(() => data.filter((m) => {
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    if (kindFilter !== "all" && m.kind !== kindFilter) return false;
    if (q && !`${m.reference} ${m.title} ${m.destinationAddress ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [data, q, statusFilter, kindFilter]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <CardTitle>Missions ({filtered.length})</CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Recherche…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8 w-48" />
            </div>
            <Select value={kindFilter} onValueChange={setKindFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                {Object.entries(KIND_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Réf.</TableHead><TableHead>Titre</TableHead><TableHead>Type</TableHead>
            <TableHead>Statut</TableHead><TableHead>Priorité</TableHead>
            <TableHead>Responsable</TableHead><TableHead>Destination</TableHead><TableHead>Planifié</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Aucune mission</TableCell></TableRow>
            ) : filtered.map((m) => (
              <TableRow key={m.id} onClick={() => onOpen(m.id)} className="cursor-pointer">
                <TableCell className="font-mono text-xs">{m.reference}</TableCell>
                <TableCell className="font-medium">{m.title}</TableCell>
                <TableCell>{KIND_LABELS[m.kind] ?? m.kind}</TableCell>
                <TableCell><Badge className={STATUS_COLORS[m.status]}>{STATUS_LABELS[m.status] ?? m.status}</Badge></TableCell>
                <TableCell><Badge variant="outline">{PRIORITY_LABELS[m.priority] ?? m.priority}</Badge></TableCell>
                <TableCell>{m.responsibleName ?? "—"}</TableCell>
                <TableCell className="text-xs">{m.destinationAddress ?? "—"}</TableCell>
                <TableCell className="text-xs">{m.scheduledStart ? new Date(m.scheduledStart).toLocaleString("fr-FR") : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Dispatch ───────────────────────────────────────────────────────

function DispatchTab({ data, missions, onChanged, onOpen }: { data: any; missions: any[]; onChanged: () => void; onOpen: (id: string) => void }) {
  if (!data) return <Card><CardContent className="py-8 text-center">Chargement…</CardContent></Card>;
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="flex items-center gap-2"><Zap className="w-5 h-5 text-amber-500" />File à dispatcher ({data.unassigned?.length ?? 0})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.unassigned?.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune mission en attente d'affectation.</p>
          ) : data.unassigned?.map((m: any) => (
            <div key={m.id} onClick={() => onOpen(m.id)} className="p-3 rounded-lg border hover:bg-accent cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{m.title}</div>
                  <div className="text-xs text-muted-foreground">{m.reference} · {KIND_LABELS[m.kind]} · {PRIORITY_LABELS[m.priority]}</div>
                </div>
                <Badge className={STATUS_COLORS[m.status]}>{STATUS_LABELS[m.status]}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">→ {m.destinationAddress ?? "—"}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-primary" />Disponibilité équipe</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.available?.users?.map((u: any) => (
            <div key={u.id} className="flex items-center justify-between p-2 rounded border">
              <div>
                <div className="font-medium text-sm">{u.name}</div>
                <div className="text-xs text-muted-foreground">{u.role}</div>
              </div>
              <Badge variant="outline" className={
                u.availability === "available" ? "bg-green-50 text-green-700" :
                u.availability === "light" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
              }>{u.activeMissions} mission(s)</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tracking ───────────────────────────────────────────────────────

function TrackingBoard({ data, onOpen, onChanged }: { data: any[]; onOpen: (id: string) => void; onChanged: () => void }) {
  const lanes = ["planned", "assigned", "en_route", "on_site", "in_progress", "completed"];
  const by = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const s of lanes) m[s] = [];
    for (const x of data) if (m[x.status]) m[x.status].push(x);
    return m;
  }, [data]);
  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
      {lanes.map((s) => (
        <Card key={s} className="min-h-[300px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{STATUS_LABELS[s]} <Badge variant="secondary" className="ml-1">{by[s].length}</Badge></CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {by[s].map((m) => (
              <div key={m.id} onClick={() => onOpen(m.id)} className="p-2 rounded border bg-card hover:shadow cursor-pointer text-xs">
                <div className="font-medium truncate">{m.title}</div>
                <div className="text-muted-foreground truncate">{m.responsibleName ?? "—"}</div>
                <Badge variant="outline" className="mt-1">{PRIORITY_LABELS[m.priority]}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Incidents ──────────────────────────────────────────────────────

function IncidentsTab({ data, onChanged }: { data: any[]; onChanged: () => void }) {
  const resolve = useMutation({
    mutationFn: (id: string) => patch(`/api/operations/incidents/${id}`, { status: "resolved" }),
    onSuccess: () => onChanged(),
  });
  return (
    <Card>
      <CardHeader><CardTitle>Incidents terrain ({data.length})</CardTitle></CardHeader>
      <CardContent>
        {data.length === 0 ? <p className="text-sm text-muted-foreground">Aucun incident.</p> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Type</TableHead><TableHead>Gravité</TableHead><TableHead>Mission</TableHead>
              <TableHead>Description</TableHead><TableHead>Statut</TableHead><TableHead>Action</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{INCIDENT_LABELS[i.kind] ?? i.kind}</TableCell>
                  <TableCell><Badge className={SEVERITY_COLORS[i.severity]}>{severityLabel(i.severity)}</Badge></TableCell>
                  <TableCell className="text-xs">{i.missionRef} — {i.missionTitle}</TableCell>
                  <TableCell className="text-sm max-w-md truncate">{i.description}</TableCell>
                  <TableCell><Badge variant={i.status === "resolved" ? "outline" : "default"}>{i.status}</Badge></TableCell>
                  <TableCell>
                    {i.status !== "resolved" && (
                      <Button size="sm" variant="ghost" onClick={() => resolve.mutate(i.id)}>Résoudre</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Checklists & Proofs (compact summary tabs) ────────────────────

function ChecklistsTab({ missions, onOpen }: { missions: any[]; onOpen: (id: string) => void }) {
  return (
    <Card>
      <CardHeader><CardTitle>Checklists par mission</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">Cliquez sur une mission pour valider ses checklists (avant départ, arrivée, exécution, fin, retour).</p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {missions.slice(0, 30).map((m) => (
            <div key={m.id} onClick={() => onOpen(m.id)} className="p-3 rounded border hover:bg-accent cursor-pointer">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono">{m.reference}</span>
                <Badge className={STATUS_COLORS[m.status]}>{STATUS_LABELS[m.status]}</Badge>
              </div>
              <div className="font-medium text-sm">{m.title}</div>
              <div className="text-xs text-muted-foreground">{KIND_LABELS[m.kind]}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ProofsTab({ missions, onOpen }: { missions: any[]; onOpen: (id: string) => void }) {
  const completed = missions.filter((m) => m.status === "completed" || m.status === "in_progress" || m.status === "on_site");
  return (
    <Card>
      <CardHeader><CardTitle>Preuves d'exécution</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">Ajoutez photos, signatures et observations depuis le détail d'une mission.</p>
        <div className="space-y-2">
          {completed.length === 0 ? <p className="text-sm text-muted-foreground">Aucune mission éligible.</p> : completed.map((m) => (
            <div key={m.id} onClick={() => onOpen(m.id)} className="flex items-center justify-between p-3 rounded border hover:bg-accent cursor-pointer">
              <div>
                <div className="font-medium">{m.title}</div>
                <div className="text-xs text-muted-foreground">{m.reference} · {KIND_LABELS[m.kind]}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Performance ────────────────────────────────────────────────────

function PerformanceTab({ data }: { data: any }) {
  if (!data?.kpi) return <Card><CardContent className="py-8 text-center">Chargement…</CardContent></Card>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<Truck />} label="Missions totales" value={data.kpi.total} tone="primary" />
        <KpiCard icon={<CheckCircle2 />} label="Taux de réussite" value={`${data.kpi.completionRate}%`} tone="success" />
        <KpiCard icon={<Clock />} label="Taux à l'heure" value={`${data.kpi.onTimeRate}%`} tone="info" />
        <KpiCard icon={<ShieldAlert />} label="Taux d'incidents" value={`${data.kpi.incidentRate}%`} tone={data.kpi.incidentRate > 20 ? "warning" : "muted"} />
        <KpiCard icon={<Clock />} label="Durée moyenne" value={`${data.kpi.avgDurationMin ?? 0} min`} tone="info" />
        <KpiCard icon={<BarChart3 />} label="Coûts opérationnels" value={formatFCFA(data.kpi.totalCostFcfa ?? 0)} tone="primary" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Par type de mission</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Type</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Terminées</TableHead><TableHead className="text-right">Durée moy.</TableHead></TableRow></TableHeader>
              <TableBody>
                {(data.byKind ?? []).map((r: any) => (
                  <TableRow key={r.kind}>
                    <TableCell>{KIND_LABELS[r.kind] ?? r.kind}</TableCell>
                    <TableCell className="text-right">{r.total}</TableCell>
                    <TableCell className="text-right">{r.completed}</TableCell>
                    <TableCell className="text-right">{r.avgDur ?? 0} min</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Par responsable</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Responsable</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Terminées</TableHead></TableRow></TableHeader>
              <TableBody>
                {(data.byResponsible ?? []).map((r: any) => (
                  <TableRow key={r.userId ?? "none"}>
                    <TableCell>{r.name ?? "Non affecté"}</TableCell>
                    <TableCell className="text-right">{r.total}</TableCell>
                    <TableCell className="text-right">{r.completed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Map ────────────────────────────────────────────────────────────

function MapTab({ data }: { data: any }) {
  const points = data?.points ?? [];
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><MapIcon className="w-5 h-5 text-primary" />Carte opérationnelle</CardTitle></CardHeader>
      <CardContent>
        <div className="rounded-lg border-2 border-dashed bg-slate-50 p-12 text-center mb-4">
          <MapIcon className="w-12 h-12 mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-muted-foreground">
            Carte interactive — {points.length} point(s) géolocalisé(s). Intégration carto à brancher selon votre fournisseur (Leaflet/Mapbox).
          </p>
        </div>
        <div className="space-y-2">
          {points.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between p-2 rounded border text-sm">
              <div>
                <span className="font-mono text-xs mr-2">{p.reference}</span>
                <span className="font-medium">{p.title}</span>
                <span className="text-muted-foreground ml-2">— {p.address}</span>
              </div>
              <a href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=16/${p.lat}/${p.lng}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Voir</a>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Calendar ───────────────────────────────────────────────────────

function CalendarTab({ items, onOpen }: { items: any[]; onOpen: (id: string) => void }) {
  const byDay = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const it of items) {
      const day = new Date(it.scheduledStart).toISOString().slice(0, 10);
      if (!m.has(day)) m.set(day, []);
      m.get(day)!.push(it);
    }
    return Array.from(m.entries()).sort();
  }, [items]);
  return (
    <Card>
      <CardHeader><CardTitle>Calendrier opérationnel</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {byDay.length === 0 ? <p className="text-sm text-muted-foreground">Aucune mission planifiée.</p> : byDay.map(([day, list]) => (
          <div key={day}>
            <div className="font-semibold text-sm text-primary mb-2">{new Date(day).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</div>
            <div className="space-y-1 ml-4">
              {list.map((m: any) => (
                <div key={m.id} onClick={() => onOpen(m.id)} className="flex items-center gap-3 p-2 rounded border hover:bg-accent cursor-pointer text-sm">
                  <span className="text-xs text-muted-foreground w-12">{new Date(m.scheduledStart).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="font-medium flex-1 truncate">{m.title}</span>
                  <Badge variant="outline">{KIND_LABELS[m.kind]}</Badge>
                  <Badge className={STATUS_COLORS[m.status]}>{STATUS_LABELS[m.status]}</Badge>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Dialogs ────────────────────────────────────────────────────────

function NewMissionDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("delivery");
  const [priority, setPriority] = useState("normal");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [originAddress, setOriginAddress] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: () => post("/api/operations/missions", {
      title, kind, priority, destinationAddress, originAddress,
      scheduledStart: scheduledStart || undefined, notes,
    }),
    onSuccess: () => {
      setTitle(""); setDestinationAddress(""); setOriginAddress(""); setScheduledStart(""); setNotes("");
      onCreated();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Nouvelle mission</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Titre *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Livraison chantier Lomé Plateau" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(KIND_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priorité</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Adresse de départ</Label><Input value={originAddress} onChange={(e) => setOriginAddress(e.target.value)} placeholder="Dépôt Nexora — Lomé" /></div>
          <div><Label>Destination *</Label><Input value={destinationAddress} onChange={(e) => setDestinationAddress(e.target.value)} placeholder="Chantier client" /></div>
          <div><Label>Date/heure prévue</Label><Input type="datetime-local" value={scheduledStart} onChange={(e) => setScheduledStart(e.target.value)} /></div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => create.mutate()} disabled={!title || !destinationAddress || create.isPending}>
            {create.isPending ? "Création…" : "Créer la mission"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MissionDetailDialog({ missionId, onClose, onChanged }: { missionId: string | null; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["ops-mission", missionId],
    queryFn: () => get(`/api/operations/missions/${missionId}`),
    enabled: !!missionId,
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["ops-mission", missionId] }); onChanged(); };

  const updateStatus = useMutation({
    mutationFn: (status: string) => post(`/api/operations/missions/${missionId}/status`, { status }),
    onSuccess: refresh,
  });
  const checkIn = useMutation({
    mutationFn: () => navigator.geolocation
      ? new Promise<any>((resolve) => navigator.geolocation.getCurrentPosition(
          (p) => post(`/api/operations/missions/${missionId}/check-in`, { lat: p.coords.latitude, lng: p.coords.longitude, accuracyMeters: Math.round(p.coords.accuracy) }).then((r) => resolve(r.json())),
          () => post(`/api/operations/missions/${missionId}/check-in`, {}).then((r) => resolve(r.json())),
        ))
      : post(`/api/operations/missions/${missionId}/check-in`, {}),
    onSuccess: refresh,
  });
  const generateSummary = useMutation({
    mutationFn: () => post(`/api/operations/missions/${missionId}/summary`, {}),
    onSuccess: refresh,
  });
  const toggleItem = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => patch(`/api/operations/checklist-items/${id}`, { done }),
    onSuccess: refresh,
  });
  const reportIncident = useMutation({
    mutationFn: (body: any) => post(`/api/operations/missions/${missionId}/incident`, body),
    onSuccess: refresh,
  });

  const [incKind, setIncKind] = useState("delay");
  const [incSev, setIncSev] = useState("medium");
  const [incDesc, setIncDesc] = useState("");

  if (!missionId) return null;
  const m = data?.mission;
  if (!data || !m) return <Dialog open onOpenChange={onClose}><DialogContent><div className="py-8 text-center">Chargement…</div></DialogContent></Dialog>;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="outline">{m.reference}</Badge>
            <span>{m.title}</span>
            <Badge className={STATUS_COLORS[m.status]}>{STATUS_LABELS[m.status]}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Type :</span> {KIND_LABELS[m.kind] ?? m.kind}</div>
            <div><span className="text-muted-foreground">Priorité :</span> {PRIORITY_LABELS[m.priority]}</div>
            <div><span className="text-muted-foreground">Responsable :</span> {data.responsible?.name ?? "—"}</div>
            <div><span className="text-muted-foreground">Client :</span> {data.client?.name ?? "—"}</div>
            <div><span className="text-muted-foreground">Départ :</span> {m.originAddress ?? "—"}</div>
            <div><span className="text-muted-foreground">Destination :</span> {m.destinationAddress ?? "—"}</div>
            <div><span className="text-muted-foreground">Planifié :</span> {m.scheduledStart ? new Date(m.scheduledStart).toLocaleString("fr-FR") : "—"}</div>
            <div><span className="text-muted-foreground">Réalisé :</span> {m.actualStart ? new Date(m.actualStart).toLocaleString("fr-FR") : "—"}</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => updateStatus.mutate("en_route")} disabled={m.status === "en_route"}><PlayCircle className="w-4 h-4 mr-1" />En route</Button>
            <Button size="sm" variant="outline" onClick={() => checkIn.mutate()}><MapPin className="w-4 h-4 mr-1" />Check-in</Button>
            <Button size="sm" variant="outline" onClick={() => updateStatus.mutate("in_progress")}>En exécution</Button>
            <Button size="sm" variant="outline" onClick={() => updateStatus.mutate("completed")} className="text-green-700"><CheckCircle2 className="w-4 h-4 mr-1" />Terminer</Button>
            <Button size="sm" variant="outline" onClick={() => updateStatus.mutate("blocked")} className="text-orange-700"><PauseCircle className="w-4 h-4 mr-1" />Bloquer</Button>
            <Button size="sm" variant="outline" onClick={() => updateStatus.mutate("cancelled")} className="text-red-700"><XCircle className="w-4 h-4 mr-1" />Annuler</Button>
            <Button size="sm" variant="default" onClick={() => generateSummary.mutate()}><FileText className="w-4 h-4 mr-1" />Générer résumé</Button>
          </div>

          {m.summaryJson && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Résumé final</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <div><strong>Prévu :</strong> {m.summaryJson.planned}</div>
                <div><strong>Réalisé :</strong> {m.summaryJson.achieved}</div>
                <div><strong>Écarts :</strong> {m.summaryJson.gaps}</div>
                <div><strong>Prochaines actions :</strong> {m.summaryJson.nextActions}</div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Checklists ({data.checklists?.length ?? 0})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data.checklists?.map((cl: any) => {
                const pct = cl.totalItems > 0 ? Math.round((cl.doneItems / cl.totalItems) * 100) : 0;
                return (
                  <div key={cl.id}>
                    <div className="flex items-center justify-between text-sm font-medium mb-1">
                      <span>{cl.title}</span><span className="text-xs text-muted-foreground">{cl.doneItems}/{cl.totalItems}</span>
                    </div>
                    <Progress value={pct} className="h-1 mb-2" />
                    <div className="space-y-1 ml-4">
                      {cl.items.map((it: any) => (
                        <label key={it.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox checked={it.done} onCheckedChange={(c) => toggleItem.mutate({ id: it.id, done: !!c })} />
                          <span className={it.done ? "line-through text-muted-foreground" : ""}>{it.label}</span>
                          {it.required && <Badge variant="outline" className="text-[10px]">requis</Badge>}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Check-ins terrain ({data.checkins?.length ?? 0})</CardTitle></CardHeader>
            <CardContent>
              {data.checkins?.length === 0 ? <p className="text-sm text-muted-foreground">Aucun check-in.</p> : (
                <div className="space-y-1">
                  {data.checkins.map((c: any) => (
                    <div key={c.id} className="text-sm flex items-center justify-between">
                      <span><Badge variant="outline">{CHECKIN_KIND_LABELS[c.kind] ?? c.kind}</Badge> {new Date(c.at).toLocaleString("fr-FR")}</span>
                      {c.lat && <a href={`https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lng}`} target="_blank" rel="noreferrer" className="text-xs text-primary">GPS</a>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Incidents ({data.incidents?.length ?? 0})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {data.incidents?.map((i: any) => (
                <div key={i.id} className="p-2 rounded border text-sm">
                  <div className="flex items-center gap-2">
                    <Badge className={SEVERITY_COLORS[i.severity]}>{severityLabel(i.severity)}</Badge>
                    <span className="font-medium">{INCIDENT_LABELS[i.kind] ?? i.kind}</span>
                    <Badge variant="outline">{i.status}</Badge>
                  </div>
                  {i.description && <p className="text-xs text-muted-foreground mt-1">{i.description}</p>}
                </div>
              ))}
              <div className="border-t pt-2 mt-2 space-y-2">
                <div className="text-xs font-medium">Signaler un nouvel incident</div>
                <div className="flex gap-2">
                  <Select value={incKind} onValueChange={setIncKind}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(INCIDENT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={incSev} onValueChange={setIncSev}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Faible</SelectItem><SelectItem value="medium">Moyen</SelectItem>
                      <SelectItem value="high">Élevé</SelectItem><SelectItem value="critical">Critique</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Textarea value={incDesc} onChange={(e) => setIncDesc(e.target.value)} rows={2} placeholder="Description…" />
                <Button size="sm" onClick={() => { reportIncident.mutate({ kind: incKind, severity: incSev, description: incDesc }); setIncDesc(""); }}>Enregistrer l'incident</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
