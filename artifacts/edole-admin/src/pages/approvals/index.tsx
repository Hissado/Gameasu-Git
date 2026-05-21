/**
 * Phase 17 — File d'approbations.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckSquare, FileText, FileSignature, FolderArchive, Target, ClipboardCheck } from "lucide-react";
import { formatFCFA } from "@/lib/format";
import { priorityLabel } from "@/lib/intelligence";

const KPI = ({ label, value, accent }: { label: string; value: number; accent?: string }) => (
  <Card><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold mb-1">{label}</p><p className={`text-2xl font-bold ${accent ?? ""}`}>{value}</p></CardContent></Card>
);

const sevColor = (s: string) =>
  s === "urgent" ? "bg-red-50 text-red-700 border-red-200" :
  s === "high" ? "bg-amber-50 text-amber-700 border-amber-200" :
  s === "medium" ? "bg-blue-50 text-blue-700 border-blue-200" :
  "bg-slate-50 text-slate-700 border-slate-200";

const linkFor = (it: any): string => {
  switch (it.entityType) {
    case "proforma": return `/proformas/${it.entityId}`;
    case "invoice": return `/invoices/${it.entityId}`;
    case "document": return `/documents/${it.entityId}`;
    case "contract": return `/hr/contracts/${it.entityId}`;
    case "opportunity": return `/crm`;
    default: return "#";
  }
};

const iconFor = (kind: string) => {
  if (kind.startsWith("proforma")) return FileText;
  if (kind.startsWith("invoice")) return FileText;
  if (kind.startsWith("doc")) return FileSignature;
  if (kind.startsWith("contract")) return FolderArchive;
  if (kind.startsWith("opportunity")) return Target;
  return ClipboardCheck;
};

export default function ApprovalsQueue() {
  const q = useQuery<any>({ queryKey: ["approvals-queue"], queryFn: () => apiFetch("/api/approvals/queue") });
  if (q.isLoading || !q.data) return <div className="py-12 text-center"><Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground" /></div>;
  const d = q.data;

  return (
    <div className="space-y-4">
      <div><p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1 flex items-center gap-2"><CheckSquare className="w-3 h-3" />Approbations</p><h1 className="text-3xl font-bold tracking-tight">File de validation</h1></div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        <KPI label="Total à traiter" value={d.total} />
        <KPI label="Urgent" value={d.counts.urgent} accent="text-red-600" />
        <KPI label="Élevé" value={d.counts.high} accent="text-amber-600" />
        <KPI label="Moyen" value={d.counts.medium} accent="text-blue-600" />
        <KPI label="Faible" value={d.counts.low} />
      </div>

      {d.items.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground italic">Aucune validation en attente. Tout est traité.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {d.items.map((it: any, idx: number) => {
            const Icon = iconFor(it.kind);
            return (
              <Link key={`${it.kind}-${it.id}-${idx}`} href={linkFor(it)}>
                <Card className="cursor-pointer hover:bg-muted">
                  <CardContent className="p-3 flex items-center gap-3">
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{it.title}</p>
                      {it.subtitle && <p className="text-xs text-muted-foreground truncate">{it.subtitle}</p>}
                    </div>
                    {it.amount !== null && it.amount !== undefined && <span className="text-xs text-muted-foreground shrink-0">{formatFCFA(it.amount)}</span>}
                    <Badge variant="outline" className={`${sevColor(it.severity)} text-[10px] shrink-0`}>{priorityLabel(it.severity)}</Badge>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
