import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { AccountingShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Item = { code: string; label: string; amount: number };

export default function BalanceSheetPage() {
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const { data } = useQuery<{ actifs: Item[]; passifs: Item[]; totalActif: number; totalPassif: number; resultatNet: number }>({
    queryKey: ["balance-sheet", asOf],
    queryFn: () => apiFetch(`/api/accounting/balance-sheet?asOf=${asOf}`),
  });

  return (
    <AccountingShell title="Bilan" subtitle="Photographie patrimoniale à une date donnée">
      <div className="mb-4 max-w-xs">
        <label className="text-xs font-semibold block mb-1">Au</label>
        <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-3 bg-blue-50 border-b font-bold">ACTIF</div>
            <table className="w-full text-sm">
              <tbody>
                {data?.actifs.length === 0 && <tr><td className="p-4 text-muted-foreground italic">Aucun élément d'actif</td></tr>}
                {data?.actifs.map((c) => (
                  <tr key={c.code} className="border-t">
                    <td className="p-3 font-mono w-20">{c.code}</td>
                    <td className="p-3">{c.label}</td>
                    <td className="p-3 text-right font-mono">{formatFCFA(c.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-blue-50 font-bold">
                <tr><td colSpan={2} className="p-3">Total actif</td><td className="p-3 text-right font-mono">{formatFCFA(data?.totalActif ?? 0)}</td></tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-3 bg-amber-50 border-b font-bold">PASSIF & CAPITAUX PROPRES</div>
            <table className="w-full text-sm">
              <tbody>
                {data?.passifs.length === 0 && <tr><td className="p-4 text-muted-foreground italic">Aucun élément de passif</td></tr>}
                {data?.passifs.map((c) => (
                  <tr key={c.code} className="border-t">
                    <td className="p-3 font-mono w-20">{c.code}</td>
                    <td className="p-3">{c.label}</td>
                    <td className="p-3 text-right font-mono">{formatFCFA(c.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-amber-50 font-bold">
                <tr><td colSpan={2} className="p-3">Total passif</td><td className="p-3 text-right font-mono">{formatFCFA(data?.totalPassif ?? 0)}</td></tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      </div>
      {data && (
        <p className={`text-sm mt-4 text-center font-semibold ${Math.abs(data.totalActif - data.totalPassif) < 0.01 ? "text-emerald-600" : "text-amber-700"}`}>
          {Math.abs(data.totalActif - data.totalPassif) < 0.01
            ? "✓ Bilan équilibré"
            : `Écart Actif/Passif : ${formatFCFA(Math.abs(data.totalActif - data.totalPassif))}`}
        </p>
      )}
    </AccountingShell>
  );
}
