import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { AccountingShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Asset = { id: string; code: string; label: string; category?: string; acquisitionDate: string; acquisitionCost: number; residualValue: number; depreciationMethod: string; usefulLifeYears: number; status: string; accumulatedDepreciation: number; netBookValue: number };
type Account = { id: string; code: string; label: string; classNum: number };

export default function FixedAssetsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { data: assets } = useQuery<{ data: Asset[] }>({ queryKey: ["fixed-assets"], queryFn: () => apiFetch("/api/accounting/fixed-assets") });
  const { data: accounts } = useQuery<{ data: Account[] }>({ queryKey: ["chart-of-accounts-list"], queryFn: () => apiFetch("/api/accounting/chart-of-accounts") });

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
    mutationFn: () => apiFetch("/api/accounting/fixed-assets", { method: "POST", body: JSON.stringify({
      ...form,
      acquisitionCost: Number(form.acquisitionCost),
      residualValue: Number(form.residualValue),
      usefulLifeYears: Number(form.usefulLifeYears),
    })}),
    onSuccess: () => { toast({ title: "Immobilisation enregistrée" }); setOpen(false); setForm({ code: "", label: "", category: "", acquisitionDate: new Date().toISOString().slice(0, 10), acquisitionCost: "", residualValue: "0", usefulLifeYears: "5", depreciationMethod: "linear", accountId: "", depreciationAccountId: "", expenseAccountId: "" }); qc.invalidateQueries({ queryKey: ["fixed-assets"] }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const depreciate = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/accounting/fixed-assets/${id}/depreciate`, { method: "POST" }),
    onSuccess: () => { toast({ title: "Dotation amortissement comptabilisée" }); qc.invalidateQueries({ queryKey: ["fixed-assets"] }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const totalCost = assets?.data.reduce((s, a) => s + a.acquisitionCost, 0) ?? 0;
  const totalAmort = assets?.data.reduce((s, a) => s + a.accumulatedDepreciation, 0) ?? 0;
  const totalNet = assets?.data.reduce((s, a) => s + a.netBookValue, 0) ?? 0;

  return (
    <AccountingShell
      title="Immobilisations"
      subtitle="Suivi du parc d'actifs immobilisés et dotations aux amortissements"
      actions={<Button onClick={() => setOpen(true)} className=""><Plus className="w-4 h-4 mr-2" />Nouvelle immobilisation</Button>}
    >
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Valeur d'acquisition</div><div className="text-xl font-bold mt-1">{formatFCFA(totalCost)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Cumul amortissements</div><div className="text-xl font-bold mt-1 text-red-600">{formatFCFA(totalAmort)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Valeur nette comptable</div><div className="text-xl font-bold mt-1 text-emerald-600">{formatFCFA(totalNet)}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Code</th>
                <th className="text-left p-3">Désignation</th>
                <th className="text-left p-3">Acquisition</th>
                <th className="text-right p-3">Coût</th>
                <th className="text-right p-3">Cumul amort.</th>
                <th className="text-right p-3">VNC</th>
                <th className="text-left p-3">Méthode</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {assets?.data.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground italic">Aucune immobilisation</td></tr>}
              {assets?.data.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="p-3 font-mono">{a.code}</td>
                  <td className="p-3 font-semibold">{a.label}</td>
                  <td className="p-3 text-xs">{a.acquisitionDate}</td>
                  <td className="p-3 text-right font-mono">{formatFCFA(a.acquisitionCost)}</td>
                  <td className="p-3 text-right font-mono text-red-600">{formatFCFA(a.accumulatedDepreciation)}</td>
                  <td className="p-3 text-right font-mono font-bold">{formatFCFA(a.netBookValue)}</td>
                  <td className="p-3 text-xs">{a.depreciationMethod === "linear" ? "Linéaire" : "Dégressif"} sur {a.usefulLifeYears} ans</td>
                  <td className="p-3">
                    <Button size="sm" variant="outline" onClick={() => depreciate.mutate(a.id)} disabled={depreciate.isPending}>
                      <Calculator className="w-3 h-3 mr-1" /> Doter
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nouvelle immobilisation</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold mb-1 block">Code*</label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div><label className="text-xs font-semibold mb-1 block">Catégorie</label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Matériel, mobilier..." /></div>
            <div className="col-span-2"><label className="text-xs font-semibold mb-1 block">Désignation*</label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>
            <div><label className="text-xs font-semibold mb-1 block">Date d'acquisition*</label><Input type="date" value={form.acquisitionDate} onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })} /></div>
            <div><label className="text-xs font-semibold mb-1 block">Durée (années)*</label><Input type="number" value={form.usefulLifeYears} onChange={(e) => setForm({ ...form, usefulLifeYears: e.target.value })} /></div>
            <div><label className="text-xs font-semibold mb-1 block">Coût d'acquisition*</label><Input type="number" value={form.acquisitionCost} onChange={(e) => setForm({ ...form, acquisitionCost: e.target.value })} /></div>
            <div><label className="text-xs font-semibold mb-1 block">Valeur résiduelle</label><Input type="number" value={form.residualValue} onChange={(e) => setForm({ ...form, residualValue: e.target.value })} /></div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Compte d'immo* (24x)</label>
              <select className="border rounded h-9 px-2 text-sm w-full" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
                <option value="">—</option>
                {immoAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Compte amort. (28x)</label>
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
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => create.mutate()} disabled={!form.code || !form.label || !form.acquisitionCost || !form.accountId || create.isPending} className="">Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AccountingShell>
  );
}
