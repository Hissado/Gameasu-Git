import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { formatFCFA, formatFCFACompact } from "@/lib/format";
import { AccountingShell } from "./_layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calculator, ChevronRight, CheckCircle2, Clock, XCircle, TrendingDown, CalendarDays } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, Legend, ReferenceLine,
} from "recharts";

type Asset = {
  id: string;
  code: string;
  label: string;
  category?: string | null;
  acquisitionDate: string;
  acquisitionCost: number;
  residualValue: number;
  depreciationMethod: string;
  usefulLifeYears: number;
  status: string;
  notes?: string | null;
  accumulatedDepreciation: number;
  netBookValue: number;
};

type AssetDetail = Asset & {
  annualAmount: number;
  schedule: Array<{ year: number; annualAmount: number; accumulated: number; netBookValue: number; posted: boolean }>;
  history: Array<{ id: string; fiscalPeriodId: string; periodAmount: number; accumulatedAmount: number; postedAt: string }>;
};

type Account = { id: string; code: string; label: string; classNum: number };

const STATUS_LABELS: Record<string, string> = { active: "Actif", disposed: "Cédé/Sorti", fully_depreciated: "Totalement amorti" };
const STATUS_COLORS: Record<string, string> = { active: "bg-emerald-100 text-emerald-800 border-emerald-200", disposed: "bg-slate-100 text-slate-600 border-slate-200", fully_depreciated: "bg-amber-100 text-amber-700 border-amber-200" };

export default function FixedAssetsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [openCreate, setOpenCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: assets } = useQuery<{ data: Asset[] }>({
    queryKey: ["fixed-assets"],
    queryFn: () => apiFetch("/api/accounting/fixed-assets"),
  });
  const { data: accounts } = useQuery<{ data: Account[] }>({
    queryKey: ["chart-of-accounts-list"],
    queryFn: () => apiFetch("/api/accounting/chart-of-accounts"),
  });
  const { data: detail, isLoading: detailLoading } = useQuery<AssetDetail>({
    queryKey: ["fixed-asset-detail", selectedId],
    queryFn: () => apiFetch(`/api/accounting/fixed-assets/${selectedId}`),
    enabled: !!selectedId,
  });

  const immoAccounts = accounts?.data.filter((a) => a.classNum === 2 && !a.code.startsWith("28")) ?? [];
  const amortAccounts = accounts?.data.filter((a) => a.code.startsWith("28")) ?? [];
  const expenseAccounts = accounts?.data.filter((a) => a.code === "681") ?? [];

  const [form, setForm] = useState({
    code: "", label: "", category: "",
    acquisitionDate: new Date().toISOString().slice(0, 10),
    acquisitionCost: "", residualValue: "0",
    usefulLifeYears: "5",
    depreciationMethod: "linear",
    accountId: "", depreciationAccountId: "", expenseAccountId: "",
  });

  const create = useMutation({
    mutationFn: () => apiFetch("/api/accounting/fixed-assets", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        acquisitionCost: Number(form.acquisitionCost),
        residualValue: Number(form.residualValue),
        usefulLifeYears: Number(form.usefulLifeYears),
      }),
    }),
    onSuccess: () => {
      toast({ title: "Immobilisation enregistrée" });
      setOpenCreate(false);
      setForm({ code: "", label: "", category: "", acquisitionDate: new Date().toISOString().slice(0, 10), acquisitionCost: "", residualValue: "0", usefulLifeYears: "5", depreciationMethod: "linear", accountId: "", depreciationAccountId: "", expenseAccountId: "" });
      qc.invalidateQueries({ queryKey: ["fixed-assets"] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const depreciate = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/accounting/fixed-assets/${id}/depreciate`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Dotation amortissement comptabilisée" });
      qc.invalidateQueries({ queryKey: ["fixed-assets"] });
      qc.invalidateQueries({ queryKey: ["fixed-asset-detail", selectedId] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const totalCost = assets?.data.reduce((s, a) => s + a.acquisitionCost, 0) ?? 0;
  const totalAmort = assets?.data.reduce((s, a) => s + a.accumulatedDepreciation, 0) ?? 0;
  const totalNet = assets?.data.reduce((s, a) => s + a.netBookValue, 0) ?? 0;

  const depreciationRate = totalCost > 0 ? (totalAmort / totalCost) * 100 : 0;

  return (
    <AccountingShell
      title="Immobilisations"
      subtitle="Suivi du parc d'actifs immobilisés et plan d'amortissement"
      actions={
        <Button onClick={() => setOpenCreate(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />Nouvelle immobilisation
        </Button>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground truncate">Valeur brute</div>
          <div className="text-lg font-bold mt-1 truncate" title={formatFCFA(totalCost)}>{formatFCFACompact(totalCost)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground truncate">Cumul amort.</div>
          <div className="text-lg font-bold mt-1 text-red-600 truncate" title={formatFCFA(totalAmort)}>{formatFCFACompact(totalAmort)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground truncate">Valeur nette (VNC)</div>
          <div className="text-lg font-bold mt-1 text-emerald-600 truncate" title={formatFCFA(totalNet)}>{formatFCFACompact(totalNet)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Taux amortissement</div>
          <div className="text-xl font-bold mt-1">{depreciationRate.toFixed(1)}%</div>
          <Progress value={depreciationRate} className="mt-2 h-1.5" />
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-muted-foreground border-b">
              <tr>
                <th className="text-left px-4 py-3">Code / Désignation</th>
                <th className="text-left px-4 py-3">Acquisition</th>
                <th className="text-right px-4 py-3">Valeur brute</th>
                <th className="text-right px-4 py-3">Cumul amort.</th>
                <th className="text-right px-4 py-3">VNC</th>
                <th className="text-center px-4 py-3">Avancement</th>
                <th className="text-left px-4 py-3">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(assets?.data.length ?? 0) === 0 && (
                <tr><td colSpan={8} className="p-10 text-center text-muted-foreground italic">
                  <TrendingDown className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  Aucune immobilisation enregistrée
                </td></tr>
              )}
              {assets?.data.map((a) => {
                const pct = a.acquisitionCost > 0
                  ? Math.min((a.accumulatedDepreciation / (a.acquisitionCost - a.residualValue)) * 100, 100)
                  : 0;
                return (
                  <tr key={a.id} className="border-t hover:bg-slate-50/60 transition-colors cursor-pointer"
                    onClick={() => setSelectedId(a.id)}>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-muted-foreground">{a.code}</div>
                      <div className="font-semibold text-foreground">{a.label}</div>
                      {a.category && <div className="text-xs text-muted-foreground">{a.category}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <div>{new Date(a.acquisitionDate).toLocaleDateString("fr-FR")}</div>
                      <div className="text-muted-foreground/70">
                        {a.depreciationMethod === "linear" ? "Linéaire" : "Dégressif"} · {a.usefulLifeYears} ans
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">{formatFCFA(a.acquisitionCost)}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-red-600">{formatFCFA(a.accumulatedDepreciation)}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-bold text-emerald-700">{formatFCFA(a.netBookValue)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <Progress value={pct} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground w-8 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[a.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {STATUS_LABELS[a.status] ?? a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1 items-center">
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => depreciate.mutate(a.id)} disabled={depreciate.isPending}>
                          <Calculator className="w-3 h-3 mr-1" />Doter
                        </Button>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" onClick={() => setSelectedId(a.id)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nouvelle immobilisation</DialogTitle>
            <DialogDescription>Saisir la fiche de l'actif immobilisé.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold mb-1 block">Code *</label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="IMM-2026-001" /></div>
            <div><label className="text-xs font-semibold mb-1 block">Catégorie</label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Matériel, mobilier…" /></div>
            <div className="col-span-2"><label className="text-xs font-semibold mb-1 block">Désignation *</label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>
            <div><label className="text-xs font-semibold mb-1 block">Date d'acquisition *</label><Input type="date" value={form.acquisitionDate} onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })} /></div>
            <div><label className="text-xs font-semibold mb-1 block">Durée utile (années) *</label><Input type="number" value={form.usefulLifeYears} onChange={(e) => setForm({ ...form, usefulLifeYears: e.target.value })} /></div>
            <div><label className="text-xs font-semibold mb-1 block">Coût d'acquisition (FCFA) *</label><Input type="number" value={form.acquisitionCost} onChange={(e) => setForm({ ...form, acquisitionCost: e.target.value })} /></div>
            <div><label className="text-xs font-semibold mb-1 block">Valeur résiduelle (FCFA)</label><Input type="number" value={form.residualValue} onChange={(e) => setForm({ ...form, residualValue: e.target.value })} /></div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Méthode d'amortissement</label>
              <select className="border rounded h-9 px-2 text-sm w-full" value={form.depreciationMethod} onChange={(e) => setForm({ ...form, depreciationMethod: e.target.value })}>
                <option value="linear">Linéaire</option>
                <option value="declining">Dégressif</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Compte d'immo. * (classe 2x)</label>
              <select className="border rounded h-9 px-2 text-sm w-full" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
                <option value="">—</option>
                {immoAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Compte amortissement (28x)</label>
              <select className="border rounded h-9 px-2 text-sm w-full" value={form.depreciationAccountId} onChange={(e) => setForm({ ...form, depreciationAccountId: e.target.value })}>
                <option value="">—</option>
                {amortAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold mb-1 block">Compte de dotation (681)</label>
              <select className="border rounded h-9 px-2 text-sm w-full" value={form.expenseAccountId} onChange={(e) => setForm({ ...form, expenseAccountId: e.target.value })}>
                <option value="">—</option>
                {expenseAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.label}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>Annuler</Button>
            <Button onClick={() => create.mutate()} disabled={!form.code || !form.label || !form.acquisitionCost || !form.accountId || create.isPending} className="bg-primary hover:bg-primary/90">Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-amber-600" />
              Fiche immobilisation
            </SheetTitle>
          </SheetHeader>

          {detailLoading && (
            <div className="flex items-center justify-center py-20 text-muted-foreground">Chargement…</div>
          )}

          {detail && !detailLoading && (
            <div className="space-y-6 mt-6">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground uppercase">Code</div>
                  <div className="font-mono font-semibold">{detail.code}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase">Statut</div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[detail.status] ?? ""}`}>
                    {STATUS_LABELS[detail.status] ?? detail.status}
                  </span>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground uppercase">Désignation</div>
                  <div className="font-semibold text-base">{detail.label}</div>
                  {detail.category && <div className="text-xs text-muted-foreground">{detail.category}</div>}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase">Acquisition</div>
                  <div>{new Date(detail.acquisitionDate).toLocaleDateString("fr-FR")}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase">Méthode</div>
                  <div>{detail.depreciationMethod === "linear" ? "Linéaire" : "Dégressif"} · {detail.usefulLifeYears} ans</div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card><CardContent className="p-3">
                  <div className="text-xs text-muted-foreground uppercase">Valeur brute</div>
                  <div className="font-bold mt-0.5">{formatFCFA(detail.acquisitionCost)}</div>
                </CardContent></Card>
                <Card><CardContent className="p-3">
                  <div className="text-xs text-muted-foreground uppercase">Cumul amort.</div>
                  <div className="font-bold mt-0.5 text-red-600">{formatFCFA(detail.accumulatedDepreciation)}</div>
                </CardContent></Card>
                <Card><CardContent className="p-3">
                  <div className="text-xs text-muted-foreground uppercase">VNC</div>
                  <div className="font-bold mt-0.5 text-emerald-700">{formatFCFA(detail.netBookValue)}</div>
                </CardContent></Card>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Avancement</div>
                <div className="text-xs text-muted-foreground">
                  {detail.history.length}/{detail.usefulLifeYears} dotations effectuées
                </div>
              </div>
              <Progress
                value={detail.usefulLifeYears > 0 ? (detail.history.length / detail.usefulLifeYears) * 100 : 0}
                className="h-2"
              />

              <div className="flex justify-end">
                <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => depreciate.mutate(detail.id)} disabled={depreciate.isPending}>
                  <Calculator className="w-3 h-3 mr-2" />Comptabiliser dotation annuelle
                </Button>
              </div>

              <Separator />

              <div>
                <CardTitle className="text-sm mb-3 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-amber-600" />Plan d'amortissement prévisionnel
                </CardTitle>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                    <LineChart data={detail.schedule} margin={{ left: 10, right: 10, top: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="year" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false}
                        tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} />
                      <RTooltip formatter={(v: number) => formatFCFA(v)} />
                      <Legend iconType="circle" formatter={(v) => <span className="text-xs text-slate-600">{v}</span>} />
                      <Line type="monotone" dataKey="netBookValue" name="VNC" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="accumulated" name="Cumul amorti" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
                      {detail.history.length > 0 && (
                        <ReferenceLine x={detail.schedule[detail.history.length - 1]?.year} stroke="#2563EB" strokeDasharray="4 2" label={{ value: "Aujourd'hui", fontSize: 10, fill: "#2563EB" }} />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <table className="w-full text-xs mt-3 border rounded overflow-hidden">
                  <thead className="bg-slate-50 text-muted-foreground uppercase">
                    <tr>
                      <th className="text-left px-3 py-2">Année</th>
                      <th className="text-right px-3 py-2">Dotation annuelle</th>
                      <th className="text-right px-3 py-2">Cumul</th>
                      <th className="text-right px-3 py-2">VNC</th>
                      <th className="text-center px-3 py-2">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.schedule.map((row) => (
                      <tr key={row.year} className={`border-t ${row.posted ? "bg-emerald-50/40" : ""}`}>
                        <td className="px-3 py-2 font-medium">{row.year}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatFCFA(row.annualAmount)}</td>
                        <td className="px-3 py-2 text-right font-mono text-red-600">{formatFCFA(row.accumulated)}</td>
                        <td className="px-3 py-2 text-right font-mono text-emerald-700 font-semibold">{formatFCFA(row.netBookValue)}</td>
                        <td className="px-3 py-2 text-center">
                          {row.posted
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mx-auto" />
                            : <Clock className="w-3.5 h-3.5 text-muted-foreground mx-auto" />
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {detail.history.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <CardTitle className="text-sm mb-3">Historique des dotations comptabilisées</CardTitle>
                    <div className="space-y-2">
                      {detail.history.map((h, i) => (
                        <div key={h.id} className="flex items-center justify-between text-sm bg-muted/30 rounded px-3 py-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="text-muted-foreground text-xs">
                              Dotation #{i + 1} — {h.postedAt ? new Date(h.postedAt).toLocaleDateString("fr-FR") : "—"}
                            </span>
                          </div>
                          <span className="font-mono font-medium text-red-600">{formatFCFA(h.periodAmount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AccountingShell>
  );
}
