import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { HrShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Users, CalendarDays } from "lucide-react";

type LeaveEntry = {
  id: string; collaboratorId: string; collaboratorName: string;
  collaboratorAvatar: string | null; type: string; startDate: string;
  endDate: string; days: number; status: string;
};

type Collaborator = { id: string; firstName: string; lastName: string; departmentId: string | null };
type Department = { id: string; name: string; color: string | null };

const TYPE_COLORS: Record<string, string> = {
  congé_payé: "#10b981", RTT: "#6366f1", maladie: "#ef4444",
  maternité: "#ec4899", paternité: "#3b82f6", sans_solde: "#94a3b8",
  formation: "#f59e0b", exceptionnel: "#f97316", autre: "#64748b",
};
const TYPE_LABELS: Record<string, string> = {
  congé_payé: "Congé payé", RTT: "RTT", maladie: "Maladie",
  maternité: "Maternité", paternité: "Paternité", sans_solde: "Sans solde",
  formation: "Formation", exceptionnel: "Exceptionnel", autre: "Autre",
};
const FR_MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const FR_DAYS_SHORT = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1; // Mon=0..Sun=6
}
function dateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function isWeekend(year: number, month: number, day: number) {
  const d = new Date(year, month, day).getDay();
  return d === 0 || d === 6;
}

export default function TeamCalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [deptFilter, setDeptFilter] = useState("all");

  const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const daysInMonth = getDaysInMonth(year, month);
  const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const { data } = useQuery<{ data: LeaveEntry[] }>({
    queryKey: ["hr-team-calendar", year, month],
    queryFn: () => apiFetch(`/api/hr/team-calendar?start=${startDate}&end=${endDate}`),
  });

  const { data: deptData } = useQuery<{ departments: Department[] }>({
    queryKey: ["hr-orgchart"],
    queryFn: () => apiFetch("/api/hr/orgchart"),
  });

  const depts = deptData?.departments ?? [];
  const entries = data?.data ?? [];

  const prev = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const collabsByDay = new Map<string, Map<string, LeaveEntry>>();
  for (const e of entries) {
    const s = new Date(e.startDate), end = new Date(e.endDate);
    const cur = new Date(s);
    while (cur <= end) {
      const key = cur.toISOString().slice(0, 10);
      if (!collabsByDay.has(key)) collabsByDay.set(key, new Map());
      collabsByDay.get(key)!.set(e.collaboratorId, e);
      cur.setDate(cur.getDate() + 1);
    }
  }

  const uniqueCollabs = Array.from(new Map(entries.map(e => [e.collaboratorId, e])).values())
    .sort((a, b) => a.collaboratorName.localeCompare(b.collaboratorName));

  const filteredCollabs = deptFilter === "all" ? uniqueCollabs : uniqueCollabs.filter(c => {
    const orgcollabs = (deptData as any)?.collaborators ?? [];
    const found = orgcollabs.find((x: any) => x.id === c.collaboratorId);
    return found?.departmentId === deptFilter;
  });

  const absentToday = collabsByDay.get(today.toISOString().slice(0, 10))?.size ?? 0;
  const totalAbsenceDays = entries.filter(e => e.status === "approved").reduce((sum, e) => sum + e.days, 0);
  const peakDay = Array.from(collabsByDay.entries()).sort((a, b) => b[1].size - a[1].size)[0];

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <HrShell
      title="Calendrier des absences"
      subtitle="Vue mensuelle des congés approuvés de l'équipe"
      actions={
        <div className="flex items-center gap-2">
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-44 h-8 text-sm"><SelectValue placeholder="Tous les départements" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les départements</SelectItem>
              {depts.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 border rounded-lg px-2 py-1">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={prev}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="text-sm font-semibold min-w-[140px] text-center">{FR_MONTHS[month]} {year}</span>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={next}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card><CardContent className="p-3 flex items-center gap-3">
          <CalendarDays className="w-5 h-5 text-slate-400" />
          <div><p className="text-xs text-muted-foreground">Absences ce mois</p><p className="text-2xl font-bold">{totalAbsenceDays}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-3">
          <Users className="w-5 h-5 text-slate-400" />
          <div><p className="text-xs text-muted-foreground">Absents aujourd'hui</p><p className="text-2xl font-bold text-amber-600">{absentToday}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-3">
          <CalendarDays className="w-5 h-5 text-slate-400" />
          <div><p className="text-xs text-muted-foreground">Jour pic</p><p className="text-sm font-semibold">{peakDay ? `${peakDay[0].slice(8, 10)}/${peakDay[0].slice(5, 7)} (${peakDay[1].size} abs.)` : "—"}</p></div>
        </CardContent></Card>
      </div>

      {/* Légende types */}
      <div className="flex flex-wrap gap-2 mb-3">
        {Array.from(new Set(entries.map(e => e.type))).map(type => (
          <span key={type} className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: TYPE_COLORS[type] ?? "#64748b" }}>
            {TYPE_LABELS[type] ?? type}
          </span>
        ))}
      </div>

      {/* Calendrier grille */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full min-w-max text-xs border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground sticky left-0 bg-muted/50 min-w-[160px] border-r border-border">Collaborateur</th>
                {days.map(d => {
                  const ds = dateStr(year, month, d);
                  const isWE = isWeekend(year, month, d);
                  const isToday = ds === today.toISOString().slice(0, 10);
                  const count = collabsByDay.get(ds)?.size ?? 0;
                  return (
                    <th key={d} className={`px-1 py-1.5 text-center min-w-[28px] border-r border-border ${isWE ? "bg-slate-100" : ""} ${isToday ? "bg-primary/10" : ""}`}>
                      <div className={`font-semibold ${isToday ? "text-primary" : isWE ? "text-slate-400" : ""}`}>{d}</div>
                      <div className="text-slate-400 font-normal">{FR_DAYS_SHORT[(new Date(year, month, d).getDay() + 6) % 7]}</div>
                      {count > 0 && <div className="text-amber-600 font-bold">{count}</div>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredCollabs.length === 0 ? (
                <tr><td colSpan={daysInMonth + 1} className="text-center py-12 text-muted-foreground">
                  <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p>Aucune absence approuvée ce mois</p>
                </td></tr>
              ) : filteredCollabs.map(collab => (
                <tr key={collab.collaboratorId} className="hover:bg-muted/20 border-t border-border">
                  <td className="px-3 py-1.5 sticky left-0 bg-white border-r border-border">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-5 h-5 shrink-0">
                        {collab.collaboratorAvatar && <AvatarImage src={collab.collaboratorAvatar} />}
                        <AvatarFallback className="text-[9px] bg-slate-600 text-white">
                          {collab.collaboratorName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium truncate max-w-[120px]">{collab.collaboratorName}</span>
                    </div>
                  </td>
                  {days.map(d => {
                    const ds = dateStr(year, month, d);
                    const entry = collabsByDay.get(ds)?.get(collab.collaboratorId);
                    const isWE = isWeekend(year, month, d);
                    const isToday = ds === today.toISOString().slice(0, 10);
                    return (
                      <td key={d} className={`px-0 py-0 text-center border-r border-border ${isWE ? "bg-slate-50" : ""} ${isToday ? "bg-primary/5" : ""}`}>
                        {entry && (
                          <div
                            className="h-5 mx-0.5 rounded-sm flex items-center justify-center text-[9px] text-white font-bold cursor-default"
                            style={{ backgroundColor: TYPE_COLORS[entry.type] ?? "#64748b" }}
                            title={`${entry.collaboratorName} — ${TYPE_LABELS[entry.type] ?? entry.type}`}
                          >
                            {entry.type === "congé_payé" ? "CP" : entry.type.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </HrShell>
  );
}
