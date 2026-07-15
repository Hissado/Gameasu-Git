import React from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import { formatFCFA, formatFCFACompact } from "@/lib/format";

interface Props {
  revenueData: any[];
  loading: boolean;
  kpis: any;
  monthlyRevenue: number;
  pipeline: number;
  collectionRate: number;
}

const tt = {
  contentStyle: { backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" },
  labelStyle: { color: "#475569", fontWeight: 600, marginBottom: 4 },
} as const;

export function ChartSection({ revenueData, loading, kpis, monthlyRevenue, pipeline, collectionRate }: Props) {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2 shadow-sm border-slate-200">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base font-bold">Encaissements vs Facturation</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">12 derniers mois — en FCFA</p>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-semibold">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary" />Encaissé</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-300" />Facturé</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="h-[260px] pt-0">
          {loading ? (
            <Skeleton className="w-full h-full rounded-lg" />
          ) : revenueData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Aucune donnée disponible.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false}
                  tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : `${v / 1000}k`} />
                <RTooltip {...tt} formatter={(v: number, name) => [formatFCFA(v), name === "revenue" ? "Encaissé" : "Facturé"]} />
                <Area type="monotone" dataKey="invoiced" stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="4 4" fill="transparent" />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#gradRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-800" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base font-bold text-white">Pipeline CRM</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">Activité commerciale</p>
            </div>
            <Button variant="secondary" size="sm" asChild className="bg-white/10 hover:bg-white/20 text-white border-0 text-xs h-7">
              <Link href="/crm">CRM</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="text-white space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Pipeline qualifié</p>
            <p className="text-2xl font-extrabold text-primary mt-1">{formatFCFACompact(pipeline)}</p>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-primary rounded-full"
                style={{ width: `${Math.min(100, pipeline > 0 && monthlyRevenue > 0 ? (pipeline / Math.max(monthlyRevenue, pipeline)) * 100 : pipeline > 0 ? 100 : 0)}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
            <div><p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Opportunités</p><p className="text-xl font-extrabold mt-1">{kpis?.openOpportunities || 0}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Clients</p><p className="text-xl font-extrabold mt-1">{kpis?.totalClients || 0}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Recouvrement</p><p className="text-xl font-extrabold mt-1">{collectionRate}%</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Locations actives</p><p className="text-xl font-extrabold mt-1">{kpis?.activeRentals || 0}</p></div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
