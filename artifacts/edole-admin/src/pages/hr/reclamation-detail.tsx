import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { HrShell } from "./_layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, MessageSquareWarning, CheckCircle2, Clock, AlertTriangle,
  Search, TrendingUp, Loader2, User, Send, Lock, ChevronDown,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  salaire: "Salaire & Rémunération",
  conges: "Congés & Absences",
  conditions_travail: "Conditions de travail",
  harcelement: "Harcèlement",
  discrimination: "Discrimination",
  securite: "Sécurité",
  avantages: "Avantages sociaux",
  carriere: "Carrière & Évolution",
  autre: "Autre",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  brouillon:              { label: "Brouillon",             color: "bg-slate-100 text-slate-600 border-slate-200",    icon: <Clock className="w-3 h-3" /> },
  soumise:                { label: "Soumise",               color: "bg-blue-100 text-blue-700 border-blue-200",       icon: <MessageSquareWarning className="w-3 h-3" /> },
  en_cours:               { label: "En cours d'analyse",   color: "bg-amber-100 text-amber-700 border-amber-200",    icon: <Search className="w-3 h-3" /> },
  infos_complementaires:  { label: "Infos requises",        color: "bg-orange-100 text-orange-700 border-orange-200", icon: <AlertTriangle className="w-3 h-3" /> },
  en_traitement:          { label: "En traitement",         color: "bg-purple-100 text-purple-700 border-purple-200", icon: <TrendingUp className="w-3 h-3" /> },
  resolue:                { label: "Résolue",               color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
  refusee:                { label: "Refusée",               color: "bg-red-100 text-red-700 border-red-200",          icon: <AlertTriangle className="w-3 h-3" /> },
  cloturee:               { label: "Clôturée",              color: "bg-slate-200 text-slate-700 border-slate-300",    icon: <CheckCircle2 className="w-3 h-3" /> },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  faible:   { label: "Faible",   color: "text-slate-500" },
  normale:  { label: "Normale",  color: "text-blue-600" },
  haute:    { label: "Haute",    color: "text-amber-600" },
  urgente:  { label: "Urgente",  color: "text-red-600" },
};

const MANAGER_TRANSITIONS: Record<string, string[]> = {
  soumise:               ["en_cours", "infos_complementaires", "refusee"],
  en_cours:              ["infos_complementaires", "en_traitement", "resolue", "refusee"],
  infos_complementaires: ["en_cours", "en_traitement", "resolue", "refusee"],
  en_traitement:         ["resolue", "refusee"],
  resolue:               ["cloturee"],
  refusee:               ["cloturee"],
};

type ClaimEvent = {
  id: string;
  kind: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  content?: string | null;
  isInternal: boolean;
  createdAt: string;
  authorId?: string | null;
  authorName?: string | null;
};

type ClaimDetail = {
  id: string;
  reference: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  isAnonymous: boolean;
  targetDate?: string | null;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  createdAt: string;
  updatedAt: string;
  collaboratorId?: string;
  collaboratorName?: string;
  assignedToId?: string | null;
  assignedToName?: string | null;
  events: ClaimEvent[];
};

// ─── Main Component ────────────────────────────────────────────────────────────

export default function HrReclamationDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isManager = ["admin", "super_admin", "manager"].includes(user?.role ?? "");

  const [comment, setComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [statusComment, setStatusComment] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");

  const { data: claim, isLoading, error } = useQuery<ClaimDetail>({
    queryKey: ["hr-claim", id],
    queryFn: () => apiFetch(`/api/hr/claims/${id}`),
    staleTime: 15_000,
  });

  const commentMutation = useMutation({
    mutationFn: (data: { content: string; isInternal: boolean }) =>
      apiFetch(`/api/hr/claims/${id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["hr-claim", id] });
    },
    onError: () => toast({ variant: "destructive", title: "Erreur", description: "Impossible d'envoyer le commentaire" }),
  });

  const statusMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiFetch(`/api/hr/claims/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      setNewStatus("");
      setStatusComment("");
      setResolutionNote("");
      toast({ title: "Réclamation mise à jour" });
      queryClient.invalidateQueries({ queryKey: ["hr-claim", id] });
      queryClient.invalidateQueries({ queryKey: ["hr-claims"] });
      queryClient.invalidateQueries({ queryKey: ["hr-claims-stats"] });
    },
    onError: () => toast({ variant: "destructive", title: "Erreur", description: "Impossible de mettre à jour" }),
  });

  if (isLoading) return (
    <HrShell title="Réclamation">
      <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
    </HrShell>
  );

  if (error || !claim) return (
    <HrShell title="Réclamation introuvable">
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="py-12 flex flex-col items-center text-muted-foreground">
          <AlertTriangle className="w-10 h-10 mb-3 opacity-30" />
          <p className="font-medium">Réclamation introuvable</p>
          <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => navigate("/rh/reclamations")}>
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Button>
        </CardContent>
      </Card>
    </HrShell>
  );

  const sc = STATUS_CONFIG[claim.status] ?? STATUS_CONFIG.soumise;
  const pc = PRIORITY_CONFIG[claim.priority] ?? PRIORITY_CONFIG.normale;
  const transitions = isManager ? (MANAGER_TRANSITIONS[claim.status] ?? []) : [];
  const isClosed = ["resolue", "refusee", "cloturee"].includes(claim.status);

  return (
    <HrShell
      title={`Réclamation ${claim.reference}`}
      subtitle={claim.subject}
      actions={
        <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate("/rh/reclamations")}>
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Colonne principale ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* En-tête */}
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-slate-400">{claim.reference}</span>
                    <Badge variant="outline" className={`text-[11px] px-2 border ${sc.color} flex items-center gap-1`}>
                      {sc.icon}{sc.label}
                    </Badge>
                    <span className={`text-xs font-bold ${pc.color}`}>{pc.label}</span>
                    {claim.isAnonymous && (
                      <Badge variant="outline" className="text-[11px] px-2 border-slate-200 text-slate-500">Anonyme</Badge>
                    )}
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mt-2">{claim.subject}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{CATEGORY_LABELS[claim.category] ?? claim.category}</p>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Description</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{claim.description}</p>
              </div>

              {claim.resolutionNote && (
                <>
                  <Separator />
                  <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                    <p className="text-xs font-semibold text-emerald-700 mb-1">Note de résolution</p>
                    <p className="text-sm text-emerald-800 whitespace-pre-wrap">{claim.resolutionNote}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Chronologie des événements */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Chronologie</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              {claim.events.map((ev, idx) => (
                <div key={ev.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      ev.kind === "status_change" ? "bg-primary/10" : "bg-slate-100"
                    }`}>
                      {ev.kind === "status_change" ? (
                        <ChevronDown className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </div>
                    {idx < claim.events.length - 1 && (
                      <div className="w-px bg-slate-200 flex-1 my-1 min-h-[16px]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-700">{ev.authorName ?? "Système"}</span>
                      {ev.isInternal && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0 rounded-full border border-amber-200 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" />Interne
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatDistanceToNow(new Date(ev.createdAt), { addSuffix: true, locale: fr })}
                      </span>
                    </div>
                    {ev.kind === "status_change" && ev.toStatus && (
                      <p className="text-xs mt-0.5 text-slate-500">
                        Statut →{" "}
                        <span className="font-medium text-slate-700">
                          {STATUS_CONFIG[ev.toStatus]?.label ?? ev.toStatus}
                        </span>
                      </p>
                    )}
                    {ev.content && (
                      <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{ev.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {claim.events.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun événement</p>
              )}

              {/* Zone de commentaire */}
              {!isClosed && (
                <div className="pt-2 space-y-2">
                  <Separator />
                  <Textarea
                    placeholder="Ajouter un commentaire…"
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    rows={3}
                    className="resize-none text-sm"
                  />
                  <div className="flex items-center justify-between gap-3">
                    {isManager && (
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isInternal}
                          onChange={e => setIsInternal(e.target.checked)}
                          className="w-3.5 h-3.5 rounded"
                        />
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Lock className="w-3 h-3" />Note interne
                        </span>
                      </label>
                    )}
                    <Button
                      size="sm"
                      className="gap-2 ml-auto"
                      onClick={() => commentMutation.mutate({ content: comment, isInternal })}
                      disabled={!comment.trim() || commentMutation.isPending}
                    >
                      {commentMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Envoyer
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Sidebar droite ── */}
        <div className="space-y-4">

          {/* Informations */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Informations</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Demandeur</p>
                <p className="text-sm font-medium text-slate-800">{claim.collaboratorName ?? "—"}</p>
              </div>
              {claim.assignedToName && (
                <div>
                  <p className="text-xs text-muted-foreground">Responsable RH</p>
                  <p className="text-sm font-medium text-slate-800">{claim.assignedToName}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Date de soumission</p>
                <p className="text-sm font-medium text-slate-800">
                  {format(new Date(claim.createdAt), "d MMMM yyyy", { locale: fr })}
                </p>
              </div>
              {claim.targetDate && (
                <div>
                  <p className="text-xs text-muted-foreground">Date cible</p>
                  <p className="text-sm font-medium text-slate-800">
                    {format(new Date(claim.targetDate), "d MMMM yyyy", { locale: fr })}
                  </p>
                </div>
              )}
              {claim.resolvedAt && (
                <div>
                  <p className="text-xs text-muted-foreground">Résolu le</p>
                  <p className="text-sm font-medium text-emerald-700">
                    {format(new Date(claim.resolvedAt), "d MMMM yyyy", { locale: fr })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions manager */}
          {isManager && !isClosed && transitions.length > 0 && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Changer le statut</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-3">
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Nouveau statut…" />
                  </SelectTrigger>
                  <SelectContent>
                    {transitions.map(s => (
                      <SelectItem key={s} value={s}>
                        {STATUS_CONFIG[s]?.label ?? s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {(newStatus === "resolue" || newStatus === "refusee") && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">{newStatus === "resolue" ? "Note de résolution" : "Motif du refus"}</Label>
                    <Textarea
                      placeholder={newStatus === "resolue" ? "Décrivez la solution apportée…" : "Expliquez le motif du refus…"}
                      value={resolutionNote}
                      onChange={e => setResolutionNote(e.target.value)}
                      rows={3}
                      className="resize-none text-sm"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs">Commentaire (optionnel)</Label>
                  <Textarea
                    placeholder="Note interne ou message pour l'employé…"
                    value={statusComment}
                    onChange={e => setStatusComment(e.target.value)}
                    rows={2}
                    className="resize-none text-sm"
                  />
                </div>

                <Button
                  className="w-full gap-2"
                  size="sm"
                  onClick={() => statusMutation.mutate({
                    status: newStatus,
                    comment: statusComment || undefined,
                    resolutionNote: resolutionNote || undefined,
                    isInternal: false,
                  })}
                  disabled={!newStatus || statusMutation.isPending}
                >
                  {statusMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirmer
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </HrShell>
  );
}
