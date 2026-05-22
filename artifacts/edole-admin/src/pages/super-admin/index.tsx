/**
 * Cockpit super-admin — vue plateforme + onboarding nouvelle structure.
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
import { useToast } from "@/hooks/use-toast";
import { Loader2, Crown, Building2, Plus, Copy, Mail, Link2, CheckCircle2 } from "lucide-react";
import { formatFCFA } from "@/lib/format";
import { useAuth } from "@/lib/auth";

const KPI = ({ label, value, accent }: { label: string; value: string | number; accent?: string }) => (
  <Card><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold mb-1">{label}</p><p className={`text-2xl font-bold ${accent ?? ""}`}>{value}</p></CardContent></Card>
);

type Plan = { id: string; code: string; name: string; monthlyPricePerSeat: number; currency: string };

function NewStructureDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [mode, setMode] = useState<"full" | "link">("full");
  const [result, setResult] = useState<{ acceptUrl?: string; onboardUrl?: string; temporaryPassword?: string; orgName?: string; emailSent?: boolean; adminEmail?: string } | null>(null);

  // Champs mode complet
  const [orgName, setOrgName] = useState("");
  const [country, setCountry] = useState("TG");
  const [industry, setIndustry] = useState("");
  const [planCode, setPlanCode] = useState("STARTER");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");

  // Champs mode lien
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
      setResult({ acceptUrl: r.acceptUrl, temporaryPassword: r.temporaryPassword, orgName: r.organization.name, emailSent: r.delivery?.delivered === true, adminEmail: adminEmail });
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
      toast({ title: "Lien d'invitation créé", description: contactEmail ? "Email envoyé." : "Copiez le lien ci-dessous." });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error ?? e?.message, variant: "destructive" }),
  });

  const copy = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: "Lien copié", description: url });
  };

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
              <Label>Lien</Label>
              <div className="flex gap-2">
                <Input readOnly value={result.acceptUrl ?? result.onboardUrl ?? ""} className="font-mono text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={() => copy(result.acceptUrl ?? result.onboardUrl ?? "")}><Copy className="w-4 h-4" /></Button>
              </div>
            </div>
            {result.temporaryPassword && (
              <div className="space-y-2">
                <Label>Mot de passe temporaire</Label>
                <Input readOnly value={result.temporaryPassword} className="font-mono" />
                <p className="text-xs text-muted-foreground">L'admin devra le changer à la première connexion.</p>
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
              <p className="text-xs text-muted-foreground">Vous créez tout : organisation + plan + admin. Un email d'invitation est envoyé à l'admin.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Nom de la structure *</Label><Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="SOGELEC Cameroun" /></div>
                <div><Label>Pays</Label><Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="TG" maxLength={2} /></div>
                <div><Label>Secteur</Label><Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="BTP" /></div>
                <div className="col-span-2"><Label>Plan d'abonnement *</Label>
                  <Select value={planCode} onValueChange={setPlanCode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(plans.data ?? []).map((p) => (
                        <SelectItem key={p.code} value={p.code}>{p.name} — {formatFCFA(p.monthlyPricePerSeat)}/siège/mois</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 pt-2 border-t"><Label className="text-xs uppercase tracking-wide text-muted-foreground">Administrateur principal</Label></div>
                <div><Label>Prénom *</Label><Input value={adminFirstName} onChange={(e) => setAdminFirstName(e.target.value)} /></div>
                <div><Label>Nom *</Label><Input value={adminLastName} onChange={(e) => setAdminLastName(e.target.value)} /></div>
                <div className="col-span-2"><Label>Email *</Label><Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@structure.com" /></div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={close}>Annuler</Button>
                <Button onClick={() => createFull.mutate()} disabled={createFull.isPending || !orgName || !planCode || !adminEmail || !adminFirstName || !adminLastName} className="bg-primary hover:bg-primary/90">
                  {createFull.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Créer + envoyer l'invitation
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="link" className="space-y-3 pt-4">
              <p className="text-xs text-muted-foreground">Vous envoyez juste un lien. La structure choisit elle-même son nom, son plan et crée son admin. Lien valable 14 jours.</p>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nom du contact</Label><Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Optionnel" /></div>
                <div><Label>Email du contact</Label><Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Optionnel — pour envoi auto" /></div>
                <div className="col-span-2"><Label>Suggestion de nom d'org</Label><Input value={linkSuggestedOrg} onChange={(e) => setLinkSuggestedOrg(e.target.value)} placeholder="Optionnel — pré-rempli pour l'invité" /></div>
                <div className="col-span-2"><Label>Plan suggéré</Label>
                  <Select value={linkSuggestedPlan || "none"} onValueChange={(v) => setLinkSuggestedPlan(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun (l'invité choisira)</SelectItem>
                      {(plans.data ?? []).map((p) => (
                        <SelectItem key={p.code} value={p.code}>{p.name} — {formatFCFA(p.monthlyPricePerSeat)}/siège/mois</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

export default function SuperAdminCockpit() {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const ov = useQuery<any>({ queryKey: ["sa-ov"], queryFn: () => apiFetch("/api/super-admin/overview"), enabled: user?.role === "super_admin" });
  const orgs = useQuery<any>({ queryKey: ["sa-orgs"], queryFn: () => apiFetch("/api/super-admin/organizations"), enabled: user?.role === "super_admin" });
  const invs = useQuery<any>({ queryKey: ["sa-invs"], queryFn: () => apiFetch("/api/super-admin/structure-invitations"), enabled: user?.role === "super_admin" });

  if (user?.role !== "super_admin") {
    return <Card><CardContent className="p-12 text-center"><Crown className="w-10 h-10 mx-auto text-muted-foreground mb-2" /><p className="font-medium">Accès réservé aux super-administrateurs</p></CardContent></Card>;
  }
  if (ov.isLoading || !ov.data) return <div className="py-12 text-center"><Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground" /></div>;
  const d = ov.data;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1 flex items-center gap-2"><Crown className="w-3 h-3" />Super-admin</p>
          <h1 className="text-3xl font-bold tracking-tight">Cockpit plateforme</h1>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />Nouvelle structure
        </Button>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <KPI label="Organisations" value={`${d.activeOrgs} / ${d.totalOrgs}`} />
        <KPI label="Utilisateurs uniques" value={d.totalUsers} />
        <KPI label="Abonnements actifs" value={d.activeSubscriptions} />
        <KPI label="MRR" value={formatFCFA(d.mrrFcfa)} accent="text-primary" />
        <KPI label="ARR" value={formatFCFA(d.arrFcfa)} accent="text-primary" />
        <KPI label="Encaissé 30j" value={formatFCFA(d.paidLast30Days)} accent="text-emerald-600" />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Répartition par plan</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(d.byPlan).map(([code, v]: any) => (
            <div key={code} className="flex items-center justify-between border-b pb-1.5 last:border-0">
              <Badge variant="outline" className="font-mono">{code}</Badge>
              <span className="text-xs text-muted-foreground">{v.count} org(s) · {v.seats} sièges</span>
              <span className="text-sm font-bold">{formatFCFA(v.mrr)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4" />Organisations ({orgs.data?.count ?? 0})</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {orgs.data?.rows?.map((o: any) => (
            <div key={o.id} className="flex items-center justify-between text-sm border-b pb-1.5 last:border-0 gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate flex items-center gap-1">
                  <span className="truncate">{o.name}</span>
                  {o.isDefault && <Badge variant="outline" className="text-[10px]">défaut</Badge>}
                  {o.status === "trial" && <Badge className="text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-100">essai</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{o.slug} · {o.country ?? "?"} · {o.memberCount} membre(s) · {o.enabledModules} module(s)</p>
              </div>
              <Badge variant="outline">{o.planCode ?? "—"}</Badge>
              <span className="text-xs">{o.seats} sièges</span>
              <span className="text-sm font-bold w-28 text-right">{formatFCFA(o.mrr)}/mois</span>
              <Badge variant="outline" className={o.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50"}>{o.isActive ? "actif" : "inactif"}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {(invs.data?.rows?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Link2 className="w-4 h-4" />Invitations de structure ({invs.data.count})</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {invs.data.rows.map((i: any) => (
              <div key={i.id} className="flex items-center justify-between text-sm border-b pb-1.5 last:border-0 gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{i.contactName || i.suggestedOrgName || "(sans nom)"}</div>
                  <p className="text-xs text-muted-foreground truncate">{i.contactEmail ?? "—"} · plan suggéré : {i.suggestedPlanCode ?? "libre"}</p>
                </div>
                <Badge variant="outline" className={
                  i.status === "accepted" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                  i.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-50"
                }>{i.status}</Badge>
                {i.status === "pending" && (
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    const url = `${window.location.origin}/onboard-structure?token=${i.token}`;
                    navigator.clipboard.writeText(url);
                  }}><Copy className="w-3 h-3" /></Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <NewStructureDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
