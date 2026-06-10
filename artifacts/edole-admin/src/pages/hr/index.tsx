import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { HrShell } from "./_layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Briefcase, FileSignature, AlertTriangle, Building2, Bell, UserCheck, CalendarClock } from "lucide-react";

type Dashboard = {
  kpis: { totalCollaborators: number; activeContracts: number; departmentsCount: number; contractsExpiringSoon: number };
  distributionByDepartment: { department: string; count: number }[];
  recentHires: { id: string; firstName: string; lastName: string; hireDate: string; avatarUrl?: string }[];
  contractsExpiringSoon: { id: string; collaboratorName: string; type: string; endDate: string }[];
};

type HrAlerts = {
  expiringContracts: { id: string; collaboratorName: string; type: string; endDate: string; daysLeft: number; urgency: "high" | "medium"; poste: string | null }[];
  trialEnding: { id: string; collaboratorName: string; type: string; startDate: string; daysSinceStart: number | null; poste: string | null }[];
  anniversaries: { id: string; collaboratorName: string; startDate: string; years: number }[];
};

const KpiCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) => (
  <Card>
    <CardContent className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-md flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <div className="text-3xl font-bold text-foreground">{value}</div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
    </CardContent>
  </Card>
);

export default function HrDashboard() {
  const { data, isLoading } = useQuery<Dashboard>({
    queryKey: ["hr-dashboard"],
    queryFn: () => apiFetch("/api/hr/dashboard"),
  });

  const { data: alerts } = useQuery<HrAlerts>({
    queryKey: ["hr-alerts"],
    queryFn: () => apiFetch("/api/hr/alerts/upcoming"),
  });

  return (
    <HrShell title="Ressources Humaines" subtitle="Collaborateurs · Départements · Contrats · Affectations">
      {isLoading || !data ? (
        <div className="text-sm text-muted-foreground">Chargement…</div>
      ) : (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard icon={Users} label="Collaborateurs" value={data.kpis.totalCollaborators} color="bg-primary" />
            <KpiCard icon={FileSignature} label="Contrats actifs" value={data.kpis.activeContracts} color="bg-emerald-600" />
            <KpiCard icon={Building2} label="Départements" value={data.kpis.departmentsCount} color="bg-indigo-600" />
            <KpiCard icon={AlertTriangle} label="Contrats échéance ≤ 30j" value={data.kpis.contractsExpiringSoon} color="bg-amber-600" />
          </div>

          {/* Alertes RH automatiques */}
          {alerts && (alerts.expiringContracts.length > 0 || alerts.trialEnding.length > 0 || alerts.anniversaries.length > 0) && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Bell className="w-4 h-4" /> Alertes & rappels automatiques
              </h2>

              {/* Contrats expirants */}
              {alerts.expiringContracts.length > 0 && (
                <Card className="border-l-4 border-l-amber-500">
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
                      <AlertTriangle className="w-4 h-4" />
                      {alerts.expiringContracts.length} contrat{alerts.expiringContracts.length > 1 ? "s" : ""} expirant dans les 60 jours
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 pb-3">
                    <div className="space-y-1.5">
                      {alerts.expiringContracts.map(c => (
                        <div key={c.id} className="flex items-center justify-between text-sm p-2 rounded-md bg-amber-50">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{c.collaboratorName}</span>
                            {c.poste && <span className="text-xs text-muted-foreground">— {c.poste}</span>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className="text-xs">{c.type}</Badge>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.urgency === "high" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                              J−{c.daysLeft}
                            </span>
                            <span className="text-xs text-muted-foreground">{c.endDate ? new Date(c.endDate).toLocaleDateString("fr-FR") : "—"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Nouveaux collaborateurs (période essai probable) */}
              {alerts.trialEnding.length > 0 && (
                <Card className="border-l-4 border-l-blue-400">
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm flex items-center gap-2 text-blue-700">
                      <UserCheck className="w-4 h-4" />
                      {alerts.trialEnding.length} collaborateur{alerts.trialEnding.length > 1 ? "s" : ""} en période d'intégration (&lt; 90j)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 pb-3">
                    <div className="space-y-1.5">
                      {alerts.trialEnding.map(t => (
                        <div key={t.id} className="flex items-center justify-between text-sm p-2 rounded-md bg-blue-50">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{t.collaboratorName}</span>
                            {t.poste && <span className="text-xs text-muted-foreground">— {t.poste}</span>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className="text-xs">{t.type}</Badge>
                            <span className="text-xs text-muted-foreground">
                              depuis le {t.startDate ? new Date(t.startDate).toLocaleDateString("fr-FR") : "—"}
                              {t.daysSinceStart != null && ` (j+${t.daysSinceStart})`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Anniversaires */}
              {alerts.anniversaries.length > 0 && (
                <Card className="border-l-4 border-l-emerald-500">
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm flex items-center gap-2 text-emerald-700">
                      <CalendarClock className="w-4 h-4" />
                      {alerts.anniversaries.length} anniversaire{alerts.anniversaries.length > 1 ? "s" : ""} de contrat ce mois
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 pb-3">
                    <div className="flex flex-wrap gap-2">
                      {alerts.anniversaries.map(a => (
                        <div key={a.id} className="flex items-center gap-2 bg-emerald-50 rounded-full px-3 py-1.5 text-sm">
                          <span className="font-medium">{a.collaboratorName}</span>
                          <Badge variant="secondary" className="text-xs">{a.years} an{a.years > 1 ? "s" : ""}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4" /> Effectif par département</CardTitle></CardHeader>
              <CardContent>
                {data.distributionByDepartment.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun département configuré.</p>
                ) : (
                  <div className="space-y-2.5">
                    {data.distributionByDepartment.map((d) => {
                      const max = Math.max(...data.distributionByDepartment.map((x) => x.count), 1);
                      const pct = (d.count / max) * 100;
                      return (
                        <div key={d.department}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="font-medium text-foreground">{d.department}</span>
                            <span className="text-muted-foreground">{d.count}</span>
                          </div>
                          <div className="h-2 bg-muted rounded overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Briefcase className="w-4 h-4" /> Embauches récentes</CardTitle></CardHeader>
              <CardContent>
                {data.recentHires.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune embauche enregistrée.</p>
                ) : (
                  <ul className="space-y-3">
                    {data.recentHires.map((h) => (
                      <li key={h.id} className="flex items-center gap-3">
                        <Avatar className="w-9 h-9 border border-border">
                          {h.avatarUrl && <AvatarImage src={h.avatarUrl} />}
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{(h.firstName[0] + h.lastName[0]).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="text-sm font-medium">{h.firstName} {h.lastName}</div>
                          <div className="text-xs text-muted-foreground">Embauché·e le {new Date(h.hireDate).toLocaleDateString("fr-FR")}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-700" /> Contrats arrivant à échéance</CardTitle></CardHeader>
            <CardContent>
              {data.contractsExpiringSoon.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun contrat n'arrive à échéance dans les 30 prochains jours.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground border-b">
                    <tr><th className="py-2">Collaborateur</th><th>Type</th><th>Échéance</th></tr>
                  </thead>
                  <tbody>
                    {data.contractsExpiringSoon.map((c) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="py-2.5 font-medium">{c.collaboratorName}</td>
                        <td><Badge variant="outline">{c.type}</Badge></td>
                        <td className="text-muted-foreground">{new Date(c.endDate).toLocaleDateString("fr-FR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </HrShell>
  );
}
