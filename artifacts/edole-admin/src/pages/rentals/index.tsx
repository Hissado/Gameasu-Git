import React from "react";
import { useListRentals } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Search, Filter, Truck, ArrowRight, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFCFA, formatDate } from "@/lib/format";

export default function RentalsList() {
  const { data, isLoading } = useListRentals();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-green-100 text-green-800 border-green-200">En cours</Badge>;
      case "pending": return <Badge variant="outline" className="bg-yellow-50 text-yellow-600 border-yellow-200">En attente</Badge>;
      case "confirmed": return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">Confirmé</Badge>;
      case "returned": return <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300">Retourné</Badge>;
      case "cancelled": return <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">Annulé</Badge>;
      default: return <Badge variant="outline">Inconnu</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Locations</h1>
          <p className="text-sm text-muted-foreground mt-1">Contrats de location d'équipements</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm">
          <Plus className="w-4 h-4 mr-2" strokeWidth={3} />
          Nouvelle Location
        </Button>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg">Tous les contrats</CardTitle>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Réf. contrat, client..." className="pl-9 bg-slate-50 focus-visible:ring-primary h-9" />
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
                  <TableHead className="font-semibold text-slate-600">Référence</TableHead>
                  <TableHead className="font-semibold text-slate-600">Client</TableHead>
                  <TableHead className="font-semibold text-slate-600">Statut</TableHead>
                  <TableHead className="font-semibold text-slate-600">Période de Location</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">Coût Total</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data?.data || data.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                       <div className="flex flex-col items-center justify-center">
                        <Truck className="w-12 h-12 text-slate-300 mb-4" />
                        <p className="text-lg font-medium text-slate-600">Aucun contrat de location.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.data.map((rental) => (
                    <TableRow key={rental.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-mono text-sm font-bold text-primary">
                        <Link href={`/rentals/${rental.id}`} className="hover:underline flex items-center gap-1.5">
                          <FileText className="w-4 h-4" /> {rental.referenceNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="font-bold text-slate-700">{rental.clientName || "—"}</TableCell>
                      <TableCell>{getStatusBadge(rental.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-100 w-fit px-2 py-1 rounded">
                          <span>{formatDate(rental.startDate)}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span>{formatDate(rental.endDate)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-800">
                        {formatFCFA(rental.totalCost)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/rentals/${rental.id}`}>
                          <Button variant="ghost" size="sm" className="font-semibold">Ouvrir</Button>
                        </Link>
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