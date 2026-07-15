import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SectionHelp } from "@/components/ui/section-help";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Lock, ShieldCheck, Clock, MapPin, Camera, FolderKanban, Building2, TrendingUp, Save, Loader2, CreditCard, Package, Briefcase, Target, UsersRound, Truck, Megaphone, BarChart3, ChevronDown, ChevronRight, AlertTriangle, Shield, Layers, ArrowRight, Plus, Pencil, Trash2, Copy, Users, ChevronUp, History, RefreshCw, TrendingDown, Zap, FileText } from "lucide-react";
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

function AccountingFrameworkTab() {
  const { data, isLoading } = useQuery<{
    orgType: string; orgTypeLabel: string;
    accountingFramework: string; frameworkLabel: string; frameworkDescription: string;
    configuredAt?: string;
  }>({
    queryKey: ["org-accounting-framework"],
    queryFn: () => apiFetch("/api/organizations/accounting-framework"),
  });

  const FRAMEWORK_INFO: Record<string, { badge: string; color: string }> = {
    syscohada:      { badge: "bg-blue-50 text-blue-700 border-blue-200",        color: "#3B82F6" },
    syscohada_smt:  { badge: "bg-indigo-50 text-indigo-700 border-indigo-200",  color: "#6366F1" },
    sycebnl:        { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", color: "#10B981" },
    pcb:            { badge: "bg-violet-50 text-violet-700 border-violet-200",  color: "#7C3AED" },
    microfinance:   { badge: "bg-teal-50 text-teal-700 border-teal-200",        color: "#14B8A6" },
    cima:           { badge: "bg-amber-50 text-amber-700 border-amber-200",     color: "#F59E0B" },
    cipres:         { badge: "bg-orange-50 text-orange-700 border-orange-200",  color: "#F97316" },
    pce:            { badge: "bg-pink-50 text-pink-700 border-pink-200",        color: "#EC4899" },
    autre:          { badge: "bg-muted text-foreground border-border",          color: "#6B7280" },
  };

  const fwKey = data?.accountingFramework ?? "";
  const fwInfo = FRAMEWORK_INFO[fwKey] ?? { badge: "bg-muted text-foreground border-border", color: "#6B7280" };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Référentiel comptable
          </CardTitle>
          <CardDescription>
            Norme comptable appliquée au plan de comptes de votre organisation. Définie par le type d'organisation lors de la création de l'espace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</div>
          ) : data ? (
            <>
              <div className="flex flex-wrap gap-4 items-start">
                <div className="flex-1 min-w-48 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type d'organisation</p>
                  <p className="text-sm font-medium">{data.orgTypeLabel}</p>
                </div>
                <div className="flex-1 min-w-48 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Référentiel comptable</p>
                  <Badge className={`${fwInfo.badge} border font-mono text-sm`}>{data.frameworkLabel}</Badge>
                </div>
                {data.configuredAt && (
                  <div className="flex-1 min-w-48 space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Configuré le</p>
                    <p className="text-sm text-muted-foreground">{new Date(data.configuredAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</p>
                  </div>
                )}
              </div>
              {data.frameworkDescription && (
                <div className="p-3 rounded-lg bg-muted/40 border text-sm text-muted-foreground">
                  {data.frameworkDescription}
                </div>
              )}
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-amber-200 bg-amber-50/60 text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>La modification du référentiel comptable est réservée aux super-administrateurs Gaméasù. Contactez le support si votre organisation change de statut légal.</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Informations non disponibles.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Helpers pour l'historique de facturation ────────────────────────────────
function eventKindMeta(kind: string): { label: string; icon: React.ReactNode; color: string } {
  switch (kind) {
    case "plan_change":
      return { label: "Changement de formule", icon: <ArrowRight className="w-3.5 h-3.5" />, color: "bg-violet-50 text-violet-700 border-violet-200" };
    case "upgrade":
      return { label: "Montée en gamme", icon: <TrendingUp className="w-3.5 h-3.5" />, color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "downgrade":
      return { label: "Rétrogradation", icon: <TrendingDown className="w-3.5 h-3.5" />, color: "bg-amber-50 text-amber-700 border-amber-200" };
    case "renewal":
      return { label: "Renouvellement", icon: <RefreshCw className="w-3.5 h-3.5" />, color: "bg-blue-50 text-blue-700 border-blue-200" };
    case "activation":
      return { label: "Activation", icon: <Zap className="w-3.5 h-3.5" />, color: "bg-green-50 text-green-700 border-green-200" };
    case "suspension":
      return { label: "Suspension", icon: <X className="w-3.5 h-3.5" />, color: "bg-red-50 text-red-700 border-red-200" };
    case "cancellation":
      return { label: "Résiliation", icon: <X className="w-3.5 h-3.5" />, color: "bg-red-50 text-red-700 border-red-200" };
    default:
      return { label: kind, icon: <FileText className="w-3.5 h-3.5" />, color: "bg-slate-50 text-slate-600 border-slate-200" };
  }
}

function BillingHistoryCard({ events }: { events: BillingEvent[] }) {
  if (events.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          Historique de facturation
        </CardTitle>
        <CardDescription>{events.length} événement{events.length !== 1 ? "s" : ""} · du plus récent au plus ancien</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {events.map((ev) => {
            const meta = eventKindMeta(ev.kind);
            const firmName = ev.metadata?.firmName as string | undefined;
            const changedBy = ev.metadata?.changedByUserName as string | undefined;
            const fromPlan = ev.metadata?.fromPlan as string | undefined;
            const toPlan = ev.metadata?.toPlan as string | undefined;

            const initiator = [
              changedBy ? changedBy : null,
              firmName ? `via ${firmName}` : null,
            ].filter(Boolean).join(" ");

            return (
              <div key={ev.id} className="flex items-start gap-3 px-6 py-3.5 hover:bg-muted/30 transition-colors">
                {/* Icône + badge type */}
                <div className={`mt-0.5 shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${meta.color}`}>
                  {meta.icon}
                  <span>{meta.label}</span>
                </div>

                {/* Détails */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug">
                    {fromPlan && toPlan ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="font-semibold">{fromPlan}</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="font-semibold">{toPlan}</span>
                      </span>
                    ) : (
                      ev.label
                    )}
                  </p>
                  {fromPlan && toPlan && ev.label !== `${fromPlan} → ${toPlan}` && (
                    <p className="text-xs text-muted-foreground mt-0.5">{ev.label}</p>
                  )}
                </div>

                {/* Date + initiateur */}
                <div className="shrink-0 text-right space-y-0.5">
                  <p className="text-xs font-medium text-foreground">
                    {new Date(ev.occurredAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  {initiator && (
                    <p className="text-[11px] text-muted-foreground flex items-center justify-end gap-1">
                      {firmName && <Briefcase className="w-3 h-3 shrink-0" />}
                      {initiator}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

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

      <BillingHistoryCard events={eventsData ?? []} />
    </div>
  );
}


// ─── Types rôles & permissions (API) ─────────────────────────────────────────
type RoleRow = {
  id: string; code: string; name: string; description?: string | null;
  isSystem: boolean; level?: number | null;
  permissionsCount?: number; usersCount?: number;
};
type PermRow = {
  id: string; code: string; label: string; category: string; description?: string | null;
};

function slugify(name: string): string {
  return name.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

function CustomRolesSection() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: rolesData, isLoading: rolesLoading } = useQuery<{ data: RoleRow[] }>({
    queryKey: ["admin/roles"],
    queryFn: () => apiFetch("/api/admin/roles"),
  });
  const { data: permsData } = useQuery<{ data: PermRow[] }>({
    queryKey: ["admin/permissions"],
    queryFn: () => apiFetch("/api/admin/permissions"),
  });

  const customRoles = (rolesData?.data ?? []).filter((r) => !r.isSystem);
  const allPerms = permsData?.data ?? [];

  // Group permissions by category
  const permsByCategory = useMemo(() => {
    const map = new Map<string, PermRow[]>();
    for (const p of allPerms) {
      if (!map.has(p.category)) map.set(p.category, []);
      map.get(p.category)!.push(p);
    }
    return map;
  }, [allPerms]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [selectedPermIds, setSelectedPermIds] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<RoleRow | null>(null);

  function openCreate() {
    setEditing(null);
    setFormName(""); setFormCode(""); setFormDesc("");
    setSelectedPermIds(new Set());
    setExpandedCategories(new Set(Array.from(permsByCategory.keys()).slice(0, 3)));
    setDialogOpen(true);
  }

  async function openEdit(role: RoleRow) {
    setEditing(role);
    setFormName(role.name);
    setFormCode(role.code);
    setFormDesc(role.description ?? "");
    // Load current permissions for this role
    try {
      const detail = await apiFetch<{ permissionIds: string[] }>(`/api/admin/roles/${role.id}`);
      setSelectedPermIds(new Set(detail.permissionIds ?? []));
    } catch {
      setSelectedPermIds(new Set());
    }
    setExpandedCategories(new Set(Array.from(permsByCategory.keys()).slice(0, 3)));
    setDialogOpen(true);
  }

  const createMut = useMutation({
    mutationFn: async (body: { name: string; code: string; description?: string; permissionIds: string[] }) => {
      const role = await apiFetch<RoleRow>("/api/admin/roles", { method: "POST", body: { name: body.name, code: body.code, description: body.description } as any });
      if (body.permissionIds.length > 0) {
        await apiFetch(`/api/admin/roles/${role.id}/permissions`, { method: "PUT", body: { permissionIds: body.permissionIds } as any });
      }
      return role;
    },
    onSuccess: () => {
      toast({ title: "Rôle créé avec succès" });
      qc.invalidateQueries({ queryKey: ["admin/roles"] });
      setDialogOpen(false);
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error ?? e?.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async (body: { id: string; name: string; description?: string; permissionIds: string[] }) => {
      await apiFetch(`/api/admin/roles/${body.id}`, { method: "PUT", body: { name: body.name, description: body.description } as any });
      await apiFetch(`/api/admin/roles/${body.id}/permissions`, { method: "PUT", body: { permissionIds: body.permissionIds } as any });
    },
    onSuccess: () => {
      toast({ title: "Rôle mis à jour" });
      qc.invalidateQueries({ queryKey: ["admin/roles"] });
      setDialogOpen(false);
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error ?? e?.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/roles/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Rôle supprimé" });
      qc.invalidateQueries({ queryKey: ["admin/roles"] });
      setDeleteConfirm(null);
    },
    onError: (e: any) => toast({ title: "Suppression impossible", description: e?.body?.error ?? e?.message, variant: "destructive" }),
  });

  const duplicateMut = useMutation({
    mutationFn: ({ id, newCode, newName }: { id: string; newCode: string; newName: string }) =>
      apiFetch(`/api/admin/roles/${id}/duplicate`, { method: "POST", body: { newCode, newName } as any }),
    onSuccess: () => {
      toast({ title: "Rôle dupliqué" });
      qc.invalidateQueries({ queryKey: ["admin/roles"] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error ?? e?.message, variant: "destructive" }),
  });

  function handleSubmit() {
    const name = formName.trim();
    const code = formCode.trim();
    if (!name) { toast({ title: "Nom requis", variant: "destructive" }); return; }
    if (!code || !/^[a-z0-9_]+$/.test(code)) {
      toast({ title: "Code invalide", description: "Minuscules, chiffres et underscores uniquement.", variant: "destructive" }); return;
    }
    const permissionIds = Array.from(selectedPermIds);
    if (editing) {
      updateMut.mutate({ id: editing.id, name, description: formDesc || undefined, permissionIds });
    } else {
      createMut.mutate({ name, code, description: formDesc || undefined, permissionIds });
    }
  }

  function togglePerm(id: string) {
    setSelectedPermIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleCategory(category: string, perms: PermRow[]) {
    const allSelected = perms.every((p) => selectedPermIds.has(p.id));
    setSelectedPermIds((prev) => {
      const next = new Set(prev);
      if (allSelected) perms.forEach((p) => next.delete(p.id));
      else perms.forEach((p) => next.add(p.id));
      return next;
    });
  }

  function toggleCategoryExpand(cat: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <>
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Rôles personnalisés
            </CardTitle>
            <CardDescription className="mt-1">
              Créez des rôles adaptés à votre organisation avec un ensemble de permissions sur mesure. Les rôles système sont gérés par Gaméasù.
            </CardDescription>
          </div>
          <Button size="sm" onClick={openCreate} className="shrink-0 gap-1.5">
            <Plus className="w-4 h-4" />
            Créer un rôle
          </Button>
        </CardHeader>
        <CardContent>
          {rolesLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
            </div>
          ) : customRoles.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground border border-dashed rounded-lg">
              <Shield className="w-8 h-8 opacity-30" />
              <p className="text-sm">Aucun rôle personnalisé pour le moment.</p>
              <Button variant="outline" size="sm" onClick={openCreate} className="gap-1.5 mt-1">
                <Plus className="w-3.5 h-3.5" /> Créer le premier rôle
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/30 text-xs uppercase">
                    <th className="text-left p-3 border-b font-semibold">Nom du rôle</th>
                    <th className="text-left p-3 border-b font-semibold hidden sm:table-cell">Code</th>
                    <th className="text-center p-3 border-b font-semibold hidden md:table-cell">Permissions</th>
                    <th className="text-center p-3 border-b font-semibold hidden md:table-cell">Utilisateurs</th>
                    <th className="text-right p-3 border-b font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customRoles.map((role) => (
                    <tr key={role.id} className="hover:bg-muted/20">
                      <td className="p-3 border-b">
                        <div className="font-medium">{role.name}</div>
                        {role.description && (
                          <div className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">{role.description}</div>
                        )}
                      </td>
                      <td className="p-3 border-b hidden sm:table-cell">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{role.code}</code>
                      </td>
                      <td className="p-3 border-b text-center hidden md:table-cell">
                        <Badge variant="outline" className="text-xs">{role.permissionsCount ?? 0}</Badge>
                      </td>
                      <td className="p-3 border-b text-center hidden md:table-cell">
                        <span className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                          <Users className="w-3.5 h-3.5" />
                          {role.usersCount ?? 0}
                        </span>
                      </td>
                      <td className="p-3 border-b text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 px-2"
                            onClick={() => openEdit(role)} title="Modifier">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2"
                            onClick={() => duplicateMut.mutate({ id: role.id, newCode: `${role.code}_copie`, newName: `${role.name} (copie)` })}
                            title="Dupliquer">
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteConfirm(role)} title="Supprimer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog créer / modifier un rôle */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le rôle" : "Créer un rôle personnalisé"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="role-name">Nom du rôle *</Label>
                <Input
                  id="role-name"
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value);
                    if (!editing) setFormCode(slugify(e.target.value));
                  }}
                  placeholder="Ex. Comptable junior"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role-code">Code technique *</Label>
                <Input
                  id="role-code"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="Ex. comptable_junior"
                  disabled={!!editing}
                  className={editing ? "opacity-60" : ""}
                />
                <p className="text-xs text-muted-foreground">Minuscules, chiffres, _ uniquement. Immuable après création.</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-desc">Description</Label>
              <Input id="role-desc" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Ex. Accès limité à la comptabilité sans FP&A" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Permissions ({selectedPermIds.size} sélectionnée{selectedPermIds.size !== 1 ? "s" : ""})</Label>
                <div className="flex gap-2 text-xs">
                  <button onClick={() => setSelectedPermIds(new Set(allPerms.map((p) => p.id)))} className="text-primary underline-offset-2 hover:underline">Tout sélectionner</button>
                  <span className="text-muted-foreground">·</span>
                  <button onClick={() => setSelectedPermIds(new Set())} className="text-muted-foreground underline-offset-2 hover:underline">Tout désélectionner</button>
                </div>
              </div>
              <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
                {Array.from(permsByCategory.entries()).map(([category, perms]) => {
                  const allSelected = perms.every((p) => selectedPermIds.has(p.id));
                  const someSelected = perms.some((p) => selectedPermIds.has(p.id)) && !allSelected;
                  const expanded = expandedCategories.has(category);
                  return (
                    <div key={category}>
                      <div
                        className="flex items-center gap-2 px-3 py-2 bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors"
                        onClick={() => toggleCategoryExpand(category)}
                      >
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={() => { toggleCategory(category, perms); }}
                          onClick={(e) => e.stopPropagation()}
                          className={someSelected ? "data-[state=unchecked]:bg-primary/30" : ""}
                        />
                        <span className="flex-1 text-sm font-semibold">{category}</span>
                        <span className="text-xs text-muted-foreground">{perms.filter((p) => selectedPermIds.has(p.id)).length}/{perms.length}</span>
                        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      {expanded && (
                        <div className="divide-y">
                          {perms.map((p) => (
                            <label key={p.id} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/10 cursor-pointer">
                              <Checkbox
                                checked={selectedPermIds.has(p.id)}
                                onCheckedChange={() => togglePerm(p.id)}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium leading-none">{p.label}</p>
                                <p className="text-xs text-muted-foreground font-mono mt-0.5">{p.code}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={isPending} className="gap-2">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editing ? "Enregistrer" : "Créer le rôle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmation suppression */}
      <Dialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer le rôle</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Voulez-vous supprimer le rôle <strong>«&nbsp;{deleteConfirm?.name}&nbsp;»</strong> ?
            {(deleteConfirm?.usersCount ?? 0) > 0 && (
              <span className="block mt-1 text-destructive font-medium">
                Impossible : {deleteConfirm?.usersCount} utilisateur(s) ont encore ce rôle.
              </span>
            )}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Annuler</Button>
            <Button
              variant="destructive"
              disabled={deleteMut.isPending || (deleteConfirm?.usersCount ?? 0) > 0}
              onClick={() => deleteConfirm && deleteMut.mutate(deleteConfirm.id)}
            >
              {deleteMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
          <TabsTrigger value="profile" className="gap-1">Profil <SectionHelp id="settings.profile" /></TabsTrigger>
          <TabsTrigger value="security" className="gap-1">Sécurité <SectionHelp id="settings.security" /></TabsTrigger>
          <TabsTrigger value="subscription" className="gap-1">Abonnement <SectionHelp id="settings.subscription" /></TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1">Notifications <SectionHelp id="settings.notifications" /></TabsTrigger>
          <TabsTrigger value="regional" className="gap-1">Régionales <SectionHelp id="settings.regional" /></TabsTrigger>
          <TabsTrigger value="attendance" className="gap-1">Pointage <SectionHelp id="settings.attendance" /></TabsTrigger>
          <TabsTrigger value="modules" className="gap-1">Modules actifs <SectionHelp id="settings.modules" /></TabsTrigger>
          <TabsTrigger value="permissions" className="gap-1">Permissions <SectionHelp id="settings.permissions" /></TabsTrigger>
          <TabsTrigger value="comptabilite" className="gap-1">Comptabilité <SectionHelp id="settings.comptabilite" /></TabsTrigger>
          <TabsTrigger value="danger" className="gap-1">Zone sensible <SectionHelp id="settings.danger" /></TabsTrigger>
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

        <TabsContent value="comptabilite" className="mt-6">
          <AccountingFrameworkTab />
        </TabsContent>

        <TabsContent value="permissions" className="mt-6 space-y-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /> Matrice des rôles & permissions</CardTitle>
              <CardDescription>Vue d'ensemble de ce que chaque rôle système peut faire dans la plateforme.</CardDescription>
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
          <CustomRolesSection />
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
