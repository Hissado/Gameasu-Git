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
type UnpaidItem = {
  id: string; referenceNumber: string; supplierName: string | null;
  invoiceDate: string; dueDate: string | null;
  totalAmount: number; paidAmount: number; balance: number;
  status: string; isOverdue: boolean; daysOverdue: number;
};
type UnpaidData = { data: UnpaidItem[]; total: number; totalBalance: number };

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
  d1_30:   "#eab308",
  d31_60:  "#f97316",
  d61_90:  "#ef4444",
  over90:  "#991b1b",
};

const MONTH_SHORT: Record<string, string> = {
  "01":"Jan","02":"Fév","03":"Mar","04":"Avr","05":"Mai","06":"Jun",
  "07":"Jul","08":"Aoû","09":"Sep","10":"Oct","11":"Nov","12":"Déc",
};
function periodLabel(p: string) { const [y, m] = p.split("-"); return `${MONTH_SHORT[m] ?? m} ${y.slice(2)}`; }

function FcfaTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-xs">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p: any) => <p key={p.dataKey} style={{ color: p.fill ?? p.color }}>{formatFCFA(p.value)}</p>)}
    </div>
  );
}

// ─── Excel download helper ────────────────────────────────────────────────────

function downloadExcel(type: string) {
  const token = encodeURIComponent(localStorage.getItem("auth_token") ?? "");
  const url = `/api/purchases/reports/${type}/export.xlsx?token=${token}`;
  const a = document.createElement("a");
  a.href = url;
  a.download = `purchases-${type}.xlsx`;
  a.click();
}

// ─── CSV export helper ────────────────────────────────────────────────────────

function exportCsv(headers: string[], rows: string[][], filename: string) {
  const bom = "\uFEFF";
  const content = bom + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const INV_STATUS: Record<string, { label: string; cls: string }> = {
  review:            { label: "À revoir",       cls: "bg-blue-50 text-blue-700 border-blue-200" },
  awaiting_approval: { label: "En approbation", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  approved:          { label: "Approuvée",      cls: "bg-teal-50 text-teal-700 border-teal-200" },
  pending:           { label: "À payer",        cls: "bg-orange-50 text-orange-700 border-orange-200" },
  partially_paid:    { label: "Part. payée",    cls: "bg-amber-50 text-amber-700 border-amber-200" },
  paid:              { label: "Payée",          cls: "bg-green-50 text-green-700 border-green-200" },
  overdue:           { label: "En retard",      cls: "bg-red-50 text-red-700 border-red-200" },
};

function InvBadge({ status }: { status: string }) {
  const s = INV_STATUS[status] ?? { label: status, cls: "bg-slate-100 text-slate-600 border-slate-200" };
  return <Badge variant="outline" className={`text-xs ${s.cls}`}>{s.label}</Badge>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RapportsAchatsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("aging");

  const agingQ = useQuery<AgingData>({
    queryKey: ["purchases-aging"],
    queryFn: () => apiFetch("/api/purchases/reports/aging"),
    enabled: activeTab === "aging",
  });

  const periodQ = useQuery<{ data: PeriodRow[] }>({
    queryKey: ["purchases-by-period"],
    queryFn: () => apiFetch("/api/purchases/reports/by-period"),
    enabled: activeTab === "period",
  });

  const supplierQ = useQuery<{ data: SupplierRow[] }>({
    queryKey: ["purchases-by-supplier"],
    queryFn: () => apiFetch("/api/purchases/reports/by-supplier?limit=20"),
    enabled: activeTab === "supplier",
  });

  const unpaidQ = useQuery<UnpaidData>({
    queryKey: ["purchases-unpaid"],
    queryFn: () => apiFetch("/api/purchases/reports/unpaid"),
    enabled: activeTab === "unpaid",
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <PageHeader
        title="Rapports Achats"
        subtitle="Analyse des comptes fournisseurs et des décaissements"
      />

      {/* Tab nav */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === id
                ? "bg-white text-[#F37021] shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {/* ─ Vieillissement AP ─ */}
      {activeTab === "aging" && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadExcel("aging")}>
              <Download className="h-4 w-4 mr-1" />Export Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              if (!agingQ.data) return;
              exportCsv(
                ["Référence", "Fournisseur", "Date facture", "Échéance", "Solde", "Tranche", "Statut"],
                agingQ.data.items.map(r => [r.referenceNumber ?? "", r.supplierName ?? "", r.invoiceDate, r.dueDate ?? "", String(r.balance), BUCKET_LABELS[r.bucket] ?? r.bucket, r.status]),
                "vieillissement-ap.csv"
              );
            }}>
              <Download className="h-4 w-4 mr-1" />Export CSV
            </Button>
          </div>

          {agingQ.isLoading ? <Skeleton className="h-64 w-full" /> : agingQ.data && (
            <>
              {/* Bucket cards */}
              <div className="grid grid-cols-5 gap-3">
                {Object.entries(BUCKET_LABELS).map(([key, label]) => (
                  <Card key={key} className="border-l-4" style={{ borderLeftColor: BUCKET_COLORS[key] }}>
                    <CardContent className="p-3">
                      <p className="text-xs text-slate-500 mb-1">{label}</p>
                      <p className="font-bold text-sm">{formatFCFA(agingQ.data!.buckets[key] ?? 0)}</p>
                      <p className="text-xs text-slate-400">{agingQ.data!.bucketCounts[key] ?? 0} facture{(agingQ.data!.bucketCounts[key] ?? 0) > 1 ? "s" : ""}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Bar chart */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Solde par tranche d'échéance (FCFA)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={Object.entries(BUCKET_LABELS).map(([k, l]) => ({ name: l, amount: agingQ.data!.buckets[k] ?? 0, fill: BUCKET_COLORS[k] }))} margin={{ left: 8 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={v => formatFCFA(v).replace(" FCFA", "")} tick={{ fontSize: 9 }} width={72} />
                      <Tooltip content={<FcfaTooltip />} />
                      <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                        {Object.keys(BUCKET_LABELS).map(k => <Cell key={k} fill={BUCKET_COLORS[k]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Detail table */}
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow className="bg-slate-50">
                      <TableHead>Référence</TableHead><TableHead>Fournisseur</TableHead>
                      <TableHead>Échéance</TableHead><TableHead>Tranche</TableHead>
                      <TableHead className="text-right">Montant TTC</TableHead>
                      <TableHead className="text-right">Solde dû</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {agingQ.data.items.map(item => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs">{item.referenceNumber}</TableCell>
                          <TableCell className="text-sm">{item.supplierName ?? "—"}</TableCell>
                          <TableCell className="text-xs">{item.dueDate ? formatDate(item.dueDate) : "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs" style={{ borderColor: BUCKET_COLORS[item.bucket], color: BUCKET_COLORS[item.bucket] }}>
                              {BUCKET_LABELS[item.bucket] ?? item.bucket}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-sm">{formatFCFA(item.totalAmount)}</TableCell>
                          <TableCell className="text-right font-bold text-sm">{formatFCFA(item.balance)}</TableCell>
                          <TableCell><InvBadge status={item.status} /></TableCell>
                        </TableRow>
                      ))}
                      {agingQ.data.items.length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-400">Aucune facture impayée</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ─ Dépenses par période ─ */}
      {activeTab === "period" && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadExcel("by-period")}>
              <Download className="h-4 w-4 mr-1" />Export Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              if (!periodQ.data) return;
              exportCsv(
                ["Période", "Nb paiements", "Total décaissé"],
                periodQ.data.data.map(r => [periodLabel(r.period), String(r.count), String(r.total)]),
                "depenses-par-periode.csv"
              );
            }}>
              <Download className="h-4 w-4 mr-1" />Export CSV
            </Button>
          </div>

          {periodQ.isLoading ? <Skeleton className="h-64 w-full" /> : periodQ.data && (
            <>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Décaissements mensuels — 12 derniers mois</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={periodQ.data.data.map(r => ({ name: periodLabel(r.period), total: r.total }))} margin={{ left: 8 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={v => formatFCFA(v).replace(" FCFA", "")} tick={{ fontSize: 9 }} width={72} />
                      <Tooltip content={<FcfaTooltip />} />
                      <Bar dataKey="total" fill="#F37021" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow className="bg-slate-50">
                      <TableHead>Période</TableHead>
                      <TableHead className="text-right">Nb paiements</TableHead>
                      <TableHead className="text-right">Total décaissé</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {periodQ.data.data.map(r => (
                        <TableRow key={r.period}>
                          <TableCell className="font-medium text-sm">{periodLabel(r.period)}</TableCell>
                          <TableCell className="text-right text-sm">{r.count}</TableCell>
                          <TableCell className="text-right font-semibold text-sm">{formatFCFA(r.total)}</TableCell>
                        </TableRow>
                      ))}
                      {periodQ.data.data.length === 0 && (
                        <TableRow><TableCell colSpan={3} className="text-center py-8 text-slate-400">Aucun décaissement enregistré</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ─ Par fournisseur ─ */}
      {activeTab === "supplier" && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadExcel("by-supplier")}>
              <Download className="h-4 w-4 mr-1" />Export Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              if (!supplierQ.data) return;
              exportCsv(
                ["Fournisseur", "Nb factures", "Total facturé", "Total payé", "Solde"],
                supplierQ.data.data.map(r => [r.supplierName, String(r.invoiceCount), String(r.totalInvoiced), String(r.totalPaid), String(r.balance)]),
                "top-fournisseurs.csv"
              );
            }}>
              <Download className="h-4 w-4 mr-1" />Export CSV
            </Button>
          </div>

          {supplierQ.isLoading ? <Skeleton className="h-64 w-full" /> : supplierQ.data && (
            <>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Top fournisseurs par volume facturé</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={supplierQ.data.data.slice(0, 8).map(r => ({ name: r.supplierName.slice(0, 16), facturé: r.totalInvoiced, payé: r.totalPaid }))}
                      layout="vertical" margin={{ left: 8 }}>
                      <XAxis type="number" tickFormatter={v => formatFCFA(v).replace(" FCFA", "")} tick={{ fontSize: 9 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                      <Tooltip content={<FcfaTooltip />} />
                      <Bar dataKey="facturé" fill="#F37021" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="payé" fill="#22c55e" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow className="bg-slate-50">
                      <TableHead>Rang</TableHead><TableHead>Fournisseur</TableHead>
                      <TableHead className="text-right">Nb factures</TableHead>
                      <TableHead className="text-right">Total facturé</TableHead>
                      <TableHead className="text-right">Total payé</TableHead>
                      <TableHead className="text-right">Solde dû</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {supplierQ.data.data.map((r, i) => (
                        <TableRow key={r.supplierId}>
                          <TableCell className="text-xs text-slate-400 font-mono">#{i + 1}</TableCell>
                          <TableCell className="font-medium text-sm">{r.supplierName}</TableCell>
                          <TableCell className="text-right text-sm">{r.invoiceCount}</TableCell>
                          <TableCell className="text-right font-semibold text-sm">{formatFCFA(r.totalInvoiced)}</TableCell>
                          <TableCell className="text-right text-sm text-emerald-700">{formatFCFA(r.totalPaid)}</TableCell>
                          <TableCell className="text-right font-bold text-sm text-[#F37021]">{formatFCFA(r.balance)}</TableCell>
                        </TableRow>
                      ))}
                      {supplierQ.data.data.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">Aucun fournisseur</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ─ Factures impayées ─ */}
      {activeTab === "unpaid" && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadExcel("unpaid")}>
              <Download className="h-4 w-4 mr-1" />Export Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              if (!unpaidQ.data) return;
              exportCsv(
                ["Référence", "Fournisseur", "Date facture", "Échéance", "Montant TTC", "Solde dû", "Jours échus", "Statut"],
                unpaidQ.data.data.map(r => [r.referenceNumber ?? "", r.supplierName ?? "", r.invoiceDate, r.dueDate ?? "", String(r.totalAmount), String(r.balance), String(r.daysOverdue), r.status]),
                "factures-impayees.csv"
              );
            }}>
              <Download className="h-4 w-4 mr-1" />Export CSV
            </Button>
          </div>

          {unpaidQ.isLoading ? <Skeleton className="h-64 w-full" /> : unpaidQ.data && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500 mb-1">Factures impayées</p>
                    <p className="text-2xl font-bold">{unpaidQ.data.total}</p>
                  </CardContent>
                </Card>
                <Card className="col-span-2">
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500 mb-1">Total à décaisser</p>
                    <p className="text-2xl font-bold text-[#F37021]">{formatFCFA(unpaidQ.data.totalBalance)}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow className="bg-slate-50">
                      <TableHead>Référence</TableHead><TableHead>Fournisseur</TableHead>
                      <TableHead>Date facture</TableHead><TableHead>Échéance</TableHead>
                      <TableHead className="text-right">Montant TTC</TableHead>
                      <TableHead className="text-right">Solde dû</TableHead>
                      <TableHead className="text-center">Jours échus</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {unpaidQ.data.data.map(r => (
                        <TableRow key={r.id} className={r.isOverdue ? "bg-red-50/40" : ""}>
                          <TableCell className="font-mono text-xs">{r.referenceNumber}</TableCell>
                          <TableCell className="text-sm font-medium">{r.supplierName ?? "—"}</TableCell>
                          <TableCell className="text-xs text-slate-500">{formatDate(r.invoiceDate)}</TableCell>
                          <TableCell className="text-xs">{r.dueDate ? formatDate(r.dueDate) : "—"}</TableCell>
                          <TableCell className="text-right font-semibold text-sm">{formatFCFA(r.totalAmount)}</TableCell>
                          <TableCell className="text-right font-bold text-sm text-[#F37021]">{formatFCFA(r.balance)}</TableCell>
                          <TableCell className="text-center">
                            {r.daysOverdue > 0 ? (
                              <Badge variant="outline" className={`text-xs ${r.daysOverdue > 60 ? "bg-red-50 text-red-700 border-red-200" : r.daysOverdue > 30 ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"}`}>
                                +{r.daysOverdue} j
                              </Badge>
                            ) : <span className="text-xs text-slate-400">—</span>}
                          </TableCell>
                          <TableCell><InvBadge status={r.status} /></TableCell>
                        </TableRow>
                      ))}
                      {unpaidQ.data.data.length === 0 && (
                        <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-400">Aucune facture impayée</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
