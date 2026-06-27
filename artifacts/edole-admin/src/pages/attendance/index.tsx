import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Clock, MapPin, Coffee, LogIn, LogOut, AlertTriangle, CheckCircle2,
  Users, Loader2, Calendar, Camera, MonitorSmartphone, ChevronRight, MessageSquare,
  Plus, ChevronLeft, FileSpreadsheet, Send, ThumbsUp, ThumbsDown, Trash2, Pencil,
  Download, FilePlus2,
} from "lucide-react";
import {
  useMyAttendanceToday, useAttendanceDashboard, useAttendanceAnomalies,
  useMyAttendanceHistory, useClockMutation, useResolveAttendanceFlag,
  useCollaboratorAttendanceHistory,
  captureGeolocation, formatMinutes, type AttendanceRecord,
} from "@/lib/attendance";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { severityLabel } from "@/lib/intelligence";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";

function resolveStorageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/objects/")) return `/api/storage${url}`;
  // /uploads/… doit passer par /api/uploads/… (seul /api est routé par le proxy)
  if (url.startsWith("/uploads/")) {
    const token = localStorage.getItem("auth_token");
    const base = `/api${url}`;
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
  }
  return url;
}

const KIND_LABEL: Record<string, string> = {
  clock_in: "Arrivée",
  clock_out: "Départ",
  break_start: "Début de pause",
  break_end: "Reprise après pause",
};

const FLAG_KIND_LABEL: Record<string, string> = {
  late: "Retard",
  early_leave: "Départ anticipé",
  missing_clock_out: "Oubli de pointage départ",
  missing_clock_in: "Oubli de pointage arrivée",
  long_break: "Pause prolongée",
  out_of_zone: "Pointage hors zone",
  duplicate: "Pointage en doublon",
  suspicious: "Pointage suspect",
};

function fmtTime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function MyClockPanel() {
  const { data, isLoading } = useMyAttendanceToday();
  const clock = useClockMutation();
  const session = data?.session;
  const records = data?.records ?? [];
  const lastKind = records[records.length - 1]?.kind;

  const onBreak = lastKind === "break_start";
  const canClockIn = !records.some((r) => r.kind === "clock_in");
  const canClockOut = !!session && session.status !== "closed" && records.some((r) => r.kind === "clock_in") && !onBreak;
  const canBreakStart = canClockOut && !onBreak;
  const canBreakEnd = onBreak;

  async function handleClock(kind: "clock_in" | "clock_out" | "break_start" | "break_end") {
    const geo = await captureGeolocation();
    try {
      await clock.mutateAsync({
        kind,
        latitude: geo?.latitude,
        longitude: geo?.longitude,
        accuracyMeters: geo?.accuracyMeters,
        locationLabel: geo ? "Position GPS automatique" : "Localisation indisponible",
      });
      toast.success(`${KIND_LABEL[kind]} enregistré${geo ? " avec géolocalisation" : " (sans géolocalisation)"}`);
    } catch (e: any) {
      const msg = e?.body?.message || e?.message || "Échec du pointage";
      toast.error(msg);
    }
  }

  if (isLoading) return <Card className="p-6"><Loader2 className="w-5 h-5 animate-spin" /></Card>;

  if (!data?.collaborator) {
    return (
      <Card className="p-6">
        <p className="text-sm text-slate-600">Votre compte utilisateur n'est lié à aucun collaborateur. Demandez à l'administrateur de créer la liaison RH avant de pouvoir pointer.</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Pointage du jour</h2>
          <p className="text-xs text-slate-500">
            {session ? `Session ouverte à ${fmtTime(session.clockInAt)}` : "Aucune session ouverte aujourd'hui"}
          </p>
        </div>
        {session && (
          <div className="flex items-center gap-3 text-right">
            <div>
              <p className="text-[10px] uppercase text-slate-400 font-semibold">Présence</p>
              <p className="text-lg font-bold text-primary">{formatMinutes(session.effectiveMinutes)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-400 font-semibold">Pause</p>
              <p className="text-lg font-bold text-slate-700">{formatMinutes(session.breakMinutes)}</p>
            </div>
            {session.isLate && <Badge variant="destructive">Retard</Badge>}
            {session.status === "closed" && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Clôturée</Badge>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Button onClick={() => handleClock("clock_in")} disabled={!canClockIn || clock.isPending} className="h-20 flex-col gap-1" variant={canClockIn ? "default" : "outline"}>
          <LogIn className="w-5 h-5" /><span className="text-xs">Pointer l'arrivée</span>
        </Button>
        <Button onClick={() => handleClock("break_start")} disabled={!canBreakStart || clock.isPending} className="h-20 flex-col gap-1" variant="outline">
          <Coffee className="w-5 h-5" /><span className="text-xs">Début pause</span>
        </Button>
        <Button onClick={() => handleClock("break_end")} disabled={!canBreakEnd || clock.isPending} className="h-20 flex-col gap-1" variant="outline">
          <Coffee className="w-5 h-5" /><span className="text-xs">Fin pause</span>
        </Button>
        <Button onClick={() => handleClock("clock_out")} disabled={!canClockOut || clock.isPending} className="h-20 flex-col gap-1" variant="outline">
          <LogOut className="w-5 h-5" /><span className="text-xs">Pointer le départ</span>
        </Button>
      </div>

      <div className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 flex items-start gap-2">
        <MapPin className="w-3.5 h-3.5 mt-0.5 text-amber-600" />
        La géolocalisation est demandée à chaque pointage. Vous pouvez l'autoriser depuis votre navigateur pour assurer la traçabilité. Si elle est refusée, le pointage est tout de même enregistré sans coordonnées.
      </div>

      {records.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Historique du jour</p>
          <div className="space-y-1.5">
            {records.map((r: AttendanceRecord) => (
              <div key={r.id} className="flex items-center justify-between text-sm bg-slate-50 rounded-md px-3 py-2 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-medium text-slate-700">{KIND_LABEL[r.kind] ?? r.kind}</span>
                  <span className="text-slate-500">{fmtTime(r.occurredAt)}</span>
                  {r.source === "kiosk" && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-violet-100 text-violet-700 rounded px-1.5 py-0.5 shrink-0">
                      <MonitorSmartphone className="w-2.5 h-2.5" /> Kiosque
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-2 shrink-0">
                  {resolveStorageUrl(r.photoUrl) && (
                    <a href={resolveStorageUrl(r.photoUrl)!} target="_blank" rel="noreferrer" title="Voir la photo de présence">
                      <img
                        src={resolveStorageUrl(r.photoUrl)!}
                        alt="Photo pointage"
                        className="w-8 h-8 rounded object-cover border border-slate-200 hover:opacity-80 transition-opacity cursor-zoom-in"
                      />
                    </a>
                  )}
                  {r.latitude && r.longitude ? (
                    <a
                      target="_blank" rel="noreferrer"
                      href={`https://www.openstreetmap.org/?mlat=${r.latitude}&mlon=${r.longitude}#map=17/${r.latitude}/${r.longitude}`}
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <MapPin className="w-3 h-3" />
                      {Number(r.latitude).toFixed(4)}, {Number(r.longitude).toFixed(4)}
                    </a>
                  ) : <span className="text-slate-400">Sans GPS</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function CollaboratorRecordsDialog({
  collaboratorId,
  collaboratorName,
  date,
  open,
  onClose,
}: {
  collaboratorId: string;
  collaboratorName: string;
  date: string;
  open: boolean;
  onClose: () => void;
}) {
  const { data, isLoading } = useCollaboratorAttendanceHistory(open ? collaboratorId : null, 7);
  const todayRecords = (data?.records ?? []).filter((r) => {
    const d = new Date(r.occurredAt).toISOString().slice(0, 10);
    return d === date;
  }).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            {collaboratorName} — {new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : todayRecords.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">Aucun enregistrement pour cette date.</p>
        ) : (
          <div className="space-y-2">
            {todayRecords.map((r) => (
              <div key={r.id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2.5">
                {resolveStorageUrl(r.photoUrl) ? (
                  <a href={resolveStorageUrl(r.photoUrl)!} target="_blank" rel="noreferrer" title="Voir la photo en grand">
                    <img
                      src={resolveStorageUrl(r.photoUrl)!}
                      alt="Photo pointage"
                      className="w-12 h-12 rounded-lg object-cover border border-slate-200 hover:opacity-80 transition-opacity cursor-zoom-in shrink-0"
                    />
                  </a>
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
                    <Camera className="w-5 h-5 text-slate-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800 text-sm">{KIND_LABEL[r.kind] ?? r.kind}</span>
                    <span className="text-slate-500 text-sm">{fmtTime(r.occurredAt)}</span>
                    {r.source === "kiosk" && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-violet-100 text-violet-700 rounded px-1.5 py-0.5">
                        <MonitorSmartphone className="w-2.5 h-2.5" /> Kiosque
                      </span>
                    )}
                    {r.source === "app" && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">
                        Application
                      </span>
                    )}
                  </div>
                  {r.latitude && r.longitude ? (
                    <a
                      target="_blank" rel="noreferrer"
                      href={`https://www.openstreetmap.org/?mlat=${r.latitude}&mlon=${r.longitude}#map=17/${r.latitude}/${r.longitude}`}
                      className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5"
                    >
                      <MapPin className="w-3 h-3" />
                      {Number(r.latitude).toFixed(4)}, {Number(r.longitude).toFixed(4)}
                    </a>
                  ) : (
                    <p className="text-xs text-slate-400 mt-0.5">Sans GPS</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function HRDashboard() {
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const { data, isLoading } = useAttendanceDashboard(date);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [, navigate] = useLocation();

  async function handleContact(e: React.MouseEvent, userId: string | null | undefined) {
    e.stopPropagation();
    if (!userId) { toast.error("Compte utilisateur non lié à ce collaborateur"); return; }
    try {
      const conv = await apiFetch<{ id: string }>("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "direct", participantIds: [userId] }),
      });
      navigate(`/messaging?conv=${conv.id}`);
    } catch {
      toast.error("Impossible d'ouvrir la messagerie");
    }
  }

  return (
    <>
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Users className="w-5 h-5" />Tableau RH des présences</h2>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-slate-200 rounded-md px-2 py-1 text-sm" />
          </div>
        </div>

        {data && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Stat label="Total" value={String(data.summary.total)} />
            <Stat label="Présents" value={String(data.summary.present)} tone="emerald" />
            <Stat label="Retards" value={String(data.summary.late)} tone="amber" />
            <Stat label="Clôturés" value={String(data.summary.closed)} />
            <Stat label="Heures totales" value={`${data.summary.totalHours}h`} tone="primary" />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-3 py-2">Collaborateur</th>
                <th className="text-left px-3 py-2">Département</th>
                <th className="text-left px-3 py-2">Arrivée</th>
                <th className="text-left px-3 py-2">Départ</th>
                <th className="text-left px-3 py-2">Pause</th>
                <th className="text-left px-3 py-2">Présence</th>
                <th className="text-left px-3 py-2">Statut</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-400"><Loader2 className="w-4 h-4 inline animate-spin" /></td></tr>
              ) : data?.sessions.length ? data.sessions.map((s) => (
                <tr
                  key={s.id}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => setSelected({ id: s.collaboratorId, name: s.collaboratorName ?? "—" })}
                >
                  <td className="px-3 py-2 font-medium text-slate-700">{s.collaboratorName}</td>
                  <td className="px-3 py-2 text-slate-500">{s.departmentName ?? "—"}</td>
                  <td className="px-3 py-2">{fmtTime(s.clockInAt)}</td>
                  <td className="px-3 py-2">{fmtTime(s.clockOutAt)}</td>
                  <td className="px-3 py-2">{formatMinutes(s.breakMinutes)}</td>
                  <td className="px-3 py-2 font-semibold">{formatMinutes(s.effectiveMinutes)}</td>
                  <td className="px-3 py-2">
                    {s.status === "closed" ? <Badge variant="secondary">Clôturée</Badge> :
                      s.isLate ? <Badge variant="destructive">Retard</Badge> :
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Présent</Badge>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 w-7 p-0 text-primary hover:bg-primary/10"
                        title="Envoyer un message"
                        onClick={(e) => handleContact(e, s.userId)}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </Button>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-400">Aucun pointage pour cette date.</td></tr>
              )}
            </tbody>
          </table>
          {data?.sessions.length ? (
            <p className="text-xs text-slate-400 mt-2 px-1">Cliquez sur une ligne pour voir le détail des pointages et photos.</p>
          ) : null}
        </div>
      </Card>

      {selected && (
        <CollaboratorRecordsDialog
          collaboratorId={selected.id}
          collaboratorName={selected.name}
          date={date}
          open={!!selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function AnomaliesPanel() {
  const { data, isLoading } = useAttendanceAnomalies(false);
  const resolve = useResolveAttendanceFlag();

  return (
    <Card className="p-6 space-y-3">
      <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500" />Anomalies de présence</h2>
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> :
        !data?.data.length ? <p className="text-sm text-slate-500">Aucune anomalie active.</p> :
          <div className="space-y-2">
            {data.data.map((f) => (
              <div key={f.id} className="flex items-start justify-between bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-slate-800">{FLAG_KIND_LABEL[f.kind] ?? f.kind}</p>
                  <p className="text-xs text-slate-600">{f.collaboratorName} — {f.workDate}</p>
                  {f.description && <p className="text-xs text-slate-500">{f.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={f.severity === "high" ? "destructive" : "secondary"}>{severityLabel(f.severity)}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => resolve.mutate(f.id)}>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Résoudre
                  </Button>
                </div>
              </div>
            ))}
          </div>}
    </Card>
  );
}

function MyHistoryPanel() {
  const { data, isLoading } = useMyAttendanceHistory(30);
  const sessions = data?.data ?? [];
  const totals = useMemo(() => {
    const total = sessions.reduce((acc, s) => acc + (s.effectiveMinutes ?? 0), 0);
    const lateDays = sessions.filter((s) => s.isLate).length;
    return { total, lateDays };
  }, [sessions]);

  return (
    <Card className="p-6 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Mon historique</h2>
        <p className="text-xs text-slate-500">{formatMinutes(totals.total)} cumulées · {totals.lateDays} retards sur 30 jours</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">Arrivée</th>
              <th className="text-left px-3 py-2">Départ</th>
              <th className="text-left px-3 py-2">Pause</th>
              <th className="text-left px-3 py-2">Présence</th>
              <th className="text-left px-3 py-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400"><Loader2 className="w-4 h-4 inline animate-spin" /></td></tr>
            ) : sessions.length ? sessions.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">{new Date(s.workDate).toLocaleDateString("fr-FR")}</td>
                <td className="px-3 py-2">{fmtTime(s.clockInAt)}</td>
                <td className="px-3 py-2">{fmtTime(s.clockOutAt)}</td>
                <td className="px-3 py-2">{formatMinutes(s.breakMinutes)}</td>
                <td className="px-3 py-2 font-semibold">{formatMinutes(s.effectiveMinutes)}</td>
                <td className="px-3 py-2">{s.status === "closed" ? "Clôturée" : "Ouverte"}</td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">Aucun pointage enregistré.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "amber" | "primary" }) {
  const cls = tone === "emerald" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : tone === "primary" ? "text-primary" : "text-slate-700";
  return (
    <div className="bg-slate-50 rounded-md p-3">
      <p className="text-[10px] uppercase font-semibold text-slate-400">{label}</p>
      <p className={`text-2xl font-bold ${cls}`}>{value}</p>
    </div>
  );
}

// ─── Feuilles de temps ────────────────────────────────────────────────────────

type TSWeek = {
  id: string; collaboratorId: string; weekStart: string;
  status: string; totalMinutes: number; billableMinutes: number;
  submittedAt?: string | null; reviewedAt?: string | null;
  reviewComment?: string | null; reviewerName?: string | null; collaboratorName?: string;
};

type TSEntry = {
  id: string; weekId: string; entryDate: string; projectId?: string | null; clientId?: string | null;
  durationMinutes: number; description?: string | null; billable: boolean;
  projectName?: string | null; clientName?: string | null;
};

type ProjectOption = { id: string; name: string };
type ClientOption = { id: string; name: string };

function fmtDur(m: number) {
  if (!m) return "0h";
  const h = Math.floor(m / 60), mn = m % 60;
  return `${h}h${mn > 0 ? String(mn).padStart(2, "0") : ""}`;
}

function toWeekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function addDaysStr(s: string, n: number): string {
  const d = new Date(s);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function WeekLabel({ weekStart }: { weekStart: string }) {
  const end = addDaysStr(weekStart, 6);
  const fmt = (s: string) => new Date(s).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return <span>{fmt(weekStart)} — {fmt(end)}</span>;
}

const STATUS_COLORS: Record<string, string> = {
  draft:     "bg-slate-100 text-slate-600",
  submitted: "bg-amber-100 text-amber-700",
  approved:  "bg-emerald-100 text-emerald-700",
  rejected:  "bg-red-100 text-red-700",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", submitted: "Soumise", approved: "Approuvée", rejected: "Rejetée",
};

function EntryRow({
  entry, editable, onEdit, onDelete,
  projects, clients,
}: {
  entry: TSEntry; editable: boolean;
  onEdit: (e: TSEntry) => void; onDelete: (id: string) => void;
  projects: ProjectOption[]; clients: ClientOption[];
}) {
  return (
    <tr className="border-t hover:bg-muted/20 text-sm">
      <td className="px-3 py-2">{new Date(entry.entryDate).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</td>
      <td className="px-3 py-2">{entry.clientName ?? <span className="text-muted-foreground text-xs">—</span>}</td>
      <td className="px-3 py-2">{entry.projectName ?? <span className="text-muted-foreground text-xs">—</span>}</td>
      <td className="px-3 py-2 font-semibold text-center">{fmtDur(entry.durationMinutes)}</td>
      <td className="px-3 py-2 text-center">
        {entry.billable
          ? <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">Fact.</span>
          : <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">Non fact.</span>}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground max-w-[160px] truncate">{entry.description ?? ""}</td>
      {editable && (
        <td className="px-3 py-2 text-right">
          <div className="flex gap-1 justify-end">
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => onEdit(entry)}>
              <Pencil className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500" onClick={() => onDelete(entry.id)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </td>
      )}
    </tr>
  );
}

function EntryForm({
  weekStart, weekId, entry, projects, clients, orgId,
  onSaved, onCancel,
}: {
  weekStart: string; weekId?: string; entry?: TSEntry | null;
  projects: ProjectOption[]; clients: ClientOption[]; orgId?: string;
  onSaved: () => void; onCancel: () => void;
}) {
  const qc = useQueryClient();
  // Default date = today clamped to the week
  const todayStr = new Date().toISOString().slice(0, 10);
  const weekEnd = addDaysStr(weekStart, 6);
  const defaultDate = todayStr >= weekStart && todayStr <= weekEnd ? todayStr : weekStart;

  const [date, setDate] = useState(entry?.entryDate ?? defaultDate);
  const [projectId, setProjectId] = useState(entry?.projectId ?? "none");
  const [clientId, setClientId] = useState(entry?.clientId ?? "none");
  const [hours, setHours] = useState(String(Math.floor((entry?.durationMinutes ?? 60) / 60)));
  const [minutes, setMinutes] = useState(String((entry?.durationMinutes ?? 60) % 60));
  const [description, setDescription] = useState(entry?.description ?? "");
  const [billable, setBillable] = useState(entry?.billable ?? true);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const dur = (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0);
    if (dur <= 0) { toast.error("Durée requise"); return; }
    setSaving(true);
    try {
      const body = {
        entryDate: date,
        projectId: projectId !== "none" ? projectId : null,
        clientId: clientId !== "none" ? clientId : null,
        durationMinutes: dur,
        description: description || null,
        billable,
      };
      if (entry) {
        await apiFetch(`/api/timesheets/entries/${entry.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiFetch("/api/timesheets/entries", { method: "POST", body: JSON.stringify(body) });
      }
      qc.invalidateQueries({ queryKey: ["ts-weeks"] });
      if (weekId) qc.invalidateQueries({ queryKey: ["ts-entries", weekId] });
      toast.success(entry ? "Entrée mise à jour" : "Entrée ajoutée");
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Date</Label>
          <Input type="date" value={date} min={weekStart} max={weekEnd} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Durée</Label>
          <div className="flex gap-1">
            <Input type="number" min={0} max={23} value={hours} onChange={e => setHours(e.target.value)} placeholder="h" className="w-16 text-center" />
            <span className="self-center text-muted-foreground">h</span>
            <Input type="number" min={0} max={59} step={15} value={minutes} onChange={e => setMinutes(e.target.value)} placeholder="min" className="w-16 text-center" />
            <span className="self-center text-muted-foreground">min</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Client</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Aucun" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucun</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Projet</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Aucun" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucun</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs">Description</Label>
        <Textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Décrivez le travail effectué…" />
      </div>
      <div className="flex items-center gap-2">
        <Switch id="billable" checked={billable} onCheckedChange={setBillable} />
        <Label htmlFor="billable" className="text-sm cursor-pointer">Facturable</Label>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" size="sm" onClick={onCancel}>Annuler</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
          {entry ? "Enregistrer" : "Ajouter"}
        </Button>
      </div>
    </div>
  );
}

function WeekDetail({
  weekId, weekStart, status, reviewComment, reviewerName, isManager,
  projects, clients,
  onBack, onRefresh,
}: {
  weekId: string; weekStart: string; status: string;
  reviewComment?: string | null; reviewerName?: string | null;
  isManager: boolean; projects: ProjectOption[]; clients: ClientOption[];
  onBack: () => void; onRefresh: () => void;
}) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<TSEntry | null>(null);
  const [reviewDialog, setReviewDialog] = useState<"approve" | "reject" | null>(null);
  const [reviewComment2, setReviewComment2] = useState("");

  const { data, isLoading } = useQuery<{ week: TSWeek; entries: TSEntry[] }>({
    queryKey: ["ts-entries", weekId],
    queryFn: () => apiFetch(`/api/timesheets/weeks/${weekId}/entries`),
  });

  const entries = data?.entries ?? [];
  const week = data?.week;
  const editable = status === "draft" || status === "rejected";

  const submitMut = useMutation({
    mutationFn: () => apiFetch(`/api/timesheets/weeks/${weekId}/submit`, { method: "POST" }),
    onSuccess: () => { toast.success("Feuille soumise pour approbation"); qc.invalidateQueries({ queryKey: ["ts-weeks"] }); onRefresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  const reviewMut = useMutation({
    mutationFn: ({ action, comment }: { action: string; comment: string }) =>
      apiFetch(`/api/timesheets/weeks/${weekId}/review`, { method: "PATCH", body: JSON.stringify({ action, comment }) }),
    onSuccess: () => { toast.success("Décision enregistrée"); setReviewDialog(null); qc.invalidateQueries({ queryKey: ["ts-weeks"] }); onRefresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/timesheets/entries/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ts-entries", weekId] }); qc.invalidateQueries({ queryKey: ["ts-weeks"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const totalH = fmtDur(entries.reduce((s, e) => s + e.durationMinutes, 0));
  const billH = fmtDur(entries.filter(e => e.billable).reduce((s, e) => s + e.durationMinutes, 0));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft className="w-4 h-4 mr-1" />Retour</Button>
        <h3 className="font-bold text-lg">Semaine du <WeekLabel weekStart={weekStart} /></h3>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</span>
      </div>

      {status === "rejected" && reviewComment && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
          <p className="font-semibold mb-0.5">Motif du rejet {reviewerName ? `(${reviewerName})` : ""}</p>
          <p>{reviewComment}</p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Entrées</p><p className="text-xl font-bold">{entries.length}</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Total heures</p><p className="text-xl font-bold">{totalH}</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Heures facturables</p><p className="text-xl font-bold text-emerald-600">{billH}</p></CardContent></Card>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {editable && (
          <Button size="sm" onClick={() => { setEditEntry(null); setShowForm(true); }}>
            <Plus className="w-3.5 h-3.5 mr-1" />Ajouter une entrée
          </Button>
        )}
        {status === "draft" && entries.length > 0 && !isManager && (
          <Button size="sm" variant="outline" className="text-amber-700 border-amber-300" onClick={() => submitMut.mutate()} disabled={submitMut.isPending}>
            {submitMut.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
            Soumettre pour approbation
          </Button>
        )}
        {status === "submitted" && isManager && (
          <>
            <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-300" onClick={() => setReviewDialog("approve")}>
              <ThumbsUp className="w-3 h-3 mr-1" />Approuver
            </Button>
            <Button size="sm" variant="outline" className="text-red-700 border-red-300" onClick={() => setReviewDialog("reject")}>
              <ThumbsDown className="w-3 h-3 mr-1" />Rejeter
            </Button>
          </>
        )}
        {status === "approved" && isManager && entries.filter(e => e.billable).length > 0 && (
          <Button size="sm" variant="outline" className="text-primary border-primary/40"
            onClick={() => {
              const billable = entries.filter(e => e.billable);
              const params = new URLSearchParams({
                source: "timesheet",
                weekId,
                clientId: billable[0]?.clientId ?? "",
                description: `Feuilles de temps — semaine du ${weekStart} — ${fmtDur(entries.filter(e=>e.billable).reduce((s,e)=>s+e.durationMinutes,0))} facturables`,
              });
              navigate(`/proformas/new?${params}`);
            }}>
            <FilePlus2 className="w-3 h-3 mr-1" />Créer une proforma
          </Button>
        )}
      </div>

      {/* Form */}
      {(showForm || editEntry) && (
        <Card><CardContent className="p-4">
          <h4 className="font-semibold text-sm mb-3">{editEntry ? "Modifier l'entrée" : "Nouvelle entrée"}</h4>
          <EntryForm
            weekStart={weekStart} weekId={weekId}
            entry={editEntry}
            projects={projects} clients={clients}
            onSaved={() => { setShowForm(false); setEditEntry(null); }}
            onCancel={() => { setShowForm(false); setEditEntry(null); }}
          />
        </CardContent></Card>
      )}

      {/* Entries table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-8 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /></div>
          ) : entries.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-20" />
              Aucune entrée pour cette semaine
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground border-b">
                <tr>
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="text-left px-3 py-2">Client</th>
                  <th className="text-left px-3 py-2">Projet</th>
                  <th className="text-center px-3 py-2">Durée</th>
                  <th className="text-center px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">Description</th>
                  {editable && <th className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <EntryRow
                    key={e.id} entry={e} editable={editable}
                    onEdit={entry => { setEditEntry(entry); setShowForm(false); }}
                    onDelete={id => deleteMut.mutate(id)}
                    projects={projects} clients={clients}
                  />
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Review dialog */}
      <Dialog open={!!reviewDialog} onOpenChange={o => { if (!o) setReviewDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{reviewDialog === "approve" ? "Approuver la feuille" : "Rejeter la feuille"}</DialogTitle>
          </DialogHeader>
          <div>
            <Label className="text-xs">Commentaire {reviewDialog === "reject" ? "(requis)" : "(optionnel)"}</Label>
            <Textarea rows={2} value={reviewComment2} onChange={e => setReviewComment2(e.target.value)} placeholder="Explication…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialog(null)}>Annuler</Button>
            <Button
              className={reviewDialog === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}
              disabled={reviewMut.isPending || (reviewDialog === "reject" && !reviewComment2.trim())}
              onClick={() => reviewMut.mutate({ action: reviewDialog === "approve" ? "approved" : "rejected", comment: reviewComment2 })}>
              {reviewMut.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              {reviewDialog === "approve" ? "Approuver" : "Rejeter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TimesheetsPanel() {
  const { user } = useAuth();
  const isManager = user?.role === "manager" || user?.role === "super_admin" || user?.role === "admin";

  const [mine, setMine] = useState(!isManager);
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [newWeekStart, setNewWeekStart] = useState(() => toWeekStart(new Date().toISOString().slice(0, 10)));

  const { data: pcData } = useQuery<{ projects: ProjectOption[]; clients: ClientOption[] }>({
    queryKey: ["ts-pc"],
    queryFn: () => apiFetch("/api/timesheets/projects-clients"),
  });
  const projects = pcData?.projects ?? [];
  const clients = pcData?.clients ?? [];

  const params = new URLSearchParams();
  if (mine) params.set("mine", "true");

  const { data, isLoading, refetch } = useQuery<{ data: TSWeek[] }>({
    queryKey: ["ts-weeks", mine ? "mine" : "all"],
    queryFn: () => apiFetch(`/api/timesheets/weeks?${params}`),
  });

  const weeks = data?.data ?? [];
  const selected = weeks.find(w => w.id === selectedWeekId);

  // Export
  async function doExport() {
    const url = `/api/timesheets/export?from=${addDaysStr(newWeekStart, -84)}&to=${addDaysStr(newWeekStart, 6)}`;
    const token = localStorage.getItem("auth_token");
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) { toast.error("Erreur export"); return; }
    const blob = await resp.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "feuilles-de-temps.xlsx";
    a.click();
  }

  // Create new week
  const qc = useQueryClient();
  async function createEntry() {
    try {
      const result = await apiFetch("/api/timesheets/entries", {
        method: "POST",
        body: JSON.stringify({ entryDate: newWeekStart, durationMinutes: 0, billable: true }),
      }) as { weekId?: string };
      qc.invalidateQueries({ queryKey: ["ts-weeks"] });
      if (result.weekId) setSelectedWeekId(result.weekId);
    } catch (e: any) { toast.error(e.message); }
  }

  if (selectedWeekId && selected) {
    return (
      <WeekDetail
        weekId={selectedWeekId} weekStart={selected.weekStart} status={selected.status}
        reviewComment={selected.reviewComment} reviewerName={selected.reviewerName}
        isManager={isManager} projects={projects} clients={clients}
        onBack={() => setSelectedWeekId(null)} onRefresh={() => refetch()}
      />
    );
  }

  const pendingReview = weeks.filter(w => w.status === "submitted").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Feuilles de temps</h2>
          <p className="text-xs text-muted-foreground">Suivi des heures par projet et client</p>
        </div>
        <div className="flex gap-2">
          {isManager && (
            <Button variant="outline" size="sm" onClick={() => setMine(!mine)}>
              <Users className="w-3.5 h-3.5 mr-1" />
              {mine ? "Voir toutes" : "Voir les miennes"}
            </Button>
          )}
          {isManager && (
            <Button variant="outline" size="sm" onClick={doExport}>
              <Download className="w-3.5 h-3.5 mr-1" />Export Excel
            </Button>
          )}
          {!isManager && (
            <Button size="sm" onClick={createEntry}>
              <Plus className="w-3.5 h-3.5 mr-1" />Nouvelle semaine
            </Button>
          )}
        </div>
      </div>

      {isManager && pendingReview > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-2 text-sm text-amber-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>{pendingReview}</strong> feuille{pendingReview > 1 ? "s" : ""} en attente d'approbation</span>
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
      ) : weeks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium mb-1">Aucune feuille de temps</p>
            {!isManager && (
              <Button size="sm" className="mt-2" onClick={createEntry}>
                <Plus className="w-3.5 h-3.5 mr-1" />Créer ma première feuille
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground border-b">
                <tr>
                  {isManager && <th className="text-left px-4 py-2.5">Collaborateur</th>}
                  <th className="text-left px-4 py-2.5">Semaine</th>
                  <th className="text-center px-4 py-2.5">Total</th>
                  <th className="text-center px-4 py-2.5">Facturable</th>
                  <th className="text-center px-4 py-2.5">Statut</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {weeks.map(w => (
                  <tr key={w.id} className="border-t hover:bg-muted/20 cursor-pointer" onClick={() => setSelectedWeekId(w.id)}>
                    {isManager && <td className="px-4 py-2.5 font-medium">{w.collaboratorName}</td>}
                    <td className="px-4 py-2.5"><WeekLabel weekStart={w.weekStart} /></td>
                    <td className="px-4 py-2.5 text-center font-semibold">{fmtDur(w.totalMinutes)}</td>
                    <td className="px-4 py-2.5 text-center text-emerald-700">{fmtDur(w.billableMinutes)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[w.status]}`}>
                        {STATUS_LABELS[w.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <ChevronRight className="w-4 h-4 text-muted-foreground inline" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AttendancePage() {
  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Présences & Pointage</h1>
        <p className="text-sm text-slate-500">Pointage géolocalisé, calcul automatique des heures effectives, détection des anomalies (retards, oublis, pauses prolongées).</p>
      </div>
      <Tabs defaultValue="me">
        <TabsList>
          <TabsTrigger value="me">Mon pointage</TabsTrigger>
          <TabsTrigger value="timesheets">Feuilles de temps</TabsTrigger>
          <TabsTrigger value="dashboard">Tableau RH</TabsTrigger>
          <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
          <TabsTrigger value="history">Mon historique</TabsTrigger>
        </TabsList>
        <TabsContent value="me" className="mt-4 space-y-4"><MyClockPanel /></TabsContent>
        <TabsContent value="timesheets" className="mt-4"><TimesheetsPanel /></TabsContent>
        <TabsContent value="dashboard" className="mt-4 space-y-4"><HRDashboard /></TabsContent>
        <TabsContent value="anomalies" className="mt-4 space-y-4"><AnomaliesPanel /></TabsContent>
        <TabsContent value="history" className="mt-4 space-y-4"><MyHistoryPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
