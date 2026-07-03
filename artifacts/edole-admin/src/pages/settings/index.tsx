import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Lock, ShieldCheck, Clock, MapPin, Camera, FolderKanban, Building2, TrendingUp, Save, Loader2, CreditCard, Package, Briefcase, Target, UsersRound, Truck, Megaphone, BarChart3, ChevronDown, ChevronRight, AlertTriangle, Shield, Layers, ArrowRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ModulesActifsTab } from "@/components/ModulesActifsTab";

// ─── Types pour les settings de pointage ──────────────────────────────────────
type SectorTemplate = {
  sector: string; label: string; icon: string; description: string;
  expectedDailyMinutes: number; lateThresholdMinutes: number;
  requireGps: boolean; requirePhoto: boolean;
  trackByProject: boolean; trackBySite: boolean; allowOvertime: boolean;
};
type AttendanceSettings = {
  sector: string; expectedDailyMinutes: number; lateThresholdMinutes: number;
  requireGps: boolean; requirePhoto: boolean;
  trackByProject: boolean; trackBySite: boolean; allowOvertime: boolean;
};

function AttendanceSettingsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: settingsData, isLoading } = useQuery<{ settings: AttendanceSettings; template: SectorTemplate | null }>({
    queryKey: ["attendance-settings"],
    queryFn: () => apiFetch("/api/attendance/settings"),
  });
  const { data: templatesData } = useQuery<{ templates: SectorTemplate[] }>({
    queryKey: ["attendance-sector-templates"],
    queryFn: () => apiFetch("/api/attendance/sector-templates"),
  });

  const [draft, setDraft] = useState<AttendanceSettings | null>(null);
  useEffect(() => {
    if (settingsData?.settings && !draft) {
      setDraft(settingsData.settings);
    }
  }, [settingsData]);

  const mutation = useMutation({
    mutationFn: (body: Partial<AttendanceSettings>) =>
      apiFetch("/api/attendance/settings", { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast({ title: "Paramètres de pointage enregistrés" });
      qc.invalidateQueries({ queryKey: ["attendance-settings"] });
      setDraft(null);
    },
    onError: () => toast({ title: "Erreur lors de l'enregistrement", variant: "destructive" }),
  });

  const templates = templatesData?.templates ?? [];

  function applyTemplate(tpl: SectorTemplate) {
    setDraft({
      sector: tpl.sector,
      expectedDailyMinutes: tpl.expectedDailyMinutes,
      lateThresholdMinutes: tpl.lateThresholdMinutes,
      requireGps: tpl.requireGps,
      requirePhoto: tpl.requirePhoto,
      trackByProject: tpl.trackByProject,
      trackBySite: tpl.trackBySite,
      allowOvertime: tpl.allowOvertime,
    });
  }

  const currentSettings = draft ?? settingsData?.settings;

  if (isLoading || !currentSettings) {
    return <div className="flex items-center gap-2 text-slate-400 py-8"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</div>;
  }

  const isDirty = draft && JSON.stringify(draft) !== JSON.stringify(settingsData?.settings);

  return (
    <div className="space-y-5">
      {/* Sélecteur de secteur */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Secteur d'activité
          </CardTitle>
          <CardDescription>
            Sélectionnez le modèle de règles adapté à votre secteur. Vous pouvez ensuite affiner chaque paramètre individuellement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chargement des modèles…</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {templates.map(tpl => {
                const isActive = currentSettings.sector === tpl.sector;
                return (
                  <button
                    key={tpl.sector}
                    onClick={() => applyTemplate(tpl)}
                    className={`flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition-all ${
                      isActive
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40 hover:bg-muted/30"
                    }`}
                  >
                    <span className="text-2xl">{tpl.icon}</span>
                    <span className={`text-sm font-semibold ${isActive ? "text-primary" : ""}`}>{tpl.label}</span>
                    <span className="text-xs text-muted-foreground leading-tight">{tpl.description}</span>
                    {isActive && <Badge className="mt-1 text-[10px]">Actif</Badge>}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Règles individuelles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Règles de pointage
          </CardTitle>
          <CardDescription>Ces paramètres s'appliquent aux kiosques et à la détection des anomalies.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Durée journalière & seuil retard */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Durée journalière attendue (minutes)</Label>
              <Input
                type="number" min={60} max={720} step={30}
                value={currentSettings.expectedDailyMinutes}
                onChange={e => setDraft(d => d ? { ...d, expectedDailyMinutes: +e.target.value } : d)}
              />
              <p className="text-xs text-muted-foreground">
                Soit {Math.round((currentSettings.expectedDailyMinutes / 60) * 10) / 10}h/jour
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Tolérance retard (minutes après 09h00)</Label>
              <Input
                type="number" min={0} max={120} step={5}
                value={currentSettings.lateThresholdMinutes}
                onChange={e => setDraft(d => d ? { ...d, lateThresholdMinutes: +e.target.value } : d)}
              />
              <p className="text-xs text-muted-foreground">
                Retard signalé après 09h{currentSettings.lateThresholdMinutes > 0 ? `${String(currentSettings.lateThresholdMinutes).padStart(2, "0")}` : "00"}
              </p>
            </div>
          </div>

          {/* Toggles */}
          {[
            { key: "requireGps" as const, icon: <MapPin className="w-4 h-4 text-blue-500" />, label: "Géolocalisation obligatoire", desc: "Le kiosque bloque le pointage si le GPS est refusé." },
            { key: "requirePhoto" as const, icon: <Camera className="w-4 h-4 text-violet-500" />, label: "Photo de présence obligatoire", desc: "Capture la photo à chaque pointage." },
            { key: "trackByProject" as const, icon: <FolderKanban className="w-4 h-4 text-emerald-500" />, label: "Suivi de présence par projet", desc: "Associe chaque session à un projet actif." },
            { key: "trackBySite" as const, icon: <Building2 className="w-4 h-4 text-amber-500" />, label: "Suivi par site", desc: "Affiche un écran de sélection de site au kiosque." },
            { key: "allowOvertime" as const, icon: <TrendingUp className="w-4 h-4 text-orange-500" />, label: "Heures supplémentaires autorisées", desc: "Calcule et comptabilise les heures sup. au-delà de la durée attendue." },
          ].map(({ key, icon, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div className="flex items-start gap-2">
                {icon}
                <div>
                  <Label className="text-sm font-medium">{label}</Label>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
              <Switch
                checked={!!currentSettings[key]}
                onCheckedChange={v => setDraft(d => d ? { ...d, [key]: v } : d)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Bouton Enregistrer */}
      <div className="flex justify-end">
        <Button
          disabled={!isDirty || mutation.isPending}
          onClick={() => mutation.mutate(currentSettings)}
          className="gap-2"
        >
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer les paramètres
        </Button>
      </div>
    </div>
  );
}

const PERMISSIONS = [
  { module: "Tableau de bord", actions: ["Consulter"] },
  { module: "Projets", actions: ["Consulter", "Créer", "Modifier", "Supprimer"] },
  { module: "Tâches", actions: ["Consulter", "Créer", "Modifier", "Assigner"] },
  { module: "Matériel & QR", actions: ["Consulter", "Créer", "Modifier", "Supprimer"] },
  { module: "Locations", actions: ["Consulter", "Créer", "Inspecter"] },
  { module: "Inspections", actions: ["Consulter", "Créer", "Litige"] },
  { module: "Commercial (Devis/Factures)", actions: ["Consulter", "Créer", "Approuver"] },
  { module: "Comptabilité OHADA", actions: ["Consulter", "Saisir", "Clôturer"] },
  { module: "Marketing & Prospects", actions: ["Consulter", "Lancer campagne"] },
  { module: "RH (Collaborateurs)", actions: ["Consulter", "Modifier", "Affecter"] },
  { module: "Documents", actions: ["Consulter", "Téléverser", "Supprimer"] },
  { module: "Utilisateurs & Rôles", actions: ["Consulter", "Inviter", "Modifier rôle"] },
];

const ROLES = [
  { key: "super_admin",  label: "Super admin",          color: "bg-red-100 text-red-800 border-red-300" },
  { key: "admin",        label: "Administrateur",        color: "bg-amber-100 text-amber-800 border-amber-300" },
  { key: "manager",      label: "Responsable",           color: "bg-blue-100 text-blue-800 border-blue-300" },
  { key: "rh",           label: "Gest. RH",             color: "bg-violet-100 text-violet-800 border-violet-300" },
  { key: "financier",    label: "Resp. Financier",       color: "bg-green-100 text-green-800 border-green-300" },
  { key: "commercial",   label: "Commercial",            color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  { key: "logistique",   label: "Logistique",            color: "bg-orange-100 text-orange-800 border-orange-300" },
  { key: "auditeur",     label: "Auditeur",              color: "bg-slate-100 text-slate-600 border-slate-300" },
  { key: "collaborator", label: "Collaborateur",         color: "bg-gray-100 text-gray-700 border-gray-300" },
];

const RIGHTS: Record<string, Record<string, string[]>> = {
  super_admin: {
    "Tableau de bord": ["Consulter"],
    "Projets": ["Consulter", "Créer", "Modifier", "Supprimer"],
    "Tâches": ["Consulter", "Créer", "Modifier", "Assigner"],
    "Matériel & QR": ["Consulter", "Créer", "Modifier", "Supprimer"],
    "Locations": ["Consulter", "Créer", "Inspecter"],
    "Inspections": ["Consulter", "Créer", "Litige"],
    "Commercial (Devis/Factures)": ["Consulter", "Créer", "Approuver"],
    "Comptabilité OHADA": ["Consulter", "Saisir", "Clôturer"],
    "Marketing & Prospects": ["Consulter", "Lancer campagne"],
    "RH (Collaborateurs)": ["Consulter", "Modifier", "Affecter"],
    "Documents": ["Consulter", "Téléverser", "Supprimer"],
    "Utilisateurs & Rôles": ["Consulter", "Inviter", "Modifier rôle"],
  },
  admin: {
    "Tableau de bord": ["Consulter"],
    "Projets": ["Consulter", "Créer", "Modifier", "Supprimer"],
    "Tâches": ["Consulter", "Créer", "Modifier", "Assigner"],
    "Matériel & QR": ["Consulter", "Créer", "Modifier", "Supprimer"],
    "Locations": ["Consulter", "Créer", "Inspecter"],
    "Inspections": ["Consulter", "Créer", "Litige"],
    "Commercial (Devis/Factures)": ["Consulter", "Créer", "Approuver"],
    "Comptabilité OHADA": ["Consulter", "Saisir", "Clôturer"],
    "Marketing & Prospects": ["Consulter", "Lancer campagne"],
    "RH (Collaborateurs)": ["Consulter", "Modifier", "Affecter"],
    "Documents": ["Consulter", "Téléverser", "Supprimer"],
    "Utilisateurs & Rôles": ["Consulter", "Inviter", "Modifier rôle"],
  },
  manager: {
    "Tableau de bord": ["Consulter"],
    "Projets": ["Consulter", "Créer", "Modifier"],
    "Tâches": ["Consulter", "Créer", "Modifier", "Assigner"],
    "Matériel & QR": ["Consulter", "Modifier"],
    "Locations": ["Consulter", "Créer", "Inspecter"],
    "Inspections": ["Consulter", "Créer", "Litige"],
    "Commercial (Devis/Factures)": ["Consulter", "Créer"],
    "Comptabilité OHADA": ["Consulter"],
    "Marketing & Prospects": ["Consulter", "Lancer campagne"],
    "RH (Collaborateurs)": ["Consulter", "Affecter"],
    "Documents": ["Consulter", "Téléverser"],
    "Utilisateurs & Rôles": ["Consulter"],
  },
  rh: {
    "Tableau de bord": ["Consulter"],
    "Projets": ["Consulter"],
    "Tâches": ["Consulter"],
    "Matériel & QR": ["Consulter"],
    "Locations": [],
    "Inspections": [],
    "Commercial (Devis/Factures)": [],
    "Comptabilité OHADA": [],
    "Marketing & Prospects": [],
    "RH (Collaborateurs)": ["Consulter", "Modifier", "Affecter"],
    "Documents": ["Consulter", "Téléverser"],
    "Utilisateurs & Rôles": ["Consulter", "Inviter"],
  },
  financier: {
    "Tableau de bord": ["Consulter"],
    "Projets": ["Consulter"],
    "Tâches": ["Consulter"],
    "Matériel & QR": ["Consulter"],
    "Locations": ["Consulter"],
    "Inspections": [],
    "Commercial (Devis/Factures)": ["Consulter", "Créer", "Approuver"],
    "Comptabilité OHADA": ["Consulter", "Saisir", "Clôturer"],
    "Marketing & Prospects": [],
    "RH (Collaborateurs)": [],
    "Documents": ["Consulter", "Téléverser"],
    "Utilisateurs & Rôles": ["Consulter"],
  },
  commercial: {
    "Tableau de bord": ["Consulter"],
    "Projets": ["Consulter"],
    "Tâches": ["Consulter", "Créer"],
    "Matériel & QR": ["Consulter"],
    "Locations": ["Consulter"],
    "Inspections": [],
    "Commercial (Devis/Factures)": ["Consulter", "Créer"],
    "Comptabilité OHADA": [],
    "Marketing & Prospects": ["Consulter", "Lancer campagne"],
    "RH (Collaborateurs)": [],
    "Documents": ["Consulter", "Téléverser"],
    "Utilisateurs & Rôles": [],
  },
  logistique: {
    "Tableau de bord": ["Consulter"],
    "Projets": ["Consulter"],
    "Tâches": ["Consulter"],
    "Matériel & QR": ["Consulter", "Créer", "Modifier"],
    "Locations": ["Consulter", "Créer", "Inspecter"],
    "Inspections": ["Consulter", "Créer", "Litige"],
    "Commercial (Devis/Factures)": [],
    "Comptabilité OHADA": [],
    "Marketing & Prospects": [],
    "RH (Collaborateurs)": [],
    "Documents": ["Consulter", "Téléverser"],
    "Utilisateurs & Rôles": [],
  },
  auditeur: {
    "Tableau de bord": ["Consulter"],
    "Projets": ["Consulter"],
    "Tâches": ["Consulter"],
    "Matériel & QR": ["Consulter"],
    "Locations": ["Consulter"],
    "Inspections": ["Consulter"],
    "Commercial (Devis/Factures)": ["Consulter"],
    "Comptabilité OHADA": ["Consulter"],
    "Marketing & Prospects": ["Consulter"],
    "RH (Collaborateurs)": ["Consulter"],
    "Documents": ["Consulter"],
    "Utilisateurs & Rôles": ["Consulter"],
  },
  collaborator: {
    "Tableau de bord": ["Consulter"],
    "Projets": ["Consulter"],
    "Tâches": ["Consulter", "Créer", "Modifier"],
    "Matériel & QR": ["Consulter"],
    "Locations": [],
    "Inspections": [],
    "Commercial (Devis/Factures)": [],
    "Comptabilité OHADA": [],
    "Marketing & Prospects": [],
    "RH (Collaborateurs)": [],
    "Documents": ["Consulter"],
    "Utilisateurs & Rôles": [],
  },
};

type SubPlan = {
  id: string; code: string; name: string; tagline: string | null;
  monthlyPricePerSeat: number; includedModules: string[];
};
type SubInfo = {
  subscription: { id: string; status: string; billingCycle: string; seats: number; currentPeriodEnd: string | null } | null;
  plan: SubPlan | null;
};
type BillingEvent = {
  id: string; kind: string; label: string; occurredAt: string;
  metadata?: Record<string, unknown> | null;
};

function SubscriptionTab() {
  const { data: subData, isLoading: subLoading } = useQuery<SubInfo>({
    queryKey: ["subscription-current"],
    queryFn: () => (apiFetch("/api/subscriptions/current").catch(() => ({ subscription: null, plan: null })) as Promise<SubInfo>),
  });

  const { data: eventsData, isLoading: evLoading } = useQuery<BillingEvent[]>({
    queryKey: ["billing-events"],
    queryFn: () => (apiFetch("/api/billing/events").catch(() => []) as Promise<BillingEvent[]>),
  });

  const lastPlanChange = (eventsData ?? []).find((e) => e.kind === "plan_change");
  const managedByFirm = lastPlanChange?.metadata?.firmName as string | undefined;

  const plan = subData?.plan;
  const sub = subData?.subscription;

  const PLAN_COLOR: Record<string, string> = {
    STARTER: "bg-slate-100 text-slate-700 border-slate-200",
    GROWTH: "bg-violet-50 text-violet-700 border-violet-200",
    PROFESSIONAL: "bg-purple-50 text-purple-700 border-purple-200",
    ENTERPRISE: "bg-blue-50 text-blue-700 border-blue-200",
  };

  if (subLoading || evLoading) {
    return <div className="flex items-center gap-2 text-slate-400 py-8"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</div>;
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Formule active
          </CardTitle>
          {managedByFirm && (
            <CardDescription className="flex items-center gap-1.5 text-violet-700">
              <Briefcase className="w-3.5 h-3.5" />
              Géré par le cabinet <strong>{managedByFirm}</strong>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {plan ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className={`text-sm font-semibold px-3 py-1 ${PLAN_COLOR[plan.code] ?? "bg-slate-100 text-slate-700"}`}>
                  {plan.name}
                </Badge>
                {sub && (
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${sub.status === "active" ? "text-emerald-600" : "text-amber-600"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sub.status === "active" ? "bg-emerald-500" : "bg-amber-400"}`} />
                    {sub.status === "active" ? "Actif" : sub.status === "trial" ? "Période d'essai" : sub.status}
                  </span>
                )}
                {sub?.currentPeriodEnd && (
                  <span className="text-xs text-muted-foreground">
                    Renouvellement : {new Date(sub.currentPeriodEnd).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                )}
              </div>
              {plan.tagline && <p className="text-sm text-muted-foreground">{plan.tagline}</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun abonnement actif détecté.</p>
          )}
        </CardContent>
      </Card>

      {plan && (plan.includedModules?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Modules inclus
            </CardTitle>
            <CardDescription>{plan.includedModules.length} module{plan.includedModules.length !== 1 ? "s" : ""} activés avec votre formule</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {plan.includedModules.map((m) => (
                <span key={m} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/8 border border-primary/20 text-xs font-medium text-primary">
                  <Check className="w-3 h-3" />{m}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {lastPlanChange && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Dernier changement de formule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-sm font-medium">{lastPlanChange.label}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(lastPlanChange.occurredAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              {lastPlanChange.metadata?.changedByUserName
                ? ` · par ${lastPlanChange.metadata.changedByUserName as string}`
                : ""}
              {managedByFirm ? ` (${managedByFirm})` : ""}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [pwdLoading, setPwdLoading] = useState(false);

  const submitPwd = async () => {
    if (pwd.next.length < 8) {
      toast({ variant: "destructive", title: "Mot de passe trop court", description: "Minimum 8 caractères." });
      return;
    }
    if (pwd.next !== pwd.confirm) {
      toast({ variant: "destructive", title: "Confirmation différente", description: "Les deux mots de passe ne correspondent pas." });
      return;
    }
    setPwdLoading(true);
    try {
      await apiFetch("/api/auth/password", { method: "PUT", body: { currentPassword: pwd.current, newPassword: pwd.next } });
      toast({ title: "Mot de passe mis à jour", description: "Votre mot de passe a été changé avec succès." });
      setPwd({ current: "", next: "", confirm: "" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: e.message });
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground mt-1">Profil · Sécurité · Préférences · Gouvernance des accès</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="security">Sécurité</TabsTrigger>
          <TabsTrigger value="subscription">Abonnement</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="regional">Régionales</TabsTrigger>
          <TabsTrigger value="attendance">Pointage</TabsTrigger>
          <TabsTrigger value="modules">Modules actifs</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="danger">Zone sensible</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations du profil</CardTitle>
              <CardDescription>Mettez à jour vos coordonnées professionnelles.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input id="firstName" defaultValue={user?.firstName || ""} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lastName">Nom</Label>
                  <Input id="lastName" defaultValue={user?.lastName || ""} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Adresse e-mail professionnelle</Label>
                <Input id="email" type="email" defaultValue={user?.email || ""} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Numéro de téléphone</Label>
                <Input id="phone" type="tel" placeholder="+237 6XX XXX XXX" />
              </div>
              <Button className="mt-2">Enregistrer les modifications</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5 text-primary" /> Changer le mot de passe</CardTitle>
              <CardDescription>Choisissez un mot de passe d'au moins 8 caractères, distinct de l'actuel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div className="grid gap-2">
                <Label htmlFor="cur">Mot de passe actuel</Label>
                <Input id="cur" type="password" autoComplete="current-password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new">Nouveau mot de passe</Label>
                <Input id="new" type="password" autoComplete="new-password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="conf">Confirmer le nouveau mot de passe</Label>
                <Input id="conf" type="password" autoComplete="new-password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} />
              </div>
              <Button onClick={submitPwd} disabled={pwdLoading || !pwd.current || !pwd.next || !pwd.confirm}>
                {pwdLoading ? "Mise à jour…" : "Mettre à jour le mot de passe"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscription" className="mt-6">
          <SubscriptionTab />
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Préférences de notification</CardTitle>
              <CardDescription>Choisissez comment vous souhaitez être alerté.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div className="space-y-0.5">
                  <Label className="text-base">Alertes par e-mail</Label>
                  <p className="text-sm text-muted-foreground">Recevez un récapitulatif quotidien de l'activité.</p>
                </div>
                <div className="h-6 w-11 bg-primary rounded-full relative"><div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div></div>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div className="space-y-0.5">
                  <Label className="text-base">Notifications SMS</Label>
                  <p className="text-sm text-muted-foreground">Soyez alerté par SMS en cas d'incident urgent.</p>
                </div>
                <div className="h-6 w-11 bg-muted rounded-full relative"><div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full"></div></div>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label className="text-base">Notifications navigateur</Label>
                  <p className="text-sm text-muted-foreground">Affichez les alertes en temps réel dans l'application.</p>
                </div>
                <div className="h-6 w-11 bg-primary rounded-full relative"><div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="regional" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Préférences régionales</CardTitle>
              <CardDescription>Langue, devise et fuseau horaire utilisés dans la plateforme.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1">Langue</p>
                <p className="font-medium">Français</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1">Devise</p>
                <p className="font-medium">Franc CFA (FCFA)</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1">Fuseau horaire</p>
                <p className="font-medium">Afrique/Douala (UTC+1)</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="mt-6">
          <AttendanceSettingsTab />
        </TabsContent>

        <TabsContent value="modules" className="mt-6">
          <ModulesActifsTab />
        </TabsContent>

        <TabsContent value="permissions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /> Matrice des rôles & permissions</CardTitle>
              <CardDescription>Vue d'ensemble de ce que chaque rôle peut faire dans la plateforme. Édition réservée au super administrateur (à venir).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-5">
                {ROLES.map((r) => (
                  <Badge key={r.key} variant="outline" className={`${r.color} font-medium`}>{r.label}</Badge>
                ))}
              </div>
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/30 text-xs uppercase">
                      <th className="text-left p-3 border-b font-semibold">Module</th>
                      {ROLES.map((r) => (
                        <th key={r.key} className="text-center p-3 border-b font-semibold whitespace-nowrap">{r.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSIONS.map((p) => (
                      <tr key={p.module} className="hover:bg-muted/20">
                        <td className="p-3 border-b font-medium">
                          {p.module}
                          <div className="text-xs text-muted-foreground font-normal mt-0.5">{p.actions.join(" · ")}</div>
                        </td>
                        {ROLES.map((r) => {
                          const granted = RIGHTS[r.key]?.[p.module] || [];
                          const total = p.actions.length;
                          const count = granted.length;
                          const all = count === total;
                          const none = count === 0;
                          return (
                            <td key={r.key} className="text-center p-3 border-b">
                              {all ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700">
                                  <Check className="w-4 h-4" /> Tout
                                </span>
                              ) : none ? (
                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                  <X className="w-4 h-4" /> —
                                </span>
                              ) : (
                                <span className="text-xs text-amber-700 font-medium">{count}/{total}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="danger" className="mt-6">
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-destructive">Zone sensible</CardTitle>
              <CardDescription>Actions irréversibles sur votre compte.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive">Désactiver mon compte</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
