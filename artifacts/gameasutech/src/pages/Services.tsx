import React from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { CTASection } from "@/components/CTASection";
import { Link } from "wouter";
import { Monitor, Cloud, Zap, Shield, Lock, Brain, Wrench, Briefcase, Database, ChevronRight, CheckCircle } from "lucide-react";

const services = [
  {
    icon: Monitor,
    href: "/services",
    colorClass: "from-blue-900/30 to-blue-800/10",
    titleFr: "Modern Workplace",
    titleEn: "Modern Workplace",
    descFr: "Communication unifiée, collaboration digitale, outils hybrides et intégrations qui transforment la façon dont vos équipes travaillent.",
    descEn: "Unified communication, digital collaboration, hybrid tools, and integrations that transform how your teams work.",
    featuresFr: ["Microsoft 365 & Teams", "UCaaS & collaboration", "Audio-vidéo d'entreprise", "Gestion des endpoints"],
    featuresEn: ["Microsoft 365 & Teams", "UCaaS & collaboration", "Enterprise audio-video", "Endpoint management"]
  },
  {
    icon: Cloud,
    href: "/cloud-infrastructure",
    colorClass: "from-cyan-900/30 to-cyan-800/10",
    titleFr: "Infrastructure, Réseau & Cloud",
    titleEn: "Infrastructure, Network & Cloud",
    descFr: "Architecture réseau haute performance, migration cloud multi-fournisseurs, supervision proactive et optimisation des coûts.",
    descEn: "High-performance network architecture, multi-cloud migration, proactive monitoring, and cost optimization.",
    featuresFr: ["Réseau & SD-WAN", "Migration cloud (AWS/Azure/GCP)", "Infrastructure hybride", "FinOps & supervision"],
    featuresEn: ["Network & SD-WAN", "Cloud migration (AWS/Azure/GCP)", "Hybrid infrastructure", "FinOps & monitoring"]
  },
  {
    icon: Zap,
    href: "/services",
    colorClass: "from-violet-900/30 to-violet-800/10",
    titleFr: "Transformation Digitale",
    titleEn: "Digital Transformation",
    descFr: "Stratégie digitale, modernisation des SI, déploiement de plateformes et gestion du changement pour accélérer votre évolution.",
    descEn: "Digital strategy, information system modernization, platform deployment, and change management to accelerate your evolution.",
    featuresFr: ["Diagnostic & roadmap", "Modernisation SI", "Automatisation métier", "Conduite du changement"],
    featuresEn: ["Diagnostic & roadmap", "IS modernization", "Business automation", "Change management"]
  },
  {
    icon: Shield,
    href: "/cybersecurity",
    colorClass: "from-red-900/30 to-red-800/10",
    titleFr: "Cybersécurité",
    titleEn: "Cybersecurity",
    descFr: "SOC 24/7, audit de sécurité, protection des endpoints, gestion des identités et conformité réglementaire.",
    descEn: "24/7 SOC, security audit, endpoint protection, identity management, and regulatory compliance.",
    featuresFr: ["SOC managé 24/7", "Tests de pénétration", "EDR / XDR", "Conformité RGPD/ISO27001"],
    featuresEn: ["24/7 managed SOC", "Penetration testing", "EDR / XDR", "GDPR/ISO27001 compliance"]
  },
  {
    icon: Lock,
    href: "/services",
    colorClass: "from-slate-800/30 to-slate-700/10",
    titleFr: "Sécurité Physique & Technologies",
    titleEn: "Physical Security & Technology",
    descFr: "Contrôle d'accès, vidéosurveillance, bâtiments intelligents et intégration des systèmes de sécurité physique et cyber.",
    descEn: "Access control, video surveillance, smart buildings, and integration of physical and cyber security systems.",
    featuresFr: ["Contrôle d'accès biométrique", "Vidéosurveillance IA", "Bâtiments connectés", "Sécurité convergente"],
    featuresEn: ["Biometric access control", "AI video surveillance", "Smart buildings", "Converged security"]
  },
  {
    icon: Brain,
    href: "/ai-automation",
    colorClass: "from-violet-900/30 to-violet-800/10",
    titleFr: "Intelligence Artificielle",
    titleEn: "Artificial Intelligence",
    descFr: "Automatisation intelligente, assistants IA, analytique prédictive et traitement automatisé des données.",
    descEn: "Intelligent automation, AI assistants, predictive analytics, and automated data processing.",
    featuresFr: ["Chatbots & assistants IA", "RPA & automatisation", "Analytique prédictive", "OCR & traitement docs"],
    featuresEn: ["Chatbots & AI assistants", "RPA & automation", "Predictive analytics", "OCR & document processing"]
  },
  {
    icon: Wrench,
    href: "/support",
    colorClass: "from-orange-900/30 to-orange-800/10",
    titleFr: "Services IT Managés (MSP)",
    titleEn: "Managed IT Services (MSP)",
    descFr: "Supervision, maintenance, support helpdesk et gestion proactive de votre infrastructure en mode service managé.",
    descEn: "Monitoring, maintenance, helpdesk support, and proactive management of your infrastructure as a managed service.",
    featuresFr: ["Helpdesk L1/L2/L3", "Supervision proactive", "Maintenance préventive", "SLA contractuels"],
    featuresEn: ["Helpdesk L1/L2/L3", "Proactive monitoring", "Preventive maintenance", "Contractual SLAs"]
  },
  {
    icon: Briefcase,
    href: "/services",
    colorClass: "from-green-900/30 to-green-800/10",
    titleFr: "Services Professionnels",
    titleEn: "Professional Services",
    descFr: "Conseil IT stratégique, gestion de projets d'envergure, déploiements complexes et formations certifiantes.",
    descEn: "Strategic IT consulting, large-scale project management, complex deployments, and certification training.",
    featuresFr: ["Audit & conseil IT", "Chef de projet dédié", "Déploiements multi-sites", "Formations certifiantes"],
    featuresEn: ["IT audit & consulting", "Dedicated project manager", "Multi-site deployments", "Certification training"]
  },
  {
    icon: Database,
    href: "/services",
    colorClass: "from-indigo-900/30 to-indigo-800/10",
    titleFr: "Data, Cloud & Expérience Digitale",
    titleEn: "Data, Cloud & Digital Experience",
    descFr: "Gouvernance des données, tableaux de bord analytiques, applications digitales et expériences utilisateurs modernes.",
    descEn: "Data governance, analytics dashboards, digital applications, and modern user experiences.",
    featuresFr: ["Gouvernance des données", "Tableaux de bord BI", "Applications web/mobile", "APIs & intégrations"],
    featuresEn: ["Data governance", "BI dashboards", "Web/mobile applications", "APIs & integrations"]
  }
];

export default function Services() {
  const { language } = useLanguage();
  const fr = language === "fr";

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-20%,rgba(30,64,200,0.2)_0%,transparent_70%)] pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">
              {fr ? "Nos services" : "Our services"}
            </p>
            <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6 max-w-4xl">
              {fr ? "Des solutions de bout en bout pour chaque défi IT" : "End-to-end solutions for every IT challenge"}
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl">
              {fr
                ? "Neuf domaines d'expertise pour couvrir l'intégralité de votre écosystème technologique — du conseil initial au support continu."
                : "Nine areas of expertise to cover your entire technology ecosystem — from initial consulting to ongoing support."}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="pb-28">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {services.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}>
                <Link href={s.href}>
                  <div className={`group h-full bg-gradient-to-br ${s.colorClass} border border-border rounded-2xl p-8 hover:border-primary/40 cursor-pointer transition-all duration-300 hover:-translate-y-1`}>
                    <div className="flex items-start justify-between mb-6">
                      <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                        <s.icon size={26} />
                      </div>
                      <ChevronRight size={18} className="text-muted-foreground group-hover:text-primary transition-colors mt-1" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">{fr ? s.titleFr : s.titleEn}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-6">{fr ? s.descFr : s.descEn}</p>
                    <div className="space-y-2 border-t border-border/50 pt-5">
                      {(fr ? s.featuresFr : s.featuresEn).map((f, j) => (
                        <div key={j} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="w-1 h-1 rounded-full bg-primary flex-shrink-0" />
                          {f}
                        </div>
                      ))}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Methodology */}
      <section className="py-28 bg-card border-y border-border">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Notre approche" : "Our approach"}</p>
              <h2 className="text-4xl font-bold text-white mb-6">{fr ? "De la stratégie à l'opération, sans rupture" : "From strategy to operations, seamlessly"}</h2>
              <p className="text-muted-foreground leading-relaxed text-lg mb-10">
                {fr
                  ? "Nous ne livrons pas des projets — nous construisons des partenariats durables. Chaque engagement démarre par une compréhension approfondie de votre contexte métier, avant toute recommandation technique."
                  : "We don't just deliver projects — we build lasting partnerships. Every engagement starts with a deep understanding of your business context, before any technical recommendation."}
              </p>
              <div className="space-y-5">
                {[
                  { fr: "Audit & diagnostic de l'existant", en: "Audit & assessment of current state" },
                  { fr: "Définition de la roadmap et priorisation", en: "Roadmap definition and prioritization" },
                  { fr: "Déploiement agile et formation des équipes", en: "Agile deployment and team training" },
                  { fr: "Support continu et amélioration itérative", en: "Ongoing support and iterative improvement" }
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 text-primary text-sm font-bold flex items-center justify-center flex-shrink-0">{i + 1}</div>
                    <span className="text-foreground">{fr ? step.fr : step.en}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {[
                { labelFr: "Chef de projet dédié sur chaque engagement", labelEn: "Dedicated project manager on every engagement" },
                { labelFr: "Reporting de progression mensuel inclus", labelEn: "Monthly progress reporting included" },
                { labelFr: "Formation utilisateurs dans chaque déploiement", labelEn: "User training in every deployment" },
                { labelFr: "SLA garanti contractuellement", labelEn: "Contractually guaranteed SLA" },
                { labelFr: "Accès à notre base de connaissances 24/7", labelEn: "24/7 access to our knowledge base" },
                { labelFr: "Équipes certifiées par les éditeurs", labelEn: "Vendor-certified teams" }
              ].map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}>
                  <div className="flex items-center gap-3 p-4 bg-background border border-border rounded-xl hover:border-primary/30 transition-colors">
                    <CheckCircle size={18} className="text-primary flex-shrink-0" />
                    <span className="text-foreground text-sm">{fr ? item.labelFr : item.labelEn}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <CTASection
        title={fr ? "Quel défi pouvons-nous résoudre ?" : "Which challenge can we solve?"}
        subtitle={fr ? "Discutons de vos enjeux technologiques et identifions ensemble les solutions les mieux adaptées à votre situation." : "Let's discuss your technology challenges and identify together the solutions best suited to your situation."}
        btnText={fr ? "Parler à un expert" : "Talk to an expert"}
        href="/contact"
      />
    </div>
  );
}
