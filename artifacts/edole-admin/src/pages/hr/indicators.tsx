import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { HrShell } from "./_layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { Users, TrendingDown, TrendingUp, Clock, UserCheck, UserMinus, Calendar } from "lucide-react";

const COLORS = ["#2563EB", "#0F1A3A", "#0ea5e9", "#8b5cf6", "#10b981", "#ef4444", "#f59e0b", "#6366f1"];
const CURRENT_YEAR = new Date().getFullYear();

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  promotion: "Promotion",
  mutation: "Mutation",
  reclassification: "Reclassification",
  departure: "Départ",
  retirement: "Retraite",
  disciplinary: "Disciplinaire",
};

export default function HrIndicatorsPage() {
  const [year, setYear] = useState(String(CURRENT_YEAR));

  const { data, isLoading } = useQuery<any>({
    queryKey: ["hr-indicators", year],
    queryFn: () => apiFetch(`/api/hr/indicators?year=${year}`),
  });

  if (isLoading) return (
    <HrShell title="Indicateurs RH" subtitle="Tableau de bord analytique des ressources humaines">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    </HrShell>
  );

  const d = data ?? {};

  const kpis = [
    { label: "Effectif total", value: d.headcount ?? 0, sub: `${d.activeCount ?? 0} actifs`, icon: Users, color: "text-blue-600" },
    { label: "Nouveaux entrants", value: d.hiredThisYear ?? 0, sub: `sur ${year}`, icon: UserCheck, color: "text-emerald-600" },
    { label: "Départs", value: d.departuresThisYear ?? 0, sub: `sur ${year}`, icon: UserMinus, color: "text-red-600" },
    { label: "Taux de turnover", value: `${d.turnoverRate ?? 0}%`, sub: `moy. secteur 15%`, icon: TrendingDown, color: d.turnoverRate > 15 ? "text-red-600" : "text-emerald-600" },
    { label: "Ancienneté moy.", value: `${d.avgTenureYears ?? 0} ans`, sub: "", icon: Clock, color: "text-purple-600" },
    { label: "CDI / CDD", value: `${d.permanentCount ?? 0} / ${d.temporaryCount ?? 0}`, sub: "", icon: UserCheck, color: "text-muted-foreground" },
    { label: "Jours abs. / ETP", value: d.absenceDaysPerFTE ?? 0, sub: `jours/an`, icon: Calendar, color: "text-amber-600" },
    { label: "Taux de présence", value: `${d.attendanceRate ?? 0}%`, sub: `ce mois`, icon: TrendingUp, color: d.attendanceRate >= 90 ? "text-emerald-600" : "text-amber-600" },
  ];

  return (
    <HrShell
      title="Indicateurs RH"
      subtitle="Headcount, turnover, absences et diversité"
      actions={
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-28 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      }
    >
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {kpis.map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-start gap-3">
              <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Effectif par département */}
        {(d.byDepartment?.length ?? 0) > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Effectif par département</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={d.byDepartment} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="department" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip formatter={(v: any) => [`${v} collaborateurs`]} />
                  <Bar dataKey="count" fill="#2563EB" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Répartition par type de contrat */}
        {(d.byContract?.length ?? 0) > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Répartition par contrat</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={d.byContract} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={80} label={({ type, count }) => `${type} (${count})`} labelLine={false} fontSize={11}>
                    {(d.byContract ?? []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any, n: any) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Évolution headcount mensuelle */}
        {(d.headcountByMonth?.length ?? 0) > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Évolution headcount — {year}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={d.headcountByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Absences par mois */}
        {(d.absencesByMonth?.length ?? 0) > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Jours d'absence par mois — {year}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={d.absencesByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => [`${v} jours`]} />
                  <Bar dataKey="days" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Top départements absences */}
        {(d.absencesByDept?.length ?? 0) > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Absences par département</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {d.absencesByDept.map((item: any, i: number) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{item.department}</span>
                    <span className="text-muted-foreground">{item.days} j ({item.pct}%)</span>
                  </div>
                  <Progress value={item.pct} className="h-1.5" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Alertes mouvements */}
        {(d.recentMovements?.length ?? 0) > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Mouvements récents ({year})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {d.recentMovements.slice(0, 6).map((m: any) => (
                <div key={m.id} className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-medium">{m.collaboratorName}</span>
                    <span className="text-muted-foreground ml-2">{new Date(m.effectiveDate).toLocaleDateString("fr-FR")}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">{MOVEMENT_TYPE_LABELS[m.type] ?? m.type}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </HrShell>
  );
}
