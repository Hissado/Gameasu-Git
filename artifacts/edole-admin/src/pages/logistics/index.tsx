import React from "react";
import { useListLogisticsOperations } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Search, Filter, Truck, Calendar, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";

export default function LogisticsList() {
  const { data, isLoading } = useListLogisticsOperations();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled": return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Planifié</Badge>;
      case "in_transit": return <Badge className="bg-blue-600 text-white hover:bg-blue-700">En transit</Badge>;
      case "completed": return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Terminé</Badge>;
      case "cancelled": return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Annulé</Badge>;
      default: return <Badge variant="outline">Inconnu</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch(type) {
      case "delivery": return <span className="font-bold text-sm text-primary flex items-center"><Truck className="w-4 h-4 mr-1.5" /> Livraison</span>;
      case "pickup": return <span className="font-bold text-sm text-indigo-600 flex items-center"><Truck className="w-4 h-4 mr-1.5" style={{transform: "scaleX(-1)"}} /> Enlèvement</span>;
      default: return <span className="font-bold text-sm text-slate-600">{type}</span>;
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Opérations Logistiques</h1>
          <p className="text-sm text-muted-foreground mt-1">Livraisons et enlèvements d'équipements</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm">
          <Plus className="w-4 h-4 mr-2" strokeWidth={3} />
          Planifier un transport
        </Button>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg">Feuille de Route</CardTitle>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Adresse, responsable..." className="pl-9 bg-slate-50 focus-visible:ring-primary h-9" />
              </div>
              <Button variant="outline" size="sm" className="h-9">
                <Filter className="w-4 h-4 mr-2" />
                Filtres
              </Button>
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
                  <TableHead className="font-semibold text-slate-600">Type de Transport</TableHead>
                  <TableHead className="font-semibold text-slate-600">Statut</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold text-slate-600">Responsable / Chauffeur</TableHead>
                  <TableHead className="hidden md:table-cell font-semibold text-slate-600">Adresse / Projet</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold text-slate-600 text-right">Date Prévue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data?.data || data.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <Truck className="w-12 h-12 text-slate-300 mb-4" />
                        <p className="text-lg font-medium text-slate-600">Aucune opération planifiée.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.data.map((op) => (
                    <TableRow key={op.id} className="hover:bg-slate-50/50">
                      <TableCell>{getTypeBadge(op.type)}</TableCell>
                      <TableCell>{getStatusBadge(op.status)}</TableCell>
                      <TableCell className="hidden sm:table-cell font-medium text-slate-800">{op.responsibleName || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell max-w-[250px]">
                        <div className="flex items-start gap-1.5 text-sm">
                          <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                          <span className="truncate text-slate-700" title={op.address}>{op.address || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-right">
                         <div className="flex items-center justify-end gap-1.5 text-sm font-medium text-slate-600">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          {op.scheduledAt ? formatDate(op.scheduledAt) : "—"}
                        </div>
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