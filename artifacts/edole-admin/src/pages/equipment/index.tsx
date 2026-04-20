import React from "react";
import { useListEquipment, useGetEquipmentAvailability } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Search, Filter, Wrench, Settings, Truck, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFCFA } from "@/lib/format";

export default function EquipmentList() {
  const { data: availability, isLoading: isLoadingAvail } = useGetEquipmentAvailability();
  const { data: equipment, isLoading } = useListEquipment();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "available": return <Badge className="bg-green-100 text-green-800 border-green-200">Disponible</Badge>;
      case "rented": return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">En location</Badge>;
      case "maintenance": return <Badge variant="outline" className="bg-yellow-50 text-yellow-600 border-yellow-200">En maintenance</Badge>;
      case "retired": return <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300">Hors service</Badge>;
      default: return <Badge variant="outline">Inconnu</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Inventaire Matériel</h1>
          <p className="text-sm text-muted-foreground mt-1">Flotte d'équipements et machines</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm">
          <Plus className="w-4 h-4 mr-2" strokeWidth={3} />
          Ajouter du Matériel
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-sm border-l-4 border-l-slate-400">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Parc Total</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingAvail ? <Skeleton className="h-8 w-16" /> : (
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-slate-800">{availability?.totalItems || 0}</div>
                <Wrench className="w-5 h-5 text-slate-400" />
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Disponibles</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingAvail ? <Skeleton className="h-8 w-16" /> : (
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-green-600">{availability?.available || 0}</div>
                <div className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">Prêts</div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sur Chantiers</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingAvail ? <Skeleton className="h-8 w-16" /> : (
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-blue-600">{availability?.rented || 0}</div>
                <Truck className="w-5 h-5 text-blue-400" />
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-yellow-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">En Maintenance</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingAvail ? <Skeleton className="h-8 w-16" /> : (
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-yellow-600">{availability?.maintenance || 0}</div>
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg">Liste des Équipements</CardTitle>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Référence, nom..." className="pl-9 bg-slate-50 focus-visible:ring-primary h-9" />
              </div>
              <Button variant="outline" size="sm" className="h-9">
                <Settings className="w-4 h-4 mr-2" />
                Catégories
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
                  <TableHead className="font-semibold text-slate-600 w-24">Réf.</TableHead>
                  <TableHead className="font-semibold text-slate-600">Désignation</TableHead>
                  <TableHead className="font-semibold text-slate-600">Catégorie</TableHead>
                  <TableHead className="font-semibold text-slate-600">Statut</TableHead>
                  <TableHead className="font-semibold text-slate-600 text-center">Quantité</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">Taux Journalier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!equipment?.data || equipment.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      Aucun équipement dans l'inventaire.
                    </TableCell>
                  </TableRow>
                ) : (
                  equipment.data.map((item) => (
                    <TableRow key={item.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-mono text-xs font-bold text-slate-500 bg-slate-100/50">{item.code || "—"}</TableCell>
                      <TableCell className="font-bold text-slate-800">{item.name}</TableCell>
                      <TableCell className="text-sm font-medium text-slate-600">{item.categoryName || "—"}</TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell className="text-center font-bold">
                        <span className={item.availableQuantity === 0 ? "text-red-500" : "text-green-600"}>{item.availableQuantity}</span> 
                        <span className="text-slate-400 font-normal mx-1">/</span> 
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-700">
                        {formatFCFA(item.dailyRate)}
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