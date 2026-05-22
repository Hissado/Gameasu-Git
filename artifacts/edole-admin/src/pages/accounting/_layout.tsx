import React from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

const TABS = [
  { path: "/accounting", label: "Tableau financier" },
  { path: "/accounting/chart-of-accounts", label: "Plan comptable" },
  { path: "/accounting/entries", label: "Écritures" },
  { path: "/accounting/matching", label: "Lettrage" },
  { path: "/accounting/ledger", label: "Grand livre" },
  { path: "/accounting/balance", label: "Balance" },
  { path: "/accounting/income-statement", label: "Résultat" },
  { path: "/accounting/balance-sheet", label: "Bilan" },
  { path: "/accounting/taxes", label: "États fiscaux" },
  { path: "/accounting/fiscal-periods", label: "Exercices" },
  { path: "/accounting/customers", label: "Clients" },
  { path: "/accounting/suppliers", label: "Fournisseurs" },
  { path: "/accounting/banks", label: "Banques" },
  { path: "/accounting/fixed-assets", label: "Immobilisations" },
  { path: "/accounting/analytical", label: "Analytique" },
];

export function AccountingShell({ title, subtitle, actions, children }: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [loc] = useLocation();
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      <div className="border-b border-border overflow-x-auto">
        <nav className="flex gap-1 -mb-px">
          {TABS.map((t) => {
            const active = loc === t.path || (t.path !== "/accounting" && loc.startsWith(t.path));
            return (
              <Link
                key={t.path}
                href={t.path}
                className={cn(
                  "px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition",
                  active
                    ? "border-amber-500 text-amber-700"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-slate-300"
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div>{children}</div>
    </div>
  );
}
