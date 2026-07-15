import React from "react";
import { Link } from "wouter";
import {
  Briefcase, Building2, FileSignature, FileText, FolderKanban, Receipt, TrendingUp, Users, Wallet,
} from "lucide-react";

const LINKS = [
  { label: "Factures",       href: "/factures",       icon: FileText,      accent: "text-blue-600 bg-blue-50" },
  { label: "Devis",          href: "/devis",          icon: FileSignature, accent: "text-indigo-600 bg-indigo-50" },
  { label: "Clients",        href: "/clients",        icon: Building2,     accent: "text-emerald-600 bg-emerald-50" },
  { label: "Paiements",      href: "/paiements",      icon: Wallet,        accent: "text-green-600 bg-green-50" },
  { label: "Projets",        href: "/projets",        icon: FolderKanban,  accent: "text-violet-600 bg-violet-50" },
  { label: "Collaborateurs", href: "/collaborateurs", icon: Users,         accent: "text-orange-600 bg-orange-50" },
  { label: "Recouvrement",   href: "/recouvrement",   icon: Receipt,       accent: "text-red-600 bg-red-50" },
  { label: "Finance",        href: "/comptabilite",   icon: TrendingUp,    accent: "text-cyan-600 bg-cyan-50" },
] as const;

export function QuickLinksSection() {
  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Accès rapides</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Naviguez directement vers vos modules</p>
        </div>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2.5 mt-3">
        {LINKS.map((ql) => (
          <Link key={ql.href} href={ql.href}
            className="flex flex-col items-center gap-2 p-3 rounded-xl border border-slate-200 bg-white hover:border-primary/40 hover:shadow-md transition-all group text-center">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${ql.accent} group-hover:scale-110 transition-transform`}>
              <ql.icon className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-medium text-slate-700 leading-tight">{ql.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
