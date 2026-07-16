import { useLocation } from "wouter";
import { useActiveFirm, useExpertClients, useUpdateClientOrg, useToggleClientModule, ACCESS_LABEL, PLAN_COLOR } from "@/lib/expert-api";
import { apiFetch } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import {
  Building2, Globe, ShieldCheck, AlertCircle, Package, Info, Save,
} from "lucide-react";

const SECTEURS = [
  "BTP / Construction", "Mines & Ressources", "Commerce & Distribution",
  "Industrie & Fabrication", "Agriculture & Agroalimentaire", "Transport & Logistique",
  "Services professionnels", "Finance & Assurance", "Santé", "Éducation",
  "Énergie & Environnement", "Technologie & Télécom", "Autre",
];

export default function ClientConfigPage() {
  const [location] = useLocation();
  const params = new URLSearchParams(location.includes("?") ? location.split("?")[1] : "");
  const orgId = params.get("orgId");

  const { firmId } = useActiveFirm();
  const { data: clients } = useExpertClients(firmId);
  const client = clients?.find((c) => c.orgId === orgId);

  const { data: orgData } = useQuery({
    queryKey: ["org-detail", orgId],
    queryFn: () => apiFetch<any>(`/api/organizations/${orgId}`),
    enabled: !!orgId,
  });

  const { data: modules } = useQuery({
    queryKey: ["org-modules", orgId],
    queryFn: () => apiFetch<{ data: any[] }>(`/api/organizations/${orgId}/modules`),
    enabled: !!orgId,
  });

  const qc = useQueryClient();
  const { toast } = useToast();

  const org = orgData ?? client?.org;

  const [editForm, setEditForm] = useState({
    name: "", country: "", industry: "", email: "", phone: "", address: "",
  });
  const [formDirty, setFormDirty] = useState(false);
  const [accessLevel, setAccessLevel] = useState(client?.accessLevel ?? "read");

  useEffect(() => {
    if (org) {
      setEditForm({
        name: org.name ?? "",
        country: org.country ?? "",
        industry: org.industry ?? "",
        email: org.email ?? "",
        phone: org.phone ?? "",
        address: org.address ?? "",
      });
      setFormDirty(false);
    }
  }, [org?.id ?? org?.name]);

  const updateOrg = useUpdateClientOrg(firmId, orgId);

  const updateAccess = useMutation({
    mutationFn: (level: string) =>
      apiFetch(`/api/expert/firms/${firmId}/clients/${orgId}/access`, { method: "PATCH", body: { accessLevel: level } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expert/clients", firmId] });
      toast({ title: "Niveau d'accès mis à jour" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error, variant: "destructive" }),
  });

  const toggleModule = useToggleClientModule(firmId, orgId);

  const setField = (k: keyof typeof editForm, v: string) => {
    setEditForm((p) => ({ ...p, [k]: v }));
    setFormDirty(true);
  };

  const handleSaveOrg = (e: React.FormEvent) => {
    e.preventDefault();
    updateOrg.mutate(editForm, {
      onSuccess: () => {
        toast({ title: "Organisation mise à jour" });
        setFormDirty(false);
      },
      onError: (err: any) => toast({ title: "Erreur", description: err?.body?.error, variant: "destructive" }),
    });
  };

  if (!orgId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Aucune organisation sélectionnée.</p>
      </div>
    );
  }

  const orgName = editForm.name || org?.name || "Organisation";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Building2 className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{orgName}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Configuration client</p>
        </div>
        {client?.subscription && (
          <Badge className={`ml-auto border ${PLAN_COLOR[client.subscription.planCode] ?? "bg-muted text-muted-foreground"}`} variant="outline">
            {client.subscription.planName}
          </Badge>
        )}
      </div>

      <Tabs defaultValue="informations">
        <TabsList className="mb-2">
          <TabsTrigger value="informations" className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />Informations
          </TabsTrigger>
          <TabsTrigger value="modules" className="flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" />Modules &amp; plan
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1 : Informations ─────────────────────────────────── */}
        <TabsContent value="informations" className="mt-0 space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />Informations générales
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <form onSubmit={handleSaveOrg} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1.5">
                    <Label>Nom de l'organisation *</Label>
                    <Input value={editForm.name} onChange={(e) => setField("name", e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Pays</Label>
                    <Input value={editForm.country} onChange={(e) => setField("country", e.target.value)} placeholder="TG" maxLength={3} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Secteur d'activité</Label>
                    <Select value={editForm.industry} onValueChange={(v) => setField("industry", v)}>
                      <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">— Non précisé —</SelectItem>
                        {SECTEURS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>E-mail</Label>
                    <Input type="email" value={editForm.email} onChange={(e) => setField("email", e.target.value)} placeholder="contact@organisation.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Téléphone</Label>
                    <Input value={editForm.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="+228 90 00 00 00" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label>Adresse</Label>
                    <Input value={editForm.address} onChange={(e) => setField("address", e.target.value)} placeholder="Adresse de l'organisation" />
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <Button type="submit" size="sm" disabled={!formDirty || updateOrg.isPending}>
                    <Save className="w-4 h-4 mr-2" />
                    {updateOrg.isPending ? "Enregistrement…" : "Enregistrer"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />Accès cabinet
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              <div className="space-y-1.5">
                <p className="text-sm text-muted-foreground">Niveau d'accès actuel</p>
                <Select
                  value={accessLevel}
                  onValueChange={(v) => { setAccessLevel(v); updateAccess.mutate(v); }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read">Lecture seule</SelectItem>
                    <SelectItem value="full">Accès complet</SelectItem>
                    <SelectItem value="billing">Facturation</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{ACCESS_LABEL[accessLevel]}</p>
              </div>

              {client && (
                <div className="pt-2 border-t space-y-2">
                  <div className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-muted-foreground">Statut</span>
                    <span className="font-medium">{client.isActive ? "Actif" : "Inactif"}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 text-sm border-t">
                    <span className="text-muted-foreground">Lié depuis</span>
                    <span className="font-medium">{client.grantedAt ? new Date(client.grantedAt).toLocaleDateString("fr-FR") : "—"}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2 : Modules & plan ───────────────────────────────── */}
        <TabsContent value="modules" className="mt-0 space-y-5">
          {client?.subscription && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />Abonnement actif
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="flex items-center justify-between py-2 text-sm border-b">
                  <span className="text-muted-foreground">Plan</span>
                  <Badge className={`border ${PLAN_COLOR[client.subscription.planCode] ?? "bg-muted text-muted-foreground"}`} variant="outline">
                    {client.subscription.planName}
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-2 text-sm">
                  <span className="text-muted-foreground">Statut</span>
                  <span className="font-medium capitalize">{client.subscription.status}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />Modules activés
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {!modules?.data?.length ? (
                <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Aucune information de module disponible.</span>
                </div>
              ) : (
                <div className="divide-y">
                  {modules.data.map((m: any) => (
                    <div key={m.id ?? m.moduleKey} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium">{m.moduleName ?? m.moduleKey}</p>
                        {m.source && (
                          <p className="text-xs text-muted-foreground capitalize">{m.source}</p>
                        )}
                      </div>
                      <Switch
                        checked={!!m.enabled}
                        disabled={toggleModule.isPending}
                        onCheckedChange={(checked) =>
                          toggleModule.mutate({ moduleKey: m.moduleKey, enabled: checked }, {
                            onError: (err: any) => toast({ title: "Erreur", description: err?.body?.error, variant: "destructive" }),
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
