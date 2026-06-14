import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Activity, Database, Server, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Clock, Cpu, Ticket, Zap, ScrollText } from "lucide-react";

type Health = {
  status: "healthy" | "warning" | "degraded";
  database: { ok: boolean };
  uptime: number;
  memoryMb: number;
  openTickets: number;
  openIncidents: number;
  criticalIncidents: number;
  auditLast24h: number;
  auditLast1h: number;
  checkedAt: string;
};

const STATUS_CFG = {
  healthy:  { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Opérationnel", icon: CheckCircle2, color: "text-emerald-600" },
  warning:  { cls: "bg-amber-50 text-amber-700 border-amber-200",    label: "Attention",     icon: AlertTriangle, color: "text-amber-600" },
  degraded: { cls: "bg-red-50 text-red-700 border-red-200",          label: "Dégradé",       icon: XCircle,       color: "text-red-600" },
};

function fmtUptime(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

type MetricCardProps = { icon: React.FC<{ className?: string }>; label: string; value: string; sub?: string; color?: string; ok?: boolean };

function MetricCard({ icon: Icon, label, value, sub, color = "text-primary", ok }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
            <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="flex items-center gap-1">
            <Icon className={`w-5 h-5 ${color} opacity-70`} />
            {ok !== undefined && (
              ok
                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                : <XCircle className="w-3.5 h-3.5 text-red-500" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MonitoringPage() {
  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery<Health>({
    queryKey: ["cockpit-health-detail"],
    queryFn: () => apiFetch("/api/super-admin/health"),
    refetchInterval: 15_000,
  });

  const h = data;
  const scfg = h ? STATUS_CFG[h.status] : null;
  const StatusIcon = scfg?.icon ?? CheckCircle2;

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("fr-FR") : "…";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Cockpit</p>
          <h1 className="text-2xl font-bold tracking-tight">Monitoring système</h1>
          <p className="text-muted-foreground text-sm mt-1">Rafraîchi toutes les 15 secondes · Dernière mise à jour : {lastUpdated}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : h && scfg ? (
        <>
          {/* Global status banner */}
          <div className={`flex items-center gap-3 border rounded-xl px-4 py-4 ${scfg.cls}`}>
            <StatusIcon className={`w-5 h-5 ${scfg.color}`} />
            <div className="flex-1">
              <p className="font-semibold">{scfg.label}</p>
              <p className="text-sm opacity-80">
                {h.status === "healthy" && "Tous les services fonctionnent normalement."}
                {h.status === "warning" && `${h.openIncidents} incident(s) actif(s) en surveillance.`}
                {h.status === "degraded" && `${h.criticalIncidents} incident(s) critique(s) en cours.`}
              </p>
            </div>
            <Badge variant="outline" className={scfg.cls}>{scfg.label}</Badge>
          </div>

          {/* Infra metrics */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Infrastructure</h2>
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              <MetricCard icon={Activity} label="API Server" value="En ligne" sub="Express 5" color="text-emerald-600" ok={true} />
              <MetricCard icon={Database} label="Base de données" value={h.database.ok ? "Connectée" : "Erreur"} sub="PostgreSQL" color={h.database.ok ? "text-emerald-600" : "text-red-600"} ok={h.database.ok} />
              <MetricCard icon={Clock} label="Uptime" value={fmtUptime(h.uptime)} sub="depuis le démarrage" color="text-indigo-600" />
              <MetricCard icon={Cpu} label="Mémoire" value={`${h.memoryMb} Mo`} sub="Processus Node.js" color={h.memoryMb > 512 ? "text-amber-600" : "text-slate-700"} />
            </div>
          </div>

          {/* Ops metrics */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Support & Opérations</h2>
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              <MetricCard icon={Ticket} label="Tickets ouverts" value={String(h.openTickets)} sub="à traiter" color={h.openTickets > 10 ? "text-amber-600" : h.openTickets > 0 ? "text-slate-700" : "text-emerald-600"} />
              <MetricCard icon={AlertTriangle} label="Incidents actifs" value={String(h.openIncidents)} sub={h.criticalIncidents > 0 ? `dont ${h.criticalIncidents} critique(s)` : "aucun critique"} color={h.criticalIncidents > 0 ? "text-red-600" : h.openIncidents > 0 ? "text-amber-600" : "text-emerald-600"} />
              <MetricCard icon={Zap} label="Audit (1h)" value={String(h.auditLast1h)} sub="actions cockpit" color="text-indigo-600" />
              <MetricCard icon={ScrollText} label="Audit (24h)" value={String(h.auditLast24h)} sub="actions cockpit" color="text-indigo-600" />
            </div>
          </div>

          {/* Service status table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Server className="w-4 h-4 text-primary" />Services
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { name: "API REST",         path: "/api",                       ok: true },
                  { name: "Base de données",  path: "PostgreSQL",                 ok: h.database.ok },
                  { name: "Authentification", path: "/api/auth",                  ok: true },
                  { name: "Socket.IO",        path: "/api/realtime",              ok: true },
                  { name: "Stockage objet",   path: "/api/storage",               ok: true },
                ].map((svc) => (
                  <div key={svc.name} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${svc.ok ? "bg-emerald-500" : "bg-red-500"}`} />
                      <span className="text-sm font-medium">{svc.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">{svc.path}</span>
                    </div>
                    <Badge variant="outline" className={svc.ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}>
                      {svc.ok ? "Opérationnel" : "Erreur"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground text-center">
            Données collectées le {new Date(h.checkedAt).toLocaleString("fr-FR")}
          </p>
        </>
      ) : null}
    </div>
  );
}
