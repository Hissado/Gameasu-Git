import { useState } from "react";
import { Link } from "wouter";
import {
  useActiveFirm, useExpertClients, useAddClientOrg, useUnlinkClient,
  ACCESS_LABEL, PLAN_COLOR,
} from "@/lib/expert-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useSwitchClientContext } from "@/lib/expert-api";
import {
  Building2, Plus, Search, Settings, FileText, Trash2, AlertCircle, Users2, ExternalLink, CreditCard,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Loader2 } from "lucide-react";

const SECTEURS = [
  "BTP / Construction", "Mines & Ressources", "Commerce & Distribution",
  "Industrie & Fabrication", "Agriculture & Agroalimentaire", "Transport & Logistique",
  "Services professionnels", "Finance & Assurance", "Santé", "Éducation",
  "Énergie & Environnement", "Technologie & Télécom", "Autre",
];

function AddClientModal({ firmId, open, onClose }: { firmId: string; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const add = useAddClientOrg(firmId);
  const [form, setForm] = useState({
    name: "", country: "TG", industry: "",
    ownerFirstName: "", ownerLastName: "", ownerEmail: "",
    accessLevel: "read",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.ownerEmail.trim()) return;
    try {
      await add.mutateAsync(form);
      toast({ title: "Client ajouté", description: "Un email d'invitation a été envoyé au dirigeant." });
      onClose();
      setForm({ name: "", country: "TG", industry: "", ownerFirstName: "", ownerLastName: "", ownerEmail: "", accessLevel: "read" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.body?.error ?? "Erreur lors de la création", variant: "destructive" });
    }
  };

  const f = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter un client</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Nom de l'organisation *</Label>
              <Input value={form.name} onChange={(e) => f("name", e.target.value)} placeholder="Entreprise SA" required />
            </div>
            <div className="space-y-1.5">
              <Label>Pays</Label>
              <Input value={form.country} onChange={(e) => f("country", e.target.value)} placeholder="TG" maxLength={3} />
            </div>
            <div className="space-y-1.5">
              <Label>Secteur d'activité</Label>
              <Select value={form.industry} onValueChange={(v) => f("industry", v)}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {SECTEURS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Niveau d'accès cabinet</Label>
              <Select value={form.accessLevel} onValueChange={(v) => f("accessLevel", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">Lecture seule</SelectItem>
                  <SelectItem value="full">Accès complet</SelectItem>
                  <SelectItem value="billing">Facturation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Dirigeant / administrateur</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Prénom *</Label>
                <Input value={form.ownerFirstName} onChange={(e) => f("ownerFirstName", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Nom *</Label>
                <Input value={form.ownerLastName} onChange={(e) => f("ownerLastName", e.target.value)} required />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>E-mail *</Label>
                <Input type="email" value={form.ownerEmail} onChange={(e) => f("ownerEmail", e.target.value)} placeholder="dirigeant@entreprise.com" required />
                <p className="text-xs text-muted-foreground">Un lien d'invitation sécurisé lui sera envoyé.</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={add.isPending}>
              {add.isPending ? "Création…" : "Créer et inviter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const AVAILABLE_PLANS = [
  { code: "STARTER", label: "Starter" },
  { code: "GROWTH", label: "Growth" },
  { code: "PROFESSIONAL", label: "Professional" },
  { code: "ENTERPRISE", label: "Enterprise" },
];

function ChangePlanModal({
  firmId, target, onClose,
}: {
  firmId: string;
  target: { orgId: string; orgName: string; currentPlanCode?: string } | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [planCode, setPlanCode] = useState(target?.currentPlanCode?.toUpperCase() ?? "STARTER");

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/expert/firms/${firmId}/clients/${target!.orgId}/plan`, {
        method: "PATCH",
        body: JSON.stringify({ planCode }),
      }),
    onSuccess: () => {
      toast({ title: "Formule mise à jour", description: `${target!.orgName} est maintenant sur le plan ${AVAILABLE_PLANS.find((p) => p.code === planCode)?.label ?? planCode}.` });
      qc.invalidateQueries({ queryKey: ["expert/clients", firmId] });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err?.body?.error ?? "Impossible de changer le plan", variant: "destructive" });
    },
  });

  if (!target) return null;

  return (
    <Dialog open={!!target} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            Changer la formule
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Modifier la formule d'abonnement de <strong>{target.orgName}</strong>. Un email de confirmation sera envoyé à l'administrateur du client.
          </p>
          <div className="space-y-1.5">
            <Label>Nouvelle formule</Label>
            <Select value={planCode} onValueChange={setPlanCode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_PLANS.map((p) => (
                  <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {planCode === target.currentPlanCode?.toUpperCase() && (
            <p className="text-xs text-amber-600">Cette formule est déjà active.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || planCode === target.currentPlanCode?.toUpperCase()}
          >
            {mutation.isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Enregistrement…</> : "Confirmer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ExpertClientsPage() {
  const { firmId } = useActiveFirm();
  const { data: clients, isLoading } = useExpertClients(firmId);
  const unlink = useUnlinkClient(firmId ?? "");
  const switchContext = useSwitchClientContext(firmId);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [accessFilter, setAccessFilter] = useState("all");
  const [secteurFilter, setSecteurFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [statutFilter, setStatutFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [toUnlink, setToUnlink] = useState<{ id: string; name: string } | null>(null);
  const [planChangeTarget, setPlanChangeTarget] = useState<{ orgId: string; orgName: string; currentPlanCode?: string } | null>(null);

  if (!firmId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <AlertCircle className="w-10 h-10 text-muted-foreground/40" />
        <p className="text-muted-foreground">Aucun cabinet sélectionné. Accédez au <Link href="/expert" className="text-primary underline">tableau de bord Expert</Link> pour créer ou sélectionner un cabinet.</p>
      </div>
    );
  }

  const allPlans = Array.from(new Set((clients ?? []).map((c) => c.subscription?.planName).filter(Boolean))) as string[];
  const allSecteurs = Array.from(new Set((clients ?? []).map((c) => (c.org as any).industry).filter(Boolean))) as string[];

  const filtered = (clients ?? []).filter((c) => {
    if (search && !c.org.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (accessFilter !== "all" && c.accessLevel !== accessFilter) return false;
    if (secteurFilter !== "all" && (c.org as any).industry !== secteurFilter) return false;
    if (planFilter !== "all" && (c.subscription?.planName ?? "Sans plan") !== planFilter) return false;
    if (statutFilter !== "all") {
      if (statutFilter === "actif" && !c.isActive) return false;
      if (statutFilter === "inactif" && c.isActive) return false;
    }
    return true;
  });

  const handleUnlink = async () => {
    if (!toUnlink) return;
    try {
      await unlink.mutateAsync(toUnlink.id);
      toast({ title: "Client délié" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.body?.error, variant: "destructive" });
    }
    setToUnlink(null);
  };

  const activeFilters = [accessFilter, secteurFilter, planFilter, statutFilter].filter((f) => f !== "all").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mes clients</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{clients?.length ?? 0} organisation{(clients?.length ?? 0) !== 1 ? "s" : ""} liée{(clients?.length ?? 0) !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />Ajouter un client
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <Input className="pl-9 w-52" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={secteurFilter} onValueChange={setSecteurFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Secteur" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les secteurs</SelectItem>
            {allSecteurs.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            {!allSecteurs.length && SECTEURS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les plans</SelectItem>
            <SelectItem value="Sans plan">Sans plan</SelectItem>
            {allPlans.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statutFilter} onValueChange={setStatutFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="actif">Actif</SelectItem>
            <SelectItem value="inactif">Inactif</SelectItem>
          </SelectContent>
        </Select>
        <Select value={accessFilter} onValueChange={setAccessFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Niveau d'accès" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les accès</SelectItem>
            <SelectItem value="full">Accès complet</SelectItem>
            <SelectItem value="read">Lecture seule</SelectItem>
            <SelectItem value="billing">Facturation</SelectItem>
          </SelectContent>
        </Select>
        {activeFilters > 0 && (
          <Button variant="ghost" size="sm" className="text-muted-foreground h-9"
            onClick={() => { setAccessFilter("all"); setSecteurFilter("all"); setPlanFilter("all"); setStatutFilter("all"); }}>
            Réinitialiser ({activeFilters})
          </Button>
        )}
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 bg-muted animate-pulse m-4 rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : !filtered.length ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
            <Building2 className="w-10 h-10 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">
              {search || activeFilters > 0 ? "Aucun client ne correspond aux filtres" : "Aucun client lié à ce cabinet"}
            </p>
            {!search && activeFilters === 0 && (
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" />Ajouter le premier client
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Organisation</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Secteur</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Plan</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">Accès</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">Dernière activité</th>
                    <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Statut</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <tr key={c.id} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${i % 2 !== 0 ? "bg-muted/10" : ""}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[180px]">{c.org.name}</p>
                            <p className="text-xs text-muted-foreground">{c.org.country}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                        <span className="truncate max-w-[140px] block">{(c.org as any).industry ?? <span className="text-muted-foreground/50">—</span>}</span>
                      </td>
                      <td className="px-4 py-3">
                        {c.subscription ? (
                          <Badge className={`text-[10px] font-semibold border ${PLAN_COLOR[c.subscription.planCode] ?? "bg-slate-100 text-slate-600"}`} variant="outline">
                            {c.subscription.planName}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">Sans plan</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-xs text-muted-foreground">{ACCESS_LABEL[c.accessLevel] ?? c.accessLevel}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {(c as any).updatedAt
                            ? new Date((c as any).updatedAt).toLocaleDateString("fr-FR")
                            : c.grantedAt
                            ? new Date(c.grantedAt).toLocaleDateString("fr-FR")
                            : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${c.isActive ? "text-emerald-600" : "text-amber-600"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${c.isActive ? "bg-emerald-500" : "bg-amber-400"}`} />
                          {c.isActive ? "Actif" : "Inactif"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost" size="sm"
                            className="h-8 w-8 p-0 text-primary/70 hover:text-primary"
                            title="Ouvrir workspace client"
                            onClick={() => switchContext.mutate(c.orgId, {
                              onSuccess: () => navigate("/"),
                              onError: (err: any) => toast({ title: "Erreur", description: err?.body?.error ?? "Impossible d'ouvrir le workspace", variant: "destructive" }),
                            })}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                          <Link href={`/expert/client-config?orgId=${c.orgId}`}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Configuration">
                              <Settings className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost" size="sm"
                            className="h-8 w-8 p-0 text-violet-500/70 hover:text-violet-600 hover:bg-violet-50"
                            title="Changer la formule d'abonnement"
                            onClick={() => setPlanChangeTarget({ orgId: c.orgId, orgName: c.org.name, currentPlanCode: c.subscription?.planCode })}
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </Button>
                          <Link href={`/expert/document-requests?orgId=${c.orgId}`}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Documents">
                              <FileText className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                          <Link href={`/expert/users-permissions?orgId=${c.orgId}`}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Utilisateurs">
                              <Users2 className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost" size="sm"
                            className="h-8 w-8 p-0 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                            title="Délier"
                            onClick={() => setToUnlink({ id: c.orgId, name: c.org.name })}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <AddClientModal firmId={firmId} open={addOpen} onClose={() => setAddOpen(false)} />

      {firmId && (
        <ChangePlanModal
          firmId={firmId}
          target={planChangeTarget}
          onClose={() => setPlanChangeTarget(null)}
        />
      )}

      <ConfirmDialog
        open={!!toUnlink}
        onOpenChange={(o) => { if (!o) setToUnlink(null); }}
        title="Délier ce client ?"
        description={`"${toUnlink?.name}" sera retiré de votre liste de clients. L'organisation et ses données ne seront pas supprimées.`}
        confirmLabel="Délier"
        destructive
        onConfirm={handleUnlink}
      />
    </div>
  );
}
