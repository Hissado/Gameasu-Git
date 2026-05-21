import React from "react";
import { useListInspections } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Filter, ClipboardCheck, Plus, AlertTriangle, CheckCircle2, GitCompare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { Link } from "wouter";

export default function InspectionsList() {
  const { data, isLoading } = useListInspections();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Inspections Techniques</h1>
          <p className="text-sm text-muted-foreground mt-1">États des lieux · Départ et retour</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm">
          <Plus className="w-4 h-4 mr-2" strokeWidth={3} />
          Nouvelle Inspection
        </Button>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg">Historique des contrôles</CardTitle>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Contrat, inspecteur..." className="pl-9 bg-slate-50 focus-visible:ring-primary h-9" />
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
                  <TableHead className="font-semibold text-slate-600">Contrat Lié</TableHead>
                  <TableHead className="font-semibold text-slate-600">Type de Contrôle</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold text-slate-600">Inspecteur</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold text-slate-600">Date d'inspection</TableHead>
                  <TableHead className="hidden md:table-cell font-semibold text-slate-600 text-center">Bilan Litige</TableHead>
                  <TableHead className="font-semibold text-slate-600 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data?.data || data.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <ClipboardCheck className="w-12 h-12 text-slate-300 mb-4" />
                        <p className="text-lg font-medium text-slate-600">Aucune inspection trouvée.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.data.map((inspection) => (
                    <TableRow key={inspection.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-mono font-bold text-slate-600 text-sm">
                        {inspection.rentalId.substring(0, 8).toUpperCase()}
                      </TableCell>
                      <TableCell>
                        {inspection.type === 'departure' ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">État des lieux Départ</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">État des lieux Retour</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell font-medium text-slate-800">{inspection.conductedByName || "—"}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-slate-600">{formatDate(inspection.createdAt)}</TableCell>
                      <TableCell className="hidden md:table-cell text-center">
                        {inspection.hasDispute ? (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 flex items-center justify-center gap-1 w-fit mx-auto">
                            <AlertTriangle className="w-3 h-3" /> Litige Signalé
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center justify-center gap-1 w-fit mx-auto">
                            <CheckCircle2 className="w-3 h-3" /> RAS
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/inspections/compare/${inspection.rentalId}`}>
                          <Button variant="outline" size="sm" className="h-8 text-xs">
                            <GitCompare className="w-3 h-3 mr-1.5" /> Comparer
                          </Button>
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