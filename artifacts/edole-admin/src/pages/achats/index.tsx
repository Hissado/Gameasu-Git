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
  ShoppingCart, Receipt, CheckCircle2, Bell,
} from "lucide-react";
import { StatusBadgePurchases } from "./_shared";
import { ModuleIntroCard } from "@/components/ui/module-intro-card";

// ─── Types ────────────────────────────────────────────────────────────────────

type UrgentInvoice = {
  id: string; referenceNumber: string; dueDate: string | null;
  totalAmount: number; paidAmount: number; balance: number;
  status: string; supplierName: string | null; isOverdue: boolean;
};

type ActivityItem = {
  id: string;
  type: "payment" | "po_confirmed" | "expense_approved";
  amount: number;
  eventAt: string | null;
  label: string;
  sublabel: string;
};

type OverviewData = {
  suppliersActive: number;
  monthExpenses: number;
  totalUnpaid: number;
  overdueCount: number;
  overdueAmount: number;
  upcomingPaymentsCount: number;
  upcomingPaymentsAmount: number;
  approvalsInvoiceCount: number;
  posPendingCount: number;
  posPendingAmount: number;
  expensesSubmittedCount: number;
  tunnel: Array<{ label: string; status: string; count: number; amount: number }>;
  urgentInvoices: UrgentInvoice[];
  recentActivity: ActivityItem[];
};

type PeriodRow = { period: string; total: number; count: number };
type SupplierRow = { supplierId: string; supplierName: string; totalInvoiced: number; totalPaid: number; balance: number; invoiceCount: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TUNNEL_COLORS: Record<string, string> = {
  review: "#3b82f6",
  awaiting_approval: "#eab308",
  approved: "#14b8a6",
  pending: "#2563EB",
  partially_paid: "#f59e0b",
  paid: "#22c55e",
};

const MONTH_SHORT: Record<string, string> = {
  "01":"Jan","02":"Fév","03":"Mar","04":"Avr","05":"Mai","06":"Jun",
  "07":"Jul","08":"Aoû","09":"Sep","10":"Oct","11":"Nov","12":"Déc",
};

function periodLabel(p: string) {
  const [y, m] = p.split("-");
  return `${MONTH_SHORT[m] ?? m} ${y.slice(2)}`;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color, href }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color?: string; href?: string;
}) {
  const inner = (
    <Card className={href ? "hover:shadow-md transition-shadow cursor-pointer" : ""}>
      <CardContent className="p-5 flex items-start gap-4">
        <div className={`rounded-lg p-2.5 ${color ?? "bg-slate-100"}`}>
          <Icon className="w-5 h-5 text-inherit" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
          <p className="text-xl font-bold tracking-tight leading-tight">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        {href && <ChevronRight className="w-4 h-4 text-slate-400 self-center flex-shrink-0" />}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
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
    queryFn: () => apiFetch("/api/purchases/reports/by-supplier?limit=6"),
  });

  const tunnel = overview?.tunnel ?? [];
  const byPeriod = periodRes?.data ?? [];
  const bySupplier = supplierRes?.data ?? [];
  const urgent = overview?.urgentInvoices ?? [];
  const activity = overview?.recentActivity ?? [];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Vue d'ensemble Achats"
        subtitle="Tableau de bord des comptes fournisseurs"
      />
      <ModuleIntroCard moduleKey="achats" />

      {/* ── KPI cards — 7 indicateurs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {ovLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))
        ) : (
          <>
            <KpiCard
              icon={Building2}
              label="Fournisseurs actifs"
              value={String(overview?.suppliersActive ?? 0)}
              color="bg-slate-100 text-slate-600"
              href="/achats/fournisseurs"
            />
            <KpiCard
              icon={TrendingDown}
              label="Décaissements ce mois"
              value={formatFCFA(overview?.monthExpenses ?? 0)}
              color="bg-blue-50 text-blue-600"
              href="/achats/rapports"
            />
            <KpiCard
              icon={Clock}
              label="Total impayé"
              value={formatFCFA(overview?.totalUnpaid ?? 0)}
              sub={`${overview?.upcomingPaymentsCount ?? 0} échéance${(overview?.upcomingPaymentsCount ?? 0) > 1 ? "s" : ""} cette semaine`}
              color="bg-orange-50 text-orange-600"
              href="/achats/rapports"
            />
            <KpiCard
              icon={AlertTriangle}
              label="Factures en retard"
              value={String(overview?.overdueCount ?? 0)}
              sub={overview?.overdueAmount ? formatFCFA(overview.overdueAmount) : undefined}
              color="bg-red-50 text-red-600"
              href="/achats/factures"
            />
            <KpiCard
              icon={Bell}
              label="Approbations en attente"
              value={String((overview?.approvalsInvoiceCount ?? 0) + (overview?.posPendingCount ?? 0) + (overview?.expensesSubmittedCount ?? 0))}
              sub={`${overview?.approvalsInvoiceCount ?? 0} facture${(overview?.approvalsInvoiceCount ?? 0) > 1 ? "s" : ""} · ${overview?.posPendingCount ?? 0} BC · ${overview?.expensesSubmittedCount ?? 0} NDF`}
              color="bg-yellow-50 text-yellow-600"
              href="/achats/approbations"
            />
            <KpiCard
              icon={ShoppingCart}
              label="BCs en cours"
              value={String(overview?.posPendingCount ?? 0)}
              sub={overview?.posPendingAmount ? formatFCFA(overview.posPendingAmount) : undefined}
              color="bg-teal-50 text-teal-600"
              href="/achats/bons-de-commande"
            />
            <KpiCard
              icon={Receipt}
              label="Notes de frais soumises"
              value={String(overview?.expensesSubmittedCount ?? 0)}
              sub="En attente d'approbation"
              color="bg-purple-50 text-purple-600"
              href="/achats/depenses"
            />
            <KpiCard
              icon={CheckCircle2}
              label="Échéances cette semaine"
              value={String(overview?.upcomingPaymentsCount ?? 0)}
              sub={overview?.upcomingPaymentsAmount ? formatFCFA(overview.upcomingPaymentsAmount) : undefined}
              color="bg-emerald-50 text-emerald-600"
              href="/achats/rapports"
            />
          </>
        )}
      </div>

      {/* ── Tunnel AP + Courbe décaissements ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AP Tunnel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              Tunnel AP — Factures par statut
              <Link href="/achats/factures" className="text-xs font-normal text-[#2563EB] flex items-center gap-1 hover:underline">
                Voir toutes <ArrowRight className="w-3 h-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ovLoading ? <Skeleton className="h-48 w-full" /> : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={tunnel} margin={{ left: 8, right: 8, bottom: 20 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} angle={-15} textAnchor="end" interval={0} />
                    <YAxis tickFormatter={(v) => formatFCFA(v).replace(" FCFA", "")} tick={{ fontSize: 9 }} width={68} />
                    <Tooltip content={<FcfaTooltip />} />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                      {tunnel.map((entry) => (
                        <Cell key={entry.status} fill={TUNNEL_COLORS[entry.status] ?? "#94a3b8"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {/* Stage-wise count links */}
                <div className="grid grid-cols-3 gap-1.5 mt-3">
                  {tunnel.filter(s => s.count > 0).map(s => (
                    <Link href="/achats/factures" key={s.status}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs border hover:bg-slate-50 transition-colors">
                      <span className="text-slate-600 truncate">{s.label}</span>
                      <span className="font-bold ml-1 flex-shrink-0" style={{ color: TUNNEL_COLORS[s.status] ?? "#64748b" }}>{s.count}</span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Courbe décaissements */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              Décaissements — 12 derniers mois
              <Link href="/achats/rapports" className="text-xs font-normal text-[#2563EB] flex items-center gap-1 hover:underline">
                Rapports <ArrowRight className="w-3 h-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {byPeriod.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Aucune donnée de paiement</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byPeriod.map(r => ({ name: periodLabel(r.period), total: r.total }))} margin={{ left: 8 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis tickFormatter={(v) => formatFCFA(v).replace(" FCFA", "")} tick={{ fontSize: 9 }} width={68} />
                  <Tooltip content={<FcfaTooltip />} />
                  <Bar dataKey="total" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Factures urgentes + Top fournisseurs ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Factures urgentes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Factures urgentes
              </span>
              <Link href="/achats/factures" className="text-xs font-normal text-[#2563EB] flex items-center gap-1 hover:underline">
                Voir toutes <ArrowRight className="w-3 h-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {ovLoading ? (
              <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : urgent.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-400" />
                Aucune facture urgente
              </div>
            ) : (
              <div className="divide-y">
                {urgent.slice(0, 5).map(inv => (
                  <div key={inv.id} className={`flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors ${inv.isOverdue ? "bg-red-50/30" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-500">{inv.referenceNumber}</span>
                        {inv.isOverdue && <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">Échu</Badge>}
                      </div>
                      <p className="text-sm font-medium truncate">{inv.supplierName ?? "—"}</p>
                      <p className="text-xs text-slate-400">Éch. {inv.dueDate ? formatDate(inv.dueDate) : "—"}</p>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <p className="font-bold text-sm text-[#2563EB]">{formatFCFA(inv.balance)}</p>
                      <StatusBadgePurchases status={inv.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top fournisseurs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-slate-500" />
                Top fournisseurs
              </span>
              <Link href="/achats/fournisseurs" className="text-xs font-normal text-[#2563EB] flex items-center gap-1 hover:underline">
                Voir tous <ArrowRight className="w-3 h-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-2">
            {bySupplier.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-6">Aucun fournisseur</p>
            ) : (
              <ResponsiveContainer width="100%" height={bySupplier.slice(0, 5).length * 36 + 16}>
                <BarChart
                  layout="vertical"
                  data={bySupplier.slice(0, 5).map(s => ({
                    name: s.supplierName && s.supplierName.length > 18 ? s.supplierName.slice(0, 18) + "…" : (s.supplierName ?? "—"),
                    Facturé: s.totalInvoiced,
                    Solde: s.balance,
                  }))}
                  margin={{ top: 4, right: 8, left: 4, bottom: 4 }}
                >
                  <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={80} />
                  <Tooltip formatter={(v: number) => [formatFCFA(v)]} />
                  <Bar dataKey="Facturé" fill="#2563EB" radius={[0, 3, 3, 0]} barSize={12} />
                  <Bar dataKey="Solde" fill="#94a3b8" radius={[0, 3, 3, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Dernières activités ── */}
      {activity.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-slate-500" />
              Dernières activités
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {activity.map(a => {
                const iconBg = a.type === "payment" ? "bg-emerald-50" : a.type === "po_confirmed" ? "bg-blue-50" : "bg-amber-50";
                const iconColor = a.type === "payment" ? "text-emerald-600" : a.type === "po_confirmed" ? "text-blue-600" : "text-amber-600";
                const amtColor = a.type === "payment" ? "text-emerald-700" : a.type === "po_confirmed" ? "text-blue-700" : "text-amber-700";
                return (
                  <div key={a.id + a.type} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                    <div className={`rounded-full p-1.5 flex-shrink-0 ${iconBg}`}>
                      <CheckCircle2 className={`h-3.5 w-3.5 ${iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{a.label}</p>
                      <p className="text-xs text-slate-500 truncate">{a.sublabel}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`font-semibold text-sm ${amtColor}`}>{formatFCFA(a.amount)}</p>
                      <p className="text-xs text-slate-400">{a.eventAt ? formatDate(a.eventAt) : "—"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Navigation rapide ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: "/achats/fournisseurs",       label: "Fournisseurs",       icon: Building2 },
          { href: "/achats/factures",            label: "Factures",           icon: TrendingDown },
          { href: "/achats/bons-de-commande",    label: "Bons de commande",   icon: ShoppingCart },
          { href: "/achats/paiements",           label: "Paiements",          icon: CheckCircle2 },
          { href: "/achats/depenses",            label: "Dépenses",           icon: Receipt },
          { href: "/achats/approbations",        label: "Approbations",       icon: Bell },
          { href: "/achats/rapports",            label: "Rapports",           icon: AlertTriangle },
          { href: "/achats/factures",            label: "Voir impayées",      icon: Clock },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={href + label} href={href}>
            <div className="flex items-center gap-2 rounded-lg border bg-white p-3 hover:bg-slate-50 hover:border-[#2563EB] transition-colors cursor-pointer">
              <Icon className="h-4 w-4 text-[#2563EB]" />
              <span className="text-sm font-medium text-slate-700">{label}</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400 ml-auto" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
