import React from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { CTASection } from "@/components/CTASection";
import { Brain, Zap, BarChart2, MessageSquare, Cpu, Workflow, ArrowRight, CheckCircle } from "lucide-react";
import { Link } from "wouter";

const useCases = [
  {
    icon: MessageSquare,
    titleFr: "Assistants IA conversationnels",
    titleEn: "Conversational AI assistants",
    descFr: "Chatbots et assistants virtuels intelligents pour le service client, le support interne et la gestion des connaissances.",
    descEn: "Intelligent chatbots and virtual assistants for customer service, internal support, and knowledge management."
  },
  {
    icon: Workflow,
    titleFr: "Automatisation des processus (RPA)",
    titleEn: "Process automation (RPA)",
    descFr: "Robotic Process Automation pour éliminer les tâches répétitives : saisie de données, réconciliation, reporting automatisé.",
    descEn: "Robotic Process Automation to eliminate repetitive tasks: data entry, reconciliation, automated reporting."
  },
  {
    icon: BarChart2,
    titleFr: "Analytique prédictive",
    titleEn: "Predictive analytics",
    descFr: "Modèles de prévision pour anticiper la demande, optimiser les stocks, détecter les anomalies et guider les décisions.",
    descEn: "Forecasting models to anticipate demand, optimize inventory, detect anomalies, and guide decisions."
  },
  {
    icon: Brain,
    titleFr: "Traitement intelligent des documents",
    titleEn: "Intelligent document processing",
    descFr: "Extraction automatique d'informations depuis factures, contrats et formulaires grâce à l'OCR et au NLP.",
    descEn: "Automatic information extraction from invoices, contracts, and forms using OCR and NLP."
  },
  {
    icon: Cpu,
    titleFr: "Vision par ordinateur",
    titleEn: "Computer vision",
    descFr: "Analyse d'images et de vidéos pour le contrôle qualité, la sécurité physique et la surveillance industrielle.",
    descEn: "Image and video analysis for quality control, physical security, and industrial monitoring."
  },
  {
    icon: Zap,
    titleFr: "Orchestration intelligente",
    titleEn: "Intelligent orchestration",
    descFr: "Workflows hybrides combinant IA et RPA pour des processus end-to-end entièrement automatisés et auto-correcteurs.",
    descEn: "Hybrid workflows combining AI and RPA for fully automated, self-correcting end-to-end processes."
  }
];

const sectors = [
  { fr: "Finance & banque", en: "Finance & banking" },
  { fr: "Santé & médical", en: "Healthcare & medical" },
  { fr: "Commerce & logistique", en: "Retail & logistics" },
  { fr: "Industrie & manufacturing", en: "Industry & manufacturing" },
  { fr: "Administration publique", en: "Public administration" },
  { fr: "Services professionnels", en: "Professional services" }
];

const results = [
  { stat: "40%", labelFr: "Gain de productivité moyen", labelEn: "Average productivity gain" },
  { stat: "75%", labelFr: "Réduction des erreurs de saisie", labelEn: "Reduction in data entry errors" },
  { stat: "3x", labelFr: "ROI moyen sur 18 mois", labelEn: "Average ROI over 18 months" },
  { stat: "60%", labelFr: "Réduction des coûts de traitement", labelEn: "Reduction in processing costs" }
];

export default function AIAutomation() {
  const { language } = useLanguage();
  const fr = language === "fr";

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_70%_-10%,rgba(120,30,200,0.15)_0%,transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-20%,rgba(30,64,200,0.15)_0%,transparent_70%)] pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-sm font-semibold mb-6 uppercase tracking-wide">
              <Brain size={14} />
              {fr ? "Intelligence Artificielle & Automatisation" : "AI & Automation"}
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6 max-w-4xl">
              {fr
                ? "L'IA au service de vos opérations — aujourd'hui"
                : "AI powering your operations — today"}
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mb-10">
              {fr
                ? "Nos plateformes IA délivrent de l'analytique prédictive, de l'automatisation intelligente et des expériences personnalisées qui génèrent des opérations plus intelligentes et un avantage concurrentiel durable."
                : "Our AI platforms deliver predictive analytics, intelligent automation, and personalized experiences that drive smarter operations and lasting competitive advantage."}
            </p>
            <Link href="/contact">
              <div className="group inline-flex items-center gap-3 px-8 py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-all cursor-pointer shadow-[0_0_30px_-5px_rgba(30,64,200,0.6)]">
                {fr ? "Explorer les solutions IA" : "Explore AI solutions"}
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 bg-card border-y border-border">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {results.map((r, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-white mb-1">{r.stat}</div>
                <div className="text-sm text-muted-foreground">{fr ? r.labelFr : r.labelEn}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-28">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Cas d'usage" : "Use cases"}</p>
            <h2 className="text-4xl font-bold text-white mb-4">{fr ? "L'IA concrète, déployée en production" : "Practical AI, deployed in production"}</h2>
            <p className="text-muted-foreground text-lg">{fr ? "Des solutions IA éprouvées dans des environnements réels, adaptées à votre secteur et à vos contraintes." : "Battle-tested AI solutions in real environments, adapted to your sector and constraints."}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {useCases.map((uc, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                <div className="group h-full bg-card border border-border rounded-xl p-8 hover:border-primary/40 hover:bg-primary/3 transition-all duration-300">
                  <div className="p-3 rounded-lg bg-primary/10 text-primary inline-flex mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
                    <uc.icon size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3">{fr ? uc.titleFr : uc.titleEn}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{fr ? uc.descFr : uc.descEn}</p>
                </div>
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
              <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Notre méthodologie" : "Our methodology"}</p>
              <h2 className="text-4xl font-bold text-white mb-6">
                {fr ? "Automatiser les bons processus, de la bonne façon" : "Automating the right processes, the right way"}
              </h2>
              <p className="text-muted-foreground leading-relaxed text-lg mb-10">
                {fr
                  ? "L'automatisation mal ciblée amplifie les problèmes existants. Notre approche commence toujours par l'optimisation du processus avant son automatisation — garantissant un ROI maximal et une adoption réussie."
                  : "Poorly targeted automation amplifies existing problems. Our approach always starts with process optimization before automation — ensuring maximum ROI and successful adoption."}
              </p>
              <div className="space-y-5">
                {[
                  { num: "01", fr: "Cartographie et analyse des processus existants", en: "Mapping and analysis of existing processes" },
                  { num: "02", fr: "Identification et priorisation des opportunités d'automatisation", en: "Identification and prioritization of automation opportunities" },
                  { num: "03", fr: "Proof of concept rapide (< 4 semaines)", en: "Rapid proof of concept (< 4 weeks)" },
                  { num: "04", fr: "Déploiement progressif et formation des équipes", en: "Progressive deployment and team training" },
                  { num: "05", fr: "Mesure de la performance et optimisation continue", en: "Performance measurement and continuous optimization" }
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-5">
                    <div className="text-2xl font-bold text-primary/40 min-w-fit leading-none mt-1">{step.num}</div>
                    <div className="text-foreground">{fr ? step.fr : step.en}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-6">{fr ? "Secteurs d'application" : "Application sectors"}</p>
              <div className="grid grid-cols-2 gap-4">
                {sectors.map((s, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}>
                    <div className="flex items-center gap-3 p-4 bg-background border border-border rounded-xl hover:border-primary/30 transition-colors">
                      <CheckCircle size={16} className="text-primary flex-shrink-0" />
                      <span className="text-sm font-medium text-foreground">{fr ? s.fr : s.en}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <CTASection
        title={fr ? "Commencez avec un pilote IA" : "Start with an AI pilot"}
        subtitle={fr ? "Identifions ensemble le cas d'usage le plus impactant pour votre organisation et lançons un proof of concept en 4 semaines." : "Let's identify together the most impactful use case for your organization and launch a proof of concept in 4 weeks."}
        btnText={fr ? "Démarrer un pilote" : "Start a pilot"}
        href="/contact"
      />
    </div>
  );
}
