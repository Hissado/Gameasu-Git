/**
 * Phase 10 — RH IA : cockpit absentéisme, charge, contrats expirants.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, AlertTriangle, Users, Clock, FileWarning, Flame } from "lucide-react";

type Overview = {
  headcount: number; workDays: number; presentSessions: number;
  absenceRate: number; latenessRate: number; productivityRate: number;
  lateSessions: number; earlyLeave: number;
  totalEffectiveHours: number; totalExpectedHours: number;
  expiringContracts: number; expiringDocs: number; expiredDocs: number;
};
type Absent = {
  days: number; workDays: number; count: number;
  ranked: Array<{
    collaboratorId: string; name: string; email: string | null;
    workDays: number; presentDays: number; absentDays: number;
    lateCount: number; earlyLeaveCount: number;
    absenceRate: number; latenessRate: number;
    score: number; tier: "critical" | "high" | "medium" | "low";
  }>;
};
type Workload = {
  days: number; count: number;
  counts: { overload: number; ok: number; under: number; absent: number };
  rows: Array<{
    collaboratorId: string; name: string; sessions: number;
    effectiveHours: number; expectedHours: number; ratio: number;
    status: "overload" | "ok" | "under" | "absent";
  }>;
};
type Expiring = {
  days: number;
  contracts: { count: number; rows: Array<{ id: string; name: string; type: string; jobTitle: string | null; endDate: string; daysLeft: number; severity: "low"|"medium"|"high" }> };
  documents: { count: number; rows: Array<{ id: string; collaboratorName: string; type: string; name: string; expiresAt: string; daysLeft: number; severity: "low"|"medium"|"high" }> };
};

const TIER: Record<string, { cls: string; label: string }> = {
  critical: { cls: "bg-red-50 text-red-700 border-red-200", label: "Critique" },
  high: { cls: "bg-orange-50 text-orange-700 border-orange-200", label: "Élevé" },
  medium: { cls: "bg-amber-50 text-amber-700 border-amber-200", label: "Modéré" },
  low: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Sain" },
};
const SEV: Record<string, string> = {
  low: "bg-blue-50 text-blue-700 border-blue-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-red-50 text-red-700 border-red-200",
};
const STATUS: Record<string, { cls: string; label: string }> = {
  overload: { cls: "bg-red-50 text-red-700 border-red-200", label: "Surcharge" },
  ok: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Optimal" },
  under: { cls: "bg-amber-50 text-amber-700 border-amber-200", label: "Sous-charge" },
  absent: { cls: "bg-slate-100 text-slate-700 border-slate-200", label: "Absent" },
};

export default function HrIntelligencePage() {
  const [absentDays, setAbsentDays] = useState(30);
  const [workloadDays, setWorkloadDays] = useState(14);
  const [expHorizon, setExpHorizon] = useState(90);

  const overview = useQuery<Overview>({ queryKey: ["hr-int-overview"], queryFn: () => apiFetch("/api/hr/intelligence/overview") });
  const absent = useQuery<Absent>({ queryKey: ["hr-int-absent", absentDays], queryFn: () => apiFetch(`/api/hr/intelligence/absenteeism?days=${absentDays}`) });
  const workload = useQuery<Workload>({ queryKey: ["hr-int-workload", workloadDays], queryFn: () => apiFetch(`/api/hr/intelligence/workload?days=${workloadDays}`) });
  const expiring = useQuery<Expiring>({ queryKey: ["hr-int-expiring", expHorizon], queryFn: () => apiFetch(`/api/hr/intelligence/expiring?days=${expHorizon}`) });

  if (overview.isLoading || !overview.data) return <div className="py-12 text-center"><Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground" /></div>;
  const ov = overview.data;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">RH IA</p>
        <h1 className="text-3xl font-bold tracking-tight">Pilotage RH intelligent</h1>
        <p className="text-muted-foreground mt-1">Absentéisme, charge de travail, contrats et documents à échéance.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold">Effectifs actifs</p><p className="text-2xl font-bold">{ov.headcount}</p><p className="text-[10px] text-muted-foreground mt-1">{ov.workDays} jours ouvrés (30 j)</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold">Absentéisme</p><p className={`text-2xl font-bold ${ov.absenceRate > 10 ? "text-red-600" : "text-emerald-600"}`}>{ov.absenceRate}%</p><p className="text-[10px] text-muted-foreground mt-1">{ov.presentSessions} pointages</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold">Retards</p><p className={`text-2xl font-bold ${ov.latenessRate > 15 ? "text-amber-600" : "text-emerald-600"}`}>{ov.latenessRate}%</p><p className="text-[10px] text-muted-foreground mt-1">{ov.lateSessions} séances en retard</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold">Productivité</p><p className="text-2xl font-bold text-primary">{ov.productivityRate}%</p><p className="text-[10px] text-muted-foreground mt-1">{ov.totalEffectiveHours} h / {ov.totalExpectedHours} h</p></CardContent></Card>
      </div>

      <Tabs defaultValue="absent" className="w-full">
        <TabsList>
          <TabsTrigger value="absent"><Flame className="w-3.5 h-3.5 mr-1.5" />Absentéisme</TabsTrigger>
          <TabsTrigger value="workload"><Users className="w-3.5 h-3.5 mr-1.5" />Charge</TabsTrigger>
          <TabsTrigger value="contracts"><FileWarning className="w-3.5 h-3.5 mr-1.5" />Contrats ({ov.expiringContracts})</TabsTrigger>
          <TabsTrigger value="docs"><AlertTriangle className="w-3.5 h-3.5 mr-1.5" />Documents ({ov.expiringDocs + ov.expiredDocs})</TabsTrigger>
        </TabsList>

        <TabsContent value="absent" className="space-y-3">
          <div className="flex gap-2 items-center">
            <span className="text-sm text-muted-foreground">Fenêtre :</span>
            {[14, 30, 60, 90].map((d) => (
              <Button key={d} size="sm" variant={absentDays === d ? "default" : "outline"} onClick={() => setAbsentDays(d)}>{d} j</Button>
            ))}
          </div>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Collaborateurs à risque RH</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {absent.isLoading && <Loader2 className="w-5 h-5 animate-spin mx-auto my-4" />}
              {absent.data?.ranked.slice(0, 50).map((r, i) => {
                const t = TIER[r.tier];
                return (
                  <div key={r.collaboratorId} className="border rounded p-3">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-muted-foreground w-6">#{i + 1}</span>
                        <Badge variant="outline" className={t.cls}>{t.label}</Badge>
                        <span className="font-medium text-sm">{r.name}</span>
                        {r.email && <span className="text-xs text-muted-foreground">{r.email}</span>}
                      </div>
                      <p className="text-sm font-bold text-primary">Score {r.score}/100</p>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-[11px]">
                      <div><span className="text-muted-foreground">Présents</span><p className="font-medium">{r.presentDays}/{r.workDays} j</p></div>
                      <div><span className="text-muted-foreground">Absents</span><p className="font-medium text-red-600">{r.absentDays} j ({r.absenceRate}%)</p></div>
                      <div><span className="text-muted-foreground">Retards</span><p className="font-medium text-amber-600">{r.lateCount} ({r.latenessRate}%)</p></div>
                      <div><span className="text-muted-foreground">Départs anticipés</span><p className="font-medium">{r.earlyLeaveCount}</p></div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workload" className="space-y-3">
          <div className="flex gap-2 items-center">
            <span className="text-sm text-muted-foreground">Fenêtre :</span>
            {[7, 14, 30].map((d) => (
              <Button key={d} size="sm" variant={workloadDays === d ? "default" : "outline"} onClick={() => setWorkloadDays(d)}>{d} j</Button>
            ))}
          </div>
          {workload.data && (
            <div className="grid grid-cols-4 gap-2">
              {(["overload", "ok", "under", "absent"] as const).map((k) => (
                <Card key={k}><CardContent className="p-3 text-center"><Badge variant="outline" className={STATUS[k].cls}>{STATUS[k].label}</Badge><p className="text-2xl font-bold mt-1">{workload.data!.counts[k]}</p></CardContent></Card>
              ))}
            </div>
          )}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Charge par collaborateur</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {workload.data?.rows.map((r) => {
                const s = STATUS[r.status];
                return (
                  <div key={r.collaboratorId} className="border rounded p-2.5">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={s.cls}>{s.label}</Badge>
                        <span className="font-medium text-sm">{r.name}</span>
                      </div>
                      <span className={`text-sm font-bold ${r.ratio > 115 ? "text-red-600" : r.ratio < 85 ? "text-amber-600" : "text-emerald-600"}`}>{r.ratio}%</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span><Clock className="w-2.5 h-2.5 inline mr-0.5" />{r.effectiveHours} h effectives / {r.expectedHours} h attendues</span>
                      <span>{r.sessions} séances</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts" className="space-y-3">
          <div className="flex gap-2 items-center">
            <span className="text-sm text-muted-foreground">Horizon :</span>
            {[30, 60, 90, 180].map((d) => (
              <Button key={d} size="sm" variant={expHorizon === d ? "default" : "outline"} onClick={() => setExpHorizon(d)}>{d} j</Button>
            ))}
          </div>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Contrats à renouveler</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {expiring.isLoading && <Loader2 className="w-5 h-5 animate-spin mx-auto my-4" />}
              {expiring.data?.contracts.rows.length === 0 && <p className="text-xs italic text-muted-foreground">Aucun contrat n'expire dans les {expHorizon} prochains jours.</p>}
              {expiring.data?.contracts.rows.map((c) => (
                <div key={c.id} className="flex items-center justify-between border rounded p-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={SEV[c.severity]}>{c.severity}</Badge>
                    <Badge variant="outline">{c.type}</Badge>
                    <span className="font-medium text-sm">{c.name}</span>
                    {c.jobTitle && <span className="text-xs text-muted-foreground">{c.jobTitle}</span>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{c.endDate}</p>
                    <p className={`text-sm font-bold ${c.daysLeft < 0 ? "text-red-600" : c.daysLeft <= 30 ? "text-orange-600" : "text-amber-600"}`}>{c.daysLeft < 0 ? `Expiré (${-c.daysLeft} j)` : `${c.daysLeft} j restants`}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs" className="space-y-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Documents RH à renouveler</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {expiring.isLoading && <Loader2 className="w-5 h-5 animate-spin mx-auto my-4" />}
              {expiring.data?.documents.rows.length === 0 && <p className="text-xs italic text-muted-foreground">Aucun document n'expire dans les {expHorizon} prochains jours.</p>}
              {expiring.data?.documents.rows.map((d) => (
                <div key={d.id} className="flex items-center justify-between border rounded p-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={SEV[d.severity]}>{d.severity}</Badge>
                    <Badge variant="outline">{d.type}</Badge>
                    <span className="font-medium text-sm">{d.name}</span>
                    <span className="text-xs text-muted-foreground">{d.collaboratorName}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{d.expiresAt}</p>
                    <p className={`text-sm font-bold ${d.daysLeft < 0 ? "text-red-600" : d.daysLeft <= 30 ? "text-orange-600" : "text-amber-600"}`}>{d.daysLeft < 0 ? `Expiré (${-d.daysLeft} j)` : `${d.daysLeft} j restants`}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
