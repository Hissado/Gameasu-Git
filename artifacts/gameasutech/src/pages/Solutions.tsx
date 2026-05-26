import React, { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useLanguage } from "@/context/LanguageContext";
import { CTASection } from "@/components/CTASection";
import {
  LayoutGrid,
  Users,
  BadgeDollarSign,
  Headphones,
  Puzzle,
  Globe,
  BarChart3,
  Building2,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  Clock,
  FlaskConical,
  Sparkles,
} from "lucide-react";

type Status = "available" | "demo" | "soon" | "custom" | "portal";

interface Solution {
  icon: React.ElementType;
  nameFr: string;
  nameEn: string;
  descFr: string;
  descEn: string;
  categoryFr: string;
  categoryEn: string;
  status: Status;
  href: string;
  external?: boolean;
  highlightColor: string;
  iconBg: string;
  iconColor: string;
}

const solutions: Solution[] = [
  {
    icon: Building2,
    nameFr: "Gaméasù ERP",
    nameEn: "Gaméasù ERP",
    descFr: "Plateforme de gestion opérationnelle intégrée : achats, stocks, ventes, production et reporting en temps réel.",
    descEn: "Integrated operational management platform: purchasing, inventory, sales, production, and real-time reporting.",
    categoryFr: "ERP & Gestion",
    categoryEn: "ERP & Management",
    status: "demo",
    href: "/contact",
    highlightColor: "border-blue-200 hover:border-blue-400",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-700",
  },
  {
    icon: Globe,
    nameFr: "Portail Client",
    nameEn: "Client Portal",
    descFr: "Espace sécurisé permettant à vos clients d'accéder à leurs données, contrats, factures et demandes en ligne.",
    descEn: "Secure space allowing your clients to access their data, contracts, invoices, and service requests online.",
    categoryFr: "Portails",
    categoryEn: "Portals",
    status: "available",
    href: "/contact",
    highlightColor: "border-primary/30 hover:border-primary",
    iconBg: "bg-primary/8",
    iconColor: "text-primary",
  },
  {
    icon: Users,
    nameFr: "Gaméasù RH",
    nameEn: "Gaméasù HR",
    descFr: "Solution complète de gestion des ressources humaines : personnel, paie, congés, performance et recrutement.",
    descEn: "Complete HR management solution: personnel, payroll, leave, performance tracking, and recruitment.",
    categoryFr: "Ressources Humaines",
    categoryEn: "Human Resources",
    status: "soon",
    href: "/contact",
    highlightColor: "border-purple-200 hover:border-purple-400",
    iconBg: "bg-purple-50",
    iconColor: "text-purple-700",
  },
  {
    icon: BadgeDollarSign,
    nameFr: "Gaméasù Finance",
    nameEn: "Gaméasù Finance",
    descFr: "Plateforme de gestion financière et comptable : budgets, trésorerie, reporting SYSCOHADA et tableaux de bord.",
    descEn: "Financial and accounting management platform: budgets, cash flow, SYSCOHADA reporting, and dashboards.",
    categoryFr: "Finance & Comptabilité",
    categoryEn: "Finance & Accounting",
    status: "demo",
    href: "/contact",
    highlightColor: "border-green-200 hover:border-green-400",
    iconBg: "bg-green-50",
    iconColor: "text-green-700",
  },
  {
    icon: Headphones,
    nameFr: "Plateforme Support & Ticketing",
    nameEn: "Support & Ticketing Platform",
    descFr: "Gestion centralisée des incidents, tickets, SLA et base de connaissances pour vos équipes support et vos clients.",
    descEn: "Centralized incident management, tickets, SLAs, and knowledge base for support teams and clients.",
    categoryFr: "Support",
    categoryEn: "Support",
    status: "available",
    href: "/support",
    highlightColor: "border-orange-200 hover:border-orange-400",
    iconBg: "bg-orange-50",
    iconColor: "text-orange-700",
  },
  {
    icon: Puzzle,
    nameFr: "Applications Métiers Sur Mesure",
    nameEn: "Custom Business Applications",
    descFr: "Développement d'applications métiers personnalisées adaptées à vos processus spécifiques et votre secteur d'activité.",
    descEn: "Custom business application development tailored to your specific processes and industry.",
    categoryFr: "Sur Mesure",
    categoryEn: "Custom",
    status: "custom",
    href: "/contact",
    highlightColor: "border-indigo-200 hover:border-indigo-400",
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-700",
  },
  {
    icon: BarChart3,
    nameFr: "Data & Analytics",
    nameEn: "Data & Analytics",
    descFr: "Tableaux de bord décisionnels, rapports automatisés et visualisation de données pour piloter votre activité.",
    descEn: "Decision-making dashboards, automated reports, and data visualization to steer your business.",
    categoryFr: "Intelligence & Data",
    categoryEn: "Intelligence & Data",
    status: "soon",
    href: "/contact",
    highlightColor: "border-cyan-200 hover:border-cyan-400",
    iconBg: "bg-cyan-50",
    iconColor: "text-cyan-700",
  },
  {
    icon: LayoutGrid,
    nameFr: "Portail Partenaires",
    nameEn: "Partner Portal",
    descFr: "Espace collaboratif dédié aux partenaires : ressources, formations, suivi des opportunités et outils de co-vente.",
    descEn: "Dedicated collaborative space for partners: resources, training, opportunity tracking, and co-selling tools.",
    categoryFr: "Portails",
    categoryEn: "Portals",
    status: "portal",
    href: "/partners",
    highlightColor: "border-slate-200 hover:border-slate-400",
    iconBg: "bg-slate-50",
    iconColor: "text-slate-700",
  },
];

const statusConfig = {
  available: {
    labelFr: "Disponible",
    labelEn: "Available",
    className: "bg-green-50 text-green-700 border border-green-200",
    icon: CheckCircle2,
  },
  demo: {
    labelFr: "Démo disponible",
    labelEn: "Demo available",
    className: "bg-blue-50 text-blue-700 border border-blue-200",
    icon: FlaskConical,
  },
  soon: {
    labelFr: "Bientôt disponible",
    labelEn: "Coming soon",
    className: "bg-amber-50 text-amber-700 border border-amber-200",
    icon: Clock,
  },
  custom: {
    labelFr: "Sur mesure",
    labelEn: "Custom build",
    className: "bg-indigo-50 text-indigo-700 border border-indigo-200",
    icon: Sparkles,
  },
  portal: {
    labelFr: "Portail actif",
    labelEn: "Active portal",
    className: "bg-primary/8 text-primary border border-primary/20",
    icon: Globe,
  },
};

const allCategoriesFr = ["Tous", ...Array.from(new Set(solutions.map((s) => s.categoryFr)))];
const allCategoriesEn = ["All", ...Array.from(new Set(solutions.map((s) => s.categoryEn)))];

export default function Solutions() {
  const { language } = useLanguage();
  const fr = language === "fr";
  const [activeCategory, setActiveCategory] = useState(0);

  const categories = fr ? allCategoriesFr : allCategoriesEn;

  const filtered =
    activeCategory === 0
      ? solutions
      : solutions.filter((s) =>
          fr ? s.categoryFr === allCategoriesFr[activeCategory] : s.categoryEn === allCategoriesEn[activeCategory]
        );

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative pt-24 pb-14 bg-gradient-to-br from-slate-50 via-blue-50/30 to-white overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-100/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl">
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">
              {fr ? "Nos Solutions" : "Our Solutions"}
            </p>
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900 leading-tight mb-6">
              {fr
                ? "Des plateformes prêtes à l'usage, personnalisables à votre mesure"
                : "Ready-to-use platforms, tailored to your needs"}
            </h1>
            <p className="text-xl text-slate-500 leading-relaxed mb-8 max-w-2xl">
              {fr
                ? "Gaméasù propose un catalogue de solutions digitales — ERP, portails, RH, finance, support — déployables rapidement et adaptables aux besoins spécifiques de chaque organisation."
                : "Gaméasù offers a catalog of digital solutions — ERP, portals, HR, finance, support — quickly deployable and adaptable to the specific needs of each organization."}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/contact">
                <div className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors cursor-pointer shadow-sm">
                  {fr ? "Demander une démo" : "Request a demo"}
                  <ArrowRight size={16} />
                </div>
              </Link>
              <Link href="/contact">
                <div className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer">
                  {fr ? "Parler à un expert" : "Talk to an expert"}
                </div>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Filter bar */}
      <div className="sticky top-[57px] z-30 bg-white/95 backdrop-blur-sm border-b border-slate-100 shadow-sm">
        <div className="container mx-auto px-6">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-3">
            {categories.map((cat, i) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(i)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  activeCategory === i
                    ? "bg-primary text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Solutions grid */}
      <section className="py-16 pb-28 bg-white">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((sol, i) => {
              const status = statusConfig[sol.status];
              const StatusIcon = status.icon;
              const isInternal = !sol.external;
              return (
                <motion.div
                  key={sol.nameFr}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 }}
                >
                  <div className={`group h-full flex flex-col bg-white border-2 ${sol.highlightColor} rounded-2xl p-7 transition-all duration-300 hover:shadow-xl hover:-translate-y-1`}>
                    {/* Header */}
                    <div className="flex items-start justify-between mb-5">
                      <div className={`p-3 rounded-xl ${sol.iconBg}`}>
                        <sol.icon size={22} className={sol.iconColor} />
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${status.className}`}>
                        <StatusIcon size={11} />
                        {fr ? status.labelFr : status.labelEn}
                      </span>
                    </div>

                    {/* Category pill */}
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
                      {fr ? sol.categoryFr : sol.categoryEn}
                    </p>

                    {/* Name */}
                    <h3 className="text-lg font-bold text-slate-900 mb-3 group-hover:text-primary transition-colors">
                      {fr ? sol.nameFr : sol.nameEn}
                    </h3>

                    {/* Description */}
                    <p className="text-sm text-slate-500 leading-relaxed flex-1 mb-6">
                      {fr ? sol.descFr : sol.descEn}
                    </p>

                    {/* CTA */}
                    {isInternal ? (
                      <Link href={sol.href}>
                        <div className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:gap-3 transition-all cursor-pointer group/btn">
                          {sol.status === "available" || sol.status === "portal"
                            ? fr ? "Accéder au portail" : "Access portal"
                            : sol.status === "demo"
                            ? fr ? "Demander une démo" : "Request a demo"
                            : sol.status === "custom"
                            ? fr ? "Nous contacter" : "Contact us"
                            : fr ? "Être notifié" : "Get notified"}
                          <ArrowRight size={15} className="group-hover/btn:translate-x-1 transition-transform" />
                        </div>
                      </Link>
                    ) : (
                      <a
                        href={sol.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:gap-3 transition-all"
                      >
                        {fr ? "Accéder" : "Access"}
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Empty state */}
          {filtered.length === 0 && (
            <div className="text-center py-20 text-slate-400">
              <LayoutGrid size={40} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg">{fr ? "Aucune solution dans cette catégorie." : "No solutions in this category."}</p>
            </div>
          )}
        </div>
      </section>

      {/* Bottom value strip */}
      <section className="bg-slate-50 border-t border-slate-100 py-14">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {[
              {
                fr: { title: "Déploiement rapide", desc: "Mise en production en quelques semaines, non en mois." },
                en: { title: "Fast deployment", desc: "Go live in weeks, not months." },
              },
              {
                fr: { title: "Entièrement personnalisable", desc: "Chaque solution s'adapte à vos processus et votre organisation." },
                en: { title: "Fully customizable", desc: "Every solution adapts to your processes and organization." },
              },
              {
                fr: { title: "Support & formation inclus", desc: "Accompagnement continu et formation de vos équipes sur chaque produit." },
                en: { title: "Support & training included", desc: "Ongoing support and team training on every product." },
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/8 text-primary flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={20} />
                </div>
                <h4 className="font-bold text-slate-900 mb-2">{fr ? item.fr.title : item.en.title}</h4>
                <p className="text-sm text-slate-500 leading-relaxed">{fr ? item.fr.desc : item.en.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <CTASection
        title={fr ? "Prêt à déployer votre solution ?" : "Ready to deploy your solution?"}
        subtitle={fr
          ? "Nos experts vous accompagnent de la démo à la mise en production. Réponse garantie sous 24 heures."
          : "Our experts guide you from demo to production. Response guaranteed within 24 hours."}
        btnText={fr ? "Demander une consultation" : "Request a consultation"}
        href="/contact"
      />
    </div>
  );
}
