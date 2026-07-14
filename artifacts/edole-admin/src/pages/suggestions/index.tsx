import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lightbulb, Search, Plus, Clock, CheckCircle2, XCircle, Rocket, PackageCheck, BarChart3 } from "lucide-react";
import { SuggestionDialog } from "@/components/SuggestionDialog";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface Suggestion {
  id: string;
  title: string;
  category: string;
  description?: string;
  priority: string;
  status: string;
  module?: string;
  createdAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  fonctionnalite: "Fonctionnalité",
  ux: "Interface",
  performance: "Performance",
  bug: "Bug",
  rapport: "Rapport",
  nouveau_module: "Nouveau module",
  autre: "Autre",
};

const STATUS_LABELS: Record<string, string> = {
  nouvelle: "Nouvelle",
  en_analyse: "En analyse",
  acceptee: "Acceptée",
  planifiee: "Planifiée",
  en_developpement: "En développement",
  livree: "Livrée",
  rejetee: "Rejetée",
};

const STATUS_COLORS: Record<string, string> = {
  nouvelle: "bg-blue-500/10 text-blue-600 border-blue-200",
  en_analyse: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  acceptee: "bg-green-500/10 text-green-600 border-green-200",
  planifiee: "bg-purple-500/10 text-purple-600 border-purple-200",
  en_developpement: "bg-orange-500/10 text-orange-600 border-orange-200",
  livree: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  rejetee: "bg-red-500/10 text-red-600 border-red-200",
};

const PRIORITY_COLORS: Record<string, string> = {
  faible: "bg-slate-100 text-slate-600",
  normale: "bg-blue-50 text-blue-600",
  haute: "bg-orange-50 text-orange-700",
  critique: "bg-red-50 text-red-700",
};

const PRIORITY_LABELS: Record<string, string> = {
  faible: "Faible",
  normale: "Normale",
  haute: "Haute",
  critique: "Critique",
};

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "livree": return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
    case "rejetee": return <XCircle className="w-3.5 h-3.5 text-red-500" />;
    case "en_developpement": return <Rocket className="w-3.5 h-3.5 text-orange-500" />;
    case "planifiee": return <PackageCheck className="w-3.5 h-3.5 text-purple-500" />;
    default: return <Clock className="w-3.5 h-3.5 text-slate-400" />;
  }
}

export default function SuggestionsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery<{
    data: Suggestion[];
    total: number;
    pages: number;
  }>({
    queryKey: ["suggestions", statusFilter, categoryFilter, search, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (search) params.set("search", search);
      return apiFetch(`/api/suggestions?${params}`);
    },
  });

  const kpi = [
    { label: "Total", value: data?.total ?? 0, icon: BarChart3, color: "text-blue-500" },
    { label: "Nouvelles", value: data?.data?.filter(s => s.status === "nouvelle").length ?? 0, icon: Lightbulb, color: "text-yellow-500" },
    { label: "Acceptées", value: data?.data?.filter(s => s.status === "acceptee" || s.status === "planifiee" || s.status === "en_developpement").length ?? 0, icon: CheckCircle2, color: "text-green-500" },
    { label: "Livrées", value: data?.data?.filter(s => s.status === "livree").length ?? 0, icon: PackageCheck, color: "text-emerald-500" },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            Mes suggestions
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Partagez vos idées pour améliorer Gaméasù
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Nouvelle suggestion
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpi.map((k) => (
          <Card key={k.label} className="border shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <k.icon className={`w-8 h-8 ${k.color} opacity-80`} />
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="text-xl font-bold">{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            Chargement…
          </div>
        ) : !data?.data?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <Lightbulb className="w-10 h-10 opacity-30" />
            <p className="text-sm">Aucune suggestion trouvée</p>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
              Soumettre une idée
            </Button>
          </div>
        ) : (
          data.data.map((s) => (
            <Card key={s.id} className="border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {CATEGORY_LABELS[s.category] ?? s.category}
                      </span>
                      {s.module && (
                        <span className="text-xs text-muted-foreground">· {s.module}</span>
                      )}
                    </div>
                    <p className="font-medium text-sm text-foreground truncate">{s.title}</p>
                    {s.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-2">
                      {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[s.status] ?? "bg-slate-100 text-slate-600"}`}>
                      <StatusIcon status={s.status} />
                      {STATUS_LABELS[s.status] ?? s.status}
                    </span>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${PRIORITY_COLORS[s.priority] ?? ""}`}>
                      {PRIORITY_LABELS[s.priority] ?? s.priority}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Précédent
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} / {data.pages}</span>
          <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
            Suivant
          </Button>
        </div>
      )}

      <SuggestionDialog open={dialogOpen} onOpenChange={setDialogOpen} onSuccess={() => { setDialogOpen(false); refetch(); }} />
    </div>
  );
}
