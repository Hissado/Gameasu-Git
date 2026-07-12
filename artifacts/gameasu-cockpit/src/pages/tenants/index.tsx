import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Loader2, Search, Building2, Users, CreditCard, Power, PowerOff,
  CheckCircle2, ChevronRight, AlertTriangle, TrendingUp, Filter, Plus, Trash2,
} from "lucide-react";
import { toast } from "sonner";

type Org = {
  id: string; name: string; slug: string; industry: string | null;
  country: string | null; isActive: boolean; isDefault: boolean;
  createdAt: string; planCode: string | null; planName: string | null;
  billingCycle: string | null; status: string | null;
  memberCount: number; activeUsers: number; enabledModules: number;
  mrr: number;
  priceHt: number | null; priceTva: number | null; priceTtc: number | null;
  isCustomPricing: boolean;
  currentPeriodEnd: string | null; failedPayments: number; openTickets: number;
  healthScore: number; healthLabel: string;
};

type OrgList = { count: number; rows: Org[] };

type Plan = {
  id: string; code: string; name: string;
  monthlyPricePerSeat: number; currency: string;
  includedSeats: number; sortOrder: number;
};

const PLAN_COLOR: Record<string, string> = {
  STARTER: "bg-indigo-50 text-indigo-700 border-indigo-200",
  GROWTH: "bg-violet-50 text-violet-700 border-violet-200",
  PROFESSIONAL: "bg-purple-50 text-purple-700 border-purple-200",
  ENTERPRISE: "bg-pink-50 text-pink-700 border-pink-200",
};

const HEALTH_CFG: Record<string, { cls: string }> = {
  "Excellent":    { cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  "Stable":       { cls: "bg-blue-50 text-blue-700 border-blue-200" },
  "À surveiller": { cls: "bg-amber-50 text-amber-700 border-amber-200" },
  "À risque":     { cls: "bg-orange-50 text-orange-700 border-orange-200" },
  "Critique":     { cls: "bg-red-50 text-red-700 border-red-200" },
};

function fmtFCFA(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(n);
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export default function TenantsPage() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterHealth, setFilterHealth] = useState("all");
  const [confirming, setConfirming] = useState<Org | null>(null);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState<Org | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const ORG_TYPE_OPTIONS = [
    { value: "pme",            label: "🏢 Entreprise / PME",                   framework: "SYSCOHADA" },
    { value: "tpe",            label: "🏪 Très petite entreprise (TPE)",        framework: "SYSCOHADA SMT" },
    { value: "cooperative",   label: "🤝 Coopérative / GIE",                   framework: "SYSCOHADA" },
    { value: "ong",            label: "💚 Association / ONG / Fondation",       framework: "SYCEBNL" },
    { value: "banque",         label: "🏦 Banque / Établissement de crédit",    framework: "PCB UMOA" },
    { value: "microfinance",   label: "💳 Microfinance / SFD",                  framework: "SFD" },
    { value: "assurance",      label: "🛡️ Compagnie d'assurance",              framework: "CIMA" },
    { value: "prevoyance",     label: "🏛️ Prévoyance sociale",                 framework: "CIPRES" },
    { value: "administration", label: "🏩 Administration publique",             framework: "PCE" },
    { value: "cabinet",        label: "📋 Cabinet / Profession libérale",       framework: "SYSCOHADA" },
    { value: "autre",          label: "📁 Autre",                               framework: "SYSCOHADA" },
  ];

  const [createForm, setCreateForm] = useState({
    orgName: "", planCode: "STARTER",
    adminEmail: "", adminFirstName: "", adminLastName: "",
    country: "TG", industry: "", orgType: "pme",
  });

  const createMut = useMutation({
    mutationFn: (body: typeof createForm) =>
      apiFetch("/api/super-admin/structures", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success("Organisation créée — email d'invitation envoyé à l'administrateur");
      qc.invalidateQueries({ queryKey: ["cockpit-orgs"] });
      qc.invalidateQueries({ queryKey: ["cockpit-overview"] });
      setCreateOpen(false);
      setCreateForm({ orgName: "", planCode: "STARTER", adminEmail: "", adminFirstName: "", adminLastName: "", country: "TG", industry: "", orgType: "pme" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur lors de la création"),
  });

  const { data, isLoading } = useQuery<OrgList>({
    queryKey: ["cockpit-orgs"],
    queryFn: () => apiFetch("/api/super-admin/organizations"),
    refetchInterval: 60_000,
  });


  const rows = (data?.rows ?? []).filter((o) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!o.name.toLowerCase().includes(q) && !o.slug.toLowerCase().includes(q) && !(o.industry ?? "").toLowerCase().includes(q)) return false;
    }
    if (filterPlan !== "all" && o.planCode !== filterPlan) return false;
    if (filterStatus === "active" && !o.isActive) return false;
    if (filterStatus === "suspended" && o.isActive) return false;
    if (filterHealth !== "all" && o.healthLabel !== filterHealth) return false;
    return true;
  });

  const allRows = data?.rows ?? [];
  const totalMRR = allRows.reduce((s, o) => s + o.mrr, 0);
  const atRisk = allRows.filter((o) => o.healthLabel === "À risque" || o.healthLabel === "Critique").length;
  const withFailedPayments = allRows.filter((o) => o.failedPayments > 0).length;

  const plans = [...new Set(allRows.map((o) => o.planCode).filter(Boolean))] as string[];

  const handleToggle = async () => {
    if (!confirming) return;
    setToggling(true);
    try {
      const action = confirming.isActive ? "suspend" : "reactivate";
      await apiFetch(`/api/super-admin/organizations/${confirming.id}/status`, {
        method: "PATCH", body: JSON.stringify({ action }),
      });
      toast.success(action === "suspend" ? "Organisation suspendue" : "Organisation réactivée");
      qc.invalidateQueries({ queryKey: ["cockpit-orgs"] });
      qc.invalidateQueries({ queryKey: ["cockpit-overview"] });
      setConfirming(null);
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Erreur");
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting || deleteConfirm.trim() !== deleting.name) return;
    setDeletingBusy(true);
    try {
      await apiFetch(`/api/super-admin/organizations/${deleting.id}`, {
        method: "DELETE", body: JSON.stringify({ confirm: deleteConfirm.trim() }),
      });
      toast.success(`Organisation « ${deleting.name} » supprimée définitivement`);
      qc.invalidateQueries({ queryKey: ["cockpit-orgs"] });
      qc.invalidateQueries({ queryKey: ["cockpit-overview"] });
      setDeleting(null);
      setDeleteConfirm("");
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Erreur lors de la suppression");
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Cockpit</p>
          <h1 className="text-2xl font-bold tracking-tight">Organisations</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {data?.count ?? 0} tenants · Prix HT total {fmtFCFA(totalMRR)} /mois
          </p>
        </div>
        <Button className="gap-2 shrink-0" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" />
          Nouvelle organisation
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-[11px] uppercase font-semibold text-muted-foreground">Actives</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{allRows.filter((o) => o.isActive).length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-[11px] uppercase font-semibold text-muted-foreground">Suspendues</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{allRows.filter((o) => !o.isActive).length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-[11px] uppercase font-semibold text-muted-foreground">À risque / Critiques</p>
          <p className={`text-2xl font-bold mt-1 ${atRisk > 0 ? "text-orange-600" : "text-muted-foreground"}`}>{atRisk}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-[11px] uppercase font-semibold text-muted-foreground">Paiements échoués</p>
          <p className={`text-2xl font-bold mt-1 ${withFailedPayments > 0 ? "text-red-600" : "text-muted-foreground"}`}>{withFailedPayments}</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterPlan} onValueChange={setFilterPlan}>
          <SelectTrigger className="w-36 h-9">
            <Filter className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les plans</SelectItem>
            {plans.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="active">Actives</SelectItem>
            <SelectItem value="suspended">Suspendues</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterHealth} onValueChange={setFilterHealth}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="Santé" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes santés</SelectItem>
            <SelectItem value="Excellent">Excellent</SelectItem>
            <SelectItem value="Stable">Stable</SelectItem>
            <SelectItem value="À surveiller">À surveiller</SelectItem>
            <SelectItem value="À risque">À risque</SelectItem>
            <SelectItem value="Critique">Critique</SelectItem>
          </SelectContent>
        </Select>
        {(search || filterPlan !== "all" || filterStatus !== "all" || filterHealth !== "all") && (
          <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setSearch(""); setFilterPlan("all"); setFilterStatus("all"); setFilterHealth("all"); }}>
            Effacer filtres
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{rows.length} résultat{rows.length !== 1 ? "s" : ""}</span>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="w-4 h-4" />Liste des tenants
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right"><Users className="w-3.5 h-3.5 inline mr-1" />Actifs</TableHead>
                    <TableHead className="text-right">Prix HT/mois</TableHead>
                    <TableHead className="text-right">Prix TTC/mois</TableHead>
                    <TableHead>Santé</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Renouvellement</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                        Aucune organisation ne correspond aux filtres
                      </TableCell>
                    </TableRow>
                  ) : rows.map((org) => (
                    <TableRow
                      key={org.id}
                      className={`${!org.isActive ? "opacity-60" : ""} cursor-pointer hover:bg-muted/30 transition-colors`}
                      onClick={() => navigate(`/tenants/${org.id}`)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{org.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{org.slug}</p>
                          {org.industry && <p className="text-[10px] text-muted-foreground">{org.industry}</p>}
                          {org.failedPayments > 0 && (
                            <span className="text-[10px] text-red-600 flex items-center gap-0.5 mt-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" />{org.failedPayments} paiement{org.failedPayments > 1 ? "s" : ""} échoué{org.failedPayments > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {org.planCode ? (
                          <Badge variant="outline" className={PLAN_COLOR[org.planCode] ?? ""}>{org.planCode}</Badge>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        <span>{org.activeUsers}</span>
                        {org.isCustomPricing && (
                          <span className="ml-1 text-[10px] text-purple-600 font-semibold">NÉGO</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium whitespace-nowrap">
                        {org.isCustomPricing && org.priceHt == null
                          ? <span className="text-xs text-muted-foreground italic">Personnalisée</span>
                          : <span>{fmtFCFA(org.priceHt ?? 0)}</span>
                        }
                      </TableCell>
                      <TableCell className="text-right text-sm whitespace-nowrap text-muted-foreground">
                        {org.isCustomPricing && org.priceTtc == null
                          ? <span className="text-xs italic">—</span>
                          : <span>{fmtFCFA(org.priceTtc ?? 0)}</span>
                        }
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Badge variant="outline" className={`text-xs ${HEALTH_CFG[org.healthLabel]?.cls ?? ""}`}>
                          {org.healthLabel}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {org.isDefault ? (
                          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">Défaut</Badge>
                        ) : org.isActive ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" />Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Suspendue</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {org.currentPeriodEnd ? fmtDate(org.currentPeriodEnd) : "—"}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {!org.isDefault && (
                            <Button
                              size="sm" variant="outline"
                              className={`h-7 text-xs gap-1 ${org.isActive ? "text-red-600 border-red-200 hover:bg-red-50" : "text-emerald-600 border-emerald-200 hover:bg-emerald-50"}`}
                              onClick={() => setConfirming(org)}
                              title={org.isActive ? "Suspendre" : "Réactiver"}
                            >
                              {org.isActive ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
                            </Button>
                          )}
                          {!org.isDefault && (
                            <Button
                              size="sm" variant="outline"
                              className="h-7 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => { setDeleting(org); setDeleteConfirm(""); }}
                              title="Supprimer définitivement"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => navigate(`/tenants/${org.id}`)}>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {confirming && (
        <Dialog open onOpenChange={(o) => { if (!o) setConfirming(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirming.isActive ? "Suspendre" : "Réactiver"} l'organisation</DialogTitle>
              <DialogDescription>
                {confirming.isActive
                  ? `Suspendre "${confirming.name}" bloquera l'accès à tous ses membres.`
                  : `Réactiver "${confirming.name}" rétablira l'accès à tous ses membres.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setConfirming(null)}>Annuler</Button>
              <Button variant={confirming.isActive ? "destructive" : "default"} onClick={handleToggle} disabled={toggling}>
                {toggling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {confirming.isActive ? "Suspendre" : "Réactiver"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {deleting && (
        <Dialog open onOpenChange={(o) => { if (!o) { setDeleting(null); setDeleteConfirm(""); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                Supprimer définitivement l'organisation
              </DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-3 pt-1">
                  <p>
                    Cette action est <strong>irréversible</strong>. Toutes les données de
                    « {deleting.name} » seront supprimées : membres, projets, CRM, finances,
                    RH, stock, messagerie et historiques. Cette organisation ne pourra pas
                    être récupérée.
                  </p>
                  <p className="text-sm">
                    Pour confirmer, saisissez le nom exact de l'organisation&nbsp;:
                    <span className="font-semibold text-foreground"> {deleting.name}</span>
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <Input
              autoFocus
              placeholder={deleting.name}
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && deleteConfirm.trim() === deleting.name && !deletingBusy) handleDelete(); }}
              className="border-red-200 focus-visible:ring-red-400"
            />
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setDeleting(null); setDeleteConfirm(""); }} disabled={deletingBusy}>
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deletingBusy || deleteConfirm.trim() !== deleting.name}
                className="gap-2"
              >
                {deletingBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Supprimer définitivement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Dialog : Nouvelle organisation ── */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) setCreateOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Nouvelle organisation
            </DialogTitle>
            <DialogDescription>
              Crée l'espace de travail, l'abonnement (essai 14 jours) et envoie une invitation à l'administrateur.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Nom + Secteur */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Nom de l'organisation <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="Ex : BTP Gabon SARL"
                  value={createForm.orgName}
                  onChange={e => setCreateForm(f => ({ ...f, orgName: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Secteur d'activité</Label>
                <Input
                  placeholder="BTP, Mines, Commerce…"
                  value={createForm.industry}
                  onChange={e => setCreateForm(f => ({ ...f, industry: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Pays</Label>
                <Select value={createForm.country} onValueChange={v => setCreateForm(f => ({ ...f, country: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[
                      ["TG", "🇹🇬 Togo"], ["CI", "🇨🇮 Côte d'Ivoire"], ["SN", "🇸🇳 Sénégal"],
                      ["CM", "🇨🇲 Cameroun"], ["GA", "🇬🇦 Gabon"], ["CD", "🇨🇩 RD Congo"],
                      ["BJ", "🇧🇯 Bénin"], ["BF", "🇧🇫 Burkina Faso"], ["ML", "🇲🇱 Mali"],
                      ["GH", "🇬🇭 Ghana"], ["NG", "🇳🇬 Nigeria"], ["FR", "🇫🇷 France"],
                    ].map(([code, label]) => (
                      <SelectItem key={code} value={code}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Type d'organisation → référentiel comptable */}
            <div className="space-y-1.5">
              <Label>Type d'organisation</Label>
              <Select value={createForm.orgType} onValueChange={v => setCreateForm(f => ({ ...f, orgType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORG_TYPE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(() => {
                const opt = ORG_TYPE_OPTIONS.find(o => o.value === createForm.orgType);
                return opt ? (
                  <p className="text-xs text-muted-foreground">Référentiel comptable : <strong>{opt.framework}</strong></p>
                ) : null;
              })()}
            </div>

            {/* Accès */}
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-emerald-200 bg-emerald-50/60 text-sm text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span><strong>Accès complet</strong> — tous les modules inclus · tarification dégressive par utilisateur</span>
            </div>

            {/* Admin */}
            <div className="space-y-3 p-3 rounded-lg bg-muted/40 border border-dashed">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Administrateur principal</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Prénom <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="Jean"
                    value={createForm.adminFirstName}
                    onChange={e => setCreateForm(f => ({ ...f, adminFirstName: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Nom <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="Dupont"
                    value={createForm.adminLastName}
                    onChange={e => setCreateForm(f => ({ ...f, adminLastName: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Email <span className="text-red-500">*</span></Label>
                <Input
                  type="email"
                  placeholder="admin@entreprise.com"
                  value={createForm.adminEmail}
                  onChange={e => setCreateForm(f => ({ ...f, adminEmail: e.target.value }))}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Un email d'invitation avec les identifiants temporaires sera envoyé à cette adresse.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createMut.isPending}>
              Annuler
            </Button>
            <Button
              onClick={() => createMut.mutate(createForm)}
              disabled={
                createMut.isPending ||
                !createForm.orgName.trim() ||
                !createForm.adminEmail.trim() ||
                !createForm.adminFirstName.trim() ||
                !createForm.adminLastName.trim()
              }
              className="gap-2"
            >
              {createMut.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Création…</>
                : <><Plus className="w-4 h-4" /> Créer l'organisation</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
