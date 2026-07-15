import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronRight, Clock, ClipboardList } from "lucide-react";

function shortDateFr(d: Date) {
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function daysBetween(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

interface Props {
  overdueTasks: any[];
  upcomingTasks: any[];
  now: Date;
}

export function UpcomingTasksSection({ overdueTasks, upcomingTasks, now }: Props) {
  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Tâches à venir</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Planification et tâches en retard</p>
        </div>
        <Button variant="ghost" size="sm" className="text-xs" asChild>
          <Link href="/tasks">Voir tout <ChevronRight className="w-3.5 h-3.5 ml-0.5" /></Link>
        </Button>
      </div>
      <div className="mt-3 space-y-2">
        {overdueTasks.length === 0 && upcomingTasks.length === 0 && (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-800 font-medium">Aucune tâche en retard ni à venir.</p>
          </div>
        )}
        {overdueTasks.map((t: any) => {
          const delta = daysBetween(now, new Date(t.dueDate));
          return (
            <Link key={t.id} href={`/tasks/${t.id}`}
              className="flex items-center gap-3 p-3 rounded-lg border border-rose-200 bg-rose-50/70 hover:bg-rose-50 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center shrink-0"><Clock className="w-4 h-4 text-rose-600" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{t.title}</p>
                <p className="text-xs text-slate-600">{t.assigneeName || "Non assigné"} · échue {shortDateFr(new Date(t.dueDate))}</p>
              </div>
              <span className="text-xs font-bold text-rose-600 shrink-0">+{delta}j</span>
            </Link>
          );
        })}
        {upcomingTasks.map((t: any) => (
          <Link key={t.id} href={`/tasks/${t.id}`}
            className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0"><ClipboardList className="w-4 h-4 text-slate-400" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{t.title}</p>
              <p className="text-xs text-slate-500">{shortDateFr(t._due)}</p>
            </div>
            <span className="text-xs text-slate-500 shrink-0">Dans {t._delta}j</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
