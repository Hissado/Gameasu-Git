import React, { useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { CTASection } from "@/components/CTASection";
import {
  TrendingUp, Shield, Cloud, Zap, ChevronDown, ChevronUp,
  Calendar, FileText, BarChart2, ArrowRight, Info
} from "lucide-react";

const cases = [
  {
    id: 1, icon: Zap,
    categoryFr: "Transformation Digitale", categoryEn: "Digital Transformation",
    duration: "8 mois / 8 months",
    titleFr: "Modernisation IT complète pour une entreprise multi-sites",
    titleEn: "Complete IT modernization for a multi-site organization",
    summaryFr: "Refonte de l'infrastructure IT d'une organisation multi-sites avec migration cloud et déploiement de la collaboration moderne.",
    summaryEn: "IT infrastructure overhaul for a multi-site organization with cloud migration and modern collaboration deployment.",
    contextFr: "Une organisation opérant sur plusieurs sites en Afrique de l'Ouest disposait d'une infrastructure IT vieillissante, sans supervision centralisée et avec des problèmes récurrents de connectivité inter-sites.",
    contextEn: "An organization operating across multiple sites in West Africa had aging IT infrastructure, no centralized monitoring, and recurring inter-site connectivity issues.",
    challengeFr: "Unifier l'infrastructure de plusieurs sites, migrer vers le cloud, déployer la collaboration moderne et former les équipes tout en maintenant la continuité opérationnelle.",
    challengeEn: "Unify multi-site infrastructure, migrate to the cloud, deploy modern collaboration tools, and train teams while maintaining operational continuity.",
    solutionFr: "Déploiement d'une architecture SD-WAN, migration vers Microsoft 365 avec Teams, mise en place d'un helpdesk centralisé, backup cloud et supervision proactive.",
    solutionEn: "SD-WAN architecture deployment, Microsoft 365 with Teams migration, centralized helpdesk, cloud backup, and proactive monitoring.",
    results: [
      { metricFr: "Réduction des incidents réseau", metricEn: "Network incident reduction", value: "73%" },
      { metricFr: "Utilisateurs formés", metricEn: "Trained users", value: "120+" },
      { metricFr: "Disponibilité post-projet", metricEn: "Post-project uptime", value: "99.4%" },
      { metricFr: "Délai de livraison", metricEn: "Delivery timeline", value: "8 mois" }
    ],
    accentColor: "bg-blue-100 text-blue-700"
  },
  {
    id: 2, icon: Shield,
    categoryFr: "Cybersécurité", categoryEn: "Cybersecurity",
    duration: "4 mois / 4 months",
    titleFr: "Audit de sécurité et mise en conformité pour une institution financière",
    titleEn: "Security audit and compliance for a financial institution",
    summaryFr: "Audit complet, remédiation des vulnérabilités et déploiement d'une posture de sécurité robuste pour une institution financière locale.",
    summaryEn: "Full audit, vulnerability remediation, and robust security posture deployment for a local financial institution.",
    contextFr: "Une institution financière locale confrontée à des incidents de sécurité répétés avait besoin d'un audit complet et d'une remédiation rapide pour protéger ses données et ses systèmes.",
    contextEn: "A local financial institution facing repeated security incidents needed a full audit and fast remediation to protect its data and systems.",
    challengeFr: "Réaliser un audit complet de la posture de sécurité, identifier et corriger les vulnérabilités critiques, déployer une protection des endpoints et former les équipes en 4 mois.",
    challengeEn: "Conduct a full security posture audit, identify and fix critical vulnerabilities, deploy endpoint protection, and train staff within 4 months.",
    solutionFr: "Audit de sécurité complet, déploiement EDR sur l'ensemble des endpoints, mise en place d'une supervision de sécurité, formation des collaborateurs et accompagnement à la conformité.",
    solutionEn: "Full security audit, EDR deployment across all endpoints, security monitoring setup, staff training, and compliance guidance.",
    results: [
      { metricFr: "Vulnérabilités critiques corrigées", metricEn: "Critical vulnerabilities fixed", value: "100%" },
      { metricFr: "Endpoints protégés", metricEn: "Protected endpoints", value: "250+" },
      { metricFr: "Collaborateurs formés", metricEn: "Trained staff", value: "60" },
      { metricFr: "Délai de livraison", metricEn: "Delivery timeline", value: "4 mois" }
    ],
    accentColor: "bg-red-100 text-red-700"
  },
  {
    id: 3, icon: Cloud,
    categoryFr: "Cloud & Infrastructure", categoryEn: "Cloud & Infrastructure",
    duration: "10 mois / 10 months",
    titleFr: "Migration cloud pour une organisation à but non lucratif multi-sites",
    titleEn: "Cloud migration for a multi-site non-profit organization",
    summaryFr: "Migration vers un cloud unifié pour centraliser les données, améliorer la collaboration et réduire les coûts opérationnels.",
    summaryEn: "Migration to a unified cloud to centralize data, improve collaboration, and reduce operational costs.",
    contextFr: "Une organisation à but non lucratif opérant sur plusieurs sites disposait de données critiques non sauvegardées et de systèmes disparates difficiles à administrer de manière centralisée.",
    contextEn: "A non-profit organization operating across several sites had unsecured critical data and disparate systems that were difficult to manage centrally.",
    challengeFr: "Migrer vers un cloud unifié sans interrompre les activités, centraliser les données, améliorer la collaboration entre sites et former les équipes à distance.",
    challengeEn: "Migrate to a unified cloud without disrupting operations, centralize data, improve cross-site collaboration, and train remote teams.",
    solutionFr: "Architecture cloud hybride avec Microsoft 365, déploiement de solutions adaptées aux sites distants, formation des équipes et support continu post-migration.",
    solutionEn: "Hybrid cloud architecture with Microsoft 365, tailored solutions for remote sites, team training, and ongoing post-migration support.",
    results: [
      { metricFr: "Sites connectés", metricEn: "Connected sites", value: "6" },
      { metricFr: "Réduction du TCO", metricEn: "TCO reduction", value: "35%" },
      { metricFr: "Temps de déploiement", metricEn: "Deployment time", value: "10 mois" },
      { metricFr: "Satisfaction utilisateurs", metricEn: "User satisfaction", value: "92%" }
    ],
    accentColor: "bg-cyan-100 text-cyan-700"
  },
  {
    id: 4, icon: TrendingUp,
    categoryFr: "Intelligence Artificielle", categoryEn: "AI & Automation",
    duration: "6 mois / 6 months",
    titleFr: "Automatisation du support client pour une entreprise de services",
    titleEn: "Customer support automation for a service company",
    summaryFr: "Déploiement d'un chatbot IA et de processus automatisés pour améliorer la réactivité du support et réduire la charge manuelle.",
    summaryEn: "AI chatbot and automated process deployment to improve support responsiveness and reduce manual workload.",
    contextFr: "Une entreprise de services gérant un volume croissant de demandes clients traitait la majorité des requêtes manuellement, générant des délais de traitement élevés et une satisfaction client en baisse.",
    contextEn: "A service company dealing with a growing volume of client requests was manually handling most queries, resulting in long processing times and declining customer satisfaction.",
    challengeFr: "Automatiser le traitement des demandes simples, réduire les délais de réponse et libérer les agents pour les cas à forte valeur ajoutée.",
    challengeEn: "Automate simple request handling, reduce response times, and free agents to focus on high-value cases.",
    solutionFr: "Déploiement d'un chatbot IA bilingue, RPA pour la gestion des tickets récurrents et analytique prédictive pour anticiper les pics d'activité.",
    solutionEn: "Bilingual AI chatbot deployment, RPA for recurring ticket management, and predictive analytics to anticipate peak activity.",
    results: [
      { metricFr: "Requêtes automatisées", metricEn: "Automated requests", value: "65%" },
      { metricFr: "Réduction des délais", metricEn: "Time reduction", value: "58%" },
      { metricFr: "Satisfaction client", metricEn: "Customer satisfaction", value: "+28 pts" },
      { metricFr: "Délai de livraison", metricEn: "Delivery timeline", value: "6 mois" }
    ],
    accentColor: "bg-violet-100 text-violet-700"
  },
  {
    id: 5, icon: Calendar,
    categoryFr: "Gestion opérationnelle", categoryEn: "Operations Management",
    duration: "6 mois / 6 months",
    titleFr: "Plateforme de planification du personnel et des opérations résidentielles",
    titleEn: "Staff and residential operations scheduling platform",
    summaryFr: "Digitalisation complète de la planification du personnel pour une structure multi-sites gérant des maisons résidentielles.",
    summaryEn: "Full digitization of staff scheduling for a multi-site organization managing residential homes.",
    contextFr: "Une organisation opérant plusieurs maisons résidentielles devait gérer les horaires du personnel, les postes ouverts, les remplacements, les rendez-vous médicaux et les permissions utilisateurs à partir de fichiers séparés et de processus manuels.",
    contextEn: "An organization managing multiple residential homes had to handle staff schedules, open positions, replacements, medical appointments, and user permissions using separate files and manual processes.",
    challengeFr: "Centraliser la planification mensuelle, réduire les erreurs d'affectation, améliorer la visibilité par maison et permettre aux responsables de suivre les équipes, les shifts, les absences et les besoins de couverture en temps réel.",
    challengeEn: "Centralize monthly scheduling, reduce assignment errors, improve per-home visibility, and allow managers to monitor teams, shifts, absences, and coverage needs in real time.",
    solutionFr: "Création d'une application web responsive avec calendrier mensuel imprimable, gestion des rôles, permissions par maison, staff certifié, postes ouverts, rendez-vous médicaux, affectations récurrentes, export PDF et interface optimisée pour mobile.",
    solutionEn: "Development of a responsive web application with a printable monthly calendar, role management, per-home permissions, certified staff tracking, open positions, medical appointments, recurring assignments, PDF export, and a mobile-optimized interface.",
    results: [
      { metricFr: "Réduction des erreurs de planning", metricEn: "Planning error reduction", value: "78%" },
      { metricFr: "Types de shifts gérés", metricEn: "Shift types managed", value: "12+" },
      { metricFr: "Vue mensuelle imprimable", metricEn: "Printable monthly view", value: "100%" },
      { metricFr: "Délai de conception", metricEn: "Design timeline", value: "6 mois" }
    ],
    accentColor: "bg-emerald-100 text-emerald-700"
  },
  {
    id: 6, icon: FileText,
    categoryFr: "Gestion des opérations", categoryEn: "Operations Management",
    duration: "4 mois / 4 months",
    titleFr: "Portail de gestion des demandes de réparation et interventions",
    titleEn: "Repair request and intervention management portal",
    summaryFr: "Mise en place d'un portail centralisé pour le suivi des demandes techniques et réparations, de la soumission à la résolution.",
    summaryEn: "Implementation of a centralized portal to track technical and repair requests from submission to resolution.",
    contextFr: "Une organisation devait améliorer la gestion des demandes de réparation provenant de bénéficiaires, avec des informations dispersées entre emails, appels, photos, notes internes et suivis manuels.",
    contextEn: "An organization needed to improve the handling of repair requests from beneficiaries, with information scattered across emails, calls, photos, internal notes, and manual tracking.",
    challengeFr: "Structurer le processus de soumission, qualifier l'urgence des demandes, transmettre les informations aux bonnes équipes et assurer un suivi clair depuis la demande initiale jusqu'à la résolution.",
    challengeEn: "Structure the submission process, qualify request urgency, route information to the right teams, and provide clear tracking from initial request through to resolution.",
    solutionFr: "Développement d'un portail permettant la soumission des demandes avec photos, vidéos, coordonnées, description du problème, niveau d'urgence, suivi interne, assignation aux équipes, notifications et historique complet des interventions.",
    solutionEn: "Development of a portal enabling request submission with photos, videos, contact details, problem description, urgency level, internal tracking, team assignment, notifications, and complete intervention history.",
    results: [
      { metricFr: "Gain de temps dans le traitement", metricEn: "Processing time saved", value: "65%" },
      { metricFr: "Niveaux de priorisation", metricEn: "Priority levels", value: "3" },
      { metricFr: "Suivi centralisé des demandes", metricEn: "Centralized request tracking", value: "100%" },
      { metricFr: "Délai de livraison", metricEn: "Delivery timeline", value: "4 mois" }
    ],
    accentColor: "bg-amber-100 text-amber-700"
  },
  {
    id: 7, icon: BarChart2,
    categoryFr: "Finance digitale", categoryEn: "Digital Finance",
    duration: "5 mois / 5 months",
    titleFr: "Application d'intelligence financière et suivi des marchés",
    titleEn: "Financial intelligence and market tracking application",
    summaryFr: "Création d'une plateforme premium d'analyse financière et d'aide à la décision, bilingue et accessible 24/7.",
    summaryEn: "Development of a premium bilingual financial analysis and decision-support platform, accessible 24/7.",
    contextFr: "Des utilisateurs avaient besoin d'un outil moderne pour suivre les marchés financiers, consulter des indicateurs clés, organiser les idées d'investissement et accéder à des analyses structurées dans une interface claire.",
    contextEn: "Users needed a modern tool to monitor financial markets, access key indicators, organize investment ideas, and access structured analyses through a clear interface.",
    challengeFr: "Transformer des données financières complexes en tableaux de bord lisibles, avec une expérience utilisateur premium, une gestion des accès, des contenus différenciés et une présentation adaptée aux utilisateurs non techniques.",
    challengeEn: "Turn complex financial data into readable dashboards, with a premium user experience, access management, differentiated content, and a presentation tailored to non-technical users.",
    solutionFr: "Conception d'une application bilingue avec tableaux de bord financiers, suivi des actifs, idées quotidiennes, alertes, espace premium, gestion des abonnements, interface administrateur et architecture évolutive pour contenus financiers.",
    solutionEn: "Design of a bilingual application with financial dashboards, asset tracking, daily ideas, alerts, premium space, subscription management, admin interface, and a scalable architecture for financial content.",
    results: [
      { metricFr: "Indicateurs suivis", metricEn: "Tracked indicators", value: "40+" },
      { metricFr: "Interface bilingue", metricEn: "Bilingual interface", value: "FR / EN" },
      { metricFr: "Accès aux données clés", metricEn: "Key data access", value: "24/7" },
      { metricFr: "Délai de développement", metricEn: "Development timeline", value: "5 mois" }
    ],
    accentColor: "bg-indigo-100 text-indigo-700"
  }
];

const filters = [
  { keyFr: "Tous", keyEn: "All", value: null },
  { keyFr: "Transformation Digitale", keyEn: "Digital Transformation", value: "Transformation Digitale" },
  { keyFr: "Cybersécurité", keyEn: "Cybersecurity", value: "Cybersécurité" },
  { keyFr: "Cloud & Infrastructure", keyEn: "Cloud & Infrastructure", value: "Cloud & Infrastructure" },
  { keyFr: "Intelligence Artificielle", keyEn: "AI & Automation", value: "Intelligence Artificielle" },
  { keyFr: "Gestion opérationnelle", keyEn: "Operations", value: "Gestion opérationnelle" },
  { keyFr: "Finance digitale", keyEn: "Digital Finance", value: "Finance digitale" },
];

export default function CaseStudies() {
  const { language } = useLanguage();
  const fr = language === "fr";
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const filtered = activeFilter
    ? cases.filter((c) => c.categoryFr === activeFilter || c.categoryFr.startsWith(activeFilter))
    : cases;

  return (
    <div className="min-h-screen bg-background">

      {/* Header */}
      <section className="relative pt-24 pb-12 bg-gradient-to-br from-slate-50 via-blue-50/30 to-white overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl">
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">
              {fr ? "Réalisations" : "Case studies"}
            </p>
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-5 leading-tight">
              {fr ? "Des résultats mesurables, des projets concrets" : "Measurable results, concrete projects"}
            </h1>
            <p className="text-xl text-slate-500 mb-6 max-w-2xl">
              {fr
                ? "Des exemples représentatifs des solutions technologiques que nous concevons et déployons pour des organisations de toutes tailles."
                : "Representative examples of the technology solutions we design and deploy for organizations of all sizes."}
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-500 text-sm rounded-lg">
              <Info size={14} className="flex-shrink-0 text-slate-400" />
              <span>{fr ? "Exemples représentatifs — données anonymisées" : "Representative examples — anonymized data"}</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Filter bar */}
      <section className="sticky top-[57px] z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="container mx-auto px-6">
          <div className="flex items-center gap-2 py-3 overflow-x-auto scrollbar-hide">
            {filters.map((f) => (
              <button
                key={f.keyFr}
                onClick={() => setActiveFilter(f.value)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                  activeFilter === f.value
                    ? "bg-primary text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {fr ? f.keyFr : f.keyEn}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Case study cards */}
      <section className="py-12 pb-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="space-y-4">
            {filtered.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.05 }}
                transition={{ delay: i * 0.02 }}
              >
                <div className={`bg-white border rounded-2xl overflow-hidden transition-all duration-300 ${
                  expandedId === c.id ? "border-primary/40 shadow-lg" : "border-slate-200 hover:border-primary/20 hover:shadow-md"
                }`}>

                  {/* Card header — always visible */}
                  <div
                    className="flex items-start gap-5 p-7 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                  >
                    <div className={`p-3 rounded-xl ${c.accentColor} flex-shrink-0 mt-0.5`}>
                      <c.icon size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${c.accentColor}`}>
                          {fr ? c.categoryFr : c.categoryEn}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">{c.duration}</span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-1.5">
                        {fr ? c.titleFr : c.titleEn}
                      </h3>
                      <p className="text-sm text-slate-500 leading-relaxed">
                        {fr ? c.summaryFr : c.summaryEn}
                      </p>
                    </div>

                    {/* Key metric teaser + toggle */}
                    <div className="hidden sm:flex items-center gap-4 flex-shrink-0 ml-4">
                      <div className="text-right">
                        <div className="text-xl font-bold text-primary">{c.results[0].value}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5 max-w-[100px] leading-tight">
                          {fr ? c.results[0].metricFr : c.results[0].metricEn}
                        </div>
                      </div>
                      <div className="text-slate-400 bg-slate-100 rounded-lg p-1.5">
                        {expandedId === c.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>
                    <div className="sm:hidden text-slate-400">
                      {expandedId === c.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expandedId === c.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="border-t border-slate-100 px-7 pb-7 pt-6"
                    >
                      {/* Context / Challenge / Solution */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-7">
                        {[
                          { label: fr ? "CONTEXTE" : "CONTEXT", text: fr ? c.contextFr : c.contextEn },
                          { label: fr ? "DÉFI" : "CHALLENGE", text: fr ? c.challengeFr : c.challengeEn },
                          { label: fr ? "SOLUTION DÉPLOYÉE" : "DEPLOYED SOLUTION", text: fr ? c.solutionFr : c.solutionEn }
                        ].map((col, j) => (
                          <div key={j} className="bg-slate-50 rounded-xl p-5">
                            <p className="text-[11px] text-primary font-bold uppercase tracking-widest mb-3">{col.label}</p>
                            <p className="text-slate-600 text-sm leading-relaxed">{col.text}</p>
                          </div>
                        ))}
                      </div>

                      {/* Metrics */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                        {c.results.map((r, j) => (
                          <div key={j} className="bg-white border border-slate-200 rounded-xl p-4 text-center hover:border-primary/30 transition-colors">
                            <div className="text-2xl font-bold text-primary mb-1">{r.value}</div>
                            <div className="text-xs text-slate-500 leading-tight">{fr ? r.metricFr : r.metricEn}</div>
                          </div>
                        ))}
                      </div>

                      {/* CTA */}
                      <div className="flex items-center gap-3">
                        <a
                          href="/contact"
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-primary/20"
                        >
                          {fr ? "Discuter d'un projet similaire" : "Discuss a similar project"}
                          <ArrowRight size={15} />
                        </a>
                        <span className="text-xs text-slate-400">
                          {fr ? "Consultation gratuite · Réponse sous 24h" : "Free consultation · Response within 24h"}
                        </span>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ))}

            {filtered.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <p className="text-lg font-medium">{fr ? "Aucun projet dans cette catégorie." : "No projects in this category."}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <CTASection
        title={fr ? "Et si votre organisation était la prochaine ?" : "What if your organization was next?"}
        subtitle={fr
          ? "Discutons de votre contexte et construisons ensemble votre success story technologique."
          : "Let's discuss your context and build your technology success story together."}
        btnText={fr ? "Démarrer une conversation" : "Start a conversation"}
        href="/contact"
      />
    </div>
  );
}
