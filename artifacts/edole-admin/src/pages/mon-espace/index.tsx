import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useListTasks, useListProjects } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionHelp } from "@/components/ui/section-help";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";
import {
  User, FileText, CalendarDays, Briefcase, FolderArchive, GraduationCap,
  Download, Plus, Clock, CheckCircle2, XCircle, AlertCircle, Banknote,
  MapPin, Phone, Mail, Star, TrendingUp, Award, BookOpen, Calendar,
  ListTodo, FolderKanban, ChevronRight, Circle, CheckSquare, ExternalLink,
  Flame, Timer, Landmark, Send, RefreshCw, MessageSquareWarning,
} from "lucide-react";
import { apiErrorMessage } from "@/lib/api-error";
import { formatDate, formatFCFA } from "@/lib/format";

// ── Types ──────────────────────────────────────────────────────────────────────

type Payslip = {
  id: string; period: string; baseSalary: number; grossSalary: number;
  netSalary: number; cnssEmployee: number; cnssEmployer: number;
  irpp: number; ipts: number; status: string; paidAt: string | null; runStatus: string | null;
};

type Contract = {
  id: string; type: string; status: string; startDate: string; endDate: string | null;
  monthlySalary: number | null; jobTitle: string | null; departmentId: string | null;
  workSchedule: string | null; trialEndDate: string | null;
};

type LeaveRequest = {
  id: string; type: string; startDate: string; endDate: string;
  days: number | string; reason: string | null; status: string; createdAt: string;
  rejectionReason: string | null;
};

type LeaveBalance = {
  year: number;
  byType: Record<string, { taken: number; pending: number; right: number; remaining: number }>;
};

type HrDocument = {
  id: string; kind: string; title: string; fileUrl: string | null;
  expiresAt: string | null; createdAt: string;
};

type Training = {
  sessionId: string; title: string; description: string | null;
  startDate: string | null; endDate: string | null; location: string | null;
  sessionStatus: string; participantStatus: string; score: string | null; certificationDate: string | null;
};

type Evaluation = {
  id: string; period: string; reviewDate: string | null; overallRating: number | null;
  strengths: string | null; improvements: string | null; goals: string | null;
  status: string | null;
};

type Profile = {
  id: string; firstName: string; lastName: string; jobTitle: string | null;
  avatarUrl: string | null; phone: string | null; email: string | null;
  departmentId: string | null; status: string;
  bankName: string | null; bankCode: string | null; bankAccountNumber: string | null;
};

type BankInfoRequest = {
  id: string;
  bankName: string | null;
  bankCode: string | null;
  bankAccountNumber: string | null;
  status: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const LEAVE_TYPE_LABELS: Record<string, string> = {
  congé_payé: "Congé payé", RTT: "RTT", maladie: "Maladie",
  maternité: "Maternité", paternité: "Paternité", sans_solde: "Sans solde",
  formation: "Formation", exceptionnel: "Exceptionnel", autre: "Autre",
};

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  cdi: "CDI", cdd: "CDD", stage: "Stage", prestation: "Prestation",
  mission: "Mission", apprentissage: "Apprentissage",
};

const LEAVE_STATUS_MAP: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pending: { label: "En attente", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: <Clock className="w-3 h-3" /> },
  approved: { label: "Approuvé", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
  rejected: { label: "Refusé", cls: "bg-red-50 text-red-700 border-red-200", icon: <XCircle className="w-3 h-3" /> },
  cancelled: { label: "Annulé", cls: "bg-slate-100 text-slate-500 border-slate-200", icon: <XCircle className="w-3 h-3" /> },
};

const PAYSLIP_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft: { label: "Brouillon", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  validated: { label: "Validé", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  paid: { label: "Payé", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";

function downloadPdf(payslipId: string, period: string) {
  const token = localStorage.getItem("auth_token");
  fetch(`/api/hr/me/payslips/${payslipId}/pdf`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => { if (!r.ok) throw new Error(); return r.blob(); })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bulletin-${period}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    })
    .catch(() => toast.error("Échec du téléchargement"));
}

// ── Nouvelle demande de congé ─────────────────────────────────────────────────

function NewLeaveRequestDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [type, setType] = useState("congé_payé");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const { toast: showToast } = useToast();

  const mutation = useMutation({
    mutationFn: () => apiFetch("/api/hr/me/leave-requests", {
      method: "POST",
      body: { type, startDate, endDate, reason: reason || undefined },
    }),
    onSuccess: () => {
      showToast({ title: "Demande soumise", description: "Votre demande de congé est en attente d'approbation." });
      onSuccess();
      onClose();
    },
    onError: (e: any) => showToast({ title: "Erreur", description: e?.body?.error ?? "Impossible de soumettre la demande", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle demande de congé</DialogTitle>
          <DialogDescription>Renseignez les détails de votre absence.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Type de congé</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(LEAVE_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date de début</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Date de fin</Label>
              <Input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Motif (optionnel)</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Précisez le motif si nécessaire…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
            disabled={!type || !startDate || !endDate || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Envoi…" : "Soumettre"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Onglet : Tableau de bord ──────────────────────────────────────────────────

function DashboardTab({ profile, balance, payslips }: { profile: Profile | null; balance: LeaveBalance | null; payslips: Payslip[] }) {
  const congePayeBalance = balance?.byType["congé_payé"];
  const latestPayslip = payslips[0] ?? null;

  return (
    <div className="space-y-6">
      {/* Accueil personnalisé */}
      <div className="flex items-center gap-4 bg-gradient-to-r from-[#0f172a] to-[#1e293b] rounded-xl p-5 text-white">
        <Avatar className="w-14 h-14 border-2 border-[#2563EB]">
          <AvatarImage src={profile?.avatarUrl ?? undefined} />
          <AvatarFallback className="bg-[#2563EB] text-white font-bold text-lg">
            {profile ? `${profile.firstName[0]}${profile.lastName[0]}` : "?"}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-[#2563EB] text-sm font-medium">Bienvenue,</p>
          <h2 className="text-xl font-bold">{profile ? `${profile.firstName} ${profile.lastName}` : "—"}</h2>
          <p className="text-slate-400 text-sm">{profile?.jobTitle ?? "—"}</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-600">Congés restants</span>
              <CalendarDays className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {congePayeBalance ? congePayeBalance.remaining : "—"}
              <span className="text-base font-normal text-slate-400"> / {congePayeBalance?.right ?? 26} j</span>
            </div>
            {congePayeBalance && (
              <Progress value={(congePayeBalance.taken / congePayeBalance.right) * 100} className="mt-2 h-1.5 bg-slate-100 [&>div]:bg-emerald-500" />
            )}
            <p className="text-xs text-slate-400 mt-1">
              {congePayeBalance ? `${congePayeBalance.taken} j pris • ${congePayeBalance.pending} j en attente` : "Aucune donnée"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-600">Dernier net à payer</span>
              <Banknote className="w-4 h-4 text-[#2563EB]" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {latestPayslip ? fmt(latestPayslip.netSalary) : "—"}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {latestPayslip ? `Période ${latestPayslip.period}` : "Aucun bulletin disponible"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-600">Bulletins disponibles</span>
              <FileText className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{payslips.length}</div>
            <p className="text-xs text-slate-400 mt-1">
              {payslips.length > 0 ? `Dernier : ${payslips[0].period}` : "Aucun bulletin"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Soldes congés rapides */}
      {balance && Object.keys(balance.byType).length > 0 && (
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Soldes de congés {balance.year}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(balance.byType).filter(([, v]) => v.right > 0).map(([type, data]) => (
                <div key={type} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">{LEAVE_TYPE_LABELS[type] ?? type}</p>
                  <p className="text-lg font-bold text-slate-900">{data.remaining} <span className="text-xs font-normal text-slate-400">/ {data.right} j</span></p>
                  <Progress value={data.right > 0 ? (data.taken / data.right) * 100 : 0} className="mt-1 h-1 bg-slate-200 [&>div]:bg-[#2563EB]" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Onglet : Bulletins de paie ────────────────────────────────────────────────

function BulletinsTab({ payslips, loading }: { payslips: Payslip[]; loading: boolean }) {
  if (loading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>;
  if (payslips.length === 0) return (
    <div className="text-center py-16 text-slate-400">
      <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="text-sm">Aucun bulletin de paie disponible pour le moment.</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {payslips.map(p => {
        const st = PAYSLIP_STATUS_MAP[p.status] ?? { label: p.status, cls: "bg-slate-100 text-slate-600 border-slate-200" };
        const [yr, mo] = p.period.split("-");
        const moisFr = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
        const moisLabel = moisFr[parseInt(mo, 10) - 1] ?? mo;
        return (
          <div key={p.id} className="flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-sm transition-all">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#0f172a] flex items-center justify-center">
                <FileText className="w-4 h-4 text-[#2563EB]" />
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-900">{moisLabel} {yr}</p>
                <p className="text-xs text-slate-400">Brut : {fmt(p.grossSalary)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900">{fmt(p.netSalary)}</p>
                <p className="text-xs text-slate-400">Net à payer</p>
              </div>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${st.cls}`}>{st.label}</span>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                onClick={() => downloadPdf(p.id, p.period)}>
                <Download className="w-3 h-3" /> PDF
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Onglet : Congés ───────────────────────────────────────────────────────────

function CongesTab({ leaves, balance, loading, onRefresh }: { leaves: LeaveRequest[]; balance: LeaveBalance | null; loading: boolean; onRefresh: () => void }) {
  const [showNew, setShowNew] = useState(false);
  const qc = useQueryClient();

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/hr/me/leave-requests/${id}/cancel`, { method: "PATCH" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["me-leaves"] }); toast.success("Demande annulée"); },
    onError: (e: any) => toast.error(e?.body?.error ?? "Erreur"),
  });

  if (loading) return <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>;

  return (
    <div className="space-y-6">
      {/* Soldes */}
      {balance && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(balance.byType).filter(([, v]) => v.right > 0).map(([type, data]) => (
            <div key={type} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-xs text-slate-500">{LEAVE_TYPE_LABELS[type] ?? type}</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{data.remaining}<span className="text-xs font-normal text-slate-400"> j restants</span></p>
              <p className="text-xs text-slate-400">{data.taken} pris • {data.pending} en attente</p>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">Mes demandes</h3>
        <Button size="sm" className="h-8 gap-1.5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white" onClick={() => setShowNew(true)}>
          <Plus className="w-3.5 h-3.5" /> Nouvelle demande
        </Button>
      </div>

      {/* Liste */}
      {leaves.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucune demande de congé pour le moment.</p>
          <Button variant="link" size="sm" className="text-[#2563EB] mt-2" onClick={() => setShowNew(true)}>Faire une demande</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {leaves.map(l => {
            const st = LEAVE_STATUS_MAP[l.status] ?? { label: l.status, cls: "bg-slate-100 text-slate-600 border-slate-200", icon: null };
            return (
              <div key={l.id} className="flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-lg hover:shadow-sm transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-10 rounded-full" style={{ backgroundColor: l.status === "approved" ? "#10b981" : l.status === "pending" ? "#f59e0b" : "#94a3b8" }} />
                  <div>
                    <p className="font-semibold text-sm text-slate-900">{LEAVE_TYPE_LABELS[l.type] ?? l.type}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(l.startDate)} → {formatDate(l.endDate)}
                      <span className="ml-2 font-medium">{Number(l.days)} j</span>
                    </p>
                    {l.rejectionReason && (
                      <p className="text-xs text-red-500 mt-0.5">Motif refus : {l.rejectionReason}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${st.cls}`}>
                    {st.icon}{st.label}
                  </span>
                  {l.status === "pending" && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500 hover:bg-red-50"
                      onClick={() => cancelMutation.mutate(l.id)} disabled={cancelMutation.isPending}>
                      Annuler
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNew && <NewLeaveRequestDialog onClose={() => setShowNew(false)} onSuccess={() => { qc.invalidateQueries({ queryKey: ["me-leaves"] }); qc.invalidateQueries({ queryKey: ["me-leave-balance"] }); }} />}
    </div>
  );
}

// ── Onglet : Mon Contrat ──────────────────────────────────────────────────────

function ContratTab({ contract, loading }: { contract: Contract | null; loading: boolean }) {
  if (loading) return <Skeleton className="h-48 rounded-xl" />;
  if (!contract) return (
    <div className="text-center py-16 text-slate-400">
      <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="text-sm">Aucun contrat actif trouvé sur votre profil.</p>
    </div>
  );

  const rows: Array<[string, React.ReactNode]> = [
    ["Type de contrat", <span className="font-semibold">{CONTRACT_TYPE_LABELS[contract.type] ?? contract.type}</span>],
    ["Statut", <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border font-medium text-xs">Actif</Badge>],
    ["Date de début", formatDate(contract.startDate)],
    ["Date de fin", contract.endDate ? formatDate(contract.endDate) : <span className="text-slate-400">Indéterminée (CDI)</span>],
    ["Fin de période d'essai", contract.trialEndDate ? formatDate(contract.trialEndDate) : "—"],
    ["Rémunération mensuelle", contract.monthlySalary ? fmt(contract.monthlySalary) : <span className="text-slate-400">Non renseigné</span>],
    ["Horaires de travail", contract.workSchedule ?? "—"],
  ];

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-[#2563EB]" />
          Votre contrat de travail
        </CardTitle>
        <CardDescription>Les informations de votre contrat actif.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-slate-100">
          {rows.map(([label, value]) => (
            <div key={label} className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-slate-500">{label}</dt>
              <dd className="mt-1 text-sm text-slate-900 sm:mt-0 sm:col-span-2">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

// ── Onglet : Documents ────────────────────────────────────────────────────────

function DocumentsTab({ documents, loading }: { documents: HrDocument[]; loading: boolean }) {
  if (loading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>;
  if (documents.length === 0) return (
    <div className="text-center py-16 text-slate-400">
      <FolderArchive className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="text-sm">Aucun document RH disponible pour le moment.</p>
    </div>
  );

  const KIND_LABELS: Record<string, string> = {
    contrat: "Contrat", avenant: "Avenant", attestation: "Attestation",
    bulletin: "Bulletin", formation: "Formation", evaluation: "Évaluation", autre: "Autre",
  };

  return (
    <div className="space-y-2">
      {documents.map(d => (
        <div key={d.id} className="flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-lg hover:shadow-sm transition-all">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <FolderArchive className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="font-semibold text-sm text-slate-900">{d.title}</p>
              <p className="text-xs text-slate-400">
                {KIND_LABELS[d.kind] ?? d.kind} • Ajouté le {formatDate(d.createdAt)}
                {d.expiresAt && ` • Expire le ${formatDate(d.expiresAt)}`}
              </p>
            </div>
          </div>
          {d.fileUrl && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" asChild>
              <a href={d.fileUrl} target="_blank" rel="noreferrer">
                <Download className="w-3 h-3" /> Ouvrir
              </a>
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Onglet : Formations ───────────────────────────────────────────────────────

function FormationsTab({ trainings, evaluations, loadingT, loadingE }: { trainings: Training[]; evaluations: Evaluation[]; loadingT: boolean; loadingE: boolean }) {
  const PART_STATUS: Record<string, { label: string; cls: string }> = {
    registered: { label: "Inscrit", cls: "bg-slate-100 text-slate-600 border-slate-200" },
    confirmed: { label: "Confirmé", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    attended: { label: "Présent", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    absent: { label: "Absent", cls: "bg-red-50 text-red-700 border-red-200" },
    certified: { label: "Certifié", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  };

  return (
    <div className="space-y-6">
      {/* Formations */}
      <div>
        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#2563EB]" /> Mes formations
        </h3>
        {loadingT ? <Skeleton className="h-24 rounded-lg" /> : trainings.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">Aucune formation enregistrée.</p>
        ) : (
          <div className="space-y-2">
            {trainings.map(t => {
              const st = PART_STATUS[t.participantStatus] ?? { label: t.participantStatus, cls: "bg-slate-100 text-slate-600 border-slate-200" };
              return (
                <div key={t.sessionId} className="flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-lg hover:shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                      <GraduationCap className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-slate-900">{t.title}</p>
                      <p className="text-xs text-slate-400">
                        {t.startDate ? formatDate(t.startDate) : "—"}
                        {t.location && ` • ${t.location}`}
                        {t.score && ` • Score : ${t.score}/100`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.certificationDate && <Award className="w-4 h-4 text-amber-500" aria-label="Certifié" />}
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${st.cls}`}>{st.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Évaluations */}
      <div>
        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Star className="w-4 h-4 text-[#2563EB]" /> Mes évaluations
        </h3>
        {loadingE ? <Skeleton className="h-24 rounded-lg" /> : evaluations.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">Aucune évaluation disponible.</p>
        ) : (
          <div className="space-y-2">
            {evaluations.map(e => (
              <div key={e.id} className="px-4 py-3 bg-white border border-slate-200 rounded-lg hover:shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-slate-900">Période {e.period}</span>
                  {e.overallRating && (
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i < e.overallRating! ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-200"}`} />
                      ))}
                      <span className="text-xs text-slate-500 ml-1">{e.overallRating}/5</span>
                    </div>
                  )}
                </div>
                {e.reviewDate && <p className="text-xs text-slate-400">Entretien : {formatDate(e.reviewDate)}</p>}
                {e.strengths && <p className="text-xs text-slate-500 mt-1">Points forts : {e.strengths}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Onglet : Mes Travaux ───────────────────────────────────────────────────────

const TASK_STATUS_LABELS: Record<string, string> = {
  todo: "À faire", in_progress: "En cours", review: "En révision", done: "Terminé", cancelled: "Annulé",
};
const TASK_PRIORITY_CONFIG: Record<string, { label: string; cls: string }> = {
  urgent: { label: "Urgent", cls: "bg-red-100 text-red-700 border-red-200" },
  high:   { label: "Haute",  cls: "bg-orange-100 text-orange-700 border-orange-200" },
  medium: { label: "Normale", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  low:    { label: "Basse",  cls: "bg-slate-100 text-slate-600 border-slate-200" },
};
const PROJECT_STATUS_LABELS: Record<string, string> = {
  planning: "Planification", active: "Actif", on_hold: "En pause",
  completed: "Terminé", cancelled: "Annulé",
};
function ragFromProject(p: { progress?: number; endDate?: string }): { label: string; cls: string; dot: string } {
  const progress = p.progress ?? 0;
  if (!p.endDate) return { label: "On Track", cls: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" };
  const total = new Date(p.endDate).getTime() - Date.now();
  const elapsed = Date.now() - (Date.now() - total);
  const expectedPct = total <= 0 ? 100 : Math.min(100, (1 - total / (total + elapsed)) * 100);
  const gap = expectedPct - progress;
  if (gap > 20) return { label: "Off Track", cls: "bg-red-100 text-red-700", dot: "bg-red-500" };
  if (gap > 8)  return { label: "At Risk",   cls: "bg-amber-100 text-amber-700", dot: "bg-amber-500" };
  return { label: "On Track", cls: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" };
}

function MesTravauxTab({ userId }: { userId?: string }) {
  const { data: tasksData, isLoading: loadingTasks } = useListTasks();
  const { data: projectsData, isLoading: loadingProjects } = useListProjects();

  const allTasks = tasksData?.data ?? [];
  const myTasks = allTasks.filter(t => t.assigneeId === userId && t.status !== "done" && t.status !== "cancelled");

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(today); endOfWeek.setDate(endOfWeek.getDate() + 7);

  const overdue   = myTasks.filter(t => t.dueDate && new Date(t.dueDate) < today);
  const dueToday  = myTasks.filter(t => t.dueDate && new Date(t.dueDate).toDateString() === today.toDateString());
  const dueWeek   = myTasks.filter(t => t.dueDate && new Date(t.dueDate) > today && new Date(t.dueDate) <= endOfWeek);
  const upcoming  = myTasks.filter(t => !t.dueDate || new Date(t.dueDate) > endOfWeek);

  const allProjects = projectsData?.data ?? [];
  const activeProjects = allProjects.filter(p => p.status === "active");

  const taskSections = [
    { key: "overdue", label: "En retard", icon: <Flame className="w-4 h-4 text-red-500" />, tasks: overdue, emptyMsg: null, accent: "border-l-red-500" },
    { key: "today",   label: "Aujourd'hui", icon: <Timer className="w-4 h-4 text-amber-500" />, tasks: dueToday, emptyMsg: "Aucune tâche due aujourd'hui.", accent: "border-l-amber-500" },
    { key: "week",    label: "Cette semaine", icon: <Calendar className="w-4 h-4 text-blue-500" />, tasks: dueWeek, emptyMsg: "Aucune tâche pour cette semaine.", accent: "border-l-blue-400" },
    { key: "upcoming",label: "À venir / Sans date", icon: <Clock className="w-4 h-4 text-slate-400" />, tasks: upcoming, emptyMsg: "Aucune tâche à venir.", accent: "border-l-slate-200" },
  ];

  return (
    <div className="space-y-8">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "En retard", value: overdue.length, color: "text-red-600", bg: "bg-red-50 border-red-100" },
          { label: "Aujourd'hui", value: dueToday.length, color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
          { label: "Cette semaine", value: dueWeek.length, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
          { label: "Projets actifs", value: activeProjects.length, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border px-4 py-3 ${k.bg}`}>
            <p className="text-xs text-slate-500 mb-0.5">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Mes tâches */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-[#2563EB]" /> Mes tâches
          </h3>
          <Link href="/tasks">
            <a className="text-xs text-[#2563EB] hover:underline flex items-center gap-1">
              Voir toutes <ChevronRight className="w-3 h-3" />
            </a>
          </Link>
        </div>

        {loadingTasks ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : myTasks.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Aucune tâche assignée.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {taskSections.filter(s => s.tasks.length > 0 || (s.key === "today" && !loadingTasks)).map(section => (
              <div key={section.key}>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  {section.icon} {section.label}
                  <span className="ml-1 bg-slate-200 text-slate-600 rounded-full px-1.5 text-[10px]">{section.tasks.length}</span>
                </p>
                {section.tasks.length === 0 ? (
                  section.emptyMsg && <p className="text-xs text-slate-400 pl-5">{section.emptyMsg}</p>
                ) : (
                  <div className="space-y-1.5">
                    {section.tasks.map(task => {
                      const prio = TASK_PRIORITY_CONFIG[task.priority] ?? TASK_PRIORITY_CONFIG.medium;
                      return (
                        <Link key={task.id} href={`/tasks/${task.id}`}>
                          <a className={`flex items-center gap-3 px-4 py-2.5 bg-white border border-l-4 ${section.accent} rounded-lg hover:shadow-sm transition-all group`}>
                            <Circle className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                            <span className="flex-1 text-sm text-slate-800 truncate group-hover:text-[#2563EB] transition-colors">{task.title}</span>
                            {task.dueDate && (
                              <span className={`text-[10px] font-medium ${section.key === "overdue" ? "text-red-500" : "text-slate-400"}`}>
                                {new Date(task.dueDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                              </span>
                            )}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${prio.cls}`}>{prio.label}</span>
                            <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-slate-500 flex-shrink-0" />
                          </a>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mes projets actifs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-[#2563EB]" /> Projets actifs
          </h3>
          <Link href="/projets">
            <a className="text-xs text-[#2563EB] hover:underline flex items-center gap-1">
              Voir tous <ChevronRight className="w-3 h-3" />
            </a>
          </Link>
        </div>

        {loadingProjects ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
        ) : activeProjects.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <FolderKanban className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Aucun projet actif.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeProjects.slice(0, 6).map(project => {
              const rag = ragFromProject(project);
              const prog = project.progress ?? 0;
              return (
                <Link key={project.id} href={`/projets/${project.id}`}>
                  <a className="flex items-center gap-4 px-4 py-3 bg-white border border-slate-200 rounded-lg hover:shadow-sm hover:border-slate-300 transition-all group">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${rag.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-800 truncate group-hover:text-[#2563EB] transition-colors">{project.name}</span>
                        <span className="text-xs text-slate-500 ml-2 flex-shrink-0">{prog}%</span>
                      </div>
                      <Progress value={prog} className="h-1.5 bg-slate-100 [&>div]:bg-[#2563EB]" />
                    </div>
                    <div className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${rag.cls}`}>{rag.label}</div>
                    <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-slate-500 flex-shrink-0" />
                  </a>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Onglet : Profil & Coordonnées bancaires ───────────────────────────────────

const BANK_REQUEST_STATUS: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pending: { label: "En attente de validation", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: <Clock className="w-3 h-3" /> },
  approved: { label: "Approuvé", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
  rejected: { label: "Refusé", cls: "bg-red-50 text-red-700 border-red-200", icon: <XCircle className="w-3 h-3" /> },
  cancelled: { label: "Annulé", cls: "bg-slate-100 text-slate-500 border-slate-200", icon: <XCircle className="w-3 h-3" /> },
};

function ProfilTab({ profile, onRefreshProfile }: { profile: Profile | null; onRefreshProfile: () => void }) {
  const qc = useQueryClient();
  const { toast: showToast } = useToast();
  const [bankName, setBankName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const { data: bankRequest, isLoading: loadingRequest, refetch: refetchRequest } = useQuery<BankInfoRequest | null>({
    queryKey: ["me-bank-request"],
    queryFn: () => apiFetch("/api/hr/me/bank-request"),
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: () => apiFetch("/api/hr/me/bank-request", {
      method: "POST",
      body: { bankName: bankName || undefined, bankCode: bankCode || undefined, bankAccountNumber: bankAccountNumber || undefined },
    }),
    onSuccess: () => {
      showToast({ title: "Demande envoyée", description: "Votre demande est en attente de validation par un manager." });
      setFormOpen(false);
      setBankName(""); setBankCode(""); setBankAccountNumber("");
      qc.invalidateQueries({ queryKey: ["me-bank-request"] });
    },
    onError: (e: any) => showToast({ title: "Erreur", description: e?.body?.error ?? "Impossible de soumettre la demande", variant: "destructive" }),
  });

  const hasCurrent = profile?.bankName || profile?.bankAccountNumber;
  const pendingRequest = bankRequest?.status === "pending" ? bankRequest : null;

  const openForm = () => {
    if (pendingRequest) {
      setBankName(pendingRequest.bankName ?? "");
      setBankCode(pendingRequest.bankCode ?? "");
      setBankAccountNumber(pendingRequest.bankAccountNumber ?? "");
    } else {
      setBankName(profile?.bankName ?? "");
      setBankCode(profile?.bankCode ?? "");
      setBankAccountNumber(profile?.bankAccountNumber ?? "");
    }
    setFormOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Coordonnées bancaires actuelles */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Landmark className="w-4 h-4 text-[#2563EB]" /> Coordonnées bancaires enregistrées
          </CardTitle>
          <CardDescription className="text-xs">
            Ces informations sont utilisées pour le virement de votre salaire.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasCurrent ? (
            <div className="space-y-2 text-sm">
              {profile?.bankName && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Banque</span>
                  <span className="font-medium text-slate-800">
                    {profile.bankName}
                    {profile.bankCode && <span className="text-xs text-slate-400 ml-1.5">(code {profile.bankCode})</span>}
                  </span>
                </div>
              )}
              {profile?.bankAccountNumber && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">N° de compte</span>
                  <span className="font-mono font-medium text-slate-800">{profile.bankAccountNumber}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 py-3 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p className="text-sm">Aucune coordonnée bancaire enregistrée. Soumettez vos informations pour recevoir vos virements.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statut de la dernière demande */}
      {bankRequest && (
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Send className="w-4 h-4 text-slate-500" /> Dernière demande de modification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(() => {
                  const s = BANK_REQUEST_STATUS[bankRequest.status] ?? BANK_REQUEST_STATUS["pending"];
                  return (
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${s.cls}`}>
                      {s.icon} {s.label}
                    </span>
                  );
                })()}
              </div>
              <span className="text-xs text-slate-400">{formatDate(bankRequest.createdAt)}</span>
            </div>
            <div className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-3 space-y-1">
              {bankRequest.bankName && <p><span className="text-slate-400">Banque :</span> <span className="font-medium">{bankRequest.bankName}{bankRequest.bankCode && ` (code ${bankRequest.bankCode})`}</span></p>}
              {bankRequest.bankAccountNumber && <p><span className="text-slate-400">Compte :</span> <span className="font-mono font-medium">{bankRequest.bankAccountNumber}</span></p>}
            </div>
            {bankRequest.status === "rejected" && bankRequest.rejectionReason && (
              <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span><strong>Motif du refus :</strong> {bankRequest.rejectionReason}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bouton soumettre / corriger */}
      <div className="flex justify-end">
        <Button
          onClick={openForm}
          className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white gap-2"
          disabled={pendingRequest !== null}
        >
          <Landmark className="w-4 h-4" />
          {hasCurrent ? "Corriger mes coordonnées bancaires" : "Soumettre mes coordonnées bancaires"}
        </Button>
      </div>
      {pendingRequest && (
        <p className="text-xs text-slate-400 text-right -mt-3">
          Une demande est déjà en attente de validation. Attendez la réponse du manager avant de resoumettre.
        </p>
      )}

      {/* Dialog formulaire */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-[#2563EB]" />
              {hasCurrent ? "Corriger mes coordonnées bancaires" : "Soumettre mes coordonnées bancaires"}
            </DialogTitle>
            <DialogDescription>
              Votre demande sera transmise à un manager pour validation avant d'être appliquée.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="bankName">Nom de la banque</Label>
              <Input
                id="bankName"
                value={bankName}
                onChange={e => setBankName(e.target.value)}
                placeholder="ex : Ecobank, BNP Paribas, UBA"
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bankCode">Code banque BCEAO <span className="text-xs text-slate-400">(3 chiffres)</span></Label>
              <Input
                id="bankCode"
                value={bankCode}
                onChange={e => setBankCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder="ex : 024"
                maxLength={3}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bankAccountNumber">Numéro de compte / IBAN</Label>
              <Input
                id="bankAccountNumber"
                value={bankAccountNumber}
                onChange={e => setBankAccountNumber(e.target.value)}
                placeholder="ex : TG53TG0090604310346500400070"
                maxLength={50}
                className="font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Annuler</Button>
            <Button
              className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
              disabled={(!bankName && !bankCode && !bankAccountNumber) || submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
            >
              {submitMutation.isPending ? "Envoi…" : "Soumettre la demande"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

// ── Onglet : Réclamations RH ──────────────────────────────────────────────────

const CLAIM_CATEGORY_LABELS: Record<string, string> = {
  salaire: "Salaire & Rémunération",
  conges: "Congés & Absences",
  conditions_travail: "Conditions de travail",
  harcelement: "Harcèlement",
  discrimination: "Discrimination",
  securite: "Sécurité",
  avantages: "Avantages sociaux",
  carriere: "Carrière & Évolution",
  remboursement: "Remboursement de frais",
  autre: "Autre",
};

const CLAIM_STATUS: Record<string, { label: string; cls: string }> = {
  brouillon:             { label: "Brouillon",         cls: "bg-slate-100 text-slate-600 border-slate-200" },
  soumise:               { label: "Soumise",           cls: "bg-blue-100 text-blue-700 border-blue-200" },
  en_cours:              { label: "En cours",          cls: "bg-amber-100 text-amber-700 border-amber-200" },
  infos_complementaires: { label: "Infos requises",    cls: "bg-orange-100 text-orange-700 border-orange-200" },
  en_traitement:         { label: "En traitement",     cls: "bg-purple-100 text-purple-700 border-purple-200" },
  resolue:               { label: "Résolue",           cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  refusee:               { label: "Refusée",           cls: "bg-red-100 text-red-700 border-red-200" },
  cloturee:              { label: "Clôturée",          cls: "bg-slate-200 text-slate-700 border-slate-300" },
};

function ReclamationsTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    category: "", subject: "", description: "", priority: "normale", isAnonymous: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["me-claims"],
    queryFn: () => apiFetch<{ data: any[] }>("/api/hr/claims"),
    retry: false,
  });

  const createMut = useMutation({
    mutationFn: (body: object) => apiFetch("/api/hr/claims", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me-claims"] });
      setShowForm(false);
      setForm({ category: "", subject: "", description: "", priority: "normale", isAnonymous: false });
      toast.success("Réclamation soumise avec succès");
    },
    onError: (e: any) => toast.error(apiErrorMessage(e)),
  });

  const claims = data?.data ?? [];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.category || !form.subject || !form.description) {
      toast.error("Catégorie, objet et description sont obligatoires.");
      return;
    }
    createMut.mutate(form);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Mes réclamations</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Suivez l'avancement de vos signalements et réclamations RH.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
          <Plus className="w-4 h-4" /> Nouvelle réclamation
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : claims.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <MessageSquareWarning className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Aucune réclamation soumise</p>
          <p className="text-xs mt-1">Cliquez sur « Nouvelle réclamation » pour soumettre un signalement.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {claims.map((c: any) => {
            const st = CLAIM_STATUS[c.status] ?? { label: c.status, cls: "bg-slate-100 text-slate-600 border-slate-200" };
            return (
              <Link key={c.id} href={`/rh/reclamations/${c.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <MessageSquareWarning className="w-5 h-5 text-slate-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{c.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {CLAIM_CATEGORY_LABELS[c.category] ?? c.category} · {c.reference}
                      </p>
                    </div>
                    <Badge className={`text-xs border font-medium shrink-0 ${st.cls}`}>{st.label}</Badge>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquareWarning className="w-5 h-5 text-amber-500" />
              Nouvelle réclamation
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Catégorie <span className="text-red-500">*</span></Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une catégorie" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CLAIM_CATEGORY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Objet <span className="text-red-500">*</span></Label>
              <Input
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="Résumé de votre réclamation en une ligne"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-red-500">*</span></Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={4}
                placeholder="Décrivez votre situation avec précision : dates, faits, personnes concernées…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Priorité</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="faible">Faible</SelectItem>
                  <SelectItem value="normale">Normale</SelectItem>
                  <SelectItem value="haute">Haute</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="reclam-anon"
                checked={form.isAnonymous}
                onChange={e => setForm(f => ({ ...f, isAnonymous: e.target.checked }))}
                className="rounded border-input w-4 h-4"
              />
              <Label htmlFor="reclam-anon" className="cursor-pointer font-normal text-sm">
                Soumettre de manière anonyme
              </Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending ? "Envoi en cours…" : "Soumettre"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Types Avances ─────────────────────────────────────────────────────────────
type MyAdvance = {
  id: string; requestedAmount: number; approvedAmount?: number;
  remainingAmount?: number; targetPeriod: string; repaymentMode: string;
  repaymentMonths?: number; reason?: string; status: string; createdAt: string;
};
type AdvancePolicy = {
  maxPercentOfSalary: number; maxAbsoluteAmount: number;
  maxRepaymentMonths: number; minTenureMonths: number;
};

const ADVANCE_STATUS: Record<string, { label: string; cls: string }> = {
  draft:            { label: "Brouillon",  cls: "bg-slate-100 text-slate-600 border-slate-200" },
  pending_approval: { label: "En attente", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  approved:         { label: "Approuvée",  cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected:         { label: "Rejetée",    cls: "bg-red-50 text-red-700 border-red-200" },
  disbursed:        { label: "Décaissée",  cls: "bg-blue-50 text-blue-700 border-blue-200" },
  closed:           { label: "Soldée",     cls: "bg-slate-50 text-slate-500 border-slate-200" },
  cancelled:        { label: "Annulée",    cls: "bg-slate-100 text-slate-400 border-slate-200" },
};

function AvancesTab() {
  const qc = useQueryClient();
  const { toast: showToast } = useToast();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    requestedAmount: "", targetPeriod: "", repaymentMode: "single", repaymentMonths: "1", reason: "",
  });
  const currentYM = () => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const { data: advances = [], isLoading } = useQuery<MyAdvance[]>({
    queryKey: ["my-advances"],
    queryFn: () => apiFetch("/api/hr/salary-advances/my"),
    retry: false,
  });

  const { data: policy } = useQuery<AdvancePolicy>({
    queryKey: ["my-advance-policy"],
    queryFn: () => apiFetch("/api/hr/salary-advance-policy"),
    retry: false,
  });

  const createMut = useMutation({
    mutationFn: (data: unknown) => apiFetch("/api/hr/salary-advances", { method: "POST", body: data }),
    onSuccess: () => {
      showToast({ title: "Demande envoyée", description: "Votre demande est en cours de traitement." });
      setShowNew(false);
      setForm({ requestedAmount: "", targetPeriod: "", repaymentMode: "single", repaymentMonths: "1", reason: "" });
      qc.invalidateQueries({ queryKey: ["my-advances"] });
    },
    onError: (e: Error) => showToast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const submitMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/hr/salary-advances/${id}/submit`, { method: "POST" }),
    onSuccess: () => { showToast({ title: "Demande soumise" }); qc.invalidateQueries({ queryKey: ["my-advances"] }); },
    onError: (e: Error) => showToast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const active = advances.filter(a => !["closed", "cancelled"].includes(a.status));
  const history = advances.filter(a => ["closed", "cancelled"].includes(a.status));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Mes avances sur salaire</h2>
          <p className="text-sm text-muted-foreground">Soumettez et suivez vos demandes d'avance</p>
        </div>
        <Button size="sm" onClick={() => { setForm(f => ({ ...f, targetPeriod: currentYM() })); setShowNew(true); }}>
          <Plus className="w-4 h-4 mr-1.5" /> Nouvelle demande
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Chargement…</div>
      ) : advances.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Banknote className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Aucune avance pour le moment</p>
            <Button size="sm" className="mt-4" onClick={() => { setForm(f => ({ ...f, targetPeriod: currentYM() })); setShowNew(true); }}>
              Faire une demande
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {active.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">En cours</p>
              {active.map(a => {
                const s = ADVANCE_STATUS[a.status] ?? { label: a.status, cls: "bg-slate-100 text-slate-600 border-slate-200" };
                return (
                  <Card key={a.id} className="border">
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground">{fmt(a.requestedAmount)}</span>
                          {a.approvedAmount && a.approvedAmount !== a.requestedAmount && (
                            <span className="text-xs text-muted-foreground">(approuvé : {fmt(a.approvedAmount)})</span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${s.cls}`}>{s.label}</span>
                        </div>
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span>Période : {a.targetPeriod}</span>
                          <span>{a.repaymentMode === "single" ? "Prélèvement unique" : `${a.repaymentMonths} mensualité(s)`}</span>
                          {a.remainingAmount != null && a.remainingAmount > 0 && (
                            <span className="text-orange-600 font-medium">Restant : {fmt(a.remainingAmount)}</span>
                          )}
                        </div>
                        {a.reason && <p className="text-xs text-muted-foreground mt-1 truncate">{a.reason}</p>}
                      </div>
                      {a.status === "draft" && (
                        <Button size="sm" variant="outline" onClick={() => submitMut.mutate(a.id)}>
                          <Send className="w-3.5 h-3.5 mr-1.5" /> Soumettre
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          {history.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-4">Historique</p>
              {history.map(a => {
                const s = ADVANCE_STATUS[a.status] ?? { label: a.status, cls: "bg-slate-100 text-slate-600 border-slate-200" };
                return (
                  <Card key={a.id} className="border opacity-70">
                    <CardContent className="p-3 flex items-center justify-between gap-4">
                      <div>
                        <span className="font-medium text-sm">{fmt(a.requestedAmount)}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{a.targetPeriod}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${s.cls}`}>{s.label}</span>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle demande d'avance sur salaire</DialogTitle>
            <DialogDescription>Renseignez les informations de votre demande</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Montant demandé (FCFA)</Label>
                <Input type="number" min={0} placeholder="ex : 150 000"
                  value={form.requestedAmount}
                  onChange={e => setForm(f => ({ ...f, requestedAmount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Période cible (AAAA-MM)</Label>
                <Input placeholder="2026-07"
                  value={form.targetPeriod}
                  onChange={e => setForm(f => ({ ...f, targetPeriod: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Mode de remboursement</Label>
                <Select value={form.repaymentMode} onValueChange={v => setForm(f => ({ ...f, repaymentMode: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Prélèvement unique</SelectItem>
                    <SelectItem value="multi">Mensualités multiples</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.repaymentMode === "multi" && (
                <div className="space-y-1.5">
                  <Label>Nombre de mensualités</Label>
                  <Input type="number" min={2} max={policy?.maxRepaymentMonths ?? 6}
                    value={form.repaymentMonths}
                    onChange={e => setForm(f => ({ ...f, repaymentMonths: e.target.value }))} />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Motif</Label>
              <Textarea placeholder="Décrivez brièvement la raison de votre demande…" rows={3}
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
            </div>
            {policy && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900 space-y-1">
                <p className="font-semibold">Politique en vigueur</p>
                <p>Plafond : {policy.maxPercentOfSalary}% du salaire{policy.maxAbsoluteAmount > 0 ? ` ou ${fmt(policy.maxAbsoluteAmount)} max` : ""}</p>
                <p>Remboursement max : {policy.maxRepaymentMonths} mois · Ancienneté min : {policy.minTenureMonths} mois</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Annuler</Button>
            <Button
              disabled={createMut.isPending || !form.requestedAmount || !form.targetPeriod}
              onClick={() => createMut.mutate({
                requestedAmount: Number(form.requestedAmount),
                targetPeriod: form.targetPeriod,
                repaymentMode: form.repaymentMode,
                repaymentMonths: form.repaymentMode === "multi" ? Number(form.repaymentMonths) : 1,
                reason: form.reason || undefined,
              })}
            >
              {createMut.isPending ? "Envoi…" : "Enregistrer la demande"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function MonEspace() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: profile } = useQuery<Profile>({
    queryKey: ["me-profile"],
    queryFn: () => apiFetch("/api/hr/me/profile"),
    retry: false,
  });

  const { data: payslips = [], isLoading: loadingPayslips } = useQuery<Payslip[]>({
    queryKey: ["me-payslips"],
    queryFn: () => apiFetch("/api/hr/me/payslips"),
    retry: false,
  });

  const { data: balance } = useQuery<LeaveBalance>({
    queryKey: ["me-leave-balance"],
    queryFn: () => apiFetch("/api/hr/me/leave-balance"),
    retry: false,
  });

  const { data: leaves = [], isLoading: loadingLeaves } = useQuery<LeaveRequest[]>({
    queryKey: ["me-leaves"],
    queryFn: () => apiFetch("/api/hr/me/leave-requests"),
    retry: false,
  });

  const { data: contract, isLoading: loadingContract } = useQuery<Contract>({
    queryKey: ["me-contract"],
    queryFn: () => apiFetch("/api/hr/me/contract"),
    retry: false,
  });

  const { data: documents = [], isLoading: loadingDocs } = useQuery<HrDocument[]>({
    queryKey: ["me-documents"],
    queryFn: () => apiFetch("/api/hr/me/documents"),
    retry: false,
  });

  const { data: trainings = [], isLoading: loadingTrainings } = useQuery<Training[]>({
    queryKey: ["me-training"],
    queryFn: () => apiFetch("/api/hr/me/training"),
    retry: false,
  });

  const { data: evaluations = [], isLoading: loadingEvals } = useQuery<Evaluation[]>({
    queryKey: ["me-evaluations"],
    queryFn: () => apiFetch("/api/hr/me/evaluations"),
    retry: false,
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Mon Espace</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">Votre hub personnel : tâches, projets, RH et documents.</p>
      </div>

      <Tabs defaultValue="travaux">
        <TabsList className="grid grid-cols-5 sm:grid-cols-10 h-auto p-1 bg-slate-100 rounded-xl mb-2">
          <TabsTrigger value="travaux" className="flex flex-col items-center gap-1 py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
            <ListTodo className="w-4 h-4" /> Mes Travaux <SectionHelp id="monespace.travaux" side="bottom" />
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="flex flex-col items-center gap-1 py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
            <TrendingUp className="w-4 h-4" /> Tableau RH <SectionHelp id="monespace.dashboard" side="bottom" />
          </TabsTrigger>
          <TabsTrigger value="payslips" className="flex flex-col items-center gap-1 py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
            <FileText className="w-4 h-4" /> Bulletins <SectionHelp id="monespace.payslips" side="bottom" />
          </TabsTrigger>
          <TabsTrigger value="leaves" className="flex flex-col items-center gap-1 py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
            <CalendarDays className="w-4 h-4" /> Congés <SectionHelp id="monespace.leaves" side="bottom" />
          </TabsTrigger>
          <TabsTrigger value="contract" className="flex flex-col items-center gap-1 py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
            <Briefcase className="w-4 h-4" /> Contrat <SectionHelp id="monespace.contract" side="bottom" />
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex flex-col items-center gap-1 py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
            <FolderArchive className="w-4 h-4" /> Documents <SectionHelp id="monespace.documents" side="bottom" />
          </TabsTrigger>
          <TabsTrigger value="training" className="flex flex-col items-center gap-1 py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
            <GraduationCap className="w-4 h-4" /> Formations <SectionHelp id="monespace.training" side="bottom" />
          </TabsTrigger>
          <TabsTrigger value="reclamations" className="flex flex-col items-center gap-1 py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
            <MessageSquareWarning className="w-4 h-4" /> Réclamations <SectionHelp id="monespace.reclamations" side="bottom" />
          </TabsTrigger>
          <TabsTrigger value="profil" className="flex flex-col items-center gap-1 py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
            <Landmark className="w-4 h-4" /> Profil <SectionHelp id="monespace.profil" side="bottom" />
          </TabsTrigger>
          <TabsTrigger value="avances" className="flex flex-col items-center gap-1 py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
            <Banknote className="w-4 h-4" /> Avances
          </TabsTrigger>
        </TabsList>

        <TabsContent value="travaux">
          <MesTravauxTab userId={user?.id} />
        </TabsContent>
        <TabsContent value="dashboard">
          <DashboardTab profile={profile ?? null} balance={balance ?? null} payslips={payslips} />
        </TabsContent>
        <TabsContent value="payslips">
          <BulletinsTab payslips={payslips} loading={loadingPayslips} />
        </TabsContent>
        <TabsContent value="leaves">
          <CongesTab leaves={leaves} balance={balance ?? null} loading={loadingLeaves} onRefresh={() => qc.invalidateQueries({ queryKey: ["me-leaves"] })} />
        </TabsContent>
        <TabsContent value="contract">
          <ContratTab contract={contract ?? null} loading={loadingContract} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsTab documents={documents} loading={loadingDocs} />
        </TabsContent>
        <TabsContent value="training">
          <FormationsTab trainings={trainings} evaluations={evaluations} loadingT={loadingTrainings} loadingE={loadingEvals} />
        </TabsContent>
        <TabsContent value="reclamations">
          <ReclamationsTab />
        </TabsContent>
        <TabsContent value="profil">
          <ProfilTab profile={profile ?? null} onRefreshProfile={() => qc.invalidateQueries({ queryKey: ["me-profile"] })} />
        </TabsContent>
        <TabsContent value="avances">
          <AvancesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
