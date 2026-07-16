import React, { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate } from "@/lib/format";
import { CalendarDays, Minus } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GanttPhase {
  id: string;
  name: string;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  tasks?: GanttTask[];
}

interface GanttTask {
  id: string;
  title: string;
  status: string;
  priority?: string;
  dueDate?: string | null;
  assigneeName?: string | null;
}

interface GanttViewProps {
  project: {
    startDate?: string | null;
    endDate?: string | null;
    progress?: number;
    phases?: GanttPhase[];
  };
  tasks?: GanttTask[];
}

// ── Config ────────────────────────────────────────────────────────────────────

const PHASE_STATUS_COLORS: Record<string, { bar: string; text: string; border: string }> = {
  pending:     { bar: "bg-slate-300", text: "text-muted-foreground", border: "border" },
  in_progress: { bar: "bg-primary", text: "text-primary", border: "border-primary" },
  completed:   { bar: "bg-emerald-500", text: "text-emerald-600", border: "border-emerald-400" },
  on_hold:     { bar: "bg-amber-400", text: "text-amber-600", border: "border-amber-400" },
};

const TASK_PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-400", medium: "bg-blue-500", high: "bg-amber-500", urgent: "bg-red-500",
};

const PHASE_STATUS_LABELS: Record<string, string> = {
  pending: "À démarrer", in_progress: "En cours", completed: "Terminée", on_hold: "En pause",
};

const TASK_STATUS_LABELS: Record<string, string> = {
  todo: "À faire", in_progress: "En cours", review: "En revue",
  done: "Terminée", blocked: "Bloquée",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function toMs(d: string | null | undefined): number {
  if (!d) return 0;
  return new Date(d).getTime();
}

function getWeekHeaders(startMs: number, endMs: number): Array<{ label: string; offset: number; width: number }> {
  const totalMs = endMs - startMs;
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const headers: Array<{ label: string; offset: number; width: number }> = [];
  let cur = startMs;
  while (cur < endMs + weekMs) {
    const weekDate = new Date(cur);
    const weekNum = getISOWeek(weekDate);
    const offset = ((cur - startMs) / totalMs) * 100;
    const nextCur = cur + weekMs;
    const width = ((Math.min(nextCur, endMs + weekMs) - cur) / totalMs) * 100;
    headers.push({
      label: `S${weekNum} ${weekDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}`,
      offset: Math.max(0, Math.min(100, offset)),
      width: Math.max(0, Math.min(100 - Math.max(0, offset), width)),
    });
    cur = nextCur;
  }
  return headers;
}

function getMonthHeaders(startMs: number, endMs: number): Array<{ label: string; offset: number; width: number }> {
  const totalMs = endMs - startMs;
  const months: Array<{ label: string; offset: number; width: number }> = [];
  const startDate = new Date(startMs);
  let cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (cur.getTime() < endMs) {
    const monthStart = cur.getTime();
    const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    const monthEnd = nextMonth.getTime();
    const offset = Math.max(0, ((monthStart - startMs) / totalMs) * 100);
    const width = ((Math.min(monthEnd, endMs) - Math.max(monthStart, startMs)) / totalMs) * 100;
    months.push({
      label: cur.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
      offset: Math.max(0, offset),
      width: Math.max(0, width),
    });
    cur = nextMonth;
  }
  return months;
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function clampPct(pct: number) {
  return Math.max(0, Math.min(100, pct));
}

// ── GanttBar ─────────────────────────────────────────────────────────────────

function GanttBar({ leftPct, widthPct, color, label }: {
  leftPct: number; widthPct: number; color: string; label: string;
}) {
  const safeLeft = clampPct(leftPct);
  const safeWidth = clampPct(widthPct);
  if (safeWidth < 0.5) return null;
  return (
    <div
      className={`absolute top-1/2 -translate-y-1/2 h-6 rounded-md ${color} opacity-90 flex items-center px-2 overflow-hidden min-w-[4px]`}
      style={{ left: `${safeLeft}%`, width: `${safeWidth}%` }}
    >
      {safeWidth > 8 && (
        <span className="text-white text-[10px] font-semibold truncate leading-none whitespace-nowrap">{label}</span>
      )}
    </div>
  );
}

// ── TaskDiamond ───────────────────────────────────────────────────────────────

function TaskDiamond({ leftPct, color, task }: { leftPct: number; color: string; task: GanttTask }) {
  const safe = clampPct(leftPct);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rotate-45 ${color} cursor-pointer hover:scale-125 transition-transform shadow-sm`}
          style={{ left: `calc(${safe}% - 6px)` }}
        />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-semibold text-sm">{task.title}</p>
          <p className="text-xs text-muted-foreground">{TASK_STATUS_LABELS[task.status] || task.status}</p>
          {task.dueDate && <p className="text-xs">Échéance : {formatDate(task.dueDate)}</p>}
          {task.assigneeName && <p className="text-xs">Assigné : {task.assigneeName}</p>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function GanttView({ project, tasks = [] }: GanttViewProps) {
  const [zoom, setZoom] = useState<"weeks" | "months">("months");

  const { startMs, endMs, todayPct, showWeeks } = useMemo(() => {
    const today = Date.now();
    const projStart = toMs(project.startDate);
    const projEnd = toMs(project.endDate);

    const bufMs = 7 * 24 * 60 * 60 * 1000 * 2;
    const start = projStart > 0 ? projStart - bufMs : today - 30 * 86400000;
    const end = projEnd > 0 ? projEnd + bufMs : today + 90 * 86400000;

    const totalMs = end - start;
    const spanDays = totalMs / 86400000;

    return {
      startMs: start,
      endMs: end,
      todayPct: ((today - start) / totalMs) * 100,
      showWeeks: spanDays <= 90,
    };
  }, [project.startDate, project.endDate]);

  const headers = useMemo(
    () => showWeeks || zoom === "weeks"
      ? getWeekHeaders(startMs, endMs)
      : getMonthHeaders(startMs, endMs),
    [startMs, endMs, showWeeks, zoom]
  );

  const totalMs = endMs - startMs;

  const phases = useMemo(() => {
    const raw = project.phases || [];
    if (raw.length === 0) return [];
    const projStart = toMs(project.startDate);
    const projEnd = toMs(project.endDate);
    const projDuration = projEnd - projStart;
    const phaseMs = projDuration > 0 ? projDuration / raw.length : 30 * 86400000;

    return raw.map((phase, i) => {
      const phaseStart = phase.startDate
        ? toMs(phase.startDate)
        : projStart + i * phaseMs;
      const phaseEnd = phase.endDate
        ? toMs(phase.endDate)
        : phaseStart + phaseMs;

      const leftPct = ((phaseStart - startMs) / totalMs) * 100;
      const widthPct = ((phaseEnd - phaseStart) / totalMs) * 100;
      const colors = PHASE_STATUS_COLORS[phase.status] || PHASE_STATUS_COLORS.pending;

      return { ...phase, leftPct, widthPct, colors, phaseStart, phaseEnd };
    });
  }, [project.phases, project.startDate, project.endDate, startMs, totalMs]);

  const tasksByPhase = useMemo(() => {
    const byPhase: Record<string, GanttTask[]> = {};
    tasks.forEach(t => {
      const key = (t as any).phaseId || "_unassigned";
      byPhase[key] = byPhase[key] || [];
      byPhase[key].push(t);
    });
    return byPhase;
  }, [tasks]);

  const unassignedTasks = tasksByPhase["_unassigned"] || [];

  if (!project.startDate && !project.endDate && phases.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <CalendarDays className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
        <p className="font-semibold text-muted-foreground">Aucune date définie</p>
        <p className="text-sm mt-1">Ajoutez des dates de début et fin au projet pour visualiser la timeline.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-primary inline-block" /> En cours</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Terminé</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-300 inline-block" /> À démarrer</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-400 inline-block" /> En pause</span>
        </div>
        {!showWeeks && (
          <div className="flex gap-1">
            {(["months", "weeks"] as const).map(z => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                  zoom === z ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {z === "months" ? "Mois" : "Semaines"}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
        <div className="min-w-[700px]">
          {/* Header: labels */}
          <div className="flex border-b border-border bg-muted/80">
            <div className="w-48 shrink-0 px-4 py-2.5 text-xs font-semibold text-muted-foreground border-r border-border">
              Phase / Tâche
            </div>
            <div className="flex-1 relative h-9 overflow-hidden">
              {headers.map((h, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 flex items-center border-r border-border/40 px-1.5"
                  style={{ left: `${h.offset}%`, width: `${h.width}%` }}
                >
                  <span className="text-[10px] text-muted-foreground font-medium truncate">{h.label}</span>
                </div>
              ))}
              {/* Today line in header */}
              {todayPct >= 0 && todayPct <= 100 && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-red-500/60 z-10"
                  style={{ left: `${todayPct}%` }}
                />
              )}
            </div>
          </div>

          {/* Rows */}
          {phases.length === 0 && unassignedTasks.length === 0 && (
            <div className="flex">
              <div className="w-48 shrink-0 px-4 py-3 border-r border-border">
                <span className="text-xs text-muted-foreground italic">Projet</span>
              </div>
              <div className="flex-1 relative h-12">
                {todayPct >= 0 && todayPct <= 100 && (
                  <div className="absolute top-0 bottom-0 w-px bg-red-500/30 z-10" style={{ left: `${todayPct}%` }} />
                )}
                {project.startDate && project.endDate && (
                  <GanttBar
                    leftPct={((toMs(project.startDate) - startMs) / totalMs) * 100}
                    widthPct={((toMs(project.endDate) - toMs(project.startDate)) / totalMs) * 100}
                    color="bg-primary"
                    label="Projet"
                  />
                )}
              </div>
            </div>
          )}

          {phases.map(phase => {
            const phaseTasks = tasksByPhase[phase.id] || [];
            return (
              <React.Fragment key={phase.id}>
                {/* Phase row */}
                <div className="flex border-t border-border/30 group hover:bg-muted/40 transition-colors">
                  <div className="w-48 shrink-0 px-4 py-3 border-r border-border flex flex-col justify-center">
                    <span className="text-xs font-semibold text-foreground truncate">{phase.name}</span>
                    <Badge variant="outline" className={`mt-1 text-[9px] w-fit px-1.5 py-0 ${phase.colors.border} ${phase.colors.text} bg-transparent`}>
                      {PHASE_STATUS_LABELS[phase.status] || phase.status}
                    </Badge>
                  </div>
                  <div className="flex-1 relative h-14">
                    {todayPct >= 0 && todayPct <= 100 && (
                      <div className="absolute top-0 bottom-0 w-px bg-red-500/30 z-10" style={{ left: `${todayPct}%` }} />
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="absolute inset-0">
                          <GanttBar
                            leftPct={phase.leftPct}
                            widthPct={phase.widthPct}
                            color={phase.colors.bar}
                            label={phase.name}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="font-semibold">{phase.name}</p>
                        <p className="text-xs text-muted-foreground">{PHASE_STATUS_LABELS[phase.status] || phase.status}</p>
                        {phase.startDate && <p className="text-xs">Début : {formatDate(phase.startDate)}</p>}
                        {phase.endDate && <p className="text-xs">Fin : {formatDate(phase.endDate)}</p>}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {/* Task rows for this phase */}
                {phaseTasks.map(task => {
                  const taskMs = toMs(task.dueDate);
                  const taskLeft = taskMs > 0 ? ((taskMs - startMs) / totalMs) * 100 : null;
                  const prioColor = TASK_PRIORITY_COLORS[task.priority || "medium"] || "bg-slate-400";
                  return (
                    <div key={task.id} className="flex border-t border-border/20 hover:bg-muted/30 transition-colors">
                      <div className="w-48 shrink-0 px-4 py-2 border-r border-border/40 flex items-center gap-2 pl-7">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${prioColor}`} />
                        <span className="text-[11px] text-muted-foreground truncate">{task.title}</span>
                      </div>
                      <div className="flex-1 relative h-9">
                        {todayPct >= 0 && todayPct <= 100 && (
                          <div className="absolute top-0 bottom-0 w-px bg-red-500/20 z-10" style={{ left: `${todayPct}%` }} />
                        )}
                        {taskLeft !== null && (
                          <TaskDiamond leftPct={taskLeft} color={prioColor} task={task} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}

          {/* Unassigned tasks */}
          {unassignedTasks.length > 0 && (
            <>
              <div className="flex border-t border-border/30 bg-muted/60">
                <div className="w-48 shrink-0 px-4 py-2 border-r border-border">
                  <span className="text-xs font-semibold text-muted-foreground">Tâches sans phase</span>
                </div>
                <div className="flex-1 relative h-9">
                  {todayPct >= 0 && todayPct <= 100 && (
                    <div className="absolute top-0 bottom-0 w-px bg-red-500/20 z-10" style={{ left: `${todayPct}%` }} />
                  )}
                </div>
              </div>
              {unassignedTasks.map(task => {
                const taskMs = toMs(task.dueDate);
                const taskLeft = taskMs > 0 ? ((taskMs - startMs) / totalMs) * 100 : null;
                const prioColor = TASK_PRIORITY_COLORS[task.priority || "medium"] || "bg-slate-400";
                return (
                  <div key={task.id} className="flex border-t border-border/20 hover:bg-muted/30 transition-colors">
                    <div className="w-48 shrink-0 px-4 py-2 border-r border-border/40 flex items-center gap-2 pl-7">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${prioColor}`} />
                      <span className="text-[11px] text-muted-foreground truncate">{task.title}</span>
                    </div>
                    <div className="flex-1 relative h-9">
                      {todayPct >= 0 && todayPct <= 100 && (
                        <div className="absolute top-0 bottom-0 w-px bg-red-500/20 z-10" style={{ left: `${todayPct}%` }} />
                      )}
                      {taskLeft !== null && (
                        <TaskDiamond leftPct={taskLeft} color={prioColor} task={task} />
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* Today footer label */}
          {todayPct >= 0 && todayPct <= 100 && (
            <div className="relative h-5 border-t border-border/20 bg-muted/40">
              <div className="absolute top-0 bottom-0 flex flex-col items-center" style={{ left: `calc(48px + ${todayPct}% - 48px * ${todayPct / 100})` }}>
                <div className="absolute top-0 bottom-0 w-px bg-red-500/40" style={{ left: `calc(192px + (100% - 192px) * ${todayPct / 100})` }} />
                <div
                  className="absolute top-0 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap"
                  style={{ left: `calc(192px + (100% - 192px) * ${todayPct / 100} - 20px)` }}
                >
                  Aujourd'hui
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
