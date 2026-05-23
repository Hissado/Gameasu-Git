import React from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { CTASection } from "@/components/CTASection";
import { Shield, Eye, Lock, AlertTriangle, Activity, Users, CheckCircle, ArrowRight } from "lucide-react";
import { Link } from "wouter";

const services = [
  {
    icon: Eye,
    titleFr: "SOC Managé 24/7",
    titleEn: "24/7 Managed SOC",
    descFr: "Centre opérationnel de sécurité supervisé en permanence par nos analystes certifiés. Détection et réponse aux incidents en temps réel.",
    descEn: "Security operations center permanently supervised by our certified analysts. Real-time threat detection and incident response."
  },
  {
    icon: Shield,
    titleFr: "Audit & Évaluation",
    titleEn: "Security Audit & Assessment",
    descFr: "Audit complet de votre posture de sécurité : tests de pénétration, analyse de vulnérabilités, revue d'architecture et plan de remédiation.",
    descEn: "Comprehensive audit of your security posture: penetration testing, vulnerability analysis, architecture review, and remediation plan."
  },
  {
    icon: Lock,
    titleFr: "Protection des Endpoints",
    titleEn: "Endpoint Protection",
    descFr: "Déploiement de solutions EDR/XDR sur l'ensemble de vos postes et serveurs. Détection comportementale, isolation automatique et remédiation.",
    descEn: "Deployment of EDR/XDR solutions across all your endpoints and servers. Behavioral detection, automatic isolation, and remediation."
  },
  {
    icon: AlertTriangle,
    titleFr: "Gestion des Identités (IAM)",
    titleEn: "Identity Management (IAM)",
    descFr: "Authentification multi-facteurs, zero-trust, gestion des accès privilégiés (PAM) et politique des moindres privilèges.",
    descEn: "Multi-factor authentication, zero-trust architecture, privileged access management (PAM), and least-privilege policies."
  },
  {
    icon: Activity,
    titleFr: "SIEM & Threat Intelligence",
    titleEn: "SIEM & Threat Intelligence",
    descFr: "Corrélation d'événements en temps réel, renseignements sur les menaces et tableaux de bord de sécurité pour une visibilité complète.",
    descEn: "Real-time event correlation, threat intelligence feeds, and security dashboards for complete visibility."
  },
  {
    icon: Users,
    titleFr: "Sensibilisation & Formation",
    titleEn: "Awareness & Training",
    descFr: "Programmes de sensibilisation des collaborateurs, simulations de phishing, formations certifiantes et exercices de crise.",
    descEn: "Employee awareness programs, phishing simulations, certification training, and crisis exercises."
  }
];

const stats = [
  { value: "99.3%", labelFr: "Taux de détection des menaces", labelEn: "Threat detection rate" },
  { value: "<15 min", labelFr: "Temps de réponse moyen", labelEn: "Average response time" },
  { value: "24/7", labelFr: "Surveillance continue", labelEn: "Continuous monitoring" },
  { value: "0", labelFr: "Incident majeur non résolu", labelEn: "Unresolved major incidents" }
];

const frameworks = ["ISO 27001", "NIST CSF", "CIS Controls", "PCI-DSS", "SOC 2", "RGPD / GDPR", "NIS2", "COBAC"];

export default function Cybersecurity() {
  const { language } = useLanguage();
  const fr = language === "fr";

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_30%_0%,rgba(220,30,60,0.12)_0%,transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-20%,rgba(30,64,200,0.15)_0%,transparent_70%)] pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold mb-6 uppercase tracking-wide">
              <Shield size={14} />
              {fr ? "Cybersécurité" : "Cybersecurity"}
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6 max-w-4xl">
              {fr
                ? "Protégez votre organisation contre les menaces cyber de demain"
                : "Protect your organization against tomorrow's cyber threats"}
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mb-10">
              {fr
                ? "Une approche holistique de la sécurité qui combine technologie de pointe, expertise humaine et processus éprouvés — pour une protection complète de vos systèmes, données et opérations."
                : "A holistic approach to security combining cutting-edge technology, human expertise, and proven processes — for complete protection of your systems, data, and operations."}
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/contact">
                <div className="group inline-flex items-center gap-3 px-8 py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-all cursor-pointer shadow-[0_0_30px_-5px_rgba(30,64,200,0.6)]">
                  {fr ? "Demander un audit gratuit" : "Request a free audit"}
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 bg-card border-y border-border">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-white mb-1">{s.value}</div>
                <div className="text-sm text-muted-foreground">{fr ? s.labelFr : s.labelEn}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-28">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Nos services" : "Our services"}</p>
            <h2 className="text-4xl font-bold text-white mb-4">{fr ? "Protection complète, de l'audit au SOC" : "Complete protection, from audit to SOC"}</h2>
            <p className="text-muted-foreground text-lg">{fr ? "Nous couvrons l'intégralité du spectre de la cybersécurité pour une protection sans angle mort." : "We cover the full cybersecurity spectrum for protection with no blind spots."}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                <div className="group h-full bg-card border border-border rounded-xl p-8 hover:border-primary/40 hover:bg-primary/3 transition-all duration-300">
                  <div className="p-3 rounded-lg bg-primary/10 text-primary inline-flex mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
                    <s.icon size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3">{fr ? s.titleFr : s.titleEn}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{fr ? s.descFr : s.descEn}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Frameworks */}
      <section className="py-20 bg-card border-y border-border">
        <div className="container mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-white mb-2">{fr ? "Frameworks & standards de conformité" : "Compliance frameworks & standards"}</h2>
            <p className="text-muted-foreground">{fr ? "Nous vous aidons à atteindre et maintenir la conformité avec les principaux référentiels." : "We help you achieve and maintain compliance with major regulatory frameworks."}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {frameworks.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}>
                <div className="px-5 py-2.5 bg-background border border-border rounded-xl text-sm font-semibold text-white hover:border-primary/40 transition-colors">
                  {f}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Approach */}
      <section className="py-28">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Notre approche" : "Our approach"}</p>
              <h2 className="text-4xl font-bold text-white mb-6">{fr ? "La sécurité est une culture, pas un produit" : "Security is a culture, not a product"}</h2>
              <p className="text-muted-foreground leading-relaxed text-lg mb-10">
                {fr
                  ? "Nous croyons que la cybersécurité efficace repose sur trois piliers indissociables : les technologies (outils, plateformes, automatisation), les processus (gouvernance, réponse aux incidents, continuité) et les personnes (formation, culture, responsabilisation)."
                  : "We believe effective cybersecurity rests on three inseparable pillars: technology (tools, platforms, automation), processes (governance, incident response, continuity), and people (training, culture, accountability)."}
              </p>
              <div className="space-y-4">
                {[
                  { fr: "Évaluation initiale complète de votre posture de sécurité", en: "Comprehensive initial assessment of your security posture" },
                  { fr: "Roadmap de sécurité priorisée par risque et budget", en: "Risk and budget-prioritized security roadmap" },
                  { fr: "Déploiement progressif et sans interruption de service", en: "Progressive deployment with no service interruption" },
                  { fr: "Supervision continue et amélioration itérative", en: "Continuous supervision and iterative improvement" }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle size={18} className="text-primary flex-shrink-0" />
                    <span className="text-foreground">{fr ? item.fr : item.en}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-card border border-border rounded-2xl p-8">
              <h3 className="text-lg font-bold text-white mb-6">{fr ? "Pourquoi agir maintenant ?" : "Why act now?"}</h3>
              <div className="space-y-5">
                {[
                  { stat: "300%", labelFr: "Augmentation des cyberattaques en 3 ans", labelEn: "Increase in cyberattacks in 3 years" },
                  { stat: "4.5M$", labelFr: "Coût moyen d'une violation de données", labelEn: "Average cost of a data breach" },
                  { stat: "287j", labelFr: "Temps moyen de détection sans SOC", labelEn: "Average detection time without SOC" },
                  { stat: "60%", labelFr: "Des PME victimes ferment en 6 mois", labelEn: "Of SMEs victimized close within 6 months" }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-background border border-border rounded-xl">
                    <div className="text-2xl font-bold text-primary min-w-fit">{item.stat}</div>
                    <div className="text-sm text-muted-foreground">{fr ? item.labelFr : item.labelEn}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <CTASection
        title={fr ? "Évaluez votre exposition aux risques" : "Assess your risk exposure"}
        subtitle={fr ? "Demandez un audit de sécurité gratuit et obtenez un rapport détaillé de votre posture de sécurité en 5 jours ouvrés." : "Request a free security audit and get a detailed report of your security posture within 5 business days."}
        btnText={fr ? "Demander un audit" : "Request an audit"}
        href="/contact"
      />
    </div>
  );
}
