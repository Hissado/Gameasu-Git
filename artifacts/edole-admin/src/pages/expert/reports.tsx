import { useActiveFirm, useExpertDashboard, useExpertClients, useExpertClientKpis } from "@/lib/expert-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatFCFA } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Building2, Download, TrendingUp, AlertCircle, FolderKanban } from "lucide-react";
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
  const { data: clientKpis, isLoading: loadKpis } = useExpertClientKpis(firmId);
  const { toast } = useToast();

  const kpiMap = Object.fromEntries((clientKpis ?? []).map((k) => [k.orgId, k]));

  const handleExport = () => {
    if (!clients?.length) return;

    const headers = [
      "Organisation", "Pays", "Plan", "Niveau d'accès", "Statut",
      "CA Total (FCFA)", "Encaissé (FCFA)", "Trésorerie nette (FCFA)",
      "Projets actifs", "Docs en attente", "Factures impayées",
    ];

    const rows = clients.map((c) => {
      const kpi = kpiMap[c.orgId] ?? { totalInvoiced: 0, totalPaid: 0, activeProjects: 0, pendingDocs: 0, unpaidInvoices: 0 };
      return [
        c.org.name,
        c.org.country,
        c.subscription?.planName ?? "—",
        c.accessLevel,
        c.isActive ? "Actif" : "Inactif",
        kpi.totalInvoiced,
        kpi.totalPaid,
        kpi.totalPaid - kpi.totalInvoiced + kpi.totalInvoiced, // totalPaid as net cash
        kpi.activeProjects,
        kpi.pendingDocs,
        kpi.unpaidInvoices,
      ];
    });

    // Totals row
    const totals = clients.reduce(
      (acc, c) => {
        const kpi = kpiMap[c.orgId] ?? { totalInvoiced: 0, totalPaid: 0, activeProjects: 0, pendingDocs: 0, unpaidInvoices: 0 };
        acc.invoiced += kpi.totalInvoiced;
        acc.paid += kpi.totalPaid;
        acc.projects += kpi.activeProjects;
        acc.docs += kpi.pendingDocs;
        acc.unpaid += kpi.unpaidInvoices;
        return acc;
      },
      { invoiced: 0, paid: 0, projects: 0, docs: 0, unpaid: 0 }
    );

    rows.push(["TOTAL", "", "", "", "", totals.invoiced, totals.paid, totals.paid, totals.projects, totals.docs, totals.unpaid]);

    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-expert-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export CSV téléchargé", description: `${clients.length} client${clients.length > 1 ? "s" : ""} — ouvrable dans Excel` });
  };

  if (!firmId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Aucun cabinet sélectionné.</p>
      </div>
    );
  }

  const kpis = dashboard ?? { clientCount: 0, activeSubscriptions: 0, pendingDocumentRequests: 0, totalInvoiced: 0, totalPaid: 0, activeProjects: 0 };

  const planData = Object.entries(
    (clients ?? []).reduce<Record<string, number>>((acc, c) => {
      const plan = c.subscription?.planName ?? "Sans plan";
      acc[plan] = (acc[plan] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([plan, count]) => ({ plan, count }));

  const isLoading = loadClients || loadKpis;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rapports consolidés</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Vue agrégée de tous vos clients</p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={!clients?.length}>
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
            <StatBadge value={kpis.pendingDocumentRequests} label="Docs en attente" color="amber" />
            <StatBadge value={formatFCFA(kpis.totalInvoiced)} label="Total facturé" color="blue" />
            <StatBadge value={formatFCFA(kpis.totalPaid)} label="Total encaissé" color="emerald" />
          </div>
        </CardContent>
      </Card>

      {/* Per-client comparative table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />Tableau comparatif par client
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {isLoading ? (
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
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider sticky left-0 bg-muted/40 z-10">Organisation</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Plan</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">CA facturé</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Encaissé</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Tréso.</th>
                    <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Projets</th>
                    <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Docs att.</th>
                    <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Fact. imp.</th>
                    <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c, i) => {
                    const kpi = kpiMap[c.orgId] ?? { totalInvoiced: 0, totalPaid: 0, activeProjects: 0, pendingDocs: 0, unpaidInvoices: 0 };
                    const treso = kpi.totalPaid;
                    return (
                      <tr key={c.id} className={`border-b last:border-0 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                        <td className="px-5 py-3 font-medium sticky left-0 bg-background z-10">
                          <span className="truncate max-w-[160px] block">{c.org.name}</span>
                          <span className="text-xs text-muted-foreground">{c.org.country}</span>
                        </td>
                        <td className="px-4 py-3">
                          {c.subscription ? (
                            <Badge variant="outline" className="text-[10px] whitespace-nowrap">{c.subscription.planName}</Badge>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                          {kpi.totalInvoiced > 0 ? formatFCFA(kpi.totalInvoiced) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-emerald-700">
                          {kpi.totalPaid > 0 ? formatFCFA(kpi.totalPaid) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                          {treso > 0 ? <span className="text-emerald-700">{formatFCFA(treso)}</span>
                            : treso < 0 ? <span className="text-red-600">{formatFCFA(treso)}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {kpi.activeProjects > 0
                            ? <span className="font-semibold text-purple-700">{kpi.activeProjects}</span>
                            : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {kpi.pendingDocs > 0
                            ? <span className="font-semibold text-amber-600">{kpi.pendingDocs}</span>
                            : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {kpi.unpaidInvoices > 0
                            ? <span className="font-semibold text-red-600">{kpi.unpaidInvoices}</span>
                            : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${c.isActive ? "text-emerald-600" : "text-red-500"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${c.isActive ? "bg-emerald-500" : "bg-red-400"}`} />
                            {c.isActive ? "Actif" : "Inactif"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Totals footer */}
                {clients.length > 1 && (() => {
                  const tot = clients.reduce((acc, c) => {
                    const k = kpiMap[c.orgId] ?? { totalInvoiced: 0, totalPaid: 0, activeProjects: 0, pendingDocs: 0, unpaidInvoices: 0 };
                    return {
                      inv: acc.inv + k.totalInvoiced,
                      paid: acc.paid + k.totalPaid,
                      proj: acc.proj + k.activeProjects,
                      docs: acc.docs + k.pendingDocs,
                      unpaid: acc.unpaid + k.unpaidInvoices,
                    };
                  }, { inv: 0, paid: 0, proj: 0, docs: 0, unpaid: 0 });
                  return (
                    <tfoot>
                      <tr className="bg-muted/30 border-t-2 font-semibold">
                        <td className="px-5 py-3 text-xs uppercase tracking-wider sticky left-0 bg-muted/30">Total</td>
                        <td />
                        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">{formatFCFA(tot.inv)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-emerald-700">{formatFCFA(tot.paid)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-emerald-700">{formatFCFA(tot.paid)}</td>
                        <td className="px-4 py-3 text-center text-purple-700">{tot.proj}</td>
                        <td className="px-4 py-3 text-center text-amber-600">{tot.docs || "—"}</td>
                        <td className="px-4 py-3 text-center text-red-600">{tot.unpaid || "—"}</td>
                        <td />
                      </tr>
                    </tfoot>
                  );
                })()}
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Distribution chart */}
      {planData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-primary" />Répartition clients par plan
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={planData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="plan" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Clients" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
