import React, { useState, useMemo } from "react";
import { useListTasks } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Search, Filter, CheckSquare, Clock, AlertCircle, List, LayoutGrid, Calendar as CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";

type ViewMode = "list" | "kanban" | "calendar";

const STATUS_COLUMNS: Array<{ key: string; label: string; cls: string }> = [
  { key: "todo", label: "À faire", cls: "bg-slate-50 border-slate-200" },
  { key: "in_progress", label: "En cours", cls: "bg-amber-50 border-amber-200" },
  { key: "review", label: "En revue", cls: "bg-blue-50 border-blue-200" },
  { key: "done", label: "Terminé", cls: "bg-green-50 border-green-200" },
];

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-slate-400",
  medium: "bg-blue-500",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};

export default function TasksList() {
  const { data, isLoading } = useListTasks();
  const [view, setView] = useState<ViewMode>("list");

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

  const tasks = data?.data || [];

  const calendarBuckets = useMemo(() => {
    const today = new Date();
    const buckets: Array<{ label: string; date: Date; tasks: any[] }> = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      buckets.push({
        label: d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" }),
        date: d,
        tasks: tasks.filter((t: any) => t.dueDate && t.dueDate.slice(0, 10) === key),
      });
    }
    return buckets;
  }, [tasks]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Tâches</h1>
          <p className="text-sm text-muted-foreground mt-1">Suivi opérationnel des interventions — vue liste, kanban ou calendrier</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm">
          <Plus className="w-4 h-4 mr-2" strokeWidth={3} />
          Nouvelle tâche
        </Button>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md">
              <button onClick={() => setView("list")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold ${view === "list" ? "bg-white shadow-sm text-foreground" : "text-slate-500"}`}>
                <List className="w-3.5 h-3.5" /> Liste
              </button>
              <button onClick={() => setView("kanban")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold ${view === "kanban" ? "bg-white shadow-sm text-foreground" : "text-slate-500"}`}>
                <LayoutGrid className="w-3.5 h-3.5" /> Kanban
              </button>
              <button onClick={() => setView("calendar")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold ${view === "calendar" ? "bg-white shadow-sm text-foreground" : "text-slate-500"}`}>
                <CalendarIcon className="w-3.5 h-3.5" /> Calendrier
              </button>
            </div>
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

        <CardContent className={view === "list" ? "p-0" : "p-6"}>
          {isLoading ? (
            <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
          ) : view === "list" ? (
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="font-semibold text-slate-600">Intitulé</TableHead>
                  <TableHead className="font-semibold text-slate-600">Chantier</TableHead>
                  <TableHead className="font-semibold text-slate-600">Affecté à</TableHead>
                  <TableHead className="font-semibold text-slate-600">Statut</TableHead>
                  <TableHead className="font-semibold text-slate-600">Priorité</TableHead>
                  <TableHead className="font-semibold text-slate-600">Échéance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <CheckSquare className="w-12 h-12 text-slate-300 mb-4" />
                        <p className="text-lg font-medium text-slate-600">Aucune tâche trouvée</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  tasks.map((task: any) => (
                    <TableRow key={task.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-bold text-slate-800">
                        <Link href={`/tasks/${task.id}`} className="hover:text-primary transition-colors">{task.title}</Link>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{task.projectName || "—"}</TableCell>
                      <TableCell className="text-sm">{task.assigneeName || "Non affecté"}</TableCell>
                      <TableCell>{getStatusBadge(task.status)}</TableCell>
                      <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                      <TableCell className="text-sm font-medium text-slate-600">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDate(task.dueDate)}</span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : view === "kanban" ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {STATUS_COLUMNS.map((col) => {
                const colTasks = tasks.filter((t: any) => t.status === col.key);
                return (
                  <div key={col.key} className={`rounded-md border ${col.cls} p-3 min-h-[400px]`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">{col.label}</h3>
                      <Badge variant="secondary" className="text-[10px]">{colTasks.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {colTasks.map((t: any) => (
                        <Link key={t.id} href={`/tasks/${t.id}`}>
                          <div className="bg-white border border-border rounded-md p-3 shadow-sm hover:shadow-md transition cursor-pointer">
                            <div className="flex items-start gap-2 mb-1.5">
                              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${PRIORITY_DOT[t.priority] || "bg-slate-300"}`} />
                              <div className="font-semibold text-sm flex-1 leading-snug">{t.title}</div>
                            </div>
                            <div className="text-xs text-muted-foreground ml-4">{t.projectName || "Sans chantier"}</div>
                            {t.dueDate && (
                              <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1 ml-4">
                                <Clock className="w-3 h-3" /> {formatDate(t.dueDate)}
                              </div>
                            )}
                            {t.assigneeName && (
                              <div className="text-[10px] mt-2 ml-4 inline-block bg-slate-100 px-2 py-0.5 rounded">{t.assigneeName}</div>
                            )}
                          </div>
                        </Link>
                      ))}
                      {colTasks.length === 0 && (
                        <div className="text-xs text-slate-400 text-center py-6">Aucune tâche</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              {calendarBuckets.map((b, i) => (
                <div key={i} className="border border-border rounded-md p-2 min-h-[120px] bg-white">
                  <div className="text-[10px] font-bold uppercase text-slate-500 mb-2 pb-1 border-b">{b.label}</div>
                  <div className="space-y-1.5">
                    {b.tasks.map((t: any) => (
                      <Link key={t.id} href={`/tasks/${t.id}`}>
                        <div className="text-xs bg-primary/10 text-primary border-l-2 border-primary px-2 py-1 rounded-sm hover:bg-primary/20 cursor-pointer truncate">
                          {t.title}
                        </div>
                      </Link>
                    ))}
                    {b.tasks.length === 0 && <div className="text-[10px] text-slate-300 text-center py-2">—</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
