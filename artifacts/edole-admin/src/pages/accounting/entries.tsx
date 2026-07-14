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
import { Plus, Trash2, RotateCcw, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Entry = {
  id: string; entryNumber: string; entryDate: string;
  reference?: string; description?: string; status: string;
  totalDebit: number; totalCredit: number;
  journalCode?: string; journalLabel?: string; sourceType?: string;
};

type Account = { id: string; code: string; label: string };
type Journal = { id: string; code: string; label: string; type: string };
type Line = { accountCode: string; debit: string; credit: string; description: string };

export default function EntriesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [filters, setFilters] = useState({ journalId: "", from: "", to: "" });

  const { data: list } = useQuery<{ data: Entry[]; total: number }>({
    queryKey: ["entries", filters],
    queryFn: () => {
      const qs = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) qs.set(k, v); });
      qs.set("limit", "100");
      return apiFetch(`/api/accounting/entries?${qs}`);
    },
  });
  const { data: journalsData } = useQuery<{ data: Journal[] }>({ queryKey: ["journals"], queryFn: () => apiFetch("/api/accounting/journals") });
  const { data: accountsData } = useQuery<{ data: Account[] }>({ queryKey: ["chart-of-accounts-postable"], queryFn: () => apiFetch("/api/accounting/chart-of-accounts") });

  // formulaire saisie manuelle (OD par défaut)
  const [form, setForm] = useState({
    journalCode: "OD",
    entryDate: new Date().toISOString().slice(0, 10),
    reference: "",
    description: "",
    lines: [
      { accountCode: "", debit: "", credit: "", description: "" },
      { accountCode: "", debit: "", credit: "", description: "" },
    ] as Line[],
  });

  const totalDebit = form.lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = form.lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0;

  const create = useMutation({
    mutationFn: () => apiFetch("/api/accounting/entries", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        lines: form.lines
          .filter((l) => l.accountCode && (Number(l.debit) > 0 || Number(l.credit) > 0))
          .map((l) => ({
            accountCode: l.accountCode,
            debit: Number(l.debit || 0),
            credit: Number(l.credit || 0),
            description: l.description || undefined,
          })),
      }),
    }),
    onSuccess: () => {
      toast({ title: "Écriture comptabilisée" });
      setOpen(false);
      setForm((f) => ({ ...f, reference: "", description: "", lines: [{ accountCode: "", debit: "", credit: "", description: "" }, { accountCode: "", debit: "", credit: "", description: "" }] }));
      qc.invalidateQueries({ queryKey: ["entries"] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const reverse = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/accounting/entries/${id}/reverse`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Écriture extournée" });
      qc.invalidateQueries({ queryKey: ["entries"] });
      setDetail(null);
    },
  });

  return (
    <AccountingShell
      title="Écritures comptables"
      subtitle="Journal de toutes les opérations enregistrées en partie double"
      actions={<Button onClick={() => setOpen(true)} className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-2" />Saisir une écriture</Button>}
    >
      <Card className="mb-4">
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Journal</label>
            <select className="border rounded-md h-9 px-2 text-sm" value={filters.journalId} onChange={(e) => setFilters((f) => ({ ...f, journalId: e.target.value }))}>
              <option value="">Tous</option>
              {journalsData?.data.map((j) => <option key={j.id} value={j.id}>{j.code} — {j.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Du</label>
            <Input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} className="h-9 w-auto" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Au</label>
            <Input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} className="h-9 w-auto" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">N°</th>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Journal</th>
                <th className="text-left p-3">Référence</th>
                <th className="text-left p-3">Description</th>
                <th className="text-right p-3">Débit</th>
                <th className="text-right p-3">Crédit</th>
                <th className="text-left p-3">Statut</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {list?.data.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="py-12 flex flex-col items-center gap-2 text-muted-foreground">
                      <FileText className="w-8 h-8 opacity-25" />
                      <p className="text-sm font-medium">Aucune écriture enregistrée</p>
                      <p className="text-xs">Saisissez une nouvelle écriture comptable pour commencer.</p>
                    </div>
                  </td>
                </tr>
              )}
              {list?.data.map((e) => (
                <tr key={e.id} className="border-t hover:bg-slate-50 cursor-pointer" onClick={async () => setDetail(await apiFetch(`/api/accounting/entries/${e.id}`))}>
                  <td className="p-3 font-mono font-semibold">{e.entryNumber}</td>
                  <td className="p-3">{e.entryDate}</td>
                  <td className="p-3"><Badge variant="outline">{e.journalCode}</Badge></td>
                  <td className="p-3 text-xs">{e.reference ?? "—"}</td>
                  <td className="p-3">{e.description ?? "—"}</td>
                  <td className="p-3 text-right font-mono">{formatFCFA(e.totalDebit)}</td>
                  <td className="p-3 text-right font-mono">{formatFCFA(e.totalCredit)}</td>
                  <td className="p-3">
                    <Badge variant={e.status === "posted" ? "default" : e.status === "reversed" ? "destructive" : "secondary"}>
                      {e.status === "posted" ? "Validée" : e.status === "reversed" ? "Extournée" : "Brouillon"}
                    </Badge>
                  </td>
                  <td className="p-3 text-right text-xs text-muted-foreground">{e.sourceType ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Modale saisie écriture */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Nouvelle écriture comptable</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1 block">Journal</label>
                <select className="border rounded-md h-9 px-2 text-sm w-full" value={form.journalCode} onChange={(e) => setForm((f) => ({ ...f, journalCode: e.target.value }))}>
                  {journalsData?.data.map((j) => <option key={j.id} value={j.code}>{j.code} — {j.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">Date</label>
                <Input type="date" value={form.entryDate} onChange={(e) => setForm((f) => ({ ...f, entryDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">Référence</label>
                <Input value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} placeholder="N° pièce" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Description</label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Libellé de l'opération" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold">Lignes</label>
                <Button size="sm" variant="outline" onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, { accountCode: "", debit: "", credit: "", description: "" }] }))}>
                  <Plus className="w-3 h-3 mr-1" /> Ligne
                </Button>
              </div>
              <table className="w-full text-sm border">
                <thead className="bg-slate-50 text-xs">
                  <tr>
                    <th className="p-2 text-left">Compte</th>
                    <th className="p-2 text-left">Libellé</th>
                    <th className="p-2 text-right w-28">Débit</th>
                    <th className="p-2 text-right w-28">Crédit</th>
                    <th className="p-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.lines.map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-1">
                        <select className="border rounded h-8 px-1 text-sm w-full" value={l.accountCode} onChange={(e) => {
                          const v = e.target.value;
                          setForm((f) => ({ ...f, lines: f.lines.map((x, j) => j === i ? { ...x, accountCode: v } : x) }));
                        }}>
                          <option value="">—</option>
                          {accountsData?.data.map((a) => <option key={a.id} value={a.code}>{a.code} — {a.label}</option>)}
                        </select>
                      </td>
                      <td className="p-1">
                        <Input className="h-8" value={l.description} onChange={(e) => {
                          const v = e.target.value;
                          setForm((f) => ({ ...f, lines: f.lines.map((x, j) => j === i ? { ...x, description: v } : x) }));
                        }} />
                      </td>
                      <td className="p-1">
                        <Input className="h-8 text-right" type="number" value={l.debit} onChange={(e) => {
                          const v = e.target.value;
                          setForm((f) => ({ ...f, lines: f.lines.map((x, j) => j === i ? { ...x, debit: v, credit: v ? "" : x.credit } : x) }));
                        }} />
                      </td>
                      <td className="p-1">
                        <Input className="h-8 text-right" type="number" value={l.credit} onChange={(e) => {
                          const v = e.target.value;
                          setForm((f) => ({ ...f, lines: f.lines.map((x, j) => j === i ? { ...x, credit: v, debit: v ? "" : x.debit } : x) }));
                        }} />
                      </td>
                      <td className="p-1 text-center">
                        <button type="button" onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }))} className="text-red-500 hover:text-red-700">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-semibold">
                  <tr>
                    <td colSpan={2} className="p-2 text-right">Totaux</td>
                    <td className="p-2 text-right font-mono">{formatFCFA(totalDebit)}</td>
                    <td className="p-2 text-right font-mono">{formatFCFA(totalCredit)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
              <p className={`text-xs mt-2 ${balanced ? "text-emerald-600" : "text-red-600"} font-semibold`}>
                {balanced ? "✓ Écriture équilibrée" : `Écart : ${formatFCFA(Math.abs(totalDebit - totalCredit))} — l'écriture doit être équilibrée pour être enregistrée.`}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => create.mutate()} disabled={!balanced || create.isPending} className="bg-primary hover:bg-primary/90">Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Détail écriture */}
      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-3xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <FileText className="w-4 h-4" /> Écriture {detail.entryNumber}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div><div className="text-xs uppercase text-muted-foreground">Date</div><div className="font-semibold">{detail.entryDate}</div></div>
                  <div><div className="text-xs uppercase text-muted-foreground">Journal</div><div className="font-semibold">{detail.journal?.code} — {detail.journal?.label}</div></div>
                  <div><div className="text-xs uppercase text-muted-foreground">Statut</div><Badge variant={detail.status === "posted" ? "default" : "destructive"}>{detail.status}</Badge></div>
                </div>
                {detail.description && <div><div className="text-xs uppercase text-muted-foreground">Description</div><div>{detail.description}</div></div>}
                <table className="w-full border text-sm">
                  <thead className="bg-slate-50 text-xs">
                    <tr>
                      <th className="p-2 text-left">Compte</th>
                      <th className="p-2 text-left">Libellé</th>
                      <th className="p-2 text-right">Débit</th>
                      <th className="p-2 text-right">Crédit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.lines.map((l: any) => (
                      <tr key={l.id} className="border-t">
                        <td className="p-2 font-mono">{l.accountCode} — {l.accountLabel}</td>
                        <td className="p-2">{l.description ?? "—"}</td>
                        <td className="p-2 text-right font-mono">{l.debit ? formatFCFA(l.debit) : "—"}</td>
                        <td className="p-2 text-right font-mono">{l.credit ? formatFCFA(l.credit) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-semibold">
                    <tr>
                      <td colSpan={2} className="p-2 text-right">Totaux</td>
                      <td className="p-2 text-right font-mono">{formatFCFA(detail.totalDebit)}</td>
                      <td className="p-2 text-right font-mono">{formatFCFA(detail.totalCredit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <DialogFooter>
                {detail.status === "posted" && (
                  <Button variant="destructive" onClick={() => reverse.mutate(detail.id)} disabled={reverse.isPending}>
                    <RotateCcw className="w-4 h-4 mr-2" /> Extourner
                  </Button>
                )}
                <Button variant="outline" onClick={() => setDetail(null)}>Fermer</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AccountingShell>
  );
}
