/**
 * Phase 19 — Anomalies cross-module.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, Activity } from "lucide-react";
import { severityLabel } from "@/lib/intelligence";

const KPI = ({ label, value, accent }: { label: string; value: number; accent?: string }) => (
  <Card><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold mb-1">{label}</p><p className={`text-2xl font-bold ${accent ?? ""}`}>{value}</p></CardContent></Card>
);

const sevColor = (s: string) =>
  s === "critical" ? "bg-red-100 text-red-800 border-red-300" :
  s === "high" ? "bg-red-50 text-red-700 border-red-200" :
  s === "medium" ? "bg-amber-50 text-amber-700 border-amber-200" :
  "bg-slate-50 text-slate-700 border-slate-200";

const linkFor = (it: any): string => {
  switch (it.entityType) {
    case "invoice": return "/factures";
    case "project": return `/projets/${it.entityId}`;
    case "task": return `/tasks/${it.entityId}`;
    case "client": return `/clients/${it.entityId}`;
    default: return "#";
  }
};

export default function AnomalyCenter() {
  const q = useQuery<any>({ queryKey: ["anomalies-scan"], queryFn: () => apiFetch("/api/anomalies/scan") });
  if (q.isLoading || !q.data) return <div className="py-12 text-center"><Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground" /></div>;
  const d = q.data;

  return (
    <div className="space-y-4">
      <div><p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1 flex items-center gap-2"><Activity className="w-3 h-3" />Anomalies</p><h1 className="text-3xl font-bold tracking-tight">Centre de détection</h1><p className="text-sm text-muted-foreground mt-1">Patterns suspects et valeurs aberrantes détectés sur l'ensemble de la plateforme.</p></div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        <KPI label="Total anomalies" value={d.total} />
        <KPI label="Critique" value={d.counts.critical} accent="text-red-700" />
        <KPI label="Élevé" value={d.counts.high} accent="text-red-600" />
        <KPI label="Moyen" value={d.counts.medium} accent="text-amber-600" />
        <KPI label="Faible" value={d.counts.low} />
      </div>

      {d.items.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground italic">Aucune anomalie détectée. Données cohérentes.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {d.items.map((it: any, idx: number) => (
            <Link key={`${it.kind}-${it.entityId}-${idx}`} href={linkFor(it)}>
              <Card className="cursor-pointer hover:bg-muted">
                <CardContent className="p-3 flex items-center gap-3">
                  <AlertTriangle className={`w-4 h-4 shrink-0 ${it.severity === "critical" || it.severity === "high" ? "text-red-600" : "text-amber-600"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{it.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{it.detail}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">{it.entityType}</Badge>
                  <Badge variant="outline" className={`${sevColor(it.severity)} text-[10px] shrink-0`}>{severityLabel(it.severity)}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
