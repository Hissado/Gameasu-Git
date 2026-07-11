import React, { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { HrShell } from "./_layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatFCFA, formatFCFACompact } from "@/lib/format";
import {
  AlertCircle,
  Cake,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileWarning,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import {
  Cell,
  Bar,
  BarChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function daysLeftInMonth() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDay - now.getDate();
}

function monthNameFr(monthIndex: number) {
  return new Date(2000, monthIndex, 1).toLocaleDateString("fr-FR", { month: "long" });
}

function shortMonthFr(monthIndex: number) {
  return new Date(2000, monthIndex, 1).toLocaleDateString("fr-FR", { month: "short" });
}

const AGE_COLORS = ["#0e7490", "#0891b2", "#22d3ee", "#a5f3fc", "#cffafe"];
const CHARGE_COLORS = { salariales: "#0e7490", patronales: "#f97316" };

// ─────────────────────────────────────────────────────────────────
// Mini Calendar
// ─────────────────────────────────────────────────────────────────

function MiniCalendar({ events }: { events: { dayOfMonth: number | null; name: string }[] }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startOffset = (firstDow + 6) % 7;

  const eventDays = new Set(
    events
      .filter((e) => e.dayOfMonth && viewYear === today.getFullYear() && viewMonth === today.getMonth())
      .map((e) => e.dayOfMonth)
  );

  const prev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const next = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday = (d: number | null) =>
    d !== null && d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  const DOW = ["L", "M", "M", "J", "V", "S", "D"];

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-sm capitalize text-slate-800">
          {monthNameFr(viewMonth)} {viewYear}
        </span>
        <div className="flex gap-1">
          <button onClick={prev} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <button onClick={next} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0">
        {DOW.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-bold text-slate-400 pb-1.5">{d}</div>
        ))}
        {cells.map((d, i) => (
          <div key={i} className="flex items-center justify-center py-0.5">
            {d === null ? null : (
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium relative",
                isToday(d) && "bg-cyan-700 text-white font-bold",
                !isToday(d) && "text-slate-700 hover:bg-slate-100",
                eventDays.has(d) && !isToday(d) && "text-orange-600 font-semibold",
              )}>
                {d}
                {eventDays.has(d) && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-orange-400" />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Month-close gauge
// ─────────────────────────────────────────────────────────────────

function MonthCloseGauge({ daysLeft }: { daysLeft: number }) {
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const r = 48;
  const cx = 60;
  const cy = 60;
  const circumference = Math.PI * r;
  const strokeDashoffset = circumference * Math.max(0, Math.min(1, daysLeft / daysInMonth));

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 120, height: 70 }}>
        <svg width="120" height="70" viewBox="0 0 120 70">
          <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
          <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none"
            stroke={daysLeft <= 5 ? "#ef4444" : daysLeft <= 10 ? "#f97316" : "#0e7490"}
            strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className="text-2xl font-extrabold text-slate-800 leading-none">
            {String(daysLeft).padStart(2, "0")}
          </span>
        </div>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 -mt-1">
        Jours restants
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Tooltip charges
// ─────────────────────────────────────────────────────────────────

function ChargeTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <div className="font-semibold text-slate-800">{payload[0].name}</div>
      <div className="text-slate-600 mt-0.5">{formatFCFA(payload[0].value)}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────

export default function HrOverview() {
  const { user } = useAuth();
  const [eventsTab, setEventsTab] = useState<"today" | "upcoming">("today");

  const { data: hrDash, isLoading } = useQuery<any>({
    queryKey: ["hr-dashboard"],
    queryFn: () => apiFetch("/api/hr/dashboard"),
    staleTime: 60_000,
  });

  const kpis = hrDash?.kpis ?? {};
  const contractsExpiring: any[] = hrDash?.contractsExpiringSoon ?? [];
  const trialPeriod: any[] = hrDash?.trialPeriodCollaborators ?? [];
  const birthdaysThisMonth: any[] = hrDash?.birthdaysThisMonth ?? [];
  const ageDistribution: any[] = hrDash?.ageDistribution ?? [];
  const monthlyHires: any[] = hrDash?.monthlyHires ?? [];
  const charges = hrDash?.chargesPayroll;
  const daysLeft = daysLeftInMonth();

  const now = new Date();
  const monthLabel = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  const cotisationsDate = `15/${monthLabel}`;
  const impotsDate = `10/${monthLabel}`;

  const chargesData = charges
    ? [
        { name: "Charges salariales", value: charges.chargesSalariales },
        { name: "Charges patronales", value: charges.chargesPatronales },
      ]
    : [];

  const hiresData = monthlyHires.map((m: any) => ({
    mois: shortMonthFr(parseInt(m.month.split("-")[1]) - 1),
    embauches: m.count,
  }));

  const todayDay = now.getDate();
  const birthdaysToday = birthdaysThisMonth.filter((b: any) => b.dayOfMonth === todayDay);
  const birthdaysUpcoming = birthdaysThisMonth.filter((b: any) => b.dayOfMonth > todayDay);
  const totalActions = contractsExpiring.length + trialPeriod.length;

  const greeting = (() => {
    const h = now.getHours();
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon après-midi";
    return "Bonsoir";
  })();

  const fullDate = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <HrShell title="Vue d'ensemble" subtitle="Tableau de bord RH">
      <div className="space-y-5">

        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {greeting}{user?.firstName ? ` ${user.firstName}` : ""} ! 👋
          </h2>
          <p className="text-sm text-slate-500 mt-0.5 capitalize">{fullDate}</p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
            </div>
            <Skeleton className="h-36 rounded-2xl" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
            </div>
          </div>
        ) : (
          <>
            {/* ── KPI Row ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

              {/* Collaborateurs */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Collaborateurs
                    </div>
                    <div className="text-4xl font-extrabold text-slate-900 mt-2 leading-none">
                      {kpis.totalCollaborators ?? 0}
                    </div>
                  </div>
                  <span className={cn(
                    "flex items-center gap-0.5 text-xs font-bold mt-1",
                    kpis.tauxTurnover > 5 ? "text-rose-600" : "text-emerald-600"
                  )}>
                    {kpis.tauxTurnover > 5 ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                    {kpis.tauxTurnover > 0 ? `-${kpis.tauxTurnover}%` : "+0%"}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-slate-500">Taux de Turnover</span>
                  <span className={cn(
                    "text-xs font-bold px-2 py-0.5 rounded-full",
                    kpis.tauxTurnover > 5 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                  )}>
                    {kpis.tauxTurnover ?? 0}%
                  </span>
                </div>
              </div>

              {/* Absents */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5" /> Absents
                    </div>
                    <div className="text-4xl font-extrabold text-slate-900 mt-2 leading-none">
                      {kpis.absentsToday ?? 0}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-slate-500">Taux d'absences</span>
                  <span className={cn(
                    "text-xs font-bold px-2 py-0.5 rounded-full",
                    kpis.tauxAbsence > 10 ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
                  )}>
                    {kpis.tauxAbsence ?? 0}%
                  </span>
                </div>
              </div>

              {/* Coût salarial global */}
              <div className="rounded-2xl p-5 shadow-sm" style={{ background: "linear-gradient(135deg, #0f4c5c 0%, #0e7490 100%)" }}>
                <div className="text-xs font-semibold uppercase tracking-widest text-cyan-200">
                  Coût salarial global
                </div>
                <div className="mt-2">
                  <span className="text-3xl font-extrabold text-white leading-none">
                    {formatFCFACompact(kpis.masseSalariale ?? 0)}
                  </span>
                </div>
                <div className="mt-2 text-xs text-cyan-300">
                  Masse salariale brute · {now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                </div>
              </div>
            </div>

            {/* ── Main 2-col ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* Left 2/3 */}
              <div className="lg:col-span-2 space-y-5">

                {/* Actions requises */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-orange-500" />
                      <span className="font-semibold text-slate-800 text-sm">Vos actions requises</span>
                      {totalActions > 0 && (
                        <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">
                          {totalActions}
                        </span>
                      )}
                    </div>
                    <Link href="/collaborateurs">
                      <span className="text-xs text-cyan-700 font-semibold hover:underline cursor-pointer">Voir tout</span>
                    </Link>
                  </div>
                  {totalActions === 0 ? (
                    <div className="text-center py-4 text-sm text-slate-400">Aucune action requise</div>
                  ) : (
                    <div className="space-y-2">
                      {contractsExpiring.map((c: any) => (
                        <Link key={c.id} href={`/collaborateurs/${c.collaboratorId}`}>
                          <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">
                            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                              <FileWarning className="w-4 h-4 text-orange-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-slate-800 truncate">Fin de contrat</div>
                              <div className="text-xs text-slate-500 truncate">{c.collaboratorName}</div>
                            </div>
                            <Badge variant="outline" className="text-xs border-orange-200 text-orange-700 bg-orange-50 shrink-0">
                              {c.endDate ? new Date(c.endDate).toLocaleDateString("fr-FR") : "—"}
                            </Badge>
                          </div>
                        </Link>
                      ))}
                      {trialPeriod.map((c: any) => (
                        <Link key={c.id} href={`/collaborateurs/${c.id}`}>
                          <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">
                            <Avatar className="w-8 h-8 shrink-0">
                              <AvatarImage src={c.avatarUrl} />
                              <AvatarFallback className="bg-cyan-100 text-cyan-700 text-xs font-bold">
                                {(c.firstName?.[0] ?? "") + (c.lastName?.[0] ?? "")}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-slate-800 truncate">Fin de période d'essai</div>
                              <div className="text-xs text-slate-500 truncate">{c.firstName} {c.lastName}</div>
                            </div>
                            <Badge variant="outline" className="text-xs border-slate-200 text-slate-600 shrink-0">
                              Embauché {c.hireDate ? new Date(c.hireDate).toLocaleDateString("fr-FR") : "—"}
                            </Badge>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Charges + Clôture */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                  {/* Charges patronales */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-800 text-sm">Charges patronales et salariales</span>
                      {charges?.period && <span className="text-[10px] text-slate-400">{charges.period}</span>}
                    </div>
                    {!charges ? (
                      <div className="flex flex-col items-center justify-center py-6 text-slate-400 text-sm">Aucun bulletin clôturé</div>
                    ) : (
                      <>
                        <div className="flex items-center gap-4 mt-3">
                          <div style={{ width: 100, height: 100 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={chargesData} cx="50%" cy="50%" innerRadius={28} outerRadius={42} dataKey="value" strokeWidth={2}>
                                  <Cell fill={CHARGE_COLORS.salariales} />
                                  <Cell fill={CHARGE_COLORS.patronales} />
                                </Pie>
                                <RTooltip content={<ChargeTooltip />} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="flex-1 min-w-0 space-y-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHARGE_COLORS.salariales }} />
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Salariales</span>
                              </div>
                              <div className="text-sm font-bold text-slate-800 mt-0.5">{formatFCFACompact(charges.chargesSalariales)}</div>
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHARGE_COLORS.patronales }} />
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Patronales</span>
                              </div>
                              <div className="text-sm font-bold text-slate-800 mt-0.5">{formatFCFACompact(charges.chargesPatronales)}</div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <div className="text-xs text-slate-500">Charges totales</div>
                          <div className="text-xl font-extrabold text-slate-900 mt-0.5">{formatFCFA(charges.totalCharges)}</div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Clôture du mois */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col items-center justify-between">
                    <div className="w-full">
                      <span className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-500" />
                        Clôture du mois de {now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                      </span>
                    </div>
                    <div className="my-4">
                      <MonthCloseGauge daysLeft={daysLeft} />
                    </div>
                    <Link href="/rh/paie" className="w-full">
                      <Button variant="outline" className="w-full border-cyan-700 text-cyan-700 hover:bg-cyan-50 text-sm font-semibold">
                        Clôturer votre paie
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Dates clés */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <CalendarDays className="w-4 h-4 text-slate-500" />
                    <span className="font-semibold text-slate-800 text-sm">Dates clés</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Paiement cotisations sociales</span>
                      <span className="font-semibold text-cyan-700">{cotisationsDate}</span>
                    </div>
                    <div className="h-px bg-slate-100" />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Paiement impôts (IRPP/IPTS)</span>
                      <span className="font-semibold text-cyan-700">{impotsDate}</span>
                    </div>
                  </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                  {/* Répartition des âges */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <span className="font-semibold text-slate-800 text-sm">Répartition des âges</span>
                    <p className="text-xs text-slate-400 mt-0.5 mb-3">Ensemble des collaborateurs</p>
                    {ageDistribution.length === 0 ? (
                      <div className="flex items-center justify-center h-32 text-sm text-slate-400">Données insuffisantes</div>
                    ) : (
                      <>
                        <div style={{ height: 130 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={ageDistribution} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" strokeWidth={2}>
                                {ageDistribution.map((_: any, i: number) => <Cell key={i} fill={AGE_COLORS[i % AGE_COLORS.length]} />)}
                              </Pie>
                              <RTooltip formatter={(v: any, n: any) => [`${v} collab.`, n]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                          {ageDistribution.map((a: any, i: number) => (
                            <div key={i} className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: AGE_COLORS[i % AGE_COLORS.length] }} />
                              <span className="text-[10px] text-slate-500">{a.name}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Évolution effectif */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <span className="font-semibold text-slate-800 text-sm">Évolution de l'effectif</span>
                    <p className="text-xs text-slate-400 mt-0.5 mb-3">Les 6 derniers mois</p>
                    {hiresData.length === 0 ? (
                      <div className="flex items-center justify-center h-32 text-sm text-slate-400">Aucune embauche récente</div>
                    ) : (
                      <div style={{ height: 150 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={hiresData} barSize={20}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="mois" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
                            <RTooltip formatter={(v: any) => [`${v} embauche(s)`, "Embauches"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                            <Bar dataKey="embauches" radius={[4, 4, 0, 0]} fill="#0e7490" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right 1/3 — Calendar + Events */}
              <div className="space-y-5">

                {/* Mini calendar + events */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <MiniCalendar events={birthdaysThisMonth} />

                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <div className="flex rounded-lg border border-slate-200 overflow-hidden mb-3 text-xs font-semibold">
                      <button
                        onClick={() => setEventsTab("today")}
                        className={cn("flex-1 py-1.5 transition-colors",
                          eventsTab === "today" ? "bg-cyan-700 text-white" : "text-slate-500 hover:bg-slate-50")}
                      >
                        Évènements du jour
                      </button>
                      <button
                        onClick={() => setEventsTab("upcoming")}
                        className={cn("flex-1 py-1.5 transition-colors",
                          eventsTab === "upcoming" ? "bg-cyan-700 text-white" : "text-slate-500 hover:bg-slate-50")}
                      >
                        À venir
                      </button>
                    </div>

                    {eventsTab === "today" && (
                      <div className="space-y-2">
                        {birthdaysToday.length === 0 ? (
                          <div className="text-center py-4 text-xs text-slate-400">Aucun événement aujourd'hui</div>
                        ) : (
                          birthdaysToday.map((b: any) => (
                            <Link key={b.id} href={`/collaborateurs/${b.id}`}>
                              <div className="flex items-center gap-3 py-2 hover:bg-slate-50 rounded-lg px-1 transition-colors cursor-pointer">
                                <Avatar className="w-9 h-9 shrink-0">
                                  <AvatarImage src={b.avatarUrl} />
                                  <AvatarFallback className="bg-orange-100 text-orange-700 text-xs font-bold">
                                    {b.name?.split(" ").map((n: string) => n[0]).join("") ?? "?"}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1">
                                    <Cake className="w-3 h-3 text-orange-500" />
                                    <span className="text-xs font-semibold text-slate-700">Anniversaire</span>
                                  </div>
                                  <div className="text-xs text-slate-500 truncate">{b.name}</div>
                                  <div className="text-[10px] text-slate-400">Aujourd'hui</div>
                                </div>
                              </div>
                            </Link>
                          ))
                        )}
                      </div>
                    )}

                    {eventsTab === "upcoming" && (
                      <div className="space-y-2">
                        {birthdaysUpcoming.length === 0 ? (
                          <div className="text-center py-4 text-xs text-slate-400">Aucun événement à venir ce mois-ci</div>
                        ) : (
                          birthdaysUpcoming.slice(0, 5).map((b: any) => (
                            <Link key={b.id} href={`/collaborateurs/${b.id}`}>
                              <div className="flex items-center gap-3 py-2 hover:bg-slate-50 rounded-lg px-1 transition-colors cursor-pointer">
                                <Avatar className="w-8 h-8 shrink-0">
                                  <AvatarImage src={b.avatarUrl} />
                                  <AvatarFallback className="bg-slate-100 text-slate-600 text-xs font-bold">
                                    {b.name?.split(" ").map((n: string) => n[0]).join("") ?? "?"}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1">
                                    <Cake className="w-3 h-3 text-orange-400" />
                                    <span className="text-xs font-semibold text-slate-700 truncate">{b.name}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    Le {b.dayOfMonth} {now.toLocaleDateString("fr-FR", { month: "long" })}
                                  </div>
                                </div>
                              </div>
                            </Link>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Contrats à renouveler */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <FileWarning className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-semibold text-slate-800">Contrats à renouveler</span>
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded ml-0.5">30j</span>
                    {contractsExpiring.length > 0 && (
                      <span className="ml-auto text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                        {contractsExpiring.length}
                      </span>
                    )}
                  </div>
                  {contractsExpiring.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-5 gap-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                        <FileWarning className="w-4 h-4 text-emerald-500" />
                      </div>
                      <p className="text-xs text-slate-400 text-center">Aucun contrat à renouveler dans les 30 prochains jours</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {contractsExpiring.map((c: any) => {
                        const urgent = c.daysLeft <= 7;
                        const warning = !urgent && c.daysLeft <= 15;
                        return (
                          <Link key={c.id} href={`/collaborators/${c.collaboratorId}`}>
                            <div className={cn(
                              "flex items-center gap-2 text-xs py-2 px-2 rounded-lg cursor-pointer transition-colors",
                              urgent ? "hover:bg-red-50" : warning ? "hover:bg-orange-50" : "hover:bg-slate-50"
                            )}>
                              <div className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                                urgent ? "bg-red-100" : warning ? "bg-orange-100" : "bg-amber-50"
                              )}>
                                <FileWarning className={cn(
                                  "w-3.5 h-3.5",
                                  urgent ? "text-red-600" : warning ? "text-orange-500" : "text-amber-500"
                                )} />
                              </div>
                              <span className="flex-1 text-slate-700 font-medium truncate">{c.collaboratorName}</span>
                              <div className="shrink-0 text-right">
                                <div className={cn(
                                  "font-bold",
                                  urgent ? "text-red-600" : warning ? "text-orange-600" : "text-amber-600"
                                )}>
                                  {c.daysLeft === 0 ? "Aujourd'hui" : `J−${c.daysLeft}`}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {c.endDate ? new Date(c.endDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "—"}
                                </div>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                  {contractsExpiring.length > 0 && (
                    <Link href="/rh/contrats">
                      <div className="mt-3 pt-3 border-t border-slate-100 text-center text-xs text-cyan-700 font-semibold hover:underline cursor-pointer">
                        Gérer les contrats →
                      </div>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </HrShell>
  );
}
