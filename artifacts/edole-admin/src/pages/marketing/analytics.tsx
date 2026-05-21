import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { MarketingShell } from "./_layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { Mail, MessageSquare, Phone, Download, Sparkles } from "lucide-react";

type Analytics = {
  range: { from: string; to: string };
  series: Array<{ month: string; channel: string; sent: number; failed: number; recipients: number; campaigns: number }>;
  byCampaign: Array<{ id: string; name: string; channel: string; sentCount: number; recipientsCount: number; openCount: number; clickCount: number; replyCount: number; sentAt?: string }>;
};

const channelIcon = (c: string) => c === "email" ? <Mail className="w-3 h-3" /> : c === "sms" ? <MessageSquare className="w-3 h-3" /> : c === "whatsapp" ? <Phone className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />;

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery<Analytics>({
    queryKey: ["marketing-analytics"],
    queryFn: () => apiFetch("/api/marketing/analytics"),
  });

  // Pivot série pour chart : month → {email, sms, whatsapp, multi}
  const pivot: Record<string, Record<string, number>> = {};
  for (const r of data?.series || []) {
    pivot[r.month] ||= { month: r.month as any };
    pivot[r.month][r.channel] = r.sent;
  }
  const chartData = Object.values(pivot);

  const exportCsv = () => {
    if (!data?.byCampaign) return;
    const rows = [
      ["Campagne", "Canal", "Envoyés", "Destinataires", "Ouvertures", "Clics", "Réponses", "Date"].join(","),
      ...data.byCampaign.map((c) => [
        `"${c.name.replace(/"/g, '""')}"`, c.channel, c.sentCount, c.recipientsCount,
        c.openCount, c.clickCount, c.replyCount, c.sentAt || "",
      ].join(",")),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `marketing-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <MarketingShell title="Analytique marketing" subtitle="Performance des campagnes sur les 90 derniers jours"
      actions={<Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4 mr-2" /> Exporter en CSV</Button>}>
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
                      <Bar dataKey="email" stackId="a" fill="#3b82f6" />
                      <Bar dataKey="sms" stackId="a" fill="#10b981" />
                      <Bar dataKey="whatsapp" stackId="a" fill="#22c55e" />
                      <Bar dataKey="multi" stackId="a" fill="#a855f7" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b"><CardTitle className="text-base">Performance par campagne</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Campagne</th>
                    <th className="text-left p-3">Canal</th>
                    <th className="text-right p-3">Envoyés</th>
                    <th className="text-right p-3">Destinataires</th>
                    <th className="text-right p-3">Ouverture</th>
                    <th className="text-right p-3">Clic</th>
                    <th className="text-right p-3">Réponses</th>
                    <th className="text-left p-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byCampaign.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Aucune campagne envoyée.</td></tr>
                    : data.byCampaign.map((c) => {
                      const openRate = c.sentCount > 0 ? (c.openCount / c.sentCount * 100).toFixed(1) : "0.0";
                      const clickRate = c.sentCount > 0 ? (c.clickCount / c.sentCount * 100).toFixed(1) : "0.0";
                      return (
                        <tr key={c.id} className="border-b hover:bg-muted/20">
                          <td className="p-3 font-medium">{c.name}</td>
                          <td className="p-3"><Badge variant="outline" className="gap-1 capitalize">{channelIcon(c.channel)} {c.channel}</Badge></td>
                          <td className="p-3 text-right font-mono text-xs">{c.sentCount}</td>
                          <td className="p-3 text-right font-mono text-xs">{c.recipientsCount}</td>
                          <td className="p-3 text-right font-mono text-xs">{openRate}%</td>
                          <td className="p-3 text-right font-mono text-xs">{clickRate}%</td>
                          <td className="p-3 text-right font-mono text-xs">{c.replyCount}</td>
                          <td className="p-3 text-xs text-muted-foreground">{c.sentAt ? new Date(c.sentAt).toLocaleDateString("fr-FR") : "—"}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </MarketingShell>
  );
}
