import React, { useState, useMemo, useRef } from "react";
import { useGetTask, useUpdateTask, getGetTaskQueryKey } from "@workspace/api-client-react";
import { useRoute, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import {
  ArrowLeft, History, ListTree, MessageSquare, Send, RotateCcw, Timer,
  Play, Square, Clock, CheckCircle2, AlertCircle, Plus,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  todo:        { label: "À faire",   cls: "bg-muted text-muted-foreground border-border" },
  in_progress: { label: "En cours",  cls: "bg-amber-50 text-amber-700 border-amber-200" },
  review:      { label: "En revue",  cls: "bg-blue-50 text-blue-700 border-blue-200" },
  done:        { label: "Terminée",  cls: "bg-green-50 text-green-700 border-green-200" },
  blocked:     { label: "Bloquée",   cls: "bg-red-50 text-red-700 border-red-200" },
};

const PRIORITY_LABEL: Record<string, { label: string; cls: string; dot: string }> = {
  low:    { label: "Faible",   cls: "bg-muted text-muted-foreground",              dot: "bg-slate-400" },
  medium: { label: "Moyenne",  cls: "bg-blue-50 text-blue-700 border-blue-200",    dot: "bg-blue-500" },
  high:   { label: "Haute",    cls: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  urgent: { label: "Urgente",  cls: "bg-red-50 text-red-700 border-red-200",       dot: "bg-red-500" },
};

const ACTION_LABEL: Record<string, string> = {
  created: "Création", updated: "Mise à jour", deleted: "Suppression", commented: "Commentaire",
};

const FIELD_LABEL: Record<string, string> = {
  status: "Statut", priority: "Priorité", assigneeId: "Affectation",
  title: "Intitulé", description: "Description", dueDate: "Échéance",
};

const RECURRENCE_OPTIONS = [
  { value: "none", label: "Aucune récurrence" },
  { value: "daily", label: "Quotidien" },
  { value: "weekly", label: "Hebdomadaire" },
  { value: "biweekly", label: "Toutes les 2 semaines" },
  { value: "monthly", label: "Mensuel" },
  { value: "quarterly", label: "Trimestriel" },
];

// ── Timer hook ────────────────────────────────────────────────────────────────

function useTaskTimer() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(0);

  const start = () => {
    if (running) return;
    startRef.current = Date.now() - elapsed * 1000;
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
  };

  const stop = () => {
    if (!running) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
  };

  const reset = () => {
    stop();
    setElapsed(0);
  };

  const formatted = useMemo(() => {
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    return [h, m, s].map(v => String(v).padStart(2, "0")).join(":");
  }, [elapsed]);

  return { running, elapsed, formatted, start, stop, reset };
}

// ── @Mention textarea ─────────────────────────────────────────────────────────

function MentionTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [caretPos, setCaretPos] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const DEMO_USERS = [
    "Jacques Mballa", "Aissatou Bah", "Kofi Asante", "Marie Nguema",
    "Fatou Diallo", "Amadou Traoré", "Cécile Akossou",
  ];

  const filteredUsers = useMemo(
    () => DEMO_USERS.filter(u => u.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5),
    [mentionQuery]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart ?? 0;
    onChange(val);
    setCaretPos(pos);

    const textBefore = val.slice(0, pos);
    const mentionMatch = textBefore.match(/@(\w*)$/);
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setShowMentions(true);
    } else {
      setShowMentions(false);
      setMentionQuery("");
    }
  };

  const insertMention = (userName: string) => {
    const textBefore = value.slice(0, caretPos);
    const textAfter = value.slice(caretPos);
    const mentionMatch = textBefore.match(/@(\w*)$/);
    const start = mentionMatch ? textBefore.length - mentionMatch[0].length : caretPos;
    const newValue = value.slice(0, start) + `@${userName} ` + textAfter;
    onChange(newValue);
    setShowMentions(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        rows={rows}
        className="resize-none text-sm"
      />
      {showMentions && filteredUsers.length > 0 && (
        <div className="absolute left-0 z-50 mt-1 w-56 bg-white rounded-lg border border-border shadow-lg overflow-hidden">
          <div className="px-3 py-1.5 text-[10px] text-muted-foreground font-semibold uppercase border-b border-border">
            Mentionner un membre
          </div>
          {filteredUsers.map(user => (
            <button
              key={user}
              onMouseDown={e => { e.preventDefault(); insertMention(user); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-primary/5 flex items-center gap-2 transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                {user.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
              {user}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SubtasksChecklist ─────────────────────────────────────────────────────────

function SubtasksChecklist({ subtasks }: { subtasks: any[] }) {
  const [checked, setChecked] = useState<Record<string, boolean>>(
    () => Object.fromEntries(subtasks.map(s => [s.id, s.status === "done"]))
  );

  const doneCount = Object.values(checked).filter(Boolean).length;
  const total = subtasks.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  if (total === 0) {
    return <div className="text-sm text-muted-foreground text-center py-6">Aucune sous-tâche</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-muted-foreground font-medium">
          {doneCount} / {total} complétée{doneCount > 1 ? "s" : ""}
        </span>
        <span className={`font-bold text-sm ${pct === 100 ? "text-emerald-600" : "text-primary"}`}>{pct}%</span>
      </div>
      <Progress value={pct} className={`h-1.5 ${pct === 100 ? "[&>div]:bg-emerald-500" : ""}`} />
      <div className="space-y-2 mt-3">
        {subtasks.map(s => {
          const isChecked = checked[s.id] ?? false;
          return (
            <div
              key={s.id}
              className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all ${
                isChecked ? "bg-emerald-50/50 border-emerald-100" : "border-border hover:border-primary/30 hover:bg-slate-50/50"
              }`}
            >
              <Checkbox
                id={`subtask-${s.id}`}
                checked={isChecked}
                onCheckedChange={val => setChecked(prev => ({ ...prev, [s.id]: !!val }))}
                className="mt-0.5 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
              />
              <div className="flex-1 min-w-0">
                <label
                  htmlFor={`subtask-${s.id}`}
                  className={`text-sm font-medium cursor-pointer leading-snug ${isChecked ? "line-through text-muted-foreground" : "text-foreground"}`}
                >
                  {s.title}
                </label>
                {s.assigneeName && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">{s.assigneeName}</p>
                )}
              </div>
              <Link href={`/tasks/${s.id}`}>
                <Badge variant="outline" className={`text-[10px] shrink-0 ${STATUS_LABEL[s.status]?.cls || ""}`}>
                  {STATUS_LABEL[s.status]?.label || s.status}
                </Badge>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── CommentsSection ───────────────────────────────────────────────────────────

function CommentsSection({ comments }: { comments: any[] }) {
  const [comment, setComment] = useState("");

  const handleSubmit = () => {
    if (!comment.trim()) return;
    toast.success("Commentaire ajouté avec succès.");
    setComment("");
  };

  return (
    <div className="space-y-3">
      {comments.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-4">Aucun commentaire pour le moment</div>
      ) : (
        <div className="space-y-3">
          {comments.map((c: any) => {
            const hasMention = c.content?.includes("@");
            return (
              <div key={c.id} className="bg-muted/50 p-3 rounded-lg border border-border text-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                      {(c.userName || "U").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-semibold">{c.userName || "Utilisateur"}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
                </div>
                <p className="text-foreground/80 leading-relaxed pl-8">
                  {hasMention
                    ? c.content.split(/(@\w+(?:\s\w+)?)/g).map((part: string, i: number) =>
                        part.startsWith("@")
                          ? <span key={i} className="text-primary font-semibold bg-primary/5 px-0.5 rounded">{part}</span>
                          : part
                      )
                    : c.content
                  }
                </p>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-2 pt-2 border-t border-border/50">
        <MentionTextarea
          value={comment}
          onChange={setComment}
          placeholder="Écrire un commentaire… Tapez @ pour mentionner quelqu'un"
          rows={2}
        />
        <div className="flex justify-between items-center">
          <p className="text-[11px] text-muted-foreground">Tapez @ pour mentionner un membre de l'équipe</p>
          <Button
            size="sm"
            className="h-8 bg-primary hover:bg-primary/90"
            onClick={handleSubmit}
            disabled={!comment.trim()}
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Envoyer
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TaskDetail() {
  const [, params] = useRoute("/tasks/:id");
  const id = params?.id || "";
  const [recurrence, setRecurrence] = useState("none");
  const timer = useTaskTimer();

  const { data: task, isLoading } = useGetTask(id, {
    query: { enabled: !!id, queryKey: getGetTaskQueryKey(id) },
  });

  if (isLoading) {
    return <div className="p-8 text-center animate-pulse text-muted-foreground">Chargement de la tâche…</div>;
  }
  if (!task) {
    return <div className="p-8 text-center text-muted-foreground">Tâche introuvable</div>;
  }

  const status = STATUS_LABEL[task.status] || { label: task.status, cls: "" };
  const priority = PRIORITY_LABEL[task.priority] || { label: task.priority, cls: "", dot: "bg-slate-400" };
  const subtasks = (task as any).subtasks || [];
  const comments = (task as any).comments || [];
  const history = (task as any).history || [];
  const doneSubtasks = subtasks.filter((s: any) => s.status === "done").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start gap-6 flex-wrap">
        <div>
          <Link href="/tasks" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Retour aux tâches
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">{task.title}</h1>
          <p className="text-muted-foreground mt-1">
            Projet : <span className="font-medium text-foreground">{task.projectName || "—"}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${priority.cls}`}>
            <span className={`w-2 h-2 rounded-full ${priority.dot}`} />
            {priority.label}
          </Badge>
          <Badge variant="outline" className={`px-3 py-1.5 text-sm font-semibold ${status.cls}`}>
            {status.label}
          </Badge>
        </div>
      </div>

      {/* Time tracker pill */}
      <div className="flex items-center gap-3 bg-slate-50 border border-border rounded-xl px-4 py-3 w-fit">
        <Timer className="w-4 h-4 text-muted-foreground" />
        <span className={`font-mono text-lg font-bold ${timer.running ? "text-primary" : "text-foreground"}`}>
          {timer.formatted}
        </span>
        {timer.running ? (
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-red-200 text-red-600 hover:bg-red-50" onClick={timer.stop}>
            <Square className="w-3 h-3 fill-current" /> Arrêter
          </Button>
        ) : (
          <Button size="sm" className="h-8 text-xs gap-1.5 bg-primary" onClick={timer.start}>
            <Play className="w-3 h-3 fill-current" /> Démarrer
          </Button>
        )}
        {timer.elapsed > 0 && (
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" onClick={timer.reset}>
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-1">Suivi de temps</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main card */}
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>Détails</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {task.description && (
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{task.description}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-4 border-t border-border">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1">Affectée à</div>
                <div className="font-medium">{task.assigneeName || "Non assignée"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1">Échéance</div>
                <div className="font-medium">{formatDate(task.dueDate)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1">Créée le</div>
                <div className="font-medium">{formatDate(task.createdAt)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1">Achevée le</div>
                <div className="font-medium">{task.completedAt ? formatDate(task.completedAt) : "—"}</div>
              </div>

              {/* Recurrence field */}
              <div className="col-span-2 pt-3 border-t border-border/50">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-2 flex items-center gap-1.5">
                  <RotateCcw className="w-3 h-3" />
                  Récurrence
                </div>
                <Select value={recurrence} onValueChange={setRecurrence}>
                  <SelectTrigger className="h-9 w-64 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {recurrence !== "none" && (
                  <p className="text-xs text-primary mt-1.5 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Cette tâche se renouvellera automatiquement ({RECURRENCE_OPTIONS.find(o => o.value === recurrence)?.label.toLowerCase()})
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comments card */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Échanges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CommentsSection comments={comments} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Subtasks card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ListTree className="w-4 h-4" />
                Sous-tâches
                {subtasks.length > 0 && (
                  <Badge variant="secondary" className="text-xs ml-1">
                    {doneSubtasks}/{subtasks.length}
                  </Badge>
                )}
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary">
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <SubtasksChecklist subtasks={subtasks} />
          </CardContent>
        </Card>

        {/* History card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-4 h-4" /> Historique
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-6">Aucune modification enregistrée</div>
            ) : (
              <ol className="relative border-l border-border ml-2 space-y-4">
                {history.map((h: any) => (
                  <li key={h.id} className="ml-4">
                    <div className="absolute -left-1.5 w-3 h-3 bg-primary rounded-full border-2 border-background" />
                    <div className="text-xs text-muted-foreground">{formatDate(h.createdAt)} — {h.userName || "Système"}</div>
                    <div className="text-sm font-medium">
                      {ACTION_LABEL[h.action] || h.action}
                      {h.field && <span className="text-muted-foreground"> · {FIELD_LABEL[h.field] || h.field}</span>}
                    </div>
                    {(h.oldValue || h.newValue) && (
                      <div className="text-xs mt-1 text-slate-600">
                        {h.oldValue && <span className="line-through text-red-500/70 mr-2">{h.oldValue}</span>}
                        {h.newValue && <span className="text-green-600 font-medium">{h.newValue}</span>}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
