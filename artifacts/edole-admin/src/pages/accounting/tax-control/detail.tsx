import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useParams, useLocation } from "wouter";
import { AccountingShell } from "../_layout";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Shield, CheckCircle, AlertTriangle, XCircle, RefreshCw,
  Download, FileText, Edit3, Check, Info, Zap, BarChart2, Calendar,
  Clock, User, ExternalLink, ChevronDown, ChevronUp, Flame, BarChart, Building2,
  ArrowUpRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Anomaly = {
  id: string; level: string; category: string; title: string; detail: string | null;
  recommendedAction: string | null; linkedModule: string | null; linkedPath: string | null;
  resolved: boolean; resolvedAt: string | null; resolvedById: string | null; resolutionNote: string | null;
  source: string;
};
type CheckPoint = { id: string; checkCode: string; checkLabel: string; passed: boolean; detail: string | null };
type HistoryEvent = { id: string; eventType: string; eventLabel: string; detail: string | null; actorName: string | null; createdAt: string; metadata: any };
type FiscalSettings = { taxAuthorityLabel: string; country: string; vatRate: number };

type Declaration = {
  id: string; type: string; typeLabel: string; period: string; periodLabel: string;
  status: string; conformityScore: number | null;
  declaredRevenue: number | null; declaredVatCollected: number | null;
  declaredVatDeductible: number | null; declaredNetVat: number | null; declaredAmount: number | null;
  dueDate: string | null; lastCheckedAt: string | null; notes: string | null;
  responsibleId: string | null; createdAt: string;
  anomalies: Anomaly[];
  checks: CheckPoint[];
  history: HistoryEvent[];
  fiscalSettings: FiscalSettings;
};

// ─── Config ───────────────────────────────────────────────────────────────────
const NIVEAU_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  bloquant: { label: "Bloquant", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", icon: <XCircle className="w-4 h-4" /> },
  eleve:    { label: "Élevé",    color: "#D97706", bg: "#FFF7ED", border: "#FED7AA", icon: <Flame className="w-4 h-4" /> },
  moyen:    { label: "Moyen",    color: "#CA8A04", bg: "#FEFCE8", border: "#FEF08A", icon: <AlertTriangle className="w-4 h-4" /> },
  faible:   { label: "Faible",   color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB", icon: <Info className="w-4 h-4" /> },
};

const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  brouillon:       { label: "Brouillon",            color: "#6B7280", bg: "#F3F4F6" },
  en_verification: { label: "En vérification",      color: "#2563EB", bg: "#EFF6FF" },
  corrections:     { label: "Corrections requises", color: "#D97706", bg: "#FFF7ED" },
  conforme:        { label: "Conforme",              color: "#059669", bg: "#ECFDF5" },
  pret:            { label: "Prêt à soumettre",      color: "#7C3AED", bg: "#F5F3FF" },
  soumis:          { label: "Soumis",                color: "#0E1A39", bg: "#E0E7FF" },
  archive:         { label: "Archivé",               color: "#9CA3AF", bg: "#F9FAFB" },
};

// ─── Composants ───────────────────────────────────────────────────────────────
function ScoreGauge({ score }: { score: number }) {
  const color = score >= 90 ? "#059669" : score >= 70 ? "#D97706" : "#DC2626";
  const label = score >= 90 ? "Conforme" : score >= 70 ? "Corrections requises" : "Non conforme";
  const arc = Math.PI; // demi-cercle
  const radius = 50;
  const cx = 60;
  const cy = 60;
  const progress = (score / 100) * arc;
  const startX = cx - radius;
  const startY = cy;
  const endX = cx + radius;
  const endY = cy;
  const pX = cx + radius * Math.cos(Math.PI - progress);
  const pY = cy - radius * Math.sin(Math.PI - progress);

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="70" viewBox="0 0 120 70">
        <path d={`M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${endX} ${endY}`}
          fill="none" stroke="#F3F4F6" strokeWidth="10" strokeLinecap="round" />
        <path d={`M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${pX} ${pY}`}
          fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="20" fontWeight="800" fill="#0E1A39">{score}</text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="8" fill="#9CA3AF">/ 100</text>
      </svg>
      <div className="text-xs font-semibold mt-1" style={{ color }}>{label}</div>
    </div>
  );
}

function AnomalyCard({ anomaly, onResolve }: { anomaly: Anomaly; onResolve: (id: string, note: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [note, setNote] = useState("");
  const cfg = NIVEAU_CONFIG[anomaly.level] ?? NIVEAU_CONFIG.faible;

  return (
    <div className={`rounded-xl border transition-all ${anomaly.resolved ? "opacity-60" : ""}`}
      style={{ borderColor: anomaly.resolved ? "#E5E7EB" : cfg.border, background: anomaly.resolved ? "#F9FAFB" : cfg.bg }}>
      <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => setExpanded(v => !v)}>
        <div className="mt-0.5 flex-shrink-0" style={{ color: cfg.color }}>{cfg.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: cfg.color, background: "rgba(0,0,0,0.07)"}}>
              {cfg.label}
            </span>
            <span className="text-[10px] text-muted-foreground font-medium">{anomaly.category}</span>
            {anomaly.resolved && (
              <span className="text-[10px] font-semibold text-green-600 flex items-center gap-1">
                <Check className="w-3 h-3" />Résolu
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-foreground leading-snug">{anomaly.title}</p>
        </div>
        <div className="flex-shrink-0 text-muted-foreground/50">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t ml-7 space-y-3">
          {anomaly.detail && <p className="text-sm text-foreground/70 leading-relaxed">{anomaly.detail}</p>}
          {anomaly.recommendedAction && (
            <div className="flex items-start gap-2 p-2.5 bg-card/70 rounded-lg border">
              <Zap className="w-3.5 h-3.5 text-orange-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-foreground/80">
                <strong className="text-foreground">Action recommandée :</strong> {anomaly.recommendedAction}
              </p>
            </div>
          )}
          {anomaly.linkedPath && (
            <a href={anomaly.linkedPath} className="inline-flex items-center gap-1.5 text-xs text-blue-600 font-medium hover:underline">
              <ExternalLink className="w-3 h-3" />Ouvrir : {anomaly.linkedModule ?? anomaly.linkedPath}
            </a>
          )}
          {anomaly.resolved && anomaly.resolutionNote && (
            <div className="text-xs text-muted-foreground italic border-l-2 pl-2">Note : {anomaly.resolutionNote}</div>
          )}
          {!anomaly.resolved && (
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" className="h-7 text-xs gap-1 bg-foreground text-background hover:bg-foreground/90 border-0"
                onClick={() => setShowResolve(true)}>
                <Check className="w-3 h-3" />Marquer résolu
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={showResolve} onOpenChange={v => !v && setShowResolve(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Résoudre l'anomalie</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{anomaly.title}</p>
          <Textarea placeholder="Note de résolution (optionnel)" value={note} onChange={e => setNote(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowResolve(false)}>Annuler</Button>
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white border-0"
              onClick={() => { onResolve(anomaly.id, note); setShowResolve(false); }}>
              <Check className="w-3 h-3 mr-1" />Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function TaxControlDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ data: Declaration }>({
    queryKey: ["tax-declaration", id],
    queryFn: () => apiFetch(`/api/tax-declarations/${id}`),
  });

  const runCheck = useMutation({
    mutationFn: () => apiFetch(`/api/tax-declarations/${id}/run-check`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tax-declaration", id] }),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => apiFetch(`/api/tax-declarations/${id}`, {
      method: "PATCH", body: JSON.stringify({ status }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tax-declaration", id] });
      qc.invalidateQueries({ queryKey: ["tax-declarations"] });
    },
  });

  const resolveAnomaly = useMutation({
    mutationFn: ({ anomalyId, note }: { anomalyId: string; note: string }) =>
      apiFetch(`/api/tax-declarations/${id}/anomalies/${anomalyId}`, {
        method: "PATCH", body: JSON.stringify({ resolved: true, resolutionNote: note }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tax-declaration", id] }),
  });

  if (isLoading || !data?.data) {
    return (
      <AccountingShell title="Contrôle fiscal — Chargement…">
        <div className="text-muted-foreground">Chargement…</div>
      </AccountingShell>
    );
  }

  const decl = data.data;
  const score = decl.conformityScore;
  const statut = STATUT_CONFIG[decl.status] ?? STATUT_CONFIG.brouillon;
  const activeAnomalies = decl.anomalies.filter(a => !a.resolved);
  const hasBlocking = activeAnomalies.some(a => a.level === "bloquant");
  const passedChecks = decl.checks.filter(c => c.passed).length;

  return (
    <AccountingShell
      title={`${decl.typeLabel} — ${decl.periodLabel}`}
      subtitle={`Déclaration · Échéance : ${decl.dueDate ? new Date(decl.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "non définie"}`}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs"
            onClick={() => runCheck.mutate()} disabled={runCheck.isPending}>
            <RefreshCw className={`w-3.5 h-3.5 ${runCheck.isPending ? "animate-spin" : ""}`} />
            {runCheck.isPending ? "Contrôle…" : "Lancer le contrôle"}
          </Button>
          {decl.status !== "soumis" && decl.status !== "archive" && (
            <Button size="sm" className={`gap-1.5 h-8 text-xs ${hasBlocking ? "bg-muted text-muted-foreground cursor-not-allowed border" : "bg-violet-600 hover:bg-violet-700 text-white border-0"}`}
              disabled={hasBlocking}
              onClick={() => !hasBlocking && updateStatus.mutate("pret")}>
              <Shield className="w-3.5 h-3.5" />
              {hasBlocking ? "Bloqué" : "Prêt à soumettre"}
            </Button>
          )}
          {decl.status === "pret" && (
            <Button size="sm" className="gap-1.5 h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground border-0"
              onClick={() => updateStatus.mutate("soumis")}>
              <ArrowUpRight className="w-3.5 h-3.5" />Marquer soumis
            </Button>
          )}
        </div>
      }
    >
      {/* Breadcrumb */}
      <button onClick={() => setLocation("/comptabilite/controle-fiscal")}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />Liste des déclarations
      </button>

      {/* Statut banner */}
      <div className="flex items-center gap-3 mb-5 p-3 rounded-xl border"
        style={{ background: statut.bg, borderColor: statut.color + "33" }}>
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: statut.color }} />
        <span className="text-sm font-semibold" style={{ color: statut.color }}>{statut.label}</span>
        {decl.lastCheckedAt && (
          <span className="text-xs text-muted-foreground ml-auto">
            Dernier contrôle : {new Date(decl.lastCheckedAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        {hasBlocking && (
          <span className="text-xs font-semibold text-red-600 flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" />Soumission bloquée
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Colonne gauche ── */}
        <div className="space-y-4">
          {/* Score */}
          <div className="bg-card rounded-xl border p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-bold">Score de conformité</h3>
            </div>
            {score !== null ? (
              <>
                <ScoreGauge score={score} />
                <div className="mt-4 space-y-1.5 text-sm border-t pt-3">
                  {[
                    { label: "Contrôles effectués", val: decl.checks.length, bold: false },
                    { label: "Conformes", val: passedChecks, color: "#059669" },
                    { label: "Non conformes", val: decl.checks.length - passedChecks, color: "#DC2626" },
                    { label: "Anomalies actives", val: activeAnomalies.length, color: activeAnomalies.length > 0 ? "#D97706" : "#059669" },
                  ].map((r, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">{r.label}</span>
                      <span className="font-bold text-xs" style={{ color: r.color ?? "inherit" }}>{r.val}</span>
                    </div>
                  ))}
                </div>
                {hasBlocking && (
                  <div className="mt-3 p-2.5 bg-red-50 rounded-lg border border-red-200 flex gap-2">
                    <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 leading-snug">Résolvez les erreurs bloquantes avant de soumettre.</p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-xs text-muted-foreground mb-3">Aucun contrôle effectué.</p>
                <Button size="sm" variant="outline" onClick={() => runCheck.mutate()}
                  disabled={runCheck.isPending} className="gap-1.5 text-xs h-7">
                  <RefreshCw className={`w-3 h-3 ${runCheck.isPending ? "animate-spin" : ""}`} />
                  Lancer le contrôle
                </Button>
              </div>
            )}
          </div>

          {/* Points de contrôle */}
          {decl.checks.length > 0 && (
            <div className="bg-card rounded-xl border p-5">
              <h3 className="text-sm font-bold mb-3">Points de contrôle</h3>
              <div className="space-y-1.5">
                {decl.checks.map(c => (
                  <div key={c.id} className="flex items-start gap-2" title={c.detail ?? undefined}>
                    {c.passed
                      ? <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                      : <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />}
                    <span className={`text-xs leading-snug ${c.passed ? "text-muted-foreground" : "text-foreground font-medium"}`}>
                      {c.checkLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Montants */}
          <div className="bg-card rounded-xl border p-5">
            <h3 className="text-sm font-bold mb-3">Montants déclarés</h3>
            <div className="space-y-2">
              {[
                { label: "CA HT déclaré", val: decl.declaredRevenue },
                { label: "TVA collectée", val: decl.declaredVatCollected },
                { label: "TVA déductible", val: decl.declaredVatDeductible },
                { label: "TVA nette à payer", val: decl.declaredNetVat, bold: true },
              ].map((r, i) => (
                <div key={i} className={`flex items-center justify-between pb-1.5 border-b last:border-0 last:pb-0`}>
                  <span className="text-xs text-muted-foreground">{r.label}</span>
                  <span className={`text-xs ${r.bold ? "font-bold text-foreground" : "font-medium"}`}>
                    {r.val != null ? formatFCFA(r.val) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Info fiscale */}
          <div className="bg-muted/30 rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Administration fiscale</span>
            </div>
            <p className="text-sm font-semibold">{decl.fiscalSettings.taxAuthorityLabel}</p>
            <p className="text-xs text-muted-foreground">TVA : {decl.fiscalSettings.vatRate}% · Pays : {decl.fiscalSettings.country}</p>
          </div>
        </div>

        {/* ── Colonne droite ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Anomalies */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">
                Anomalies détectées
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {activeAnomalies.length} active{activeAnomalies.length > 1 ? "s" : ""}
                </span>
              </h3>
              {decl.anomalies.length === 0 && score === null && (
                <span className="text-xs text-muted-foreground">Lancez le contrôle pour détecter les anomalies.</span>
              )}
            </div>

            {decl.anomalies.length === 0 && score !== null && (
              <div className="py-8 text-center border rounded-xl bg-green-50 border-green-100">
                <CheckCircle className="w-7 h-7 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-green-700">Aucune anomalie détectée</p>
                <p className="text-xs text-green-600">La déclaration est conforme.</p>
              </div>
            )}

            <div className="space-y-2">
              {[...decl.anomalies]
                .sort((a, b) => {
                  const order: Record<string, number> = { bloquant: 0, eleve: 1, moyen: 2, faible: 3 };
                  return (order[a.level] ?? 4) - (order[b.level] ?? 4);
                })
                .map(a => (
                  <AnomalyCard key={a.id} anomaly={a}
                    onResolve={(anomalyId, note) => resolveAnomaly.mutate({ anomalyId, note })} />
                ))}
            </div>
          </div>

          {/* Historique */}
          <div className="bg-card rounded-xl border p-5">
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />Historique des vérifications
            </h3>
            {decl.history.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun événement enregistré.</p>
            ) : (
              <div className="space-y-2">
                {decl.history.map((h, i) => (
                  <div key={h.id} className="flex gap-3 text-sm">
                    <div className="flex flex-col items-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-foreground mt-1.5 flex-shrink-0" />
                      {i < decl.history.length - 1 && <div className="w-px bg-border flex-1 mt-1" />}
                    </div>
                    <div className="pb-2">
                      <div className="font-semibold text-xs text-foreground">{h.eventLabel}</div>
                      {h.detail && <div className="text-xs text-muted-foreground">{h.detail}</div>}
                      <div className="flex items-center gap-2 mt-0.5">
                        {h.actorName && (
                          <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5">
                            <User className="w-2.5 h-2.5" />{h.actorName}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground/50">
                          {new Date(h.createdAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AccountingShell>
  );
}

// Alias nommé requis par App.tsx (lazy import)
export { TaxControlDetailPage };
