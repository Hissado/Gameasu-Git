import React, { useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { CTASection } from "@/components/CTASection";
import { ArrowRight, TrendingUp, Shield, Cloud, Zap, ChevronDown } from "lucide-react";

const cases = [
  {
    icon: TrendingUp,
    categoryFr: "Transformation Digitale",
    categoryEn: "Digital Transformation",
    titleFr: "Modernisation IT complète pour une PME industrielle multi-sites",
    titleEn: "Complete IT modernization for a multi-site industrial SME",
    contextFr: "Un groupe industriel de taille intermédiaire (450 salariés, 6 sites de production en Afrique de l'Ouest) fonctionnait avec des infrastructures IT hétérogènes âgées de 10 à 15 ans. Chaque site opérait de manière indépendante, sans consolidation des données ni outils de collaboration centralisés.",
    contextEn: "A mid-sized industrial group (450 employees, 6 production sites in West Africa) operated with heterogeneous IT infrastructure aged 10-15 years. Each site operated independently, with no data consolidation or centralized collaboration tools.",
    challengeFr: "Unifier l'infrastructure IT de 6 sites, migrer les données vers le cloud, déployer des outils de collaboration modernes et former 450 utilisateurs — le tout avec un budget maîtrisé et sans interruption de production.",
    challengeEn: "Unify IT infrastructure across 6 sites, migrate data to the cloud, deploy modern collaboration tools, and train 450 users — all within a controlled budget and without production interruption.",
    solutionFr: "Déploiement d'une architecture SD-WAN pour interconnecter les sites, migration des données vers un cloud hybride sécurisé, déploiement de la suite Microsoft 365, implémentation d'un ERP cloud et programme de formation sur 3 mois.",
    solutionEn: "Deployment of SD-WAN architecture to interconnect sites, migration of data to a secure hybrid cloud, deployment of Microsoft 365 suite, implementation of a cloud ERP, and 3-month training program.",
    resultsFr: ["Réduction de 40% des coûts IT opérationnels", "Productivité augmentée de 25% sur les fonctions support", "Temps de traitement des commandes réduit de 3 jours à 4 heures", "Disponibilité des systèmes : 99.7% uptime"],
    resultsEn: ["40% reduction in operational IT costs", "25% productivity increase in support functions", "Order processing time reduced from 3 days to 4 hours", "System availability: 99.7% uptime"],
    duration: "8 mois / 8 months",
    color: "from-blue-900/30 to-blue-800/10",
    accent: "text-blue-400"
  },
  {
    icon: Zap,
    categoryFr: "Automatisation",
    categoryEn: "Automation",
    titleFr: "Automatisation des processus RH pour une organisation internationale",
    titleEn: "HR process automation for an international organization",
    contextFr: "Une organisation internationale (1200 employés dans 8 pays) gérait ses processus RH — recrutement, onboarding, gestion des congés, paie — via des tableurs Excel et des emails. Les délais de traitement étaient longs et les erreurs fréquentes.",
    contextEn: "An international organization (1,200 employees in 8 countries) managed its HR processes — recruitment, onboarding, leave management, payroll — via Excel spreadsheets and emails. Processing delays were long and errors frequent.",
    challengeFr: "Digitaliser et automatiser les processus RH dans 8 pays avec des contraintes réglementaires locales différentes, des langues multiples et une organisation décentralisée.",
    challengeEn: "Digitize and automate HR processes across 8 countries with different local regulatory constraints, multiple languages, and a decentralized organization.",
    solutionFr: "Déploiement d'un SIRH cloud centralisé avec des modules RPA (Robotic Process Automation) pour l'automatisation des tâches répétitives, des workflows d'approbation intelligents et un portail self-service employés.",
    solutionEn: "Deployment of a centralized cloud HRIS with RPA (Robotic Process Automation) modules for automating repetitive tasks, intelligent approval workflows, and an employee self-service portal.",
    resultsFr: ["80% de réduction du temps de traitement des demandes RH", "Elimination de 95% des erreurs de saisie manuelle", "Économie de 2 ETP (équivalents temps plein) réaffectés sur des missions à valeur ajoutée", "Satisfaction employés en hausse de 40 points"],
    resultsEn: ["80% reduction in HR request processing time", "Elimination of 95% of manual data entry errors", "Savings of 2 FTEs reassigned to value-added missions", "Employee satisfaction up 40 points"],
    duration: "6 mois / 6 months",
    color: "from-violet-900/30 to-violet-800/10",
    accent: "text-violet-400"
  },
  {
    icon: Shield,
    categoryFr: "Cybersécurité",
    categoryEn: "Cybersecurity",
    titleFr: "Sécurisation d'infrastructure réseau pour une institution financière",
    titleEn: "Network infrastructure security for a financial institution",
    contextFr: "Une institution financière régionale (350 salariés, 12 agences) avait subi deux incidents de sécurité majeurs en 18 mois. L'audit de sécurité révélait des vulnérabilités critiques dans l'infrastructure réseau et des lacunes importantes dans les processus de gestion des identités.",
    contextEn: "A regional financial institution (350 employees, 12 branches) had experienced two major security incidents in 18 months. The security audit revealed critical vulnerabilities in network infrastructure and significant gaps in identity management processes.",
    challengeFr: "Sécuriser l'ensemble de l'infrastructure en 90 jours tout en assurant la continuité des opérations bancaires critiques, et se mettre en conformité avec les réglementations locales de la COBAC et les standards PCI-DSS.",
    challengeEn: "Secure the entire infrastructure within 90 days while ensuring continuity of critical banking operations, and achieve compliance with local COBAC regulations and PCI-DSS standards.",
    solutionFr: "Implémentation d'un SOC managé 24/7, déploiement d'une solution EDR sur l'ensemble des endpoints, refonte de la segmentation réseau, mise en place d'une authentification multi-facteurs et programme de sensibilisation des collaborateurs.",
    solutionEn: "Implementation of a 24/7 managed SOC, deployment of an EDR solution across all endpoints, network segmentation overhaul, multi-factor authentication implementation, and employee awareness program.",
    resultsFr: ["Zéro incident de sécurité en 18 mois post-déploiement", "Conformité PCI-DSS et COBAC obtenue", "Temps de détection des menaces réduit de 72h à moins de 15 minutes", "Score de maturité sécurité passé de 2/5 à 4.5/5"],
    resultsEn: ["Zero security incidents in 18 months post-deployment", "PCI-DSS and COBAC compliance achieved", "Threat detection time reduced from 72h to less than 15 minutes", "Security maturity score increased from 2/5 to 4.5/5"],
    duration: "4 mois / 4 months",
    color: "from-red-900/30 to-red-800/10",
    accent: "text-red-400"
  },
  {
    icon: Cloud,
    categoryFr: "Cloud & Infrastructure",
    categoryEn: "Cloud & Infrastructure",
    titleFr: "Migration cloud et transformation digitale pour un groupe de distribution",
    titleEn: "Cloud migration and digital transformation for a distribution group",
    contextFr: "Un groupe de distribution alimentaire (800 employés, 25 points de vente) opérait avec des systèmes on-premise vieillissants, une infrastructure réseau instable et des applications métiers non intégrées. Les ruptures de service impactaient directement le chiffre d'affaires.",
    contextEn: "A food distribution group (800 employees, 25 outlets) operated with aging on-premise systems, an unstable network infrastructure, and non-integrated business applications. Service outages directly impacted revenue.",
    challengeFr: "Migrer vers le cloud sans interruption de service pour 25 points de vente actifs 6j/7, tout en intégrant les systèmes de caisse, de gestion des stocks et de logistique dans un environnement unifié.",
    challengeEn: "Migrate to the cloud without service interruption for 25 outlets active 6 days/7, while integrating checkout, inventory management, and logistics systems into a unified environment.",
    solutionFr: "Migration progressive par vagues de 5 sites, déploiement d'une plateforme cloud retail unifiée (ERP, WMS, CRM), réseau SD-WAN en backup LTE et tableau de bord temps réel pour la direction.",
    solutionEn: "Progressive migration in waves of 5 sites, deployment of a unified retail cloud platform (ERP, WMS, CRM), SD-WAN network with LTE backup, and real-time dashboard for management.",
    resultsFr: ["Disponibilité système 99.9% (vs 94% avant)", "Réduction de 35% des ruptures de stock", "Tableau de bord temps réel pour 25 points de vente", "ROI atteint en 14 mois"],
    resultsEn: ["System availability 99.9% (vs 94% before)", "35% reduction in stockouts", "Real-time dashboard for 25 outlets", "ROI achieved in 14 months"],
    duration: "12 mois / 12 months",
    color: "from-cyan-900/30 to-cyan-800/10",
    accent: "text-cyan-400"
  }
];

export default function CaseStudies() {
  const { language } = useLanguage();
  const fr = language === "fr";
  const [expanded, setExpanded] = useState<number | null>(0);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-20%,rgba(30,64,200,0.2)_0%,transparent_70%)] pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">
              {fr ? "Réalisations" : "Our work"}
            </p>
            <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
              {fr ? "Des résultats mesurables pour nos clients" : "Measurable results for our clients"}
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mb-4">
              {fr
                ? "Des exemples représentatifs de nos solutions technologiques déployées dans des contextes réels — chaque projet témoigne de notre engagement envers la valeur métier."
                : "Representative examples of our technology solutions deployed in real contexts — each project demonstrates our commitment to business value."}
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted/50 border border-border rounded-lg text-sm text-muted-foreground">
              <Shield size={14} />
              {fr ? "Exemples de solutions représentatives — données anonymisées" : "Representative solution examples — anonymized data"}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Cases */}
      <section className="pb-28">
        <div className="container mx-auto px-6">
          <div className="space-y-6">
            {cases.map((c, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <div className={`bg-gradient-to-br ${c.color} border border-border rounded-2xl overflow-hidden hover:border-primary/30 transition-colors`}>
                  <div
                    className="p-8 md:p-10 cursor-pointer"
                    onClick={() => setExpanded(expanded === i ? null : i)}
                  >
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex items-start gap-6 flex-1 min-w-0">
                        <div className="p-4 rounded-xl bg-primary/10 text-primary flex-shrink-0">
                          <c.icon size={28} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-3 mb-3">
                            <span className={`text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-primary/10 ${c.accent}`}>
                              {fr ? c.categoryFr : c.categoryEn}
                            </span>
                            <span className="text-xs text-muted-foreground">{c.duration}</span>
                          </div>
                          <h3 className="text-2xl font-bold text-white leading-tight">
                            {fr ? c.titleFr : c.titleEn}
                          </h3>
                        </div>
                      </div>
                      <ChevronDown size={20} className={`text-muted-foreground flex-shrink-0 transition-transform duration-300 mt-1 ${expanded === i ? 'rotate-180' : ''}`} />
                    </div>

                    {expanded !== i && (
                      <p className="text-muted-foreground mt-4 ml-0 md:ml-20 leading-relaxed">
                        {fr ? c.contextFr.substring(0, 180) + '...' : c.contextEn.substring(0, 180) + '...'}
                      </p>
                    )}
                  </div>

                  {expanded === i && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-8 md:px-10 pb-10 md:ml-20">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">{fr ? "Contexte" : "Context"}</h4>
                          <p className="text-muted-foreground text-sm leading-relaxed">{fr ? c.contextFr : c.contextEn}</p>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">{fr ? "Défi" : "Challenge"}</h4>
                          <p className="text-muted-foreground text-sm leading-relaxed">{fr ? c.challengeFr : c.challengeEn}</p>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">{fr ? "Solution déployée" : "Deployed solution"}</h4>
                          <p className="text-muted-foreground text-sm leading-relaxed">{fr ? c.solutionFr : c.solutionEn}</p>
                        </div>
                      </div>
                      <div className="border-t border-border pt-6">
                        <h4 className="text-xs font-semibold uppercase tracking-widest text-primary mb-4">{fr ? "Résultats obtenus" : "Results achieved"}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {(fr ? c.resultsFr : c.resultsEn).map((result, j) => (
                            <div key={j} className="flex items-start gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                              <span className="text-sm text-foreground font-medium">{result}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <CTASection
        title={fr ? "Votre projet, notre prochain succès" : "Your project, our next success"}
        subtitle={fr ? "Discutons de vos objectifs et construisons ensemble une solution qui génère des résultats mesurables." : "Let's discuss your objectives and build together a solution that delivers measurable results."}
        btnText={fr ? "Démarrer votre projet" : "Start your project"}
        href="/contact"
      />
    </div>
  );
}
