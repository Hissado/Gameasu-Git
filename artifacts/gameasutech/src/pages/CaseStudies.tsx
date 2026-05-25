import React, { useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { CTASection } from "@/components/CTASection";
import { TrendingUp, Shield, Cloud, Zap, ChevronDown, ChevronUp } from "lucide-react";

const cases = [
  {
    id: 1, icon: Zap,
    categoryFr: "Transformation Digitale", categoryEn: "Digital Transformation",
    duration: "8 mois / 8 months",
    titleFr: "Modernisation IT complète pour une PME industrielle multi-sites",
    titleEn: "Complete IT modernization for a multi-site industrial SME",
    contextFr: "Un groupe industriel de taille intermédiaire (450 salariés, 6 sites) en Afrique de l'Ouest avec une infrastructure IT vieillissante, sans supervision centralisée et des problèmes récurrents de connectivité inter-sites.",
    contextEn: "A mid-size industrial group (450 employees, 6 sites) in West Africa with aging IT infrastructure, no centralized monitoring, and recurring inter-site connectivity issues.",
    challengeFr: "Unifier l'infrastructure de 6 sites, migrer vers le cloud, déployer la collaboration moderne et former 450 utilisateurs en maintenant la continuité opérationnelle.",
    challengeEn: "Unify the 6-site infrastructure, migrate to the cloud, deploy modern collaboration tools, and train 450 users while maintaining operational continuity.",
    solutionFr: "Déploiement d'une architecture SD-WAN, migration vers Microsoft 365 avec Teams, mise en place d'un helpdesk centralisé, backup cloud et supervision NOC.",
    solutionEn: "SD-WAN architecture deployment, Microsoft 365 with Teams migration, centralized helpdesk, cloud backup, and NOC monitoring.",
    results: [
      { metricFr: "Réduction des incidents réseau", metricEn: "Network incident reduction", value: "73%" },
      { metricFr: "Utilisateurs formés", metricEn: "Trained users", value: "450" },
      { metricFr: "Disponibilité post-projet", metricEn: "Post-project uptime", value: "99.4%" },
      { metricFr: "Délai de livraison", metricEn: "Delivery timeline", value: "8 mois" }
    ],
    accentColor: "bg-blue-100 text-blue-700"
  },
  {
    id: 2, icon: Shield,
    categoryFr: "Cybersécurité", categoryEn: "Cybersecurity",
    duration: "4 mois / 4 months",
    titleFr: "Mise en conformité ISO 27001 pour une institution financière régionale",
    titleEn: "ISO 27001 compliance for a regional financial institution",
    contextFr: "Une banque régionale opérant dans 4 pays confrontée à une cyberattaque ayant exposé des données clients. Exigence de mise en conformité ISO 27001 imposée par le régulateur.",
    contextEn: "A regional bank operating in 4 countries that suffered a cyberattack exposing client data. ISO 27001 compliance required by the regulator.",
    challengeFr: "Audit complet de la posture de sécurité, remédiation des 47 vulnérabilités critiques identifiées, déploiement SOC et certification ISO 27001 en 4 mois.",
    challengeEn: "Full security posture audit, remediation of 47 critical vulnerabilities, SOC deployment, and ISO 27001 certification in 4 months.",
    solutionFr: "Audit de sécurité complet, déploiement EDR sur 1 200 endpoints, mise en place du SOC 24/7, formation de 85 collaborateurs et accompagnement à la certification.",
    solutionEn: "Full security audit, EDR deployment on 1,200 endpoints, 24/7 SOC setup, training of 85 staff, and certification support.",
    results: [
      { metricFr: "Vulnérabilités critiques corrigées", metricEn: "Critical vulnerabilities fixed", value: "47/47" },
      { metricFr: "Endpoints protégés", metricEn: "Protected endpoints", value: "1 200" },
      { metricFr: "Collaborateurs formés", metricEn: "Trained staff", value: "85" },
      { metricFr: "Certification obtenue", metricEn: "Certification achieved", value: "ISO 27001" }
    ],
    accentColor: "bg-red-100 text-red-700"
  },
  {
    id: 3, icon: Cloud,
    categoryFr: "Cloud & Infrastructure", categoryEn: "Cloud & Infrastructure",
    duration: "12 mois / 12 months",
    titleFr: "Migration cloud pour une ONG internationale opérant dans 12 pays",
    titleEn: "Cloud migration for an international NGO operating in 12 countries",
    contextFr: "Une ONG humanitaire avec 600 collaborateurs dans 12 pays, des données critiques non sauvegardées et des systèmes disparates impossibles à administrer centralement.",
    contextEn: "A humanitarian NGO with 600 staff in 12 countries, unsecured critical data, and disparate systems impossible to manage centrally.",
    challengeFr: "Migrer vers un cloud unifié sans interrompre les opérations humanitaires terrain, en maintenant les capacités offline pour les zones à faible connectivité.",
    challengeEn: "Migrate to a unified cloud without interrupting field operations, while maintaining offline capabilities for low-connectivity areas.",
    solutionFr: "Architecture cloud hybride AWS + Microsoft 365, déploiement de solutions edge pour les bureaux terrain, formation multilingue et support 24/7 en 3 langues.",
    solutionEn: "Hybrid AWS + Microsoft 365 cloud architecture, edge solutions for field offices, multilingual training, and 24/7 support in 3 languages.",
    results: [
      { metricFr: "Pays couverts", metricEn: "Countries covered", value: "12" },
      { metricFr: "Réduction du TCO", metricEn: "TCO reduction", value: "38%" },
      { metricFr: "Temps de déploiement", metricEn: "Deployment time", value: "12 mois" },
      { metricFr: "Satisfaction utilisateurs", metricEn: "User satisfaction", value: "94%" }
    ],
    accentColor: "bg-cyan-100 text-cyan-700"
  },
  {
    id: 4, icon: TrendingUp,
    categoryFr: "Intelligence Artificielle", categoryEn: "AI & Automation",
    duration: "6 mois / 6 months",
    titleFr: "Automatisation des processus pour un opérateur télécom régional",
    titleEn: "Process automation for a regional telecom operator",
    contextFr: "Un opérateur télécom avec 1,5 million de clients gérant manuellement 80% de son support client, générant des délais de résolution longs et un taux de satisfaction faible.",
    contextEn: "A telecom operator with 1.5 million customers manually handling 80% of customer support, resulting in long resolution times and low satisfaction rates.",
    challengeFr: "Automatiser le support client pour réduire les coûts de 40%, améliorer le délai de résolution de 60% et libérer les agents pour les cas complexes.",
    challengeEn: "Automate customer support to reduce costs by 40%, improve resolution time by 60%, and free agents for complex cases.",
    solutionFr: "Déploiement d'un chatbot IA multilingue (FR/EN/langues locales), RPA pour la gestion des tickets simples, analytics prédictif pour anticipation des pannes.",
    solutionEn: "Multilingual AI chatbot deployment (FR/EN/local languages), RPA for simple ticket management, predictive analytics for outage anticipation.",
    results: [
      { metricFr: "Requêtes automatisées", metricEn: "Automated requests", value: "68%" },
      { metricFr: "Réduction des coûts support", metricEn: "Support cost reduction", value: "42%" },
      { metricFr: "NPS client", metricEn: "Customer NPS", value: "+31 pts" },
      { metricFr: "ROI sur 18 mois", metricEn: "18-month ROI", value: "3.2x" }
    ],
    accentColor: "bg-violet-100 text-violet-700"
  }
];

export default function CaseStudies() {
  const { language } = useLanguage();
  const fr = language === "fr";
  const [expandedId, setExpandedId] = useState<number | null>(cases[0].id);

  return (
    <div className="min-h-screen bg-background">
      <section className="relative pt-32 pb-20 bg-gradient-to-br from-slate-50 via-blue-50/30 to-white overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
              <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Réalisations" : "Case studies"}</p>
              <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">{fr ? "Des résultats mesurables pour nos clients" : "Measurable results for our clients"}</h1>
              <p className="text-xl text-slate-500 mb-6">{fr ? "Des exemples représentatifs de nos solutions technologiques déployées dans des contextes réels." : "Representative examples of our technology solutions deployed in real contexts."}</p>
              <div className="inline-flex items-center gap-2.5 px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-500 text-sm rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-slate-400"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <span>{fr ? "Exemples de solutions représentatives — données anonymisées" : "Representative solution examples — anonymized data"}</span>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.7 }} className="hidden lg:block">
              <div className="relative rounded-2xl overflow-hidden h-72 bg-slate-200 shadow-xl">
                <img
                  src="https://images.unsplash.com/photo-1551836022-4c4c79ecde51?w=900&q=80&auto=format&fit=crop"
                  alt="Résultats et performance client Gaméasù"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-slate-900/50 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5">
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3">
                    <TrendingUp size={15} className="text-green-300 flex-shrink-0" />
                    <span className="text-white text-sm font-medium">{fr ? "100+ missions · 98% satisfaction client" : "100+ missions · 98% client satisfaction"}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-16 pb-28 bg-white">
        <div className="container mx-auto px-6">
          <div className="space-y-5">
            {cases.map((c, i) => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-primary/30 hover:shadow-md transition-all duration-300">
                  {/* Header */}
                  <div className="flex items-start gap-5 p-8 cursor-pointer" onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>
                    <div className={`p-3 rounded-xl ${c.accentColor} flex-shrink-0`}>
                      <c.icon size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${c.accentColor}`}>{fr ? c.categoryFr : c.categoryEn}</span>
                        <span className="text-xs text-slate-400 font-medium">{c.duration}</span>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900">{fr ? c.titleFr : c.titleEn}</h3>
                    </div>
                    <div className="flex-shrink-0 text-slate-400">
                      {expandedId === c.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>

                  {/* Expanded content */}
                  {expandedId === c.id && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-t border-slate-100 px-8 pb-8 pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        {[
                          { label: fr ? "CONTEXTE" : "CONTEXT", text: fr ? c.contextFr : c.contextEn },
                          { label: fr ? "DÉFI" : "CHALLENGE", text: fr ? c.challengeFr : c.challengeEn },
                          { label: fr ? "SOLUTION DÉPLOYÉE" : "DEPLOYED SOLUTION", text: fr ? c.solutionFr : c.solutionEn }
                        ].map((col, j) => (
                          <div key={j}>
                            <p className="text-xs text-primary font-bold uppercase tracking-widest mb-3">{col.label}</p>
                            <p className="text-slate-600 text-sm leading-relaxed">{col.text}</p>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 rounded-xl p-6">
                        {c.results.map((r, j) => (
                          <div key={j} className="text-center">
                            <div className="text-2xl font-bold text-primary mb-1">{r.value}</div>
                            <div className="text-xs text-slate-500">{fr ? r.metricFr : r.metricEn}</div>
                          </div>
                        ))}
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
        title={fr ? "Et si votre organisation était la prochaine ?" : "What if your organization was next?"}
        subtitle={fr ? "Discutons de votre contexte et construisons ensemble votre success story technologique." : "Let's discuss your context and build your technology success story together."}
        btnText={fr ? "Démarrer une conversation" : "Start a conversation"}
        href="/contact"
      />
    </div>
  );
}
