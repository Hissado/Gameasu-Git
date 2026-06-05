import React, { useMemo, useState } from "react";
import { useListProjects } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Plus, Search, Filter, MoreHorizontal, Eye, Edit, Trash2, FolderKanban,
  LayoutGrid, List, CheckCircle2, AlertTriangle, Clock, CircleDot,
  TrendingUp, ChevronRight,
} from "lucide-react";
import { Link } from "wouter";
import { formatFCFA, formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// ── RAG ───────────────────────────────────────────────────────────────────────

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
  on_track:  { label: "En bonne voie", icon: <CheckCircle2 className="w-3 h-3" />, cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  at_risk:   { label: "À risque",      icon: <AlertTriangle className="w-3 h-3" />, cls: "bg-amber-50 text-amber-700 border-amber-200",   dot: "bg-amber-500" },
  off_track: { label: "En retard",     icon: <AlertTriangle className="w-3 h-3" />, cls: "bg-red-50 text-red-700 border-red-200",          dot: "bg-red-500" },
  completed: { label: "Terminé",       icon: <CheckCircle2 className="w-3 h-3" />, cls: "bg-slate-100 text-slate-600 border-slate-200",   dot: "bg-slate-400" },
  pending:   { label: "En attente",    icon: <Clock className="w-3 h-3" />,         cls: "bg-blue-50 text-blue-700 border-blue-200",       dot: "bg-blue-400" },
  unknown:   { label: "Inconnu",       icon: <CircleDot className="w-3 h-3" />,     cls: "bg-slate-50 text-slate-500 border-slate-200",    dot: "bg-slate-300" },
};

function RAGBadge({ project }: { project: any }) {
  const rag = computeRAG(project);
  const cfg = RAG_CONFIG[rag];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 flex items-center gap-1 font-medium w-fit ${cfg.cls}`}>
          {cfg.icon}
          {cfg.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        Statut RAG : {cfg.label}
      </TooltipContent>
    </Tooltip>
  );
}

const STATUS_BADGE: Record<string, React.ReactNode> = {
  active:    <Badge className="bg-primary text-primary-foreground hover:bg-primary/80">En cours</Badge>,
  planning:  <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">Planifié</Badge>,
  on_hold:   <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">En attente</Badge>,
  completed: <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Terminé</Badge>,
  cancelled: <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">Annulé</Badge>,
};

type ViewMode = "list" | "cards";

export default function ProjectsList() {
  const { data, isLoading } = useListProjects();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("list");

  const projects = useMemo(() => {
    const all = data?.data || [];
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter((p: any) =>
      p.name?.toLowerCase().includes(q) ||
      p.clientName?.toLowerCase().includes(q) ||
      p.managerName?.toLowerCase().includes(q)
    );
  }, [data, search]);

  const kpis = useMemo(() => {
    const all = data?.data || [];
    const withRag = all.map((p: any) => ({ ...p, _rag: computeRAG(p) }));
    return {
      total: all.length,
      active: all.filter((p: any) => p.status === "active").length,
      atRisk: withRag.filter((p: any) => p._rag === "at_risk" || p._rag === "off_track").length,
      avgProgress: all.length ? Math.round(all.reduce((s: number, p: any) => s + (p.progress || 0), 0) / all.length) : 0,
    };
  }, [data]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Projets</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestion et suivi de vos projets</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/portfolio">
            <Button variant="outline" size="sm" className="h-9 font-medium gap-1.5">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Portefeuille</span>
            </Button>
          </Link>
          <Link href="/workload">
            <Button variant="outline" size="sm" className="h-9 font-medium gap-1.5">
              <FolderKanban className="w-4 h-4" />
              <span className="hidden sm:inline">Charge équipe</span>
            </Button>
          </Link>
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm h-9">
            <Plus className="w-4 h-4 mr-2" strokeWidth={3} />
            Nouveau Projet
          </Button>
        </div>
      </div>

      {/* Quick KPI strip */}
      {!isLoading && projects.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total projets", value: kpis.total, cls: "text-foreground" },
            { label: "En cours", value: kpis.active, cls: "text-primary" },
            { label: "À surveiller", value: kpis.atRisk, cls: kpis.atRisk > 0 ? "text-amber-600" : "text-emerald-600" },
            { label: "Avancement moy.", value: `${kpis.avgProgress}%`, cls: "text-foreground" },
          ].map(kpi => (
            <Card key={kpi.label} className="shadow-sm">
              <CardContent className="p-3.5 text-center">
                <div className={`text-2xl font-bold ${kpi.cls}`}>{kpi.value}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{kpi.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg">Liste des Projets</CardTitle>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher un projet..."
                  className="pl-9 bg-slate-50 focus-visible:ring-primary h-9"
                />
              </div>
              <div className="flex border border-border rounded-md overflow-hidden h-9 shrink-0">
                <button
                  onClick={() => setView("list")}
                  className={`px-2.5 flex items-center transition-colors ${view === "list" ? "bg-primary text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setView("cards")}
                  className={`px-2.5 flex items-center border-l border-border transition-colors ${view === "cards" ? "bg-primary text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className={view === "cards" ? "p-4" : "p-0 overflow-x-auto"}>
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : projects.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <FolderKanban className="w-12 h-12 text-slate-300 mb-4 mx-auto" />
              <p className="text-lg font-medium text-slate-600">Aucun projet trouvé</p>
              <p className="text-sm">Commencez par créer un nouveau projet.</p>
              <Button variant="outline" className="mt-4 border-primary text-primary hover:bg-primary/5">
                <Plus className="w-4 h-4 mr-2" /> Créer un projet
              </Button>
            </div>
          ) : view === "list" ? (
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="font-semibold text-slate-600">Nom du Projet</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold text-slate-600">Client</TableHead>
                  <TableHead className="font-semibold text-slate-600">Statut</TableHead>
                  <TableHead className="font-semibold text-slate-600">RAG</TableHead>
                  <TableHead className="hidden md:table-cell font-semibold text-slate-600">Avancement</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold text-slate-600">Budget</TableHead>
                  <TableHead className="hidden lg:table-cell font-semibold text-slate-600">Responsable</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project: any) => (
                  <TableRow key={project.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-bold text-slate-800">
                      <Link href={`/projects/${project.id}`} className="hover:text-primary transition-colors flex items-center gap-1.5">
                        {project.name}
                        <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </Link>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm font-medium">{project.clientName || "—"}</TableCell>
                    <TableCell>{STATUS_BADGE[project.status] || <Badge variant="outline">Inconnu</Badge>}</TableCell>
                    <TableCell><RAGBadge project={project} /></TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-col gap-1.5 w-32">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-slate-600">{project.progress || 0}%</span>
                        </div>
                        <Progress
                          value={project.progress || 0}
                          className={`h-2 ${project.progress === 100 ? "[&>div]:bg-green-500" : ""}`}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell font-medium">{formatFCFA(project.budget)}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">{project.managerName || "—"}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 font-sans">
                          <Link href={`/projects/${project.id}`}>
                            <DropdownMenuItem className="cursor-pointer">
                              <Eye className="mr-2 h-4 w-4" /> Voir le détail
                            </DropdownMenuItem>
                          </Link>
                          <Link href={`/projects/${project.id}`}>
                            <DropdownMenuItem className="cursor-pointer">
                              <TrendingUp className="mr-2 h-4 w-4" /> Timeline Gantt
                            </DropdownMenuItem>
                          </Link>
                          <DropdownMenuItem className="cursor-pointer">
                            <Edit className="mr-2 h-4 w-4" /> Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            /* Cards view */
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {projects.map((project: any) => {
                const rag = computeRAG(project);
                const ragCfg = RAG_CONFIG[rag];
                return (
                  <Link key={project.id} href={`/projects/${project.id}`}>
                    <Card className="hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer group h-full">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors">{project.name}</h3>
                            {project.clientName && <p className="text-xs text-muted-foreground truncate">{project.clientName}</p>}
                          </div>
                          <Badge variant="outline" className={`text-[10px] shrink-0 flex items-center gap-1 ${ragCfg.cls}`}>
                            {ragCfg.icon}{ragCfg.label}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Avancement</span>
                            <span className="font-bold">{project.progress || 0}%</span>
                          </div>
                          <Progress value={project.progress || 0} className="h-1.5" />
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground font-medium">{formatFCFA(project.budget)}</span>
                          {STATUS_BADGE[project.status]}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
