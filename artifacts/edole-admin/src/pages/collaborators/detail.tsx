import React from "react";
import { useGetCollaborator, getGetCollaboratorQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Mail, Phone, Calendar, HardHat, Briefcase, FileSignature, Wrench, FolderArchive, GitBranch, Building2, BadgeCheck, ListTodo, ExternalLink } from "lucide-react";
import { formatDate, formatFCFA } from "@/lib/format";
import { Progress } from "@/components/ui/progress";

type Overview = {
  collaborator: any;
  department?: { id: string; name: string; color?: string } | null;
  position?: { id: string; title: string; level?: number } | null;
  manager?: { id: string; firstName: string; lastName: string } | null;
  assignments: Array<{ id: string; projectId: string; projectName: string; projectStatus: string; role: string; allocationPct: number; status: string; startDate?: string; endDate?: string }>;
  tasks: Array<{ id: string; title: string; status: string; dueDate?: string; priority?: string }>;
  equipments: Array<{ id: string; name: string; code?: string; status: string }>;
  ledProjects: Array<{ id: string; name: string; status: string }>;
  contracts: Array<{ id: string; type: string; status: string; startDate: string; endDate?: string; monthlySalary?: number; jobTitle?: string }>;
  documents: Array<{ id: string; type: string; name: string; fileUrl: string; expiresAt?: string }>;
  workload: { activeAssignments: number; totalAllocationPct: number; activeTasks: number; responsibleEquipmentsCount: number; ledProjectsCount: number };
};

const statusBadge = (s: string, palette: Record<string, string> = {}) => {
  const map: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700",
    completed: "bg-slate-200 text-slate-700",
    cancelled: "bg-red-100 text-red-700",
    terminated: "bg-slate-200 text-slate-700",
    expired: "bg-red-100 text-red-700",
    suspended: "bg-amber-100 text-amber-700",
    draft: "bg-blue-100 text-blue-700",
    available: "bg-emerald-100 text-emerald-700",
    in_use: "bg-amber-100 text-amber-700",
    maintenance: "bg-red-100 text-red-700",
    planning: "bg-blue-100 text-blue-700",
    in_progress: "bg-amber-100 text-amber-700",
    on_hold: "bg-slate-200 text-slate-700",
    done: "bg-emerald-100 text-emerald-700",
    todo: "bg-slate-200 text-slate-700",
    ...palette,
  };
  return <Badge className={`${map[s] || "bg-muted"} border-0`}>{s}</Badge>;
};

export default function CollaboratorDetail() {
  const [, params] = useRoute("/collaborators/:id");
  const id = params?.id || "";

  const { data: collaborator, isLoading } = useGetCollaborator(id, {
    query: { enabled: !!id, queryKey: getGetCollaboratorQueryKey(id) },
  });

  const { data: overview, isLoading: overviewLoading } = useQuery<Overview>({
    queryKey: ["hr-overview", id],
    queryFn: () => apiFetch(`/api/hr/collaborators/${id}/overview`),
    enabled: !!id,
  });

  if (isLoading || !collaborator) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <Skeleton className="h-10 w-32" />
        <Card><CardContent className="h-40" /></Card>
      </div>
    );
  }

  const wl = overview?.workload;
  const loadColor = (wl?.totalAllocationPct ?? 0) > 100 ? "[&>div]:bg-red-500" : (wl?.totalAllocationPct ?? 0) > 80 ? "[&>div]:bg-orange-500" : "[&>div]:bg-emerald-500";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-6">
          <Link href="/collaborators">
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-5">
            <Avatar className="w-20 h-20 border-4 border-background shadow-md">
              <AvatarImage src={collaborator.avatarUrl} />
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground font-bold">
                {collaborator.firstName[0]}{collaborator.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{collaborator.firstName} {collaborator.lastName}</h1>
              <p className="text-sm font-medium text-primary mt-1 uppercase tracking-wider">
                {overview?.position?.title || collaborator.position || "Fonction non définie"}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
                {overview?.department ? (
                  <>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: overview.department.color || "#94a3b8" }} />
                    {overview.department.name}
                  </>
                ) : (collaborator.department || "Département non défini")}
                {overview?.manager && <> · Manager : <Link href={`/collaborators/${overview.manager.id}`} className="text-primary hover:underline">{overview.manager.firstName} {overview.manager.lastName}</Link></>}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {collaborator.isAvailable ? (
            <Badge className="bg-green-100 text-green-800 border-green-200 text-sm px-4 py-1">Disponible pour affectation</Badge>
          ) : (
            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-sm px-4 py-1">Actuellement Affecté</Badge>
          )}
          {(collaborator as any).employeeNumber && <Badge variant="outline" className="font-mono text-xs">Matricule {(collaborator as any).employeeNumber}</Badge>}
        </div>
      </div>

      {/* COLONNES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* COLONNE GAUCHE — INFOS */}
        <Card className="col-span-1 shadow-sm h-fit border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base">Informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5 text-sm">
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Email</p>
                <p className="font-medium mt-0.5 break-all">{collaborator.email || "Non renseigné"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Téléphone</p>
                <p className="font-medium mt-0.5">{collaborator.phone || "Non renseigné"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Date d'embauche</p>
                <p className="font-medium mt-0.5">{(collaborator as any).hireDate ? formatDate((collaborator as any).hireDate) : formatDate(collaborator.createdAt)}</p>
              </div>
            </div>
            {(collaborator as any).baseSalary && (
              <div className="flex items-start gap-3">
                <BadgeCheck className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Salaire de base</p>
                  <p className="font-medium mt-0.5">{formatFCFA(Number((collaborator as any).baseSalary))}</p>
                </div>
              </div>
            )}
            {overview?.position && (
              <div className="flex items-start gap-3">
                <Building2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Poste</p>
                  <p className="font-medium mt-0.5">{overview.position.title}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* COLONNE DROITE — CHARGE + ACTIVITÉ */}
        <div className="col-span-1 md:col-span-2 space-y-6">
          {/* KPIs charge */}
          <Card className="shadow-sm border-border">
            <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
              <CardTitle className="text-base">Charge de travail & activité</CardTitle>
              <CardDescription>Synthèse opérationnelle cross-modules</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                <div className="bg-muted/30 border border-border p-3 rounded-lg flex items-center gap-3">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-md"><Briefcase className="w-5 h-5" /></div>
                  <div><div className="text-[10px] font-bold text-muted-foreground uppercase">Affectations</div><div className="text-2xl font-bold">{wl?.activeAssignments ?? 0}</div></div>
                </div>
                <div className="bg-muted/30 border border-border p-3 rounded-lg flex items-center gap-3">
                  <div className="p-2 bg-amber-100 text-amber-600 rounded-md"><ListTodo className="w-5 h-5" /></div>
                  <div><div className="text-[10px] font-bold text-muted-foreground uppercase">Tâches actives</div><div className="text-2xl font-bold">{wl?.activeTasks ?? 0}</div></div>
                </div>
                <div className="bg-muted/30 border border-border p-3 rounded-lg flex items-center gap-3">
                  <div className="p-2 bg-violet-100 text-violet-600 rounded-md"><Wrench className="w-5 h-5" /></div>
                  <div><div className="text-[10px] font-bold text-muted-foreground uppercase">Équipements</div><div className="text-2xl font-bold">{wl?.responsibleEquipmentsCount ?? 0}</div></div>
                </div>
                <div className="bg-muted/30 border border-border p-3 rounded-lg flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-md"><GitBranch className="w-5 h-5" /></div>
                  <div><div className="text-[10px] font-bold text-muted-foreground uppercase">Projets dirigés</div><div className="text-2xl font-bold">{wl?.ledProjectsCount ?? 0}</div></div>
                </div>
              </div>

              <div className="bg-muted/20 border border-border p-4 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Taux d'allocation cumulé</span>
                  <span className={`text-lg font-bold ${(wl?.totalAllocationPct ?? 0) > 100 ? "text-destructive" : "text-foreground"}`}>{wl?.totalAllocationPct ?? 0}%</span>
                </div>
                <Progress value={Math.min(wl?.totalAllocationPct ?? 0, 100)} className={`h-2 ${loadColor}`} />
                {(wl?.totalAllocationPct ?? 0) > 100 && <p className="text-xs text-destructive mt-2">⚠ Surcharge : la somme des allocations dépasse 100%.</p>}
              </div>
            </CardContent>
          </Card>

          {/* AFFECTATIONS */}
          <Card className="shadow-sm border-border">
            <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
              <CardTitle className="text-base flex items-center gap-2"><GitBranch className="w-4 h-4" /> Affectations sur chantiers</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {overviewLoading ? <Skeleton className="h-20" /> : (overview?.assignments.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Aucune affectation. <Link href="/hr/assignments" className="text-primary hover:underline">Créer une affectation</Link></p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground border-b">
                    <tr><th className="py-2">Chantier</th><th>Rôle</th><th className="text-right">Charge</th><th>Période</th><th>Statut</th></tr>
                  </thead>
                  <tbody>
                    {overview!.assignments.map((a) => (
                      <tr key={a.id} className="border-b last:border-0">
                        <td className="py-2.5 font-medium"><Link href={`/projects/${a.projectId}`} className="hover:text-primary">{a.projectName}</Link></td>
                        <td><Badge variant="outline" className="text-xs">{a.role}</Badge></td>
                        <td className="text-right font-semibold">{a.allocationPct}%</td>
                        <td className="text-xs text-muted-foreground">{a.startDate ? new Date(a.startDate).toLocaleDateString("fr-FR") : "—"} → {a.endDate ? new Date(a.endDate).toLocaleDateString("fr-FR") : "…"}</td>
                        <td>{statusBadge(a.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* GRILLE BAS — Contrats / Équipements / Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base flex items-center gap-2"><FileSignature className="w-4 h-4" /> Contrats</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-2">
            {(overview?.contracts.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Aucun contrat enregistré.</p>
            ) : overview!.contracts.map((c) => (
              <div key={c.id} className="border border-border rounded p-3">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" className="text-xs">{c.type}</Badge>
                  {statusBadge(c.status)}
                </div>
                <div className="text-sm font-medium">{c.jobTitle || "—"}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Du {new Date(c.startDate).toLocaleDateString("fr-FR")} {c.endDate ? `au ${new Date(c.endDate).toLocaleDateString("fr-FR")}` : "(indéterminée)"}
                </div>
                {c.monthlySalary && <div className="text-sm font-semibold text-primary mt-1">{formatFCFA(c.monthlySalary)}/mois</div>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base flex items-center gap-2"><Wrench className="w-4 h-4" /> Équipements sous responsabilité</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-2">
            {(overview?.equipments.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Aucun équipement à charge.</p>
            ) : overview!.equipments.map((e) => (
              <Link key={e.id} href={`/equipment/${e.id}`} className="block border border-border rounded p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{e.name}</div>
                    {e.code && <div className="text-xs text-muted-foreground font-mono">{e.code}</div>}
                  </div>
                  {statusBadge(e.status)}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base flex items-center gap-2"><FolderArchive className="w-4 h-4" /> Documents RH</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-2">
            {(overview?.documents.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Aucun document.</p>
            ) : overview!.documents.map((d) => {
              const expired = d.expiresAt && new Date(d.expiresAt) < new Date();
              return (
                <a key={d.id} href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="block border border-border rounded p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium flex items-center gap-1">{d.name} <ExternalLink className="w-3 h-3 text-muted-foreground" /></div>
                      <div className="text-xs text-muted-foreground capitalize">{d.type}</div>
                    </div>
                    {d.expiresAt && <span className={`text-xs ${expired ? "text-destructive font-semibold" : "text-muted-foreground"}`}>{expired ? "Expiré" : `Exp. ${new Date(d.expiresAt).toLocaleDateString("fr-FR")}`}</span>}
                  </div>
                </a>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* PROJETS DIRIGÉS */}
      {(overview?.ledProjects.length ?? 0) > 0 && (
        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base flex items-center gap-2"><HardHat className="w-4 h-4" /> Chantiers dirigés (chef de projet)</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {overview!.ledProjects.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`} className="border border-border rounded p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{p.name}</span>
                    {statusBadge(p.status)}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
