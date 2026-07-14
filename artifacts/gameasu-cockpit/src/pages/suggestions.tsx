import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Lightbulb, Search, BarChart3, CheckCircle2, Clock,
  XCircle, Rocket, PackageCheck, Filter, Loader2,
  TrendingUp, Building2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Suggestion {
  id: string;
  organizationId: string;
  title: string;
  category: string;
  description?: string;
  priority: string;
  status: string;
  module?: string;
  screenshotUrl?: string;
  createdAt: string;
  updatedAt: string;
  userId?: string;
  userFirstName?: string;
  userLastName?: string;
}

interface SuggestionsResponse {
  data: Suggestion[];
  total: number;
  pages: number;
  page: number;
}

interface StatsResponse {
  total: number;
  pending: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
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

const PRIORITY_LABELS: Record<string, string> = {
  faible: "Faible",
  normale: "Normale",
  haute: "Haute",
  critique: "Critique",
};

const VALID_STATUSES = [
  "nouvelle", "en_analyse", "acceptee", "planifiee", "en_developpement", "livree", "rejetee",
];

const CHART_COLORS = ["#3B82F6", "#F59E0B", "#10B981", "#8B5CF6", "#F97316", "#14B8A6", "#6B7280"];

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "livree": return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
    case "rejetee": return <XCircle className="w-3.5 h-3.5 text-red-500" />;
    case "en_developpement": return <Rocket className="w-3.5 h-3.5 text-orange-500" />;
    case "planifiee": return <PackageCheck className="w-3.5 h-3.5 text-purple-500" />;
    default: return <Clock className="w-3.5 h-3.5 text-slate-400" />;
  }
}

interface ProcessDialogProps {
  suggestion: Suggestion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ProcessDialog({ suggestion, open, onOpenChange }: ProcessDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newStatus, setNewStatus] = useState(suggestion?.status ?? "");
  const [comment, setComment] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/super-admin/suggestions/${suggestion!.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, comment }),
      }),
    onSuccess: () => {
      toast({ title: "Statut mis à jour" });
      qc.invalidateQueries({ queryKey: ["cockpit-suggestions"] });
      qc.invalidateQueries({ queryKey: ["cockpit-suggestions-stats"] });
      onOpenChange(false);
      setComment("");
    },
    onError: () => {
      toast({ title: "Erreur", description: "Mise à jour impossible", variant: "destructive" });
    },
  });

  if (!suggestion) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Traiter la suggestion</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="font-medium text-sm">{suggestion.title}</p>
            {suggestion.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{suggestion.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded bg-background border">
                {CATEGORY_LABELS[suggestion.category] ?? suggestion.category}
              </span>
              {suggestion.module && (
                <span className="text-xs text-muted-foreground">{suggestion.module}</span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nouveau statut</Label>
            <Select
              value={newStatus || suggestion.status}
              onValueChange={setNewStatus}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VALID_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Commentaire interne (optionnel)</Label>
            <Textarea
              placeholder="Explication, contexte de la décision…"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || (!newStatus && !suggestion.status)}
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SuggestionsPage() {
  const [tab, setTab] = useState<"list" | "analytics">("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [processOpen, setProcessOpen] = useState(false);

  const { data, isLoading } = useQuery<SuggestionsResponse>({
    queryKey: ["cockpit-suggestions", statusFilter, categoryFilter, priorityFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      return apiFetch(`/api/super-admin/suggestions?${params}`);
    },
  });

  const { data: stats } = useQuery<StatsResponse>({
    queryKey: ["cockpit-suggestions-stats"],
    queryFn: () => apiFetch("/api/super-admin/suggestions/stats"),
    refetchInterval: 60_000,
  });

  const kpis = [
    { label: "Total", value: stats?.total ?? 0, icon: BarChart3, color: "text-blue-500" },
    { label: "Nouvelles", value: stats?.pending ?? 0, icon: Lightbulb, color: "text-yellow-500" },
    { label: "Acceptées", value: (stats?.byStatus?.acceptee ?? 0) + (stats?.byStatus?.planifiee ?? 0) + (stats?.byStatus?.en_developpement ?? 0), icon: CheckCircle2, color: "text-green-500" },
    { label: "Livrées", value: stats?.byStatus?.livree ?? 0, icon: PackageCheck, color: "text-emerald-500" },
  ];

  const categoryChartData = Object.entries(stats?.byCategory ?? {}).map(([k, v]) => ({
    name: CATEGORY_LABELS[k] ?? k,
    count: v,
  }));

  const statusChartData = Object.entries(stats?.byStatus ?? {}).map(([k, v]) => ({
    name: STATUS_LABELS[k] ?? k,
    count: v,
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            Suggestions produit
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Retours et idées des utilisateurs — toutes organisations
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={tab === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("list")}
          >
            Liste
          </Button>
          <Button
            variant={tab === "analytics" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("analytics")}
          >
            <TrendingUp className="w-4 h-4 mr-1" />
            Analytique
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <Card key={k.label}>
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

      {tab === "analytics" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Par catégorie</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={categoryChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {categoryChartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Par statut</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={statusChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {statusChartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "list" && (
        <>
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                {VALID_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(1); }}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Priorité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes priorités</SelectItem>
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Chargement…
              </div>
            ) : !data?.data?.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                <Lightbulb className="w-8 h-8 opacity-30" />
                <p className="text-sm">Aucune suggestion</p>
              </div>
            ) : (
              data.data.map((s) => (
                <Card
                  key={s.id}
                  className="border cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => { setSelectedSuggestion(s); setProcessOpen(true); }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted">
                            {CATEGORY_LABELS[s.category] ?? s.category}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {s.organizationId.slice(0, 8)}…
                          </span>
                          {s.module && (
                            <span className="text-xs text-muted-foreground">· {s.module}</span>
                          )}
                        </div>
                        <p className="font-medium text-sm text-foreground">{s.title}</p>
                        {s.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          {s.userFirstName && (
                            <span className="text-[11px] text-muted-foreground">
                              {s.userFirstName} {s.userLastName}
                            </span>
                          )}
                          <span className="text-[11px] text-muted-foreground">
                            {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true, locale: fr })}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[s.status] ?? "bg-slate-100 text-slate-600"}`}>
                          <StatusIcon status={s.status} />
                          {STATUS_LABELS[s.status] ?? s.status}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
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
        </>
      )}

      <ProcessDialog
        suggestion={selectedSuggestion}
        open={processOpen}
        onOpenChange={setProcessOpen}
      />
    </div>
  );
}
