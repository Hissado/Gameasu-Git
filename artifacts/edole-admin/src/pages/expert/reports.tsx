import { useState } from "react";
import { useActiveFirm, useExpertDashboard, useExpertFirmReports, type ClientReportRow } from "@/lib/expert-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatFCFA } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Building2, Download, TrendingUp, AlertCircle, Loader2, BarChart2, FileText } from "lucide-react";
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

function exportCsv(rows: ClientReportRow[]) {
  const headers = [
    "Organisation", "Pays", "Plan", "Niveau d'accès", "Statut",
    "CA facturé (FCFA)", "Encaissé (FCFA)", "Dépenses (FCFA)", "Trésorerie (FCFA)",
    "Projets actifs", "Docs en attente", "Factures impayées",
  ];
  const escape = (v: string | number) => {
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((r) =>
      [
        r.name, r.country, r.planName ?? "—", r.accessLevel,
        r.isActive ? "Actif" : "Inactif",
        r.invoiced, r.paid, r.totalExpenses, r.paid,
        r.activeProjects, r.pendingDocs, r.unpaidInvoices,
      ].map(escape).join(",")
    ),
    [
      "TOTAL", "", "", "", "",
      rows.reduce((s, r) => s + r.invoiced, 0),
      rows.reduce((s, r) => s + r.paid, 0),
      rows.reduce((s, r) => s + r.totalExpenses, 0),
      rows.reduce((s, r) => s + r.paid, 0),
      rows.reduce((s, r) => s + r.activeProjects, 0),
      rows.reduce((s, r) => s + r.pendingDocs, 0),
      rows.reduce((s, r) => s + r.unpaidInvoices, 0),
    ].map(escape).join(","),
  ];
  const bom = "\uFEFF";
  const blob = new Blob([bom + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rapport-clients-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ExpertReportsPage() {
  const { firmId } = useActiveFirm();
  const { data: reports, isLoading } = useExpertFirmReports(firmId);
  const { data: dashboard } = useExpertDashboard(firmId);
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const handleExportXlsx = async () => {
    if (!firmId || !reports?.length) return;
    setExporting(true);
    try {
      const token = localStorage.getItem("auth_token");
      const resp = await fetch(`/api/expert/firms/${firmId}/export-report.xlsx`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        toast({ title: "Erreur lors de l'export", description: `Statut ${resp.status}`, variant: "destructive" });
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rapport-expert-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Export Excel téléchargé", description: `${reports.length} client${reports.length > 1 ? "s" : ""}` });
    } finally {
      setExporting(false);
    }
  };

  const handleExportCsv = () => {
    if (!reports?.length) return;
    exportCsv(reports);
    toast({ title: "Export CSV téléchargé", description: `${reports.length} client${reports.length > 1 ? "s" : ""}` });
  };

  if (!firmId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Aucun cabinet sélectionné.</p>
      </div>
    );
  }

  const kpis = dashboard ?? { clientCount: 0, activeSubscriptions: 0, pendingDocumentRequests: 0, totalInvoiced: 0, totalPaid: 0, activeProjects: 0 };

  const perClientFinancial = (reports ?? []).map((r) => {
    const label = r.name.length > 14 ? r.name.slice(0, 13) + "…" : r.name;
    return { name: label, ca: r.invoiced, encaisse: r.paid, depenses: r.totalExpenses };
  });

  const perClientActivity = (reports ?? []).map((r) => {
    const label = r.name.length > 14 ? r.name.slice(0, 13) + "…" : r.name;
    return { name: label, projets: r.activeProjects, impayes: r.unpaidInvoices, docs: r.pendingDocs };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rapports consolidés</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Vue agrégée de tous vos clients — données en temps réel</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={!reports?.length}>
            <FileText className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportXlsx} disabled={!reports?.length || exporting}>
            {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            {exporting ? "Export…" : "Excel"}
          </Button>
        </div>
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
          ) : !reports?.length ? (
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
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Dépenses</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Tréso.</th>
                    <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Projets</th>
                    <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Docs att.</th>
                    <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Fact. imp.</th>
                    <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r, i) => {
                    const treso = r.paid;
                    return (
                      <tr key={r.orgId} className={`border-b last:border-0 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                        <td className="px-5 py-3 font-medium sticky left-0 bg-background z-10">
                          <span className="truncate max-w-[160px] block">{r.name}</span>
                          <span className="text-xs text-muted-foreground">{r.country}</span>
                        </td>
                        <td className="px-4 py-3">
                          {r.planName ? (
                            <Badge variant="outline" className="text-[10px] whitespace-nowrap">{r.planName}</Badge>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                          {r.invoiced > 0 ? formatFCFA(r.invoiced) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-emerald-700">
                          {r.paid > 0 ? formatFCFA(r.paid) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-red-600">
                          {r.totalExpenses > 0 ? formatFCFA(r.totalExpenses) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                          {treso > 0 ? <span className="text-emerald-700">{formatFCFA(treso)}</span>
                            : treso < 0 ? <span className="text-red-600">{formatFCFA(treso)}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {r.activeProjects > 0
                            ? <span className="font-semibold text-purple-700">{r.activeProjects}</span>
                            : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {r.pendingDocs > 0
                            ? <span className="font-semibold text-amber-600">{r.pendingDocs}</span>
                            : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {r.unpaidInvoices > 0
                            ? <span className="font-semibold text-red-600">{r.unpaidInvoices}</span>
                            : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${r.isActive ? "text-emerald-600" : "text-red-500"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${r.isActive ? "bg-emerald-500" : "bg-red-400"}`} />
                            {r.isActive ? "Actif" : "Inactif"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {reports.length > 1 && (() => {
                  const tot = reports.reduce((acc, r) => ({
                    inv: acc.inv + r.invoiced,
                    paid: acc.paid + r.paid,
                    exp: acc.exp + r.totalExpenses,
                    proj: acc.proj + r.activeProjects,
                    docs: acc.docs + r.pendingDocs,
                    unpaid: acc.unpaid + r.unpaidInvoices,
                  }), { inv: 0, paid: 0, exp: 0, proj: 0, docs: 0, unpaid: 0 });
                  return (
                    <tfoot>
                      <tr className="bg-muted/30 border-t-2 font-semibold">
                        <td className="px-5 py-3 text-xs uppercase tracking-wider sticky left-0 bg-muted/30">Total</td>
                        <td />
                        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">{formatFCFA(tot.inv)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-emerald-700">{formatFCFA(tot.paid)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-red-600">{tot.exp > 0 ? formatFCFA(tot.exp) : "—"}</td>
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

      {/* Per-client financial comparison chart — facturé vs encaissé */}
      {perClientFinancial.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />Performance financière par client
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={perClientFinancial} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} tick={{ fontSize: 10 }} width={55} />
                <Tooltip formatter={(v) => formatFCFA(v as number)} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="ca" name="CA facturé" fill="#2563EB" radius={[4, 4, 0, 0]} />
                <Bar dataKey="encaisse" name="Encaissé" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="depenses" name="Dépenses" fill="#DC2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Per-client activity chart */}
      {perClientActivity.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />Activité par client
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={perClientActivity} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="projets" name="Projets actifs" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                <Bar dataKey="impayes" name="Factures impayées" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="docs" name="Docs en attente" fill="#64748B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
