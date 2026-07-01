import { useActiveFirm, useExpertDashboard, useExpertClients } from "@/lib/expert-api";
import { apiFetch } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatFCFA } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Building2, Download, TrendingUp, AlertCircle, FolderKanban, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function StatBadge({ value, label, color = "blue" }: { value: string | number; label: string; color?: string }) {
  const c: Record<string, string> = {
    blue: "text-blue-600", emerald: "text-emerald-600", amber: "text-amber-600", purple: "text-purple-600",
  };
  return (
    <div className="text-center">
      <p className={`text-xl font-bold ${c[color] ?? c.blue}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

export default function ExpertReportsPage() {
  const { firmId } = useActiveFirm();
  const { data: clients, isLoading: loadClients } = useExpertClients(firmId);
  const { data: dashboard } = useExpertDashboard(firmId);
  const { toast } = useToast();

  // Per-client dashboard data (one request per client)
  const clientIds = (clients ?? []).map((c) => c.orgId);

  // Fetch consolidated data — use the firm dashboard as a summary
  const { data: firmDash } = useQuery({
    queryKey: ["expert/dashboard", firmId],
    queryFn: () => apiFetch<any>(`/api/expert/firms/${firmId}/dashboard`),
    enabled: !!firmId,
  });

  // Build chart data from clients list (static data we have locally)
  const chartData = (clients ?? []).slice(0, 10).map((c) => ({
    name: c.org.name.length > 15 ? c.org.name.slice(0, 15) + "…" : c.org.name,
    plan: c.subscription?.planName ?? "—",
    actif: c.isActive ? 1 : 0,
  }));

  const handleExport = async () => {
    if (!firmId) return;
    try {
      const res = await fetch(`/api/expert/firms/${firmId}/dashboard`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      const data = await res.json();
      // Build a simple CSV
      const rows = [
        ["Métrique", "Valeur"],
        ["Nombre de clients", data.clientCount],
        ["Abonnements actifs", data.activeSubscriptions],
        ["Documents en attente", data.pendingDocRequests],
        ["Total facturé (FCFA)", data.totalInvoiced],
        ["Total encaissé (FCFA)", data.totalPaid],
        ["Projets actifs", data.activeProjects],
      ];
      const csv = rows.map((r) => r.join(";")).join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `rapport-expert-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click(); URL.revokeObjectURL(url);
      toast({ title: "Export CSV téléchargé" });
    } catch {
      toast({ title: "Erreur lors de l'export", variant: "destructive" });
    }
  };

  if (!firmId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Aucun cabinet sélectionné.</p>
      </div>
    );
  }

  const kpis = firmDash ?? { clientCount: 0, activeSubscriptions: 0, pendingDocRequests: 0, totalInvoiced: 0, totalPaid: 0, activeProjects: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rapports consolidés</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Vue agrégée de tous vos clients</p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />Exporter CSV
        </Button>
      </div>

      {/* Global KPIs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />Synthèse cabinet
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 divide-x">
            <StatBadge value={kpis.clientCount} label="Clients" color="blue" />
            <StatBadge value={kpis.activeSubscriptions} label="Abonnements actifs" color="emerald" />
            <StatBadge value={kpis.activeProjects} label="Projets actifs" color="purple" />
            <StatBadge value={kpis.pendingDocRequests} label="Docs en attente" color="amber" />
            <StatBadge value={formatFCFA(kpis.totalInvoiced)} label="Total facturé" color="blue" />
            <StatBadge value={formatFCFA(kpis.totalPaid)} label="Total encaissé" color="emerald" />
          </div>
        </CardContent>
      </Card>

      {/* Clients table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />Tableau comparatif des clients
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {loadClients ? (
            <div className="px-5 pb-5 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}
            </div>
          ) : !clients?.length ? (
            <div className="flex items-center gap-2 px-5 py-10 text-muted-foreground text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Aucun client lié à ce cabinet.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Organisation</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Pays</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Plan</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Accès</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c, i) => (
                    <tr key={c.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                      <td className="px-5 py-3 font-medium">{c.org.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.org.country}</td>
                      <td className="px-4 py-3">
                        {c.subscription ? (
                          <Badge variant="outline" className="text-[10px]">{c.subscription.planName}</Badge>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs capitalize">{c.accessLevel}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${c.isActive ? "text-emerald-600" : "text-red-500"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${c.isActive ? "bg-emerald-500" : "bg-red-400"}`} />
                          {c.isActive ? "Actif" : "Inactif"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Distribution chart */}
      {!!chartData.length && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-primary" />Répartition par plan
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            {/* Plan distribution pie-like bar */}
            {(() => {
              const planCounts = (clients ?? []).reduce<Record<string, number>>((acc, c) => {
                const plan = c.subscription?.planName ?? "Sans plan";
                acc[plan] = (acc[plan] ?? 0) + 1;
                return acc;
              }, {});
              const planData = Object.entries(planCounts).map(([plan, count]) => ({ plan, count }));
              return (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={planData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="plan" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Clients" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
