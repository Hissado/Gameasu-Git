import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock, MapPin, Coffee, LogIn, LogOut, AlertTriangle, CheckCircle2,
  Users, Loader2, Calendar, Camera, MonitorSmartphone,
} from "lucide-react";
import {
  useMyAttendanceToday, useAttendanceDashboard, useAttendanceAnomalies,
  useMyAttendanceHistory, useClockMutation, useResolveAttendanceFlag,
  captureGeolocation, formatMinutes, type AttendanceRecord,
} from "@/lib/attendance";
import { toast } from "sonner";
import { severityLabel } from "@/lib/intelligence";

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
                      <MonitorSmartphone className="w-2.5 h-2.5" /> Kiosk
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-2 shrink-0">
                  {r.photoUrl && (
                    <a href={r.photoUrl} target="_blank" rel="noreferrer" title="Voir la photo de présence">
                      <img
                        src={r.photoUrl}
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

function HRDashboard() {
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const { data, isLoading } = useAttendanceDashboard(date);

  return (
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
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400"><Loader2 className="w-4 h-4 inline animate-spin" /></td></tr>
            ) : data?.sessions.length ? data.sessions.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
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
              </tr>
            )) : (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Aucun pointage pour cette date.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
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
          <TabsTrigger value="dashboard">Tableau RH</TabsTrigger>
          <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
          <TabsTrigger value="history">Mon historique</TabsTrigger>
        </TabsList>
        <TabsContent value="me" className="mt-4 space-y-4"><MyClockPanel /></TabsContent>
        <TabsContent value="dashboard" className="mt-4 space-y-4"><HRDashboard /></TabsContent>
        <TabsContent value="anomalies" className="mt-4 space-y-4"><AnomaliesPanel /></TabsContent>
        <TabsContent value="history" className="mt-4 space-y-4"><MyHistoryPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
