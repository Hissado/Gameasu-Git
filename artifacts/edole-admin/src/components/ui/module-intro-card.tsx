import React from "react";
import { X, BookOpen, ArrowRight } from "lucide-react";
import {
  LayoutDashboard, Target, FolderKanban, FileText,
  UsersRound, ShoppingCart, Truck, MessageSquare,
  Plus, CreditCard, Building, FileSignature, Users,
  ClipboardCheck, Package, Receipt, Search, Calculator,
  BarChart3, Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RELAUNCH_EVENT } from "@/components/ui/onboarding-tour";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";

export type IntroAction = {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
};

export type ModuleIntroConfig = {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  description: string;
  actions: IntroAction[];
};

export const MODULE_INTRO_MAP: Record<string, ModuleIntroConfig> = {
  dashboard: {
    icon: LayoutDashboard,
    name: "Tableau de bord",
    description:
      "Visualisez l'état de votre activité en un coup d'œil : encaissements du mois, créances ouvertes, pipeline CRM et projets actifs. Les alertes prioritaires remontent automatiquement les factures et tâches en retard à traiter en urgence.",
    actions: [
      { label: "Factures", href: "/factures", icon: FileText },
      { label: "Pipeline CRM", href: "/crm", icon: Target },
      { label: "Projets", href: "/projets", icon: FolderKanban },
    ],
  },
  crm: {
    icon: Target,
    name: "Pipeline Commercial",
    description:
      "Gérez vos opportunités de vente en kanban, du premier contact jusqu'à la signature. Suivez la valeur et la probabilité de chaque deal, et convertissez les prospects gagnés en fiches clients en un clic.",
    actions: [
      { label: "Clients", href: "/clients", icon: Building },
      { label: "Devis", href: "/devis", icon: FileSignature },
    ],
  },
  projets: {
    icon: FolderKanban,
    name: "Gestion de Projets",
    description:
      "Pilotez votre portefeuille projets avec phases, livrables et budgets prévisionnels. Assignez des tâches aux collaborateurs, suivez l'avancement en temps réel et analysez les écarts budgétaires pour chaque chantier.",
    actions: [
      { label: "Tâches", href: "/tasks", icon: ClipboardCheck },
      { label: "Charge équipe", href: "/charge", icon: Users },
    ],
  },
  factures: {
    icon: FileText,
    name: "Facturation",
    description:
      "Créez et envoyez vos factures SYSCOHADA en quelques clics, suivez les encaissements et pilotez vos créances clients. Le module remonte automatiquement les retards pour déclencher vos relances au bon moment.",
    actions: [
      { label: "Encaissements", href: "/paiements", icon: CreditCard },
      { label: "Recouvrement", href: "/recouvrement", icon: Receipt },
    ],
  },
  rh: {
    icon: UsersRound,
    name: "Ressources Humaines",
    description:
      "Gérez les fiches collaborateurs, contrats, paie, congés et performances de votre équipe. Le module couvre l'ensemble du cycle RH : recrutement, onboarding, bulletins de paie et bilans annuels.",
    actions: [
      { label: "Présences", href: "/presences", icon: ClipboardCheck },
      { label: "Paie", href: "/rh/paie", icon: CreditCard },
    ],
  },
  achats: {
    icon: ShoppingCart,
    name: "Module Achats",
    description:
      "Centralisez vos achats fournisseurs : bons de commande, factures reçues et décaissements. Le tableau de bord identifie les factures à échéance proche et les fournisseurs stratégiques pour optimiser votre trésorerie.",
    actions: [
      { label: "Fournisseurs", href: "/achats/fournisseurs", icon: Building },
      { label: "Factures reçues", href: "/achats/factures", icon: FileText },
      { label: "Bons de commande", href: "/achats/bons-de-commande", icon: Package },
    ],
  },
  logistique: {
    icon: Truck,
    name: "Locations & Logistique",
    description:
      "Gérez les contrats de location d'équipements, de la réservation à la restitution. Planifiez les états des lieux pré et post-location et suivez les mouvements logistiques de votre parc matériel.",
    actions: [
      { label: "Équipements", href: "/equipements", icon: Package },
      { label: "Inspections", href: "/inspections", icon: ClipboardCheck },
      { label: "Opérations", href: "/operations", icon: Truck },
    ],
  },
  messagerie: {
    icon: MessageSquare,
    name: "Messagerie",
    description:
      "Hub conversationnel interne pour votre équipe : messages directs, groupes projets et échanges clients. Partagez des fichiers, des positions GPS et des messages vocaux, et suivez les accusés de lecture en temps réel.",
    actions: [
      { label: "Nouvelle discussion", href: "/messaging", icon: Plus },
      { label: "Rechercher", href: "/messaging", icon: Search },
    ],
  },
  comptabilite: {
    icon: Calculator,
    name: "Comptabilité & Finance",
    description:
      "Pilotez vos finances avec le plan de comptes SYSCOHADA, les journaux d'écritures, le grand livre et les états financiers. Le tableau de bord consolide trésorerie, créances clients et dettes fournisseurs en temps réel.",
    actions: [
      { label: "Trésorerie", href: "/finance/tresorerie", icon: Banknote },
      { label: "Rapports financiers", href: "/rapports", icon: BarChart3 },
      { label: "Budgets & prévisions", href: "/fpa", icon: Target },
    ],
  },
};

export function useModuleIntro(moduleKey: string) {
  const { user } = useAuth();
  const storageKey = `intro_seen:${user?.id ?? "anon"}:${moduleKey}`;

  const [shouldShow, setShouldShow] = React.useState(() => {
    try { return !localStorage.getItem(storageKey); } catch { return false; }
  });

  // Recompute when storageKey changes — guards against async user resolution
  // where the first render uses "anon" before the real userId is available.
  React.useEffect(() => {
    try {
      setShouldShow(!localStorage.getItem(storageKey));
    } catch {}
  }, [storageKey]);

  const dismiss = React.useCallback(() => {
    try { localStorage.setItem(storageKey, "1"); } catch {}
    setShouldShow(false);
  }, [storageKey]);

  return { shouldShow, dismiss };
}

type ModuleIntroCardProps = {
  moduleKey: string;
  tourKey?: string;
};

export function ModuleIntroCard({ moduleKey, tourKey }: ModuleIntroCardProps) {
  const { shouldShow, dismiss } = useModuleIntro(moduleKey);
  const config = MODULE_INTRO_MAP[moduleKey];

  if (!shouldShow || !config) return null;

  const handleViewGuide = () => {
    dismiss();
    const key = tourKey ?? moduleKey;
    window.dispatchEvent(new CustomEvent(RELAUNCH_EVENT, { detail: key }));
  };

  const Icon = config.icon;

  return (
    <div className="relative rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/80 to-indigo-50/60 px-4 py-3.5 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-start shadow-sm">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="shrink-0 w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center mt-0.5">
          <Icon className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Découvrir ce module</span>
          </div>
          <p className="text-sm font-semibold text-slate-800 mb-0.5">{config.name}</p>
          <p className="text-xs text-slate-600 leading-relaxed">{config.description}</p>
          {config.actions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2.5">
              {config.actions.map((action) => (
                <Link key={`${action.href}-${action.label}`} href={action.href} onClick={dismiss}>
                  <button className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors">
                    {action.icon && <action.icon className="w-3.5 h-3.5" />}
                    {action.label}
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 sm:mt-0.5 self-start">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-blue-600 hover:bg-blue-100 gap-1.5"
          onClick={handleViewGuide}
        >
          <BookOpen className="w-3.5 h-3.5" />
          Voir le guide
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-slate-500 hover:bg-slate-100 gap-1"
          onClick={dismiss}
        >
          <X className="w-3.5 h-3.5" />
          Compris
        </Button>
      </div>
    </div>
  );
}
