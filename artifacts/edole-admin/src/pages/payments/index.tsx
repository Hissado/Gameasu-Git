import React from "react";
import { useListPayments } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Search, Filter, CreditCard, Calendar, Building, Landmark, Smartphone, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFCFA, formatDate } from "@/lib/format";

export default function PaymentsList() {
  const { data, isLoading } = useListPayments();

  const getMethodBadge = (method: string) => {
    switch (method) {
      case "bank_transfer": return <span className="flex items-center gap-1.5 text-slate-600 text-sm font-medium"><Landmark className="w-4 h-4 text-slate-400" /> Virement Bancaire</span>;
      case "cash": return <span className="flex items-center gap-1.5 text-slate-600 text-sm font-medium"><CreditCard className="w-4 h-4 text-slate-400" /> Espèces</span>;
      case "mobile_money": return <span className="flex items-center gap-1.5 text-amber-700 text-sm font-bold"><Smartphone className="w-4 h-4 text-amber-400" /> Mobile Money</span>;
      case "check": return <span className="flex items-center gap-1.5 text-slate-600 text-sm font-medium"><FileText className="w-4 h-4 text-slate-400" /> Chèque</span>;
      default: return <span className="flex items-center gap-1.5 text-slate-600 text-sm font-medium">Autre</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Encaissements</h1>
          <p className="text-sm text-muted-foreground mt-1">Encaissements clients</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm">
          <Plus className="w-4 h-4 mr-2" strokeWidth={3} />
          Saisir un Encaissement
        </Button>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg">Journal des Paiements</CardTitle>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="N° Facture, Référence..." className="pl-9 bg-slate-50 focus-visible:ring-primary h-9" />
              </div>
              <Button variant="outline" size="sm" className="h-9">
                <Filter className="w-4 h-4 mr-2" />
                Filtres
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="font-semibold text-slate-600">Date</TableHead>
                  <TableHead className="font-semibold text-slate-600">N° Facture Liée</TableHead>
                  <TableHead className="font-semibold text-slate-600">Moyen de Paiement</TableHead>
                  <TableHead className="font-semibold text-slate-600">Réf. Transaction</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">Montant Encaissé</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data?.data || data.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <CreditCard className="w-12 h-12 text-slate-300 mb-4" />
                        <p className="text-lg font-medium text-slate-600">Aucun paiement enregistré.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.data.map((payment) => (
                    <TableRow key={payment.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          {formatDate(payment.paidAt || payment.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 font-mono text-xs hover:bg-blue-100 cursor-pointer">
                          {payment.invoiceId.substring(0, 8).toUpperCase()}...
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getMethodBadge(payment.method)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">
                        {payment.reference || "—"}
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600 text-lg">
                        + {formatFCFA(payment.amount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}