import { Link } from "wouter";
import { useCurrentSubscription, useBillingUsage } from "@/lib/saas";
import { PlanBadge } from "@/components/PlanBadge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, CalendarClock, AlertTriangle, ArrowRight } from "lucide-react";

export function SubscriptionWidget() {
  const { data: subData } = useCurrentSubscription();
  const { data: usage } = useBillingUsage();

  const plan = subData?.plan;
  const sub = subData?.subscription;
  const seatsUsed = usage?.seatsUsed ?? 0;
  const seatsTotal = usage?.seatsTotal ?? plan?.includedSeats ?? sub?.seats ?? 0;
  const seatsRatio = seatsTotal > 0 ? seatsUsed / seatsTotal : 0;

  const renewalDate = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  const renewalDays = renewalDate
    ? Math.ceil((renewalDate.getTime() - Date.now()) / 86_400_000)
    : null;

  const seatWarning = seatsRatio >= 0.85;
  const expiringSoon = renewalDays !== null && renewalDays <= 14 && renewalDays >= 0;
  const hasAlert = seatWarning || expiringSoon;

  if (!plan) return null;

  const renewalLabel =
    renewalDays === null ? null
    : renewalDays <= 0 ? "Expiré"
    : renewalDays === 1 ? "Demain"
    : `${renewalDays}j`;

  const renewalFull = renewalDate
    ? renewalDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
    : null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="hidden sm:flex items-center gap-1.5 mr-1.5 px-2 py-1 rounded-lg hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PlanBadge code={plan.code} name={plan.name} compact light />
            {hasAlert && <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />}
            <div className="hidden xl:flex items-center gap-1 text-[11px] text-muted-foreground">
              <Users className="w-3 h-3 shrink-0" />
              <span className={seatWarning ? "text-amber-600 font-semibold" : ""}>
                {seatsUsed}/{seatsTotal}
              </span>
              {renewalLabel && (
                <>
                  <span className="text-muted-foreground/40 mx-0.5">·</span>
                  <span className={expiringSoon ? "text-amber-600 font-semibold" : ""}>
                    {renewalLabel}
                  </span>
                </>
              )}
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent
          align="end"
          className="p-0 overflow-hidden min-w-[210px] shadow-xl border bg-background text-foreground"
          sideOffset={8}
        >
          <div className="bg-muted/50 px-3 py-2.5 border-b border-border/60">
            <p className="text-[11.5px] font-semibold text-foreground">Abonnement {plan.name}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">
              {sub?.billingCycle === "annual" ? "Facturation annuelle" : "Facturation mensuelle"}
            </p>
          </div>

          <div className="px-3 py-2.5 space-y-2.5">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-6">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Users className="w-3 h-3" />Sièges utilisés
                </span>
                <span className={`text-[11px] font-semibold ${seatWarning ? "text-amber-600" : "text-foreground"}`}>
                  {seatsUsed} / {seatsTotal}
                </span>
              </div>
              {seatsTotal > 0 && (
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all ${seatWarning ? "bg-amber-500" : "bg-primary"}`}
                    style={{ width: `${Math.min(100, Math.round(seatsRatio * 100))}%` }}
                  />
                </div>
              )}
            </div>

            {renewalFull && (
              <div className="flex items-center justify-between gap-6">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <CalendarClock className="w-3 h-3" />Renouvellement
                </span>
                <span className={`text-[11px] font-semibold ${expiringSoon ? "text-amber-600" : "text-foreground"}`}>
                  {renewalDays !== null && renewalDays <= 0 ? "Expiré" : renewalFull}
                </span>
              </div>
            )}
          </div>

          {hasAlert && (
            <div className="px-3 py-2 text-[10px] border-t border-amber-200 bg-amber-50 text-amber-700">
              {seatWarning && !expiringSoon && "Capacité quasi-atteinte — pensez à ajouter des sièges."}
              {expiringSoon && !seatWarning && `Renouvellement dans ${renewalDays}j — vérifiez votre paiement.`}
              {seatWarning && expiringSoon && "Capacité quasi-atteinte et renouvellement imminent."}
            </div>
          )}

          <div className="px-3 py-2 border-t border-border/60 bg-muted/30">
            <Link
              href="/abonnement"
              className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
            >
              Gérer l'abonnement <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
