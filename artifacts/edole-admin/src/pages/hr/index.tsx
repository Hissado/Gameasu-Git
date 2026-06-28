import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { HrShell } from "./_layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Users, AlertTriangle, Bell, UserCheck, CalendarClock,
  TrendingDown, Wallet, UserX, Building2, ChevronRight,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip as ReTooltip, Legend,
} from "recharts";
import { formatFCFA } from "@/lib/format";
import { Link } from "wouter";

type Dashboard = {
  kpis: {
    totalCollaborators: number;
    activeContracts: number;
    departmentsCount: number;
    contractsExpiringSoon: number;
    masseSalariale: number;
    absentsToday: number;
    tauxAbsence: number;
  };
  distributionByDepartment: { department: string; count: number }[];
  recentHires: { id: string; firstName: string; lastName: string; hireDate: string; avatarUrl?: string }[];
  contractsExpiringSoon: { id: string; collaboratorName: string; type: string; endDate: string }[];
  ageDistribution: { name: string; value: number }[];
  monthlyHires: { month: string; count: number }[];
  chargesPayroll: {
    period: string;
    cnssEmployee: number;
    cnssEmployer: number;
    irpp: number;
    ipts: number;
    grossSalary: number;
    chargesSalariales: number;
    chargesPatronales: number;
    totalCharges: number;
  } | null;
};

type HrAlerts = {
  expiringContracts: { id: string; collaboratorName: string; type: string; endDate: string; daysLeft: number; urgency: "high" | "medium"; poste: string | null }[];
  trialEnding: { id: string; collaboratorName: string; type: string; startDate: string; daysSinceStart: number | null; poste: string | null }[];
  anniversaries: { id: string; collaboratorName: string; startDate: string; years: number }[];
};

const AGE_COLORS = ["#0d9488", "#0891b2", "#7c3aed", "#d97706", "#64748b"];
const MOIS_SHORT: Record<string, string> = {
  "01": "Jan", "02": "Fév", "03": "Mar", "04": "Avr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Aoû",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Déc",
};

function monthLabel(ym: string) {
  const [, m] = ym.split("-");
  return MOIS_SHORT[m ?? ""] ?? ym;
}

const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function HrDashboard() {
  const { data, isLoading } = useQuery<Dashboard>({
    queryKey: ["hr-dashboard"],
    queryFn: () => apiFetch("/api/hr/dashboard"),
  });

  const { data: alerts } = useQuery<HrAlerts>({
    queryKey: ["hr-alerts"],
    queryFn: () => apiFetch("/api/hr/alerts/upcoming"),
  });

  const actionsCount = (alerts?.expiringContracts.length ?? 0) + (alerts?.trialEnding.length ?? 0);
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - today.getDate();

  return (
    <HrShell title="Ressources Humaines" subtitle="Tableau de bord · Vue d'ensemble RH">
      {isLoading || !data ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── HERO KPI ROW ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Collaborateurs */}
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Collaborateurs</span>
                  <span className="text-xs text-rose-500 font-medium flex items-center gap-0.5">
                    <TrendingDown className="w-3 h-3" />
                    {data.kpis.activeContracts > 0
                      ? `${Math.round((data.kpis.contractsExpiringSoon / data.kpis.totalCollaborators) * 100)}% risque`
                      : "—"}
                  </span>
                </div>
                <div className="text-4xl font-bold text-foreground">{data.kpis.totalCollaborators}</div>
                <div className="flex items-center gap-3 mt-2">
                  <Badge variant="secondary" className="text-xs font-normal">{data.kpis.activeContracts} contrats actifs</Badge>
                  <Badge variant="secondary" className="text-xs font-normal">{data.kpis.departmentsCount} depts</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Absents */}
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Absents aujourd'hui</span>
                  <span className="text-xs text-amber-600 font-medium">{data.kpis.tauxAbsence}% taux</span>
                </div>
                <div className="text-4xl font-bold text-foreground">{data.kpis.absentsToday}</div>
                <div className="mt-2">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all"
                      style={{ width: `${Math.min(data.kpis.tauxAbsence * 5, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">Congés approuvés en cours</p>
                </div>
              </CardContent>
            </Card>

            {/* Masse salariale */}
            <Card className="border-0 shadow-sm bg-gradient-to-br from-teal-700 to-teal-900 text-white">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-teal-200 uppercase tracking-wider">Masse salariale</span>
                  <Wallet className="w-4 h-4 text-teal-300" />
                </div>
                <div className="text-2xl font-bold text-white leading-tight">
                  {formatFCFA(data.kpis.masseSalariale)}
                </div>
                <p className="text-xs text-teal-300 mt-1.5">Somme des salaires de base</p>
                {data.chargesPayroll && (
                  <div className="mt-3 pt-3 border-t border-teal-600 text-xs text-teal-200">
                    <span className="font-medium">Coût total employeur ≈ </span>
                    {formatFCFA(data.chargesPayroll.grossSalary + data.chargesPayroll.chargesPatronales)}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── MAIN GRID ────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* COLONNE GAUCHE */}
            <div className="space-y-4">
              {/* Actions requises */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-2"><Bell className="w-4 h-4 text-primary" /> Vos actions requises</span>
                    {actionsCount > 0 && (
                      <Badge className="bg-rose-100 text-rose-700 border-0 text-xs">{actionsCount}</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-1 pb-3">
                  {actionsCount === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">Aucune action en attente.</p>
                  ) : (
                    <div className="space-y-2">
                      {alerts?.expiringContracts.slice(0, 3).map(c => (
                        <div key={c.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                          <div>
                            <p className="font-medium text-sm leading-tight">{c.collaboratorName}</p>
                            <p className="text-xs text-muted-foreground">Fin de contrat</p>
                          </div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.urgency === "high" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                            J−{c.daysLeft}
                          </span>
                        </div>
                      ))}
                      {alerts?.trialEnding.slice(0, 2).map(t => (
                        <div key={t.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                          <div>
                            <p className="font-medium text-sm leading-tight">{t.collaboratorName}</p>
                            <p className="text-xs text-muted-foreground">Fin période d'essai</p>
                          </div>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            {t.daysSinceStart != null ? `J+${t.daysSinceStart}` : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Clôture du mois */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Clôture du mois en cours
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16">
                      <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                        <circle
                          cx="18" cy="18" r="15.9" fill="none"
                          stroke="#0d9488" strokeWidth="3" strokeLinecap="round"
                          strokeDasharray={`${(1 - daysRemaining / daysInMonth) * 100} 100`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-lg font-bold leading-none">{daysRemaining}</span>
                        <span className="text-[8px] text-muted-foreground uppercase font-medium">jours</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Jours restants</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {today.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Anniversaires */}
              {(alerts?.anniversaries.length ?? 0) > 0 && (
                <Card className="border-0 shadow-sm border-l-4 border-l-emerald-500">
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm flex items-center gap-2 text-emerald-700">
                      <CalendarClock className="w-4 h-4" /> Anniversaires ce mois
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 pb-3">
                    <div className="space-y-1.5">
                      {alerts!.anniversaries.map(a => (
                        <div key={a.id} className="flex items-center justify-between text-sm">
                          <span className="font-medium">{a.collaboratorName}</span>
                          <Badge variant="secondary" className="text-xs">{a.years} an{a.years > 1 ? "s" : ""}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* COLONNE CENTRE */}
            <div className="space-y-4">
              {/* Charges patronales & salariales */}
              {data.chargesPayroll && data.chargesPayroll.totalCharges > 0 ? (
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm font-semibold flex items-center justify-between">
                      <span>Charges sociales</span>
                      <span className="text-xs text-muted-foreground font-normal">
                        {data.chargesPayroll.period
                          ? (() => {
                            const [y, m] = data.chargesPayroll!.period.split("-");
                            const mois = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
                            return `${mois[parseInt(m ?? "1") - 1] ?? m} ${y}`;
                          })()
                          : ""}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-1 pb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-32 h-32 shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: "Charges salariales", value: data.chargesPayroll.chargesSalariales },
                                { name: "Charges patronales", value: data.chargesPayroll.chargesPatronales },
                              ]}
                              cx="50%" cy="50%"
                              innerRadius={28} outerRadius={52}
                              dataKey="value" startAngle={90} endAngle={-270}
                            >
                              <Cell fill="#0d9488" />
                              <Cell fill="#0891b2" />
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <p className="text-2xl font-bold text-foreground">
                            {formatFCFA(data.chargesPayroll.totalCharges)}
                          </p>
                          <p className="text-xs text-muted-foreground">Charges totales</p>
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-teal-600 inline-block" />Charges salariales</span>
                            <span className="font-medium">{formatFCFA(data.chargesPayroll.chargesSalariales)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-500 inline-block" />Charges patronales</span>
                            <span className="font-medium">{formatFCFA(data.chargesPayroll.chargesPatronales)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-5 flex items-center gap-3 text-muted-foreground">
                    <Wallet className="w-5 h-5 shrink-0" />
                    <p className="text-sm">Aucun bulletin de paie clôturé ce mois.</p>
                  </CardContent>
                </Card>
              )}

              {/* Répartition des âges */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-semibold">Répartition des âges</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-4">
                  {data.ageDistribution.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">Dates de naissance non renseignées.</p>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="w-28 h-28 shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={data.ageDistribution}
                              cx="50%" cy="50%"
                              innerRadius={22} outerRadius={50}
                              dataKey="value"
                              labelLine={false}
                              label={CustomPieLabel}
                            >
                              {data.ageDistribution.map((_, i) => (
                                <Cell key={i} fill={AGE_COLORS[i % AGE_COLORS.length]} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex-1 space-y-1.5">
                        {data.ageDistribution.map((d, i) => (
                          <div key={d.name} className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: AGE_COLORS[i % AGE_COLORS.length] }} />
                              {d.name}
                            </span>
                            <span className="font-semibold">{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* COLONNE DROITE */}
            <div className="space-y-4">
              {/* Effectif par département */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" /> Effectif par département
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-1 pb-3">
                  {data.distributionByDepartment.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Aucun département configuré.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {data.distributionByDepartment.map((d) => {
                        const max = Math.max(...data.distributionByDepartment.map(x => x.count), 1);
                        const pct = (d.count / max) * 100;
                        return (
                          <div key={d.department}>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="font-medium truncate max-w-[140px]">{d.department}</span>
                              <span className="text-muted-foreground shrink-0 ml-2">{d.count}</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Embauches récentes */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-600" /> Embauches récentes
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-1 pb-3">
                  {data.recentHires.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Aucune embauche enregistrée.</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {data.recentHires.map((h) => (
                        <li key={h.id}>
                          <Link href={`/collaborators/${h.id}`} className="flex items-center gap-2.5 group">
                            <Avatar className="w-8 h-8 shrink-0">
                              {h.avatarUrl && <AvatarImage src={h.avatarUrl} />}
                              <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                                {(h.firstName[0] + h.lastName[0]).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                {h.firstName} {h.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(h.hireDate).toLocaleDateString("fr-FR")}
                              </p>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ── BOTTOM CHARTS ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Évolution de l'effectif */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-semibold">Évolution de l'effectif</CardTitle>
                <p className="text-xs text-muted-foreground">Embauches sur les 6 derniers mois</p>
              </CardHeader>
              <CardContent className="pb-4">
                {data.monthlyHires.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
                    Aucune embauche enregistrée sur la période.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={data.monthlyHires.map(m => ({ ...m, mois: monthLabel(m.month) }))} barSize={28}>
                      <XAxis dataKey="mois" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <ReTooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                        formatter={(v: number) => [`${v} embauche${v > 1 ? "s" : ""}`, ""]}
                      />
                      <Bar dataKey="count" name="Embauches" fill="#0d9488" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Contrats arrivant à échéance */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" /> Contrats à surveiller
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-1 pb-3">
                {data.contractsExpiringSoon.length === 0 ? (
                  <div className="py-6 flex flex-col items-center text-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                      <UserCheck className="w-5 h-5 text-emerald-600" />
                    </div>
                    <p className="text-sm text-muted-foreground">Aucun contrat n'expire dans les 30 jours.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.contractsExpiringSoon.map(c => (
                      <div key={c.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                            <UserX className="w-3.5 h-3.5 text-amber-700" />
                          </div>
                          <div>
                            <p className="text-sm font-medium leading-tight">{c.collaboratorName}</p>
                            <p className="text-xs text-muted-foreground">{c.type}</p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">
                          {new Date(c.endDate).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </HrShell>
  );
}
