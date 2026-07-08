import React, { useMemo, useState } from "react";
import { useListProjects } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FolderKanban, Search, TrendingUp, AlertTriangle, CheckCircle2,
  Clock, ArrowRight, Plus, Users2, CalendarDays, Banknote,
  CircleDot, Activity,
} from "lucide-react";
import { formatFCFA, formatDate } from "@/lib/format";

// ── RAG status computation ────────────────────────────────────────────────────

type RAGStatus = "on_track" | "at_risk" | "off_track" | "completed" | "pending" | "unknown";

function computeRAG(project: any): RAGStatus {
  if (project.status === "completed") return "completed";
  if (project.status === "cancelled") return "off_track";
  if (project.status === "planning" || !project.startDate) return "pending";

  const today = new Date();
  const start = new Date(project.startDate);
  const end = project.endDate ? new Date(project.endDate) : null;
  const progress = project.progress || 0;

  if (end && today > end && progress < 100) return "off_track";

  if (end) {
    const totalMs = end.getTime() - start.getTime();
    const elapsedMs = today.getTime() - start.getTime();
    if (totalMs > 0) {
      const expectedProgress = Math.min(100, (elapsedMs / totalMs) * 100);
      const gap = expectedProgress - progress;
      if (gap > 20) return "off_track";
      if (gap > 8) return "at_risk";
    }
  }

  return "on_track";
}

const RAG_CONFIG: Record<RAGStatus, { label: string; icon: React.ReactNode; cls: string; dot: string }> = {
  on_track:  { label: "En bonne voie",  icon: <CheckCircle2 className="w-3.5 h-3.5" />, cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  at_risk:   { label: "À risque",       icon: <AlertTriangle className="w-3.5 h-3.5" />, cls: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  off_track: { label: "En retard",      icon: <AlertTriangle className="w-3.5 h-3.5" />, cls: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  completed: { label: "Terminé",        icon: <CheckCircle2 className="w-3.5 h-3.5" />, cls: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
  pending:   { label: "En attente",     icon: <Clock className="w-3.5 h-3.5" />, cls: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-400" },
  unknown:   { label: "Inconnu",        icon: <CircleDot className="w-3.5 h-3.5" />, cls: "bg-slate-50 text-slate-500 border-slate-200", dot: "bg-slate-300" },
};

const STATUS_LABEL: Record<string, string> = {
  active: "En cours", planning: "Planifié", on_hold: "En attente",
  completed: "Terminé", cancelled: "Annulé",
};

// ── ProjectCard ───────────────────────────────────────────────────────────────

function ProjectCard({ project }: { project: any }) {
  const rag = computeRAG(project);
  const ragCfg = RAG_CONFIG[rag];
  const progress = project.progress || 0;

  const daysLeft = useMemo(() => {
    if (!project.endDate) return null;
    const diff = Math.ceil((new Date(project.endDate).getTime() - Date.now()) / 86400000);
    return diff;
  }, [project.endDate]);

  return (
    <Link href={`/projets/${project.id}`}>
      <Card className="group hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer h-full flex flex-col">
        <CardContent className="p-5 flex flex-col gap-4 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-foreground text-sm leading-snug truncate group-hover:text-primary transition-colors">
                {project.name}
              </h3>
              {project.clientName && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{project.clientName}</p>
              )}
            </div>
            <Badge variant="outline" className={`text-[10px] px-2 py-0.5 shrink-0 flex items-center gap-1 font-medium ${ragCfg.cls}`}>
              {ragCfg.icon}
              {ragCfg.label}
            </Badge>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground font-medium">Avancement</span>
              <span className={`font-bold ${progress === 100 ? "text-emerald-600" : progress >= 75 ? "text-primary" : "text-foreground"}`}>
                {progress}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  rag === "off_track" ? "bg-red-500" :
                  rag === "at_risk" ? "bg-amber-500" :
                  rag === "completed" ? "bg-slate-400" : "bg-primary"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs mt-auto">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Banknote className="w-3.5 h-3.5 shrink-0" />
              <span className="font-semibold text-foreground truncate">{formatFCFA(Number(project.budget) || 0)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{project.managerName || "—"}</span>
            </div>
            {project.endDate && (
              <div className={`flex items-center gap-1.5 col-span-2 ${daysLeft !== null && daysLeft < 0 ? "text-red-600" : daysLeft !== null && daysLeft < 14 ? "text-amber-600" : "text-muted-foreground"}`}>
                <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {daysLeft === null ? "—" :
                   daysLeft < 0 ? `En retard de ${Math.abs(daysLeft)} j` :
                   daysLeft === 0 ? "Livraison aujourd'hui" :
                   `${daysLeft} j restants — ${formatDate(project.endDate)}`}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <Badge variant="secondary" className="text-[10px] font-medium">
              {STATUS_LABEL[project.status] || project.status}
            </Badge>
            <span className="text-xs text-primary font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              Voir <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const { data, isLoading } = useListProjects();
  const [search, setSearch] = useState("");
  const [filterRAG, setFilterRAG] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("progress");

  const allProjects = data?.data || [];

  const projects = useMemo(() => {
    let list = allProjects.map((p: any) => ({ ...p, _rag: computeRAG(p) }));

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p: any) =>
        p.name?.toLowerCase().includes(q) ||
        p.clientName?.toLowerCase().includes(q) ||
        p.managerName?.toLowerCase().includes(q)
      );
    }

    if (filterRAG !== "all") list = list.filter((p: any) => p._rag === filterRAG);
    if (filterStatus !== "all") list = list.filter((p: any) => p.status === filterStatus);

    list.sort((a: any, b: any) => {
      if (sortBy === "progress") return (b.progress || 0) - (a.progress || 0);
      if (sortBy === "budget") return (Number(b.budget) || 0) - (Number(a.budget) || 0);
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "endDate") {
        if (!a.endDate) return 1;
        if (!b.endDate) return -1;
        return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
      }
      return 0;
    });

    return list;
  }, [allProjects, search, filterRAG, filterStatus, sortBy]);

  const kpis = useMemo(() => {
    const withRag = allProjects.map((p: any) => ({ ...p, _rag: computeRAG(p) }));
    return {
      total: allProjects.length,
      active: allProjects.filter((p: any) => p.status === "active").length,
      atRisk: withRag.filter((p: any) => p._rag === "at_risk").length,
      offTrack: withRag.filter((p: any) => p._rag === "off_track").length,
      onTrack: withRag.filter((p: any) => p._rag === "on_track").length,
      completed: allProjects.filter((p: any) => p.status === "completed").length,
      totalBudget: allProjects.reduce((s: number, p: any) => s + (Number(p.budget) || 0), 0),
      avgProgress: allProjects.length
        ? Math.round(allProjects.reduce((s: number, p: any) => s + (p.progress || 0), 0) / allProjects.length)
        : 0,
    };
  }, [allProjects]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Portefeuille de projets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vue consolidée · {kpis.total} projet{kpis.total !== 1 ? "s" : ""}
          </p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm">
          <Plus className="w-4 h-4 mr-2" strokeWidth={3} />
          Nouveau Projet
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "En bonne voie", value: kpis.onTrack, icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />, bg: "bg-emerald-50" },
          { label: "À risque", value: kpis.atRisk, icon: <AlertTriangle className="w-5 h-5 text-amber-500" />, bg: "bg-amber-50" },
          { label: "En retard", value: kpis.offTrack, icon: <AlertTriangle className="w-5 h-5 text-red-500" />, bg: "bg-red-50" },
          { label: "Avancement moy.", value: `${kpis.avgProgress}%`, icon: <Activity className="w-5 h-5 text-primary" />, bg: "bg-primary/5" },
        ].map((kpi) => (
          <Card key={kpi.label} className="shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpi.bg}`}>
                {kpi.icon}
              </div>
              <div>
                <div className="text-xl font-bold">{kpi.value}</div>
                <div className="text-xs text-muted-foreground">{kpi.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Budget total */}
      <Card className="shadow-sm border-primary/20 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
        <CardContent className="p-5 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatFCFA(kpis.totalBudget)}</div>
              <div className="text-slate-400 text-sm">Budget total du portefeuille</div>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-2xl font-bold">{kpis.active}</div>
            <div className="text-slate-400 text-sm">Projets actifs</div>
          </div>
          <div className="text-right hidden md:block">
            <div className="text-2xl font-bold">{kpis.completed}</div>
            <div className="text-slate-400 text-sm">Terminés</div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3 pt-4 px-4 border-b border-border/50">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher par nom, client, responsable…"
                className="pl-9 h-9 bg-slate-50"
              />
            </div>
            <Select value={filterRAG} onValueChange={setFilterRAG}>
              <SelectTrigger className="h-9 w-full md:w-44">
                <SelectValue placeholder="Statut RAG" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts RAG</SelectItem>
                <SelectItem value="on_track">🟢 En bonne voie</SelectItem>
                <SelectItem value="at_risk">🟡 À risque</SelectItem>
                <SelectItem value="off_track">🔴 En retard</SelectItem>
                <SelectItem value="pending">🔵 En attente</SelectItem>
                <SelectItem value="completed">⚪ Terminé</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 w-full md:w-40">
                <SelectValue placeholder="Statut projet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="active">En cours</SelectItem>
                <SelectItem value="planning">Planifié</SelectItem>
                <SelectItem value="on_hold">En attente</SelectItem>
                <SelectItem value="completed">Terminé</SelectItem>
                <SelectItem value="cancelled">Annulé</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-9 w-full md:w-44">
                <SelectValue placeholder="Trier par" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="progress">Par avancement</SelectItem>
                <SelectItem value="endDate">Par échéance</SelectItem>
                <SelectItem value="budget">Par budget</SelectItem>
                <SelectItem value="name">Par nom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Skeleton key={i} className="h-52 w-full rounded-lg" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <FolderKanban className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="font-semibold text-slate-600 text-lg">Aucun projet trouvé</p>
              <p className="text-sm mt-1">Modifiez les filtres ou créez un nouveau projet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {projects.map((project: any) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
