import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { AccountingShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Bucket = { invoiceId: string; reference: string; clientName: string | null; dueDate: string | null; amount: number };

const BUCKET_LABELS: Record<string, string> = {
  current: "Non échu",
  d1_30: "1 - 30 jours",
  d31_60: "31 - 60 jours",
  d61_90: "61 - 90 jours",
  d90_plus: "+ 90 jours",
};
const BUCKET_COLORS: Record<string, string> = {
  current: "bg-emerald-100 text-emerald-800",
  d1_30: "bg-yellow-100 text-yellow-800",
  d31_60: "bg-amber-100 text-amber-900",
  d61_90: "bg-orange-100 text-orange-900",
  d90_plus: "bg-red-200 text-red-900",
};

export default function CustomersAgingPage() {
  const { data } = useQuery<{ buckets: Record<string, Bucket[]>; totals: Record<string, number>; total: number }>({
    queryKey: ["aging-customers"],
    queryFn: () => apiFetch("/api/accounting/aging/customers"),
  });

  return (
    <AccountingShell title="Comptes clients — Balance âgée" subtitle="Créances ouvertes regroupées par ancienneté de l'échéance">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {Object.keys(BUCKET_LABELS).map((k) => (
          <Card key={k}>
            <CardContent className="p-4">
              <div className={`inline-block text-xs font-bold px-2 py-1 rounded ${BUCKET_COLORS[k]}`}>{BUCKET_LABELS[k]}</div>
              <div className="text-xl font-bold mt-2">{formatFCFA(data?.totals[k] ?? 0)}</div>
              <div className="text-xs text-muted-foreground">{data?.buckets[k]?.length ?? 0} factures</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="px-5 py-3 border-b bg-slate-50 flex justify-between font-bold">
            <span>Total créances ouvertes</span>
            <span>{formatFCFA(data?.total ?? 0)}</span>
          </div>
          {Object.entries(BUCKET_LABELS).map(([k, label]) => {
            const items = data?.buckets[k] ?? [];
            if (items.length === 0) return null;
            return (
              <div key={k}>
                <div className={`px-5 py-2 text-xs font-bold uppercase ${BUCKET_COLORS[k]}`}>{label} — {items.length}</div>
                <table className="w-full text-sm">
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.invoiceId} className="border-t">
                        <td className="p-3 font-mono w-32">{it.reference}</td>
                        <td className="p-3">{it.clientName ?? "—"}</td>
                        <td className="p-3 text-xs text-muted-foreground">Échéance : {it.dueDate ?? "non définie"}</td>
                        <td className="p-3 text-right font-semibold">{formatFCFA(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </AccountingShell>
  );
}
