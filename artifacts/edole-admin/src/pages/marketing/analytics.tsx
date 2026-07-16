import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { MarketingShell } from "./_layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from "recharts";
import { Mail, MessageSquare, Phone, Upload, Sparkles, Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";

type Analytics = {
  range: { from: string; to: string };
  series: Array<{ month: string; channel: string; sent: number; failed: number; recipients: number; campaigns: number }>;
  byCampaign: Array<{ id: string; name: string; channel: string; sentCount: number; recipientsCount: number; openCount: number; clickCount: number; replyCount: number; sentAt?: string }>;
};

const channelIcon = (c: string) => c === "email" ? <Mail className="w-3 h-3" /> : c === "sms" ? <MessageSquare className="w-3 h-3" /> : c === "whatsapp" ? <Phone className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />;

const TROPHY_COLORS = ["text-amber-500", "text-muted-foreground/60", "text-amber-700"];
const CHANNEL_AVG: Record<string, { open: number; click: number }> = {
  email:    { open: 22, click: 3.5 },
  sms:      { open: 90, click: 8 },
  whatsapp: { open: 80, click: 12 },
  multi:    { open: 30, click: 5 },
};

function TrendIcon({ value, avg }: { value: number; avg: number }) {
  if (value > avg * 1.1) return <TrendingUp className="w-3 h-3 text-emerald-500 inline" />;
  if (value < avg * 0.7) return <TrendingDown className="w-3 h-3 text-rose-500 inline" />;
  return <Minus className="w-3 h-3 text-muted-foreground inline" />;
}

export default function AnalyticsPage() {
  const [compareTab, setCompareTab] = useState<"open" | "click" | "both">("open");

  const { data, isLoading } = useQuery<Analytics>({
    queryKey: ["marketing-analytics"],
    queryFn: () => apiFetch("/api/marketing/analytics"),
  });

  const pivot: Record<string, Record<string, number>> = {};
  for (const r of data?.series || []) {
    pivot[r.month] ||= { month: r.month as any };
    pivot[r.month][r.channel] = r.sent;
  }
  const chartData = Object.values(pivot);

  // Données de comparaison par campagne : triées par taux d'ouverture
  const compareData = (data?.byCampaign || [])
    .filter((c) => c.sentCount > 0)
    .map((c) => ({
      ...c,
      openRate: parseFloat((c.openCount / c.sentCount * 100).toFixed(1)),
      clickRate: parseFloat((c.clickCount / c.sentCount * 100).toFixed(1)),
      replyRate: parseFloat((c.replyCount / c.sentCount * 100).toFixed(1)),
      name: c.name.length > 24 ? c.name.slice(0, 22) + "…" : c.name,
    }))
    .sort((a, b) => b.openRate - a.openRate)
    .slice(0, 10);

  const exportCsv = () => {
    if (!data?.byCampaign) return;
    const rows = [
      ["Campagne", "Canal", "Envoyés", "Destinataires", "Ouvertures", "Taux ouv. %", "Clics", "Taux clic %", "Réponses", "Date"].join(","),
      ...data.byCampaign.map((c) => {
        const or = c.sentCount > 0 ? (c.openCount / c.sentCount * 100).toFixed(1) : "0.0";
        const cr = c.sentCount > 0 ? (c.clickCount / c.sentCount * 100).toFixed(1) : "0.0";
        return [
          `"${c.name.replace(/"/g, '""')}"`, c.channel, c.sentCount, c.recipientsCount,
          c.openCount, or, c.clickCount, cr, c.replyCount, c.sentAt || "",
        ].join(",");
      }),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `marketing-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <MarketingShell title="Analytique marketing" subtitle="Performance des campagnes sur les 90 derniers jours"
      actions={<Button variant="outline" onClick={exportCsv}><Upload className="w-4 h-4 mr-2" /> Exporter en CSV</Button>}>
      {isLoading ? <div className="text-center py-12 text-muted-foreground">Chargement…</div>
        : !data ? null : (
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b"><CardTitle className="text-base">Volume par mois et canal</CardTitle></CardHeader>
            <CardContent className="p-4">
              {chartData.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">Aucune donnée sur la période.</div>
                : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="email" stackId="a" fill="#3b82f6" name="Email" />
                      <Bar dataKey="sms" stackId="a" fill="#10b981" name="SMS" />
                      <Bar dataKey="whatsapp" stackId="a" fill="#22c55e" name="WhatsApp" />
                      <Bar dataKey="multi" stackId="a" fill="#a855f7" name="Multi" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
            </CardContent>
          </Card>

          {/* Comparaison campagnes */}
          {compareData.length > 0 && (
            <Card>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Comparaison des campagnes</CardTitle>
                  <div className="flex border rounded-md text-xs overflow-hidden">
                    {(["open", "click", "both"] as const).map((tab) => (
                      <button key={tab} onClick={() => setCompareTab(tab)}
                        className={`px-3 py-1.5 transition-colors ${compareTab === tab ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                        {tab === "open" ? "Ouvertures" : tab === "click" ? "Clics" : "Les deux"}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {/* Podium top 3 */}
                {compareData.length >= 2 && (
                  <div className="flex items-end justify-center gap-4 mb-6 pb-4 border-b">
                    {compareData.slice(0, Math.min(3, compareData.length)).map((c, i) => (
                      <div key={c.id} className="text-center">
                        <Trophy className={`w-5 h-5 mx-auto mb-1 ${TROPHY_COLORS[i]}`} />
                        <div className="text-xs font-semibold truncate max-w-[100px]">{c.name}</div>
                        <div className={`text-base font-bold ${i === 0 ? "text-primary" : "text-foreground"}`}>
                          {compareTab === "click" ? `${c.clickRate}%` : `${c.openRate}%`}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {compareTab === "click" ? "clic" : "ouv."}
                        </div>
                        <Badge variant="outline" className="text-[9px] capitalize mt-1">{channelIcon(c.channel)} {c.channel}</Badge>
                      </div>
                    ))}
                  </div>
                )}

                {/* Graphique horizontal */}
                <ResponsiveContainer width="100%" height={Math.max(compareData.length * 44, 200)}>
                  <BarChart data={compareData} layout="vertical" margin={{ left: 0, right: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" unit="%" domain={[0, "auto"]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v: any, name: string) => [`${v}%`, name === "openRate" ? "Taux d'ouverture" : "Taux de clic"]}
                    />
                    {(compareTab === "open" || compareTab === "both") && (
                      <Bar dataKey="openRate" name="openRate" fill="#3b82f6" radius={[0, 4, 4, 0]} label={{ position: "right", formatter: (v: any) => `${v}%`, fontSize: 11 }} />
                    )}
                    {(compareTab === "click" || compareTab === "both") && (
                      <Bar dataKey="clickRate" name="clickRate" fill="#f97316" radius={[0, 4, 4, 0]} label={{ position: "right", formatter: (v: any) => `${v}%`, fontSize: 11 }} />
                    )}
                  </BarChart>
                </ResponsiveContainer>

                <div className="flex gap-4 text-xs text-muted-foreground mt-2 justify-end">
                  {(compareTab === "open" || compareTab === "both") && <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> Taux d'ouverture</span>}
                  {(compareTab === "click" || compareTab === "both") && <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-500 inline-block" /> Taux de clic</span>}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Table détaillée */}
          <Card>
            <CardHeader className="border-b"><CardTitle className="text-base">Performance détaillée par campagne</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Campagne</th>
                    <th className="text-left p-3">Canal</th>
                    <th className="text-right p-3">Envoyés</th>
                    <th className="text-right p-3">Dest.</th>
                    <th className="text-right p-3">Ouv. %</th>
                    <th className="text-right p-3">Clic %</th>
                    <th className="text-right p-3">Rép.</th>
                    <th className="text-left p-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byCampaign.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Aucune campagne envoyée.</td></tr>
                    : data.byCampaign.map((c) => {
                      const openRate = c.sentCount > 0 ? c.openCount / c.sentCount * 100 : 0;
                      const clickRate = c.sentCount > 0 ? c.clickCount / c.sentCount * 100 : 0;
                      const avgChannel = CHANNEL_AVG[c.channel] || { open: 25, click: 4 };
                      return (
                        <tr key={c.id} className="border-b hover:bg-muted/20">
                          <td className="p-3 font-medium max-w-[200px] truncate">{c.name}</td>
                          <td className="p-3"><Badge variant="outline" className="gap-1 capitalize">{channelIcon(c.channel)} {c.channel}</Badge></td>
                          <td className="p-3 text-right font-mono text-xs">{c.sentCount}</td>
                          <td className="p-3 text-right font-mono text-xs">{c.recipientsCount}</td>
                          <td className="p-3 text-right font-mono text-xs">
                            <span className="flex items-center justify-end gap-1">
                              <TrendIcon value={openRate} avg={avgChannel.open} />
                              {openRate.toFixed(1)}%
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono text-xs">
                            <span className="flex items-center justify-end gap-1">
                              <TrendIcon value={clickRate} avg={avgChannel.click} />
                              {clickRate.toFixed(1)}%
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono text-xs">{c.replyCount}</td>
                          <td className="p-3 text-xs text-muted-foreground">{c.sentAt ? new Date(c.sentAt).toLocaleDateString("fr-FR") : "—"}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {data.byCampaign.length > 0 && (
                <div className="p-3 border-t text-xs text-muted-foreground flex gap-3">
                  <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-emerald-500" /> Au-dessus de la moyenne du canal</span>
                  <span className="flex items-center gap-1"><TrendingDown className="w-3 h-3 text-rose-500" /> Sous la moyenne</span>
                  <span className="flex items-center gap-1"><Minus className="w-3 h-3 text-muted-foreground" /> Dans la moyenne</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </MarketingShell>
  );
}
