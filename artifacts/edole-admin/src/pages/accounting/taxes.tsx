import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { AccountingShell } from "./_layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, TrendingUp, Receipt, Building2, Users, Percent, AlertCircle } from "lucide-react";

type FiscalSummary = {
  period: { from: string | null; to: string | null };
  tva: { collectee: number; deductible: number; due: number };
  irpp: number; aib: number; ipts: number; cnss: number;
  resultatFiscal: number; revenus: number; charges: number;
};

type TvaLine = {
  entryNumber: string; entryDate: string; description: string;
  accountCode: string; accountLabel: string; debit: number; credit: number;
};

function TaxKPI({ label, value, sub, icon: Icon, accent = "default" }: {
  label: string; value: string; sub?: string;
  icon: any; accent?: "success" | "danger" | "warning" | "default";
}) {
  const colors = {
    success: "bg-emerald-50 border-emerald-200 text-emerald-700",
    danger: "bg-red-50 border-red-200 text-red-700",
    warning: "bg-amber-50 border-amber-200 text-amber-700",
    default: "bg-slate-50 border-slate-200 text-slate-700",
  };
  return (
    <div className={`border rounded-xl p-4 ${colors[accent]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wider opacity-70">{label}</span>
        <Icon className="w-4 h-4 opacity-60" />
      </div>
      <div className="text-xl font-bold">{value}</div>
      {sub && <div className="text-xs opacity-70 mt-1">{sub}</div>}
    </div>
  );
}

export default function TaxesPage() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [from, setFrom] = useState(firstDay);
  const [to, setTo] = useState(lastDay);
  const [tab, setTab] = useState<"summary" | "tva-detail">("summary");

  const params = new URLSearchParams({ from, to });

  const { data: summary, isLoading: loadingSummary } = useQuery<FiscalSummary>({
    queryKey: ["fiscal-summary", from, to],
    queryFn: () => apiFetch(`/api/accounting/fiscal/summary?${params}`),
  });

  const { data: tvaDetail, isLoading: loadingTva } = useQuery<{ data: TvaLine[] }>({
    queryKey: ["tva-detail", from, to],
    queryFn: () => apiFetch(`/api/accounting/fiscal/tva-detail?${params}`),
    enabled: tab === "tva-detail",
  });

  const tvaLines = tvaDetail?.data ?? [];
  const tvaCollecteLines = tvaLines.filter((l) => l.accountCode.startsWith("443"));
  const tvaDeductibleLines = tvaLines.filter((l) => l.accountCode.startsWith("445"));

  return (
    <AccountingShell
      title="Taxes & états fiscaux"
      subtitle="Tableaux de bord fiscaux — TVA, IRPP, IPTS, AIB, CNSS · Référentiel TOGO / UEMOA"
    >
      <div className="space-y-4">
        {/* Filtres période */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs font-semibold mb-1 block">Du</label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">Au</label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  const m = today.getMonth();
                  const y = today.getFullYear();
                  setFrom(new Date(y, m, 1).toISOString().slice(0, 10));
                  setTo(new Date(y, m + 1, 0).toISOString().slice(0, 10));
                }}
              >Mois en cours</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setFrom(`${today.getFullYear()}-01-01`);
                  setTo(`${today.getFullYear()}-12-31`);
                }}
              >Année en cours</Button>
            </div>
          </CardContent>
        </Card>

        {/* Onglets */}
        <div className="flex gap-1 border-b">
          {[
            { key: "summary", label: "Synthèse fiscale" },
            { key: "tva-detail", label: "Détail TVA" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                tab === t.key
                  ? "border-amber-500 text-amber-700"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "summary" && (
          <>
            {loadingSummary ? (
              <div className="text-muted-foreground py-8 text-center">Chargement…</div>
            ) : !summary ? null : (
              <div className="space-y-6">
                {/* TVA */}
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                    <Percent className="w-4 h-4 text-amber-600" /> TVA — Taxe sur la Valeur Ajoutée
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <TaxKPI
                      icon={TrendingUp}
                      label="TVA collectée"
                      value={formatFCFA(summary.tva.collectee)}
                      sub="Comptes 443x — TVA sur ventes"
                      accent="default"
                    />
                    <TaxKPI
                      icon={Receipt}
                      label="TVA déductible"
                      value={formatFCFA(summary.tva.deductible)}
                      sub="Comptes 4456x — TVA sur achats"
                      accent="success"
                    />
                    <TaxKPI
                      icon={AlertCircle}
                      label="TVA nette due"
                      value={formatFCFA(summary.tva.due)}
                      sub={summary.tva.due > 0 ? "À reverser à l'État" : "Crédit de TVA"}
                      accent={summary.tva.due > 0 ? "danger" : "success"}
                    />
                  </div>
                </div>

                <Separator />

                {/* Retenues à la source */}
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-600" /> Retenues sur salaires & charges sociales
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <TaxKPI
                      icon={Receipt}
                      label="IRPP"
                      value={formatFCFA(summary.irpp)}
                      sub="Impôt sur revenu des personnes physiques · Compte 4473x"
                      accent="warning"
                    />
                    <TaxKPI
                      icon={Receipt}
                      label="IPTS"
                      value={formatFCFA(summary.ipts)}
                      sub="Impôt sur traitements et salaires · Compte 4471x"
                      accent="warning"
                    />
                    <TaxKPI
                      icon={Receipt}
                      label="AIB"
                      value={formatFCFA(summary.aib)}
                      sub="Acompte sur impôt sur bénéfices · Compte 4472x"
                      accent="warning"
                    />
                    <TaxKPI
                      icon={Building2}
                      label="CNSS / Charges patronales"
                      value={formatFCFA(summary.cnss)}
                      sub="Cotisations sécurité sociale · Compte 431x"
                      accent="default"
                    />
                  </div>
                </div>

                <Separator />

                {/* Résultat fiscal */}
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-600" /> Résultat fiscal estimé
                  </h3>
                  <Card className="bg-slate-50">
                    <CardContent className="p-5">
                      <div className="grid grid-cols-3 gap-6">
                        <div>
                          <div className="text-xs text-muted-foreground uppercase font-semibold">Total produits (Cl. 7)</div>
                          <div className="text-lg font-bold text-emerald-600 mt-1">{formatFCFA(summary.revenus)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground uppercase font-semibold">Total charges (Cl. 6)</div>
                          <div className="text-lg font-bold text-red-600 mt-1">{formatFCFA(summary.charges)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground uppercase font-semibold">Résultat avant IS</div>
                          <div className={`text-xl font-bold mt-1 ${summary.resultatFiscal >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                            {summary.resultatFiscal >= 0 ? "+" : ""}{formatFCFA(summary.resultatFiscal)}
                          </div>
                          <Badge className="mt-2" variant={summary.resultatFiscal >= 0 ? "default" : "destructive"}>
                            {summary.resultatFiscal >= 0 ? "Bénéfice imposable" : "Déficit fiscal"}
                          </Badge>
                        </div>
                      </div>
                      {summary.resultatFiscal > 0 && (
                        <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">IS estimé (taux 28%)</span>
                            <span className="font-bold ml-2">{formatFCFA(summary.resultatFiscal * 0.28)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Résultat net estimé</span>
                            <span className="font-bold ml-2 text-emerald-700">{formatFCFA(summary.resultatFiscal * 0.72)}</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <p className="text-xs text-muted-foreground mt-2">
                    * Résultat fiscal calculé à partir des écritures validées sur la période sélectionnée. Taux IS indicatif (28% — régime de droit commun Togo). Consultez votre expert-comptable pour le calcul définitif.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {tab === "tva-detail" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mouvements TVA — détail ligne à ligne</CardTitle>
              <CardDescription>Comptes 443x (collectée) et 445x (déductible) — période du {from} au {to}</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {loadingTva ? (
                <div className="p-6 text-center text-muted-foreground">Chargement…</div>
              ) : tvaLines.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground italic">Aucun mouvement TVA sur la période</div>
              ) : (
                <>
                  {tvaCollecteLines.length > 0 && (
                    <>
                      <div className="px-4 py-2 bg-red-50 border-b text-xs font-bold uppercase text-red-700 tracking-wider">
                        TVA collectée (443x)
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>N° écriture</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Libellé</TableHead>
                            <TableHead>Compte</TableHead>
                            <TableHead className="text-right">Débit</TableHead>
                            <TableHead className="text-right">Crédit</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tvaCollecteLines.map((l, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono text-xs">{l.entryNumber}</TableCell>
                              <TableCell className="text-xs">{l.entryDate}</TableCell>
                              <TableCell className="text-xs">{l.description ?? "—"}</TableCell>
                              <TableCell className="text-xs"><span className="font-mono">{l.accountCode}</span></TableCell>
                              <TableCell className="text-right">{l.debit > 0 ? formatFCFA(l.debit) : "—"}</TableCell>
                              <TableCell className="text-right font-semibold text-red-700">{l.credit > 0 ? formatFCFA(l.credit) : "—"}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-red-50 font-bold">
                            <TableCell colSpan={4} className="text-right text-xs">Total TVA collectée</TableCell>
                            <TableCell className="text-right">{formatFCFA(tvaCollecteLines.reduce((s, l) => s + l.debit, 0))}</TableCell>
                            <TableCell className="text-right text-red-700">{formatFCFA(tvaCollecteLines.reduce((s, l) => s + l.credit, 0))}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </>
                  )}

                  {tvaDeductibleLines.length > 0 && (
                    <>
                      <div className="px-4 py-2 bg-emerald-50 border-b border-t text-xs font-bold uppercase text-emerald-700 tracking-wider">
                        TVA déductible (445x)
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>N° écriture</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Libellé</TableHead>
                            <TableHead>Compte</TableHead>
                            <TableHead className="text-right">Débit</TableHead>
                            <TableHead className="text-right">Crédit</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tvaDeductibleLines.map((l, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono text-xs">{l.entryNumber}</TableCell>
                              <TableCell className="text-xs">{l.entryDate}</TableCell>
                              <TableCell className="text-xs">{l.description ?? "—"}</TableCell>
                              <TableCell className="text-xs"><span className="font-mono">{l.accountCode}</span></TableCell>
                              <TableCell className="text-right font-semibold text-emerald-700">{l.debit > 0 ? formatFCFA(l.debit) : "—"}</TableCell>
                              <TableCell className="text-right">{l.credit > 0 ? formatFCFA(l.credit) : "—"}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-emerald-50 font-bold">
                            <TableCell colSpan={4} className="text-right text-xs">Total TVA déductible</TableCell>
                            <TableCell className="text-right text-emerald-700">{formatFCFA(tvaDeductibleLines.reduce((s, l) => s + l.debit, 0))}</TableCell>
                            <TableCell className="text-right">{formatFCFA(tvaDeductibleLines.reduce((s, l) => s + l.credit, 0))}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AccountingShell>
  );
}
