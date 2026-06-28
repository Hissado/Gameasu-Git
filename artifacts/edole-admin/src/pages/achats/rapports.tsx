import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { formatFCFA, formatDate } from "@/lib/format";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Download, AlertTriangle, TrendingDown, Building2, FileText } from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type AgingData = {
  items: AgingItem[];
  buckets: Record<string, number>;
  bucketCounts: Record<string, number>;
  total: number;
};
type AgingItem = {
  id: string; referenceNumber: string; supplierName: string | null;
  dueDate: string | null; invoiceDate: string; status: string;
  totalAmount: number; paidAmount: number; balance: number; bucket: string;
};
type PeriodRow = { period: string; total: number; count: number };
type SupplierRow = {
  supplierId: string; supplierName: string;
  totalInvoiced: number; totalPaid: number; balance: number; invoiceCount: number;
};

// ─── Tab config ───────────────────────────────────────────────────────────────

type TabId = "aging" | "period" | "supplier" | "unpaid";
const TABS: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
  { id: "aging",    label: "Vieillissement AP",    icon: AlertTriangle },
  { id: "period",   label: "Dépenses par période", icon: TrendingDown },
  { id: "supplier", label: "Par fournisseur",      icon: Building2 },
  { id: "unpaid",   label: "Factures impayées",    icon: FileText },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BUCKET_LABELS: Record<string, string> = {
  current: "Non échu",
  d1_30:   "1–30 j",
  d31_60:  "31–60 j",
  d61_90:  "61–90 j",
  over90:  "> 90 j",
};
const BUCKET_COLORS: Record<string, string> = {
  current: "#22c55e",
  d1_30:   "#f59e0b",
  d31_60:  "#F37021",
  d61_90:  "#ef4444",
  over90:  "#7f1d1d",
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

function downloadCsv(rows: any[], filename: string, cols: Array<{ key: string; header: string; fmt?: (v: any) => string }>) {
  const header = cols.map(c => c.header).join(";");
  const lines = rows.map(r => cols.map(c => {
    const v = r[c.key];
    return c.fmt ? c.fmt(v) : String(v ?? "");
  }).join(";"));
  const csv = [header, ...lines].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast.success("Export CSV téléchargé");
}

// ─── Tab: Aging ───────────────────────────────────────────────────────────────

function TabAging() {
  const { data, isLoading } = useQuery<AgingData>({
    queryKey: ["purchases-report-aging"],
    queryFn: () => apiFetch("/api/purchases/reports/aging"),
  });

  const items = data?.items ?? [];
  const buckets = data?.buckets ?? {};
  const bucketCounts = data?.bucketCounts ?? {};
  const total = data?.total ?? 0;

  const chartData = Object.keys(BUCKET_LABELS).map(key => ({
    name: BUCKET_LABELS[key],
    amount: buckets[key] ?? 0,
    count: bucketCounts[key] ?? 0,
    key,
  }));

  const exportCsv = () => downloadCsv(items, "aging-ap.csv", [
    { key: "supplierName", header: "Fournisseur" },
    { key: "referenceNumber", header: "Référence" },
    { key: "dueDate", header: "Échéance" },
    { key: "status", header: "Statut" },
    { key: "totalAmount", header: "Total", fmt: (v) => String(v) },
    { key: "balance", header: "Solde", fmt: (v) => String(v) },
    { key: "bucket", header: "Tranche" },
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{items.length} facture{items.length !== 1 ? "s" : ""} impayées · Total : <strong>{formatFCFA(total)}</strong></p>
        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Répartition par ancienneté</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-48 w-full" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ left: 8, right: 8 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatFCFA(v).replace(" FCFA", "")} tick={{ fontSize: 10 }} width={75} />
                <Tooltip content={<FcfaTooltip />} />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {chartData.map(d => <Cell key={d.key} fill={BUCKET_COLORS[d.key] ?? "#94a3b8"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-3">
        {chartData.map(d => (
          <Card key={d.key} className="border" style={{ borderColor: d.amount > 0 ? BUCKET_COLORS[d.key] + "44" : undefined }}>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">{d.name}</p>
              <p className="font-bold text-sm" style={{ color: d.amount > 0 ? BUCKET_COLORS[d.key] : undefined }}>
                {formatFCFA(d.amount)}
              </p>
              <p className="text-xs text-muted-foreground">{d.count} fact.</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detail table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Référence</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead>Tranche</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Solde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && [1,2,3].map(i => (
                <TableRow key={i}>{[1,2,3,4,5,6].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))}
              {!isLoading && items.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Aucune facture impayée.</TableCell></TableRow>
              )}
              {items.map(it => (
                <TableRow key={it.id}>
                  <TableCell className="font-medium text-sm">{it.supplierName ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{it.referenceNumber}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {it.dueDate ? formatDate(it.dueDate) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" style={{ borderColor: BUCKET_COLORS[it.bucket] + "88", color: BUCKET_COLORS[it.bucket] }}>
                      {BUCKET_LABELS[it.bucket] ?? it.bucket}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatFCFA(it.totalAmount)}</TableCell>
                  <TableCell className="text-right font-semibold text-amber-700">{formatFCFA(it.balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: Period ──────────────────────────────────────────────────────────────

function TabPeriod() {
  const { data, isLoading } = useQuery<{ data: PeriodRow[] }>({
    queryKey: ["purchases-report-period"],
    queryFn: () => apiFetch("/api/purchases/reports/by-period"),
  });
  const rows = data?.data ?? [];
  const total = rows.reduce((s, r) => s + r.total, 0);

  const exportCsv = () => downloadCsv(rows, "achats-par-periode.csv", [
    { key: "period", header: "Période" },
    { key: "count", header: "Nb paiements", fmt: String },
    { key: "total", header: "Montant payé (FCFA)", fmt: String },
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">12 derniers mois · Total décaissé : <strong>{formatFCFA(total)}</strong></p>
        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Button>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Décaissements mensuels</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-52 w-full" /> : rows.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">Aucun paiement enregistré sur la période</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={rows} margin={{ left: 8, right: 8 }}>
                <XAxis dataKey="period" tickFormatter={periodLabel} tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => formatFCFA(v).replace(" FCFA", "")} tick={{ fontSize: 10 }} width={80} />
                <Tooltip content={<FcfaTooltip />} formatter={(v, name) => [formatFCFA(Number(v)), "Décaissé"]} />
                <Bar dataKey="total" fill="#F37021" radius={[4, 4, 0, 0]} name="Décaissé" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      {rows.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Période</TableHead>
                  <TableHead className="text-right">Nb paiements</TableHead>
                  <TableHead className="text-right">Montant décaissé</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...rows].reverse().map(r => (
                  <TableRow key={r.period}>
                    <TableCell className="font-medium">{periodLabel(r.period)} ({r.period})</TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.count}</TableCell>
                    <TableCell className="text-right font-semibold">{formatFCFA(r.total)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-slate-50 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{rows.reduce((s, r) => s + r.count, 0)}</TableCell>
                  <TableCell className="text-right">{formatFCFA(total)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Supplier ────────────────────────────────────────────────────────────

function TabSupplier() {
  const { data, isLoading } = useQuery<{ data: SupplierRow[] }>({
    queryKey: ["purchases-report-supplier"],
    queryFn: () => apiFetch("/api/purchases/reports/by-supplier?limit=20"),
  });
  const rows = data?.data ?? [];
  const totalInvoiced = rows.reduce((s, r) => s + r.totalInvoiced, 0);

  const chartData = rows.slice(0, 8);

  const exportCsv = () => downloadCsv(rows, "achats-par-fournisseur.csv", [
    { key: "supplierName", header: "Fournisseur" },
    { key: "invoiceCount", header: "Factures", fmt: String },
    { key: "totalInvoiced", header: "Total facturé (FCFA)", fmt: String },
    { key: "totalPaid", header: "Total payé (FCFA)", fmt: String },
    { key: "balance", header: "Solde (FCFA)", fmt: String },
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{rows.length} fournisseur{rows.length !== 1 ? "s" : ""} · Volume total : <strong>{formatFCFA(totalInvoiced)}</strong></p>
        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Button>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Top fournisseurs — Volume facturé</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-52 w-full" /> : chartData.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">Aucune donnée</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16 }}>
                <XAxis type="number" tickFormatter={(v) => formatFCFA(v).replace(" FCFA", "")} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="supplierName" tick={{ fontSize: 10 }} width={120} />
                <Tooltip content={<FcfaTooltip />} />
                <Bar dataKey="totalInvoiced" fill="#F37021" radius={[0, 4, 4, 0]} name="Facturé" />
                <Bar dataKey="totalPaid" fill="#22c55e" radius={[0, 4, 4, 0]} name="Payé" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      {rows.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead className="text-right">Factures</TableHead>
                  <TableHead className="text-right">Total facturé</TableHead>
                  <TableHead className="text-right">Total payé</TableHead>
                  <TableHead className="text-right">Solde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && [1,2,3].map(i => (
                  <TableRow key={i}>{[1,2,3,4,5,6].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))}
                {rows.map((r, i) => (
                  <TableRow key={r.supplierId}>
                    <TableCell className="text-xs text-muted-foreground font-mono">{i + 1}</TableCell>
                    <TableCell className="font-medium text-sm">{r.supplierName}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.invoiceCount}</TableCell>
                    <TableCell className="text-right">{formatFCFA(r.totalInvoiced)}</TableCell>
                    <TableCell className="text-right text-emerald-700">{formatFCFA(r.totalPaid)}</TableCell>
                    <TableCell className="text-right font-semibold text-amber-700">{r.balance > 0 ? formatFCFA(r.balance) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Unpaid ──────────────────────────────────────────────────────────────

function TabUnpaid() {
  const { data, isLoading } = useQuery<AgingData>({
    queryKey: ["purchases-report-aging"],
    queryFn: () => apiFetch("/api/purchases/reports/aging"),
  });
  const items = (data?.items ?? []).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  const total = data?.total ?? 0;

  const exportCsv = () => downloadCsv(items, "factures-impayees.csv", [
    { key: "supplierName", header: "Fournisseur" },
    { key: "referenceNumber", header: "Référence" },
    { key: "invoiceDate", header: "Date facture" },
    { key: "dueDate", header: "Échéance" },
    { key: "status", header: "Statut" },
    { key: "totalAmount", header: "Total (FCFA)", fmt: String },
    { key: "paidAmount", header: "Payé (FCFA)", fmt: String },
    { key: "balance", header: "Solde (FCFA)", fmt: String },
  ]);

  const STATUS_LABELS: Record<string, string> = {
    review: "À revoir", awaiting_approval: "En att. approbation",
    approved: "Approuvée", pending: "À payer",
    partially_paid: "Part. payée", overdue: "En retard", draft: "Brouillon",
    rejected: "Refusée",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{items.length} facture{items.length !== 1 ? "s" : ""} impayées · Solde total : <strong>{formatFCFA(total)}</strong></p>
        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Référence</TableHead>
                <TableHead>Date facture</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Payé</TableHead>
                <TableHead className="text-right">Solde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && [1,2,3].map(i => (
                <TableRow key={i}>{[1,2,3,4,5,6,7,8].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))}
              {!isLoading && items.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Toutes les factures sont réglées.</TableCell></TableRow>
              )}
              {items.map(it => (
                <TableRow key={it.id}>
                  <TableCell className="font-medium text-sm">{it.supplierName ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{it.referenceNumber}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(it.invoiceDate)}</TableCell>
                  <TableCell className="text-sm">
                    {it.dueDate ? (
                      <span className={it.bucket !== "current" ? "text-red-600 font-medium" : "text-muted-foreground"}>
                        {it.bucket !== "current" && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                        {formatDate(it.dueDate)}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {STATUS_LABELS[it.status] ?? it.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatFCFA(it.totalAmount)}</TableCell>
                  <TableCell className="text-right text-emerald-700">{formatFCFA(it.paidAmount)}</TableCell>
                  <TableCell className="text-right font-semibold text-amber-700">{formatFCFA(it.balance)}</TableCell>
                </TableRow>
              ))}
              {items.length > 0 && (
                <TableRow className="bg-slate-50 font-semibold">
                  <TableCell colSpan={5}>Total</TableCell>
                  <TableCell className="text-right">{formatFCFA(items.reduce((s, i) => s + i.totalAmount, 0))}</TableCell>
                  <TableCell className="text-right text-emerald-700">{formatFCFA(items.reduce((s, i) => s + i.paidAmount, 0))}</TableCell>
                  <TableCell className="text-right text-amber-700">{formatFCFA(total)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AchatsRapports() {
  const [tab, setTab] = useState<TabId>("aging");
  const ActiveTab = tab === "aging" ? TabAging : tab === "period" ? TabPeriod : tab === "supplier" ? TabSupplier : TabUnpaid;

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Rapports Achats" subtitle="Analyse et exports des données fournisseurs" />

      {/* Tab nav */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                active ? "bg-white text-[#F37021] shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <ActiveTab />
    </div>
  );
}
