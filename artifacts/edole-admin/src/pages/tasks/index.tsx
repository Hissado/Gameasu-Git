import React from "react";
import { useListTasks } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Search, Filter, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";

export default function TasksList() {
  const { data, isLoading } = useListTasks();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "todo": return <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">À faire</Badge>;
      case "in_progress": return <Badge className="bg-primary text-primary-foreground">En cours</Badge>;
      case "review": return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">En révision</Badge>;
      case "done": return <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">Terminé</Badge>;
      case "cancelled": return <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">Annulé</Badge>;
      default: return <Badge variant="outline">Inconnu</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "low": return <span className="text-slate-500 text-xs font-medium px-2 py-1 bg-slate-100 rounded">Basse</span>;
      case "medium": return <span className="text-blue-600 text-xs font-medium px-2 py-1 bg-blue-50 rounded">Moyenne</span>;
      case "high": return <span className="text-orange-600 text-xs font-medium px-2 py-1 bg-orange-50 rounded flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Haute</span>;
      case "urgent": return <span className="text-red-600 text-xs font-bold px-2 py-1 bg-red-50 rounded border border-red-200 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Urgente</span>;
      default: return <span className="text-slate-500 text-xs font-medium">Normale</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Tâches</h1>
          <p className="text-sm text-muted-foreground mt-1">Suivi opérationnel des interventions</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm">
          <Plus className="w-4 h-4 mr-2" strokeWidth={3} />
          Nouvelle Tâche
        </Button>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg">Toutes les Tâches</CardTitle>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Rechercher une tâche..." className="pl-9 bg-slate-50 focus-visible:ring-primary h-9" />
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
                  <TableHead className="font-semibold text-slate-600">Intitulé de la Tâche</TableHead>
                  <TableHead className="font-semibold text-slate-600">Chantier Associé</TableHead>
                  <TableHead className="font-semibold text-slate-600">Affecté à</TableHead>
                  <TableHead className="font-semibold text-slate-600">Statut</TableHead>
                  <TableHead className="font-semibold text-slate-600">Priorité</TableHead>
                  <TableHead className="font-semibold text-slate-600">Échéance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data?.data || data.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <CheckSquare className="w-12 h-12 text-slate-300 mb-4" />
                        <p className="text-lg font-medium text-slate-600">Aucune tâche trouvée</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.data.map((task) => (
                    <TableRow key={task.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-bold text-slate-800">
                        <Link href={`/tasks/${task.id}`} className="hover:text-primary transition-colors">
                          {task.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{task.projectName || "—"}</TableCell>
                      <TableCell className="text-sm">{task.assigneeName || "Non affecté"}</TableCell>
                      <TableCell>{getStatusBadge(task.status)}</TableCell>
                      <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                      <TableCell className="text-sm font-medium text-slate-600">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {formatDate(task.dueDate)}
                        </span>
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