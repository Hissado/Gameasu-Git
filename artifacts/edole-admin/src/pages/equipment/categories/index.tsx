import React from "react";
import { useListEquipmentCategories } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, Settings2 } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

export default function EquipmentCategories() {
  const { data, isLoading } = useListEquipmentCategories();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/equipements">
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <ArrowLeft className="w-4 h-4" />
              Équipements
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Catégories Matériel</h1>
            <p className="text-sm text-muted-foreground mt-1">Classification de la flotte</p>
          </div>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm">
          <Plus className="w-4 h-4 mr-2" strokeWidth={3} />
          Ajouter une Catégorie
        </Button>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-4 border-b border-border/50">
          <CardTitle className="text-lg">Toutes les Catégories</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="font-semibold text-slate-600">Nom de la Catégorie</TableHead>
                  <TableHead className="font-semibold text-slate-600">Description</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">Nombre d'Équipements</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data || data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <Settings2 className="w-12 h-12 text-slate-300 mb-4" />
                        <p className="text-lg font-medium text-slate-600">Aucune catégorie définie.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((category) => (
                    <TableRow key={category.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-bold text-slate-800">{category.name}</TableCell>
                      <TableCell className="text-sm text-slate-600">{category.description || "—"}</TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        <span className="bg-primary/10 px-3 py-1 rounded-full">{category.equipmentCount || 0}</span>
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