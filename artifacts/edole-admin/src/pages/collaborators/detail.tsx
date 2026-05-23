import React, { useState, useRef, useCallback } from "react";
import { useGetCollaborator, getGetCollaboratorQueryKey } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useRoute, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  Pencil, Camera, Loader2, Save, User, DollarSign, AlertCircle,
  HardHat, Clock, TrendingUp, Bus, Home, Utensils, Gift, Info as InfoIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatFCFA } from "@/lib/format";
import { toast } from "sonner";

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image trop volumineuse (max 2 Mo)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setAvatarPreview(dataUrl);
      set("avatarUrl", dataUrl);
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
          <div
            className="relative cursor-pointer group"
            onClick={() => avatarInputRef.current?.click()}
          >
            <Avatar className="w-16 h-16 ring-2 ring-border">
              {avatarPreview ? <AvatarImage src={avatarPreview} /> : null}
              <AvatarFallback className="text-xl bg-primary text-primary-foreground font-bold">
                {form.firstName[0]}{form.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-5 h-5 text-white" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{form.firstName} {form.lastName}</p>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="text-xs text-primary hover:underline mt-0.5"
            >
              Changer la photo de profil
            </button>
            {avatarPreview && (
              <button
                type="button"
                onClick={() => { setAvatarPreview(null); set("avatarUrl", ""); }}
                className="text-xs text-destructive hover:underline ml-3 mt-0.5"
              >
                Supprimer
              </button>
            )}
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarFile}
          />
        </div>

        <Tabs defaultValue="identity">
          <TabsList className="grid grid-cols-4 w-full mb-4">
            <TabsTrigger value="identity" className="flex items-center gap-1.5 text-xs">
              <User className="w-3.5 h-3.5" />Identité
            </TabsTrigger>
            <TabsTrigger value="pro" className="flex items-center gap-1.5 text-xs">
              <Briefcase className="w-3.5 h-3.5" />Profil pro
            </TabsTrigger>
            <TabsTrigger value="salary" className="flex items-center gap-1.5 text-xs" disabled={!canEditSalary}>
              <DollarSign className="w-3.5 h-3.5" />Rémunération
            </TabsTrigger>
            <TabsTrigger value="emergency" className="flex items-center gap-1.5 text-xs">
              <AlertCircle className="w-3.5 h-3.5" />Urgence
            </TabsTrigger>
          </TabsList>

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
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={e => set("email", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Téléphone</Label>
                <Input id="phone" value={form.phone} onChange={e => set("phone", e.target.value)} />
              </div>
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
                        Togo : CNSS patronal 16,4% + IPTS 2% = <strong>18,4%</strong>.<br/>
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
                        {v === 18.4 ? "Togo 18,4%" : `${v}%`}
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

          {/* TAB 4 — Contact d'urgence */}
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CollaboratorDetail() {
  const [, params] = useRoute("/collaborators/:id");
  const id = params?.id || "";
  const { user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);

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

  const isManagerOrAbove = ["admin", "super_admin", "manager"].includes(user?.role || "");
  const isAdmin = ["admin", "super_admin"].includes(user?.role || "");

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
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-6">
          <Link href="/collaborators">
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-5">
            <Avatar className="w-20 h-20 border-4 border-background shadow-md">
              <AvatarImage src={collaborator.avatarUrl} />
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground font-bold">
                {collaborator.firstName[0]}{collaborator.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{collaborator.firstName} {collaborator.lastName}</h1>
              <p className="text-sm font-medium text-primary mt-1 uppercase tracking-wider">
                {overview?.position?.title || collaborator.position || "Fonction non définie"}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
                {overview?.department ? (
                  <>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: overview.department.color || "#94a3b8" }} />
                    {overview.department.name}
                  </>
                ) : (collaborator.department || "Département non défini")}
                {overview?.manager && (
                  <> · Manager : <Link href={`/collaborators/${overview.manager.id}`} className="text-primary hover:underline">{overview.manager.firstName} {overview.manager.lastName}</Link></>
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {(collaborator as any).isAvailable ? (
            <Badge className="bg-green-100 text-green-800 border-green-200 text-sm px-4 py-1">Disponible pour affectation</Badge>
          ) : (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-sm px-4 py-1">Actuellement Affecté</Badge>
          )}
          {(collaborator as any).employeeNumber && (
            <Badge variant="outline" className="font-mono text-xs">Matricule {(collaborator as any).employeeNumber}</Badge>
          )}
          {isManagerOrAbove && (
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)} className="gap-1.5 mt-1">
              <Pencil className="w-3.5 h-3.5" />
              Éditer le profil
            </Button>
          )}
        </div>
      </div>

      {/* COLONNES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* COLONNE GAUCHE — INFOS */}
        <Card className="col-span-1 shadow-sm h-fit border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base">Informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5 text-sm">
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Email</p>
                <p className="font-medium mt-0.5 break-all">{collaborator.email || "Non renseigné"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Téléphone</p>
                <p className="font-medium mt-0.5">{collaborator.phone || "Non renseigné"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Date d'embauche</p>
                <p className="font-medium mt-0.5">{(collaborator as any).hireDate ? formatDate((collaborator as any).hireDate) : formatDate(collaborator.createdAt)}</p>
              </div>
            </div>
            {(collaborator as any).baseSalary && (
              <div className="flex items-start gap-3">
                <BadgeCheck className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Salaire de base</p>
                  <p className="font-medium mt-0.5">{formatFCFA(Number((collaborator as any).baseSalary))}</p>
                </div>
              </div>
            )}
            {overview?.position && (
              <div className="flex items-start gap-3">
                <Building2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Poste</p>
                  <p className="font-medium mt-0.5">{overview.position.title}</p>
                </div>
              </div>
            )}
            {/* Infos admin si présentes */}
            {(collaborator as any).nationalId && (
              <div className="flex items-start gap-3">
                <BadgeCheck className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">N° Identité</p>
                  <p className="font-medium mt-0.5 font-mono">{(collaborator as any).nationalId}</p>
                </div>
              </div>
            )}
            {(collaborator as any).address && (
              <div className="flex items-start gap-3">
                <Building2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Adresse</p>
                  <p className="font-medium mt-0.5 text-xs">{(collaborator as any).address}</p>
                </div>
              </div>
            )}
            {(collaborator as any).emergencyContact && (
              <div className="pt-2 border-t border-border/50">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Contact d'urgence</p>
                <p className="text-sm font-medium">{(collaborator as any).emergencyContact.name}</p>
                <p className="text-xs text-muted-foreground">{(collaborator as any).emergencyContact.phone} · {(collaborator as any).emergencyContact.relation}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* COLONNE DROITE — CHARGE + ACTIVITÉ */}
        <div className="col-span-1 md:col-span-2 space-y-6">
          <Card className="shadow-sm border-border">
            <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
              <CardTitle className="text-base">Charge de travail & activité</CardTitle>
              <CardDescription>Synthèse opérationnelle cross-modules</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                <div className="bg-muted/30 border border-border p-3 rounded-lg flex items-center gap-3">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-md"><Briefcase className="w-5 h-5" /></div>
                  <div><div className="text-[10px] font-bold text-muted-foreground uppercase">Affectations</div><div className="text-2xl font-bold">{wl?.activeAssignments ?? 0}</div></div>
                </div>
                <div className="bg-muted/30 border border-border p-3 rounded-lg flex items-center gap-3">
                  <div className="p-2 bg-amber-100 text-amber-700 rounded-md"><ListTodo className="w-5 h-5" /></div>
                  <div><div className="text-[10px] font-bold text-muted-foreground uppercase">Tâches actives</div><div className="text-2xl font-bold">{wl?.activeTasks ?? 0}</div></div>
                </div>
                <div className="bg-muted/30 border border-border p-3 rounded-lg flex items-center gap-3">
                  <div className="p-2 bg-violet-100 text-violet-600 rounded-md"><Wrench className="w-5 h-5" /></div>
                  <div><div className="text-[10px] font-bold text-muted-foreground uppercase">Équipements</div><div className="text-2xl font-bold">{wl?.responsibleEquipmentsCount ?? 0}</div></div>
                </div>
                <div className="bg-muted/30 border border-border p-3 rounded-lg flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-md"><GitBranch className="w-5 h-5" /></div>
                  <div><div className="text-[10px] font-bold text-muted-foreground uppercase">Projets dirigés</div><div className="text-2xl font-bold">{wl?.ledProjectsCount ?? 0}</div></div>
                </div>
              </div>
              <div className="bg-muted/20 border border-border p-4 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Taux d'allocation cumulé</span>
                  <span className={`text-lg font-bold ${(wl?.totalAllocationPct ?? 0) > 100 ? "text-destructive" : "text-foreground"}`}>{wl?.totalAllocationPct ?? 0}%</span>
                </div>
                <Progress value={Math.min(wl?.totalAllocationPct ?? 0, 100)} className={`h-2 ${loadColor}`} />
                {(wl?.totalAllocationPct ?? 0) > 100 && <p className="text-xs text-destructive mt-2">⚠ Surcharge : la somme des allocations dépasse 100%.</p>}
              </div>
            </CardContent>
          </Card>

          {/* AFFECTATIONS */}
          <Card className="shadow-sm border-border">
            <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
              <CardTitle className="text-base flex items-center gap-2"><GitBranch className="w-4 h-4" /> Affectations sur projets</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {overviewLoading ? <Skeleton className="h-20" /> : (overview?.assignments.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Aucune affectation. <Link href="/hr/assignments" className="text-primary hover:underline">Créer une affectation</Link></p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground border-b">
                    <tr><th className="py-2">Projet</th><th>Rôle</th><th className="text-right">Charge</th><th>Période</th><th>Statut</th></tr>
                  </thead>
                  <tbody>
                    {overview!.assignments.map((a) => (
                      <tr key={a.id} className="border-b last:border-0">
                        <td className="py-2.5 font-medium"><Link href={`/projects/${a.projectId}`} className="hover:text-primary">{a.projectName}</Link></td>
                        <td><Badge variant="outline" className="text-xs">{a.role}</Badge></td>
                        <td className="text-right font-semibold">{a.allocationPct}%</td>
                        <td className="text-xs text-muted-foreground">{a.startDate ? new Date(a.startDate).toLocaleDateString("fr-FR") : "—"} → {a.endDate ? new Date(a.endDate).toLocaleDateString("fr-FR") : "…"}</td>
                        <td>{statusBadge(a.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
                <div className="grid grid-cols-3 gap-4 bg-purple-50 border border-purple-100 rounded-xl p-4">
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
              <Link key={e.id} href={`/equipment/${e.id}`} className="block border border-border rounded p-3 hover:bg-muted/30 transition-colors">
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
                <Link key={p.id} href={`/projects/${p.id}`} className="border border-border rounded p-3 hover:bg-muted/30 transition-colors">
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
  );
}
