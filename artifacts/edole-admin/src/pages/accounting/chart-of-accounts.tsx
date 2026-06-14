import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { AccountingShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

type Acc = {
  id: string; code: string; label: string; classNum: number;
  type: string; normalBalance: string; isPostable: boolean;
};

const TYPE_LABELS: Record<string, string> = {
  asset:     "Actif",
  liability: "Passif",
  equity:    "Capitaux propres",
  revenue:   "Produit",
  expense:   "Charge",
};

const BALANCE_LABELS: Record<string, string> = {
  debit:  "Débit",
  credit: "Crédit",
};

const CLASS_LABELS: Record<number, string> = {
  1: "Capitaux et ressources durables",
  2: "Immobilisations",
  3: "Stocks et en-cours",
  4: "Comptes de tiers",
  5: "Comptes financiers",
  6: "Charges des activités ordinaires",
  7: "Produits des activités ordinaires",
};

export default function ChartOfAccounts() {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("");

  const { data, isLoading } = useQuery<{ data: Acc[] }>({
    queryKey: ["chart-of-accounts", search, classFilter],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (search) qs.set("search", search);
      if (classFilter) qs.set("classNum", classFilter);
      return apiFetch(`/api/accounting/chart-of-accounts?${qs}`);
    },
  });

  const grouped = (data?.data ?? []).reduce((acc, a) => {
    (acc[a.classNum] ??= []).push(a);
    return acc;
  }, {} as Record<number, Acc[]>);

  return (
    <AccountingShell title="Plan comptable SYSCOHADA" subtitle="Liste complète des comptes — Système Comptable Ouest-Africain">
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher par code ou libellé…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="border border-border rounded-md px-3 text-sm h-10">
          <option value="">Toutes les classes</option>
          {Object.entries(CLASS_LABELS).map(([n, l]) => <option key={n} value={n}>Classe {n} — {l}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Chargement…</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).sort(([a], [b]) => Number(a) - Number(b)).map(([cls, accs]) => (
            <Card key={cls}>
              <CardContent className="p-0">
                <div className="px-5 py-3 bg-amber-50 border-b border-border flex items-center justify-between">
                  <div className="font-bold">Classe {cls} — {CLASS_LABELS[Number(cls)]}</div>
                  <Badge variant="secondary">{accs.length} comptes</Badge>
                </div>
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground bg-slate-50">
                    <tr>
                      <th className="text-left px-5 py-2 w-32">Code</th>
                      <th className="text-left px-5 py-2">Libellé</th>
                      <th className="text-left px-5 py-2 w-32">Type</th>
                      <th className="text-left px-5 py-2 w-32">Sens normal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accs.map((a) => (
                      <tr key={a.id} className="border-t hover:bg-slate-50">
                        <td className="px-5 py-2 font-mono font-semibold">{a.code}</td>
                        <td className="px-5 py-2">
                          {a.label}
                          {!a.isPostable && <Badge variant="outline" className="ml-2 text-xs">Regroupement</Badge>}
                        </td>
                        <td className="px-5 py-2 text-xs">{TYPE_LABELS[a.type] ?? a.type}</td>
                        <td className="px-5 py-2 text-xs">{BALANCE_LABELS[a.normalBalance] ?? a.normalBalance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AccountingShell>
  );
}
