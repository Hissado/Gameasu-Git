import React from "react";
import { useListClients } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Search, Filter, Building, Mail, Phone, MoreHorizontal, Eye, Edit } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function ClientsList() {
  const { data, isLoading } = useListClients();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-200">Actif</Badge>;
      case "inactive": return <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">Inactif</Badge>;
      case "prospect": return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">Prospect</Badge>;
      default: return <Badge variant="outline">Inconnu</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Annuaire Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">Clients et prospects</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm">
          <Plus className="w-4 h-4 mr-2" strokeWidth={3} />
          Nouveau Client
        </Button>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg">Liste des Entreprises</CardTitle>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Rechercher une entreprise..." className="pl-9 bg-slate-50 focus-visible:ring-primary h-9" />
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
            <div className="p-8 space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="font-semibold text-slate-600">Nom du Client</TableHead>
                  <TableHead className="font-semibold text-slate-600">Secteur / Industrie</TableHead>
                  <TableHead className="font-semibold text-slate-600">Coordonnées</TableHead>
                  <TableHead className="font-semibold text-slate-600">Statut</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data?.data || data.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <Building className="w-12 h-12 text-slate-300 mb-4" />
                        <p className="text-lg font-medium text-slate-600">Aucun client trouvé</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.data.map((client) => (
                    <TableRow key={client.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-bold text-slate-800">
                        <Link href={`/crm/clients/${client.id}`} className="hover:text-primary transition-colors flex items-center gap-2">
                          <div className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-xs text-slate-500 font-bold">
                            {client.name.substring(0, 2).toUpperCase()}
                          </div>
                          {client.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm font-medium text-slate-600">{client.industry || "—"}</TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <Mail className="w-3.5 h-3.5 text-slate-400" /> {client.email || "—"}
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <Phone className="w-3.5 h-3.5 text-slate-400" /> {client.phone || "—"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(client.status)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 font-sans">
                            <Link href={`/crm/clients/${client.id}`}>
                              <DropdownMenuItem className="cursor-pointer">
                                <Eye className="mr-2 h-4 w-4" /> Fiche 360°
                              </DropdownMenuItem>
                            </Link>
                            <DropdownMenuItem className="cursor-pointer">
                              <Edit className="mr-2 h-4 w-4" /> Modifier
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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