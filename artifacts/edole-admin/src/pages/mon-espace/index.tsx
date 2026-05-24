import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";
import {
  User, FileText, CalendarDays, Briefcase, FolderArchive, GraduationCap,
  Download, Plus, Clock, CheckCircle2, XCircle, AlertCircle, Banknote,
  MapPin, Phone, Mail, Star, TrendingUp, Award, BookOpen, Calendar,
} from "lucide-react";
import { formatDate } from "@/lib/format";

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
            className="bg-[#C8A24B] hover:bg-[#b8922b] text-white"
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
        <Avatar className="w-14 h-14 border-2 border-[#C8A24B]">
          <AvatarImage src={profile?.avatarUrl ?? undefined} />
          <AvatarFallback className="bg-[#C8A24B] text-white font-bold text-lg">
            {profile ? `${profile.firstName[0]}${profile.lastName[0]}` : "?"}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-[#C8A24B] text-sm font-medium">Bienvenue,</p>
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
              <Banknote className="w-4 h-4 text-[#C8A24B]" />
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
                  <Progress value={data.right > 0 ? (data.taken / data.right) * 100 : 0} className="mt-1 h-1 bg-slate-200 [&>div]:bg-[#C8A24B]" />
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
                <FileText className="w-4 h-4 text-[#C8A24B]" />
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
        <Button size="sm" className="h-8 gap-1.5 bg-[#C8A24B] hover:bg-[#b8922b] text-white" onClick={() => setShowNew(true)}>
          <Plus className="w-3.5 h-3.5" /> Nouvelle demande
        </Button>
      </div>

      {/* Liste */}
      {leaves.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucune demande de congé pour le moment.</p>
          <Button variant="link" size="sm" className="text-[#C8A24B] mt-2" onClick={() => setShowNew(true)}>Faire une demande</Button>
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
          <Briefcase className="w-4 h-4 text-[#C8A24B]" />
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
          <BookOpen className="w-4 h-4 text-[#C8A24B]" /> Mes formations
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
          <Star className="w-4 h-4 text-[#C8A24B]" /> Mes évaluations
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

// ── Page principale ───────────────────────────────────────────────────────────

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
        <p className="text-muted-foreground mt-1.5 text-sm">Vos informations personnelles, bulletins de paie, congés et documents RH.</p>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="grid grid-cols-6 h-auto p-1 bg-slate-100 rounded-xl mb-2">
          <TabsTrigger value="dashboard" className="flex flex-col items-center gap-1 py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
            <TrendingUp className="w-4 h-4" /> Tableau de bord
          </TabsTrigger>
          <TabsTrigger value="payslips" className="flex flex-col items-center gap-1 py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
            <FileText className="w-4 h-4" /> Bulletins
          </TabsTrigger>
          <TabsTrigger value="leaves" className="flex flex-col items-center gap-1 py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
            <CalendarDays className="w-4 h-4" /> Congés
          </TabsTrigger>
          <TabsTrigger value="contract" className="flex flex-col items-center gap-1 py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
            <Briefcase className="w-4 h-4" /> Contrat
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex flex-col items-center gap-1 py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
            <FolderArchive className="w-4 h-4" /> Documents
          </TabsTrigger>
          <TabsTrigger value="training" className="flex flex-col items-center gap-1 py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
            <GraduationCap className="w-4 h-4" /> Formations
          </TabsTrigger>
        </TabsList>

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
      </Tabs>
    </div>
  );
}
