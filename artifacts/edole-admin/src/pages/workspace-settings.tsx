import { useState, useEffect, useRef } from "react";
import { useWorkspaceSettings, useUpdateWorkspaceSettings, type Organization } from "@/lib/saas";
import { ModulesActifsTab } from "@/components/ModulesActifsTab";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlanBadge } from "@/components/PlanBadge";
import { useToast } from "@/hooks/use-toast";
import { Save, Building2, Palette, Globe2, ShieldCheck, Layers, CreditCard, Upload, Loader2, X, Handshake } from "lucide-react";
import { Link } from "wouter";
import { BRANDING } from "@/config/branding";
import { apiFetch } from "@/lib/api";

// ─── Listes de référence ────────────────────────────────────────────────────

const CURRENCIES = [
  { code: "XOF", label: "Franc CFA BCEAO (XOF)" },
  { code: "XAF", label: "Franc CFA BEAC (XAF)" },
  { code: "EUR", label: "Euro (EUR)" },
  { code: "USD", label: "Dollar américain (USD)" },
  { code: "GBP", label: "Livre sterling (GBP)" },
  { code: "GHS", label: "Cedi ghanéen (GHS)" },
  { code: "NGN", label: "Naira nigérian (NGN)" },
  { code: "MAD", label: "Dirham marocain (MAD)" },
  { code: "DZD", label: "Dinar algérien (DZD)" },
  { code: "TND", label: "Dinar tunisien (TND)" },
  { code: "EGP", label: "Livre égyptienne (EGP)" },
  { code: "KES", label: "Shilling kényan (KES)" },
  { code: "ZAR", label: "Rand sud-africain (ZAR)" },
  { code: "CDF", label: "Franc congolais (CDF)" },
  { code: "MGA", label: "Ariary malgache (MGA)" },
  { code: "CAD", label: "Dollar canadien (CAD)" },
  { code: "CHF", label: "Franc suisse (CHF)" },
  { code: "CNY", label: "Yuan chinois (CNY)" },
];

const TIMEZONES = [
  { value: "Africa/Abidjan",      label: "Abidjan (GMT+0)" },
  { value: "Africa/Accra",        label: "Accra (GMT+0)" },
  { value: "Africa/Addis_Ababa",  label: "Addis-Abeba (GMT+3)" },
  { value: "Africa/Algiers",      label: "Alger (GMT+1)" },
  { value: "Africa/Bamako",       label: "Bamako (GMT+0)" },
  { value: "Africa/Bangui",       label: "Bangui (GMT+1)" },
  { value: "Africa/Brazzaville",  label: "Brazzaville (GMT+1)" },
  { value: "Africa/Casablanca",   label: "Casablanca (GMT+1)" },
  { value: "Africa/Conakry",      label: "Conakry (GMT+0)" },
  { value: "Africa/Dakar",        label: "Dakar (GMT+0)" },
  { value: "Africa/Dar_es_Salaam",label: "Dar es Salam (GMT+3)" },
  { value: "Africa/Douala",       label: "Douala (GMT+1)" },
  { value: "Africa/Kinshasa",     label: "Kinshasa (GMT+1)" },
  { value: "Africa/Lagos",        label: "Lagos (GMT+1)" },
  { value: "Africa/Libreville",   label: "Libreville (GMT+1)" },
  { value: "Africa/Lome",         label: "Lomé (GMT+0)" },
  { value: "Africa/Luanda",       label: "Luanda (GMT+1)" },
  { value: "Africa/Lubumbashi",   label: "Lubumbashi (GMT+2)" },
  { value: "Africa/Malabo",       label: "Malabo (GMT+1)" },
  { value: "Africa/Maputo",       label: "Maputo (GMT+2)" },
  { value: "Africa/Nairobi",      label: "Nairobi (GMT+3)" },
  { value: "Africa/Niamey",       label: "Niamey (GMT+1)" },
  { value: "Africa/Nouakchott",   label: "Nouakchott (GMT+0)" },
  { value: "Africa/Ouagadougou",  label: "Ouagadougou (GMT+0)" },
  { value: "Africa/Porto-Novo",   label: "Porto-Novo (GMT+1)" },
  { value: "Africa/Tunis",        label: "Tunis (GMT+1)" },
  { value: "Africa/Tripoli",      label: "Tripoli (GMT+2)" },
  { value: "Atlantic/Cape_Verde", label: "Cap-Vert (GMT-1)" },
  { value: "Indian/Mauritius",    label: "Maurice (GMT+4)" },
  { value: "Indian/Reunion",      label: "La Réunion (GMT+4)" },
  { value: "Europe/Paris",        label: "Paris (GMT+1/+2)" },
  { value: "Europe/London",       label: "Londres (GMT+0/+1)" },
  { value: "America/New_York",    label: "New York (GMT-5/-4)" },
  { value: "America/Chicago",     label: "Chicago (GMT-6/-5)" },
  { value: "America/Los_Angeles", label: "Los Angeles (GMT-8/-7)" },
  { value: "Asia/Dubai",          label: "Dubaï (GMT+4)" },
  { value: "UTC",                 label: "UTC (GMT+0)" },
];

const LOCALES = [
  { value: "fr-FR", label: "Français (France)" },
  { value: "fr-TG", label: "Français (Togo)" },
  { value: "fr-CI", label: "Français (Côte d'Ivoire)" },
  { value: "fr-SN", label: "Français (Sénégal)" },
  { value: "fr-CM", label: "Français (Cameroun)" },
  { value: "fr-CD", label: "Français (RD Congo)" },
  { value: "fr-MA", label: "Français (Maroc)" },
  { value: "fr-DZ", label: "Français (Algérie)" },
  { value: "fr-TN", label: "Français (Tunisie)" },
  { value: "fr-GA", label: "Français (Gabon)" },
  { value: "fr-BF", label: "Français (Burkina Faso)" },
  { value: "fr-ML", label: "Français (Mali)" },
  { value: "fr-NE", label: "Français (Niger)" },
  { value: "fr-BJ", label: "Français (Bénin)" },
  { value: "fr-MG", label: "Français (Madagascar)" },
  { value: "en-US", label: "English (United States)" },
  { value: "en-GB", label: "English (United Kingdom)" },
  { value: "en-NG", label: "English (Nigeria)" },
  { value: "en-GH", label: "English (Ghana)" },
  { value: "en-KE", label: "English (Kenya)" },
  { value: "ar-MA", label: "العربية (المغرب)" },
  { value: "ar-DZ", label: "العربية (الجزائر)" },
  { value: "ar-TN", label: "العربية (تونس)" },
  { value: "pt-PT", label: "Português (Portugal)" },
  { value: "pt-AO", label: "Português (Angola)" },
  { value: "pt-MZ", label: "Português (Moçambique)" },
];

// ─── Couleurs prédéfinies ──────────────────────────────────────────────────

const COLOR_PRESETS = [
  { hex: "#2563EB", label: "Bleu Gameasu" },
  { hex: "#1a1a2e", label: "Marine profond" },
  { hex: "#2563EB", label: "Bleu Gameasu" },
  { hex: "#0F172A", label: "Ardoise foncé" },
  { hex: "#2563EB", label: "Bleu Royal" },
  { hex: "#16A34A", label: "Vert Succès" },
  { hex: "#DC2626", label: "Rouge" },
  { hex: "#7C3AED", label: "Violet" },
  { hex: "#0891B2", label: "Cyan" },
  { hex: "#EA580C", label: "Orange vif" },
  { hex: "#059669", label: "Émeraude" },
  { hex: "#475569", label: "Gris ardoise" },
];

// ─── Page ──────────────────────────────────────────────────────────────────

export default function WorkspaceSettingsPage() {
  const { data } = useWorkspaceSettings();
  const { toast } = useToast();
  const updateGeneral = useUpdateWorkspaceSettings("general");
  const updateBranding = useUpdateWorkspaceSettings("branding");
  const updatePrefs = useUpdateWorkspaceSettings("preferences");
  const [general, setGeneral] = useState<Partial<Organization>>({});
  const [branding, setBranding] = useState<Partial<Organization>>({});
  const [prefs, setPrefs] = useState<Partial<Organization>>({});
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    if (!data?.organization) return;
    const o = data.organization;
    setGeneral({ name: o.name, legalName: o.legalName, industry: o.industry, country: o.country, contactEmail: o.contactEmail, contactPhone: o.contactPhone, address: o.address, taxId: o.taxId });
    setBranding({ logoUrl: o.logoUrl, primaryColor: o.primaryColor, secondaryColor: o.secondaryColor });
    setPrefs({ currency: o.currency, timezone: o.timezone, locale: o.locale });
  }, [data?.organization]);

  if (!data) return <div className="p-8 text-muted-foreground">Chargement…</div>;
  const { organization, plan, modules } = data;

  async function handleLogoUpload(file: File) {
    setLogoUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await apiFetch<{ url: string }>("/api/upload", { method: "POST", body: form });
      setBranding((s) => ({ ...s, logoUrl: result.url }));
      toast({ title: "Logo téléversé avec succès" });
    } catch {
      toast({ variant: "destructive", title: "Erreur lors du téléversement" });
    } finally {
      setLogoUploading(false);
    }
  }

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
            <Link href="/abonnement"><CreditCard className="w-4 h-4 mr-1.5" />Abonnement</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="text-emerald-700 border-emerald-200 hover:bg-emerald-50">
            <Link href="/abonnement?openPartner=1">
              <Handshake className="w-4 h-4 mr-1.5 text-emerald-600" />Devenir partenaire
            </Link>
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
        <CardContent className="space-y-6">
          {/* Logo */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Logo</Label>
            <div className="flex items-center gap-4 flex-wrap">
              {/* Prévisualisation */}
              <div className="w-24 h-16 rounded-lg border border-dashed border bg-muted/50 flex items-center justify-center overflow-hidden flex-shrink-0">
                {branding.logoUrl ? (
                  <img
                    src={branding.logoUrl}
                    alt="Logo"
                    className="w-full h-full object-contain p-1"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground text-center px-2">Aucun logo</span>
                )}
              </div>

              {/* Boutons */}
              <div className="flex flex-col gap-2">
                <LogoUploadButton
                  uploading={logoUploading}
                  onFile={handleLogoUpload}
                />
                {branding.logoUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 text-xs"
                    onClick={() => setBranding((s) => ({ ...s, logoUrl: "" }))}
                  >
                    <X className="w-3 h-3 mr-1" /> Supprimer le logo
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">PNG, JPG ou SVG · max 5 Mo</p>
              </div>
            </div>
          </div>

          {/* Couleurs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ColorField
              label="Couleur principale"
              value={branding.primaryColor ?? "#2563EB"}
              onChange={(v) => setBranding((s) => ({ ...s, primaryColor: v }))}
            />
            <ColorField
              label="Couleur secondaire"
              value={branding.secondaryColor ?? "#0F172A"}
              onChange={(v) => setBranding((s) => ({ ...s, secondaryColor: v }))}
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => updateBranding.mutate(branding, { onSuccess: () => toast({ title: "Identité mise à jour" }) })}
              disabled={updateBranding.isPending || logoUploading}
            >
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
          {/* Devise */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Devise</Label>
            <Select value={prefs.currency ?? "XOF"} onValueChange={(v) => setPrefs((s) => ({ ...s, currency: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une devise" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    <span className="font-mono font-semibold text-amber-700 mr-2">{c.code}</span>
                    <span className="text-muted-foreground text-sm">{c.label.replace(`(${c.code})`, "").trim()}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fuseau horaire */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fuseau horaire</Label>
            <Select value={prefs.timezone ?? "Africa/Lome"} onValueChange={(v) => setPrefs((s) => ({ ...s, timezone: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un fuseau" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Langue */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Langue</Label>
            <Select value={prefs.locale ?? "fr-FR"} onValueChange={(v) => setPrefs((s) => ({ ...s, locale: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une langue" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {LOCALES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-3 flex justify-end">
            <Button
              onClick={() => updatePrefs.mutate(prefs, { onSuccess: () => toast({ title: "Préférences enregistrées" }) })}
              disabled={updatePrefs.isPending}
            >
              <Save className="w-4 h-4 mr-1.5" />Enregistrer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modules */}
      <ModulesActifsTab />

      {/* Sécurité */}
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

// ─── Sous-composants ────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder }: { label: string; value?: string | null; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function LogoUploadButton({ uploading, onFile }: { uploading: boolean; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      <Button
        variant="outline"
        size="sm"
        className="h-9 text-sm"
        onClick={() => ref.current?.click()}
        disabled={uploading}
      >
        {uploading
          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Téléversement…</>
          : <><Upload className="w-4 h-4 mr-2" /> Choisir un fichier</>
        }
      </Button>
    </>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>

      {/* Saisie + swatch natif */}
      <div className="flex items-center gap-2">
        <div
          className="w-9 h-9 rounded-md border border flex-shrink-0 cursor-pointer overflow-hidden relative"
          title="Ouvrir le sélecteur de couleur"
        >
          <input
            type="color"
            value={hex}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            style={{ width: "200%", height: "200%", top: "-50%", left: "-50%" }}
          />
          <div className="w-full h-full rounded-md" style={{ background: hex }} />
        </div>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="font-mono text-sm"
          maxLength={7}
        />
      </div>

      {/* Palette de préréglages */}
      <div className="flex flex-wrap gap-1.5 mt-1">
        {COLOR_PRESETS.map((p) => (
          <button
            key={p.hex}
            title={p.label}
            onClick={() => onChange(p.hex)}
            className="w-6 h-6 rounded-full border-2 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-amber-500"
            style={{
              background: p.hex,
              borderColor: value === p.hex ? "#2563EB" : "transparent",
              boxShadow: value === p.hex ? `0 0 0 2px white, 0 0 0 4px ${p.hex}` : "0 1px 3px rgba(0,0,0,0.2)",
            }}
          />
        ))}
      </div>
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
