import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetCrmPipeline, useListOpportunities } from "@workspace/api-client-react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Plus, Building, Briefcase, ArrowRight, UserCheck, FileText, ChevronDown,
  TrendingUp, Clock, AlertTriangle, Target, Trophy, ChevronRight, ChevronLeft,
  Calculator,
} from "lucide-react";
import { formatFCFA, formatFCFACompact } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Link } from "wouter";
import { PageHeader } from "@/components/ui/page-header";
import { usePermissions } from "@/lib/permissions";
import { useModuleTour, WelcomeModal, OnboardingTour } from "@/components/ui/onboarding-tour";

// Progression logique des stades (prev → next)
const STAGE_NEXT: Record<string, string> = {
  lead: "qualified", qualified: "proposal", proposal: "negotiation", negotiation: "won",
};
const STAGE_PREV: Record<string, string> = {
  qualified: "lead", proposal: "qualified", negotiation: "proposal", won: "negotiation",
};

function closeUrgency(date: string | null): { label: string; cls: string } | null {
  if (!date) return null;
  const days = Math.floor((new Date(date).getTime() - Date.now()) / 86_400_000);
  if (days < 0)  return { label: `${-days}j dépassé`,  cls: "bg-red-100 text-red-700 border-red-200" };
  if (days <= 7)  return { label: `${days}j restants`,  cls: "bg-amber-100 text-amber-700 border-amber-200" };
  if (days <= 30) return { label: `${days}j`,           cls: "bg-blue-50 text-blue-600 border-blue-200" };
  return null;
}

const STAGES = [
  { key: "lead",        label: "Prospects",      colorCls: "border-t-slate-400 bg-slate-50" },
  { key: "qualified",   label: "Qualifiés",       colorCls: "border-t-blue-400 bg-blue-50/30" },
  { key: "proposal",    label: "En proposition",  colorCls: "border-t-indigo-400 bg-indigo-50/30" },
  { key: "negotiation", label: "Négociation",     colorCls: "border-t-amber-400 bg-amber-50/30" },
  { key: "won",         label: "Gagnés",          colorCls: "border-t-emerald-400 bg-emerald-50/30" },
  { key: "lost",        label: "Perdus",          colorCls: "border-t-red-400 bg-red-50/30" },
];

const STAGE_LABELS: Record<string, string> = Object.fromEntries(STAGES.map(s => [s.key, s.label]));

type Opp = {
  id: string; title: string; stage: string;
  value: number | null; clientId: string | null; clientName: string | null;
  probability: number | null; expectedCloseDate: string | null;
};

// ─── ConvertDialog ────────────────────────────────────────────────────────────

function ConvertDialog({ opp, onClose }: { opp: Opp; onClose: (clientId?: string) => void }) {
  const [name, setName] = useState(opp.clientName || opp.title);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const hasClient = !!opp.clientId;

  const handleConvert = async () => {
    setSaving(true);
    try {
      const result = await apiFetch(`/api/crm/opportunities/${opp.id}/convert-to-client`, {
        method: "POST",
        body: JSON.stringify({ name, email: email || undefined, phone: phone || undefined }),
      }) as { clientId: string; created: boolean };
      toast.success(result.created ? "Client créé et opportunité marquée gagnée" : "Client activé et opportunité marquée gagnée");
      onClose(result.clientId);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de la conversion");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-500" />
            {hasClient ? "Activer le client" : "Convertir en client"}
          </DialogTitle>
          <DialogDescription>
            {hasClient
              ? `Le client lié à cette opportunité passera en statut "Actif".`
              : "Un nouveau compte client sera créé depuis cette opportunité."}
          </DialogDescription>
        </DialogHeader>
        {!hasClient && (
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Nom du client *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" placeholder="contact@entreprise.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Téléphone</Label>
                <Input placeholder="+228 90000000" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose()} disabled={saving}>Annuler</Button>
          <Button onClick={handleConvert} disabled={saving || (!hasClient && !name.trim())}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
            <UserCheck className="w-4 h-4" />
            {saving ? "…" : hasClient ? "Activer le client" : "Créer le client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── NewOpportunityDialog ─────────────────────────────────────────────────────

function NewOpportunityDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [stage, setStage] = useState("lead");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Titre requis"); return; }
    setSaving(true);
    try {
      await apiFetch("/api/crm/opportunities", {
        method: "POST",
        body: JSON.stringify({ title, value: value ? Number(value) : undefined, stage, currency: "XOF", notes: notes || undefined }),
      });
      toast.success("Opportunité créée");
      onSuccess();
      onClose();
    } catch {
      toast.error("Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-[#2563EB]" /> Nouvelle opportunité
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>Titre *</Label>
            <Input placeholder="Contrat de maintenance…" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Valeur estimée (FCFA)</Label>
              <Input type="number" min="0" placeholder="5 000 000" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Stade</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.filter(s => s.key !== "won" && s.key !== "lost").map(s => (
                    <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white">
            {saving ? "Création…" : "Créer l'opportunité"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const CRM_TOUR = [
  { target: "crm-header", title: "Pipeline commercial", description: "Pilotez toutes vos opportunités de vente, du premier contact jusqu'à la signature du contrat." },
  { target: "crm-kpis", title: "Métriques commerciales", description: "Pipeline total, valeur pondérée par probabilité, CA gagné et opportunités en retard — vos chiffres en temps réel." },
  { target: "crm-pipeline", title: "Kanban des opportunités", description: "Glissez chaque carte d'une colonne à l'autre, ou utilisez les boutons Avancer / Reculer pour faire progresser vos négociations." },
];

export default function CrmHome() {
  const qc = useQueryClient();
  const { showWelcome, tourActive, startTour, dismissWelcome, closeTour } = useModuleTour("crm");
  const { data: pipeline, isLoading: isLoadingPipeline } = useGetCrmPipeline();
  const { data: opportunities, isLoading: isLoadingOpps, refetch } = useListOpportunities();

  const perms = usePermissions();
  const [newOppOpen, setNewOppOpen] = useState(false);
  const [convertOpp, setConvertOpp] = useState<Opp | null>(null);
  const [movingOpp, setMovingOpp] = useState<string | null>(null);

  const moveMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      apiFetch(`/api/crm/opportunities/${id}`, { method: "PUT", body: JSON.stringify({ stage }) }),
    onSuccess: () => { refetch(); qc.invalidateQueries({ queryKey: ["GetCrmPipeline"] }); },
    onError: () => toast.error("Erreur lors du déplacement"),
  });

  const handleConvertClose = (clientId?: string) => {
    setConvertOpp(null);
    refetch();
    qc.invalidateQueries({ queryKey: ["GetCrmPipeline"] });
    if (clientId) toast.success(`Fiche client accessible depuis l'annuaire`);
  };

  const isLoading = isLoadingPipeline || isLoadingOpps;

  return (
    <div data-tour="crm-header" className="space-y-5 animate-in fade-in duration-500 h-[calc(100vh-140px)] flex flex-col">
      {showWelcome && (
        <WelcomeModal
          title="Pipeline Commercial"
          subtitle="Apprenez à gérer vos opportunités et suivre votre pipeline de vente."
          icon={Target}
          steps={CRM_TOUR}
          onStart={startTour}
          onDismiss={dismissWelcome}
        />
      )}
      {tourActive && <OnboardingTour steps={CRM_TOUR} onClose={closeTour} />}
      <PageHeader
        title="Pipeline Commercial"
        subtitle={`${opportunities?.total ?? 0} opportunités · ${pipeline ? formatFCFACompact(pipeline.totalValue ?? 0) : "0 FCFA"} en pipeline`}
        icon={Target}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/clients">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Building className="w-4 h-4" /> Clients
              </Button>
            </Link>
            <Link href="/tarification">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Calculator className="w-4 h-4" /> Calculateur
              </Button>
            </Link>
            {!perms.isReadOnly && (
              <Button onClick={() => setNewOppOpen(true)}
                className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-semibold gap-1.5">
                <Plus className="w-4 h-4" strokeWidth={3} />
                Nouvelle opportunité
              </Button>
            )}
          </div>
        }
      />

      {/* KPI Row */}
      {!isLoading && (() => {
        const opps = opportunities?.data as Opp[] ?? [];
        const activeOpps = opps.filter(o => o.stage !== "won" && o.stage !== "lost");
        const wonOpps   = opps.filter(o => o.stage === "won");
        const lostOpps  = opps.filter(o => o.stage === "lost");
        const closed    = wonOpps.length + lostOpps.length;
        const winRate   = closed > 0 ? Math.round(wonOpps.length / closed * 100) : null;
        const weighted  = activeOpps.reduce((s, o) => s + (o.value ?? 0) * (o.probability ?? 50) / 100, 0);
        const wonValue  = wonOpps.reduce((s, o) => s + (o.value ?? 0), 0);
        const overdueOpps = activeOpps.filter(o => o.expectedCloseDate && new Date(o.expectedCloseDate) < new Date());
        return (
          <div data-tour="crm-kpis" className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
            <div className="bg-white border border-border rounded-xl p-3 flex items-center gap-2.5">
              <div className="p-2 bg-amber-50 rounded-lg shrink-0"><Target className="w-4 h-4 text-[#2563EB]" /></div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="text-[10px] font-bold text-muted-foreground uppercase truncate">Pipeline total</div>
                <div className="text-sm sm:text-base font-black text-foreground leading-tight break-words">{formatFCFACompact(pipeline?.totalValue ?? 0)}</div>
                <div className="text-[10px] text-muted-foreground truncate">{activeOpps.length} opp. actives</div>
              </div>
            </div>
            <div className="bg-white border border-border rounded-xl p-3 flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 rounded-lg shrink-0"><TrendingUp className="w-4 h-4 text-blue-500" /></div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="text-[10px] font-bold text-muted-foreground uppercase truncate">Valeur pondérée</div>
                <div className="text-sm sm:text-base font-black text-blue-700 leading-tight break-words">{formatFCFACompact(Math.round(weighted))}</div>
                <div className="text-[10px] text-muted-foreground truncate">probabilité × valeur</div>
              </div>
            </div>
            <div className="bg-white border border-border rounded-xl p-3 flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 rounded-lg shrink-0"><Trophy className="w-4 h-4 text-emerald-500" /></div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="text-[10px] font-bold text-muted-foreground uppercase truncate">Deals gagnés</div>
                <div className="text-sm sm:text-base font-black text-emerald-700 leading-tight break-words">{formatFCFACompact(wonValue)}</div>
                <div className="text-[10px] text-muted-foreground truncate">{winRate !== null ? `Taux : ${winRate}%` : "Aucun deal fermé"}</div>
              </div>
            </div>
            <div className={`border rounded-xl p-3 flex items-center gap-2.5 ${overdueOpps.length > 0 ? "bg-red-50 border-red-200" : "bg-white border-border"}`}>
              <div className={`p-2 rounded-lg shrink-0 ${overdueOpps.length > 0 ? "bg-red-100" : "bg-slate-50"}`}>
                <Clock className={`w-4 h-4 ${overdueOpps.length > 0 ? "text-red-500" : "text-slate-400"}`} />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="text-[10px] font-bold text-muted-foreground uppercase truncate">Délais dépassés</div>
                <div className={`text-sm sm:text-base font-black leading-tight ${overdueOpps.length > 0 ? "text-red-700" : "text-foreground"}`}>{overdueOpps.length}</div>
                <div className="text-[10px] text-muted-foreground truncate">opp. hors deadline</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Pipeline board */}
      {isLoading ? (
        <div className="flex gap-4 overflow-hidden h-full">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex-1 min-w-[300px] max-w-[350px] bg-slate-50/50 rounded-xl border border-border p-3">
              <Skeleton className="h-6 w-1/2 mb-4" />
              <div className="space-y-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div data-tour="crm-pipeline" className="flex gap-3 overflow-x-auto pb-4 flex-1 items-start">
          {STAGES.map((stage) => {
            const stageOpps = (opportunities?.data as Opp[] ?? []).filter(o => o.stage === stage.key);
            const stageTotal = stageOpps.reduce((s, o) => s + (o.value ?? 0), 0);

            return (
              <div key={stage.key}
                className={`flex-1 min-w-[280px] max-w-[340px] rounded-xl border border-border/50 border-t-4 flex flex-col max-h-full ${stage.colorCls}`}>
                {/* Column header */}
                <div className="px-3 pt-3 pb-2 flex items-center justify-between bg-white/60 rounded-t-lg backdrop-blur-sm border-b border-border/30">
                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">{stage.label}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 font-medium">{formatFCFA(stageTotal)}</p>
                  </div>
                  <Badge variant="secondary" className="font-bold bg-white shadow-sm border-border text-xs">
                    {stageOpps.length}
                  </Badge>
                </div>

                {/* Cards */}
                <div className="p-2 space-y-2 overflow-y-auto flex-1">
                  {stageOpps.map(opp => (
                    <Card key={opp.id} className="shadow-sm hover:shadow-md transition-shadow bg-white group">
                      <CardContent className="p-3 space-y-2">
                        <div className="font-semibold text-sm leading-tight">{opp.title}</div>

                        {/* Client */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Building className="w-3 h-3 shrink-0 text-slate-400" />
                          <span className="truncate">{opp.clientName || <span className="italic text-slate-400">Prospect non assigné</span>}</span>
                        </div>

                        {/* Valeur + probabilité */}
                        {opp.value != null && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800">{formatFCFA(opp.value)}</span>
                              {opp.probability != null && (
                                <span className="text-[10px] font-bold text-slate-500">{opp.probability}%</span>
                              )}
                            </div>
                            {opp.probability != null && (
                              <Progress value={opp.probability} className="h-1 [&>div]:bg-[#2563EB]" />
                            )}
                          </div>
                        )}

                        {/* Urgence date */}
                        {(() => {
                          const urg = closeUrgency(opp.expectedCloseDate);
                          return urg ? (
                            <div className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border ${urg.cls}`}>
                              <Clock className="w-3 h-3" /> {urg.label}
                            </div>
                          ) : opp.expectedCloseDate ? (
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(opp.expectedCloseDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                            </div>
                          ) : null;
                        })()}

                        {/* Actions */}
                        <div className="flex items-center gap-1 pt-1 flex-wrap">
                          {opp.clientId && (
                            <Link href={`/clients/${opp.clientId}`}>
                              <button className="text-[10px] font-semibold px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center gap-1 transition-colors">
                                <Building className="w-3 h-3" /> Fiche client
                              </button>
                            </Link>
                          )}
                          {opp.clientId && stage.key !== "lead" && (
                            <Link href="/devis">
                              <button className="text-[10px] font-semibold px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center gap-1 transition-colors">
                                <FileText className="w-3 h-3" /> Devis
                              </button>
                            </Link>
                          )}
                          {stage.key !== "won" && stage.key !== "lost" && !perms.isReadOnly && (
                            <button
                              onClick={() => setConvertOpp(opp)}
                              className="text-[10px] font-semibold px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center gap-1 transition-colors">
                              <UserCheck className="w-3 h-3" /> Convertir
                            </button>
                          )}
                          {stage.key === "won" && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600">✓ Gagné</span>
                          )}
                        </div>

                        {/* Stage mover — prev / next uniquement */}
                        {stage.key !== "won" && stage.key !== "lost" && (
                          <div className="flex items-center gap-1 pt-0.5 border-t border-slate-100 mt-1">
                            {STAGE_PREV[stage.key] && (
                              <button
                                onClick={() => moveMutation.mutate({ id: opp.id, stage: STAGE_PREV[stage.key] })}
                                disabled={moveMutation.isPending}
                                title={`Reculer vers ${STAGES.find(s => s.key === STAGE_PREV[stage.key])?.label}`}
                                className="flex-1 text-[10px] font-semibold py-1 rounded border border-slate-200 hover:border-slate-400 text-slate-500 hover:text-slate-700 transition-colors flex items-center justify-center gap-0.5">
                                <ChevronLeft className="w-3 h-3" /> Reculer
                              </button>
                            )}
                            {STAGE_NEXT[stage.key] && (
                              <button
                                onClick={() => moveMutation.mutate({ id: opp.id, stage: STAGE_NEXT[stage.key] })}
                                disabled={moveMutation.isPending}
                                title={`Avancer vers ${STAGES.find(s => s.key === STAGE_NEXT[stage.key])?.label}`}
                                className="flex-1 text-[10px] font-semibold py-1 rounded border border-[#2563EB]/40 hover:border-[#2563EB] text-[#8a6b2a] hover:bg-amber-50 transition-colors flex items-center justify-center gap-0.5">
                                Avancer <ChevronRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}

                  {stageOpps.length === 0 && (
                    <div className="text-center p-6 text-xs text-muted-foreground bg-white/50 rounded-lg border border-dashed border-border">
                      <Briefcase className="w-6 h-6 mx-auto text-slate-200 mb-1.5" />
                      Aucune opportunité
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      {newOppOpen && (
        <NewOpportunityDialog
          onClose={() => setNewOppOpen(false)}
          onSuccess={() => {
            refetch();
            qc.invalidateQueries({ queryKey: ["GetCrmPipeline"] });
          }}
        />
      )}
      {convertOpp && <ConvertDialog opp={convertOpp} onClose={handleConvertClose} />}
    </div>
  );
}
