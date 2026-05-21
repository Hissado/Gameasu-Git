import { useState, useEffect } from "react";
import { useWorkspaceSettings, useUpdateWorkspaceSettings, useToggleModule, type Organization } from "@/lib/saas";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PlanBadge } from "@/components/PlanBadge";
import { useToast } from "@/hooks/use-toast";
import { Save, Building2, Palette, Globe2, ShieldCheck, Layers, CreditCard } from "lucide-react";
import { Link } from "wouter";
import { BRANDING } from "@/config/branding";

export default function WorkspaceSettingsPage() {
  const { data } = useWorkspaceSettings();
  const { toast } = useToast();
  const updateGeneral = useUpdateWorkspaceSettings("general");
  const updateBranding = useUpdateWorkspaceSettings("branding");
  const updatePrefs = useUpdateWorkspaceSettings("preferences");
  const toggle = useToggleModule();

  const [general, setGeneral] = useState<Partial<Organization>>({});
  const [branding, setBranding] = useState<Partial<Organization>>({});
  const [prefs, setPrefs] = useState<Partial<Organization>>({});

  useEffect(() => {
    if (!data?.organization) return;
    const o = data.organization;
    setGeneral({ name: o.name, legalName: o.legalName, industry: o.industry, country: o.country, contactEmail: o.contactEmail, contactPhone: o.contactPhone, address: o.address, taxId: o.taxId });
    setBranding({ logoUrl: o.logoUrl, primaryColor: o.primaryColor, secondaryColor: o.secondaryColor });
    setPrefs({ currency: o.currency, timezone: o.timezone, locale: o.locale });
  }, [data?.organization]);

  if (!data) return <div className="p-8 text-muted-foreground">Chargement…</div>;
  const { organization, plan, modules } = data;

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">{BRANDING.appName}</p>
          <h1 className="text-3xl font-bold tracking-tight">Paramètres de l'espace de travail</h1>
          <p className="text-muted-foreground mt-1">Configurez l'identité, les préférences et les modules de {organization.name}.</p>
        </div>
        <div className="flex items-center gap-2">
          <PlanBadge code={plan?.code} name={plan?.name} light />
          <Button asChild variant="outline" size="sm">
            <Link href="/billing"><CreditCard className="w-4 h-4 mr-1.5" />Abonnement</Link>
          </Button>
        </div>
      </header>

      {/* Général */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Building2 className="w-4 h-4 text-amber-700" /> Général</CardTitle>
          <CardDescription>Identité juridique et coordonnées de votre organisation.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nom de l'organisation" value={general.name} onChange={(v) => setGeneral((s) => ({ ...s, name: v }))} />
          <Field label="Raison sociale" value={general.legalName} onChange={(v) => setGeneral((s) => ({ ...s, legalName: v }))} />
          <Field label="Secteur d'activité" value={general.industry} onChange={(v) => setGeneral((s) => ({ ...s, industry: v }))} />
          <Field label="Pays" value={general.country} onChange={(v) => setGeneral((s) => ({ ...s, country: v }))} />
          <Field label="Email de contact" value={general.contactEmail} onChange={(v) => setGeneral((s) => ({ ...s, contactEmail: v }))} />
          <Field label="Téléphone" value={general.contactPhone} onChange={(v) => setGeneral((s) => ({ ...s, contactPhone: v }))} />
          <Field label="Adresse" value={general.address} onChange={(v) => setGeneral((s) => ({ ...s, address: v }))} />
          <Field label="N° fiscal" value={general.taxId} onChange={(v) => setGeneral((s) => ({ ...s, taxId: v }))} />
          <div className="md:col-span-2 flex justify-end">
            <Button onClick={() => updateGeneral.mutate(general, { onSuccess: () => toast({ title: "Modifications enregistrées" }) })} disabled={updateGeneral.isPending}>
              <Save className="w-4 h-4 mr-1.5" />Enregistrer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Identité visuelle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Palette className="w-4 h-4 text-amber-700" /> Identité visuelle</CardTitle>
          <CardDescription>Logo et couleurs de votre espace de travail.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="URL du logo" value={branding.logoUrl} onChange={(v) => setBranding((s) => ({ ...s, logoUrl: v }))} placeholder="https://…" />
          <Field label="Couleur principale" value={branding.primaryColor} onChange={(v) => setBranding((s) => ({ ...s, primaryColor: v }))} placeholder="#C8A24B" />
          <Field label="Couleur secondaire" value={branding.secondaryColor} onChange={(v) => setBranding((s) => ({ ...s, secondaryColor: v }))} placeholder="#0F172A" />
          <div className="md:col-span-3 flex justify-end">
            <Button onClick={() => updateBranding.mutate(branding, { onSuccess: () => toast({ title: "Identité mise à jour" }) })} disabled={updateBranding.isPending}>
              <Save className="w-4 h-4 mr-1.5" />Enregistrer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Préférences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Globe2 className="w-4 h-4 text-amber-700" /> Préférences régionales</CardTitle>
          <CardDescription>Devise, fuseau horaire et langue par défaut.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Devise" value={prefs.currency} onChange={(v) => setPrefs((s) => ({ ...s, currency: v }))} placeholder="XOF" />
          <Field label="Fuseau horaire" value={prefs.timezone} onChange={(v) => setPrefs((s) => ({ ...s, timezone: v }))} placeholder="Africa/Lome" />
          <Field label="Langue" value={prefs.locale} onChange={(v) => setPrefs((s) => ({ ...s, locale: v }))} placeholder="fr-FR" />
          <div className="md:col-span-3 flex justify-end">
            <Button onClick={() => updatePrefs.mutate(prefs, { onSuccess: () => toast({ title: "Préférences enregistrées" }) })} disabled={updatePrefs.isPending}>
              <Save className="w-4 h-4 mr-1.5" />Enregistrer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Layers className="w-4 h-4 text-amber-700" /> Modules actifs</CardTitle>
          <CardDescription>Activez ou désactivez les modules disponibles dans votre formule.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border/60">
          {modules.map((m) => {
            const included = plan?.includedModules.includes(m.moduleKey);
            return (
              <div key={m.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{LABELS[m.moduleKey] ?? m.moduleKey}</p>
                  <p className="text-xs text-muted-foreground">
                    {included ? "Inclus dans votre formule" : "Non inclus — passer à un plan supérieur pour activer"}
                  </p>
                </div>
                <Switch
                  checked={m.enabled}
                  disabled={!included || toggle.isPending}
                  onCheckedChange={(enabled) => {
                    toggle.mutate({ moduleKey: m.moduleKey, enabled }, {
                      onError: (e) => toast({ variant: "destructive", title: "Échec", description: e.message }),
                    });
                  }}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Sécurité (placeholder) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="w-4 h-4 text-amber-700" /> Sécurité & accès</CardTitle>
          <CardDescription>Politique d'accès et de mots de passe.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          La gestion fine des rôles et permissions est disponible depuis la <Link href="/admin/roles" className="text-amber-700 hover:underline">Console d'administration</Link>.
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value?: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

const LABELS: Record<string, string> = {
  dashboard: "Tableau de bord", clients: "Clients", services: "Services",
  projects: "Projets", tasks: "Tâches", sales_crm: "Ventes & Relation client",
  accounting: "Comptabilité", financial_planning: "Planification financière",
  operations: "Opérations", inventory_assets: "Parc & équipements",
  rentals: "Locations", documents: "Documents", team_hr: "Équipe & RH",
  communications: "Communications", reports: "Rapports",
  client_portal: "Portail client", marketing: "Marketing",
  administration: "Administration", billing_subscription: "Abonnement & facturation",
  workspace_settings: "Paramètres de l'espace de travail",
};
