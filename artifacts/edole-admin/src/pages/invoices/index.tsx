import React from "react";
import { useListInvoices } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Search, Filter, FileText, Calendar, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFCFA, formatDate } from "@/lib/format";

export default function InvoicesList() {
  const { data, isLoading } = useListInvoices();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft": return <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300">Brouillon</Badge>;
      case "sent": return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Envoyée</Badge>;
      case "paid": return <Badge className="bg-green-600 text-white hover:bg-green-700">Payée</Badge>;
      case "overdue": return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-bold border-2">En retard</Badge>;
      case "cancelled": return <Badge variant="outline" className="bg-slate-50 text-slate-400 border-slate-200 line-through">Annulée</Badge>;
      default: return <Badge variant="outline">Inconnu</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Factures</h1>
          <p className="text-sm text-muted-foreground mt-1">Facturation client</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm">
          <Plus className="w-4 h-4 mr-2" strokeWidth={3} />
          Créer une Facture
        </Button>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg">Toutes les Factures</CardTitle>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="N° Facture, Client..." className="pl-9 bg-slate-50 focus-visible:ring-primary h-9" />
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
                  <TableHead className="font-semibold text-slate-600">Réf. Facture</TableHead>
                  <TableHead className="font-semibold text-slate-600">Client</TableHead>
                  <TableHead className="font-semibold text-slate-600">Échéance</TableHead>
                  <TableHead className="font-semibold text-slate-600">Statut</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">Montant Total</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">Reste à payer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data?.data || data.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <FileText className="w-12 h-12 text-slate-300 mb-4" />
                        <p className="text-lg font-medium text-slate-600">Aucune facture trouvée.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.data.map((invoice) => {
                    const isOverdue = invoice.status === 'overdue';
                    const remaining = (invoice.totalAmount || 0) - (invoice.paidAmount || 0);
                    
                    return (
                    <TableRow key={invoice.id} className={`hover:bg-slate-50/50 ${isOverdue ? 'bg-red-50/20' : ''}`}>
                      <TableCell className="font-mono text-sm font-bold text-slate-800">
                        {invoice.referenceNumber}
                      </TableCell>
                      <TableCell className="font-bold text-slate-800">{invoice.clientName || "—"}</TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-1.5 text-sm font-medium ${isOverdue ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                          {isOverdue ? <AlertCircle className="w-4 h-4" /> : <Calendar className="w-4 h-4 text-slate-400" />}
                          {formatDate(invoice.dueDate)}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell className="text-right font-bold text-slate-800 text-lg">
                        {formatFCFA(invoice.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {invoice.status === 'paid' ? (
                          <span className="text-green-600 font-bold">Soldé</span>
                        ) : (
                          <span className={`font-bold ${isOverdue ? 'text-red-600' : 'text-slate-600'}`}>
                            {formatFCFA(remaining)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}