import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { AccountingShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Item = { code: string; label: string; amount: number };

export default function IncomeStatementPage() {
  const [from, setFrom] = useState(new Date().getFullYear() + "-01-01");
  const [to, setTo] = useState(new Date().getFullYear() + "-12-31");
  const { data } = useQuery<{ charges: Item[]; produits: Item[]; totalCharges: number; totalProduits: number; resultatNet: number }>({
    queryKey: ["income-statement", from, to],
    queryFn: () => apiFetch(`/api/accounting/income-statement?from=${from}&to=${to}`),
  });

  return (
    <AccountingShell title="Compte de résultat" subtitle="Produits, charges et résultat net de la période">
      <div className="flex gap-3 mb-4">
        <div><label className="text-xs font-semibold block mb-1">Du</label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="text-xs font-semibold block mb-1">Au</label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-3 bg-red-50 border-b font-bold">Charges (Classe 6)</div>
            <table className="w-full text-sm">
              <tbody>
                {data?.charges.length === 0 && <tr><td className="p-4 text-muted-foreground italic">Aucune charge</td></tr>}
                {data?.charges.map((c) => (
                  <tr key={c.code} className="border-t">
                    <td className="p-3 font-mono w-20">{c.code}</td>
                    <td className="p-3">{c.label}</td>
                    <td className="p-3 text-right font-mono">{formatFCFA(c.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-red-50 font-bold">
                <tr><td colSpan={2} className="p-3">Total charges</td><td className="p-3 text-right font-mono text-red-600">{formatFCFA(data?.totalCharges ?? 0)}</td></tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-3 bg-emerald-50 border-b font-bold">Produits (Classe 7)</div>
            <table className="w-full text-sm">
              <tbody>
                {data?.produits.length === 0 && <tr><td className="p-4 text-muted-foreground italic">Aucun produit</td></tr>}
                {data?.produits.map((c) => (
                  <tr key={c.code} className="border-t">
                    <td className="p-3 font-mono w-20">{c.code}</td>
                    <td className="p-3">{c.label}</td>
                    <td className="p-3 text-right font-mono">{formatFCFA(c.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-emerald-50 font-bold">
                <tr><td colSpan={2} className="p-3">Total produits</td><td className="p-3 text-right font-mono text-emerald-600">{formatFCFA(data?.totalProduits ?? 0)}</td></tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 border-2 border-orange-500">
        <CardContent className="p-6 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase text-muted-foreground font-semibold">Résultat net de l'exercice</div>
            <div className="text-xs text-muted-foreground mt-1">Produits − Charges</div>
          </div>
          <div className={`text-3xl font-bold ${(data?.resultatNet ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {formatFCFA(data?.resultatNet ?? 0)}
          </div>
        </CardContent>
      </Card>
    </AccountingShell>
  );
}
