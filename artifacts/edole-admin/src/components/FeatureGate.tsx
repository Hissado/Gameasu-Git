import { ReactNode } from "react";
import { useOrganizationModules, useCurrentSubscription } from "@/lib/saas";
import { Lock, ArrowRight } from "lucide-react";
import { Link } from "wouter";

export function useModuleEnabled(moduleKey: string | null | undefined) {
  const { data: modules, isLoading } = useOrganizationModules();
  if (!moduleKey) return { enabled: true, loading: false };
  if (isLoading) return { enabled: true, loading: true };
  const found = modules?.find((m) => m.moduleKey === moduleKey);
  return { enabled: !!found?.enabled, loading: false };
}

export function FeatureGate({ moduleKey, children }: { moduleKey: string; children: ReactNode }) {
  const { enabled, loading } = useModuleEnabled(moduleKey);
  if (loading) return null;
  if (enabled) return <>{children}</>;
  return <UpgradeRequired moduleKey={moduleKey} />;
}

export function UpgradeRequired({ moduleKey }: { moduleKey?: string }) {
  const { data: current } = useCurrentSubscription();
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="max-w-lg w-full text-center bg-card border border-border/70 rounded-2xl p-10 shadow-xl">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center mb-5">
          <Lock className="w-7 h-7 text-white" />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600 mb-2">Module premium</p>
        <h1 className="text-2xl font-bold tracking-tight">Cette section nécessite un plan supérieur</h1>
        <p className="text-muted-foreground mt-3 leading-relaxed">
          Votre formule actuelle{current?.plan ? ` (${current.plan.name})` : ""} n'inclut pas{" "}
          <span className="font-semibold text-foreground">{moduleKey ? labelFor(moduleKey) : "ce module"}</span>.
          Passez à une formule supérieure pour débloquer cette fonctionnalité.
        </p>
        <Link
          href="/billing"
          className="mt-7 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition-shadow"
        >
          Voir les formules <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

const LABELS: Record<string, string> = {
  dashboard: "Tableau de bord", clients: "Clients", services: "Services",
  projects: "Projets", tasks: "Tâches", sales_crm: "Ventes & Relation client",
  accounting: "Comptabilité", financial_planning: "Planification financière",
  operations: "Opérations", inventory_assets: "Parc & équipements",
  rentals: "Locations", documents: "Documents", team_hr: "Équipe & RH",
  communications: "Communications", reports: "Rapports",
  client_portal: "Portail client", marketing: "Marketing",
  administration: "Administration", billing_subscription: "Abonnement & facturation",
  workspace_settings: "Paramètres de l'espace de travail",
};
function labelFor(key: string) { return LABELS[key] ?? key; }
