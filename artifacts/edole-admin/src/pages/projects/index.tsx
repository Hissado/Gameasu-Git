import React from "react";
import { useListProjects } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Search, Filter, MoreHorizontal, Eye, Edit, Trash2, FolderKanban } from "lucide-react";
import { Link } from "wouter";
import { formatFCFA, formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function ProjectsList() {
  const { data, isLoading } = useListProjects();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-primary text-primary-foreground hover:bg-primary/80">En cours</Badge>;
      case "planning": return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">Planifié</Badge>;
      case "on_hold": return <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">En attente</Badge>;
      case "completed": return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Terminé</Badge>;
      case "cancelled": return <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">Annulé</Badge>;
      default: return <Badge variant="outline">Inconnu</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Projets</h1>
          <p className="text-sm text-muted-foreground mt-1">Portefeuille de projets</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm">
          <Plus className="w-4 h-4 mr-2" strokeWidth={3} />
          Nouveau Projet
        </Button>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg">Liste des Projets</CardTitle>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Rechercher un projet..." className="pl-9 bg-slate-50 focus-visible:ring-primary h-9" />
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
            <div className="p-8 space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="font-semibold text-slate-600">Nom du Projet</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold text-slate-600">Client / Institution</TableHead>
                  <TableHead className="font-semibold text-slate-600">Statut</TableHead>
                  <TableHead className="hidden md:table-cell font-semibold text-slate-600">Progression</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold text-slate-600">Budget Alloué</TableHead>
                  <TableHead className="hidden lg:table-cell font-semibold text-slate-600">Directeur</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data?.data || data.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <FolderKanban className="w-12 h-12 text-slate-300 mb-4" />
                        <p className="text-lg font-medium text-slate-600">Aucun projet trouvé</p>
                        <p className="text-sm">Commencez par créer un nouveau projet.</p>
                        <Button variant="outline" className="mt-4 border-primary text-primary hover:bg-primary/5">
                          <Plus className="w-4 h-4 mr-2" /> Créer un projet
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.data.map((project) => (
                    <TableRow key={project.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-bold text-slate-800">
                        <Link href={`/projects/${project.id}`} className="hover:text-primary transition-colors">
                          {project.name}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm font-medium">{project.clientName || "—"}</TableCell>
                      <TableCell>{getStatusBadge(project.status)}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-col gap-1.5 w-32">
                          <div className="flex justify-between text-xs">
                            <span className="font-medium text-slate-600">{project.progress || 0}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                            <div 
                              className={`h-full ${project.progress === 100 ? 'bg-green-500' : 'bg-primary'}`} 
                              style={{ width: `${project.progress || 0}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell font-medium">{formatFCFA(project.budget)}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">{project.managerName || "—"}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 font-sans">
                            <Link href={`/projects/${project.id}`}>
                              <DropdownMenuItem className="cursor-pointer">
                                <Eye className="mr-2 h-4 w-4" /> Voir les détails
                              </DropdownMenuItem>
                            </Link>
                            <DropdownMenuItem className="cursor-pointer">
                              <Edit className="mr-2 h-4 w-4" /> Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" /> Supprimer
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