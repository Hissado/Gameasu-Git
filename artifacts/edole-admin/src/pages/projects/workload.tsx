import React, { useMemo, useState } from "react";
import { useListTasks } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Users2, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Constants ─────────────────────────────────────────────────────────────────

const CAPACITY_HOURS_PER_WEEK = 40;

const HEAT: Array<{ min: number; max: number; bg: string; text: string; label: string }> = [
  { min: 0, max: 0,   bg: "bg-muted/50",   text: "text-muted-foreground/60",  label: "Disponible" },
  { min: 1, max: 30,  bg: "bg-emerald-50", text: "text-emerald-700", label: "Faible charge" },
  { min: 31, max: 60, bg: "bg-sky-50",     text: "text-sky-700",    label: "Charge modérée" },
  { min: 61, max: 85, bg: "bg-amber-50",   text: "text-amber-700",  label: "Bonne charge" },
  { min: 86, max: 100,bg: "bg-orange-100", text: "text-orange-700", label: "Charge élevée" },
  { min: 101, max: Infinity, bg: "bg-red-100", text: "text-red-700", label: "Surcharge" },
];

function getHeat(pct: number) {
  return HEAT.find(h => pct >= h.min && pct <= h.max) || HEAT[HEAT.length - 1];
}

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

// ── Week helpers ──────────────────────────────────────────────────────────────

function getWeekStart(offsetWeeks = 0) {
  const d = new Date();
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff + offsetWeeks * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekLabel(date: Date) {
  const end = new Date(date);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  return `${fmt(date)} – ${fmt(end)}`;
}

function getWeekKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateInWeek(dateStr: string | null | undefined, weekStart: Date) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 7);
  return d >= weekStart && d < end;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function WorkloadPage() {
  const [weekOffset, setWeekOffset] = useState(-1); // start 1 week back to see recent tasks
  const [weeksCount, setWeeksCount] = useState(6);
  const { data: tasksData, isLoading: loadingTasks } = useListTasks();

  const weekStarts = useMemo(
    () => Array.from({ length: weeksCount }, (_, i) => getWeekStart(weekOffset + i)),
    [weekOffset, weeksCount]
  );

  const tasks = tasksData?.data || [];

  // Build unique assignees directly from tasks (avoids collaborator.userId = null issue)
  const assignees = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    tasks.forEach((t: any) => {
      if (t.assigneeId && t.assigneeName && !map.has(t.assigneeId)) {
        map.set(t.assigneeId, { id: t.assigneeId, name: t.assigneeName });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  // Build workload matrix: assignee → week → tasks
  const matrix = useMemo(() => {
    return assignees.map((assignee) => {
      const weeks = weekStarts.map(weekStart => {
        const weekTasks = tasks.filter((t: any) =>
          t.assigneeId === assignee.id &&
          t.status !== "done" && t.status !== "cancelled" &&
          dateInWeek(t.dueDate, weekStart)
        );
        const hours = weekTasks.reduce((sum: number, t: any) => sum + (t.estimatedHours || 4), 0);
        const pct = Math.round((hours / CAPACITY_HOURS_PER_WEEK) * 100);
        return { tasks: weekTasks, hours, pct };
      });
      const totalTasks = tasks.filter((t: any) =>
        t.assigneeId === assignee.id && t.status !== "done" && t.status !== "cancelled"
      );
      return { assignee, weeks, totalActive: totalTasks.length };
    });
  }, [assignees, tasks, weekStarts]);

  const isLoading = loadingTasks;

  const kpis = useMemo(() => {
    const all = matrix.flatMap(r => r.weeks);
    const overloaded = matrix.filter(r => r.weeks.some(w => w.pct > 100)).length;
    const idle = matrix.filter(r => r.weeks.every(w => w.pct === 0)).length;
    const avgLoad = all.length > 0
      ? Math.round(all.reduce((s, w) => s + w.pct, 0) / all.length)
      : 0;
    return { overloaded, idle, avgLoad, total: matrix.length };
  }, [matrix]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Charge d'équipe</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Répartition des tâches par collaborateur et par semaine
          </p>
        </div>
        <Select value={String(weeksCount)} onValueChange={v => setWeeksCount(Number(v))}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="4">4 semaines</SelectItem>
            <SelectItem value="6">6 semaines</SelectItem>
            <SelectItem value="8">8 semaines</SelectItem>
            <SelectItem value="12">12 semaines</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <div className="text-xl font-bold">{kpis.overloaded}</div>
              <div className="text-xs text-muted-foreground">En surcharge</div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-xl font-bold">{kpis.idle}</div>
              <div className="text-xs text-muted-foreground">Sans tâche</div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-xl font-bold">{kpis.avgLoad}%</div>
              <div className="text-xs text-muted-foreground">Charge moy.</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(o => o - weeksCount)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm font-medium text-muted-foreground">
          {getWeekLabel(weekStarts[0])} → {getWeekLabel(weekStarts[weekStarts.length - 1])}
        </span>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(o => o + weeksCount)}>
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" className="text-xs ml-2" onClick={() => setWeekOffset(0)}>
          Aujourd'hui
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {HEAT.map(h => (
          <span key={h.label} className="flex items-center gap-1.5">
            <span className={`w-4 h-4 rounded ${h.bg} border border-border`} />
            <span className="text-muted-foreground">{h.label}</span>
          </span>
        ))}
      </div>

      {/* Matrix */}
      <Card className="shadow-sm overflow-hidden border-border">
        {isLoading ? (
          <CardContent className="p-6 space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full" />)}
          </CardContent>
        ) : matrix.length === 0 ? (
          <CardContent className="py-16 text-center text-muted-foreground">
            <Users2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
            <p className="font-semibold text-muted-foreground">Aucun collaborateur trouvé</p>
            <p className="text-sm mt-1">Les collaborateurs apparaîtront ici une fois créés.</p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/80">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground w-52 border-r border-border">
                    Collaborateur
                  </th>
                  {weekStarts.map(ws => (
                    <th
                      key={getWeekKey(ws)}
                      className={`text-center px-3 py-2 text-[10px] font-semibold min-w-[100px] border-r border-border/40 ${
                        getWeekKey(ws) === getWeekKey(getWeekStart(0))
                          ? "bg-primary/5 text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      <div>{ws.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</div>
                      <div className="font-normal text-muted-foreground text-[9px]">
                        {getWeekKey(ws) === getWeekKey(getWeekStart(0)) ? "← Cette semaine" : ""}
                      </div>
                    </th>
                  ))}
                  <th className="text-center px-3 py-2 text-[10px] font-semibold text-muted-foreground min-w-[80px]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {matrix.map(({ assignee, weeks, totalActive }) => (
                  <tr key={assignee.id} className="border-b border-border/30 hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 border-r border-border">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="w-8 h-8 shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                            {initials(assignee.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-foreground truncate">
                            {assignee.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {totalActive} tâche{totalActive !== 1 ? "s" : ""} actives
                          </div>
                        </div>
                      </div>
                    </td>
                    {weeks.map((week, wi) => {
                      const heat = getHeat(week.pct);
                      return (
                        <td
                          key={wi}
                          className={`text-center px-2 py-2 border-r border-border/30 ${heat.bg}`}
                        >
                          {week.tasks.length > 0 ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="cursor-default">
                                  <div className={`text-xs font-bold ${heat.text}`}>
                                    {week.pct}%
                                  </div>
                                  <div className={`text-[9px] ${heat.text} opacity-80`}>
                                    {week.tasks.length} tâche{week.tasks.length > 1 ? "s" : ""}
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <div className="space-y-1.5">
                                  <p className="font-semibold text-sm">{heat.label} — {week.pct}%</p>
                                  <p className="text-xs text-muted-foreground">{week.hours}h estimées / {CAPACITY_HOURS_PER_WEEK}h cap.</p>
                                  <div className="border-t pt-1.5 space-y-1">
                                    {week.tasks.slice(0, 5).map((t: any) => (
                                      <div key={t.id} className="text-xs flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                        {t.title}
                                      </div>
                                    ))}
                                    {week.tasks.length > 5 && (
                                      <div className="text-xs text-muted-foreground">+{week.tasks.length - 5} autres</div>
                                    )}
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/40">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-center px-3 py-2">
                      <Badge variant="outline" className="text-[10px] font-semibold">
                        {totalActive}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
