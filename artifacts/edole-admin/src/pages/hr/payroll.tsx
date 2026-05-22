import React, { useState } from "react";
import { HrShell } from "./_layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatFCFA } from "@/lib/format";
import { Plus, Play, CheckCircle, ChevronDown, ChevronRight, Users, TrendingUp, Banknote, Receipt } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const API = "/api";

async function fetchJSON(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("auth_token");
  const r = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? r.statusText); }
  return r.json();
}

const STATUS_LABELS: Record<string, string> = { draft: "Brouillon", validated: "Validé", paid: "Payé", archived: "Archivé" };
const STATUS_COLORS: Record<string, string> = { draft: "secondary", validated: "default", paid: "success", archived: "outline" };

export default function PayrollPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [newOpen, setNewOpen] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [newForm, setNewForm] = useState({ period: format(new Date(), "yyyy-MM"), notes: "", paymentDate: "" });

  const { data: runs = [], isLoading } = useQuery<any[]>({
    queryKey: ["payroll-runs"],
    queryFn: () => fetchJSON(`${API}/payroll/runs`),
  });

  const { data: runDetail } = useQuery<any>({
    queryKey: ["payroll-run", expandedRun],
    queryFn: () => fetchJSON(`${API}/payroll/runs/${expandedRun}`),
    enabled: !!expandedRun,
  });

  const createRun = useMutation({
    mutationFn: (d: typeof newForm) => fetchJSON(`${API}/payroll/runs`, { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll-runs"] }); setNewOpen(false); toast({ title: "Cycle créé" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const generateMut = useMutation({
    mutationFn: (id: string) => fetchJSON(`${API}/payroll/runs/${id}/generate`, { method: "POST" }),
    onSuccess: (_, id) => { qc.invalidateQueries({ queryKey: ["payroll-runs"] }); qc.invalidateQueries({ queryKey: ["payroll-run", id] }); toast({ title: "Bulletins générés" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const validateMut = useMutation({
    mutationFn: (id: string) => fetchJSON(`${API}/payroll/runs/${id}/validate`, { method: "POST" }),
    onSuccess: (_, id) => { qc.invalidateQueries({ queryKey: ["payroll-runs"] }); qc.invalidateQueries({ queryKey: ["payroll-run", id] }); toast({ title: "Cycle validé" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const totalBrut = runs.reduce((s: number, r: any) => s + r.totalGrossSalary, 0);
  const totalNet = runs.reduce((s: number, r: any) => s + r.totalNetSalary, 0);

  return (
    <HrShell title="Livre de paie" subtitle="Cycles mensuels, bulletins et cotisations">
      <div className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center"><Users className="w-5 h-5 text-blue-600" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Cycles</p>
                  <p className="text-xl font-bold">{runs.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-orange-600" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Masse salariale brute</p>
                  <p className="text-lg font-bold">{formatFCFA(totalBrut)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center"><Banknote className="w-5 h-5 text-green-600" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Masse salariale nette</p>
                  <p className="text-lg font-bold">{formatFCFA(totalNet)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center"><Receipt className="w-5 h-5 text-purple-600" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Charge patronale CNSS</p>
                  <p className="text-lg font-bold">{formatFCFA(runs.reduce((s: number, r: any) => s + r.totalCnssEmployer, 0))}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar */}
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Cycles de paie</h2>
          <Button onClick={() => setNewOpen(true)} className="gap-2"><Plus className="w-4 h-4" />Nouveau cycle</Button>
        </div>

        {/* Runs list */}
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Chargement…</div>
        ) : runs.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">Aucun cycle de paie créé</div>
        ) : (
          <div className="space-y-2">
            {runs.map((run: any) => {
              const isExpanded = expandedRun === run.id;
              return (
                <Card key={run.id} className="overflow-hidden">
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                  >
                    <div className="flex items-center gap-4">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      <div>
                        <span className="font-semibold">{run.period}</span>
                        <span className="ml-3 text-sm text-muted-foreground">{run.employeeCount ?? 0} collaborateur(s)</span>
                      </div>
                      <Badge variant={STATUS_COLORS[run.status] as any}>{STATUS_LABELS[run.status] ?? run.status}</Badge>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-muted-foreground">Brut</p>
                        <p className="font-semibold">{formatFCFA(run.totalGrossSalary)}</p>
                      </div>
                      <div className="text-right hidden md:block">
                        <p className="text-xs text-muted-foreground">Net</p>
                        <p className="font-semibold text-green-700">{formatFCFA(run.totalNetSalary)}</p>
                      </div>
                      {run.status === "draft" && (
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="outline" disabled={generateMut.isPending} onClick={() => generateMut.mutate(run.id)}>
                            <Play className="w-3 h-3 mr-1" />Générer
                          </Button>
                          {(run.employeeCount ?? 0) > 0 && (
                            <Button size="sm" disabled={validateMut.isPending} onClick={() => validateMut.mutate(run.id)}>
                              <CheckCircle className="w-3 h-3 mr-1" />Valider
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {isExpanded && runDetail?.id === run.id && (
                    <div className="border-t">
                      {/* Récap cotisations */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-muted text-sm">
                        {[
                          { label: "Salaire brut", value: formatFCFA(runDetail.totalGrossSalary) },
                          { label: "CNSS salarié (4%)", value: formatFCFA(runDetail.totalCnssEmployee) },
                          { label: "IRPP", value: formatFCFA(runDetail.totalIrpp) },
                          { label: "IPTS (2%)", value: formatFCFA(runDetail.totalIpts) },
                          { label: "Salaire net", value: formatFCFA(runDetail.totalNetSalary), highlight: true },
                        ].map((item) => (
                          <div key={item.label} className={`bg-background px-3 py-2 ${item.highlight ? "text-green-700 font-semibold" : ""}`}>
                            <p className="text-xs text-muted-foreground">{item.label}</p>
                            <p className="font-medium">{item.value}</p>
                          </div>
                        ))}
                      </div>
                      {/* Bulletins */}
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Collaborateur</TableHead>
                              <TableHead>Département</TableHead>
                              <TableHead className="text-right">Salaire brut</TableHead>
                              <TableHead className="text-right">CNSS salarié</TableHead>
                              <TableHead className="text-right">IRPP</TableHead>
                              <TableHead className="text-right">IPTS</TableHead>
                              <TableHead className="text-right">Net à payer</TableHead>
                              <TableHead>Statut</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(runDetail.payslips ?? []).map((p: any) => (
                              <TableRow key={p.id}>
                                <TableCell className="font-medium">{p.collaboratorName}</TableCell>
                                <TableCell className="text-muted-foreground">{p.department ?? "—"}</TableCell>
                                <TableCell className="text-right">{formatFCFA(p.grossSalary)}</TableCell>
                                <TableCell className="text-right text-red-600">{formatFCFA(p.cnssEmployee)}</TableCell>
                                <TableCell className="text-right text-red-600">{formatFCFA(p.irpp)}</TableCell>
                                <TableCell className="text-right text-red-600">{formatFCFA(p.ipts)}</TableCell>
                                <TableCell className="text-right font-semibold text-green-700">{formatFCFA(p.netSalary)}</TableCell>
                                <TableCell><Badge variant={p.status === "validated" ? "default" : "secondary"}>{STATUS_LABELS[p.status] ?? p.status}</Badge></TableCell>
                              </TableRow>
                            ))}
                            {(!runDetail.payslips || runDetail.payslips.length === 0) && (
                              <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Cliquez sur "Générer" pour créer les bulletins</TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog nouveau cycle */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau cycle de paie</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Période (YYYY-MM)</Label>
              <Input value={newForm.period} onChange={(e) => setNewForm({ ...newForm, period: e.target.value })} placeholder="2026-06" />
            </div>
            <div>
              <Label>Date de paiement prévue</Label>
              <Input type="date" value={newForm.paymentDate} onChange={(e) => setNewForm({ ...newForm, paymentDate: e.target.value })} />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={newForm.notes} onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Annuler</Button>
            <Button onClick={() => createRun.mutate(newForm)} disabled={createRun.isPending}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
