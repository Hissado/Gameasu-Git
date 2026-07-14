import React, { useState, useRef, useCallback, useEffect } from "react";
import { useGetCollaborator, getGetCollaboratorQueryKey } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { QRCodeSVG } from "qrcode.react";
import { useRoute, Link, useLocation, useSearch } from "wouter";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Mail, Phone, Calendar, FolderKanban, Briefcase, FileSignature, Wrench,
  FolderArchive, GitBranch, Building2, BadgeCheck, ListTodo, ExternalLink,
  Pencil, Camera, Loader2, Save, User, DollarSign, AlertCircle, CalendarClock,
  HardHat, Clock, TrendingUp, Bus, Home, Utensils, Gift, Info as InfoIcon, Keyboard, X, Check,
  FileText, Download, Landmark, MailCheck, CheckCircle2, XCircle, RefreshCw,
  Search, UserPlus, PanelLeftOpen, PanelLeftClose, ArrowUpDown, Link2, UserX, QrCode, RefreshCcw, Printer, ShieldOff,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatFCFA } from "@/lib/format";
import { toast } from "sonner";
import { PayslipEmailLogsSheet } from "@/components/payslip-email-logs-sheet";
import { SectionHelp } from "@/components/ui/section-help";

// ─── Types ───────────────────────────────────────────────────────────────────

type Overview = {
  collaborator: any;
  department?: { id: string; name: string; color?: string } | null;
  position?: { id: string; title: string; level?: number } | null;
  manager?: { id: string; firstName: string; lastName: string } | null;
  assignments: Array<{ id: string; projectId: string; projectName: string; projectStatus: string; role: string; allocationPct: number; status: string; startDate?: string; endDate?: string }>;
  tasks: Array<{ id: string; title: string; status: string; dueDate?: string; priority?: string }>;
  equipments: Array<{ id: string; name: string; code?: string; status: string }>;
  ledProjects: Array<{ id: string; name: string; status: string }>;
  contracts: Array<{ id: string; type: string; status: string; startDate: string; endDate?: string; monthlySalary?: number; jobTitle?: string }>;
  documents: Array<{ id: string; type: string; name: string; fileUrl: string; expiresAt?: string }>;
  workload: { activeAssignments: number; totalAllocationPct: number; activeTasks: number; responsibleEquipmentsCount: number; ledProjectsCount: number };
};

type EditForm = {
  firstName: string;
  lastName: string;
  email: string;
  professionalEmail: string;
  phone: string;
  nationalId: string;
  birthDate: string;
  address: string;
  employeeNumber: string;
  departmentId: string;
  positionId: string;
  managerCollaboratorId: string;
  hireDate: string;
  employmentStatus: string;
  isAvailable: boolean;
  baseSalary: string;
  // Coût employeur réel
  employerChargeRate: string;
  transportAllowance: string;
  housingAllowance: string;
  mealAllowance: string;
  otherBenefitsMonthly: string;
  weeklyHours: string;
  ecName: string;
  ecPhone: string;
  ecRelation: string;
  avatarUrl: string;
  // Coordonnées bancaires
  bankName: string;
  bankCode: string;
  bankAccountNumber: string;
};

type EmployerCost = {
  baseSalary: number;
  weeklyHours: number;
  employerChargeRate: number;
  transportAllowance: number;
  housingAllowance: number;
  mealAllowance: number;
  otherBenefitsMonthly: number;
  totalBenefitsMonthly: number;
  monthlyHours: number;
  monthlyCostEmployeur: number;
  hourlyRate: number;
  dailyRate: number;
  contractType: string | null;
  salarySource: string;
  weeklyHoursSource: string;
};

type Payslip = {
  id: string;
  period: string;
  baseSalary: number;
  grossSalary: number;
  netSalary: number;
  cnssEmployee: number;
  irpp: number;
  ipts: number;
  status: string;
  paidAt?: string | null;
  collaboratorName?: string;
  collaboratorCode?: string;
  emailSentAt?: string | null;
};


// ─── Helpers ─────────────────────────────────────────────────────────────────

async function downloadPayslipPdf(url: string, filename: string) {
  const token = localStorage.getItem("auth_token");
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as { error?: string }).error ?? r.statusText); }
  const blob = await r.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

const PAYSLIP_STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  validated: "Validé",
  paid: "Payé",
};
const PAYSLIP_STATUS_CLASS: Record<string, string> = {
  draft: "bg-amber-50 text-amber-700 border-amber-200",
  validated: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const MOIS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
function formatPeriod(period: string) {
  const [yr, mo] = period.split("-");
  const label = MOIS_FR[parseInt(mo, 10) - 1] ?? mo;
  return `${label} ${yr}`;
}

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700", completed: "bg-slate-200 text-slate-700",
    cancelled: "bg-red-100 text-red-700", terminated: "bg-slate-200 text-slate-700",
    expired: "bg-red-100 text-red-700", suspended: "bg-amber-100 text-amber-700",
    draft: "bg-blue-100 text-blue-700", available: "bg-emerald-100 text-emerald-700",
    in_use: "bg-amber-100 text-amber-700", maintenance: "bg-red-100 text-red-700",
    planning: "bg-blue-100 text-blue-700", in_progress: "bg-amber-100 text-amber-700",
    on_hold: "bg-slate-200 text-slate-700", done: "bg-emerald-100 text-emerald-700",
    todo: "bg-slate-200 text-slate-700",
  };
  return <Badge className={`${map[s] || "bg-muted"} border-0`}>{s}</Badge>;
};

// ─── Edit Dialog ─────────────────────────────────────────────────────────────

function EditCollaboratorDialog({
  open, onClose, collaboratorId, initialData, canEditSalary,
}: {
  open: boolean;
  onClose: () => void;
  collaboratorId: string;
  initialData: EditForm;
  canEditSalary: boolean;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EditForm>(initialData);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialData.avatarUrl || null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const { data: departments } = useQuery<{ data: any[] }>({
    queryKey: ["hr-departments"],
    queryFn: () => apiFetch("/api/hr/departments"),
    enabled: open,
  });
  const { data: positions } = useQuery<{ data: any[] }>({
    queryKey: ["hr-positions"],
    queryFn: () => apiFetch("/api/hr/positions"),
    enabled: open,
  });
  const { data: collabsData } = useQuery<{ data: any[] }>({
    queryKey: ["collaborators-list"],
    queryFn: () => apiFetch("/api/collaborators?limit=200"),
    enabled: open,
  });

  const set = useCallback(<K extends keyof EditForm>(k: K, v: EditForm[K]) => {
    setForm(prev => ({ ...prev, [k]: v }));
  }, []);

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so re-selecting same file still fires onChange
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 512;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setAvatarPreview(dataUrl);
        set("avatarUrl", dataUrl);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const mutation = useMutation({
    mutationFn: (data: EditForm) =>
      apiFetch(`/api/hr/collaborators/${collaboratorId}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          professionalEmail: data.professionalEmail || null,
          phone: data.phone,
          nationalId: data.nationalId,
          birthDate: data.birthDate || null,
          address: data.address,
          emergencyContact: (data.ecName || data.ecPhone || data.ecRelation)
            ? { name: data.ecName, phone: data.ecPhone, relation: data.ecRelation }
            : null,
          employeeNumber: data.employeeNumber,
          departmentId: data.departmentId || null,
          positionId: data.positionId || null,
          managerCollaboratorId: data.managerCollaboratorId || null,
          hireDate: data.hireDate || null,
          employmentStatus: data.employmentStatus,
          isAvailable: data.isAvailable,
          avatarUrl: data.avatarUrl || null,
          // Coordonnées bancaires
          bankName: data.bankName || null,
          bankCode: data.bankCode || null,
          bankAccountNumber: data.bankAccountNumber || null,
          ...(canEditSalary && {
            baseSalary: data.baseSalary ? Number(data.baseSalary) : null,
            employerChargeRate: data.employerChargeRate ? Number(data.employerChargeRate) : 18.4,
            transportAllowance: data.transportAllowance ? Number(data.transportAllowance) : 0,
            housingAllowance: data.housingAllowance ? Number(data.housingAllowance) : 0,
            mealAllowance: data.mealAllowance ? Number(data.mealAllowance) : 0,
            otherBenefitsMonthly: data.otherBenefitsMonthly ? Number(data.otherBenefitsMonthly) : 0,
            weeklyHours: data.weeklyHours ? Number(data.weeklyHours) : 40,
          }),
        }),
      }),
    onSuccess: () => {
      toast.success("Profil mis à jour avec succès");
      queryClient.invalidateQueries({ queryKey: getGetCollaboratorQueryKey(collaboratorId) });
      queryClient.invalidateQueries({ queryKey: ["hr-overview", collaboratorId] });
      queryClient.invalidateQueries({ queryKey: ["employer-cost", collaboratorId] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erreur lors de la mise à jour");
    },
  });

  const depts = departments?.data ?? [];
  const posts = positions?.data ?? [];
  const collabs = (collabsData?.data ?? []).filter((c: any) => c.id !== collaboratorId);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-primary" />
            Modifier le profil collaborateur
          </DialogTitle>
        </DialogHeader>

        {/* Avatar */}
        <div className="flex items-center gap-4 py-2 border-b border-border mb-2">
          <label htmlFor="collab-avatar-input" className="relative cursor-pointer group">
            <Avatar className="w-16 h-16 ring-2 ring-border">
              {avatarPreview ? <AvatarImage src={avatarPreview} /> : null}
              <AvatarFallback className="text-xl bg-primary text-primary-foreground font-bold">
                {form.firstName[0]}{form.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-5 h-5 text-white" />
            </div>
          </label>
          <div>
            <p className="text-sm font-medium text-foreground">{form.firstName} {form.lastName}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <label
                htmlFor="collab-avatar-input"
                className="text-xs text-primary hover:underline cursor-pointer"
              >
                Galerie
              </label>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <label
                htmlFor="collab-avatar-camera"
                className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
              >
                <Camera className="w-3 h-3" />
                Prendre une photo
              </label>
              {avatarPreview && (
                <>
                  <span className="text-muted-foreground/40 text-xs">·</span>
                  <button
                    type="button"
                    onClick={() => { setAvatarPreview(null); set("avatarUrl", ""); }}
                    className="text-xs text-destructive hover:underline"
                  >
                    Supprimer
                  </button>
                </>
              )}
            </div>
          </div>
          <input
            id="collab-avatar-input"
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            style={{ position: "absolute", opacity: 0, width: 0, height: 0, overflow: "hidden" }}
            onChange={handleAvatarFile}
          />
          <input
            id="collab-avatar-camera"
            type="file"
            accept="image/*"
            capture="user"
            style={{ position: "absolute", opacity: 0, width: 0, height: 0, overflow: "hidden" }}
            onChange={handleAvatarFile}
          />
        </div>

        <Tabs defaultValue="identity">
          <div className="overflow-x-auto pb-1"><TabsList className="grid grid-cols-5 w-full mb-4 min-w-[360px]">
            <TabsTrigger value="identity" className="flex items-center gap-1.5 text-xs">
              <User className="w-3.5 h-3.5" />Identité <SectionHelp id="collaborators.detail.identity" />
            </TabsTrigger>
            <TabsTrigger value="pro" className="flex items-center gap-1.5 text-xs">
              <Briefcase className="w-3.5 h-3.5" />Profil pro <SectionHelp id="collaborators.detail.pro" />
            </TabsTrigger>
            <TabsTrigger value="salary" className="flex items-center gap-1.5 text-xs" disabled={!canEditSalary}>
              <DollarSign className="w-3.5 h-3.5" />Rémunération <SectionHelp id="collaborators.detail.salary" />
            </TabsTrigger>
            <TabsTrigger value="bank" className="flex items-center gap-1.5 text-xs">
              <Landmark className="w-3.5 h-3.5" />Banque <SectionHelp id="collaborators.detail.bank" />
            </TabsTrigger>
            <TabsTrigger value="emergency" className="flex items-center gap-1.5 text-xs">
              <AlertCircle className="w-3.5 h-3.5" />Urgence <SectionHelp id="collaborators.detail.emergency" />
            </TabsTrigger>
          </TabsList></div>

          {/* TAB 1 — Identité */}
          <TabsContent value="identity" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">Prénom <span className="text-destructive">*</span></Label>
                <Input id="firstName" value={form.firstName} onChange={e => set("firstName", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Nom <span className="text-destructive">*</span></Label>
                <Input id="lastName" value={form.lastName} onChange={e => set("lastName", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="professionalEmail">Email professionnel</Label>
                <Input id="professionalEmail" type="email" value={form.professionalEmail} onChange={e => set("professionalEmail", e.target.value)} placeholder="prenom.nom@entreprise.com" />
                <p className="text-xs text-muted-foreground">Utilisé en priorité pour l'envoi des bulletins.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Téléphone</Label>
                <Input id="phone" value={form.phone} onChange={e => set("phone", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email personnel</Label>
              <Input id="email" type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@personnel.com" />
              <p className="text-xs text-muted-foreground">Utilisé en secours si l'email professionnel est absent.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="nationalId">N° pièce d'identité</Label>
                <Input id="nationalId" value={form.nationalId} onChange={e => set("nationalId", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="birthDate">Date de naissance</Label>
                <Input id="birthDate" type="date" value={form.birthDate} onChange={e => set("birthDate", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">Adresse</Label>
              <Textarea id="address" value={form.address} onChange={e => set("address", e.target.value)} rows={2} />
            </div>
          </TabsContent>

          {/* TAB 2 — Profil professionnel */}
          <TabsContent value="pro" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="employeeNumber">Matricule</Label>
                <Input id="employeeNumber" value={form.employeeNumber} onChange={e => set("employeeNumber", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hireDate">Date d'embauche</Label>
                <Input id="hireDate" type="date" value={form.hireDate} onChange={e => set("hireDate", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Département</Label>
                <Select value={form.departmentId || "__none__"} onValueChange={v => set("departmentId", v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Aucun —</SelectItem>
                    {depts.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Poste / Fonction</Label>
                <Select value={form.positionId || "__none__"} onValueChange={v => set("positionId", v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Aucun —</SelectItem>
                    {posts.filter((p: any) => p?.pos?.id).map((p: any) => <SelectItem key={p.pos.id} value={p.pos.id}>{p.pos.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Manager direct</Label>
              <Select value={form.managerCollaboratorId || "__none__"} onValueChange={v => set("managerCollaboratorId", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Aucun —</SelectItem>
                  {collabs.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Statut d'emploi</Label>
                <Select value={form.employmentStatus} onValueChange={v => set("employmentStatus", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="on_leave">En congé</SelectItem>
                    <SelectItem value="terminated">Contrat terminé</SelectItem>
                    <SelectItem value="retired">Retraité</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Disponibilité pour affectation</Label>
                <div className="flex items-center gap-3 pt-2">
                  <Switch
                    checked={form.isAvailable}
                    onCheckedChange={v => set("isAvailable", v)}
                  />
                  <span className="text-sm text-muted-foreground">{form.isAvailable ? "Disponible" : "Non disponible"}</span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 3 — Rémunération & Coût employeur (admin seulement) */}
          <TabsContent value="salary" className="space-y-4">
            {canEditSalary ? (
              <>
                {/* Salaire brut */}
                <div className="space-y-1.5">
                  <Label htmlFor="baseSalary" className="flex items-center gap-1">
                    Salaire brut mensuel (FCFA) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="baseSalary"
                    type="number"
                    value={form.baseSalary}
                    onChange={e => set("baseSalary", e.target.value)}
                    placeholder="ex : 450 000"
                  />
                  <p className="text-xs text-muted-foreground">Salaire brut mensuel en FCFA avant charges et impôts.</p>
                </div>

                <Separator />

                {/* Heures de travail */}
                <div className="space-y-1.5">
                  <Label htmlFor="weeklyHours" className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-purple-500" />
                    Heures de travail / semaine
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="weeklyHours"
                      type="number" min="1" max="80" step="0.5"
                      className="flex-1"
                      value={form.weeklyHours}
                      onChange={e => set("weeklyHours", e.target.value)}
                    />
                    <span className="text-sm text-muted-foreground shrink-0">h/sem</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Heures mensuelles calculées : <strong>{(parseFloat(form.weeklyHours || "40") * 52 / 12).toFixed(1)} h/mois</strong>
                  </p>
                </div>

                {/* Taux de charges patronales */}
                <div className="space-y-1.5">
                  <Label htmlFor="employerChargeRate" className="flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-purple-500" />
                    Taux de charges patronales (%)
                    <Tooltip>
                      <TooltipTrigger asChild><InfoIcon className="w-3.5 h-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        Charges patronales configurables selon le pays (ex : CNSS + accidents + formation pro).<br/>
                        Ajuster selon le type de contrat (prestataire, freelance…).
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="employerChargeRate"
                      type="number" min="0" max="100" step="0.1"
                      className="flex-1"
                      value={form.employerChargeRate}
                      onChange={e => set("employerChargeRate", e.target.value)}
                    />
                    <span className="text-sm text-muted-foreground shrink-0">%</span>
                  </div>
                  <div className="flex gap-1">
                    {[0, 18.4, 25].map(v => (
                      <button key={v} type="button"
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${parseFloat(form.employerChargeRate) === v ? "bg-purple-600 text-white border-purple-600" : "border-slate-200 hover:border-slate-400"}`}
                        onClick={() => set("employerChargeRate", String(v))}>
                        {`${v}%`}
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Avantages mensuels */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Avantages mensuels (FCFA)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="transportAllowance" className="flex items-center gap-1 text-xs">
                        <Bus className="w-3 h-3 text-blue-500" /> Transport
                      </Label>
                      <Input id="transportAllowance" type="number" min="0" step="1000" placeholder="0"
                        value={form.transportAllowance} onChange={e => set("transportAllowance", e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="housingAllowance" className="flex items-center gap-1 text-xs">
                        <Home className="w-3 h-3 text-emerald-500" /> Logement
                      </Label>
                      <Input id="housingAllowance" type="number" min="0" step="1000" placeholder="0"
                        value={form.housingAllowance} onChange={e => set("housingAllowance", e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="mealAllowance" className="flex items-center gap-1 text-xs">
                        <Utensils className="w-3 h-3 text-amber-500" /> Repas
                      </Label>
                      <Input id="mealAllowance" type="number" min="0" step="1000" placeholder="0"
                        value={form.mealAllowance} onChange={e => set("mealAllowance", e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="otherBenefitsMonthly" className="flex items-center gap-1 text-xs">
                        <Gift className="w-3 h-3 text-purple-500" /> Autres (assurance, tel…)
                      </Label>
                      <Input id="otherBenefitsMonthly" type="number" min="0" step="1000" placeholder="0"
                        value={form.otherBenefitsMonthly} onChange={e => set("otherBenefitsMonthly", e.target.value)} className="h-8 text-sm" />
                    </div>
                  </div>
                </div>

                {/* Récapitulatif calculé */}
                {parseFloat(form.baseSalary || "0") > 0 && (
                  <div className="bg-purple-50 border border-purple-100 rounded-lg px-4 py-3 text-xs">
                    <p className="font-semibold text-purple-800 mb-2 flex items-center gap-1"><HardHat className="w-3.5 h-3.5" /> Coût employeur calculé</p>
                    <div className="grid grid-cols-2 gap-2 text-slate-700">
                      {(() => {
                        const salary = parseFloat(form.baseSalary || "0");
                        const rate = parseFloat(form.employerChargeRate || "18.4");
                        const benefits = parseFloat(form.transportAllowance || "0") + parseFloat(form.housingAllowance || "0") + parseFloat(form.mealAllowance || "0") + parseFloat(form.otherBenefitsMonthly || "0");
                        const wh = parseFloat(form.weeklyHours || "40");
                        const monthHours = (wh * 52) / 12;
                        const monthlyCost = salary * (1 + rate / 100) + benefits;
                        const hrRate = monthHours > 0 ? monthlyCost / monthHours : 0;
                        return <>
                          <div><div className="text-muted-foreground">Heures/mois</div><div className="font-semibold">{monthHours.toFixed(1)} h</div></div>
                          <div><div className="text-muted-foreground">Total avantages/mois</div><div className="font-semibold">{formatFCFA(Math.round(benefits))}</div></div>
                          <div><div className="text-muted-foreground">Coût employeur/mois</div><div className="font-bold text-purple-700">{formatFCFA(Math.round(monthlyCost))}</div></div>
                          <div><div className="text-muted-foreground">Taux horaire réel</div><div className="font-bold text-purple-700">{formatFCFA(Math.round(hrRate))}/h</div></div>
                        </>;
                      })()}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                Cette section est réservée aux administrateurs.
              </div>
            )}
          </TabsContent>

          {/* TAB 4 — Coordonnées bancaires */}
          <TabsContent value="bank" className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-blue-800 text-xs">
              <Landmark className="w-4 h-4 shrink-0 mt-0.5" />
              <p>Ces informations sont utilisées pour générer les ordres de virement de salaire (format BCEAO/UEMOA).</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bankName">Nom de la banque</Label>
              <Input
                id="bankName"
                value={form.bankName}
                onChange={e => set("bankName", e.target.value)}
                placeholder="ex : Ecobank, BNP Paribas, SGBF…"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="bankCode">Code banque BCEAO</Label>
                <Input
                  id="bankCode"
                  value={form.bankCode}
                  onChange={e => set("bankCode", e.target.value)}
                  placeholder="ex : 024"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">Code banque à 3 chiffres attribué par la banque centrale (ex : BCEAO, BEAC).</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bankAccountNumber">Numéro de compte</Label>
                <Input
                  id="bankAccountNumber"
                  value={form.bankAccountNumber}
                  onChange={e => set("bankAccountNumber", e.target.value)}
                  placeholder="ex : TG53 TG007 0100 0XXX…"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">Numéro de compte ou IBAN UEMOA.</p>
              </div>
            </div>
          </TabsContent>

          {/* TAB 5 — Contact d'urgence */}
          <TabsContent value="emergency" className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ecName">Nom complet</Label>
              <Input id="ecName" value={form.ecName} onChange={e => set("ecName", e.target.value)} placeholder="ex : Fatou Diallo" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ecPhone">Téléphone</Label>
                <Input id="ecPhone" value={form.ecPhone} onChange={e => set("ecPhone", e.target.value)} placeholder="+228 90 00 00 00" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ecRelation">Lien de parenté</Label>
                <Input id="ecRelation" value={form.ecRelation} onChange={e => set("ecRelation", e.target.value)} placeholder="ex : Épouse, Père…" />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Annuler</Button>
          <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending || !form.firstName || !form.lastName}>
            {mutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Enregistrer les modifications
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Bank Request Panel (manager) ────────────────────────────────────────────

type BankInfoRequest = {
  id: string;
  collaboratorId: string;
  bankName: string | null;
  bankCode: string | null;
  bankAccountNumber: string | null;
  status: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

function BankRequestPanel({ collaboratorId, onApproved }: { collaboratorId: string; onApproved: () => void }) {
  const queryClient = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const { data: requestsData, isLoading } = useQuery<{ data: BankInfoRequest[] }>({
    queryKey: ["bank-requests-collab", collaboratorId],
    queryFn: () => apiFetch(`/api/hr/bank-requests?status=pending`),
    select: (d) => ({ data: d.data.filter((r: BankInfoRequest) => r.collaboratorId === collaboratorId) }),
  });

  const pendingRequest = requestsData?.data[0] ?? null;

  const approveMutation = useMutation({
    mutationFn: () => apiFetch(`/api/hr/bank-requests/${pendingRequest!.id}/approve`, { method: "PATCH" }),
    onSuccess: () => {
      toast.success("Coordonnées bancaires mises à jour");
      queryClient.invalidateQueries({ queryKey: ["bank-requests-collab", collaboratorId] });
      onApproved();
    },
    onError: (e: any) => toast.error(e?.message || "Erreur lors de la validation"),
  });

  const rejectMutation = useMutation({
    mutationFn: () => apiFetch(`/api/hr/bank-requests/${pendingRequest!.id}/reject`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rejectionReason: rejectReason || undefined }),
    }),
    onSuccess: () => {
      toast.success("Demande refusée");
      setRejectOpen(false);
      setRejectReason("");
      queryClient.invalidateQueries({ queryKey: ["bank-requests-collab", collaboratorId] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur lors du refus"),
  });

  if (isLoading || !pendingRequest) return null;

  return (
    <>
      <div className="pt-2 border-t border-amber-200">
        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Landmark className="w-3 h-3" /> Demande bancaire en attente
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
          <div className="text-xs space-y-1">
            {pendingRequest.bankName && (
              <p className="text-slate-700">
                <span className="text-slate-500">Banque : </span>
                <span className="font-medium">{pendingRequest.bankName}
                  {pendingRequest.bankCode && <span className="text-slate-400 ml-1">(code {pendingRequest.bankCode})</span>}
                </span>
              </p>
            )}
            {pendingRequest.bankAccountNumber && (
              <p className="text-slate-700">
                <span className="text-slate-500">Compte : </span>
                <span className="font-mono font-medium">{pendingRequest.bankAccountNumber}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex-1 gap-1"
              disabled={approveMutation.isPending}
              onClick={() => approveMutation.mutate()}
            >
              {approveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              Approuver
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50 flex-1 gap-1"
              onClick={() => setRejectOpen(true)}
            >
              <XCircle className="w-3 h-3" /> Refuser
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Refuser la demande bancaire</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Vous pouvez indiquer un motif pour aider l'employé à corriger sa demande.
            </p>
            <div className="space-y-1.5">
              <Label>Motif du refus (optionnel)</Label>
              <Textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                placeholder="ex : Numéro de compte invalide, veuillez vérifier…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Annuler</Button>
            <Button
              variant="destructive"
              disabled={rejectMutation.isPending}
              onClick={() => rejectMutation.mutate()}
            >
              {rejectMutation.isPending ? "Refus…" : "Confirmer le refus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Add Collaborator Dialog ──────────────────────────────────────────────────

function AddCollaboratorDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    position: "", department: "", departmentId: "", positionId: "",
    hireDate: "", employmentStatus: "active",
  });
  const [saving, setSaving] = useState(false);

  const { data: departments } = useQuery<{ data: any[] }>({
    queryKey: ["hr-departments"],
    queryFn: () => apiFetch("/api/hr/departments"),
    enabled: open,
  });
  const { data: positions } = useQuery<{ data: any[] }>({
    queryKey: ["hr-positions"],
    queryFn: () => apiFetch("/api/hr/positions"),
    enabled: open,
  });

  const depts = departments?.data ?? [];
  const posts = positions?.data ?? [];

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("Prénom et nom sont requis");
      return;
    }
    setSaving(true);
    try {
      const created = await apiFetch("/api/collaborators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          position: form.position.trim() || undefined,
          department: form.department.trim() || undefined,
          departmentId: form.departmentId || undefined,
          positionId: form.positionId || undefined,
          hireDate: form.hireDate || undefined,
          employmentStatus: form.employmentStatus,
          isAvailable: true,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ["collab-sidebar-list"] });
      toast.success(`${form.firstName} ${form.lastName} a été ajouté·e`);
      onCreated((created as any).id);
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Nouveau collaborateur
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="add-fn">Prénom <span className="text-destructive">*</span></Label>
            <Input id="add-fn" value={form.firstName} onChange={e => set("firstName", e.target.value)} placeholder="Jean-Eude" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-ln">Nom <span className="text-destructive">*</span></Label>
            <Input id="add-ln" value={form.lastName} onChange={e => set("lastName", e.target.value)} placeholder="COKOU" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-email">Email</Label>
            <Input id="add-email" type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="jean@entreprise.tg" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-phone">Téléphone</Label>
            <Input id="add-phone" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+228 90 00 00 00" />
          </div>
          <div className="space-y-1.5">
            <Label>Département</Label>
            <Select value={form.departmentId || "__none__"} onValueChange={v => {
              if (v === "__none__") { set("departmentId", ""); set("department", ""); return; }
              const d = depts.find((d: any) => d.id === v);
              set("departmentId", v);
              if (d) set("department", d.name);
            }}>
              <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Non assigné</SelectItem>
                {depts.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Poste</Label>
            <Select value={form.positionId || "__none__"} onValueChange={v => {
              if (v === "__none__") { set("positionId", ""); set("position", ""); return; }
              const p = posts.find((p: any) => p.id === v);
              set("positionId", v);
              if (p) set("position", p.title);
            }}>
              <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Non assigné</SelectItem>
                {posts.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-hire">Date d'embauche</Label>
            <Input id="add-hire" type="date" value={form.hireDate} onChange={e => set("hireDate", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Statut</Label>
            <Select value={form.employmentStatus} onValueChange={v => set("employmentStatus", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Actif</SelectItem>
                <SelectItem value="inactive">Inactif</SelectItem>
                <SelectItem value="on_leave">En congé</SelectItem>
                <SelectItem value="probation">Période d'essai</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <UserPlus className="w-4 h-4 mr-1.5" />}
            Créer le collaborateur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sidebar helpers ──────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#0d9488","#0284c7","#7c3aed","#db2777","#d97706",
  "#16a34a","#dc2626","#9333ea","#0891b2","#65a30d",
];
function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getCollabStatus(c: any): { label: string; className: string } | null {
  if (c.contractExpiresInDays != null && c.contractExpiresInDays <= 30) {
    return {
      label: c.contractExpiresInDays === 0 ? "Expire aujourd'hui" : `Expire dans ${c.contractExpiresInDays}j`,
      className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    };
  }
  if (c.employmentStatus === "inactive") {
    return { label: "Inactif", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
  }
  if (!c.isAvailable) {
    return { label: "Indisponible", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
  }
  if (c.hireDate) {
    const daysAgo = (Date.now() - new Date(c.hireDate).getTime()) / 86_400_000;
    if (daysAgo < 90) {
      return { label: "Nouveau", className: "bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary" };
    }
  }
  return null;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CollaboratorDetail() {
  const [, params] = useRoute("/collaborateurs/:id");
  const id = params?.id || "";
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [linkUserOpen, setLinkUserOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  const { data: collaborator, isLoading } = useGetCollaborator(id, {
    query: { enabled: !!id, queryKey: getGetCollaboratorQueryKey(id) },
  });

  const { data: employerCost } = useQuery<EmployerCost>({
    queryKey: ["employer-cost", id],
    queryFn: () => apiFetch(`/api/collaborators/${id}/employer-cost`),
    enabled: !!id,
  });

  const { data: overview, isLoading: overviewLoading } = useQuery<Overview>({
    queryKey: ["hr-overview", id],
    queryFn: () => apiFetch(`/api/hr/collaborators/${id}/overview`),
    enabled: !!id,
  });

  const { data: leaveBalancesData } = useQuery<{ data: Array<{ leaveType: string; allocated: number; used: number; carried: number }> }>({
    queryKey: ["leave-balances-collab", id],
    queryFn: () => apiFetch(`/api/hr/leave-balances?collaboratorId=${id}&year=${new Date().getFullYear()}`),
    enabled: !!id,
  });
  const totalLeaveAvailable = (leaveBalancesData?.data ?? []).reduce((s, b) => s + Math.max(0, (b.allocated ?? 0) + (b.carried ?? 0) - (b.used ?? 0)), 0);

  const { data: pendingLeaveReqs } = useQuery<any[]>({
    queryKey: ["pending-leave-reqs-collab", id],
    queryFn: async () => {
      const r = await apiFetch(`/api/hr/leaves?collaboratorId=${id}&status=pending`);
      return Array.isArray(r) ? r : ((r as any)?.data ?? []);
    },
    enabled: !!id,
  });

  const isManagerOrAbove = ["admin", "super_admin", "manager"].includes(user?.role || "");
  const isAdmin = ["admin", "super_admin"].includes(user?.role || "");
  const queryClient = useQueryClient();

  // ─── Sidebar state ────────────────────────────────────────────────────────
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Filters are persisted in URL search params so they survive navigation between profiles
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const sidebarStatusFilter = (searchParams.get("status") ?? "all") as "all" | "active" | "inactive" | "new" | "unavailable";
  const sidebarDeptFilter = searchParams.get("dept") ?? "all";

  const setSidebarStatusFilter = useCallback((value: "all" | "active" | "inactive" | "new" | "unavailable") => {
    const p = new URLSearchParams(window.location.search);
    if (value === "all") p.delete("status"); else p.set("status", value);
    const qs = p.toString();
    navigate(`/collaborateurs/${id}${qs ? `?${qs}` : ""}`, { replace: true });
  }, [id, navigate]);

  const setSidebarDeptFilter = useCallback((value: string) => {
    const p = new URLSearchParams(window.location.search);
    if (value === "all") p.delete("dept"); else p.set("dept", value);
    const qs = p.toString();
    navigate(`/collaborateurs/${id}${qs ? `?${qs}` : ""}`, { replace: true });
  }, [id, navigate]);

  type SidebarSort = "name_asc" | "name_desc" | "hire_desc" | "hire_asc" | "workload_desc";
  const SORT_STORAGE_KEY = "collab_sidebar_sort";
  const sidebarSort = (searchParams.get("sort") ?? (localStorage.getItem(SORT_STORAGE_KEY) as SidebarSort | null) ?? "name_asc") as SidebarSort;
  const setSidebarSort = useCallback((value: SidebarSort) => {
    if (value === "name_asc") {
      localStorage.removeItem(SORT_STORAGE_KEY);
    } else {
      localStorage.setItem(SORT_STORAGE_KEY, value);
    }
    const p = new URLSearchParams(window.location.search);
    if (value === "name_asc") p.delete("sort"); else p.set("sort", value);
    const qs = p.toString();
    navigate(`/collaborateurs/${id}${qs ? `?${qs}` : ""}`, { replace: true });
  }, [id, navigate]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const { data: allCollabsData } = useQuery<{ data: any[] }>({
    queryKey: ["collab-sidebar-list", user?.id],
    queryFn: () => apiFetch("/api/collaborators?limit=500"),
    staleTime: 60_000,
  });

  const allCollabs = allCollabsData?.data ?? [];

  const statusCounts = React.useMemo(() => {
    const now = Date.now();
    let active = 0, inactive = 0, newCollab = 0, unavailable = 0;
    for (const c of allCollabs) {
      const daysAgo = c.hireDate ? (now - new Date(c.hireDate).getTime()) / 86_400_000 : Infinity;
      if (c.employmentStatus !== "active") {
        inactive++;
      } else if (!c.isAvailable) {
        unavailable++;
      } else if (daysAgo < 90) {
        newCollab++;
      } else {
        active++;
      }
    }
    return { active, inactive, new: newCollab, unavailable };
  }, [allCollabs]);

  const sidebarDepts = Array.from(
    new Map(
      allCollabs
        .filter(c => c.departmentId && c.department)
        .map(c => [c.departmentId, c.department as string])
    ).entries()
  ).map(([id, name]) => ({ id, name }));

  const filteredCollabs = React.useMemo(() => allCollabs.filter(c => {
    if (sidebarSearch.trim()) {
      const q = sidebarSearch.toLowerCase();
      const match = [c.firstName, c.lastName, c.position, c.department, c.email]
        .some((v: string | null) => v?.toLowerCase().includes(q));
      if (!match) return false;
    }

    if (sidebarDeptFilter !== "all") {
      if (c.departmentId !== sidebarDeptFilter) return false;
    }

    if (sidebarStatusFilter !== "all") {
      if (sidebarStatusFilter === "inactive") {
        if (c.employmentStatus === "active") return false;
      } else if (sidebarStatusFilter === "unavailable") {
        if (c.isAvailable || c.employmentStatus !== "active") return false;
      } else if (sidebarStatusFilter === "new") {
        if (!c.hireDate) return false;
        const daysAgo = (Date.now() - new Date(c.hireDate).getTime()) / 86_400_000;
        if (daysAgo >= 90 || c.employmentStatus !== "active" || !c.isAvailable) return false;
      } else if (sidebarStatusFilter === "active") {
        if (c.employmentStatus !== "active" || !c.isAvailable) return false;
        if (c.hireDate) {
          const daysAgo = (Date.now() - new Date(c.hireDate).getTime()) / 86_400_000;
          if (daysAgo < 90) return false;
        }
      }
    }

    return true;
  }), [allCollabs, sidebarSearch, sidebarDeptFilter, sidebarStatusFilter]);

  const sortedCollabs = React.useMemo(() => {
    const arr = [...filteredCollabs];
    switch (sidebarSort) {
      case "name_desc":
        return arr.sort((a, b) =>
          `${b.lastName} ${b.firstName}`.localeCompare(`${a.lastName} ${a.firstName}`, "fr"));
      case "hire_desc":
        return arr.sort((a, b) => {
          const da = a.hireDate ? new Date(a.hireDate).getTime() : 0;
          const db2 = b.hireDate ? new Date(b.hireDate).getTime() : 0;
          return db2 - da;
        });
      case "hire_asc":
        return arr.sort((a, b) => {
          const da = a.hireDate ? new Date(a.hireDate).getTime() : Infinity;
          const db2 = b.hireDate ? new Date(b.hireDate).getTime() : Infinity;
          return da - db2;
        });
      case "workload_desc":
        return arr.sort((a, b) => (b.activeTasks || 0) - (a.activeTasks || 0));
      default:
        return arr.sort((a, b) =>
          `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "fr"));
    }
  }, [filteredCollabs, sidebarSort]);

  // ─── Keyboard navigation ──────────────────────────────────────────────────

  // Reset focused index whenever the search query or active filters/sort change
  useEffect(() => { setFocusedIndex(-1); }, [sidebarSearch, sidebarStatusFilter, sidebarDeptFilter, sidebarSort]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex < 0 || !listRef.current) return;
    const focused = listRef.current.querySelector<HTMLElement>(`[data-collab-index="${focusedIndex}"]`);
    if (focused) focused.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusedIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInInput = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable;
      const isInSearchInput = e.target === searchInputRef.current;

      // ArrowDown while search input is focused — transfer keyboard focus to the list (no open)
      if (e.key === "ArrowDown" && isInSearchInput) {
        e.preventDefault();
        setFocusedIndex(prev => (prev < sortedCollabs.length - 1 ? prev + 1 : prev < 0 ? 0 : prev));
        searchInputRef.current?.blur();
        return;
      }

      // ArrowUp while search input is focused — move highlight up without leaving input
      if (e.key === "ArrowUp" && isInSearchInput) {
        e.preventDefault();
        setFocusedIndex(prev => (prev > 0 ? prev - 1 : 0));
        return;
      }

      // Enter while search input is focused — open focused item, or first filtered result
      if (e.key === "Enter" && isInSearchInput) {
        const target = focusedIndex >= 0 ? sortedCollabs[focusedIndex] : sortedCollabs[0];
        if (target) {
          e.preventDefault();
          navigate(`/collaborateurs/${target.id}${searchString ? `?${searchString}` : ""}`);
          searchInputRef.current?.blur();
        }
        return;
      }

      // Arrow keys outside any input — navigate directly between profiles (existing behaviour)
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !isInInput) {
        e.preventDefault();
        const currentIndex = sortedCollabs.findIndex(c => c.id === id);
        let nextIndex: number;
        if (e.key === "ArrowDown") {
          nextIndex = currentIndex < sortedCollabs.length - 1 ? currentIndex + 1 : currentIndex;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : 0;
        }
        const next = sortedCollabs[nextIndex];
        if (next && next.id !== id) {
          navigate(`/collaborateurs/${next.id}${searchString ? `?${searchString}` : ""}`);
        }
        return;
      }

      if (e.key === "Escape" && isInSearchInput) {
        e.preventDefault();
        setSidebarSearch("");
        setFocusedIndex(-1);
        searchInputRef.current?.blur();
        return;
      }

      if ((e.ctrlKey && e.key === "k") || (!isInInput && e.key === "/")) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sortedCollabs, id, navigate, focusedIndex, sidebarSearch, searchString]);

  useEffect(() => {
    if (!id || !listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>(`[data-collab-id="${id}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest", behavior: sortedCollabs.length > 0 ? "auto" : "smooth" });
    }
  }, [id, sortedCollabs]);

  // Kiosk code inline edit
  const [kioskCodeEditing, setKioskCodeEditing] = useState(false);
  const [kioskCodeInput, setKioskCodeInput] = useState("");
  interface QrScan { id: string; kind: string; occurredAt: string; kioskName: string | null; locationLabel: string | null; status: string; }
  interface QrTokenData {
    token: string | null;
    status: string | null;
    expiresAt: string | null;
    lastUsedAt: string | null;
    lastUsedByKioskName: string | null;
    revokedAt: string | null;
    createdAt: string | null;
    recentScans: QrScan[];
  }

  const qrTokenQuery = useQuery<QrTokenData>({
    queryKey: ["collab-qr-token", id],
    queryFn: () => apiFetch(`/api/collaborators/${id}/qr-token`),
    enabled: !!id,
  });

  const generateQrTokenMutation = useMutation({
    mutationFn: () => apiFetch(`/api/collaborators/${id}/qr-token`, { method: "POST" }),
    onSuccess: () => {
      qrTokenQuery.refetch();
      toast.success("Badge QR généré avec succès");
    },
    onError: () => toast.error("Erreur lors de la génération du QR"),
  });

  const toggleQrStatusMutation = useMutation({
    mutationFn: (status: "active" | "disabled") =>
      apiFetch(`/api/collaborators/${id}/qr-token`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_, status) => {
      qrTokenQuery.refetch();
      toast.success(status === "active" ? "Badge QR réactivé" : "Badge QR désactivé temporairement");
    },
    onError: () => toast.error("Erreur lors du changement de statut"),
  });

  const revokeQrTokenMutation = useMutation({
    mutationFn: () => apiFetch(`/api/collaborators/${id}/qr-token`, { method: "DELETE" }),
    onSuccess: () => {
      qrTokenQuery.refetch();
      toast.success("Badge QR révoqué définitivement");
    },
    onError: () => toast.error("Erreur lors de la révocation"),
  });

  type QrPendingAction = "regenerate" | "disable" | "reactivate" | "revoke" | null;
  const [qrPendingAction, setQrPendingAction] = useState<QrPendingAction>(null);

  const confirmQrAction = () => {
    if (qrPendingAction === "regenerate") generateQrTokenMutation.mutate();
    else if (qrPendingAction === "disable") toggleQrStatusMutation.mutate("disabled");
    else if (qrPendingAction === "reactivate") toggleQrStatusMutation.mutate("active");
    else if (qrPendingAction === "revoke") revokeQrTokenMutation.mutate();
    setQrPendingAction(null);
  };

  const kioskCodeMutation = useMutation({
    mutationFn: (code: string | null) =>
      apiFetch(`/api/collaborators/${id}/kiosk-code`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kioskCode: code }),
      }),
    onSuccess: () => {
      toast.success("Code kiosk mis à jour");
      queryClient.invalidateQueries({ queryKey: getGetCollaboratorQueryKey(id) });
      setKioskCodeEditing(false);
    },
    onError: (err: any) => toast.error(err?.message || "Erreur lors de la mise à jour"),
  });

  // ─── Bulletins de paie ────────────────────────────────────────────────────
  const collabUserId = (collaborator as any)?.userId as string | undefined;
  const isOwnProfile = !isManagerOrAbove && collabUserId === user?.id;
  const canSeePayslips = isManagerOrAbove || isOwnProfile;
  const linkedUser = (collaborator as any)?.linkedUser as { id: string; firstName: string | null; lastName: string | null; email: string } | null | undefined;

  const { data: usersListData } = useQuery<{ data: any[] }>({
    queryKey: ["users-list-for-link"],
    queryFn: () => apiFetch("/api/users?limit=200"),
    enabled: linkUserOpen,
  });
  const usersForLink = (usersListData?.data ?? []).filter((u: any) =>
    !userSearch ||
    `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(userSearch.toLowerCase())
  );

  const linkUserMutation = useMutation({
    mutationFn: (userId: string | null) =>
      apiFetch(`/api/collaborators/${id}/link-user`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetCollaboratorQueryKey(id) });
      setLinkUserOpen(false);
      setUserSearch("");
      toast.success(linkedUser ? "Compte utilisateur modifié" : "Compte utilisateur lié avec succès");
    },
    onError: () => toast.error("Erreur lors de la liaison"),
  });

  const currentYear = new Date().getFullYear();
  const [payslipYear, setPayslipYear] = useState<number>(currentYear);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [emailingId, setEmailingId] = useState<string | null>(null);
  const [resendConfirmPayslip, setResendConfirmPayslip] = useState<Payslip | null>(null);
  const [emailLogsSheet, setEmailLogsSheet] = useState<{
    open: boolean;
    payslipId: string | null;
    period: string;
    hasEmail: boolean;
  }>({ open: false, payslipId: null, period: "", hasEmail: true });

  const { data: payslipsData, isLoading: payslipsLoading } = useQuery<Payslip[]>({
    queryKey: ["payslips-collab", id, payslipYear, isManagerOrAbove],
    queryFn: async () => {
      if (isManagerOrAbove) {
        const rows = await apiFetch(`/api/payroll/payslips?collaboratorId=${id}`);
        return rows as Payslip[];
      } else {
        const rows = await apiFetch("/api/hr/me/payslips");
        return rows as Payslip[];
      }
    },
    enabled: !!id && canSeePayslips,
  });

  const payslips = (payslipsData ?? []).filter((p) => p.period.startsWith(String(payslipYear)));
  const availableYears = Array.from(new Set((payslipsData ?? []).map((p) => Number(p.period.split("-")[0])))).sort((a, b) => b - a);

  const handleSendEmail = async (payslip: Payslip) => {
    setEmailingId(payslip.id);
    try {
      await apiFetch(`/api/payroll/payslips/${payslip.id}/send-email`, { method: "POST" });
      toast.success(`Bulletin transmis par email`);
      queryClient.invalidateQueries({ queryKey: ["payslips-collab", id] });
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de l'envoi");
    } finally {
      setEmailingId(null);
      setResendConfirmPayslip(null);
    }
  };

  const handleDownloadPdf = async (payslip: Payslip) => {
    setDownloadingId(payslip.id);
    try {
      const url = isManagerOrAbove
        ? `/api/payroll/payslips/${payslip.id}/pdf`
        : `/api/hr/me/payslips/${payslip.id}/pdf`;
      const name = payslip.collaboratorName
        ? payslip.collaboratorName.replace(/\s+/g, "_")
        : `${(collaborator as any)?.firstName ?? ""}_${(collaborator as any)?.lastName ?? ""}`;
      await downloadPayslipPdf(url, `bulletin_${payslip.period}_${name}.pdf`);
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors du téléchargement");
    } finally {
      setDownloadingId(null);
    }
  };

  const getEditForm = (): EditForm => {
    const c = collaborator as any;
    const ec = c?.emergencyContact as { name?: string; phone?: string; relation?: string } | null;
    return {
      firstName: c?.firstName || "",
      lastName: c?.lastName || "",
      email: c?.email || "",
      phone: c?.phone || "",
      nationalId: c?.nationalId || "",
      birthDate: c?.birthDate ? c.birthDate.substring(0, 10) : "",
      address: c?.address || "",
      employeeNumber: c?.employeeNumber || "",
      departmentId: c?.departmentId || "",
      positionId: c?.positionId || "",
      managerCollaboratorId: c?.managerCollaboratorId || "",
      hireDate: c?.hireDate ? c.hireDate.substring(0, 10) : "",
      employmentStatus: c?.employmentStatus || "active",
      isAvailable: c?.isAvailable !== false,
      baseSalary: c?.baseSalary ? String(c.baseSalary) : "",
      employerChargeRate: c?.employerChargeRate ? String(c.employerChargeRate) : "18.4",
      transportAllowance: c?.transportAllowance ? String(c.transportAllowance) : "0",
      housingAllowance: c?.housingAllowance ? String(c.housingAllowance) : "0",
      mealAllowance: c?.mealAllowance ? String(c.mealAllowance) : "0",
      otherBenefitsMonthly: c?.otherBenefitsMonthly ? String(c.otherBenefitsMonthly) : "0",
      weeklyHours: c?.weeklyHours ? String(c.weeklyHours) : "40",
      ecName: ec?.name || "",
      ecPhone: ec?.phone || "",
      ecRelation: ec?.relation || "",
      avatarUrl: c?.avatarUrl || "",
      bankName: c?.bankName || "",
      bankCode: c?.bankCode || "",
      bankAccountNumber: c?.bankAccountNumber || "",
      professionalEmail: c?.professionalEmail || "",
    };
  };

  if (isLoading || !collaborator) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <Skeleton className="h-10 w-32" />
        <Card><CardContent className="h-40" /></Card>
      </div>
    );
  }

  const wl = overview?.workload;
  const loadColor = (wl?.totalAllocationPct ?? 0) > 100
    ? "[&>div]:bg-red-500"
    : (wl?.totalAllocationPct ?? 0) > 80
    ? "[&>div]:bg-amber-500"
    : "[&>div]:bg-emerald-500";

  return (
    <div className="flex -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 bg-background" style={{ height: "calc(100dvh - 92px)" }}>

      {/* ── Mobile sidebar overlay ─────────────────────────────────── */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── LEFT SIDEBAR ───────────────────────────────────────────── */}
      <aside
        className={`
          fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
          w-72 xl:w-80 shrink-0
          bg-card border-r border-border
          flex flex-col overflow-hidden
          transition-transform duration-200 ease-out lg:transition-none
          ${mobileSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Sidebar header */}
        <div className="px-3 pt-3 pb-2 border-b border-border shrink-0 space-y-2">
          {isManagerOrAbove && (
            <Button size="sm" className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => setAddOpen(true)}>
              <UserPlus className="w-4 h-4" />
              Ajouter un collaborateur
            </Button>
          )}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              ref={searchInputRef}
              placeholder="Rechercher… (/ ou Ctrl+K)"
              value={sidebarSearch}
              onChange={e => setSidebarSearch(e.target.value)}
              className="pl-8 h-8 text-sm bg-muted/40"
            />
            {sidebarSearch && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSidebarSearch("")}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status filter chips */}
          <div className="flex gap-1 overflow-x-auto pb-0.5 no-scrollbar">
            {([ 
              { value: "all", label: "Tous", count: allCollabs.length },
              { value: "active", label: "Actif", count: statusCounts.active },
              { value: "inactive", label: "Inactif", count: statusCounts.inactive },
              { value: "new", label: "Nouveau", count: statusCounts.new },
              { value: "unavailable", label: "Indispo.", count: statusCounts.unavailable },
            ] as const).map(({ value, label, count }) => {
              const isActive = sidebarStatusFilter === value;
              const isEmpty = value !== "all" && count === 0;
              return (
              <button
                key={value}
                onClick={() => setSidebarStatusFilter(value)}
                disabled={isEmpty}
                className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : isEmpty
                    ? "bg-muted/30 text-muted-foreground/40 border-border/40 cursor-not-allowed"
                    : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {label}{value !== "all" ? ` (${count})` : ""}
              </button>
              );
            })}
          </div>

          {/* Department filter */}
          {sidebarDepts.length > 0 && (
            <Select value={sidebarDeptFilter} onValueChange={setSidebarDeptFilter}>
              <SelectTrigger className="h-7 text-xs bg-muted/40 border-border">
                <SelectValue placeholder="Tous les départements" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les départements</SelectItem>
                {sidebarDepts.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Sort selector */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-3 h-3 text-muted-foreground shrink-0" />
            <Select value={sidebarSort} onValueChange={setSidebarSort}>
              <SelectTrigger className="h-7 text-xs bg-muted/40 border-border flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name_asc">Nom A → Z</SelectItem>
                <SelectItem value="name_desc">Nom Z → A</SelectItem>
                <SelectItem value="hire_desc">Embauche : récent → ancien</SelectItem>
                <SelectItem value="hire_asc">Embauche : ancien → récent</SelectItem>
                <SelectItem value="workload_desc">Charge : élevée → faible</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-[11px] text-muted-foreground px-0.5">
            {(sidebarStatusFilter !== "all" || sidebarDeptFilter !== "all" || sidebarSearch.trim() !== "")
              ? <>{filteredCollabs.length} sur {allCollabs.length} collaborateur{allCollabs.length !== 1 ? "s" : ""}</>
              : <>{allCollabs.length} collaborateur{allCollabs.length !== 1 ? "s" : ""}</>
            }
            {(sidebarStatusFilter !== "all" || sidebarDeptFilter !== "all" || sidebarSort !== "name_asc") && (
              <button
                className="ml-2 text-primary hover:underline"
                onClick={() => {
                  localStorage.removeItem(SORT_STORAGE_KEY);
                  navigate(`/collaborateurs/${id}`, { replace: true });
                }}
              >
                Réinitialiser
              </button>
            )}
          </p>
        </div>

        {/* Collaborator list */}
        <div ref={listRef} className="flex-1 overflow-y-auto custom-scrollbar py-1">
          {sortedCollabs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <User className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Aucun résultat</p>
            </div>
          )}
          {sortedCollabs.map((c, idx) => {
            const status = getCollabStatus(c);
            const initials = `${c.firstName?.[0] ?? ""}${c.lastName?.[0] ?? ""}`.toUpperCase();
            const isSelected = c.id === id;
            const isFocused = idx === focusedIndex;
            return (
              <Link key={c.id} href={`/collaborateurs/${c.id}${searchString ? `?${searchString}` : ""}`}>
                <div
                  data-collab-id={c.id}
                  data-collab-index={idx}
                  onClick={() => setMobileSidebarOpen(false)}
                  className={`
                    flex items-start gap-2.5 px-3 py-2.5 cursor-pointer transition-all duration-150
                    ${isSelected
                      ? "bg-primary/5 dark:bg-primary/10 border-l-2 border-primary"
                      : isFocused
                      ? "bg-muted/80 dark:bg-muted/50 border-l-2 border-primary/60"
                      : "hover:bg-muted/60 border-l-2 border-transparent"}
                  `}
                >
                  <Avatar className="w-8 h-8 shrink-0 mt-0.5">
                    {c.avatarUrl && <AvatarImage src={c.avatarUrl} />}
                    <AvatarFallback
                      className="text-xs font-semibold text-white"
                      style={{ backgroundColor: getAvatarColor(c.id) }}
                    >
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-semibold truncate leading-tight ${isSelected ? "text-primary dark:text-primary" : isFocused ? "text-primary dark:text-primary/80" : "text-foreground"}`}>
                      {c.firstName} {c.lastName}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {c.position || c.department || "Poste non renseigné"}
                    </p>
                    {status && (
                      <span className={`inline-block mt-1 text-[10px] font-medium px-1.5 py-px rounded-full leading-tight ${status.className}`}>
                        {status.label}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Keyboard shortcut hints */}
        <div className="px-3 py-2 border-t border-border shrink-0 flex items-center gap-3 text-[10px] text-muted-foreground/60">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-px rounded bg-muted border border-border font-mono">↑</kbd>
            <kbd className="px-1 py-px rounded bg-muted border border-border font-mono">↓</kbd>
            naviguer
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-px rounded bg-muted border border-border font-mono">↵</kbd>
            ouvrir
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-px rounded bg-muted border border-border font-mono">/</kbd>
            rechercher
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-px rounded bg-muted border border-border font-mono">Esc</kbd>
            effacer
          </span>
        </div>
      </aside>

      {/* ── MAIN CONTENT ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">

        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-2 px-4 py-2 border-b border-border bg-card/80 sticky top-0 z-10">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <PanelLeftOpen className="w-3.5 h-3.5" />
            Collaborateurs
          </Button>
          <Link href="/rh">
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground">
              <ArrowLeft className="w-3.5 h-3.5" />
              Équipe & RH
            </Button>
          </Link>
        </div>

        <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in duration-500">
      {/* HEADER BANNER — Gameasu brand navy/blue */}
      <div className="rounded-xl overflow-hidden shadow-sm border border-border/50">
        {/* Banner compact — style profil épuré */}
        <div className="relative bg-[#0F1A3A] px-5 py-4 flex items-center justify-between gap-4 min-h-[88px]">
          {/* Overlay subtle pour texture */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0F1A3A] via-[#132040] to-[#1a2d5a] opacity-80 pointer-events-none" />
          <div className="relative flex items-center gap-4 min-w-0">
            {/* Avatar */}
            <div className="relative shrink-0">
              <Avatar className="w-[68px] h-[68px] border-[3px] border-white shadow-lg ring-1 ring-white/20">
                <AvatarImage src={collaborator.avatarUrl} className="object-cover" />
                <AvatarFallback className="text-2xl bg-[#2563EB] text-white font-bold">
                  {collaborator.firstName[0]}{collaborator.lastName[0]}
                </AvatarFallback>
              </Avatar>
              {isManagerOrAbove && (
                <button
                  onClick={() => setEditOpen(true)}
                  className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center hover:bg-slate-100 transition-colors"
                  title="Modifier la photo"
                >
                  <Camera className="w-2.5 h-2.5 text-slate-600" />
                </button>
              )}
            </div>
            {/* Identité */}
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-white tracking-tight leading-tight truncate">
                {collaborator.firstName} {collaborator.lastName}
              </h1>
              <p className="text-sm text-white/70 mt-0.5 truncate">
                {overview?.position?.title || collaborator.position || "Fonction non définie"}
              </p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {overview?.department && (
                  <span className="text-[11px] text-white/50 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-blue-400/70 inline-block" />
                    {overview.department.name}
                  </span>
                )}
                {(collaborator as any).employeeNumber && (
                  <span className="text-[11px] font-mono text-white/40">
                    #{(collaborator as any).employeeNumber}
                  </span>
                )}
                {overview?.manager && (
                  <span className="text-[11px] text-white/40 hidden sm:inline">
                    · <Link href={`/collaborateurs/${overview.manager.id}`} className="hover:text-white/70 transition-colors">{overview.manager.firstName} {overview.manager.lastName}</Link>
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* Actions droite */}
          <div className="relative flex flex-col items-end gap-1.5 shrink-0">
            {(collaborator as any).contractExpiresInDays != null && (collaborator as any).contractExpiresInDays <= 30 && (
              <Badge className="bg-orange-500/25 text-orange-200 border border-orange-400/40 text-[10px] px-1.5 py-0.5">
                {(collaborator as any).contractExpiresInDays === 0 ? "Expire aujourd'hui" : `Expire dans ${(collaborator as any).contractExpiresInDays}j`}
              </Badge>
            )}
            {(collaborator as any).isAvailable ? (
              <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] px-1.5 py-0.5">Disponible</Badge>
            ) : (
              <Badge className="bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[10px] px-1.5 py-0.5">Affecté</Badge>
            )}
            {isManagerOrAbove && (
              <Button size="sm" onClick={() => setEditOpen(true)}
                className="h-7 text-xs gap-1 bg-white/10 hover:bg-white/20 text-white border border-white/20 mt-0.5">
                <Pencil className="w-3 h-3" />
                Éditer le profil
              </Button>
            )}
          </div>
        </div>

        {/* Bande KPI rapide sous le banner */}
        <div className="grid grid-cols-3 divide-x divide-border bg-card border-t border-border/50">
          {/* Congés disponibles */}
          <div className="px-5 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
              <CalendarClock className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground leading-none">{totalLeaveAvailable}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Jours de congé dispo.</p>
            </div>
          </div>
          {/* Salaire de base */}
          <div className="px-5 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground leading-none">
                {(collaborator as any).baseSalary ? formatFCFA(Number((collaborator as any).baseSalary)) : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Salaire de base</p>
            </div>
          </div>
          {/* Charge de travail */}
          <div className="px-5 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground leading-none">{wl?.totalAllocationPct ?? 0}%</p>
              <p className="text-xs text-muted-foreground mt-0.5">Taux d'allocation</p>
            </div>
          </div>
        </div>
      </div>

      {/* APERÇU — 3 colonnes style Uptimise */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── COL GAUCHE : Congés + Contrat ── */}
        <div className="space-y-5">

          {/* CONGÉS */}
          <Card className="shadow-sm border-border overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/50 pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-primary" /> Congés
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="flex items-end gap-2 mb-5">
                <span className="text-5xl font-bold text-foreground leading-none">{totalLeaveAvailable}</span>
                <div className="pb-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-tight">Jours</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-tight">disponibles</p>
                </div>
              </div>
              {(leaveBalancesData?.data ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Non configuré pour cette année.</p>
              ) : (
                <div className="space-y-2.5 border-t border-border/50 pt-3">
                  {(leaveBalancesData?.data ?? []).map(b => {
                    const avail = Math.max(0, (b.allocated ?? 0) + (b.carried ?? 0) - (b.used ?? 0));
                    return (
                      <div key={b.leaveType} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground text-xs">
                          <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                          {b.leaveType}
                        </span>
                        <span className="font-semibold text-foreground text-sm">{avail} j</span>
                      </div>
                    );
                  })}
                  {(leaveBalancesData?.data ?? []).some(b => (b.carried ?? 0) > 0) && (
                    <p className="text-[10px] text-muted-foreground pt-2 border-t border-border/50">
                      Dont {(leaveBalancesData?.data ?? []).reduce((s, b) => s + (b.carried ?? 0), 0)} j reporté(s)
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* INFORMATIONS CONTRACTUELLES */}
          <Card className="shadow-sm border-border">
            <CardHeader className="bg-muted/30 border-b border-border/50 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSignature className="w-4 h-4" /> Informations contractuelles
                </CardTitle>
                {(() => {
                  const ac = overview?.contracts.find(c => c.status === "active");
                  return ac
                    ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-[10px] font-semibold">Contrat actif</Badge>
                    : overview?.contracts.length
                    ? <Badge variant="outline" className="text-[10px]">Inactif</Badge>
                    : null;
                })()}
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-sm">
              {(() => {
                const ac = overview?.contracts.find(c => c.status === "active") ?? overview?.contracts[0];
                if (!ac) return <p className="text-muted-foreground text-xs py-2 text-center">Aucun contrat enregistré.</p>;
                return (
                  <>
                    <div className="flex items-center gap-2.5">
                      <FileSignature className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-semibold">
                        {ac.type === "cdi" ? "CDI" : ac.type === "cdd" ? "CDD" : ac.type === "freelance" ? "Freelance" : ac.type === "stage" ? "Stage" : ac.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Depuis le {ac.startDate ? new Date(ac.startDate).toLocaleDateString("fr-FR") : "—"}
                        {ac.endDate ? ` → ${new Date(ac.endDate).toLocaleDateString("fr-FR")}` : ""}
                      </span>
                    </div>
                    {ac.jobTitle && (
                      <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                        <Briefcase className="w-3.5 h-3.5 shrink-0" />
                        <span>{ac.jobTitle}</span>
                      </div>
                    )}
                    {overview?.position && (
                      <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                        <BadgeCheck className="w-3.5 h-3.5 shrink-0" />
                        <span>{overview.position.title}</span>
                      </div>
                    )}
                    {overview?.department && (
                      <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Membre de l'équipe <strong className="text-foreground">{overview.department.name}</strong></span>
                      </div>
                    )}
                    {overview?.manager && (
                      <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                        <User className="w-3.5 h-3.5 shrink-0" />
                        <span>Manager : <Link href={`/collaborateurs/${overview.manager.id}`} className="text-primary hover:underline">{overview.manager.firstName} {overview.manager.lastName}</Link></span>
                      </div>
                    )}
                  </>
                );
              })()}
              {canSeePayslips && payslips.length > 0 && (
                <div className="pt-3 border-t border-border/50 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs h-8" onClick={() => handleDownloadPdf(payslips[0])}>
                    <Download className="w-3 h-3" /> Aperçu du bulletin
                  </Button>
                </div>
              )}
              {isAdmin && (
                <div className="pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Keyboard className="w-3 h-3" /> Code kiosk
                    </p>
                    {!kioskCodeEditing && (
                      <button onClick={() => { setKioskCodeInput((collaborator as any).kioskCode || ""); setKioskCodeEditing(true); }} className="text-[10px] text-primary hover:underline">
                        Modifier
                      </button>
                    )}
                  </div>
                  {kioskCodeEditing ? (
                    <div className="flex items-center gap-1.5">
                      <Input value={kioskCodeInput} onChange={e => setKioskCodeInput(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="0000" maxLength={4} className="h-7 text-sm font-mono w-24 px-2" autoFocus />
                      <button onClick={() => kioskCodeMutation.mutate(kioskCodeInput.length === 4 ? kioskCodeInput : null)} disabled={kioskCodeMutation.isPending} className="p-1 rounded hover:bg-emerald-100 text-emerald-600">
                        {kioskCodeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => setKioskCodeEditing(false)} className="p-1 rounded hover:bg-muted text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <p className="font-mono font-bold text-lg tracking-widest text-foreground">
                      {(collaborator as any).kioskCode
                        ? <span className="bg-primary/10 text-primary px-2 py-0.5 rounded">{(collaborator as any).kioskCode}</span>
                        : <span className="text-xs text-muted-foreground font-normal">Non attribué</span>}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── BADGE QR ── */}
          <Card className="shadow-sm border-border">
            <CardHeader className="bg-muted/30 border-b border-border/50 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-primary" />
                    Badge QR — Pointage
                  </CardTitle>
                  <CardDescription>QR code pour pointer au kiosque de présence</CardDescription>
                </div>
                {qrTokenQuery.data?.token && (
                  <button
                    onClick={() => window.open(`/collaborateurs/${id}/badge`, "_blank")}
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Imprimer le badge
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              {qrTokenQuery.isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Chargement…
                </div>
              ) : qrTokenQuery.data?.token ? (
                <>
                  {/* QR code + infos */}
                  <div className="flex gap-4 items-start">
                    <div className={`p-2.5 bg-white border rounded-xl shadow-sm flex-shrink-0 ${qrTokenQuery.data.status !== "active" ? "opacity-40 grayscale" : ""}`}>
                      <QRCodeSVG value={qrTokenQuery.data.token} size={110} level="M" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Status badge */}
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          qrTokenQuery.data.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          qrTokenQuery.data.status === "disabled" ? "bg-amber-50 text-amber-700 border-amber-200" :
                          "bg-red-50 text-red-700 border-red-200"
                        }`}>
                          {qrTokenQuery.data.status === "active" ? "✓ Actif" :
                           qrTokenQuery.data.status === "disabled" ? "⏸ Désactivé" : "✕ Révoqué"}
                        </span>
                      </div>
                      {/* Dates */}
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground">
                          <span className="font-semibold">Généré le :</span> {qrTokenQuery.data.createdAt ? formatDate(qrTokenQuery.data.createdAt) : "—"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          <span className="font-semibold">Dernière utilisation :</span>{" "}
                          {qrTokenQuery.data.lastUsedAt
                            ? `${formatDate(qrTokenQuery.data.lastUsedAt)}${qrTokenQuery.data.lastUsedByKioskName ? ` · ${qrTokenQuery.data.lastUsedByKioskName}` : ""}`
                            : "Jamais utilisé"}
                        </p>
                        {qrTokenQuery.data.revokedAt && (
                          <p className="text-[10px] text-red-500">
                            <span className="font-semibold">Révoqué le :</span> {formatDate(qrTokenQuery.data.revokedAt)}
                          </p>
                        )}
                      </div>
                      {/* Token miniature */}
                      <p className="text-[9px] text-muted-foreground/50 font-mono truncate">{qrTokenQuery.data.token}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setQrPendingAction("regenerate")}
                      disabled={generateQrTokenMutation.isPending}
                      className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-border text-xs font-medium hover:bg-muted/50 transition-colors"
                    >
                      {generateQrTokenMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
                      Régénérer
                    </button>
                    {qrTokenQuery.data.status === "active" ? (
                      <button
                        onClick={() => setQrPendingAction("disable")}
                        disabled={toggleQrStatusMutation.isPending}
                        className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-amber-300 text-amber-700 text-xs font-medium hover:bg-amber-50 transition-colors"
                      >
                        {toggleQrStatusMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>⏸</span>}
                        Désactiver
                      </button>
                    ) : qrTokenQuery.data.status === "disabled" ? (
                      <button
                        onClick={() => setQrPendingAction("reactivate")}
                        disabled={toggleQrStatusMutation.isPending}
                        className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-emerald-300 text-emerald-700 text-xs font-medium hover:bg-emerald-50 transition-colors"
                      >
                        {toggleQrStatusMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>▶</span>}
                        Réactiver
                      </button>
                    ) : null}
                    {qrTokenQuery.data.status !== "revoked" && (
                      <button
                        onClick={() => setQrPendingAction("revoke")}
                        disabled={revokeQrTokenMutation.isPending}
                        className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-destructive/40 text-destructive text-xs font-medium hover:bg-destructive/10 transition-colors"
                      >
                        {revokeQrTokenMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldOff className="w-3 h-3" />}
                        Révoquer
                      </button>
                    )}
                  </div>

                  {/* Confirmation double-clic pour actions critiques */}
                  <AlertDialog open={qrPendingAction !== null} onOpenChange={(open) => { if (!open) setQrPendingAction(null); }}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {qrPendingAction === "regenerate" && "Régénérer le badge QR ?"}
                          {qrPendingAction === "disable" && "Désactiver le badge QR ?"}
                          {qrPendingAction === "reactivate" && "Réactiver le badge QR ?"}
                          {qrPendingAction === "revoke" && "Révoquer définitivement le badge QR ?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {qrPendingAction === "regenerate" && "Un nouveau QR code sera généré. L'ancien sera immédiatement invalide et le collaborateur ne pourra plus pointer avec son badge actuel."}
                          {qrPendingAction === "disable" && "Le badge sera temporairement suspendu. Le collaborateur ne pourra plus pointer jusqu'à réactivation."}
                          {qrPendingAction === "reactivate" && "Le badge redeviendra actif. Le collaborateur pourra à nouveau pointer au kiosque."}
                          {qrPendingAction === "revoke" && "Cette action est irréversible. Le badge sera définitivement révoqué et il faudra en générer un nouveau pour ce collaborateur."}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={confirmQrAction}
                          className={qrPendingAction === "revoke" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : qrPendingAction === "disable" ? "bg-amber-600 text-white hover:bg-amber-700" : ""}
                        >
                          {qrPendingAction === "regenerate" && "Oui, régénérer"}
                          {qrPendingAction === "disable" && "Oui, désactiver"}
                          {qrPendingAction === "reactivate" && "Oui, réactiver"}
                          {qrPendingAction === "revoke" && "Oui, révoquer définitivement"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  {/* Historique des 10 derniers scans QR */}
                  {qrTokenQuery.data.recentScans && qrTokenQuery.data.recentScans.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Derniers pointages QR</p>
                      <div className="rounded-lg border border-border overflow-hidden">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="bg-muted/30 text-muted-foreground">
                              <th className="text-left px-2 py-1.5 font-medium">Type</th>
                              <th className="text-left px-2 py-1.5 font-medium">Date/Heure</th>
                              <th className="text-left px-2 py-1.5 font-medium">Kiosk</th>
                            </tr>
                          </thead>
                          <tbody>
                            {qrTokenQuery.data.recentScans.map((scan) => {
                              const kinds: Record<string, string> = { clock_in: "Entrée", clock_out: "Sortie", break_start: "Pause", break_end: "Fin pause" };
                              return (
                                <tr key={scan.id} className="border-t border-border/50 hover:bg-muted/20">
                                  <td className="px-2 py-1.5 font-medium">{kinds[scan.kind] ?? scan.kind}</td>
                                  <td className="px-2 py-1.5 text-muted-foreground">{scan.occurredAt ? formatDate(scan.occurredAt) : "—"}</td>
                                  <td className="px-2 py-1.5 text-muted-foreground">{scan.kioskName ?? scan.locationLabel ?? "—"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-14 h-14 rounded-xl bg-muted/50 flex items-center justify-center">
                    <QrCode className="w-7 h-7 text-muted-foreground/50" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">Aucun badge QR</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Générez un badge pour permettre le pointage QR au kiosque</p>
                  </div>
                  <button
                    onClick={() => generateQrTokenMutation.mutate()}
                    disabled={generateQrTokenMutation.isPending}
                    className="flex items-center gap-2 py-2.5 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    {generateQrTokenMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                    Générer le badge QR
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── COL CENTRE : Charge + Affectations ── */}
        <div className="space-y-5">

          {/* CHARGE DE TRAVAIL */}
          <Card className="shadow-sm border-border">
            <CardHeader className="bg-muted/30 border-b border-border/50 pb-3">
              <CardTitle className="text-base">Charge de travail</CardTitle>
              <CardDescription>Synthèse opérationnelle</CardDescription>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-muted/30 border border-border p-3 rounded-lg flex items-center gap-2.5">
                  <div className="p-1.5 bg-blue-100 text-blue-600 rounded-md"><Briefcase className="w-4 h-4" /></div>
                  <div><div className="text-[10px] font-bold text-muted-foreground uppercase">Affectations</div><div className="text-xl font-bold">{wl?.activeAssignments ?? 0}</div></div>
                </div>
                <div className="bg-muted/30 border border-border p-3 rounded-lg flex items-center gap-2.5">
                  <div className="p-1.5 bg-amber-100 text-amber-700 rounded-md"><ListTodo className="w-4 h-4" /></div>
                  <div><div className="text-[10px] font-bold text-muted-foreground uppercase">Tâches</div><div className="text-xl font-bold">{wl?.activeTasks ?? 0}</div></div>
                </div>
                <div className="bg-muted/30 border border-border p-3 rounded-lg flex items-center gap-2.5">
                  <div className="p-1.5 bg-violet-100 text-violet-600 rounded-md"><Wrench className="w-4 h-4" /></div>
                  <div><div className="text-[10px] font-bold text-muted-foreground uppercase">Équipements</div><div className="text-xl font-bold">{wl?.responsibleEquipmentsCount ?? 0}</div></div>
                </div>
                <div className="bg-muted/30 border border-border p-3 rounded-lg flex items-center gap-2.5">
                  <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-md"><GitBranch className="w-4 h-4" /></div>
                  <div><div className="text-[10px] font-bold text-muted-foreground uppercase">Projets dirigés</div><div className="text-xl font-bold">{wl?.ledProjectsCount ?? 0}</div></div>
                </div>
              </div>
              <div className="bg-muted/20 border border-border p-3 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Taux d'allocation</span>
                  <span className={`text-base font-bold ${(wl?.totalAllocationPct ?? 0) > 100 ? "text-destructive" : "text-foreground"}`}>{wl?.totalAllocationPct ?? 0}%</span>
                </div>
                <Progress value={Math.min(wl?.totalAllocationPct ?? 0, 100)} className={`h-2 ${loadColor}`} />
                {(wl?.totalAllocationPct ?? 0) > 100 && <p className="text-xs text-destructive mt-1.5">⚠ Surcharge détectée</p>}
              </div>
            </CardContent>
          </Card>

          {/* AFFECTATIONS PROJETS */}
          <Card className="shadow-sm border-border">
            <CardHeader className="bg-muted/30 border-b border-border/50 pb-3">
              <CardTitle className="text-base flex items-center gap-2"><GitBranch className="w-4 h-4" /> Affectations projets</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {overviewLoading ? <Skeleton className="h-16" /> : (overview?.assignments.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground py-5 text-center">Aucune affectation active.<br /><Link href="/rh/affectations" className="text-primary hover:underline text-xs">Créer une affectation</Link></p>
              ) : (
                <div className="space-y-1">
                  {overview!.assignments.map((a) => (
                    <div key={a.id} className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
                      <div className="min-w-0 flex-1 pr-2">
                        <Link href={`/projets/${a.projectId}`} className="text-sm font-medium hover:text-primary truncate block">{a.projectName}</Link>
                        <p className="text-xs text-muted-foreground mt-0.5">{a.role} · <strong>{a.allocationPct}%</strong></p>
                      </div>
                      {statusBadge(a.status)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── COL DROITE : Demandes + Infos perso + Historique ── */}
        <div className="space-y-5">

          {/* DEMANDES À APPROUVER */}
          {isManagerOrAbove && (
            <Card className="shadow-sm border-border">
              <CardHeader className="bg-muted/30 border-b border-border/50 pb-3">
                <CardTitle className="text-base">Demandes à approuver</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {(pendingLeaveReqs ?? []).length === 0 ? (
                  <div className="flex flex-col items-center py-5 gap-2 text-muted-foreground">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                    <p className="text-xs text-center">Aucune demande à approuver</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingLeaveReqs!.map((req: any) => (
                      <div key={req.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                        <div>
                          <p className="text-sm font-medium">{req.leaveType ?? req.type}</p>
                          <p className="text-xs text-muted-foreground">
                            {req.startDate ? new Date(req.startDate).toLocaleDateString("fr-FR") : "—"} → {req.endDate ? new Date(req.endDate).toLocaleDateString("fr-FR") : "—"}
                          </p>
                        </div>
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-[10px] shrink-0">En attente</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* INFORMATIONS PERSONNELLES */}
          <Card className="shadow-sm border-border">
            <CardHeader className="bg-muted/30 border-b border-border/50 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Informations personnelles</CardTitle>
                {isManagerOrAbove && (
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => setEditOpen(true)}>
                    <Pencil className="w-3 h-3" /> Mettre à jour
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <span className="break-all text-xs">{(collaborator as any).professionalEmail || collaborator.email || <span className="text-muted-foreground italic">Email non renseigné</span>}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs">{collaborator.phone || <span className="text-muted-foreground italic">Téléphone non renseigné</span>}</span>
              </div>
              {(collaborator as any).address && (
                <div className="flex items-start gap-2.5">
                  <Home className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-xs">{(collaborator as any).address}</span>
                </div>
              )}
              {(collaborator as any).nationalId && (
                <div className="flex items-center gap-2.5">
                  <BadgeCheck className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-mono">{(collaborator as any).nationalId}</span>
                </div>
              )}
              {isManagerOrAbove && ((collaborator as any).bankName || (collaborator as any).bankAccountNumber) && (
                <div className="pt-2 border-t border-border/50">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Landmark className="w-3 h-3" /> Coordonnées bancaires</p>
                  {(collaborator as any).bankName && <p className="text-xs font-medium">{(collaborator as any).bankName}{(collaborator as any).bankCode && <span className="text-muted-foreground ml-1.5">(code {(collaborator as any).bankCode})</span>}</p>}
                  {(collaborator as any).bankAccountNumber && <p className="text-xs font-mono text-muted-foreground mt-0.5">{(collaborator as any).bankAccountNumber}</p>}
                </div>
              )}
              {isManagerOrAbove && <BankRequestPanel collaboratorId={id} onApproved={() => { queryClient.invalidateQueries({ queryKey: getGetCollaboratorQueryKey(id) }); }} />}
              {(collaborator as any).emergencyContact && (
                <div className="pt-2 border-t border-border/50">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Contact d'urgence</p>
                  <p className="text-xs font-medium">{(collaborator as any).emergencyContact.name}</p>
                  <p className="text-xs text-muted-foreground">{(collaborator as any).emergencyContact.phone} · {(collaborator as any).emergencyContact.relation}</p>
                </div>
              )}

              {/* ─── Compte utilisateur lié ─── */}
              {isManagerOrAbove && (
                <div className="pt-3 border-t border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Link2 className="w-3 h-3" /> Compte utilisateur lié
                    </p>
                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground"
                      onClick={() => { setUserSearch(""); setLinkUserOpen(true); }}>
                      <Pencil className="w-3 h-3" />
                      {linkedUser ? "Modifier" : "Lier"}
                    </Button>
                  </div>
                  {linkedUser ? (
                    <div className="flex items-center gap-2.5 p-2 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0 text-[10px] font-bold text-white">
                        {(linkedUser.firstName?.[0] ?? "") + (linkedUser.lastName?.[0] ?? "")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {linkedUser.firstName} {linkedUser.lastName}
                        </p>
                        <p className="text-[10px] text-primary truncate">{linkedUser.email}</p>
                      </div>
                      <Button size="sm" variant="ghost"
                        className="h-6 w-6 p-0 text-blue-400 hover:text-rose-500 hover:bg-rose-50 shrink-0"
                        title="Délier ce compte"
                        onClick={() => linkUserMutation.mutate(null)}>
                        <UserX className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Aucun compte utilisateur lié — ce collaborateur ne peut pas se connecter à son espace RH.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* DIALOG — Lier un compte utilisateur */}
          <Dialog open={linkUserOpen} onOpenChange={(v) => { if (!v) { setLinkUserOpen(false); setUserSearch(""); } }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Link2 className="w-4 h-4 text-primary" />
                  {linkedUser ? "Changer le compte lié" : "Lier un compte utilisateur"}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Le collaborateur pourra ainsi accéder à son espace RH (bulletins de paie, congés, pointage…).
                </p>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-9 text-sm"
                    placeholder="Rechercher par nom ou email…"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1 rounded-lg border border-border p-1">
                  {usersForLink.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Aucun utilisateur trouvé</p>
                  ) : (
                    usersForLink.map((u: any) => (
                      <button
                        key={u.id}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-primary/5 transition-colors ${linkedUser?.id === u.id ? "bg-primary/5 ring-1 ring-primary/40" : ""}`}
                        onClick={() => linkUserMutation.mutate(u.id)}
                        disabled={linkUserMutation.isPending}
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                          {(u.firstName?.[0] ?? "") + (u.lastName?.[0] ?? "")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {u.firstName} {u.lastName}
                            {linkedUser?.id === u.id && <span className="ml-2 text-xs text-primary font-normal">(actuel)</span>}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                        {linkUserMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
                        ) : linkedUser?.id === u.id ? (
                          <Check className="w-4 h-4 text-primary shrink-0" />
                        ) : null}
                      </button>
                    ))
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => { setLinkUserOpen(false); setUserSearch(""); }}>
                  Annuler
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* HISTORIQUE */}
          <Card className="shadow-sm border-border">
            <CardHeader className="bg-muted/30 border-b border-border/50 pb-3">
              <CardTitle className="text-base">Historique</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4 relative pl-6">
                <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border/60" />
                <div className="relative">
                  <div className="absolute -left-[25px] top-0.5 w-4 h-4 rounded-full bg-primary border-2 border-white shadow-sm" />
                  <p className="text-xs font-semibold text-foreground">Date de début</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(collaborator as any).hireDate
                      ? new Date((collaborator as any).hireDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
                      : formatDate(collaborator.createdAt)}
                  </p>
                </div>
                {overview?.contracts.find(c => c.status === "active") && (
                  <div className="relative">
                    <div className="absolute -left-[25px] top-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-sm" />
                    <p className="text-xs font-semibold text-foreground">Contrat actif signé</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(overview.contracts.find(c => c.status === "active")!.startDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                )}
                {overview?.position && (
                  <div className="relative">
                    <div className="absolute -left-[25px] top-0.5 w-4 h-4 rounded-full bg-blue-400 border-2 border-white shadow-sm" />
                    <p className="text-xs font-semibold text-foreground">Poste actuel</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{overview.position.title}</p>
                  </div>
                )}
                {(collaborator as any).birthDate && (
                  <div className="relative">
                    <div className="absolute -left-[25px] top-0.5 w-4 h-4 rounded-full bg-violet-400 border-2 border-white shadow-sm" />
                    <p className="text-xs font-semibold text-foreground">Date de naissance</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date((collaborator as any).birthDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between">
                <a href={`/rh/mouvements?collaboratorId=${id}`} className="text-xs text-primary hover:underline font-medium">
                  Voir toutes les mutations →
                </a>
                <a href={`/rh/journal-audit?entityId=${id}`} className="text-xs text-muted-foreground hover:underline">
                  Journal d'audit
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* COÛT EMPLOYEUR RÉEL */}
      {isAdmin && (
        <Card className="shadow-sm border-border">
          <CardHeader className="bg-purple-50/60 border-b border-border/50 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-100 rounded-md"><HardHat className="w-4 h-4 text-purple-600" /></div>
                <div>
                  <CardTitle className="text-base text-purple-900">Coût employeur réel</CardTitle>
                  <CardDescription className="text-xs">
                    Calcul sur la base du profil RH — utilisé par le calculateur tarifaire
                    {employerCost && (
                      <span className="ml-2 text-[10px] font-medium bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">
                        Source : {employerCost.salarySource === "profile" ? "Profil" : employerCost.salarySource === "contract" ? "Contrat actif" : "Non défini"}
                      </span>
                    )}
                  </CardDescription>
                </div>
              </div>
              {isManagerOrAbove && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => setEditOpen(true)}>
                  <Pencil className="w-3 h-3" /> Modifier
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            {!employerCost ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
              </div>
            ) : employerCost.salarySource === "none" ? (
              <div className="flex items-center gap-3 py-6 justify-center text-muted-foreground text-sm">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                Aucun salaire défini sur ce profil. Renseignez le salaire brut dans l'onglet Rémunération.
              </div>
            ) : (
              <TooltipProvider>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                  {/* Salaire brut */}
                  <div className="bg-muted/30 border border-border rounded-lg p-3">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1">
                      <DollarSign className="w-3 h-3" /> Salaire brut
                    </div>
                    <div className="text-xl font-bold text-foreground">{formatFCFA(Math.round(employerCost.baseSalary))}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">/mois</div>
                  </div>
                  {/* Charges patronales */}
                  <div className="bg-muted/30 border border-border rounded-lg p-3">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> Charges patronales
                    </div>
                    <div className="text-xl font-bold text-foreground">{employerCost.employerChargeRate}%</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {formatFCFA(Math.round(employerCost.baseSalary * employerCost.employerChargeRate / 100))} FCFA
                    </div>
                  </div>
                  {/* Heures de travail */}
                  <div className="bg-muted/30 border border-border rounded-lg p-3">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Heures/sem.
                      {employerCost.weeklyHoursSource === "default" && (
                        <Tooltip>
                          <TooltipTrigger asChild><InfoIcon className="w-3 h-3 text-amber-400 cursor-help" /></TooltipTrigger>
                          <TooltipContent>Valeur par défaut (40h). Définissez-la dans le profil.</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <div className="text-xl font-bold text-foreground">{employerCost.weeklyHours}h</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{employerCost.monthlyHours} h/mois</div>
                  </div>
                  {/* Avantages totaux */}
                  <div className="bg-muted/30 border border-border rounded-lg p-3">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1">
                      <Gift className="w-3 h-3" /> Avantages/mois
                    </div>
                    <div className="text-xl font-bold text-foreground">{formatFCFA(Math.round(employerCost.totalBenefitsMonthly))}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 flex flex-wrap gap-1">
                      {employerCost.transportAllowance > 0 && <span className="bg-blue-100 text-blue-700 px-1 rounded">Transp. {formatFCFA(Math.round(employerCost.transportAllowance))}</span>}
                      {employerCost.housingAllowance > 0 && <span className="bg-emerald-100 text-emerald-700 px-1 rounded">Log. {formatFCFA(Math.round(employerCost.housingAllowance))}</span>}
                      {employerCost.mealAllowance > 0 && <span className="bg-amber-100 text-amber-700 px-1 rounded">Repas {formatFCFA(Math.round(employerCost.mealAllowance))}</span>}
                      {employerCost.otherBenefitsMonthly > 0 && <span className="bg-purple-100 text-purple-700 px-1 rounded">Autres {formatFCFA(Math.round(employerCost.otherBenefitsMonthly))}</span>}
                      {employerCost.totalBenefitsMonthly === 0 && <span className="text-muted-foreground">Aucun</span>}
                    </div>
                  </div>
                </div>

                {/* KPIs coût réel */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-purple-50 border border-purple-100 rounded-xl p-4">
                  <div className="text-center">
                    <div className="text-[10px] font-bold text-purple-600 uppercase tracking-wide">Coût employeur / mois</div>
                    <div className="text-2xl font-black text-purple-800 mt-1">{formatFCFA(Math.round(employerCost.monthlyCostEmployeur))}</div>
                    <div className="text-[10px] text-purple-500 mt-0.5">charges + avantages inclus</div>
                  </div>
                  <div className="text-center border-l border-purple-200">
                    <div className="text-[10px] font-bold text-purple-600 uppercase tracking-wide flex items-center justify-center gap-1">
                      <Clock className="w-3 h-3" /> Taux horaire réel
                    </div>
                    <div className="text-2xl font-black text-purple-800 mt-1">{formatFCFA(Math.round(employerCost.hourlyRate))}</div>
                    <div className="text-[10px] text-purple-500 mt-0.5">par heure travaillée</div>
                  </div>
                  <div className="text-center border-l border-purple-200">
                    <div className="text-[10px] font-bold text-purple-600 uppercase tracking-wide flex items-center justify-center gap-1">
                      <Calendar className="w-3 h-3" /> Taux journalier (TJM)
                    </div>
                    <div className="text-2xl font-black text-purple-800 mt-1">{formatFCFA(Math.round(employerCost.dailyRate))}</div>
                    <div className="text-[10px] text-purple-500 mt-0.5">base {(employerCost.weeklyHours / 5).toFixed(1)}h/jour</div>
                  </div>
                </div>
              </TooltipProvider>
            )}
          </CardContent>
        </Card>
      )}

      {/* BULLETINS DE PAIE */}
      {canSeePayslips && (
        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Bulletins de paie
              </CardTitle>
              <div className="flex items-center gap-2">
                {availableYears.length > 0 && (
                  <Select
                    value={String(payslipYear)}
                    onValueChange={(v) => setPayslipYear(Number(v))}
                  >
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableYears.map((y) => (
                        <SelectItem key={y} value={String(y)} className="text-xs">
                          {y}
                        </SelectItem>
                      ))}
                      {!availableYears.includes(currentYear) && (
                        <SelectItem value={String(currentYear)} className="text-xs">
                          {currentYear}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {payslipsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : payslips.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Aucun bulletin pour {payslipYear}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="text-left pb-2 pr-4 font-medium">Période</th>
                      <th className="text-right pb-2 pr-4 font-medium">Salaire brut</th>
                      <th className="text-right pb-2 pr-4 font-medium">CNSS salarié</th>
                      <th className="text-right pb-2 pr-4 font-medium">IRPP</th>
                      <th className="text-right pb-2 pr-4 font-medium">Salaire net</th>
                      <th className="text-center pb-2 pr-4 font-medium">Statut</th>
                      <th className="text-right pb-2 pr-4 font-medium">PDF</th>
                      {isManagerOrAbove && <th className="text-center pb-2 font-medium w-[140px]">Email</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {payslips.map((p) => (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-3 pr-4 font-medium">{formatPeriod(p.period)}</td>
                        <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">{formatFCFA(p.grossSalary)}</td>
                        <td className="py-3 pr-4 text-right tabular-nums text-red-600 text-xs">−{formatFCFA(p.cnssEmployee)}</td>
                        <td className="py-3 pr-4 text-right tabular-nums text-red-600 text-xs">−{formatFCFA(p.irpp)}</td>
                        <td className="py-3 pr-4 text-right tabular-nums font-semibold text-emerald-700">{formatFCFA(p.netSalary)}</td>
                        <td className="py-3 pr-4 text-center">
                          <Badge
                            variant="outline"
                            className={`text-xs ${PAYSLIP_STATUS_CLASS[p.status] ?? "bg-muted"}`}
                          >
                            {PAYSLIP_STATUS_LABEL[p.status] ?? p.status}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 gap-1 text-xs hover:bg-primary/10 hover:text-primary"
                            disabled={downloadingId === p.id}
                            onClick={() => handleDownloadPdf(p)}
                          >
                            {downloadingId === p.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Download className="w-3.5 h-3.5" />
                            }
                            PDF
                          </Button>
                        </td>
                        {isManagerOrAbove && (
                          <td className="py-3 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <div className="flex items-center gap-1">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant={p.emailSentAt ? "outline" : "ghost"}
                                        className={`h-7 px-2 text-xs gap-1 ${p.emailSentAt ? "text-emerald-700 border-emerald-200 hover:bg-emerald-50" : ""}`}
                                        disabled={emailingId === p.id}
                                        onClick={() => {
                                          if (p.emailSentAt) {
                                            setResendConfirmPayslip(p);
                                          } else {
                                            handleSendEmail(p);
                                          }
                                        }}
                                      >
                                        {emailingId === p.id
                                          ? <RefreshCw className="w-3 h-3 animate-spin" />
                                          : p.emailSentAt
                                            ? <MailCheck className="w-3 h-3" />
                                            : <Mail className="w-3 h-3" />
                                        }
                                        {p.emailSentAt ? "Renvoi" : "Envoyer"}
                                      </Button>
                                    </TooltipTrigger>
                                    {p.emailSentAt && (
                                      <TooltipContent side="left" className="text-xs">
                                        Envoyé le {new Date(p.emailSentAt).toLocaleDateString("fr-FR")} — cliquer pour renvoyer
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                                        onClick={() => setEmailLogsSheet({
                                          open: true,
                                          payslipId: p.id,
                                          period: p.period,
                                          hasEmail: true,
                                        })}
                                      >
                                        <Clock className="w-3 h-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="text-xs">
                                      Voir l'historique des envois
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              {p.emailSentAt && (
                                <span className="text-[10px] text-emerald-600">
                                  ✓ {new Date(p.emailSentAt).toLocaleDateString("fr-FR")}
                                </span>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* GRILLE BAS — Contrats / Équipements / Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base flex items-center gap-2"><FileSignature className="w-4 h-4" /> Contrats</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-2">
            {(overview?.contracts.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Aucun contrat enregistré.</p>
            ) : overview!.contracts.map((c) => (
              <div key={c.id} className="border border-border rounded p-3">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" className="text-xs">{c.type}</Badge>
                  {statusBadge(c.status)}
                </div>
                <div className="text-sm font-medium">{c.jobTitle || "—"}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Du {new Date(c.startDate).toLocaleDateString("fr-FR")} {c.endDate ? `au ${new Date(c.endDate).toLocaleDateString("fr-FR")}` : "(indéterminée)"}
                </div>
                {c.monthlySalary && <div className="text-sm font-semibold text-primary mt-1">{formatFCFA(c.monthlySalary)}/mois</div>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base flex items-center gap-2"><Wrench className="w-4 h-4" /> Équipements sous responsabilité</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-2">
            {(overview?.equipments.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Aucun équipement à charge.</p>
            ) : overview!.equipments.map((e) => (
              <Link key={e.id} href="/equipements" className="block border border-border rounded p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{e.name}</div>
                    {e.code && <div className="text-xs text-muted-foreground font-mono">{e.code}</div>}
                  </div>
                  {statusBadge(e.status)}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base flex items-center gap-2"><FolderArchive className="w-4 h-4" /> Documents RH</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-2">
            {(overview?.documents.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Aucun document.</p>
            ) : overview!.documents.map((d) => {
              const expired = d.expiresAt && new Date(d.expiresAt) < new Date();
              return (
                <a key={d.id} href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="block border border-border rounded p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium flex items-center gap-1">{d.name} <ExternalLink className="w-3 h-3 text-muted-foreground" /></div>
                      <div className="text-xs text-muted-foreground capitalize">{d.type}</div>
                    </div>
                    {d.expiresAt && <span className={`text-xs ${expired ? "text-destructive font-semibold" : "text-muted-foreground"}`}>{expired ? "Expiré" : `Exp. ${new Date(d.expiresAt).toLocaleDateString("fr-FR")}`}</span>}
                  </div>
                </a>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* PROJETS DIRIGÉS */}
      {(overview?.ledProjects.length ?? 0) > 0 && (
        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base flex items-center gap-2"><FolderKanban className="w-4 h-4" /> Projets dirigés (chef de projet)</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {overview!.ledProjects.map((p) => (
                <Link key={p.id} href={`/projets/${p.id}`} className="border border-border rounded p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{p.name}</span>
                    {statusBadge(p.status)}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* DIALOG CONFIRMATION RENVOI EMAIL */}
      <Dialog open={!!resendConfirmPayslip} onOpenChange={(open) => { if (!open) setResendConfirmPayslip(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MailCheck className="w-5 h-5 text-primary" />
              Renvoyer le bulletin par email
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2 text-sm text-muted-foreground">
            <p>Ce bulletin a déjà été envoyé le <strong className="text-foreground">{resendConfirmPayslip?.emailSentAt ? new Date(resendConfirmPayslip.emailSentAt).toLocaleDateString("fr-FR") : "—"}</strong>.</p>
            <p>Voulez-vous l'envoyer à nouveau à <strong className="text-foreground">{(collaborator as any)?.firstName} {(collaborator as any)?.lastName}</strong> ?</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResendConfirmPayslip(null)}>Annuler</Button>
            <Button
              disabled={emailingId === resendConfirmPayslip?.id}
              onClick={() => resendConfirmPayslip && handleSendEmail(resendConfirmPayslip)}
            >
              {emailingId === resendConfirmPayslip?.id ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <Mail className="w-4 h-4 mr-1.5" />}
              Renvoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FICHE HISTORIQUE EMAILS BULLETIN */}
      <PayslipEmailLogsSheet
        open={emailLogsSheet.open}
        onOpenChange={(open) => setEmailLogsSheet(s => ({ ...s, open }))}
        payslipId={emailLogsSheet.payslipId}
        collaboratorName={`${(collaborator as any)?.firstName ?? ""} ${(collaborator as any)?.lastName ?? ""}`.trim()}
        period={emailLogsSheet.period}
        hasEmail={emailLogsSheet.hasEmail}
        onResent={() => {
          queryClient.invalidateQueries({ queryKey: ["payslips-collab", id] });
        }}
      />

      {/* ADD DIALOG */}
      {isManagerOrAbove && (
        <AddCollaboratorDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onCreated={(newId) => {
            setAddOpen(false);
            navigate(`/collaborateurs/${newId}`);
          }}
        />
      )}

      {/* EDIT DIALOG */}
      {editOpen && isManagerOrAbove && (
        <EditCollaboratorDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          collaboratorId={id}
          initialData={getEditForm()}
          canEditSalary={isAdmin}
        />
      )}
        </div>
      </div>
    </div>
  );
}
