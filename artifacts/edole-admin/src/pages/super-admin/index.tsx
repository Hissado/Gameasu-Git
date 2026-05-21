/**
 * Phase 20 — Cockpit super-admin.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Crown, Building2 } from "lucide-react";
import { formatFCFA } from "@/lib/format";
import { useAuth } from "@/lib/auth";

const KPI = ({ label, value, accent }: { label: string; value: string | number; accent?: string }) => (
  <Card><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold mb-1">{label}</p><p className={`text-2xl font-bold ${accent ?? ""}`}>{value}</p></CardContent></Card>
);

export default function SuperAdminCockpit() {
  const { user } = useAuth();
  const ov = useQuery<any>({ queryKey: ["sa-ov"], queryFn: () => apiFetch("/api/super-admin/overview"), enabled: user?.role === "super_admin" });
  const orgs = useQuery<any>({ queryKey: ["sa-orgs"], queryFn: () => apiFetch("/api/super-admin/organizations"), enabled: user?.role === "super_admin" });

  if (user?.role !== "super_admin") {
    return <Card><CardContent className="p-12 text-center"><Crown className="w-10 h-10 mx-auto text-muted-foreground mb-2" /><p className="font-medium">Accès réservé aux super-administrateurs</p></CardContent></Card>;
  }
  if (ov.isLoading || !ov.data) return <div className="py-12 text-center"><Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground" /></div>;
  const d = ov.data;

  return (
    <div className="space-y-4">
      <div><p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1 flex items-center gap-2"><Crown className="w-3 h-3" />Super-admin</p><h1 className="text-3xl font-bold tracking-tight">Cockpit plateforme</h1></div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <KPI label="Organisations" value={`${d.activeOrgs} / ${d.totalOrgs}`} />
        <KPI label="Utilisateurs uniques" value={d.totalUsers} />
        <KPI label="Abonnements actifs" value={d.activeSubscriptions} />
        <KPI label="MRR" value={formatFCFA(d.mrrFcfa)} accent="text-primary" />
        <KPI label="ARR" value={formatFCFA(d.arrFcfa)} accent="text-primary" />
        <KPI label="Encaissé 30j" value={formatFCFA(d.paidLast30Days)} accent="text-emerald-600" />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Répartition par plan</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(d.byPlan).map(([code, v]: any) => (
            <div key={code} className="flex items-center justify-between border-b pb-1.5 last:border-0">
              <Badge variant="outline" className="font-mono">{code}</Badge>
              <span className="text-xs text-muted-foreground">{v.count} org(s) · {v.seats} sièges</span>
              <span className="text-sm font-bold">{formatFCFA(v.mrr)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4" />Organisations ({orgs.data?.count ?? 0})</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {orgs.data?.rows?.map((o: any) => (
            <div key={o.id} className="flex items-center justify-between text-sm border-b pb-1.5 last:border-0 gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{o.name} {o.isDefault && <Badge variant="outline" className="text-[10px] ml-1">défaut</Badge>}</p>
                <p className="text-xs text-muted-foreground">{o.slug} · {o.country ?? "?"} · {o.memberCount} membre(s) · {o.enabledModules} module(s)</p>
              </div>
              <Badge variant="outline">{o.planCode ?? "—"}</Badge>
              <span className="text-xs">{o.seats} sièges</span>
              <span className="text-sm font-bold w-28 text-right">{formatFCFA(o.mrr)}/mois</span>
              <Badge variant="outline" className={o.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50"}>{o.isActive ? "actif" : "inactif"}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
