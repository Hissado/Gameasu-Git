import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { AccountingShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Row = { code: string; label: string; classNum: number; totalDebit: number; totalCredit: number; soldDebit: number; soldCredit: number };

export default function BalancePage() {
  const [from, setFrom] = useState(new Date().getFullYear() + "-01-01");
  const [to, setTo] = useState(new Date().getFullYear() + "-12-31");
  const { data, isLoading } = useQuery<{ data: Row[]; totalDebit: number; totalCredit: number }>({
    queryKey: ["balance", from, to],
    queryFn: () => apiFetch(`/api/accounting/balance?from=${from}&to=${to}`),
  });

  return (
    <AccountingShell title="Balance générale" subtitle="Cumul débits/crédits et soldes par compte sur la période">
      <div className="flex gap-3 mb-4">
        <div><label className="text-xs font-semibold block mb-1">Du</label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="text-xs font-semibold block mb-1">Au</label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      {isLoading ? "Chargement…" : (
        <Card><CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Compte</th>
                <th className="text-left p-3">Libellé</th>
                <th className="text-right p-3">Total débit</th>
                <th className="text-right p-3">Total crédit</th>
                <th className="text-right p-3">Solde débiteur</th>
                <th className="text-right p-3">Solde créditeur</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground italic">Aucun mouvement comptable sur la période</td></tr>}
              {data?.data.map((r) => (
                <tr key={r.code} className="border-t hover:bg-slate-50">
                  <td className="p-3 font-mono font-semibold">{r.code}</td>
                  <td className="p-3">{r.label}</td>
                  <td className="p-3 text-right font-mono">{formatFCFA(r.totalDebit)}</td>
                  <td className="p-3 text-right font-mono">{formatFCFA(r.totalCredit)}</td>
                  <td className="p-3 text-right font-mono">{r.soldDebit ? formatFCFA(r.soldDebit) : "—"}</td>
                  <td className="p-3 text-right font-mono">{r.soldCredit ? formatFCFA(r.soldCredit) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/60 font-bold border-t-2 border-primary">
              <tr>
                <td colSpan={2} className="p-3 text-right">Totaux généraux</td>
                <td className="p-3 text-right font-mono">{formatFCFA(data?.totalDebit ?? 0)}</td>
                <td className="p-3 text-right font-mono">{formatFCFA(data?.totalCredit ?? 0)}</td>
                <td colSpan={2} className="p-3 text-right text-xs uppercase">
                  {data && Math.abs(data.totalDebit - data.totalCredit) < 0.01 ? "✓ Balance équilibrée" : "Déséquilibre détecté"}
                </td>
              </tr>
            </tfoot>
          </table>
        </CardContent></Card>
      )}
    </AccountingShell>
  );
}
