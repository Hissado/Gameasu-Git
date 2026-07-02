/**
 * Phase 17 — File d'approbations transversale.
 * Audit corrigé : liens valides, boutons d'action contextuels, sous-titres affichés,
 * groupage par sévérité, design premium.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, CheckSquare, FileText, FileSignature, FolderArchive,
  Target, ClipboardCheck, ArrowRight, RefreshCw, CheckCircle2, AlertTriangle,
  Clock, ShieldAlert, Banknote,
} from "lucide-react";
import { formatFCFA } from "@/lib/format";

// ── Types ─────────────────────────────────────────────────────────────────────

type Severity = "urgent" | "high" | "medium" | "low";

type ApprovalItem = {
  kind: string;
  id: string;
  title: string;
  subtitle?: string;
  amount?: number | null;
  severity: Severity;
  entityType: string;
  entityId: string;
  createdAt: string;
};

// ── Config par type d'élément ─────────────────────────────────────────────────

const KIND_CONFIG: Record<string, {
  label: string;
  action: string;
  href: (it: ApprovalItem) => string;
  icon: React.ComponentType<{ className?: string }>;
  badgeCls: string;
}> = {
  proforma_draft: {
    label: "Devis brouillon",
    action: "Finaliser",
    href: () => "/devis",
    icon: FileText,
    badgeCls: "bg-blue-50 text-blue-700 border-blue-200",
  },
  invoice_draft: {
    label: "Facture à émettre",
    action: "Émettre",
    href: () => "/factures",
    icon: FileText,
    badgeCls: "bg-violet-50 text-violet-700 border-violet-200",
  },
  doc_pending_signature: {
    label: "Signature requise",
    action: "Accéder",
    href: () => "/documents",
    icon: FileSignature,
    badgeCls: "bg-amber-50 text-amber-700 border-amber-200",
  },
  contract_expiring: {
    label: "Contrat expirant",
    action: "Gérer",
    href: () => "/rh/contrats",
    icon: FolderArchive,
    badgeCls: "bg-orange-50 text-orange-700 border-orange-200",
  },
  opportunity_closing: {
    label: "Opportunité à clôturer",
    action: "Traiter",
    href: () => "/crm",
    icon: Target,
    badgeCls: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
};

const SEVERITY_CONFIG: Record<Severity, { label: string; cls: string; icon: React.ComponentType<{ className?: string }>; bar: string }> = {
  urgent: { label: "Urgent",  cls: "bg-red-50 text-red-700 border-red-200",      icon: AlertTriangle, bar: "bg-red-500" },
  high:   { label: "Élevé",   cls: "bg-amber-50 text-amber-700 border-amber-200", icon: ShieldAlert,   bar: "bg-amber-500" },
  medium: { label: "Moyen",   cls: "bg-blue-50 text-blue-700 border-blue-200",    icon: Clock,         bar: "bg-blue-400" },
  low:    { label: "Faible",  cls: "bg-slate-50 text-slate-600 border-slate-200", icon: CheckCircle2,  bar: "bg-slate-300" },
};

const SEVERITY_ORDER: Severity[] = ["urgent", "high", "medium", "low"];

// ── ApprovalCard ──────────────────────────────────────────────────────────────

function ApprovalCard({ item, onDismiss }: { item: ApprovalItem; onDismiss: (id: string) => void }) {
  const cfg = KIND_CONFIG[item.kind] ?? {
    label: item.kind,
    action: "Voir",
    href: () => "#",
    icon: ClipboardCheck,
    badgeCls: "bg-slate-50 text-slate-600 border-slate-200",
  };
  const sev = SEVERITY_CONFIG[item.severity] ?? SEVERITY_CONFIG.low;
  const Icon = cfg.icon;
  const SevIcon = sev.icon;

  return (
    <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all group">
      {/* Left accent + icon */}
      <div className={`mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${sev.cls.replace("border-", "bg-").replace("text-", "text-")} border`}>
        <Icon className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap mb-1">
          <Badge variant="outline" className={`text-[10px] font-semibold px-1.5 py-0.5 ${cfg.badgeCls}`}>
            {cfg.label}
          </Badge>
          <Badge variant="outline" className={`text-[10px] font-semibold px-1.5 py-0.5 flex items-center gap-1 ${sev.cls}`}>
            <SevIcon className="w-2.5 h-2.5" />
            {sev.label}
          </Badge>
        </div>
        <p className="text-sm font-semibold text-slate-800 leading-snug mt-0.5 truncate">{item.title}</p>
        {item.subtitle && (
          <p className="text-xs text-slate-500 mt-0.5">{item.subtitle}</p>
        )}
        {item.amount != null && item.amount > 0 && (
          <p className="text-xs font-semibold text-slate-700 mt-1 flex items-center gap-1">
            <Banknote className="w-3 h-3 text-slate-400" />
            {formatFCFA(item.amount)}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <Link href={cfg.href(item)}>
          <Button size="sm" className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-white">
            {cfg.action}
            <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          title="Ignorer"
          onClick={() => onDismiss(item.id)}
        >
          <CheckCircle2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ApprovalsQueue() {
  const { data, isLoading, refetch, isFetching } = useQuery<{
    total: number;
    counts: Record<Severity, number>;
    items: ApprovalItem[];
  }>({
    queryKey: ["approvals-queue"],
    queryFn: () => apiFetch("/api/approvals/queue"),
  });

  // Dismissed items stored locally (optimistic hide before next fetch)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const handleDismiss = (id: string) => setDismissed(prev => new Set([...prev, id]));

  if (isLoading) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground mt-3">Chargement de la file d'approbations…</p>
      </div>
    );
  }

  const d = data!;
  const visibleItems = (d.items || []).filter(it => !dismissed.has(it.id));

  // Group by severity
  const grouped = SEVERITY_ORDER
    .map(sev => ({ sev, items: visibleItems.filter(it => it.severity === sev) }))
    .filter(g => g.items.length > 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1 flex items-center gap-2">
            <CheckSquare className="w-3 h-3" /> File de validation
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Approbations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {visibleItems.length > 0
              ? `${visibleItems.length} élément${visibleItems.length > 1 ? "s" : ""} en attente de décision`
              : "Aucun élément en attente — tout est traité ✓"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setDismissed(new Set()); refetch(); }}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["urgent", "high", "medium", "low"] as Severity[]).map(sev => {
          const sc = SEVERITY_CONFIG[sev];
          const SevIcon = sc.icon;
          const count = (d.counts?.[sev] ?? 0) - [...dismissed].filter(id =>
            d.items.find(it => it.id === id && it.severity === sev)
          ).length;
          return (
            <Card key={sev} className={`border ${count > 0 ? sc.cls.split(" ").filter(c => c.startsWith("border-")).join(" ") : "border-border"}`}>
              <CardContent className="p-3.5 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{sc.label}</p>
                  <p className={`text-2xl font-extrabold mt-0.5 ${count > 0 ? sc.cls.split(" ").filter(c => c.startsWith("text-")).join(" ") : "text-muted-foreground"}`}>
                    {count}
                  </p>
                </div>
                <SevIcon className={`w-5 h-5 opacity-50 ${count > 0 ? sc.cls.split(" ").filter(c => c.startsWith("text-")).join(" ") : "text-muted-foreground"}`} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Items list */}
      {visibleItems.length === 0 ? (
        <Card>
          <CardContent className="p-16 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-emerald-400" />
            <p className="font-semibold text-slate-700 text-lg">Tout est à jour</p>
            <p className="text-sm text-muted-foreground mt-1">
              Aucune validation en attente pour le moment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ sev, items }) => {
            const sc = SEVERITY_CONFIG[sev];
            return (
              <div key={sev}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-2 h-2 rounded-full ${sc.bar}`} />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {sc.label} · {items.length} élément{items.length > 1 ? "s" : ""}
                  </span>
                  <div className="flex-1 h-px bg-border/60" />
                </div>
                <div className="space-y-2">
                  {items.map(item => (
                    <ApprovalCard key={item.id} item={item} onDismiss={handleDismiss} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
