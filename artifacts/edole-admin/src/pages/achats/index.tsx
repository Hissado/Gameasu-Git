import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { formatFCFA, formatDate } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  Building2, TrendingDown, AlertTriangle, Clock, ChevronRight, ArrowRight,
} from "lucide-react";
import { StatusBadgePurchases } from "./_shared";

// ─── Types ────────────────────────────────────────────────────────────────────

type OverviewData = {
  suppliersActive: number;
  monthExpenses: number;
  totalUnpaid: number;
  overdueCount: number;
  overdueAmount: number;
  upcomingPaymentsCount: number;
  upcomingPaymentsAmount: number;
  tunnel: Array<{ label: string; status: string; count: number; amount: number }>;
};

type PeriodRow = { period: string; total: number; count: number };
type SupplierRow = { supplierId: string; supplierName: string; totalInvoiced: number; totalPaid: number; balance: number; invoiceCount: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TUNNEL_COLORS: Record<string, string> = {
  review: "#3b82f6",
  awaiting_approval: "#eab308",
  approved: "#14b8a6",
  pending: "#F37021",
  partially_paid: "#f59e0b",
  paid: "#22c55e",
};

const MONTH_SHORT: Record<string, string> = {
  "01": "Jan", "02": "Fév", "03": "Mar", "04": "Avr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Aoû",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Déc",
};

function periodLabel(p: string) {
  const [y, m] = p.split("-");
  return `${MONTH_SHORT[m] ?? m} ${y.slice(2)}`;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5 flex items-start gap-4">
        <div className={`rounded-lg p-2.5 ${color ?? "bg-slate-100"}`}>
          <Icon className="w-5 h-5 text-inherit" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
          <p className="text-xl font-bold tracking-tight leading-tight">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function FcfaTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-xs">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.fill ?? p.color }}>{formatFCFA(p.value)}</p>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AchatsOverview() {
  const { data: overview, isLoading: ovLoading } = useQuery<OverviewData>({
    queryKey: ["purchases-overview"],
    queryFn: () => apiFetch("/api/purchases/overview"),
  });

  const { data: periodRes } = useQuery<{ data: PeriodRow[] }>({
    queryKey: ["purchases-by-period"],
    queryFn: () => apiFetch("/api/purchases/reports/by-period"),
  });

  const { data: supplierRes } = useQuery<{ data: SupplierRow[] }>({
    queryKey: ["purchases-by-supplier"],
    queryFn: () => apiFetch("/api/purchases/reports/by-supplier?limit=8"),
  });

  const tunnel = overview?.tunnel ?? [];
  const byPeriod = periodRes?.data ?? [];
  const bySupplier = supplierRes?.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Vue d'ensemble Achats"
        subtitle="Tableau de bord des comptes fournisseurs"
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {ovLoading ? (
          [1, 2, 3, 4].map(i => <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>)
        ) : (
          <>
            <KpiCard
              icon={Building2}
              label="Fournisseurs actifs"
              value={String(overview?.suppliersActive ?? 0)}
              color="bg-slate-100 text-slate-600"
            />
            <KpiCard
              icon={TrendingDown}
              label="Décaissements ce mois"
              value={formatFCFA(overview?.monthExpenses ?? 0)}
              color="bg-blue-50 text-blue-600"
            />
            <KpiCard
              icon={Clock}
              label="Total impayé"
              value={formatFCFA(overview?.totalUnpaid ?? 0)}
              sub={`${overview?.upcomingPaymentsCount ?? 0} échéance${(overview?.upcomingPaymentsCount ?? 0) > 1 ? "s" : ""} cette semaine`}
              color="bg-orange-50 text-orange-600"
            />
            <KpiCard
              icon={AlertTriangle}
              label="Factures en retard"
              value={String(overview?.overdueCount ?? 0)}
              sub={overview?.overdueAmount ? formatFCFA(overview.overdueAmount) : undefined}
              color="bg-red-50 text-red-600"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AP Tunnel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              Tunnel AP — Factures par statut
              <Link href="/achats/factures" className="text-xs font-normal text-[#F37021] flex items-center gap-1 hover:underline">
                Voir toutes <ArrowRight className="w-3 h-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ovLoading ? <Skeleton className="h-48 w-full" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={tunnel} margin={{ left: 8, right: 8, bottom: 24 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" interval={0} />
                  <YAxis tickFormatter={(v) => formatFCFA(v).replace(" FCFA", "")} tick={{ fontSize: 10 }} width={70} />
                  <Tooltip content={<FcfaTooltip />} />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {tunnel.map((entry) => (
                      <Cell key={entry.status} fill={TUNNEL_COLORS[entry.status] ?? "#94a3b8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              {tunnel.map(t => (
                <div key={t.status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: TUNNEL_COLORS[t.status] ?? "#94a3b8" }} />
                  {t.label}: <strong>{t.count}</strong>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Dépenses par période */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              Décaissements — 12 derniers mois
              <Link href="/achats/rapports" className="text-xs font-normal text-[#F37021] flex items-center gap-1 hover:underline">
                Rapports <ArrowRight className="w-3 h-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {byPeriod.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">Aucun décaissement enregistré</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byPeriod} margin={{ left: 8, right: 8 }}>
                  <XAxis dataKey="period" tickFormatter={periodLabel} tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(v) => formatFCFA(v).replace(" FCFA", "")} tick={{ fontSize: 10 }} width={70} />
                  <Tooltip content={<FcfaTooltip />} />
                  <Bar dataKey="total" fill="#F37021" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top fournisseurs */}
      {bySupplier.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              Top fournisseurs par volume facturé
              <Link href="/achats/fournisseurs" className="text-xs font-normal text-[#F37021] flex items-center gap-1 hover:underline">
                Tous les fournisseurs <ArrowRight className="w-3 h-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {bySupplier.slice(0, 6).map((s, i) => {
                const pct = s.totalInvoiced > 0 ? Math.round((s.totalPaid / s.totalInvoiced) * 100) : 0;
                return (
                  <div key={s.supplierId} className="flex items-center gap-3">
                    <span className="w-5 text-xs text-muted-foreground font-mono text-right shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-sm mb-0.5">
                        <span className="font-medium truncate">{s.supplierName}</span>
                        <span className="font-semibold shrink-0 ml-2">{formatFCFA(s.totalInvoiced)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-[#F37021]" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-12 text-right">{pct}% payé</span>
                      </div>
                    </div>
                    {s.balance > 0 && (
                      <Badge variant="outline" className="text-xs text-amber-700 border-amber-200 bg-amber-50 shrink-0">
                        {formatFCFA(s.balance)} restant
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick nav cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: "/achats/fournisseurs", label: "Fournisseurs" },
          { href: "/achats/factures", label: "Factures" },
          { href: "/achats/bons-de-commande", label: "Bons de commande" },
          { href: "/achats/paiements", label: "Paiements" },
          { href: "/achats/depenses", label: "Notes de frais" },
          { href: "/achats/approbations", label: "Approbations" },
          { href: "/achats/rapports", label: "Rapports" },
        ].map(nav => (
          <Link key={nav.href} href={nav.href}>
            <div className="border rounded-lg p-3 flex items-center justify-between hover:border-[#F37021] hover:bg-orange-50 transition-colors cursor-pointer group">
              <span className="text-sm font-medium">{nav.label}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-[#F37021]" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
