import React from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  FileText,
  FolderKanban,
  Receipt,
  TrendingUp,
  Users,
} from "lucide-react";
import { formatFCFACompact } from "@/lib/format";
import { cn } from "@/lib/utils";

type Accent = "default" | "green" | "amber" | "red" | "blue";

function KpiCard({
  label, value, sub, icon: Icon, accent = "default", loading, href,
}: {
  label: string; value: React.ReactNode; sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: Accent; loading?: boolean; href?: string;
}) {
  const colors: Record<Accent, string> = {
    default: "text-primary bg-primary/8",
    green:   "text-emerald-600 bg-emerald-50",
    amber:   "text-amber-600 bg-amber-50",
    red:     "text-rose-600 bg-rose-50",
    blue:    "text-blue-600 bg-blue-50",
  };
  const inner = (
    <Card className={cn("shadow-sm border transition-all", href && "hover:border-primary/40 hover:shadow-md cursor-pointer")}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide truncate">{label}</p>
            {loading ? <Skeleton className="h-7 w-24 mt-2" /> : (
              <p className="text-lg sm:text-2xl font-bold text-foreground mt-1 leading-tight tabular-nums break-words">{value}</p>
            )}
            {sub && !loading && <p className="text-xs text-muted-foreground mt-1.5 truncate">{sub}</p>}
          </div>
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", colors[accent])}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}

interface Props {
  kpis: any;
  loading: boolean;
  overdueInvoicesCount: number;
  totalAlerts: number;
  monthlyRevenue: number;
  outstanding: number;
  pipeline: number;
  collectionRate: number;
}

export function KpisSection({ kpis, loading, overdueInvoicesCount, totalAlerts, monthlyRevenue, outstanding, pipeline, collectionRate }: Props) {
  return (
    <section data-tour="dash-kpis">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">Vue d'ensemble</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Indicateurs clés de votre organisation</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4">
        <KpiCard label="Encaissements du mois" value={formatFCFACompact(monthlyRevenue)} sub="Paiements reçus" icon={TrendingUp} accent={monthlyRevenue > 0 ? "green" : "default"} loading={loading} href="/paiements" />
        <KpiCard label="Créances ouvertes" value={formatFCFACompact(outstanding)} sub="À encaisser" icon={Receipt} accent={outstanding > 0 ? "amber" : "green"} loading={loading} href="/factures" />
        <KpiCard label="Pipeline CRM" value={formatFCFACompact(pipeline)} sub="Opportunités qualifiées" icon={Briefcase} accent="blue" loading={loading} href="/crm" />
        <KpiCard label="Taux de recouvrement" value={`${collectionRate}%`} sub="Encaissé / Facturé" icon={CheckCircle2} accent={collectionRate >= 75 ? "green" : collectionRate >= 40 ? "amber" : "red"} loading={loading} />
        <KpiCard label="Projets actifs" value={kpis?.activeProjects ?? 0} sub={`sur ${kpis?.totalProjects ?? 0} au total`} icon={FolderKanban} loading={loading} href="/projets" />
        <KpiCard label="Collaborateurs" value={kpis?.totalCollaborators ?? 0} sub="Effectif actif" icon={Users} loading={loading} href="/collaborateurs" />
        <KpiCard label="Factures en attente" value={overdueInvoicesCount} sub={overdueInvoicesCount > 0 ? "Relances nécessaires" : "Aucune en retard"} icon={FileText} accent={overdueInvoicesCount > 0 ? "red" : "green"} loading={loading} href="/factures" />
        <KpiCard label="Alertes actives" value={totalAlerts} sub={totalAlerts > 0 ? "Actions requises" : "Tout est à jour"} icon={AlertTriangle} accent={totalAlerts > 3 ? "red" : totalAlerts > 0 ? "amber" : "green"} loading={loading} />
      </div>
    </section>
  );
}
