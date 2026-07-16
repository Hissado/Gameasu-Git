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
import { SectionHelp } from "@/components/ui/section-help";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquareWarning, Plus, Search, AlertTriangle, CheckCircle2, Clock,
  Filter, BarChart3, TrendingUp, Loader2, ChevronRight, Eye, Paperclip,
  Users, Building2, Timer,
} from "lucide-react";
import { FieldTooltip, FieldHint } from "@/components/ui/field-tooltip";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { usePermissions } from "@/lib/permissions";

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
  remboursement: "Remboursement de frais",
  autre: "Autre",
};

const CATEGORY_VALUES = Object.keys(CATEGORY_LABELS);

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  brouillon:              { label: "Brouillon",             color: "bg-muted text-muted-foreground border",    icon: <Clock className="w-3 h-3" /> },
  soumise:                { label: "Soumise",               color: "bg-blue-100 text-blue-700 border-blue-200",       icon: <MessageSquareWarning className="w-3 h-3" /> },
  en_cours:               { label: "En cours d'analyse",   color: "bg-amber-100 text-amber-700 border-amber-200",    icon: <Search className="w-3 h-3" /> },
  infos_complementaires:  { label: "Infos requises",        color: "bg-orange-100 text-orange-700 border-orange-200", icon: <AlertTriangle className="w-3 h-3" /> },
  en_traitement:          { label: "En traitement",         color: "bg-purple-100 text-purple-700 border-purple-200", icon: <TrendingUp className="w-3 h-3" /> },
  resolue:                { label: "Résolue",               color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
  refusee:                { label: "Refusée",               color: "bg-red-100 text-red-700 border-red-200",          icon: <AlertTriangle className="w-3 h-3" /> },
  cloturee:               { label: "Clôturée",              color: "bg-slate-200 text-foreground border",    icon: <CheckCircle2 className="w-3 h-3" /> },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  faible:   { label: "Faible",   color: "text-muted-foreground" },
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
  collaboratorName: string;
  createdAt: string;
  updatedAt: string;
};

type Stats = {
  total: number;
  resolvedThisMonth: number;
  avgProcessingDays: number | null;
  byStatus: { status: string; count: number }[];
  byCategory: { category: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  byDepartment: { deptId: string | null; deptName: string; count: number }[];
};

type Department = { id: string; name: string };
type Collaborator = { id: string; firstName: string; lastName: string };

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReclamationsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const perms = usePermissions();
  const isManager = perms.has("hr.manage");

  // ── Filters ──────────────────────────────────────────────────────────────────
  const [statusTab, setStatusTab] = useState("all");
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterDept, setFilterDept] = useState("all");
  const [filterCollab, setFilterCollab] = useState("all");

  // ── New claim dialog ──────────────────────────────────────────────────────────
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    category: "", subject: "", description: "",
    priority: "normale", isAnonymous: false,
  });
  // Pièces jointes sous forme de liens (nom + URL) pour la soumission initiale
  const [attachLinks, setAttachLinks] = useState<{ name: string; url: string }[]>([]);
  const [attachInput, setAttachInput] = useState({ name: "", url: "" });

  // ── Data queries ──────────────────────────────────────────────────────────────
  const params = new URLSearchParams();
  if (statusTab !== "all") params.set("status", statusTab);
  if (filterCategory !== "all") params.set("category", filterCategory);
  if (filterPriority !== "all") params.set("priority", filterPriority);
  if (isManager && filterDept !== "all") params.set("departmentId", filterDept);
  if (isManager && filterCollab !== "all") params.set("collaboratorId", filterCollab);

  const { data: claimsData, isLoading } = useQuery({
    queryKey: ["hr-claims", statusTab, filterCategory, filterPriority, filterDept, filterCollab],
    queryFn: () => apiFetch<{ data: Claim[]; total: number }>(`/api/hr/claims?${params.toString()}`),
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["hr-claims-stats"],
    queryFn: () => apiFetch("/api/hr/claims/stats"),
    enabled: isManager,
  });

  const { data: depts } = useQuery<Department[]>({
    queryKey: ["hr-departments"],
    queryFn: () => apiFetch("/api/hr/departments"),
    enabled: isManager,
    select: (d: any) => d.data ?? d,
  });

  const { data: collabs } = useQuery<Collaborator[]>({
    queryKey: ["collaborators-list"],
    queryFn: () => apiFetch("/api/collaborators"),
    enabled: isManager,
    select: (d: any) => d.data ?? d,
  });

  const createMutation = useMutation({
    mutationFn: (body: object) => apiFetch("/api/hr/claims", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-claims"] });
      qc.invalidateQueries({ queryKey: ["hr-claims-stats"] });
      setShowNew(false);
      setForm({ category: "", subject: "", description: "", priority: "normale", isAnonymous: false });
      setAttachLinks([]);
      setAttachInput({ name: "", url: "" });
      toast({ title: "Réclamation soumise", description: "Votre réclamation a été enregistrée." });
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de soumettre la réclamation.", variant: "destructive" }),
  });

  // ── Computed ──────────────────────────────────────────────────────────────────
  const claims = claimsData?.data ?? [];
  const filtered = claims.filter(c =>
    !search ||
    c.subject.toLowerCase().includes(search.toLowerCase()) ||
    c.reference.toLowerCase().includes(search.toLowerCase()) ||
    c.collaboratorName.toLowerCase().includes(search.toLowerCase()),
  );

  const pendingCount = stats?.byStatus.find(s => s.status === "soumise")?.count ?? 0;
  const urgentCount = stats?.byPriority.find(p => p.priority === "urgente")?.count ?? 0;

  // ── Handlers ──────────────────────────────────────────────────────────────────
  function addAttachLink() {
    if (!attachInput.name.trim() || !attachInput.url.trim()) return;
    setAttachLinks(prev => [...prev, { name: attachInput.name.trim(), url: attachInput.url.trim() }]);
    setAttachInput({ name: "", url: "" });
  }

  function removeAttachLink(idx: number) {
    setAttachLinks(prev => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.category || !form.subject || !form.description) {
      toast({ title: "Champs manquants", description: "Catégorie, objet et description sont obligatoires.", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      category: form.category,
      subject: form.subject,
      description: form.description,
      priority: form.priority,
      isAnonymous: form.isAnonymous,
      attachments: attachLinks.map(a => ({ fileName: a.name, fileUrl: a.url })),
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <HrShell title="Réclamations RH">

      {/* ── Manager KPIs ─────────────────────────────────────────────────────── */}
      {isManager && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><MessageSquareWarning className="w-4 h-4" /> Total</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Clock className="w-4 h-4 text-blue-500" /> En attente</div>
              <div className="text-2xl font-bold text-blue-600">{pendingCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><AlertTriangle className="w-4 h-4 text-red-500" /> Urgentes</div>
              <div className="text-2xl font-bold text-red-600">{urgentCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Résolues ce mois</div>
              <div className="text-2xl font-bold text-emerald-600">{stats.resolvedThisMonth}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Timer className="w-4 h-4 text-purple-500" /> Délai moyen</div>
              <div className="text-2xl font-bold text-purple-600">
                {stats.avgProcessingDays != null ? `${stats.avgProcessingDays}j` : "—"}
              </div>
            </CardContent>
          </Card>

          {/* Répartition par département */}
          {stats.byDepartment.length > 0 && (
            <Card className="col-span-2 md:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Building2 className="w-4 h-4" /> Volume par département</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.byDepartment.slice(0, 5).map(d => (
                    <div key={d.deptId ?? "none"} className="flex items-center gap-2">
                      <span className="text-xs w-32 truncate text-muted-foreground">{d.deptName}</span>
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div
                          className="bg-orange-400 h-2 rounded-full"
                          style={{ width: `${stats.total ? Math.round((d.count / stats.total) * 100) : 0}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium w-6 text-right">{d.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par référence, objet…"
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Manager filters */}
        {isManager && (
          <>
            <Select value={filterDept} onValueChange={setFilterDept}>
              <SelectTrigger className="w-[180px]">
                <Building2 className="w-4 h-4 mr-1 text-muted-foreground" />
                <SelectValue placeholder="Département" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les depts</SelectItem>
                {(depts ?? []).map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterCollab} onValueChange={setFilterCollab}>
              <SelectTrigger className="w-[180px]">
                <Users className="w-4 h-4 mr-1 text-muted-foreground" />
                <SelectValue placeholder="Collaborateur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {(collabs ?? []).map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}

        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[180px]">
            <Filter className="w-4 h-4 mr-1 text-muted-foreground" />
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {CATEGORY_VALUES.map(k => <SelectItem key={k} value={k}>{CATEGORY_LABELS[k]}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Priorité" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nouvelle réclamation
        </Button>
      </div>

      {/* ── Status tabs ───────────────────────────────────────────────────────── */}
      <Tabs value={statusTab} onValueChange={setStatusTab} className="mb-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all">Toutes <SectionHelp id="hr.reclamations.all" /></TabsTrigger>
          <TabsTrigger value="soumise">Soumises <SectionHelp id="hr.reclamations.soumise" /></TabsTrigger>
          <TabsTrigger value="en_cours">En cours <SectionHelp id="hr.reclamations.en_cours" /></TabsTrigger>
          <TabsTrigger value="infos_complementaires">Infos requises <SectionHelp id="hr.reclamations.infos_complementaires" /></TabsTrigger>
          <TabsTrigger value="en_traitement">En traitement <SectionHelp id="hr.reclamations.en_traitement" /></TabsTrigger>
          <TabsTrigger value="resolue">Résolues <SectionHelp id="hr.reclamations.resolue" /></TabsTrigger>
          <TabsTrigger value="cloturee">Clôturées <SectionHelp id="hr.reclamations.cloturee" /></TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ── Claims list ───────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquareWarning className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Aucune réclamation</p>
          <p className="text-sm mt-1">
            {statusTab === "all" ? "Vous n'avez pas encore soumis de réclamation." : `Aucune réclamation avec ce statut.`}
          </p>
          <Button className="mt-4" variant="outline" onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-2" /> Soumettre une réclamation
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const st = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.soumise;
            const pr = PRIORITY_CONFIG[c.priority] ?? PRIORITY_CONFIG.normale;
            return (
              <div
                key={c.id}
                className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/40 cursor-pointer transition-colors"
                onClick={() => navigate(`/rh/reclamations/${c.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-muted-foreground">{c.reference}</span>
                    <Badge variant="outline" className={`text-xs px-2 py-0 ${st.color}`}>
                      {st.icon}<span className="ml-1">{st.label}</span>
                    </Badge>
                    <span className={`text-xs font-medium ${pr.color}`}>{pr.label}</span>
                    {isManager && c.isAnonymous && (
                      <Badge variant="secondary" className="text-xs">Anonyme</Badge>
                    )}
                  </div>
                  <div className="font-medium truncate">{c.subject}</div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{CATEGORY_LABELS[c.category] ?? c.category}</span>
                    {isManager && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{c.collaboratorName}</span>}
                    <span>{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true, locale: fr })}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
            );
          })}
        </div>
      )}

      {/* ── New claim dialog ──────────────────────────────────────────────────── */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle réclamation</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Label>Catégorie *</Label>
                <FieldTooltip content="Thème principal de la réclamation. Choisissez la catégorie la plus proche pour que votre dossier soit acheminé vers le bon responsable RH." />
              </div>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choisir une catégorie…" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_VALUES.map(k => <SelectItem key={k} value={k}>{CATEGORY_LABELS[k]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center gap-1 mb-1">
                <Label>Priorité</Label>
                <FieldTooltip content="Urgence estimée de votre réclamation. Les réclamations urgentes sont traitées sous 24 h. Réservez ce niveau aux situations critiques (harcèlement, sécurité, non-paiement)." />
              </div>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center gap-1 mb-1">
                <Label>Objet *</Label>
                <FieldTooltip content="Résumé court et précis de la réclamation (max. 200 caractères). Il apparaîtra dans la liste et dans les notifications envoyées au responsable RH." />
              </div>
              <Input
                className="mt-1"
                placeholder="Résumé de la réclamation"
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                maxLength={200}
              />
            </div>

            <div>
              <div className="flex items-center gap-1 mb-1">
                <Label>Description *</Label>
                <FieldTooltip content="Exposé détaillé des faits. Mentionnez les dates, lieux, personnes impliquées et l'impact concret sur votre situation. Plus c'est précis, plus vite votre dossier sera traité." />
              </div>
              <Textarea
                className="mt-1"
                placeholder="Décrivez les faits précisément : date, lieu, personnes concernées, impact…"
                rows={5}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
              <FieldHint>Soyez précis : date, lieu, personnes impliquées, impact sur votre travail.</FieldHint>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="anonymous"
                checked={form.isAnonymous}
                onChange={e => setForm(f => ({ ...f, isAnonymous: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="anonymous" className="cursor-pointer text-sm">
                Soumettre de manière anonyme
              </Label>
              <FieldTooltip content="Si coché, votre identité est masquée aux managers et à la DRH. Seul l'administrateur système peut lever l'anonymat sur décision judiciaire." />
            </div>

            {/* Pièces jointes (liens/URL) */}
            <div>
              <Label className="flex items-center gap-1"><Paperclip className="w-3.5 h-3.5" /> Pièces jointes</Label>
              <p className="text-xs text-muted-foreground mb-2">Ajoutez des liens vers vos documents (URL, partage de fichier…)</p>

              {attachLinks.length > 0 && (
                <div className="space-y-1 mb-2">
                  {attachLinks.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 bg-muted/50 border rounded px-2 py-1">
                      <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-xs flex-1 truncate">{a.name}</span>
                      <button
                        type="button"
                        className="text-xs text-red-500 hover:text-red-700 shrink-0"
                        onClick={() => removeAttachLink(i)}
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  placeholder="Nom du document"
                  value={attachInput.name}
                  onChange={e => setAttachInput(prev => ({ ...prev, name: e.target.value }))}
                  className="text-xs flex-1"
                />
                <Input
                  placeholder="URL du fichier"
                  value={attachInput.url}
                  onChange={e => setAttachInput(prev => ({ ...prev, url: e.target.value }))}
                  className="text-xs flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addAttachLink}
                  disabled={!attachInput.name.trim() || !attachInput.url.trim()}
                >+</Button>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowNew(false)}>Annuler</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Soumettre
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
