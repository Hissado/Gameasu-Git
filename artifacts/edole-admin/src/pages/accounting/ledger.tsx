import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { AccountingShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Account = { id: string; code: string; label: string };
type Row = { entryId: string; entryNumber: string; entryDate: string; journalCode: string; reference?: string; description?: string; debit: number; credit: number; runningBalance: number };

export default function LedgerPage() {
  const { data: accounts } = useQuery<{ data: Account[] }>({ queryKey: ["chart-of-accounts-list"], queryFn: () => apiFetch("/api/accounting/chart-of-accounts") });
  const [accountId, setAccountId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isFetching } = useQuery<{ account: Account; data: Row[]; totalDebit: number; totalCredit: number; balance: number }>({
    queryKey: ["ledger", accountId, from, to],
    queryFn: () => {
      const qs = new URLSearchParams();
      qs.set("accountId", accountId);
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      return apiFetch(`/api/accounting/ledger?${qs}`);
    },
    enabled: !!accountId,
  });

  return (
    <AccountingShell title="Grand livre" subtitle="Détail chronologique des mouvements d'un compte">
      <Card className="mb-4">
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[260px]">
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Compte</label>
            <select className="border rounded-md h-9 px-2 text-sm w-full" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">— Sélectionner un compte —</option>
              {accounts?.data.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Du</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Au</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {!accountId ? (
        <div className="text-muted-foreground italic text-center py-12">Sélectionnez un compte pour afficher son grand livre</div>
      ) : isFetching ? (
        <div>Chargement…</div>
      ) : data ? (
        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-4 border-b bg-orange-50 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase text-muted-foreground font-semibold">Compte</div>
                <div className="text-lg font-bold">{data.account.code} — {data.account.label}</div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase text-muted-foreground font-semibold">Solde</div>
                <div className={`text-xl font-bold ${data.balance >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatFCFA(data.balance)}</div>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Pièce</th>
                  <th className="text-left p-3">Journal</th>
                  <th className="text-left p-3">Libellé</th>
                  <th className="text-right p-3">Débit</th>
                  <th className="text-right p-3">Crédit</th>
                  <th className="text-right p-3">Solde</th>
                </tr>
              </thead>
              <tbody>
                {data.data.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground italic">Aucun mouvement</td></tr>}
                {data.data.map((r) => (
                  <tr key={r.entryId + r.entryDate} className="border-t hover:bg-slate-50">
                    <td className="p-3">{r.entryDate}</td>
                    <td className="p-3 font-mono text-xs">{r.entryNumber}</td>
                    <td className="p-3 text-xs">{r.journalCode}</td>
                    <td className="p-3">{r.description ?? r.reference ?? "—"}</td>
                    <td className="p-3 text-right font-mono">{r.debit ? formatFCFA(r.debit) : "—"}</td>
                    <td className="p-3 text-right font-mono">{r.credit ? formatFCFA(r.credit) : "—"}</td>
                    <td className="p-3 text-right font-mono font-semibold">{formatFCFA(r.runningBalance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-semibold">
                <tr className="border-t">
                  <td colSpan={4} className="p-3 text-right">Totaux</td>
                  <td className="p-3 text-right font-mono">{formatFCFA(data.totalDebit)}</td>
                  <td className="p-3 text-right font-mono">{formatFCFA(data.totalCredit)}</td>
                  <td className="p-3 text-right font-mono">{formatFCFA(data.balance)}</td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      ) : null}
    </AccountingShell>
  );
}
