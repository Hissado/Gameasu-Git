import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { AccountingShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Landmark, ArrowLeftRight, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Bank = { id: string; name: string; type: string; bankName?: string; accountNumber?: string; accountCode?: string; accountLabel?: string; currency?: string; openingBalance: number; computedBalance: number };
type Tx = { id: string; transactionDate: string; label: string; amount: number; reference?: string; isReconciled: boolean };
type Account = { id: string; code: string; label: string; classNum: number };

export default function BanksPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const [openBank, setOpenBank] = useState(false);
  const [openTx, setOpenTx] = useState(false);
  const [openRecon, setOpenRecon] = useState(false);

  const { data: banks } = useQuery<{ data: Bank[] }>({ queryKey: ["bank-accounts"], queryFn: () => apiFetch("/api/accounting/bank-accounts") });
  const { data: txs } = useQuery<{ data: Tx[] }>({
    queryKey: ["bank-tx", selected],
    queryFn: () => apiFetch(`/api/accounting/bank-accounts/${selected}/transactions`),
    enabled: !!selected,
  });
  const { data: recon } = useQuery<{ transactions: Tx[]; journalLines: any[] }>({
    queryKey: ["recon", selected],
    queryFn: () => apiFetch(`/api/accounting/bank-accounts/${selected}/reconciliation`),
    enabled: !!selected && openRecon,
  });
  const { data: accounts } = useQuery<{ data: Account[] }>({ queryKey: ["chart-of-accounts-list"], queryFn: () => apiFetch("/api/accounting/chart-of-accounts") });
  const treasuryAccounts = accounts?.data.filter((a) => a.classNum === 5) ?? [];

  const [bankForm, setBankForm] = useState({ name: "", type: "bank", bankName: "", accountNumber: "", accountId: "", openingBalance: "0" });
  const [txForm, setTxForm] = useState({ transactionDate: new Date().toISOString().slice(0, 10), label: "", amount: "", reference: "" });

  const createBank = useMutation({
    mutationFn: () => apiFetch("/api/accounting/bank-accounts", { method: "POST", body: JSON.stringify({ ...bankForm, openingBalance: Number(bankForm.openingBalance) }) }),
    onSuccess: () => { toast({ title: "Compte créé" }); setOpenBank(false); setBankForm({ name: "", type: "bank", bankName: "", accountNumber: "", accountId: "", openingBalance: "0" }); qc.invalidateQueries({ queryKey: ["bank-accounts"] }); },
  });
  const createTx = useMutation({
    mutationFn: () => apiFetch(`/api/accounting/bank-accounts/${selected}/transactions`, { method: "POST", body: JSON.stringify({ ...txForm, amount: Number(txForm.amount) }) }),
    onSuccess: () => { toast({ title: "Mouvement enregistré" }); setOpenTx(false); setTxForm({ transactionDate: new Date().toISOString().slice(0, 10), label: "", amount: "", reference: "" }); qc.invalidateQueries({ queryKey: ["bank-tx", selected] }); },
  });
  const match = useMutation({
    mutationFn: ({ transactionId, lineId }: any) => apiFetch("/api/accounting/reconciliation/match", { method: "POST", body: JSON.stringify({ transactionId, lineId }) }),
    onSuccess: () => { toast({ title: "Ligne rapprochée" }); qc.invalidateQueries({ queryKey: ["recon", selected] }); qc.invalidateQueries({ queryKey: ["bank-tx", selected] }); },
  });

  return (
    <AccountingShell
      title="Banques & caisses"
      subtitle="Trésorerie : comptes, mouvements, rapprochements"
      actions={<Button onClick={() => setOpenBank(true)} className="bg-amber-600 hover:bg-amber-700"><Plus className="w-4 h-4 mr-2" />Nouveau compte</Button>}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {banks?.data.map((b) => (
          <Card key={b.id} className={`cursor-pointer transition ${selected === b.id ? "border-amber-500 ring-2 ring-amber-200" : ""}`} onClick={() => setSelected(b.id)}>
            <CardContent className="p-5">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-amber-700" />
                  <div>
                    <div className="font-bold">{b.name}</div>
                    <div className="text-xs text-muted-foreground">{b.bankName ?? (b.type === "cash" ? "Caisse" : "Banque")}</div>
                  </div>
                </div>
                <Badge variant={b.type === "cash" ? "secondary" : "default"}>{b.type === "cash" ? "Caisse" : "Banque"}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">Compte SYSCOHADA : <span className="font-mono">{b.accountCode}</span></div>
              <div className="mt-3 pt-3 border-t">
                <div className="text-xs uppercase text-muted-foreground">Solde calculé</div>
                <div className="text-2xl font-bold text-emerald-600">{formatFCFA(b.computedBalance)}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selected && (
        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-3 border-b bg-slate-50 flex justify-between items-center">
              <span className="font-bold">Mouvements — {banks?.data.find((b) => b.id === selected)?.name}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setOpenRecon(true)}><ArrowLeftRight className="w-3 h-3 mr-1" />Rapprochement</Button>
                <Button size="sm" onClick={() => setOpenTx(true)} className="bg-amber-600 hover:bg-amber-700"><Plus className="w-3 h-3 mr-1" />Mouvement</Button>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Libellé</th>
                  <th className="text-left p-3">Référence</th>
                  <th className="text-right p-3">Montant</th>
                  <th className="text-left p-3">Pointé</th>
                </tr>
              </thead>
              <tbody>
                {txs?.data.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground italic">Aucun mouvement</td></tr>}
                {txs?.data.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="p-3">{t.transactionDate}</td>
                    <td className="p-3">{t.label}</td>
                    <td className="p-3 text-xs">{t.reference ?? "—"}</td>
                    <td className={`p-3 text-right font-mono font-semibold ${t.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatFCFA(t.amount)}</td>
                    <td className="p-3">{t.isReconciled ? <Check className="w-4 h-4 text-emerald-600" /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Nouveau compte */}
      <Dialog open={openBank} onOpenChange={setOpenBank}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau compte trésorerie</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="text-xs font-semibold mb-1 block">Nom*</label><Input value={bankForm.name} onChange={(e) => setBankForm({ ...bankForm, name: e.target.value })} /></div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Type</label>
              <select className="border rounded h-9 px-2 text-sm w-full" value={bankForm.type} onChange={(e) => setBankForm({ ...bankForm, type: e.target.value })}>
                <option value="bank">Banque</option>
                <option value="cash">Caisse</option>
              </select>
            </div>
            <div><label className="text-xs font-semibold mb-1 block">Banque</label><Input value={bankForm.bankName} onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })} /></div>
            <div className="col-span-2"><label className="text-xs font-semibold mb-1 block">N° de compte</label><Input value={bankForm.accountNumber} onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })} /></div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Compte SYSCOHADA*</label>
              <select className="border rounded h-9 px-2 text-sm w-full" value={bankForm.accountId} onChange={(e) => setBankForm({ ...bankForm, accountId: e.target.value })}>
                <option value="">—</option>
                {treasuryAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.label}</option>)}
              </select>
            </div>
            <div><label className="text-xs font-semibold mb-1 block">Solde initial</label><Input type="number" value={bankForm.openingBalance} onChange={(e) => setBankForm({ ...bankForm, openingBalance: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenBank(false)}>Annuler</Button>
            <Button onClick={() => createBank.mutate()} disabled={!bankForm.name || !bankForm.accountId || createBank.isPending} className="bg-amber-600 hover:bg-amber-700">Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nouveau mouvement */}
      <Dialog open={openTx} onOpenChange={setOpenTx}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau mouvement bancaire</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold mb-1 block">Date*</label><Input type="date" value={txForm.transactionDate} onChange={(e) => setTxForm({ ...txForm, transactionDate: e.target.value })} /></div>
            <div><label className="text-xs font-semibold mb-1 block">Référence</label><Input value={txForm.reference} onChange={(e) => setTxForm({ ...txForm, reference: e.target.value })} /></div>
            <div className="col-span-2"><label className="text-xs font-semibold mb-1 block">Libellé*</label><Input value={txForm.label} onChange={(e) => setTxForm({ ...txForm, label: e.target.value })} /></div>
            <div className="col-span-2"><label className="text-xs font-semibold mb-1 block">Montant signé* (négatif = dépense)</label><Input type="number" value={txForm.amount} onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenTx(false)}>Annuler</Button>
            <Button onClick={() => createTx.mutate()} disabled={!txForm.label || !txForm.amount || createTx.isPending} className="bg-amber-600 hover:bg-amber-700">Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rapprochement */}
      <Dialog open={openRecon} onOpenChange={setOpenRecon}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>Rapprochement bancaire</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Rapprochez chaque mouvement bancaire avec une ligne d'écriture comptable correspondante.</p>
          <div className="grid grid-cols-2 gap-4 mt-3 max-h-[60vh] overflow-y-auto">
            <div>
              <h4 className="text-sm font-bold mb-2">Mouvements bancaires non pointés</h4>
              <div className="space-y-2">
                {recon?.transactions.length === 0 && <div className="text-xs text-muted-foreground italic">Tout est rapproché ✓</div>}
                {recon?.transactions.map((t) => (
                  <div key={t.id} className="border rounded p-3 text-sm">
                    <div className="flex justify-between"><span className="font-mono text-xs">{t.transactionDate}</span><span className={`font-bold ${t.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatFCFA(t.amount)}</span></div>
                    <div>{t.label}</div>
                    <details className="mt-2">
                      <summary className="text-xs text-amber-700 cursor-pointer font-semibold">Rapprocher avec…</summary>
                      <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                        {recon?.journalLines.map((l) => (
                          <button key={l.lineId} type="button" onClick={() => match.mutate({ transactionId: t.id, lineId: l.lineId })}
                            className="w-full text-left border rounded p-2 text-xs hover:bg-slate-50">
                            <div className="font-mono">{l.entryNumber} — {l.entryDate}</div>
                            <div>{l.description}</div>
                            <div>D : {formatFCFA(l.debit)} • C : {formatFCFA(l.credit)}</div>
                          </button>
                        ))}
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold mb-2">Lignes d'écriture comptable non pointées</h4>
              <div className="space-y-2">
                {recon?.journalLines.length === 0 && <div className="text-xs text-muted-foreground italic">Aucune ligne en attente</div>}
                {recon?.journalLines.map((l) => (
                  <div key={l.lineId} className="border rounded p-3 text-sm">
                    <div className="flex justify-between"><span className="font-mono text-xs">{l.entryNumber}</span><span className="text-xs">{l.entryDate}</span></div>
                    <div>{l.description}</div>
                    <div className="text-xs">Débit : {formatFCFA(l.debit)} • Crédit : {formatFCFA(l.credit)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AccountingShell>
  );
}
