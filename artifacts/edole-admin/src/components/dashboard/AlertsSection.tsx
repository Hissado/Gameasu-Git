import React from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Banknote, CheckCircle2, ChevronRight, FileText } from "lucide-react";
import { formatFCFA } from "@/lib/format";

function shortDateFr(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

interface Props {
  overdueInvoices: any[];
  outstanding: number;
}

export function AlertsSection({ overdueInvoices, outstanding }: Props) {
  return (
    <section data-tour="dash-alerts">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Alertes prioritaires</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Actions financières urgentes</p>
        </div>
        <Button variant="ghost" size="sm" className="text-xs" asChild>
          <Link href="/factures">Voir tout <ChevronRight className="w-3.5 h-3.5 ml-0.5" /></Link>
        </Button>
      </div>
      <div className="mt-3 space-y-2">
        {outstanding > 0 && (
          <Link href="/factures" className="flex items-center gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0"><Banknote className="w-4 h-4 text-amber-700" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900">Créances à encaisser</p>
              <p className="text-xs text-slate-600">{formatFCFA(outstanding)} en attente</p>
            </div>
            <ArrowRight className="w-4 h-4 text-amber-600 shrink-0" />
          </Link>
        )}
        {overdueInvoices.length === 0 && outstanding === 0 && (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-800 font-medium">Aucune alerte financière — tout est à jour.</p>
          </div>
        )}
        {overdueInvoices.map((inv: any) => (
          <Link key={inv.id} href="/factures"
            className="flex items-center gap-3 p-3 rounded-lg border border-rose-200 bg-rose-50/70 hover:bg-rose-50 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center shrink-0"><FileText className="w-4 h-4 text-rose-600" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">Facture {inv.invoiceNumber || inv.number || `#${(inv.id || "").slice(0, 6)}`}</p>
              <p className="text-xs text-slate-600 truncate">{formatFCFA(Number(inv.totalAmount || 0))} · {inv.clientName || "Client"} · échue le {shortDateFr(inv.dueDate)}</p>
            </div>
            <Badge variant="destructive" className="text-[10px] shrink-0">Retard</Badge>
          </Link>
        ))}
      </div>
    </section>
  );
}
