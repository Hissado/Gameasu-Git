/**
 * Cockpit super-admin — vue plateforme multi-tenant.
 * Onglets : Vue globale · Organisations · Invitations de structure
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Crown, Building2, Plus, Copy, Mail, Link2, CheckCircle2, Check,
  Search, Power, AlertTriangle, Users, Layers,
} from "lucide-react";
import { formatFCFA } from "@/lib/format";
import { useAuth } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────

type Plan = { id: string; code: string; name: string; monthlyPricePerSeat: number; currency: string };

type Org = {
  id: string; slug: string; name: string; industry?: string; country?: string;
  isActive: boolean; isDefault: boolean; createdAt: string;
  planCode: string | null; planName: string | null;
  seats: number; mrr: number; billingCycle: string | null; status: string | null;
  memberCount: number; enabledModules: number;
};

type Invitation = {
  id: string; token: string; contactName?: string; contactEmail?: string;
  suggestedOrgName?: string; suggestedPlanCode?: string; status: string;
  expiresAt?: string; createdAt: string;
};

// ─── Helpers ──────────────────────────────────────────────────────

const KPI = ({ label, value, accent }: { label: string; value: string | number; accent?: string }) => (
  <Card><CardContent className="p-4">
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold mb-1">{label}</p>
    <p className={`text-2xl font-bold ${accent ?? ""}`}>{value}</p>
  </CardContent></Card>
);

function orgStatusBadge(o: Org) {
  if (!o.isActive || o.status === "suspended") {
    return <Badge className="bg-red-50 text-red-700 border-red-200 hover:bg-red-50">Suspendu</Badge>;
  }
  switch (o.status) {
    case "trial":     return <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50">Essai</Badge>;
    case "active":    return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">Actif</Badge>;
    case "expired":   return <Badge className="bg-muted text-muted-foreground hover:bg-muted">Expiré</Badge>;
    case "past_due":  return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Échu</Badge>;
    case "cancelled": return <Badge className="bg-muted text-muted-foreground hover:bg-muted">Résilié</Badge>;
    default:          return <Badge variant="secondary">—</Badge>;
  }
}

function invStatusBadge(status: string) {
  switch (status) {
    case "accepted": return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">Acceptée</Badge>;
    case "pending":  return <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50">En attente</Badge>;
    case "expired":  return <Badge className="bg-muted text-muted-foreground hover:bg-muted">Expirée</Badge>;
    case "revoked":  return <Badge variant="secondary">Révoquée</Badge>;
    default:         return <Badge variant="outline">{status}</Badge>;
  }
}

// ─── Dialogue : Nouvelle structure ────────────────────────────────

function NewStructureDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [mode, setMode] = useState<"full" | "link">("full");
  const [result, setResult] = useState<{ acceptUrl?: string; onboardUrl?: string; temporaryPassword?: string; orgName?: string; emailSent?: boolean; adminEmail?: string } | null>(null);

  const [orgName, setOrgName] = useState("");
  const [country, setCountry] = useState("TG");
  const [industry, setIndustry] = useState("");
  const [planCode, setPlanCode] = useState("STARTER");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [linkSuggestedOrg, setLinkSuggestedOrg] = useState("");
  const [linkSuggestedPlan, setLinkSuggestedPlan] = useState<string>("");
  const [linkNotes, setLinkNotes] = useState("");

  const plans = useQuery<Plan[]>({
    queryKey: ["sa-plans"],
    queryFn: () => apiFetch("/api/subscription-plans"),
    enabled: open,
  });

  const reset = () => {
    setResult(null);
    setOrgName(""); setIndustry(""); setAdminEmail(""); setAdminFirstName(""); setAdminLastName("");
    setContactName(""); setContactEmail(""); setLinkSuggestedOrg(""); setLinkSuggestedPlan(""); setLinkNotes("");
  };

  const createFull = useMutation({
    mutationFn: () => apiFetch<any>("/api/super-admin/structures", { method: "POST", body: {
      orgName, country, industry: industry || undefined, planCode,
      adminEmail, adminFirstName, adminLastName,
    } as any }),
    onSuccess: (r) => {
      setResult({ acceptUrl: r.acceptUrl, temporaryPassword: r.temporaryPassword, orgName: r.organization.name, emailSent: r.delivery?.delivered === true, adminEmail });
      qc.invalidateQueries({ queryKey: ["sa-ov"] });
      qc.invalidateQueries({ queryKey: ["sa-orgs"] });
      toast({ title: "Structure créée", description: `${r.organization.name} — essai 14 jours actif.` });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error ?? e?.message, variant: "destructive" }),
  });

  const createLink = useMutation({
    mutationFn: () => apiFetch<any>("/api/super-admin/structures/invite-link", { method: "POST", body: {
      contactEmail: contactEmail || undefined,
      contactName: contactName || undefined,
      suggestedOrgName: linkSuggestedOrg || undefined,
      suggestedPlanCode: linkSuggestedPlan || undefined,
      notes: linkNotes || undefined,
    } as any }),
    onSuccess: (r) => {
      setResult({ onboardUrl: r.onboardUrl });
      qc.invalidateQueries({ queryKey: ["sa-invs"] });
      toast({ title: "Lien d'invitation créé", description: contactEmail ? "Email envoyé." : "Copiez le lien ci-dessous." });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error ?? e?.message, variant: "destructive" }),
  });

  const copy = (url: string) => { navigator.clipboard.writeText(url); toast({ title: "Lien copié" }); };
  const close = () => { onOpenChange(false); setTimeout(reset, 200); };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Building2 className="w-5 h-5 text-primary" />Nouvelle structure</DialogTitle>
          <DialogDescription>Onboarder une nouvelle organisation cliente. Essai gratuit 14 jours, puis abonnement actif.</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <Alert className="border-emerald-200 bg-emerald-50">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <AlertDescription className="text-emerald-800">
                <span className="font-semibold">{result.orgName}</span> a été créée avec succès.{" "}
                {result.emailSent
                  ? <>Email d'invitation envoyé à <span className="font-medium">{result.adminEmail}</span>.</>
                  : <>Aucun provider email configuré — partagez le lien ci-dessous manuellement.</>}
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label>Lien d'activation</Label>
              <div className="flex gap-2">
                <Input readOnly value={result.acceptUrl ?? result.onboardUrl ?? ""} className="font-mono text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={() => copy(result.acceptUrl ?? result.onboardUrl ?? "")}><Copy className="w-4 h-4" /></Button>
              </div>
            </div>
            {result.temporaryPassword && (
              <div className="space-y-2">
                <Label>Mot de passe temporaire</Label>
                <Input readOnly value={result.temporaryPassword} className="font-mono" />
                <p className="text-xs text-muted-foreground">L'administrateur devra le changer à la première connexion.</p>
              </div>
            )}
            <DialogFooter><Button onClick={close}>Terminé</Button></DialogFooter>
          </div>
        ) : (
          <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="full"><Mail className="w-4 h-4 mr-2" />Création complète</TabsTrigger>
              <TabsTrigger value="link"><Link2 className="w-4 h-4 mr-2" />Lien d'invitation</TabsTrigger>
            </TabsList>

            <TabsContent value="full" className="space-y-3 pt-4">
              <p className="text-xs text-muted-foreground">Vous créez tout : organisation + plan + administrateur. Un email d'invitation est envoyé automatiquement.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Nom de la structure *</Label><Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="SOGELEC Cameroun" /></div>
                <div><Label>Pays</Label><Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="TG" maxLength={2} /></div>
                <div><Label>Secteur</Label><Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="BTP" /></div>
                <div className="col-span-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50/60 text-sm text-emerald-800">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span><strong>Accès complet</strong> — tous les modules inclus · tarification dégressive par utilisateur</span>
                  </div>
                </div>
                <div className="col-span-2 pt-2 border-t"><Label className="text-xs uppercase tracking-wide text-muted-foreground">Administrateur principal</Label></div>
                <div><Label>Prénom *</Label><Input value={adminFirstName} onChange={(e) => setAdminFirstName(e.target.value)} /></div>
                <div><Label>Nom *</Label><Input value={adminLastName} onChange={(e) => setAdminLastName(e.target.value)} /></div>
                <div className="col-span-2"><Label>Email *</Label><Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@structure.com" /></div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={close}>Annuler</Button>
                <Button onClick={() => createFull.mutate()} disabled={createFull.isPending || !orgName || !adminEmail || !adminFirstName || !adminLastName} className="bg-primary hover:bg-primary/90">
                  {createFull.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Créer + envoyer l'invitation
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="link" className="space-y-3 pt-4">
              <p className="text-xs text-muted-foreground">Vous envoyez un lien d'auto-inscription. La structure choisit son nom, son plan et crée son administrateur. Lien valable 14 jours.</p>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nom du contact</Label><Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Optionnel" /></div>
                <div><Label>Email du contact</Label><Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Optionnel — envoi auto" /></div>
                <div className="col-span-2"><Label>Suggestion de nom</Label><Input value={linkSuggestedOrg} onChange={(e) => setLinkSuggestedOrg(e.target.value)} placeholder="Optionnel — pré-rempli pour l'invité" /></div>
                <div className="col-span-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50/60 text-sm text-emerald-800">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span><strong>Accès complet</strong> — tous les modules inclus · tarification dégressive par utilisateur</span>
                  </div>
                </div>
                <div className="col-span-2"><Label>Notes internes</Label><Textarea value={linkNotes} onChange={(e) => setLinkNotes(e.target.value)} rows={2} placeholder="Optionnel" /></div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={close}>Annuler</Button>
                <Button onClick={() => createLink.mutate()} disabled={createLink.isPending} className="bg-primary hover:bg-primary/90">
                  {createLink.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Générer le lien
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Cockpit principal ────────────────────────────────────────────

export default function SuperAdminCockpit() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState("overview");
  const [orgSearch, setOrgSearch] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ org: Org; action: "suspend" | "reactivate" } | null>(null);

  const ov   = useQuery<any>({ queryKey: ["sa-ov"],   queryFn: () => apiFetch("/api/super-admin/overview"),              enabled: user?.role === "super_admin" });
  const orgs = useQuery<{ count: number; rows: Org[] }>({ queryKey: ["sa-orgs"], queryFn: () => apiFetch("/api/super-admin/organizations"), enabled: user?.role === "super_admin" });
  const invs = useQuery<{ count: number; rows: Invitation[] }>({ queryKey: ["sa-invs"], queryFn: () => apiFetch("/api/super-admin/structure-invitations"), enabled: user?.role === "super_admin" });

  const toggleOrgStatus = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "suspend" | "reactivate" }) =>
      apiFetch(`/api/super-admin/organizations/${id}/status`, { method: "PATCH", body: { action } as any }),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["sa-orgs"] });
      qc.invalidateQueries({ queryKey: ["sa-ov"] });
      toast({ title: vars.action === "suspend" ? "Organisation suspendue" : "Organisation réactivée" });
      setConfirmAction(null);
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error ?? e?.message, variant: "destructive" }),
  });

  if (user?.role !== "super_admin") {
    return (
      <Card><CardContent className="p-12 text-center">
        <Crown className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
        <p className="font-medium">Accès réservé aux super-administrateurs</p>
      </CardContent></Card>
    );
  }
  if (ov.isLoading || !ov.data) {
    return <div className="py-12 text-center"><Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground" /></div>;
  }

  const d = ov.data;
  const filteredOrgs = (orgs.data?.rows ?? []).filter(o =>
    !orgSearch || o.name.toLowerCase().includes(orgSearch.toLowerCase()) ||
    (o.slug ?? "").toLowerCase().includes(orgSearch.toLowerCase()) ||
    (o.industry ?? "").toLowerCase().includes(orgSearch.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1 flex items-center gap-2">
            <Crown className="w-3 h-3" />Super-administrateur
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Cockpit plateforme</h1>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />Nouvelle structure
        </Button>
      </div>

      {/* Onglets */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Vue globale</TabsTrigger>
          <TabsTrigger value="organizations">
            Organisations
            {orgs.data && <Badge variant="secondary" className="ml-2 text-[10px]">{orgs.data.count}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="invitations">
            Invitations
            {(invs.data?.count ?? 0) > 0 && <Badge variant="secondary" className="ml-2 text-[10px]">{invs.data!.count}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* ── Vue globale ── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <KPI label="Organisations" value={`${d.activeOrgs} / ${d.totalOrgs}`} />
            <KPI label="Utilisateurs" value={d.totalUsers} />
            <KPI label="Abonnements actifs" value={d.activeSubscriptions} />
            <KPI label="MRR" value={formatFCFA(d.mrrFcfa)} accent="text-primary" />
            <KPI label="ARR" value={formatFCFA(d.arrFcfa)} accent="text-primary" />
            <KPI label="Encaissé 30j" value={formatFCFA(d.paidLast30Days)} accent="text-emerald-600" />
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Répartition par plan</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {Object.keys(d.byPlan).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun abonnement actif.</p>
              )}
              {Object.entries(d.byPlan).map(([code, v]: any) => (
                <div key={code} className="flex items-center gap-3 border-b pb-2 last:border-0">
                  <Badge variant="outline" className="font-mono w-28 justify-center">{code}</Badge>
                  <div className="flex-1">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.min(100, (v.mrr / (d.mrrFcfa || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground w-28 text-right">{v.count} org · {v.seats} sièges</span>
                  <span className="text-sm font-bold w-32 text-right">{formatFCFA(v.mrr)}/mois</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Aperçu rapide des organisations */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Aperçu des organisations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {(orgs.data?.rows ?? []).slice(0, 8).map((o) => (
                <div key={o.id} className="flex items-center gap-3 text-sm border-b pb-1.5 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{o.name}</div>
                    <div className="text-xs text-muted-foreground">{o.slug} · {o.country ?? "?"}</div>
                  </div>
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" />{o.memberCount}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Layers className="w-3 h-3" />{o.enabledModules}</span>
                  <Badge variant="outline" className="font-mono text-[10px]">{o.planCode ?? "—"}</Badge>
                  <span className="text-sm font-semibold w-28 text-right">{formatFCFA(o.mrr)}/mois</span>
                  {orgStatusBadge(o)}
                </div>
              ))}
              {(orgs.data?.count ?? 0) > 8 && (
                <p className="text-xs text-center text-muted-foreground pt-1">
                  … et {(orgs.data?.count ?? 0) - 8} autres —{" "}
                  <button className="underline" onClick={() => setTab("organizations")}>voir toutes</button>
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Organisations ── */}
        <TabsContent value="organizations" className="space-y-4 mt-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={orgSearch} onChange={(e) => setOrgSearch(e.target.value)} placeholder="Rechercher une organisation…" className="pl-9" />
            </div>
            {orgs.isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-center">Membres</TableHead>
                    <TableHead className="text-center">Modules</TableHead>
                    <TableHead className="text-right">MRR/mois</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrgs.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {orgSearch ? "Aucune organisation ne correspond." : "Aucune organisation."}
                    </TableCell></TableRow>
                  )}
                  {filteredOrgs.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <div className="font-medium flex items-center gap-1.5">
                          {o.name}
                          {o.isDefault && <Badge variant="outline" className="text-[10px]">défaut</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">{o.slug} · {o.country ?? "—"}{o.industry ? ` · ${o.industry}` : ""}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[11px]">{o.planCode ?? "—"}</Badge>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{o.seats} siège{o.seats > 1 ? "s" : ""}</div>
                      </TableCell>
                      <TableCell className="text-center text-sm">{o.memberCount}</TableCell>
                      <TableCell className="text-center text-sm">{o.enabledModules}</TableCell>
                      <TableCell className="text-right font-semibold text-sm">{formatFCFA(o.mrr)}</TableCell>
                      <TableCell>{orgStatusBadge(o)}</TableCell>
                      <TableCell className="text-right">
                        {!o.isDefault && (
                          <Button
                            size="sm"
                            variant="ghost"
                            title={o.isActive ? "Suspendre l'organisation" : "Réactiver l'organisation"}
                            className={o.isActive ? "text-red-600 hover:text-red-700 hover:bg-red-50" : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"}
                            onClick={() => setConfirmAction({ org: o, action: o.isActive ? "suspend" : "reactivate" })}
                          >
                            <Power className="w-3.5 h-3.5 mr-1" />
                            {o.isActive ? "Suspendre" : "Réactiver"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Invitations de structure ── */}
        <TabsContent value="invitations" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Liens d'invitation générés pour l'auto-inscription de nouvelles structures.</p>
            <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
              <Link2 className="w-4 h-4 mr-2" />Nouveau lien
            </Button>
          </div>

          {invs.isLoading && <div className="py-6 text-center"><Loader2 className="w-5 h-5 mx-auto animate-spin text-muted-foreground" /></div>}

          {!invs.isLoading && (invs.data?.count ?? 0) === 0 && (
            <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">
              Aucune invitation de structure générée.
            </CardContent></Card>
          )}

          {(invs.data?.rows ?? []).length > 0 && (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contact / Structure</TableHead>
                      <TableHead>Plan suggéré</TableHead>
                      <TableHead>Créé le</TableHead>
                      <TableHead>Expire le</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Lien</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invs.data!.rows.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell>
                          <div className="font-medium">{i.contactName || i.suggestedOrgName || "(sans nom)"}</div>
                          <div className="text-xs text-muted-foreground">{i.contactEmail ?? "Email non spécifié"}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[11px] font-mono">{i.suggestedPlanCode ?? "Libre"}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(i.createdAt).toLocaleDateString("fr-FR")}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {i.expiresAt ? new Date(i.expiresAt).toLocaleDateString("fr-FR") : "—"}
                        </TableCell>
                        <TableCell>{invStatusBadge(i.status)}</TableCell>
                        <TableCell className="text-right">
                          {i.status === "pending" && (
                            <Button
                              type="button" variant="outline" size="sm"
                              onClick={() => {
                                const url = `${window.location.origin}/onboard-structure?token=${i.token}`;
                                navigator.clipboard.writeText(url);
                                toast({ title: "Lien copié", description: url });
                              }}
                            >
                              <Copy className="w-3 h-3 mr-1" />Copier
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Alerte si invitations expirées */}
          {(invs.data?.rows ?? []).some(i => i.status === "expired") && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="w-4 h-4 text-amber-700" />
              <AlertDescription className="text-amber-800 text-xs">
                Des invitations sont expirées. Générez de nouveaux liens pour relancer les prospects concernés.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogues */}
      <NewStructureDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(o) => !o && setConfirmAction(null)}
        title={confirmAction?.action === "suspend"
          ? `Suspendre ${confirmAction?.org.name} ?`
          : `Réactiver ${confirmAction?.org.name} ?`}
        description={confirmAction?.action === "suspend"
          ? "Les utilisateurs de cette organisation ne pourront plus accéder à la plateforme. L'abonnement sera marqué comme suspendu."
          : "L'organisation et son abonnement seront réactivés. Les utilisateurs pourront se reconnecter immédiatement."}
        destructive={confirmAction?.action === "suspend"}
        confirmLabel={confirmAction?.action === "suspend" ? "Suspendre" : "Réactiver"}
        onConfirm={() => {
          if (confirmAction) {
            toggleOrgStatus.mutate({ id: confirmAction.org.id, action: confirmAction.action });
          }
        }}
      />
    </div>
  );
}
