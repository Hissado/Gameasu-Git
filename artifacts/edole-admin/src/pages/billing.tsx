import { useBillingSummary, useBillingEvents, useBillingUsage, useSubscriptionPlans, useChangePlan, useChangeBillingCycle, useCurrentSubscription } from "@/lib/saas";
import { formatFCFA } from "@/lib/format";
import { PlanBadge } from "@/components/PlanBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, CheckCircle2, Crown, Calendar, Users, Receipt, ArrowUpRight, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BRANDING } from "@/config/branding";

export default function BillingPage() {
  const { data: summary } = useBillingSummary();
  const { data: events } = useBillingEvents();
  const { data: usage } = useBillingUsage();
  const { data: plans } = useSubscriptionPlans();
  const { data: current } = useCurrentSubscription();
  const changePlan = useChangePlan();
  const changeCycle = useChangeBillingCycle();
  const { toast } = useToast();

  const currentPlanCode = current?.plan.code;
  const cycle = current?.subscription.billingCycle ?? "monthly";

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">{BRANDING.appName}</p>
        <h1 className="text-3xl font-bold tracking-tight">Abonnement & facturation</h1>
        <p className="text-muted-foreground mt-1">
          Gérez votre formule, votre cycle de facturation et consultez l'historique de votre espace de travail.
        </p>
      </header>

      {/* Résumé actuel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2 border-amber-200/60 bg-gradient-to-br from-amber-50/50 to-white">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700/80">Formule active</p>
              <div className="flex items-center gap-3 mt-1">
                <CardTitle className="text-2xl">{current?.plan.name ?? "—"}</CardTitle>
                <PlanBadge code={current?.plan.code} name={current?.plan.name} light />
              </div>
              <p className="text-muted-foreground text-sm mt-2 max-w-xl">{current?.plan.description}</p>
            </div>
            <Crown className="w-8 h-8 text-amber-500/80" />
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            <Stat icon={Users} label="Licences" value={`${usage?.seatsUsed ?? 0} / ${current?.subscription.seats ?? 0}`} />
            <Stat icon={Calendar} label="Cycle" value={cycle === "annual" ? "Annuel" : "Mensuel"} />
            <Stat icon={Receipt} label="Prix unitaire" value={formatFCFA(current?.subscription.unitPrice ?? 0)} />
            <Stat icon={CheckCircle2} label="Prochaine échéance" value={current?.subscription.currentPeriodEnd
              ? new Date(current.subscription.currentPeriodEnd).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
              : "—"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => {
                changeCycle.mutate(cycle === "annual" ? "monthly" : "annual", {
                  onSuccess: () => toast({ title: "Cycle mis à jour", description: cycle === "annual" ? "Passage en mensuel." : "Passage en annuel (économies appliquées)." }),
                });
              }}
              disabled={changeCycle.isPending}
            >
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                {cycle === "annual" ? "Repasser en mensuel" : "Passer en annuel"}
              </span>
              <ArrowUpRight className="w-4 h-4" />
            </Button>
            <Button asChild variant="outline" className="w-full justify-between">
              <a href={`mailto:${BRANDING.appName.toLowerCase()}-sales@gameasu.africa`}>
                Contacter le commercial <ArrowUpRight className="w-4 h-4" />
              </a>
            </Button>
            <p className="text-[11px] text-muted-foreground pt-2">
              Le changement de cycle s'applique au prochain renouvellement.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Modules inclus */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Modules inclus dans votre formule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {(current?.plan.includedModules ?? []).map((m) => (
              <div key={m} className="flex items-center gap-2 text-sm text-foreground/80">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                {LABELS[m] ?? m}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Plans */}
      <section>
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold">Évoluer ou changer de formule</h2>
            <p className="text-sm text-muted-foreground">Tarifs en FCFA — facturé {cycle === "annual" ? "annuellement" : "mensuellement"} par utilisateur.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {(plans ?? []).map((p) => {
            const price = cycle === "annual" ? p.annualPricePerSeat : p.monthlyPricePerSeat;
            const isCurrent = p.code === currentPlanCode;
            return (
              <Card key={p.id} className={`relative ${p.isFeatured ? "border-amber-400 shadow-lg" : ""}`}>
                {p.isFeatured && (
                  <span className="absolute -top-2 right-4 text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-full px-2.5 py-0.5">
                    Le plus choisi
                  </span>
                )}
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{p.name}</CardTitle>
                    <PlanBadge code={p.code} compact />
                  </div>
                  <p className="text-xs text-muted-foreground">{p.tagline}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-3xl font-bold tracking-tight">{formatFCFA(price)}</p>
                    <p className="text-[11px] text-muted-foreground">/ utilisateur / {cycle === "annual" ? "an" : "mois"}</p>
                    {p.setupFee > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-1">+ Frais d'installation {formatFCFA(p.setupFee)}</p>
                    )}
                  </div>
                  <ul className="space-y-1.5 text-sm">
                    {(p.features ?? []).map((f) => (
                      <li key={f.id} className="flex gap-2">
                        <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                        <span>{f.label}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={isCurrent || changePlan.isPending}
                    onClick={() => changePlan.mutate(p.code, {
                      onSuccess: () => toast({ title: "Formule mise à jour", description: `Vous êtes maintenant sur ${p.name}.` }),
                      onError: (e) => toast({ variant: "destructive", title: "Échec", description: e.message }),
                    })}
                  >
                    {isCurrent ? "Formule actuelle" : "Choisir cette formule"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Historique */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique de facturation</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5">Date</th>
                  <th className="text-left px-4 py-2.5">Description</th>
                  <th className="text-left px-4 py-2.5">Référence</th>
                  <th className="text-right px-4 py-2.5">Montant</th>
                  <th className="text-left px-4 py-2.5">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {(events ?? []).map((e) => (
                  <tr key={e.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                      {new Date(e.occurredAt).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-2.5">{e.label}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{e.reference ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{formatFCFA(e.amount)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[11px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5 ${
                        e.status === "paid" ? "bg-emerald-100 text-emerald-700" :
                        e.status === "pending" ? "bg-amber-100 text-amber-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        {e.status === "paid" ? "Payé" : e.status === "pending" ? "En attente" : e.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {(events ?? []).length === 0 && (
                  <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">Aucun évènement</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <p className="mt-1 text-base font-semibold">{value}</p>
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
