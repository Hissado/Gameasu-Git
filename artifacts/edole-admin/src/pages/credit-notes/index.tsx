import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatFCFA } from "@/lib/format";
import { MinusCircle, Search, Building, FileText, CheckCircle2, Link2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";
import { Link } from "wouter";

type CreditNote = {
  id: string;
  referenceNumber: string;
  status: "issued" | "applied" | "cancelled";
  amount: number | null;
  appliedAmount: number | null;
  reason: string;
  notes: string | null;
  currency: string | null;
  createdAt: string;
  invoiceId: string | null;
  clientId: string | null;
  clientName: string | null;
  invoiceRef: string | null;
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  issued:    { label: "Émis",    cls: "bg-amber-50 text-amber-700 border-amber-200" },
  applied:   { label: "Appliqué", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { label: "Annulé",  cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

export default function CreditNotesList() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<{ data: CreditNote[]; total: number }>({
    queryKey: ["credit-notes"],
    queryFn: () => apiFetch("/api/credit-notes?limit=100"),
  });

  const notes = (data?.data ?? []).filter(cn =>
    !search
    || cn.referenceNumber.toLowerCase().includes(search.toLowerCase())
    || (cn.clientName ?? "").toLowerCase().includes(search.toLowerCase())
    || (cn.reason ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const applyMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/credit-notes/${id}/apply`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Note de crédit appliquée — le montant de la facture a été ajusté");
      qc.invalidateQueries({ queryKey: ["credit-notes"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur lors de l'application"),
  });

  const totalIssued = notes.filter(cn => cn.status === "issued").reduce((s, cn) => s + (cn.amount ?? 0), 0);
  const totalApplied = notes.filter(cn => cn.status === "applied").reduce((s, cn) => s + (cn.appliedAmount ?? 0), 0);

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <PageHeader
        title="Avoirs"
        subtitle="Notes de crédit et corrections sur factures émises"
        icon={MinusCircle}
        actions={
          <Link href="/factures">
            <button className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2563EB] border border-[#2563EB]/40 rounded-lg px-3 py-1.5 hover:bg-[#2563EB]/10 transition-colors">
              <Link2 className="w-3.5 h-3.5" />Créer un avoir depuis les Factures
            </button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total avoirs émis</div>
            <div className="text-xl font-bold text-amber-600">{formatFCFA(totalIssued)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{notes.filter(cn => cn.status === "issued").length} en attente</div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total appliqués</div>
            <div className="text-xl font-bold text-emerald-600">{formatFCFA(totalApplied)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{notes.filter(cn => cn.status === "applied").length} validés</div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total avoirs</div>
            <div className="text-xl font-bold">{notes.length}</div>
            <div className="text-xs text-muted-foreground mt-0.5">tous statuts</div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Émettez un avoir</div>
            <div className="text-xs text-muted-foreground mt-1">
              Via le bouton <strong>Avoir</strong> dans la page{" "}
              <Link href="/factures"><span className="text-[#2563EB] hover:underline cursor-pointer">Factures</span></Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-4 border-b">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg">Liste des avoirs</CardTitle>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="N° avoir, client, motif…" className="pl-9 h-9"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead>Réf. Avoir</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Facture d'origine</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Motif</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8">
                      <EmptyState
                        icon={MinusCircle}
                        title="Aucune note de crédit"
                        description="Les avoirs sont créés depuis la page Factures via le bouton « Avoir »."
                      />
                    </TableCell>
                  </TableRow>
                ) : notes.map(cn => {
                  const st = STATUS_MAP[cn.status] ?? { label: cn.status, cls: "bg-slate-100 text-slate-600 border-slate-200" };
                  return (
                    <TableRow key={cn.id} className={`hover:bg-slate-50/50 ${cn.status === "cancelled" ? "opacity-60" : ""}`}>
                      <TableCell className="font-mono text-sm font-bold">{cn.referenceNumber}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium text-sm">{cn.clientName ?? "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {cn.invoiceRef ? (
                          <Link href="/factures">
                            <span className="font-mono text-xs text-blue-600 hover:underline cursor-pointer flex items-center gap-1">
                              <FileText className="w-3 h-3" />{cn.invoiceRef}
                            </span>
                          </Link>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(cn.createdAt)}</TableCell>
                      <TableCell className="text-sm max-w-[200px]">
                        <span className="truncate block" title={cn.reason}>{cn.reason}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${st.cls}`}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-amber-700">
                        − {formatFCFA(cn.amount ?? 0)}
                      </TableCell>
                      <TableCell>
                        {cn.status === "issued" && (
                          <Button size="sm"
                            className="h-7 text-xs gap-0.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                            disabled={applyMutation.isPending}
                            onClick={() => applyMutation.mutate(cn.id)}>
                            <CheckCircle2 className="w-3 h-3" /> Appliquer
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
