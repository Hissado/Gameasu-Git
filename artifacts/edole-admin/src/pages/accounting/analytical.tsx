import React, { useState } from "react";
import { AccountingShell } from "./_layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { formatFCFA } from "@/lib/format";
import { Plus, BarChart3, Target, TrendingDown } from "lucide-react";

const API = "/api";
async function fetchJSON(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("auth_token");
  const r = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? r.statusText); }
  return r.json();
}

const TYPE_LABELS: Record<string, string> = {
  department: "Département",
  project: "Projet",
  activity: "Activité",
  service: "Service",
  geographic: "Zone géo.",
  product_line: "Ligne produit",
};

const COLORS = [
  "bg-blue-500", "bg-orange-500", "bg-green-500", "bg-purple-500",
  "bg-red-500", "bg-cyan-500", "bg-amber-500", "bg-rose-500",
];

export default function AnalyticalPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [form, setForm] = useState({ code: "", name: "", description: "", type: "department", budgetAmount: "", color: "" });

  const { data: summary = [], isLoading } = useQuery<any[]>({
    queryKey: ["analytical-summary", fromDate, toDate],
    queryFn: () => fetchJSON(`${API}/accounting/analytical/summary${fromDate || toDate ? `?from=${fromDate}&to=${toDate}` : ""}`),
  });

  const { data: detail } = useQuery<any>({
    queryKey: ["cost-center-detail", detailId, fromDate, toDate],
    queryFn: () => fetchJSON(`${API}/accounting/cost-centers/${detailId}?from=${fromDate}&to=${toDate}`),
    enabled: !!detailId,
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => fetchJSON(`${API}/accounting/cost-centers`, {
      method: "POST",
      body: JSON.stringify({ ...d, budgetAmount: d.budgetAmount ? Number(d.budgetAmount) : undefined }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["analytical-summary"] }); setOpen(false); toast({ title: "Centre de coût créé" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const totalBudget = summary.reduce((s: number, c: any) => s + (c.budgetAmount ?? 0), 0);
  const totalConsumption = summary.reduce((s: number, c: any) => s + c.netConsumption, 0);
  const centersOverBudget = summary.filter((c: any) => c.budgetAmount && c.netConsumption > c.budgetAmount).length;

  return (
    <AccountingShell title="Comptabilité analytique" subtitle="Centres de coût et états analytiques">
      <div className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center"><BarChart3 className="w-5 h-5 text-blue-600" /></div>
                <div><p className="text-xs text-muted-foreground">Centres actifs</p><p className="text-2xl font-bold">{summary.length}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center"><Target className="w-5 h-5 text-green-600" /></div>
                <div><p className="text-xs text-muted-foreground">Budget total</p><p className="text-lg font-bold">{formatFCFA(totalBudget)}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center"><TrendingDown className="w-5 h-5 text-orange-600" /></div>
                <div><p className="text-xs text-muted-foreground">Consommé</p><p className="text-lg font-bold">{formatFCFA(totalConsumption)}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center"><TrendingDown className="w-5 h-5 text-red-600" /></div>
                <div><p className="text-xs text-muted-foreground">Dépassements</p><p className="text-2xl font-bold text-red-600">{centersOverBudget}</p></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtres date + actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm">Du</Label>
            <Input type="date" className="w-38" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <Label className="text-sm">Au</Label>
            <Input type="date" className="w-38" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="ml-auto">
            <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" />Nouveau centre</Button>
          </div>
        </div>

        {/* Tableau des centres */}
        {isLoading ? (
          <div className="py-10 text-center text-muted-foreground">Chargement…</div>
        ) : summary.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">Aucun centre de coût créé. Créez votre premier centre ci-dessus.</div>
        ) : (
          <div className="space-y-2">
            {summary.map((c: any, i: number) => {
              const pct = c.usagePct ?? 0;
              const over = c.budgetAmount && c.netConsumption > c.budgetAmount;
              return (
                <Card key={c.id} className={`cursor-pointer hover:shadow-md transition-shadow ${detailId === c.id ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setDetailId(detailId === c.id ? null : c.id)}>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-3 h-3 mt-1.5 rounded-full ${c.color ? "" : COLORS[i % COLORS.length]}`}
                        style={c.color ? { backgroundColor: c.color } : {}} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
                          <span className="font-semibold">{c.name}</span>
                          <Badge variant="outline" className="text-xs">{TYPE_LABELS[c.type] ?? c.type}</Badge>
                          {over && <Badge variant="destructive" className="text-xs">Dépassement</Badge>}
                        </div>
                        {c.budgetAmount != null && (
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <Progress value={Math.min(pct, 100)} className={`h-1.5 ${over ? "[&>div]:bg-red-500" : ""}`} />
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="text-muted-foreground">Budget : {formatFCFA(c.budgetAmount)}</span>
                              <span className={`font-medium ${over ? "text-red-600" : "text-primary"}`}>
                                {formatFCFA(c.netConsumption)} ({pct}%)
                              </span>
                            </div>
                          </div>
                        )}
                        {c.budgetAmount == null && (
                          <p className="text-sm text-muted-foreground">Consommé : {formatFCFA(c.netConsumption)}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Détail centre */}
        {detail && detailId && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="text-base">{detail.code} — {detail.name} : ventilation par compte</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.charges.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune imputation sur cette période</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Compte</TableHead>
                      <TableHead className="text-right">Débit</TableHead>
                      <TableHead className="text-right">Crédit</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.charges.map((c: any) => (
                      <TableRow key={c.accountCode}>
                        <TableCell>
                          <span className="font-mono text-xs text-muted-foreground mr-2">{c.accountCode}</span>
                          {c.accountLabel}
                        </TableCell>
                        <TableCell className="text-right">{formatFCFA(c.totalDebit)}</TableCell>
                        <TableCell className="text-right">{formatFCFA(c.totalCredit)}</TableCell>
                        <TableCell className={`text-right font-medium ${c.net >= 0 ? "" : "text-red-600"}`}>{formatFCFA(c.net)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold border-t-2">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{formatFCFA(detail.totalDebit)}</TableCell>
                      <TableCell className="text-right">{formatFCFA(detail.totalCredit)}</TableCell>
                      <TableCell className="text-right">{formatFCFA(detail.netConsumption)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog créer */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau centre de coût</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Code *</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="ex: CC001" /></div>
              <div><Label>Libellé *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Budget annuel (FCFA)</Label><Input type="number" value={form.budgetAmount} onChange={(e) => setForm({ ...form, budgetAmount: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AccountingShell>
  );
}
