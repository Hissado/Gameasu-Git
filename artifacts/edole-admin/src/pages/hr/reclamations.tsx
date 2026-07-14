import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { HrShell } from "./_layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquareWarning, Plus, Search, AlertTriangle, CheckCircle2, Clock,
  Filter, BarChart3, TrendingUp, Loader2, ChevronRight, Eye,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  salaire: "Salaire & Rémunération",
  conges: "Congés & Absences",
  conditions_travail: "Conditions de travail",
  harcelement: "Harcèlement",
  discrimination: "Discrimination",
  securite: "Sécurité",
  avantages: "Avantages sociaux",
  carriere: "Carrière & Évolution",
  autre: "Autre",
};

const CATEGORY_VALUES = Object.keys(CATEGORY_LABELS);

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  brouillon:              { label: "Brouillon",             color: "bg-slate-100 text-slate-600 border-slate-200",    icon: <Clock className="w-3 h-3" /> },
  soumise:                { label: "Soumise",               color: "bg-blue-100 text-blue-700 border-blue-200",       icon: <MessageSquareWarning className="w-3 h-3" /> },
  en_cours:               { label: "En cours d'analyse",   color: "bg-amber-100 text-amber-700 border-amber-200",    icon: <Search className="w-3 h-3" /> },
  infos_complementaires:  { label: "Infos requises",        color: "bg-orange-100 text-orange-700 border-orange-200", icon: <AlertTriangle className="w-3 h-3" /> },
  en_traitement:          { label: "En traitement",         color: "bg-purple-100 text-purple-700 border-purple-200", icon: <TrendingUp className="w-3 h-3" /> },
  resolue:                { label: "Résolue",               color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
  refusee:                { label: "Refusée",               color: "bg-red-100 text-red-700 border-red-200",          icon: <AlertTriangle className="w-3 h-3" /> },
  cloturee:               { label: "Clôturée",              color: "bg-slate-200 text-slate-700 border-slate-300",    icon: <CheckCircle2 className="w-3 h-3" /> },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  faible:   { label: "Faible",   color: "text-slate-500" },
  normale:  { label: "Normale",  color: "text-blue-600" },
  haute:    { label: "Haute",    color: "text-amber-600" },
  urgente:  { label: "Urgente",  color: "text-red-600" },
};

type Claim = {
  id: string;
  reference: string;
  category: string;
  subject: string;
  status: string;
  priority: string;
  isAnonymous: boolean;
  targetDate?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  collaboratorId?: string;
  collaboratorName?: string;
  assignedToId?: string | null;
  assignedToName?: string | null;
};

type Stats = {
  total: number;
  byStatus: Array<{ status: string; count: number }>;
  byCategory: Array<{ category: string; count: number }>;
  byPriority: Array<{ priority: string; count: number }>;
};

// ─── Main Component ────────────────────────────────────────────────────────────

export default function HrReclamations() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isManager = ["admin", "super_admin", "manager"].includes(user?.role ?? "");

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    category: "",
    subject: "",
    description: "",
    priority: "normale",
    isAnonymous: false,
    targetDate: "",
  });

  const { data: claimsData, isLoading } = useQuery<{ data: Claim[]; total: number }>({
    queryKey: ["hr-claims", statusFilter],
    queryFn: () => apiFetch(`/api/hr/claims?limit=200${statusFilter !== "all" ? `&status=${statusFilter}` : ""}`),
    staleTime: 30_000,
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["hr-claims-stats"],
    queryFn: () => apiFetch("/api/hr/claims/stats"),
    enabled: isManager,
    staleTime: 60_000,
  });

  const claims = claimsData?.data ?? [];
  const filtered = claims.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [c.reference, c.subject, c.collaboratorName, CATEGORY_LABELS[c.category]]
      .some(v => v?.toLowerCase().includes(q));
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      apiFetch("/api/hr/claims", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: (data) => {
      toast({ title: "Réclamation soumise", description: `Référence : ${data.reference}` });
      queryClient.invalidateQueries({ queryKey: ["hr-claims"] });
      queryClient.invalidateQueries({ queryKey: ["hr-claims-stats"] });
      setCreateOpen(false);
      setForm({ category: "", subject: "", description: "", priority: "normale", isAnonymous: false, targetDate: "" });
    },
    onError: () => toast({ variant: "destructive", title: "Erreur", description: "Impossible de soumettre la réclamation" }),
  });

  // Stats rapides pour les managers
  const openCount = stats?.byStatus.filter(s => !["resolue", "refusee", "cloturee"].includes(s.status)).reduce((a, b) => a + b.count, 0) ?? 0;
  const urgentCount = stats?.byPriority.find(p => p.priority === "urgente")?.count ?? 0;
  const resolvedCount = stats?.byStatus.find(s => s.status === "resolue")?.count ?? 0;

  return (
    <HrShell
      title="Réclamations RH"
      subtitle={isManager ? "Gestion et suivi des réclamations du personnel" : "Mes réclamations"}
      actions={
        <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" />
          Nouvelle réclamation
        </Button>
      }
    >
      <div className="space-y-5">

        {/* ── Stats (manager only) ── */}
        {isManager && stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-100"><MessageSquareWarning className="w-5 h-5 text-blue-600" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-100"><Clock className="w-5 h-5 text-amber-600" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">En cours</p>
                  <p className="text-2xl font-bold text-slate-900">{openCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-red-100"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Urgentes</p>
                  <p className="text-2xl font-bold text-slate-900">{urgentCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-100"><CheckCircle2 className="w-5 h-5 text-emerald-600" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Résolues</p>
                  <p className="text-2xl font-bold text-slate-900">{resolvedCount}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Filtres ── */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par référence, sujet, collaborateur…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm bg-muted/40"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { value: "all", label: "Tous" },
                { value: "soumise", label: "Soumises" },
                { value: "en_cours", label: "En cours" },
                { value: "infos_complementaires", label: "Infos requises" },
                { value: "en_traitement", label: "En traitement" },
                { value: "resolue", label: "Résolues" },
                { value: "refusee", label: "Refusées" },
                { value: "cloturee", label: "Clôturées" },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setStatusFilter(value)}
                  className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors ${
                    statusFilter === value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Liste ── */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <MessageSquareWarning className="w-12 h-12 mb-3 opacity-20" />
              <p className="font-medium text-slate-600">Aucune réclamation</p>
              <p className="text-xs mt-1">
                {search || statusFilter !== "all" ? "Essayez d'autres filtres" : "Soumettez votre première réclamation RH"}
              </p>
              <Button size="sm" variant="outline" className="mt-4 gap-2" onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4" />
                Nouvelle réclamation
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100">
              {filtered.map(claim => {
                const sc = STATUS_CONFIG[claim.status] ?? STATUS_CONFIG.soumise;
                const pc = PRIORITY_CONFIG[claim.priority] ?? PRIORITY_CONFIG.normale;
                return (
                  <div
                    key={claim.id}
                    onClick={() => navigate(`/rh/reclamations/${claim.id}`)}
                    className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-mono text-slate-400">{claim.reference}</span>
                        <Badge variant="outline" className={`text-[11px] px-2 py-0 border ${sc.color} flex items-center gap-1`}>
                          {sc.icon}{sc.label}
                        </Badge>
                        <span className={`text-[11px] font-semibold ${pc.color}`}>{pc.label}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800 truncate">{claim.subject}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[claim.category] ?? claim.category}</span>
                        {isManager && claim.collaboratorName && (
                          <span className="text-xs text-slate-500">· {claim.collaboratorName}</span>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatDistanceToNow(new Date(claim.createdAt), { addSuffix: true, locale: fr })}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      {/* ── Modale création ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle réclamation RH</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Catégorie <span className="text-red-500">*</span></Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Sélectionner une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_VALUES.map(k => (
                    <SelectItem key={k} value={k}>{CATEGORY_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Objet <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Résumez votre réclamation en quelques mots"
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description <span className="text-red-500">*</span></Label>
              <Textarea
                placeholder="Décrivez le problème en détail, les faits, les dates concernées…"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={5}
                className="resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priorité</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="faible">Faible</SelectItem>
                    <SelectItem value="normale">Normale</SelectItem>
                    <SelectItem value="haute">Haute</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Date souhaitée</Label>
                <Input
                  type="date"
                  value={form.targetDate}
                  onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))}
                  className="h-9"
                />
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isAnonymous}
                onChange={e => setForm(f => ({ ...f, isAnonymous: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-primary"
              />
              <div>
                <span className="text-sm font-medium">Soumettre de manière anonyme</span>
                <p className="text-xs text-muted-foreground">Votre nom ne sera pas visible par les gestionnaires intermédiaires</p>
              </div>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.category || !form.subject || !form.description}
              className="gap-2"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Soumettre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
