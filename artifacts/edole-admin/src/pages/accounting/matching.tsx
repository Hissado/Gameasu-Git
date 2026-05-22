import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { AccountingShell } from "./_layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Link2, Unlink, CheckCircle2, AlertCircle } from "lucide-react";

type Line = {
  lineId: string; entryId: string; entryNumber: string; entryDate: string;
  description: string; accountCode: string; accountLabel: string;
  debit: number; credit: number; thirdPartyType?: string; thirdPartyId?: string;
};
type Account = { id: string; code: string; label: string; classNum: number };

export default function MatchingPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [accountCode, setAccountCode] = useState("411");
  const [thirdPartyType, setThirdPartyType] = useState("client");
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const params = new URLSearchParams({ accountCode, thirdPartyType });
  const { data, isFetching, refetch } = useQuery<{ data: Line[] }>({
    queryKey: ["matching", accountCode, thirdPartyType],
    queryFn: () => apiFetch(`/api/accounting/matching?${params}`),
    enabled: searched,
  });

  const lines = data?.data ?? [];
  const selectedLines = lines.filter((l) => selected.has(l.lineId));
  const totalDebit = selectedLines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = selectedLines.reduce((s, l) => s + l.credit, 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const matchMut = useMutation({
    mutationFn: () => apiFetch("/api/accounting/matching/match", { method: "POST", body: JSON.stringify({ lineIds: [...selected] }) }),
    onSuccess: () => {
      toast({ title: "Lettrage effectué", description: `${selected.size} lignes lettrées avec succès.` });
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["matching"] });
      refetch();
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error ?? e?.message, variant: "destructive" }),
  });

  const unmatchMut = useMutation({
    mutationFn: () => apiFetch("/api/accounting/matching/unmatch", { method: "POST", body: JSON.stringify({ lineIds: [...selected] }) }),
    onSuccess: () => {
      toast({ title: "Délettrage effectué" });
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["matching"] });
      refetch();
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error ?? e?.message, variant: "destructive" }),
  });

  const toggleLine = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === lines.length) setSelected(new Set());
    else setSelected(new Set(lines.map((l) => l.lineId)));
  };

  return (
    <AccountingShell
      title="Lettrage des écritures"
      subtitle="Pointage et lettrage manuel des lignes auxiliaires clients et fournisseurs"
    >
      <div className="space-y-4">
        {/* Filtres */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs font-semibold mb-1 block">Compte SYSCOHADA</label>
                <Input
                  value={accountCode}
                  onChange={(e) => setAccountCode(e.target.value)}
                  placeholder="411"
                  className="w-32"
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">Type de tiers</label>
                <select
                  className="border rounded h-9 px-2 text-sm"
                  value={thirdPartyType}
                  onChange={(e) => setThirdPartyType(e.target.value)}
                >
                  <option value="client">Clients (411)</option>
                  <option value="supplier">Fournisseurs (401)</option>
                  <option value="">Tous</option>
                </select>
              </div>
              <Button
                onClick={() => { setSearched(true); setSelected(new Set()); refetch(); }}
                disabled={isFetching}
                className="bg-amber-600 hover:bg-amber-700"
              >
                Charger les lignes
              </Button>
              {selected.size >= 2 && (
                <>
                  <Button
                    onClick={() => matchMut.mutate()}
                    disabled={!balanced || matchMut.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Link2 className="w-4 h-4 mr-1" /> Lettrer ({selected.size})
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => unmatchMut.mutate()}
                    disabled={unmatchMut.isPending}
                  >
                    <Unlink className="w-4 h-4 mr-1" /> Délettrer
                  </Button>
                </>
              )}
            </div>

            {selected.size >= 2 && (
              <div className={`mt-3 flex items-center gap-3 text-sm p-3 rounded-md ${balanced ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
                {balanced
                  ? <CheckCircle2 className="w-4 h-4" />
                  : <AlertCircle className="w-4 h-4" />}
                <span>
                  Sélection : Débit {formatFCFA(totalDebit)} — Crédit {formatFCFA(totalCredit)}
                  {!balanced && <> — Écart : {formatFCFA(Math.abs(totalDebit - totalCredit))} (le lettrage requiert l'équilibre)</>}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tableau des lignes */}
        {searched && (
          <Card>
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-sm flex justify-between items-center">
                <span>Lignes non lettrées — {lines.length} résultat(s)</span>
                {lines.length > 0 && (
                  <button className="text-xs text-amber-700 font-semibold hover:underline" onClick={toggleAll}>
                    {selected.size === lines.length ? "Tout désélectionner" : "Tout sélectionner"}
                  </button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {isFetching ? (
                <div className="p-6 text-center text-muted-foreground">Chargement…</div>
              ) : lines.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground italic">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                  Toutes les lignes sont lettrées pour ce compte.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-3 w-10"></th>
                      <th className="text-left p-3">N° écriture</th>
                      <th className="text-left p-3">Date</th>
                      <th className="text-left p-3">Libellé</th>
                      <th className="text-left p-3">Compte</th>
                      <th className="text-right p-3">Débit</th>
                      <th className="text-right p-3">Crédit</th>
                      <th className="text-right p-3">Solde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => {
                      const solde = l.debit - l.credit;
                      const isSelected = selected.has(l.lineId);
                      return (
                        <tr
                          key={l.lineId}
                          className={`border-t cursor-pointer transition ${isSelected ? "bg-amber-50" : "hover:bg-slate-50"}`}
                          onClick={() => toggleLine(l.lineId)}
                        >
                          <td className="p-3">
                            <Checkbox checked={isSelected} onCheckedChange={() => toggleLine(l.lineId)} onClick={(e) => e.stopPropagation()} />
                          </td>
                          <td className="p-3 font-mono text-xs">{l.entryNumber}</td>
                          <td className="p-3 text-xs">{l.entryDate}</td>
                          <td className="p-3 max-w-[200px] truncate">{l.description ?? "—"}</td>
                          <td className="p-3">
                            <span className="font-mono text-xs">{l.accountCode}</span>
                            <span className="text-muted-foreground text-xs ml-1 hidden sm:inline">{l.accountLabel}</span>
                          </td>
                          <td className="p-3 text-right font-mono">{l.debit > 0 ? formatFCFA(l.debit) : "—"}</td>
                          <td className="p-3 text-right font-mono">{l.credit > 0 ? formatFCFA(l.credit) : "—"}</td>
                          <td className={`p-3 text-right font-mono font-semibold ${solde >= 0 ? "text-slate-700" : "text-red-600"}`}>
                            {formatFCFA(solde)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {lines.length > 0 && (
                    <tfoot className="border-t bg-slate-50 font-semibold text-sm">
                      <tr>
                        <td colSpan={5} className="p-3 text-right text-muted-foreground">Totaux</td>
                        <td className="p-3 text-right font-mono">{formatFCFA(lines.reduce((s, l) => s + l.debit, 0))}</td>
                        <td className="p-3 text-right font-mono">{formatFCFA(lines.reduce((s, l) => s + l.credit, 0))}</td>
                        <td className="p-3 text-right font-mono">{formatFCFA(lines.reduce((s, l) => s + l.debit - l.credit, 0))}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Guide */}
        {!searched && (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-muted-foreground">
              <Link2 className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="font-semibold mb-1">Lettrage manuel des écritures</p>
              <p className="text-sm">Sélectionnez un compte (ex : 411 Clients, 401 Fournisseurs), chargez les lignes non lettrées,<br />
              puis sélectionnez au moins 2 lignes équilibrées (débit = crédit) pour les lettrer.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AccountingShell>
  );
}
