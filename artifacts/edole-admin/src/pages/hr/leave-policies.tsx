import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { HrShell } from "./_layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Settings2, CheckCircle2, Clock, Calendar } from "lucide-react";

type LeavePolicy = {
  id: string; leaveType: string; isActive: boolean;
  minNoticeDays: number; maxDaysPerYear: string | null; carryOverMax: string | null;
  requiresApproval: boolean; allowHalfDay: boolean; accrualRate: string | null;
  defaultAllocatedDays: string; approverRole: string; description: string | null;
};

const LEAVE_TYPES = [
  "congé_payé", "RTT", "maladie", "maternité", "paternité",
  "sans_solde", "formation", "exceptionnel", "autre",
];
const LEAVE_LABELS: Record<string, string> = {
  congé_payé: "Congé payé", RTT: "RTT", maladie: "Maladie",
  maternité: "Maternité", paternité: "Paternité", sans_solde: "Sans solde",
  formation: "Formation", exceptionnel: "Exceptionnel", autre: "Autre",
};

const APPROVER_LABELS: Record<string, string> = {
  auto: "Automatique", manager: "Manager direct",
  hr: "Service RH", manager_then_hr: "Manager → RH",
};

const EMPTY_FORM = {
  leaveType: "congé_payé", isActive: true,
  minNoticeDays: "0", maxDaysPerYear: "", carryOverMax: "",
  requiresApproval: true, allowHalfDay: false,
  accrualRate: "", defaultAllocatedDays: "0", approverRole: "manager", description: "",
};

export default function LeavePoliciesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LeavePolicy | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const { data } = useQuery<{ data: LeavePolicy[] }>({
    queryKey: ["hr-leave-policies"],
    queryFn: () => apiFetch("/api/hr/leave-policies"),
  });

  const saveMut = useMutation({
    mutationFn: () => apiFetch(editing ? `/api/hr/leave-policies/${editing.id}` : "/api/hr/leave-policies", {
      method: editing ? "PUT" : "POST",
      body: JSON.stringify({
        ...form,
        minNoticeDays: Number(form.minNoticeDays),
        maxDaysPerYear: form.maxDaysPerYear ? Number(form.maxDaysPerYear) : null,
        carryOverMax: form.carryOverMax ? Number(form.carryOverMax) : null,
        accrualRate: form.accrualRate ? Number(form.accrualRate) : null,
        defaultAllocatedDays: Number(form.defaultAllocatedDays),
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-leave-policies"] });
      setOpen(false); setEditing(null); setForm({ ...EMPTY_FORM });
      toast({ title: editing ? "Politique mise à jour" : "Politique créée" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/hr/leave-policies/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-leave-policies"] }); toast({ title: "Politique supprimée" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const openEdit = (p: LeavePolicy) => {
    setEditing(p);
    setForm({
      leaveType: p.leaveType, isActive: p.isActive,
      minNoticeDays: String(p.minNoticeDays),
      maxDaysPerYear: p.maxDaysPerYear ?? "", carryOverMax: p.carryOverMax ?? "",
      requiresApproval: p.requiresApproval, allowHalfDay: p.allowHalfDay,
      accrualRate: p.accrualRate ?? "", defaultAllocatedDays: p.defaultAllocatedDays,
      approverRole: p.approverRole ?? "manager", description: p.description ?? "",
    });
    setOpen(true);
  };

  const policies = data?.data ?? [];
  const configured = new Set(policies.map(p => p.leaveType));
  const missing = LEAVE_TYPES.filter(t => !configured.has(t));

  return (
    <HrShell
      title="Politiques de congés"
      subtitle="Règles par type : préavis, plafond, report, acquisition"
      actions={
        <Button onClick={() => { setEditing(null); setForm({ ...EMPTY_FORM }); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />Nouvelle politique
        </Button>
      }
    >
      {missing.length > 0 && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm mb-4 flex items-center gap-2">
          <Settings2 className="w-4 h-4 shrink-0" />
          <span><strong>{missing.length} type{missing.length > 1 ? "s" : ""} sans politique</strong> : {missing.map(t => LEAVE_LABELS[t]).join(", ")}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {policies.map(p => (
          <Card key={p.id} className={`border-l-4 ${p.isActive ? "border-l-emerald-500" : "border-l-slate-300"}`}>
            <CardHeader className="pb-2 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">{LEAVE_LABELS[p.leaveType] ?? p.leaveType}</CardTitle>
                <div className="flex items-center gap-1">
                  <Badge variant={p.isActive ? "default" : "secondary"} className="text-xs">{p.isActive ? "Active" : "Inactive"}</Badge>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openEdit(p)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { if (confirm("Supprimer cette politique ?")) deleteMut.mutate(p.id); }}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-4 space-y-1.5 text-xs">
              <div className="flex flex-wrap gap-2">
                {p.minNoticeDays > 0 && (
                  <div className="flex items-center gap-1 bg-muted rounded px-2 py-1">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span>Préavis : <strong>{p.minNoticeDays} j</strong></span>
                  </div>
                )}
                {p.maxDaysPerYear && (
                  <div className="flex items-center gap-1 bg-muted rounded px-2 py-1">
                    <Calendar className="w-3 h-3 text-muted-foreground" />
                    <span>Plafond : <strong>{p.maxDaysPerYear} j/an</strong></span>
                  </div>
                )}
                {p.carryOverMax && (
                  <div className="flex items-center gap-1 bg-blue-50 rounded px-2 py-1 text-blue-700">
                    <span>Report max : <strong>{p.carryOverMax} j</strong></span>
                  </div>
                )}
                {p.defaultAllocatedDays && Number(p.defaultAllocatedDays) > 0 && (
                  <div className="flex items-center gap-1 bg-emerald-50 rounded px-2 py-1 text-emerald-700">
                    <span>Dotation : <strong>{p.defaultAllocatedDays} j</strong></span>
                  </div>
                )}
                {p.accrualRate && (
                  <div className="flex items-center gap-1 bg-violet-50 rounded px-2 py-1 text-violet-700">
                    <span>Acquisition : <strong>{p.accrualRate} j/mois</strong></span>
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-1 flex-wrap items-center">
                <span className={`flex items-center gap-1 ${p.requiresApproval ? "text-amber-700" : "text-muted-foreground/60"}`}>
                  <CheckCircle2 className="w-3 h-3" />Approbation {p.requiresApproval ? "requise" : "non requise"}
                </span>
                {p.requiresApproval && (
                  <span className="text-[10px] bg-amber-100 text-amber-800 rounded px-1.5 py-0.5 font-medium">
                    {APPROVER_LABELS[p.approverRole ?? "manager"] ?? p.approverRole}
                  </span>
                )}
                {p.allowHalfDay && <span className="text-muted-foreground">½ journée OK</span>}
              </div>
              {p.description && <p className="text-muted-foreground italic pt-1">{p.description}</p>}
            </CardContent>
          </Card>
        ))}

        {/* Cards "à configurer" pour les types manquants */}
        {missing.map(type => (
          <Card key={type} className="border-dashed border-2 border bg-muted/50">
            <CardContent className="p-4 flex flex-col items-center justify-center h-full min-h-[120px] text-center gap-2">
              <Settings2 className="w-6 h-6 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">{LEAVE_LABELS[type]}</p>
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => {
                setEditing(null);
                setForm({ ...EMPTY_FORM, leaveType: type });
                setOpen(true);
              }}>
                <Plus className="w-3 h-3 mr-1" />Configurer
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); setEditing(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier la politique" : "Nouvelle politique de congé"}</DialogTitle>
            <DialogDescription>Définissez les règles applicables pour ce type de congé.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs font-semibold">Type de congé</Label>
              <Select value={form.leaveType} onValueChange={v => setForm(f => ({ ...f, leaveType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LEAVE_TYPES.map(t => <SelectItem key={t} value={t}>{LEAVE_LABELS[t]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Préavis minimum (jours)</Label>
              <Input type="number" min="0" value={form.minNoticeDays} onChange={e => setForm(f => ({ ...f, minNoticeDays: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs font-semibold">Dotation par défaut (j/an)</Label>
              <Input type="number" min="0" step="0.5" value={form.defaultAllocatedDays} onChange={e => setForm(f => ({ ...f, defaultAllocatedDays: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs font-semibold">Plafond annuel (jours, optionnel)</Label>
              <Input type="number" min="0" step="0.5" value={form.maxDaysPerYear} placeholder="Illimité" onChange={e => setForm(f => ({ ...f, maxDaysPerYear: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs font-semibold">Report max N-1 (jours, optionnel)</Label>
              <Input type="number" min="0" step="0.5" value={form.carryOverMax} placeholder="Pas de report" onChange={e => setForm(f => ({ ...f, carryOverMax: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs font-semibold">Acquisition mensuelle (j/mois)</Label>
              <Input type="number" min="0" step="0.01" value={form.accrualRate} placeholder="Ex: 2.5" onChange={e => setForm(f => ({ ...f, accrualRate: e.target.value }))} />
            </div>
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Approbation requise</Label>
                <Switch checked={form.requiresApproval} onCheckedChange={v => setForm(f => ({ ...f, requiresApproval: v }))} />
              </div>
              {form.requiresApproval && (
                <div>
                  <Label className="text-xs font-semibold mb-1 block">Approbateur</Label>
                  <Select value={form.approverRole} onValueChange={v => setForm(f => ({ ...f, approverRole: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(APPROVER_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Demi-journée autorisée</Label>
                <Switch checked={form.allowHalfDay} onCheckedChange={v => setForm(f => ({ ...f, allowHalfDay: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Politique active</Label>
                <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
              </div>
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-semibold">Description / notes internes</Label>
              <Textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Règles particulières, accord d'entreprise…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>Annuler</Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {editing ? "Mettre à jour" : "Créer la politique"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
