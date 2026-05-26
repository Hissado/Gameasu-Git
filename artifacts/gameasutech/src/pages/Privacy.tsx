import React from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { Shield, Lock, Eye, UserCheck, Database, Globe, Mail } from "lucide-react";

const sections = [
  {
    icon: Database,
    titleFr: "Données collectées",
    titleEn: "Data collected",
    contentFr: "Gaméasù collecte uniquement les données nécessaires à la fourniture de ses services : informations d'identification (nom, prénom, adresse email professionnelle, téléphone), données de navigation anonymisées (cookies techniques et analytiques), et informations partagées lors des demandes de contact ou de consultation. Nous ne collectons jamais de données sensibles sans consentement explicite.",
    contentEn: "Gaméasù collects only the data necessary to provide its services: identification information (name, surname, professional email, phone), anonymized browsing data (technical and analytical cookies), and information shared during contact or consultation requests. We never collect sensitive data without explicit consent.",
  },
  {
    icon: Eye,
    titleFr: "Utilisation des données",
    titleEn: "Use of data",
    contentFr: "Vos données sont utilisées exclusivement pour : (1) répondre à vos demandes de contact et de consultation, (2) vous envoyer notre newsletter si vous y avez souscrit (désabonnement possible à tout moment), (3) améliorer nos services et notre site web, (4) nous conformer à nos obligations légales. Nous ne vendons ni ne louons vos données à des tiers.",
    contentEn: "Your data is used exclusively to: (1) respond to your contact and consultation requests, (2) send our newsletter if you have subscribed (unsubscribe possible at any time), (3) improve our services and website, (4) comply with our legal obligations. We do not sell or rent your data to third parties.",
  },
  {
    icon: Lock,
    titleFr: "Sécurité des données",
    titleEn: "Data security",
    contentFr: "Nous appliquons des mesures de sécurité techniques et organisationnelles de haut niveau : chiffrement TLS/SSL de toutes les communications, contrôle d'accès strict basé sur le principe du moindre privilège, hébergement sur des infrastructures certifiées (AWS, Azure, Google Cloud), audits de sécurité réguliers, et formation continue de nos équipes à la protection des données.",
    contentEn: "We apply high-level technical and organizational security measures: TLS/SSL encryption of all communications, strict access control based on the least-privilege principle, hosting on certified infrastructure (AWS, Azure, Google Cloud), regular security audits, and continuous team training on data protection.",
  },
  {
    icon: UserCheck,
    titleFr: "Vos droits (RGPD)",
    titleEn: "Your rights (GDPR)",
    contentFr: "Conformément au RGPD, vous disposez des droits suivants sur vos données personnelles : droit d'accès, droit de rectification, droit à l'effacement (« droit à l'oubli »), droit à la limitation du traitement, droit à la portabilité, et droit d'opposition. Pour exercer ces droits, contactez-nous à l'adresse privacy@gameasu.tech. Nous nous engageons à répondre dans un délai de 30 jours.",
    contentEn: "In accordance with the GDPR, you have the following rights regarding your personal data: right of access, right of rectification, right to erasure ('right to be forgotten'), right to restriction of processing, right to data portability, and right to object. To exercise these rights, contact us at privacy@gameasu.tech. We commit to responding within 30 days.",
  },
  {
    icon: Globe,
    titleFr: "Transferts internationaux",
    titleEn: "International transfers",
    contentFr: "Dans le cadre de nos activités présentes dans 7 pays, certaines données peuvent être traitées en dehors de l'Union Européenne. Dans ce cas, nous nous assurons que des garanties appropriées sont en place (clauses contractuelles types de la Commission Européenne, accord de protection des données) pour assurer un niveau de protection équivalent au RGPD.",
    contentEn: "As part of our operations present in 7 countries, some data may be processed outside the European Union. In such cases, we ensure that appropriate safeguards are in place (European Commission Standard Contractual Clauses, data protection agreements) to ensure a level of protection equivalent to the GDPR.",
  },
  {
    icon: Shield,
    titleFr: "Cookies",
    titleEn: "Cookies",
    contentFr: "Notre site utilise uniquement des cookies techniques nécessaires au bon fonctionnement du site et des cookies analytiques anonymisés (via des outils respectueux de la vie privée). Nous n'utilisons pas de cookies publicitaires tiers. Vous pouvez gérer vos préférences de cookies à tout moment via les paramètres de votre navigateur.",
    contentEn: "Our site uses only technical cookies necessary for the proper functioning of the site and anonymized analytical cookies (via privacy-respecting tools). We do not use third-party advertising cookies. You can manage your cookie preferences at any time via your browser settings.",
  },
];

export default function Privacy() {
  const { language } = useLanguage();
  const fr = language === "fr";

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative pt-24 pb-12 bg-gradient-to-br from-slate-50 via-blue-50/30 to-white overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="max-w-3xl">
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">
              {fr ? "Confidentialité & Protection des données" : "Privacy & Data Protection"}
            </p>
            <h1 className="text-3xl md:text-5xl font-bold text-slate-900 leading-tight mb-6">
              {fr ? "Politique de confidentialité" : "Privacy Policy"}
            </h1>
            <p className="text-xl text-slate-500 leading-relaxed max-w-2xl">
              {fr
                ? "La protection de vos données personnelles est une priorité absolue pour Gaméasù. Cette politique décrit de façon transparente comment nous collectons, utilisons et protégeons vos informations."
                : "The protection of your personal data is an absolute priority for Gaméasù. This policy transparently describes how we collect, use, and protect your information."}
            </p>
            <p className="text-sm text-slate-400 mt-4">
              {fr ? "Dernière mise à jour : mai 2026" : "Last updated: May 2026"}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Commitment banner */}
      <section className="py-10 bg-primary/5 border-y border-primary/10">
        <div className="container mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 text-center sm:text-left">
            {[
              { icon: Lock, fr: "Chiffrement TLS/SSL", en: "TLS/SSL Encryption" },
              { icon: Shield, fr: "Conformité RGPD", en: "GDPR Compliant" },
              { icon: UserCheck, fr: "Droits garantis", en: "Rights Guaranteed" },
              { icon: Eye, fr: "Aucune revente de données", en: "No data selling" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                  <item.icon size={18} />
                </div>
                <span className="text-sm font-semibold text-slate-700">{fr ? item.fr : item.en}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6 max-w-3xl">
          <div className="space-y-10">
            {sections.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.05 }}
                transition={{ delay: i * 0.025 }}
                className="border border-slate-200 rounded-2xl p-8 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-4 mb-5">
                  <div className="p-3 rounded-xl bg-primary/8 text-primary">
                    <s.icon size={22} />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">{fr ? s.titleFr : s.titleEn}</h2>
                </div>
                <p className="text-slate-600 leading-relaxed">{fr ? s.contentFr : s.contentEn}</p>
              </motion.div>
            ))}
          </div>

          {/* Contact DPO */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.05 }}
            className="mt-12 p-8 bg-slate-50 border border-slate-200 rounded-2xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <Mail size={20} className="text-primary" />
              <h3 className="text-lg font-bold text-slate-900">
                {fr ? "Contact — Responsable de la protection des données" : "Contact — Data Protection Officer"}
              </h3>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              {fr
                ? "Pour toute question relative à la protection de vos données personnelles ou pour exercer vos droits, contactez notre équipe dédiée :"
                : "For any questions regarding the protection of your personal data or to exercise your rights, contact our dedicated team:"}
            </p>
            <div className="space-y-1 text-sm">
              <a href="mailto:privacy@gameasu.tech" className="flex items-center gap-2 text-primary font-semibold hover:underline">
                <Mail size={14} /> privacy@gameasu.tech
              </a>
              <p className="text-slate-500">Gaméasù — 195 Church Street, New Haven, CT 06510, USA</p>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
