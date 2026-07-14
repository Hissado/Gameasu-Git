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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, MessageSquareWarning, CheckCircle2, Clock, AlertTriangle,
  Search, TrendingUp, Loader2, User, Send, Lock, ChevronDown, Paperclip,
  FileText, Download, Upload, Eye, EyeOff,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { usePermissions } from "@/lib/permissions";

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
  remboursement: "Remboursement de frais",
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

const STATUS_LABELS: Record<string, string> = {
  soumise:               "Soumise",
  en_cours:              "En cours d'analyse",
  infos_complementaires: "Infos complémentaires demandées",
  en_traitement:         "En traitement",
  resolue:               "Résolue",
  refusee:               "Refusée",
  cloturee:              "Clôturée",
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  faible:   { label: "Faible",   color: "text-slate-500" },
  normale:  { label: "Normale",  color: "text-blue-600" },
  haute:    { label: "Haute",    color: "text-amber-600" },
  urgente:  { label: "Urgente",  color: "text-red-600" },
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

type ClaimAttachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  size?: number | null;
  createdAt: string;
  uploaderName?: string | null;
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
  collaboratorId: string;
  collaboratorName: string;
  assignedToId?: string | null;
  assignedToName?: string | null;
  allowedTransitions: string[];
  events: ClaimEvent[];
  attachments: ClaimAttachment[];
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReclamationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const perms = usePermissions();
  const isManager = perms.has("hr.manage");

  // Comment form
  const [comment, setComment] = useState("");
  const [commentInternal, setCommentInternal] = useState(false);

  // Status change panel
  const [showStatusPanel, setShowStatusPanel] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [statusComment, setStatusComment] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");

  // Attachment upload
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachName, setAttachName] = useState("");

  // ── Queries ───────────────────────────────────────────────────────────────────
  const { data: claim, isLoading } = useQuery<ClaimDetail>({
    queryKey: ["hr-claim", id],
    queryFn: () => apiFetch(`/api/hr/claims/${id}`),
    enabled: !!id,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const commentMutation = useMutation({
    mutationFn: (body: object) =>
      apiFetch(`/api/hr/claims/${id}/events`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-claim", id] });
      setComment("");
      setCommentInternal(false);
      toast({ title: "Commentaire ajouté" });
    },
    onError: () => toast({ title: "Erreur", description: "Impossible d'ajouter le commentaire.", variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: (body: object) =>
      apiFetch(`/api/hr/claims/${id}/status`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-claim", id] });
      qc.invalidateQueries({ queryKey: ["hr-claims"] });
      qc.invalidateQueries({ queryKey: ["hr-claims-stats"] });
      setShowStatusPanel(false);
      setNewStatus("");
      setStatusComment("");
      setResolutionNote("");
      toast({ title: "Statut mis à jour" });
    },
    onError: (e: any) => toast({
      title: "Transition impossible",
      description: e?.message ?? "Vérifiez les transitions autorisées.",
      variant: "destructive",
    }),
  });

  const attachmentMutation = useMutation({
    mutationFn: (body: object) =>
      apiFetch(`/api/hr/claims/${id}/attachments`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-claim", id] });
      setAttachFile(null);
      setAttachName("");
      toast({ title: "Pièce jointe ajoutée" });
    },
    onError: () => toast({ title: "Erreur", description: "Impossible d'ajouter la pièce jointe.", variant: "destructive" }),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────────
  function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    commentMutation.mutate({ content: comment, isInternal: commentInternal });
  }

  function handleStatusChange(e: React.FormEvent) {
    e.preventDefault();
    if (!newStatus) return;
    statusMutation.mutate({
      status: newStatus,
      comment: statusComment || undefined,
      isInternal: false,
      resolutionNote: resolutionNote || undefined,
    });
  }

  function handleAttach(e: React.FormEvent) {
    e.preventDefault();
    if (!attachName.trim()) {
      toast({ title: "Nom de fichier requis", variant: "destructive" });
      return;
    }
    // In a real scenario, this would upload to object storage first.
    // For now we store the URL as the filename (link-based attachment).
    attachmentMutation.mutate({
      fileName: attachName.trim(),
      fileUrl: attachName.trim(),
      mimeType: null,
      size: null,
    });
  }

  function formatFileSize(bytes: number | null | undefined): string {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <HrShell title="Réclamation">
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      </HrShell>
    );
  }

  if (!claim) {
    return (
      <HrShell title="Réclamation">
        <div className="text-center py-16 text-muted-foreground">
          <p>Réclamation introuvable.</p>
          <Button className="mt-4" variant="outline" onClick={() => navigate("/rh/reclamations")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour
          </Button>
        </div>
      </HrShell>
    );
  }

  const st = STATUS_CONFIG[claim.status] ?? STATUS_CONFIG.soumise;
  const pr = PRIORITY_CONFIG[claim.priority] ?? PRIORITY_CONFIG.normale;

  return (
    <HrShell title={`Réclamation ${claim.reference}`}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left column: main info + timeline ─────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/rh/reclamations")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Retour
            </Button>
          </div>

          {/* Main card */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`${st.color} flex items-center gap-1`}>
                      {st.icon} {st.label}
                    </Badge>
                    <span className={`text-sm font-medium ${pr.color}`}>{pr.label}</span>
                    {claim.isAnonymous && <Badge variant="secondary">Anonyme</Badge>}
                    <span className="text-xs font-mono text-muted-foreground">{claim.reference}</span>
                  </div>
                  <h2 className="text-xl font-semibold mt-2">{claim.subject}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {CATEGORY_LABELS[claim.category] ?? claim.category}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="text-sm whitespace-pre-wrap text-foreground/90">{claim.description}</div>

              {claim.resolutionNote && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
                  <p className="font-medium text-emerald-800 mb-1">Note de résolution</p>
                  <p className="text-emerald-700">{claim.resolutionNote}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                {isManager && (
                  <div><User className="w-3 h-3 inline mr-1" />Collaborateur : <span className="text-foreground">{claim.collaboratorName}</span></div>
                )}
                {claim.assignedToName && (
                  <div>Assignée à : <span className="text-foreground">{claim.assignedToName}</span></div>
                )}
                <div>Créée : <span className="text-foreground">{format(new Date(claim.createdAt), "dd/MM/yyyy HH:mm", { locale: fr })}</span></div>
                {claim.resolvedAt && (
                  <div>Résolue : <span className="text-foreground">{format(new Date(claim.resolvedAt), "dd/MM/yyyy", { locale: fr })}</span></div>
                )}
                {claim.targetDate && (
                  <div>Date cible : <span className="text-foreground">{format(new Date(claim.targetDate), "dd/MM/yyyy", { locale: fr })}</span></div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Attachments */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Paperclip className="w-4 h-4" /> Pièces jointes ({claim.attachments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {claim.attachments.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">Aucune pièce jointe.</p>
              )}
              {claim.attachments.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-2 rounded border bg-slate-50">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.uploaderName && <span>{a.uploaderName} · </span>}
                      {format(new Date(a.createdAt), "dd/MM/yyyy", { locale: fr })}
                      {a.size && <span> · {formatFileSize(a.size)}</span>}
                    </p>
                  </div>
                  <a href={a.fileUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm"><Download className="w-4 h-4" /></Button>
                  </a>
                </div>
              ))}

              {/* Add attachment (simple name/URL for now) */}
              {!["cloturee", "resolue", "refusee"].includes(claim.status) && (
                <form onSubmit={handleAttach} className="flex gap-2 pt-2">
                  <Input
                    placeholder="Nom ou URL de la pièce jointe"
                    value={attachName}
                    onChange={e => setAttachName(e.target.value)}
                    className="flex-1 text-sm"
                  />
                  <Button type="submit" size="sm" disabled={attachmentMutation.isPending || !attachName.trim()}>
                    {attachmentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Historique</CardTitle>
            </CardHeader>
            <CardContent>
              {claim.events.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">Aucun événement.</p>
              )}
              <div className="space-y-3">
                {claim.events.map((ev) => (
                  <div key={ev.id} className={`flex gap-3 ${ev.isInternal ? "opacity-70" : ""}`}>
                    <div className="flex flex-col items-center">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        ev.kind === "status_change" ? "bg-orange-400" :
                        ev.kind === "attachment" ? "bg-blue-400" : "bg-slate-300"
                      }`} />
                      <div className="w-px flex-1 bg-border" />
                    </div>
                    <div className="pb-3 flex-1 min-w-0">
                      {ev.kind === "status_change" ? (
                        <p className="text-sm">
                          <span className="font-medium">{ev.authorName ?? "Système"}</span>
                          {" "}a changé le statut de{" "}
                          <Badge variant="outline" className="text-xs">{STATUS_LABELS[ev.fromStatus ?? ""] ?? ev.fromStatus}</Badge>
                          {" → "}
                          <Badge variant="outline" className="text-xs">{STATUS_LABELS[ev.toStatus ?? ""] ?? ev.toStatus}</Badge>
                        </p>
                      ) : ev.kind === "attachment" ? (
                        <p className="text-sm">
                          <span className="font-medium">{ev.authorName ?? "Système"}</span>{" "}
                          <Paperclip className="w-3 h-3 inline text-blue-500" /> {ev.content}
                        </p>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{ev.authorName ?? "Système"}</span>
                            {ev.isInternal && (
                              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" /> Interne
                              </Badge>
                            )}
                          </div>
                          {ev.content && <p className="text-sm mt-1 text-foreground/90">{ev.content}</p>}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(ev.createdAt), { addSuffix: true, locale: fr })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Comment form */}
              {!["cloturee"].includes(claim.status) && (
                <form onSubmit={handleComment} className="mt-4 space-y-2">
                  <Textarea
                    placeholder="Ajouter un commentaire…"
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    rows={3}
                  />
                  <div className="flex items-center justify-between">
                    {isManager && (
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={commentInternal}
                          onChange={e => setCommentInternal(e.target.checked)}
                          className="rounded"
                        />
                        <Lock className="w-3 h-3" /> Note interne
                      </label>
                    )}
                    <div className="ml-auto">
                      <Button type="submit" size="sm" disabled={commentMutation.isPending || !comment.trim()}>
                        {commentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        <span className="ml-2">Envoyer</span>
                      </Button>
                    </div>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right column: manager actions ─────────────────────────────────── */}
        {isManager && (
          <div className="space-y-4">
            {/* Status change panel */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Traitement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-3">
                  <p className="text-xs text-muted-foreground mb-1">Statut actuel</p>
                  <Badge variant="outline" className={`${st.color} flex items-center gap-1 w-fit`}>
                    {st.icon} {st.label}
                  </Badge>
                </div>

                {claim.allowedTransitions.length > 0 ? (
                  showStatusPanel ? (
                    <form onSubmit={handleStatusChange} className="space-y-3">
                      <div>
                        <Label className="text-xs">Nouveau statut</Label>
                        <Select value={newStatus} onValueChange={setNewStatus}>
                          <SelectTrigger className="mt-1 text-sm">
                            <SelectValue placeholder="Choisir…" />
                          </SelectTrigger>
                          <SelectContent>
                            {claim.allowedTransitions.map(s => (
                              <SelectItem key={s} value={s}>{STATUS_LABELS[s] ?? s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {(newStatus === "resolue" || newStatus === "refusee") && (
                        <div>
                          <Label className="text-xs">Note de résolution</Label>
                          <Textarea
                            className="mt-1 text-sm"
                            placeholder="Expliquez la décision prise…"
                            rows={3}
                            value={resolutionNote}
                            onChange={e => setResolutionNote(e.target.value)}
                          />
                        </div>
                      )}

                      <div>
                        <Label className="text-xs">Commentaire (optionnel)</Label>
                        <Textarea
                          className="mt-1 text-sm"
                          placeholder="Message pour le collaborateur…"
                          rows={2}
                          value={statusComment}
                          onChange={e => setStatusComment(e.target.value)}
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" className="flex-1"
                          onClick={() => setShowStatusPanel(false)}>Annuler</Button>
                        <Button type="submit" size="sm" className="flex-1"
                          disabled={statusMutation.isPending || !newStatus}>
                          {statusMutation.isPending && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                          Valider
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <Button variant="outline" className="w-full" size="sm"
                      onClick={() => setShowStatusPanel(true)}>
                      <ChevronDown className="w-4 h-4 mr-2" /> Changer le statut
                    </Button>
                  )
                ) : (
                  <p className="text-xs text-muted-foreground italic">Aucune transition possible depuis ce statut.</p>
                )}
              </CardContent>
            </Card>

            {/* Stats recap */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Informations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Collaborateur</span>
                  <span className="font-medium">{claim.collaboratorName}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Catégorie</span>
                  <span className="font-medium">{CATEGORY_LABELS[claim.category] ?? claim.category}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Priorité</span>
                  <span className={`font-medium ${(PRIORITY_CONFIG[claim.priority] ?? PRIORITY_CONFIG.normale).color}`}>
                    {(PRIORITY_CONFIG[claim.priority] ?? PRIORITY_CONFIG.normale).label}
                  </span>
                </div>
                {claim.assignedToName && (
                  <>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Assignée à</span>
                      <span className="font-medium">{claim.assignedToName}</span>
                    </div>
                  </>
                )}
                {claim.targetDate && (
                  <>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date cible</span>
                      <span className="font-medium">{format(new Date(claim.targetDate), "dd/MM/yyyy", { locale: fr })}</span>
                    </div>
                  </>
                )}
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Créée</span>
                  <span className="font-medium">{formatDistanceToNow(new Date(claim.createdAt), { addSuffix: true, locale: fr })}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </HrShell>
  );
}
