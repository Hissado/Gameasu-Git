import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { formatFCFA, formatFCFACompact } from "@/lib/format";
import { AccountingShell } from "./_layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, TrendingUp, TrendingDown, Scale, Receipt, Building2 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { Link } from "wouter";
import { ModuleIntroCard } from "@/components/ui/module-intro-card";

type Dash = {
  cashTotal: number; creances: number; dettes: number;
  revenusMois: number; chargesMois: number; resultatMois: number;
  monthly: Array<{ month: string; revenus: number; charges: number }>;
  topCreances: Array<{ id: string; ref: string; client: string; amount: number }>;
  topDettes: Array<{ id: string; ref: string; supplier: string; amount: number }>;
};

function KPI({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase font-semibold text-muted-foreground tracking-wide truncate">{label}</div>
            <div className={`text-xl font-bold mt-1 truncate ${accent ?? ""}`}>{value}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-amber-700" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AccountingDashboard() {
  const { data, isLoading } = useQuery<Dash>({
    queryKey: ["accounting-dashboard"],
    queryFn: () => apiFetch("/api/accounting/dashboard"),
  });

  return (
    <AccountingShell title="Comptabilité — Tableau financier" subtitle="Performance financière consolidée · Référentiel SYSCOHADA">
      <ModuleIntroCard moduleKey="comptabilite" />
      {isLoading || !data ? (
        <div className="text-muted-foreground">Chargement…</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPI icon={Wallet} label="Trésorerie totale" value={formatFCFACompact(data.cashTotal)} />
            <KPI icon={TrendingUp} label="Créances clients" value={formatFCFACompact(data.creances)} />
            <KPI icon={TrendingDown} label="Dettes fournisseurs" value={formatFCFACompact(data.dettes)} />
            <KPI icon={Scale} label="Résultat du mois" value={formatFCFACompact(data.resultatMois)} accent={data.resultatMois >= 0 ? "text-emerald-600" : "text-red-600"} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Produits vs Charges — 6 derniers mois</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280} minWidth={1}>
                  <BarChart data={data.monthly}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
                    <Tooltip formatter={(v: any) => formatFCFA(Number(v))} />
                    <Legend />
                    <Bar dataKey="revenus" fill="#10b981" name="Produits" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="charges" fill="#ef4444" name="Charges" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Activité du mois</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Produits</span>
                  <span className="font-bold text-emerald-600">{formatFCFA(data.revenusMois)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Charges</span>
                  <span className="font-bold text-red-600">{formatFCFA(data.chargesMois)}</span>
                </div>
                <div className="border-t pt-3 flex justify-between">
                  <span className="font-semibold">Résultat</span>
                  <span className={`font-bold ${data.resultatMois >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatFCFA(data.resultatMois)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="w-4 h-4" /> Top créances clients
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <tbody>
                    {data.topCreances.length === 0 && (
                      <tr><td className="p-4 text-muted-foreground italic" colSpan={3}>Aucune créance ouverte</td></tr>
                    )}
                    {data.topCreances.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="p-3 font-mono text-xs">{r.ref}</td>
                        <td className="p-3">{r.client ?? "—"}</td>
                        <td className="p-3 text-right font-semibold">{formatFCFA(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-3 border-t text-right">
                  <Link href="/comptabilite/clients" className="text-xs text-amber-700 font-semibold hover:underline">Voir balance âgée →</Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4" /> Top dettes fournisseurs
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <tbody>
                    {data.topDettes.length === 0 && (
                      <tr><td className="p-4 text-muted-foreground italic" colSpan={3}>Aucune dette fournisseur</td></tr>
                    )}
                    {data.topDettes.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="p-3 font-mono text-xs">{r.ref}</td>
                        <td className="p-3">{r.supplier ?? "—"}</td>
                        <td className="p-3 text-right font-semibold">{formatFCFA(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-3 border-t text-right">
                  <Link href="/comptabilite/fournisseurs" className="text-xs text-amber-700 font-semibold hover:underline">Voir fournisseurs →</Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AccountingShell>
  );
}
