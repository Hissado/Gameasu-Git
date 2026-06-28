import { ReactNode } from "react";
import { useCurrentSubscription } from "@/lib/saas";
import { Lock, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { GameasuMark } from "@/components/branding/GameasuMark";

export function useModuleEnabled(_moduleKey: string | null | undefined) {
  return { enabled: true, loading: false };
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
      <div className="max-w-lg w-full text-center bg-card border border-border/70 rounded-xl p-10 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 gold-divider" />
        <div className="mx-auto mb-5 inline-flex items-center justify-center">
          <GameasuMark className="w-14 h-14 rounded-xl" variant="dark" />
          <span className="-ml-3 w-8 h-8 rounded-full bg-[#C8A24B] text-[#0F1A3A] flex items-center justify-center ring-4 ring-card shadow-md">
            <Lock className="w-4 h-4" />
          </span>
        </div>
        <p className="text-[10.5px] font-bold uppercase tracking-[0.28em] text-[#7A5E1F] mb-2">Module premium Gameasu</p>
        <h1 className="font-display text-[24px] font-bold tracking-[-0.03em]">Cette section nécessite un plan supérieur</h1>
        <p className="text-muted-foreground mt-3 leading-relaxed">
          Votre formule actuelle{current?.plan ? ` (${current.plan.name})` : ""} n'inclut pas{" "}
          <span className="font-semibold text-foreground">{moduleKey ? labelFor(moduleKey) : "ce module"}</span>.
          Passez à une formule supérieure pour débloquer cette fonctionnalité.
        </p>
        <Link
          href="/billing"
          className="mt-7 inline-flex items-center gap-2 rounded-lg bg-[#0F1A3A] hover:bg-[#1B2A4E] px-5 py-2.5 text-sm font-semibold text-[#C8A24B] shadow-lg hover:shadow-xl transition-all border border-[#C8A24B]/30"
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
