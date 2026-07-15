import React, { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListTasks, useCreateTask, useListProjects, useListUsers } from "@workspace/api-client-react";
import { usePermissions } from "@/lib/permissions";
import { ReadOnlyBanner } from "@/components/ui/read-only-banner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, CheckSquare, Clock, AlertCircle, List, LayoutGrid, Calendar as CalendarIcon } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api-error";
import { PageHeader, StatusTabs } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { useModuleTour, WelcomeModal, OnboardingTour, TOUR_PATHS } from "@/components/ui/onboarding-tour";

const TASKS_TOUR = [
  { target: "task-header", title: "Module Tâches", description: "Créez, assignez et suivez l'avancement de toutes vos tâches d'équipe et de projets." },
  { target: "task-views",  title: "3 vues disponibles", description: "Basculez entre Liste, Kanban et Calendrier selon votre façon de travailler." },
  { target: "task-search", title: "Filtres et recherche", description: "Filtrez par statut ou cherchez par titre pour retrouver n'importe quelle tâche instantanément." },
  { target: "task-table",  title: "Tableau de suivi", description: "Cliquez sur une tâche pour voir ses sous-tâches, commentaires, pièces jointes et son historique." },
];

type ViewMode = "list" | "kanban" | "calendar";

const STATUS_COLUMNS: Array<{ key: string; label: string; cls: string }> = [
  { key: "todo",        label: "À faire",   cls: "bg-slate-50 border-slate-200" },
  { key: "in_progress", label: "En cours",  cls: "bg-amber-50 border-amber-200" },
  { key: "review",      label: "En revue",  cls: "bg-blue-50 border-blue-200" },
  { key: "done",        label: "Terminé",   cls: "bg-green-50 border-green-200" },
];

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-slate-400", medium: "bg-blue-500", high: "bg-amber-500", urgent: "bg-red-500",
};

function getStatusBadge(status: string) {
  switch (status) {
    case "todo":        return <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">À faire</Badge>;
    case "in_progress": return <Badge className="bg-primary text-primary-foreground">En cours</Badge>;
    case "review":      return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">En révision</Badge>;
    case "done":        return <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">Terminé</Badge>;
    case "cancelled":   return <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">Annulé</Badge>;
    default:            return <Badge variant="outline">Inconnu</Badge>;
  }
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case "low":    return <span className="text-slate-500 text-xs font-medium px-2 py-1 bg-slate-100 rounded">Basse</span>;
    case "medium": return <span className="text-blue-600 text-xs font-medium px-2 py-1 bg-blue-50 rounded">Moyenne</span>;
    case "high":   return <span className="text-amber-700 text-xs font-medium px-2 py-1 bg-amber-50 rounded flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Haute</span>;
    case "urgent": return <span className="text-red-600 text-xs font-bold px-2 py-1 bg-red-50 rounded border border-red-200 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Urgente</span>;
    default:       return <span className="text-slate-500 text-xs font-medium">Normale</span>;
  }
}

// ── Create Task Dialog ─────────────────────────────────────────────────────────

const EMPTY_TASK = { title: "", description: "", status: "todo", priority: "medium", projectId: "", assigneeId: "", dueDate: "" };

function CreateTaskDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: projectsData } = useListProjects();
  const { data: usersData } = useListUsers();
  const [form, setForm] = useState(EMPTY_TASK);

  React.useEffect(() => { if (open) setForm(EMPTY_TASK); }, [open]);

  const createMut = useCreateTask({ mutation: {
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listTasks"] });
      toast.success("Tâche créée avec succès");
      onClose();
    },
    onError: (e: any) => toast.error(apiErrorMessage(e)),
  }});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      title: form.title.trim(),
      status: form.status,
      priority: form.priority,
      ...(form.description && { description: form.description }),
      ...(form.projectId && { projectId: form.projectId }),
      ...(form.assigneeId && { assigneeId: form.assigneeId }),
      ...(form.dueDate && { dueDate: form.dueDate }),
    };
    createMut.mutate({ data: payload });
  }

  const projects = (projectsData as any)?.data || [];
  const users = (usersData as any)?.data || [];

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle tâche</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Intitulé de la tâche *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex. Préparer le rapport mensuel" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priorité *</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Basse</SelectItem>
                  <SelectItem value="medium">Normale</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Statut</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">À faire</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="review">En révision</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Projet</Label>
              <Select value={form.projectId || "_none"} onValueChange={v => setForm(f => ({ ...f, projectId: v === "_none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Sans projet —</SelectItem>
                  {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Assigné à</Label>
              <Select value={form.assigneeId || "_none"} onValueChange={v => setForm(f => ({ ...f, assigneeId: v === "_none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Non assigné —</SelectItem>
                  {users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Échéance</Label>
            <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Contexte, objectifs…" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={!form.title.trim() || createMut.isPending}>
              {createMut.isPending ? "Création…" : "Créer la tâche"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function TasksList() {
  const { data, isLoading } = useListTasks();
  const [view, setView] = useState<ViewMode>("list");
  const perms = usePermissions();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);

  const allTasks = data?.data || [];

  const tasks = useMemo(() => {
    let result = allTasks;
    if (statusFilter !== "all") result = result.filter((t: any) => t.status === statusFilter);
    if (!search.trim()) return result;
    const q = search.toLowerCase();
    return result.filter((t: any) =>
      t.title?.toLowerCase().includes(q) ||
      t.projectName?.toLowerCase().includes(q) ||
      t.assigneeName?.toLowerCase().includes(q)
    );
  }, [allTasks, search, statusFilter]);

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

  const { showWelcome, tourActive, startTour, startTourWithPath, dismissWelcome, closeTour, selectedPathKey, handleTourStepChange, tourInitialStep, tourPathLabel } = useModuleTour("taches", !isLoading && allTasks.length === 0);
  const activeSteps = TOUR_PATHS["taches"]?.find(p => p.key === selectedPathKey)?.steps ?? TASKS_TOUR;

  return (
    <div data-tour="task-header" className="space-y-6 animate-in fade-in duration-500">
      <ReadOnlyBanner />
      {showWelcome && (
        <WelcomeModal
          title="Gestion des Tâches"
          subtitle="Planifiez, assignez et suivez toutes vos tâches d'équipe en un seul endroit."
          icon={CheckSquare}
          steps={activeSteps}
          paths={TOUR_PATHS["taches"]}
          onStartPath={startTourWithPath}
          onStart={startTour}
          onDismiss={dismissWelcome}
        />
      )}
      {tourActive && (
        <OnboardingTour
          steps={activeSteps}
          onClose={closeTour}
          pathLabel={tourPathLabel}
          initialStep={tourInitialStep}
          onStepChange={handleTourStepChange}
        />
      )}
      <PageHeader
        title="Tâches"
        subtitle={`${allTasks.length} tâche${allTasks.length !== 1 ? "s" : ""} au total`}
        icon={CheckSquare}
        actions={!perms.isReadOnly ? (
          <Button onClick={() => setShowCreate(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm">
            <Plus className="w-4 h-4 mr-2" strokeWidth={3} />
            Nouvelle tâche
          </Button>
        ) : undefined}
      />
      <StatusTabs
        tabs={[
          { key: "all",         label: "Toutes",      count: allTasks.length },
          { key: "todo",        label: "À faire",     count: allTasks.filter((t: any) => t.status === "todo").length },
          { key: "in_progress", label: "En cours",    count: allTasks.filter((t: any) => t.status === "in_progress").length },
          { key: "review",      label: "En révision", count: allTasks.filter((t: any) => t.status === "review").length },
          { key: "done",        label: "Terminées",   count: allTasks.filter((t: any) => t.status === "done").length },
        ]}
        active={statusFilter}
        onChange={setStatusFilter}
      />

      <Card className="shadow-sm border-border">
        <CardHeader data-tour="task-search" className="pb-4 border-b border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div data-tour="task-views" className="flex items-center gap-1 bg-slate-100 p-1 rounded-md">
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
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher une tâche…"
                className="pl-9 bg-slate-50 focus-visible:ring-primary h-9"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className={view === "list" ? "p-0 overflow-x-auto" : "p-6"}>
          {isLoading ? (
            <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
          ) : view === "list" ? (
            <Table data-tour="task-table">
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="font-semibold text-slate-600">Intitulé</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold text-slate-600">Projet</TableHead>
                  <TableHead className="hidden md:table-cell font-semibold text-slate-600">Affecté à</TableHead>
                  <TableHead className="font-semibold text-slate-600">Statut</TableHead>
                  <TableHead className="font-semibold text-slate-600">Priorité</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold text-slate-600">Échéance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon={CheckSquare}
                        title={search ? "Aucune tâche ne correspond à la recherche" : "Aucune tâche créée"}
                        description={!search ? "Créez et assignez des tâches pour suivre l'avancement de vos projets." : undefined}
                        actionLabel={!search && !perms.isReadOnly ? "Créer une tâche" : undefined}
                        onAction={!search && !perms.isReadOnly ? () => setShowCreate(true) : undefined}
                      />
                    </td>
                  </tr>
                ) : (
                  tasks.map((task: any) => (
                    <TableRow key={task.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-bold text-slate-800">
                        <Link href={`/tasks/${task.id}`} className="hover:text-primary transition-colors">{task.title}</Link>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm font-medium">{task.projectName || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{task.assigneeName || <span className="text-slate-400 italic">Non affecté</span>}</TableCell>
                      <TableCell>{getStatusBadge(task.status)}</TableCell>
                      <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm font-medium text-slate-600">
                        {task.dueDate
                          ? <span className={`flex items-center gap-1 ${new Date(task.dueDate) < new Date() && task.status !== "done" ? "text-red-600" : ""}`}>
                              <Clock className="w-3 h-3" /> {formatDate(task.dueDate)}
                            </span>
                          : <span className="text-slate-400 italic text-xs">—</span>
                        }
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
                            <div className="text-xs text-muted-foreground ml-4">{t.projectName || "Sans projet"}</div>
                            {t.dueDate && (
                              <div className={`text-xs mt-2 flex items-center gap-1 ml-4 ${new Date(t.dueDate) < new Date() ? "text-red-500" : "text-muted-foreground"}`}>
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
              {calendarBuckets.map((b, i) => {
                const isToday = i === 0;
                return (
                  <div key={i} className={`border rounded-md p-2 min-h-[120px] ${isToday ? "bg-primary/5 border-primary/30" : "bg-white border-border"}`}>
                    <div className={`text-[10px] font-bold uppercase mb-2 pb-1 border-b ${isToday ? "text-primary border-primary/20" : "text-slate-500"}`}>
                      {b.label}
                    </div>
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
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateTaskDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
