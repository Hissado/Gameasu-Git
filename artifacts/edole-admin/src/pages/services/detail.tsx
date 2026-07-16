import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { priorityLabel } from "@/lib/intelligence";
import { Briefcase, Plus, Repeat, ChevronLeft, CircleDot, CheckCircle2, Clock, AlertCircle, Layers, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Section = { id: string; name: string; position: number };
type Task = {
  id: string; title: string; description?: string;
  status: string; priority: string;
  serviceId?: string; sectionId?: string | null; parentTaskId?: string | null;
  assigneeId?: string | null; dueDate?: string | null;
};
type Engagement = {
  id: string; name: string; description?: string; status: string; isRecurring: boolean;
  recurrencePattern?: any; client?: { id: string; name: string };
  startDate?: string; endDate?: string;
  sections: Section[]; tasks: Task[];
};

const STATUS_ICON: Record<string, any> = {
  todo: CircleDot, in_progress: Clock, review: AlertCircle, done: CheckCircle2,
};
const STATUS_LABEL: Record<string, string> = {
  todo: "À faire", in_progress: "En cours", review: "À valider", done: "Terminée",
};
const PRIORITY_COLOR: Record<string, string> = {
  low: "bg-muted text-foreground",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};

export default function ServiceDetail() {
  const [, params] = useRoute("/services/:id");
  const id = params?.id;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [secOpen, setSecOpen] = useState(false);
  const [secName, setSecName] = useState("");
  const [taskOpen, setTaskOpen] = useState<{ open: boolean; sectionId?: string | null; parentId?: string | null }>({ open: false });
  const [taskForm, setTaskForm] = useState<any>({ title: "", priority: "medium", status: "todo", dueDate: "" });

  const { data: eng, isLoading } = useQuery<Engagement>({
    queryKey: ["engagement", id],
    queryFn: () => apiFetch(`/api/engagements/${id}`),
    enabled: !!id,
  });

  const addSection = useMutation({
    mutationFn: () => apiFetch(`/api/engagements/${id}/sections`, { method: "POST", body: { name: secName } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["engagement", id] }); setSecOpen(false); setSecName(""); toast({ title: "Section ajoutée" }); },
  });
  const delSection = useMutation({
    mutationFn: (sid: string) => apiFetch(`/api/sections/${sid}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["engagement", id] }); toast({ title: "Section supprimée" }); },
  });
  const addTask = useMutation({
    mutationFn: () => apiFetch(`/api/engagements/${id}/tasks`, {
      method: "POST",
      body: {
        title: taskForm.title,
        priority: taskForm.priority,
        status: taskForm.status,
        sectionId: taskOpen.sectionId || null,
        parentTaskId: taskOpen.parentId || null,
        dueDate: taskForm.dueDate || null,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["engagement", id] });
      setTaskOpen({ open: false });
      setTaskForm({ title: "", priority: "medium", status: "todo", dueDate: "" });
      toast({ title: "Tâche ajoutée" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });
  const updTask = useMutation({
    mutationFn: ({ tid, patch }: { tid: string; patch: any }) => apiFetch(`/api/tasks/${tid}`, { method: "PUT", body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["engagement", id] }),
  });

  if (isLoading) return <div className="text-center text-muted-foreground py-12">Chargement…</div>;
  if (!eng) return <div className="text-center text-muted-foreground py-12">Engagement introuvable.</div>;

  const sections = eng.sections;
  const allTasks = eng.tasks;
  const tasksBySection = (sid: string | null) => allTasks.filter(t => (t.sectionId ?? null) === sid && !t.parentTaskId);
  const subtasksOf = (tid: string) => allTasks.filter(t => t.parentTaskId === tid);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/services" className="hover:text-foreground inline-flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> Services
        </Link>
        {eng.client && (<><span>/</span><Link href={`/clients/${eng.client.id}`} className="hover:text-foreground">{eng.client.name}</Link></>)}
      </div>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Briefcase className="w-7 h-7 text-primary" /> {eng.name}
          </h1>
          <div className="flex flex-wrap gap-2 mt-2">
            {eng.isRecurring && (
              <Badge variant="secondary" className="gap-1"><Repeat className="w-3 h-3" />{eng.recurrencePattern?.frequency}</Badge>
            )}
            <Badge variant={eng.status === "active" ? "default" : "outline"}>{eng.status}</Badge>
            {eng.startDate && <Badge variant="outline">Début : {eng.startDate}</Badge>}
            {eng.endDate && <Badge variant="outline">Fin : {eng.endDate}</Badge>}
          </div>
          {eng.description && <p className="text-muted-foreground mt-2 max-w-2xl">{eng.description}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSecOpen(true)}><Layers className="w-4 h-4 mr-2" />Section</Button>
          <Button onClick={() => setTaskOpen({ open: true, sectionId: null })}><Plus className="w-4 h-4 mr-2" />Tâche</Button>
        </div>
      </div>

      {/* Tâches sans section */}
      {tasksBySection(null).length > 0 && (
        <SectionBlock
          title="Sans section"
          tasks={tasksBySection(null)}
          subtasksOf={subtasksOf}
          onAddTask={() => setTaskOpen({ open: true, sectionId: null })}
          onAddSubtask={(pid) => setTaskOpen({ open: true, parentId: pid })}
          onStatusChange={(tid, status) => updTask.mutate({ tid, patch: { status } })}
        />
      )}

      {sections.map(sec => (
        <SectionBlock
          key={sec.id}
          title={sec.name}
          tasks={tasksBySection(sec.id)}
          subtasksOf={subtasksOf}
          onAddTask={() => setTaskOpen({ open: true, sectionId: sec.id })}
          onAddSubtask={(pid) => setTaskOpen({ open: true, parentId: pid, sectionId: sec.id })}
          onStatusChange={(tid, status) => updTask.mutate({ tid, patch: { status } })}
          onDelete={() => { if (confirm(`Supprimer la section « ${sec.name} » ? Les tâches seront détachées.`)) delSection.mutate(sec.id); }}
        />
      ))}

      {sections.length === 0 && tasksBySection(null).length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Aucune section ni tâche pour l'instant.</p>
          <p className="text-sm mt-1">Ajoutez une section pour structurer le travail, ou créez directement une tâche.</p>
        </CardContent></Card>
      )}

      {/* Dialog section */}
      <Dialog open={secOpen} onOpenChange={setSecOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle section</DialogTitle></DialogHeader>
          <Input value={secName} onChange={(e) => setSecName(e.target.value)} placeholder="ex. Inspection mensuelle" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSecOpen(false)}>Annuler</Button>
            <Button onClick={() => addSection.mutate()} disabled={!secName || addSection.isPending}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog tâche */}
      <Dialog open={taskOpen.open} onOpenChange={(o) => setTaskOpen({ ...taskOpen, open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{taskOpen.parentId ? "Nouvelle sous-tâche" : "Nouvelle tâche"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Titre *</label>
              <Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Priorité</label>
                <Select value={taskForm.priority} onValueChange={(v) => setTaskForm({ ...taskForm, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Faible</SelectItem>
                    <SelectItem value="medium">Moyenne</SelectItem>
                    <SelectItem value="high">Haute</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Échéance</label>
                <Input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskOpen({ open: false })}>Annuler</Button>
            <Button onClick={() => addTask.mutate()} disabled={!taskForm.title || addTask.isPending}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SectionBlock({
  title, tasks, subtasksOf, onAddTask, onAddSubtask, onStatusChange, onDelete,
}: {
  title: string; tasks: Task[];
  subtasksOf: (tid: string) => Task[];
  onAddTask: () => void;
  onAddSubtask: (parentId: string) => void;
  onStatusChange: (tid: string, status: string) => void;
  onDelete?: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold">{title}</h3>
            <Badge variant="outline" className="text-xs">{tasks.length}</Badge>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={onAddTask}><Plus className="w-4 h-4" /></Button>
            {onDelete && <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
          </div>
        </div>
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Aucune tâche</p>
        ) : (
          <ul className="space-y-1">
            {tasks.map(t => <TaskRow key={t.id} task={t} subtasks={subtasksOf(t.id)} onAddSubtask={() => onAddSubtask(t.id)} onStatusChange={(s) => onStatusChange(t.id, s)} subtasksOf={subtasksOf} />)}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function TaskRow({ task, subtasks, onAddSubtask, onStatusChange, subtasksOf, depth = 0 }: {
  task: Task; subtasks: Task[];
  onAddSubtask: () => void;
  onStatusChange: (s: string) => void;
  subtasksOf: (tid: string) => Task[];
  depth?: number;
}) {
  const Icon = STATUS_ICON[task.status] || CircleDot;
  return (
    <li>
      <div className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 group" style={{ paddingLeft: `${depth * 20 + 8}px` }}>
        <button
          onClick={() => onStatusChange(task.status === "done" ? "todo" : "done")}
          className="text-muted-foreground hover:text-primary"
          title={STATUS_LABEL[task.status]}
        >
          <Icon className={`w-4 h-4 ${task.status === "done" ? "text-emerald-600" : ""}`} />
        </button>
        <span className={`flex-1 text-sm ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>{task.title}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${PRIORITY_COLOR[task.priority] || ""}`}>{priorityLabel(task.priority)}</span>
        {task.dueDate && <span className="text-xs text-muted-foreground">{task.dueDate}</span>}
        {depth < 2 && (
          <button onClick={onAddSubtask} className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-primary hover:underline">
            + sous-tâche
          </button>
        )}
      </div>
      {subtasks.length > 0 && (
        <ul>
          {subtasks.map(s => <TaskRow key={s.id} task={s} subtasks={subtasksOf(s.id)} onAddSubtask={() => {}} onStatusChange={onStatusChange} subtasksOf={subtasksOf} depth={depth + 1} />)}
        </ul>
      )}
    </li>
  );
}
