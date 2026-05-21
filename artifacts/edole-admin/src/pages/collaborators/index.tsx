import React from "react";
import { useListCollaborators } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Search, Filter, UsersRound, Eye, MoreHorizontal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function CollaboratorsList() {
  const { data: collaborators, isLoading } = useListCollaborators();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Équipe Terrain</h1>
          <p className="text-sm text-muted-foreground mt-1">Effectifs et affectations</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm">
          <Plus className="w-4 h-4 mr-2" strokeWidth={3} />
          Ajouter un Collaborateur
        </Button>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg">Membres de l'équipe</CardTitle>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Rechercher par nom..." className="pl-9 bg-slate-50 focus-visible:ring-primary h-9" />
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
                  <TableHead className="font-semibold text-slate-600">Collaborateur</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold text-slate-600">Fonction</TableHead>
                  <TableHead className="hidden md:table-cell font-semibold text-slate-600">Département</TableHead>
                  <TableHead className="font-semibold text-slate-600">Disponibilité</TableHead>
                  <TableHead className="hidden sm:table-cell text-center font-semibold text-slate-600">Projets Actifs</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!collaborators?.data || collaborators.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <UsersRound className="w-12 h-12 text-slate-300 mb-4" />
                        <p className="text-lg font-medium text-slate-600">Aucun collaborateur trouvé</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  collaborators.data.map((collab) => (
                    <TableRow key={collab.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-9 h-9 border border-border">
                            <AvatarImage src={collab.avatarUrl} />
                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                              {collab.firstName[0]}{collab.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <Link href={`/collaborators/${collab.id}`} className="font-bold text-slate-800 hover:text-primary transition-colors">
                              {collab.firstName} {collab.lastName}
                            </Link>
                            <span className="text-xs text-muted-foreground">{collab.email || collab.phone || "—"}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell font-medium text-slate-700">{collab.position || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-slate-600">{collab.department || "—"}</TableCell>
                      <TableCell>
                        {collab.isAvailable ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-200">Disponible</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Affecté</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-center">
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold text-sm">
                          {collab.currentProjectsCount || 0}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                         <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 font-sans">
                            <Link href={`/collaborators/${collab.id}`}>
                              <DropdownMenuItem className="cursor-pointer">
                                <Eye className="mr-2 h-4 w-4" /> Profil Complet
                              </DropdownMenuItem>
                            </Link>
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