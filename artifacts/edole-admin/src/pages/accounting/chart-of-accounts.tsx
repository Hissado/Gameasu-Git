import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { AccountingShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, BookOpen } from "lucide-react";
import { useModuleTour, WelcomeModal, OnboardingTour, TOUR_PATHS } from "@/components/ui/onboarding-tour";

type OrgFramework = { orgType: string; orgTypeLabel: string; accountingFramework: string; frameworkLabel: string; frameworkDescription: string };

type Acc = {
  id: string; code: string; label: string; classNum: number;
  type: string; normalBalance: string; isPostable: boolean;
  applicableFrameworks?: string[] | null;
  origin?: string | null; isSystem?: boolean; isActive?: boolean;
  customLabel?: string | null;
};

// Badge d'origine du compte (§6) : Système / Modèle / Personnalisé / Importé.
function OriginBadge({ acc }: { acc: Acc }) {
  if (acc.isSystem) return <Badge className="text-xs bg-rose-100 text-rose-700 border border-rose-200 hover:bg-rose-100">Système</Badge>;
  switch (acc.origin) {
    case "template":  return <Badge className="text-xs bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-100">Modèle</Badge>;
    case "imported":  return <Badge className="text-xs bg-violet-100 text-violet-700 border border-violet-200 hover:bg-violet-100">Importé</Badge>;
    case "custom":    return <Badge className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">Personnalisé</Badge>;
    default:          return null;
  }
}

const TYPE_LABELS: Record<string, string> = {
  asset:     "Actif",
  liability: "Passif",
  equity:    "Capitaux propres",
  revenue:   "Produit",
  expense:   "Charge",
};

const BALANCE_LABELS: Record<string, string> = {
  debit:  "Débit",
  credit: "Crédit",
};

const CLASS_LABELS: Record<number, string> = {
  1: "Capitaux et ressources durables",
  2: "Immobilisations",
  3: "Stocks et en-cours",
  4: "Comptes de tiers",
  5: "Comptes financiers",
  6: "Charges des activités ordinaires",
  7: "Produits des activités ordinaires",
};

const COA_TOUR = [
  { target: "coa-header", title: "Plan comptable SYSCOHADA", description: "Référentiel de tous vos comptes de gestion, organisé en 7 classes selon le système comptable ouest-africain SYSCOHADA." },
  { target: "coa-search", title: "Recherche de comptes", description: "Recherchez un compte par son code (ex: 411) ou son libellé (ex: Clients et comptes rattachés)." },
  { target: "coa-classes", title: "Comptes par classe", description: "Chaque groupe représente une classe comptable. Consultez le type (actif, passif, charge, produit) et le sens normal de chaque compte." },
];

export default function ChartOfAccounts() {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("");
  const [showInactive, setShowInactive] = useState(false);

  const { data, isLoading } = useQuery<{ data: Acc[] }>({
    queryKey: ["chart-of-accounts", search, classFilter, showInactive],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (search) qs.set("search", search);
      if (classFilter) qs.set("classNum", classFilter);
      if (showInactive) qs.set("includeInactive", "true");
      return apiFetch(`/api/accounting/chart-of-accounts?${qs}`);
    },
  });

  const { data: fwData } = useQuery<OrgFramework>({
    queryKey: ["org-accounting-framework"],
    queryFn: () => apiFetch("/api/organizations/accounting-framework"),
    staleTime: 10 * 60 * 1000,
  });
  const { showWelcome, tourActive, startTour, startTourWithPath, dismissWelcome, closeTour, selectedPathKey, handleTourStepChange, tourInitialStep, tourPathLabel } = useModuleTour("plan_comptable", !isLoading);
  const activeSteps = TOUR_PATHS["plan_comptable"]?.find(p => p.key === selectedPathKey)?.steps ?? COA_TOUR;

  const grouped = (data?.data ?? []).reduce((acc, a) => {
    (acc[a.classNum] ??= []).push(a);
    return acc;
  }, {} as Record<number, Acc[]>);

  const fwLabel = fwData?.frameworkLabel ?? "SYSCOHADA";
  const fwDesc = fwData?.frameworkDescription ?? "Système Comptable Ouest-Africain";

  return (
    <AccountingShell
      title={`Plan comptable — ${fwLabel}`}
      subtitle={fwDesc}
    >
      {showWelcome && (
        <WelcomeModal
          title="Plan Comptable"
          subtitle="Découvrez le référentiel SYSCOHADA : classes, comptes et sens normaux."
          icon={BookOpen}
          steps={activeSteps}
          paths={TOUR_PATHS["plan_comptable"]}
          onStartPath={startTourWithPath}
          onStart={startTour}
          onDismiss={dismissWelcome}
        />
      )}
      {tourActive && (
        <OnboardingTour
          steps={activeSteps}
          onClose={closeTour}
          pathLabel={tourPathLabel}
          initialStep={tourInitialStep}
          onStepChange={handleTourStepChange}
        />
      )}
      <div data-tour="coa-header" className="flex items-center gap-3 mb-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
        <BookOpen className="w-5 h-5 text-amber-600 shrink-0" />
        <div>
          <p className="font-semibold text-sm text-foreground">{fwLabel}</p>
          <p className="text-xs text-muted-foreground">{fwDesc}</p>
        </div>
      </div>
      <div data-tour="coa-search" className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher par code ou libellé…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="border border-border rounded-md px-3 text-sm h-10">
          <option value="">Toutes les classes</option>
          {Object.entries(CLASS_LABELS).map(([n, l]) => <option key={n} value={n}>Classe {n} — {l}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground h-10 px-1 cursor-pointer select-none">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="accent-amber-600" />
          Afficher les comptes désactivés
        </label>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div data-tour="coa-classes" className="space-y-6">
          {Object.entries(grouped).sort(([a], [b]) => Number(a) - Number(b)).map(([cls, accs]) => (
            <Card key={cls}>
              <CardContent className="p-0">
                <div className="px-5 py-3 bg-amber-50 border-b border-border flex items-center justify-between">
                  <div className="font-bold">Classe {cls} — {CLASS_LABELS[Number(cls)]}</div>
                  <Badge variant="secondary">{accs.length} comptes</Badge>
                </div>
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground bg-muted/50">
                    <tr>
                      <th className="text-left px-5 py-2 w-32">Code</th>
                      <th className="text-left px-5 py-2">Libellé</th>
                      <th className="text-left px-5 py-2 w-32">Nature</th>
                      <th className="text-left px-5 py-2 w-32">Type</th>
                      <th className="text-left px-5 py-2 w-32">Sens normal</th>
                      <th className="text-left px-5 py-2 w-36">Référentiel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accs.map((a) => (
                      <tr key={a.id} className={`border-t hover:bg-muted/50 ${a.isActive === false ? "opacity-50" : ""}`}>
                        <td className="px-5 py-2 font-mono font-semibold">{a.code}</td>
                        <td className="px-5 py-2">
                          {a.customLabel || a.label}
                          {a.customLabel && <span className="ml-2 text-xs text-muted-foreground">({a.label})</span>}
                          {!a.isPostable && <Badge variant="outline" className="ml-2 text-xs">Regroupement</Badge>}
                          {a.isActive === false && <Badge variant="outline" className="ml-2 text-xs text-muted-foreground">Désactivé</Badge>}
                        </td>
                        <td className="px-5 py-2"><OriginBadge acc={a} /></td>
                        <td className="px-5 py-2 text-xs">{TYPE_LABELS[a.type] ?? a.type}</td>
                        <td className="px-5 py-2 text-xs">{BALANCE_LABELS[a.normalBalance] ?? a.normalBalance}</td>
                        <td className="px-5 py-2 flex flex-wrap gap-1">
                          {(a.applicableFrameworks && a.applicableFrameworks.length > 0
                            ? a.applicableFrameworks
                            : [fwData?.accountingFramework ?? "syscohada"]
                          ).map(fw => (
                            <Badge key={fw} variant="secondary" className="text-xs font-mono">{fw.toUpperCase().replace("_SMT", " SMT")}</Badge>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AccountingShell>
  );
}
