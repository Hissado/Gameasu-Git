import React from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { CTASection } from "@/components/CTASection";
import { Shield, Eye, Lock, AlertTriangle, Activity, Users, CheckCircle, ArrowRight } from "lucide-react";
import { Link } from "wouter";

const services = [
  { icon: Eye, titleFr: "SOC Managé 24/7", titleEn: "24/7 Managed SOC", descFr: "Centre opérationnel de sécurité supervisé en permanence par nos analystes certifiés. Détection et réponse aux incidents en temps réel.", descEn: "Security operations center permanently supervised by our certified analysts. Real-time threat detection and incident response." },
  { icon: Shield, titleFr: "Audit & Évaluation", titleEn: "Security Audit & Assessment", descFr: "Audit complet de votre posture de sécurité : tests de pénétration, analyse de vulnérabilités, revue d'architecture et plan de remédiation.", descEn: "Comprehensive audit of your security posture: penetration testing, vulnerability analysis, architecture review, and remediation plan." },
  { icon: Lock, titleFr: "Protection des Endpoints", titleEn: "Endpoint Protection", descFr: "Déploiement de solutions EDR/XDR sur l'ensemble de vos postes et serveurs. Détection comportementale, isolation automatique et remédiation.", descEn: "Deployment of EDR/XDR solutions across all your endpoints and servers. Behavioral detection, automatic isolation, and remediation." },
  { icon: AlertTriangle, titleFr: "Gestion des Identités (IAM)", titleEn: "Identity Management (IAM)", descFr: "Authentification multi-facteurs, zero-trust, gestion des accès privilégiés (PAM) et politique des moindres privilèges.", descEn: "Multi-factor authentication, zero-trust architecture, privileged access management (PAM), and least-privilege policies." },
  { icon: Activity, titleFr: "SIEM & Threat Intelligence", titleEn: "SIEM & Threat Intelligence", descFr: "Corrélation d'événements en temps réel, renseignements sur les menaces et tableaux de bord de sécurité pour une visibilité complète.", descEn: "Real-time event correlation, threat intelligence feeds, and security dashboards for complete visibility." },
  { icon: Users, titleFr: "Sensibilisation & Formation", titleEn: "Awareness & Training", descFr: "Programmes de sensibilisation des collaborateurs, simulations de phishing, formations certifiantes et exercices de crise.", descEn: "Employee awareness programs, phishing simulations, certification training, and crisis exercises." }
];

const stats = [
  { value: "99.3%", labelFr: "Taux de détection", labelEn: "Detection rate" },
  { value: "<15 min", labelFr: "Temps de réponse", labelEn: "Response time" },
  { value: "24/7", labelFr: "Surveillance", labelEn: "Monitoring" },
  { value: "0", labelFr: "Incident non résolu", labelEn: "Unresolved incidents" }
];

const frameworks = ["ISO 27001", "NIST CSF", "CIS Controls", "PCI-DSS", "SOC 2", "RGPD / GDPR", "NIS2", "COBAC"];

export default function Cybersecurity() {
  const { language } = useLanguage();
  const fr = language === "fr";

  return (
    <div className="min-h-screen bg-background">
      <section className="relative pt-32 pb-24 bg-gradient-to-br from-slate-50 via-blue-50/30 to-white overflow-hidden">
        <div className="blob-1 absolute top-0 right-0 w-[500px] h-[500px] bg-blue-100/30 rounded-full blur-3xl pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-100 border border-blue-200 text-blue-700 text-sm font-semibold mb-6 uppercase tracking-wide">
                <Shield size={14} />
                {fr ? "Cybersécurité" : "Cybersecurity"}
              </div>
              <h1 className="text-5xl md:text-6xl font-bold text-slate-900 leading-tight mb-6">
                {fr ? "Protégez votre organisation contre les menaces cyber de demain" : "Protect your organization against tomorrow's cyber threats"}
              </h1>
              <p className="text-xl text-slate-500 mb-10">
                {fr ? "Une approche holistique de la sécurité qui combine technologie de pointe, expertise humaine et processus éprouvés — pour une protection complète de vos systèmes, données et opérations." : "A holistic approach to security combining cutting-edge technology, human expertise, and proven processes — for complete protection of your systems, data, and operations."}
              </p>
              <Link href="/contact">
                <div className="group inline-flex items-center gap-3 px-8 py-4 bg-primary text-white font-semibold rounded-xl hover:bg-blue-700 transition-all cursor-pointer shadow-lg shadow-primary/25">
                  {fr ? "Demander un audit gratuit" : "Request a free audit"}
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.7 }} className="hidden lg:block">
              <div className="rounded-2xl overflow-hidden shadow-2xl ring-1 ring-slate-200">
                <img
                  src="https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=700&q=75&auto=format&fit=crop"
                  alt="Cybersécurité"
                  className="w-full h-80 object-cover"
                  loading="lazy"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-12 bg-white border-y border-slate-100">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center p-6 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-3xl md:text-4xl font-bold text-slate-900 mb-1">{s.value}</div>
                <div className="text-sm text-slate-500">{fr ? s.labelFr : s.labelEn}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-28 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Nos services" : "Our services"}</p>
            <h2 className="text-4xl font-bold text-slate-900 mb-4">{fr ? "Protection complète, de l'audit au SOC" : "Complete protection, from audit to SOC"}</h2>
            <p className="text-slate-500 text-lg">{fr ? "Nous couvrons l'intégralité du spectre de la cybersécurité pour une protection sans angle mort." : "We cover the full cybersecurity spectrum for protection with no blind spots."}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                <div className="group h-full bg-white border border-slate-200 rounded-xl p-8 hover:border-primary/40 hover:shadow-md transition-all duration-300">
                  <div className="p-3 rounded-lg bg-primary/8 text-primary inline-flex mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
                    <s.icon size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3">{fr ? s.titleFr : s.titleEn}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{fr ? s.descFr : s.descEn}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-slate-50 to-blue-50/20 border-y border-slate-100">
        <div className="container mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{fr ? "Frameworks & standards de conformité" : "Compliance frameworks & standards"}</h2>
            <p className="text-slate-500">{fr ? "Nous vous aidons à atteindre et maintenir la conformité avec les principaux référentiels." : "We help you achieve and maintain compliance with major regulatory frameworks."}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {frameworks.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}>
                <div className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:border-primary/40 hover:text-primary transition-colors shadow-sm">
                  {f}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-28 bg-white">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Notre approche" : "Our approach"}</p>
              <h2 className="text-4xl font-bold text-slate-900 mb-6">{fr ? "La sécurité est une culture, pas un produit" : "Security is a culture, not a product"}</h2>
              <p className="text-slate-500 leading-relaxed text-lg mb-10">
                {fr ? "Nous croyons que la cybersécurité efficace repose sur trois piliers : les technologies, les processus et les personnes. La sécurité efficace est une culture d'entreprise." : "We believe effective cybersecurity rests on three pillars: technology, processes, and people. Effective security is a company culture."}
              </p>
              <div className="space-y-4">
                {[
                  { fr: "Évaluation initiale complète de votre posture de sécurité", en: "Comprehensive initial assessment of your security posture" },
                  { fr: "Roadmap priorisée par risque et contrainte budgétaire", en: "Risk and budget-prioritized security roadmap" },
                  { fr: "Déploiement progressif sans interruption de service", en: "Progressive deployment with no service interruption" },
                  { fr: "Supervision continue et amélioration itérative", en: "Continuous supervision and iterative improvement" }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle size={18} className="text-primary flex-shrink-0" />
                    <span className="text-slate-700">{fr ? item.fr : item.en}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-6">{fr ? "Pourquoi agir maintenant ?" : "Why act now?"}</h3>
              <div className="space-y-4">
                {[
                  { stat: "300%", labelFr: "Augmentation des cyberattaques en 3 ans", labelEn: "Increase in cyberattacks in 3 years" },
                  { stat: "4.5M$", labelFr: "Coût moyen d'une violation de données", labelEn: "Average cost of a data breach" },
                  { stat: "287j", labelFr: "Temps moyen de détection sans SOC", labelEn: "Average detection time without SOC" },
                  { stat: "60%", labelFr: "Des PME victimes ferment en 6 mois", labelEn: "Of SMEs victimized close within 6 months" }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                    <div className="text-2xl font-bold text-primary min-w-fit">{item.stat}</div>
                    <div className="text-sm text-slate-600">{fr ? item.labelFr : item.labelEn}</div>
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
