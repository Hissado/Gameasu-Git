import React from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { CTASection } from "@/components/CTASection";
import { Link } from "wouter";
import { Monitor, Cloud, Zap, Shield, Lock, Brain, Wrench, Briefcase, Database, ChevronRight, CheckCircle } from "lucide-react";

const services = [
  { icon: Monitor, href: "/services", titleFr: "Modern Workplace", titleEn: "Modern Workplace", descFr: "Communication unifiée, collaboration digitale, outils hybrides et intégrations.", descEn: "Unified communication, digital collaboration, hybrid tools, and integrations.", featuresFr: ["Microsoft 365 & Teams", "UCaaS & collaboration", "Audio-vidéo d'entreprise", "Gestion des endpoints"], featuresEn: ["Microsoft 365 & Teams", "UCaaS & collaboration", "Enterprise audio-video", "Endpoint management"] },
  { icon: Cloud, href: "/cloud-infrastructure", titleFr: "Infrastructure, Réseau & Cloud", titleEn: "Infrastructure, Network & Cloud", descFr: "Architecture réseau, migration cloud multi-fournisseurs et optimisation des coûts.", descEn: "Network architecture, multi-cloud migration, and cost optimization.", featuresFr: ["Réseau & SD-WAN", "Migration cloud (AWS/Azure/GCP)", "Infrastructure hybride", "FinOps & supervision"], featuresEn: ["Network & SD-WAN", "Cloud migration (AWS/Azure/GCP)", "Hybrid infrastructure", "FinOps & monitoring"] },
  { icon: Zap, href: "/services", titleFr: "Transformation Digitale", titleEn: "Digital Transformation", descFr: "Stratégie digitale, modernisation des SI et gestion du changement.", descEn: "Digital strategy, IS modernization, and change management.", featuresFr: ["Diagnostic & roadmap", "Modernisation SI", "Automatisation métier", "Conduite du changement"], featuresEn: ["Diagnostic & roadmap", "IS modernization", "Business automation", "Change management"] },
  { icon: Shield, href: "/cybersecurity", titleFr: "Cybersécurité", titleEn: "Cybersecurity", descFr: "SOC 24/7, audit de sécurité, protection des endpoints et conformité.", descEn: "24/7 SOC, security audit, endpoint protection, and compliance.", featuresFr: ["SOC managé 24/7", "Tests de pénétration", "EDR / XDR", "Conformité RGPD/ISO27001"], featuresEn: ["24/7 managed SOC", "Penetration testing", "EDR / XDR", "GDPR/ISO27001 compliance"] },
  { icon: Lock, href: "/services", titleFr: "Sécurité Physique & Technologies", titleEn: "Physical Security & Technology", descFr: "Contrôle d'accès, vidéosurveillance et bâtiments intelligents.", descEn: "Access control, video surveillance, and smart buildings.", featuresFr: ["Contrôle d'accès biométrique", "Vidéosurveillance IA", "Bâtiments connectés", "Sécurité convergente"], featuresEn: ["Biometric access control", "AI video surveillance", "Smart buildings", "Converged security"] },
  { icon: Brain, href: "/ai-automation", titleFr: "Intelligence Artificielle", titleEn: "Artificial Intelligence", descFr: "Automatisation intelligente, assistants IA et analytique prédictive.", descEn: "Intelligent automation, AI assistants, and predictive analytics.", featuresFr: ["Chatbots & assistants IA", "RPA & automatisation", "Analytique prédictive", "OCR & traitement docs"], featuresEn: ["Chatbots & AI assistants", "RPA & automation", "Predictive analytics", "OCR & document processing"] },
  { icon: Wrench, href: "/support", titleFr: "Services IT Managés (MSP)", titleEn: "Managed IT Services (MSP)", descFr: "Supervision, maintenance, helpdesk et gestion proactive de votre infrastructure.", descEn: "Monitoring, maintenance, helpdesk, and proactive infrastructure management.", featuresFr: ["Helpdesk L1/L2/L3", "Supervision proactive", "Maintenance préventive", "SLA contractuels"], featuresEn: ["Helpdesk L1/L2/L3", "Proactive monitoring", "Preventive maintenance", "Contractual SLAs"] },
  { icon: Briefcase, href: "/services", titleFr: "Services Professionnels", titleEn: "Professional Services", descFr: "Conseil IT, gestion de projets d'envergure et formations certifiantes.", descEn: "IT consulting, large-scale project management, and certification training.", featuresFr: ["Audit & conseil IT", "Chef de projet dédié", "Déploiements multi-sites", "Formations certifiantes"], featuresEn: ["IT audit & consulting", "Dedicated project manager", "Multi-site deployments", "Certification training"] },
  { icon: Database, href: "/services", titleFr: "Data, Cloud & Expérience Digitale", titleEn: "Data, Cloud & Digital Experience", descFr: "Gouvernance des données, tableaux de bord analytiques et applications digitales.", descEn: "Data governance, analytics dashboards, and digital applications.", featuresFr: ["Gouvernance des données", "Tableaux de bord BI", "Applications web/mobile", "APIs & intégrations"], featuresEn: ["Data governance", "BI dashboards", "Web/mobile applications", "APIs & integrations"] }
];

export default function Services() {
  const { language } = useLanguage();
  const fr = language === "fr";

  return (
    <div className="min-h-screen bg-background">
      <section className="relative pt-32 pb-20 bg-gradient-to-br from-slate-50 via-blue-50/30 to-white overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Nos services" : "Our services"}</p>
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900 leading-tight mb-6 max-w-4xl">
              {fr ? "Des solutions de bout en bout pour chaque défi IT" : "End-to-end solutions for every IT challenge"}
            </h1>
            <p className="text-xl text-slate-500 max-w-3xl">
              {fr ? "Neuf domaines d'expertise pour couvrir l'intégralité de votre écosystème technologique." : "Nine areas of expertise to cover your entire technology ecosystem."}
            </p>
          </motion.div>
        </div>
      </section>

      <section className="pb-28 pt-8 bg-white">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {services.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}>
                <Link href={s.href}>
                  <div className="group h-full bg-white border border-slate-200 rounded-2xl p-8 hover:border-primary/40 cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                    <div className="flex items-start justify-between mb-6">
                      <div className="p-3 rounded-xl bg-primary/8 text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300 shadow-sm">
                        <s.icon size={26} />
                      </div>
                      <ChevronRight size={18} className="text-slate-300 group-hover:text-primary transition-colors mt-1" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">{fr ? s.titleFr : s.titleEn}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed mb-6">{fr ? s.descFr : s.descEn}</p>
                    <div className="space-y-2 border-t border-slate-100 pt-5">
                      {(fr ? s.featuresFr : s.featuresEn).map((f, j) => (
                        <div key={j} className="flex items-center gap-2 text-xs text-slate-500">
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

      <section className="py-28 bg-gradient-to-br from-slate-50 to-blue-50/20 border-t border-slate-100">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Notre approche" : "Our approach"}</p>
              <h2 className="text-4xl font-bold text-slate-900 mb-6">{fr ? "De la stratégie à l'opération, sans rupture" : "From strategy to operations, seamlessly"}</h2>
              <p className="text-slate-500 leading-relaxed text-lg mb-10">
                {fr ? "Nous ne livrons pas des projets — nous construisons des partenariats durables. Chaque engagement démarre par une compréhension approfondie de votre contexte métier." : "We don't just deliver projects — we build lasting partnerships. Every engagement starts with a deep understanding of your business context."}
              </p>
              <div className="space-y-5">
                {[
                  { fr: "Audit & diagnostic de l'existant", en: "Audit & assessment of current state" },
                  { fr: "Définition de la roadmap et priorisation", en: "Roadmap definition and prioritization" },
                  { fr: "Déploiement agile et formation des équipes", en: "Agile deployment and team training" },
                  { fr: "Support continu et amélioration itérative", en: "Ongoing support and iterative improvement" }
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 border-2 border-primary/20 text-primary text-sm font-bold flex items-center justify-center flex-shrink-0">{i + 1}</div>
                    <span className="text-slate-700 font-medium">{fr ? step.fr : step.en}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {[
                { fr: "Chef de projet dédié sur chaque engagement", en: "Dedicated project manager on every engagement" },
                { fr: "Reporting de progression mensuel inclus", en: "Monthly progress reporting included" },
                { fr: "Formation utilisateurs dans chaque déploiement", en: "User training in every deployment" },
                { fr: "SLA garanti contractuellement", en: "Contractually guaranteed SLA" },
                { fr: "Accès à notre base de connaissances 24/7", en: "24/7 access to our knowledge base" },
                { fr: "Équipes certifiées par les éditeurs", en: "Vendor-certified teams" }
              ].map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}>
                  <div className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:border-primary/30 transition-colors shadow-sm">
                    <CheckCircle size={18} className="text-primary flex-shrink-0" />
                    <span className="text-slate-700 text-sm font-medium">{fr ? item.fr : item.en}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <CTASection
        title={fr ? "Quel défi pouvons-nous résoudre ?" : "Which challenge can we solve?"}
        subtitle={fr ? "Discutons de vos enjeux technologiques et identifions les solutions les mieux adaptées à votre situation." : "Let's discuss your technology challenges and identify the solutions best suited to your situation."}
        btnText={fr ? "Parler à un expert" : "Talk to an expert"}
        href="/contact"
      />
    </div>
  );
}
