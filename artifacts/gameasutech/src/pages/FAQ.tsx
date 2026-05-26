import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { CTASection } from "@/components/CTASection";
import { ChevronDown, Link as LinkIcon, Search } from "lucide-react";
import { Link } from "wouter";

const faqs = [
  {
    categoryFr: "Services & Offre",
    categoryEn: "Services & Offer",
    items: [
      {
        qFr: "Quels types d'organisations accompagnez-vous ?",
        qEn: "What types of organizations do you serve?",
        aFr: "Gaméasù accompagne des organisations de toutes tailles : PME, grandes entreprises, institutions publiques, ONG, startups et établissements d'enseignement. Nous intervenons dans tous les secteurs — finance, santé, industrie, éducation, secteur public — en Afrique de l'Ouest, en Amérique du Nord et en Europe.",
        aEn: "Gaméasù serves organizations of all sizes: SMEs, large enterprises, public institutions, NGOs, startups, and educational establishments. We operate across all sectors — finance, healthcare, industry, education, public sector — in West Africa, North America, and Europe.",
      },
      {
        qFr: "Quels sont vos principaux domaines d'expertise ?",
        qEn: "What are your main areas of expertise?",
        aFr: "Nos cinq domaines principaux sont : (1) Modern Workplace & Collaboration, (2) Infrastructure & Cloud (Azure, AWS, GCP), (3) Cybersécurité & Sécurité physique, (4) Transformation Digitale & Intégration SI, et (5) Intelligence Artificielle & Automatisation. Chaque domaine est porté par des ingénieurs certifiés.",
        aEn: "Our five main areas are: (1) Modern Workplace & Collaboration, (2) Infrastructure & Cloud (Azure, AWS, GCP), (3) Cybersecurity & Physical Security, (4) Digital Transformation & IS Integration, and (5) Artificial Intelligence & Automation. Each domain is led by certified engineers.",
      },
      {
        qFr: "Proposez-vous des forfaits ou des contrats d'abonnement ?",
        qEn: "Do you offer packages or subscription contracts?",
        aFr: "Oui. Nous proposons des engagements ponctuels (projet délimité), des contrats de support récurrents (mensuel ou annuel) et des forfaits d'infogérance. Chaque proposition est personnalisée selon vos besoins et votre budget. Contactez-nous pour une évaluation gratuite.",
        aEn: "Yes. We offer one-time engagements (defined project), recurring support contracts (monthly or annual), and managed service packages. Every proposal is customized to your needs and budget. Contact us for a free assessment.",
      },
    ],
  },
  {
    categoryFr: "Processus & Délais",
    categoryEn: "Process & Timelines",
    items: [
      {
        qFr: "Comment se déroule un engagement type avec Gaméasù ?",
        qEn: "How does a typical engagement with Gaméasù work?",
        aFr: "Notre méthode comporte 5 phases : Diagnostic (1–2 sem.), Stratégie & Proposition (1–2 sem.), Déploiement & Intégration (2–12 sem. selon la complexité), Formation & Transfert (inclus dans chaque projet), puis Support & Amélioration continue. Un chef de projet dédié coordonne chaque phase.",
        aEn: "Our method has 5 phases: Diagnosis (1–2 wks), Strategy & Proposal (1–2 wks), Deployment & Integration (2–12 wks depending on complexity), Training & Knowledge Transfer (included in every project), then Support & Continuous Improvement. A dedicated project manager coordinates every phase.",
      },
      {
        qFr: "Quel est le délai moyen pour démarrer un projet ?",
        qEn: "What is the average lead time to start a project?",
        aFr: "Après la signature du contrat, nos équipes peuvent démarrer la phase de diagnostic sous 5 à 7 jours ouvrés. Pour les situations urgentes (incident, vulnérabilité critique), nous proposons une intervention en 24–48h.",
        aEn: "After contract signature, our teams can begin the diagnostic phase within 5 to 7 business days. For urgent situations (incident, critical vulnerability), we offer intervention within 24–48 hours.",
      },
      {
        qFr: "La consultation initiale est-elle payante ?",
        qEn: "Is the initial consultation paid?",
        aFr: "Non. La première consultation de 45 à 60 minutes avec un de nos experts est entièrement gratuite et sans engagement. Elle nous permet de comprendre votre contexte et de vous donner une première orientation stratégique.",
        aEn: "No. The first 45 to 60-minute consultation with one of our experts is completely free and non-binding. It allows us to understand your context and provide initial strategic guidance.",
      },
    ],
  },
  {
    categoryFr: "Géographie & Présence",
    categoryEn: "Geography & Presence",
    items: [
      {
        qFr: "Dans quels pays intervenez-vous ?",
        qEn: "In which countries do you operate?",
        aFr: "Gaméasù est présent dans 7 pays : États-Unis (siège), Canada, France, Belgique, Togo, Côte d'Ivoire et Mali. Nous intervenons aussi à distance dans d'autres pays francophones d'Afrique de l'Ouest et d'Europe. Notre organisation internationale nous permet de couvrir efficacement les marchés nord-américains, européens et africains.",
        aEn: "Gaméasù operates in 7 countries: United States (HQ), Canada, France, Belgium, Togo, Côte d'Ivoire, and Mali. We also provide remote services in other French-speaking West African and European countries. Our international organization allows us to efficiently cover North American, European, and African markets.",
      },
      {
        qFr: "Pouvez-vous intervenir entièrement à distance ?",
        qEn: "Can you operate entirely remotely?",
        aFr: "Oui, la grande majorité de nos missions peut être réalisée à distance grâce à nos outils de gestion de projet, de déploiement cloud et de monitoring. Pour certains déploiements physiques (réseau, sécurité périmétrique), nos équipes terrain locales en Afrique de l'Ouest prennent en charge les interventions sur site.",
        aEn: "Yes, the vast majority of our missions can be carried out remotely thanks to our project management, cloud deployment, and monitoring tools. For certain physical deployments (network, perimeter security), our local field teams in West Africa handle on-site interventions.",
      },
    ],
  },
  {
    categoryFr: "Sécurité & Données",
    categoryEn: "Security & Data",
    items: [
      {
        qFr: "Comment garantissez-vous la sécurité de nos données ?",
        qEn: "How do you guarantee the security of our data?",
        aFr: "Nous appliquons les meilleures pratiques de sécurité : chiffrement end-to-end, accès au principe du moindre privilège, audits de sécurité réguliers, et conformité RGPD. Toutes nos équipes sont formées à la gestion des données sensibles et nous signons des accords de confidentialité (NDA) systématiquement.",
        aEn: "We apply security best practices: end-to-end encryption, least-privilege access control, regular security audits, and GDPR compliance. All our teams are trained in sensitive data management and we systematically sign non-disclosure agreements (NDAs).",
      },
      {
        qFr: "Êtes-vous conformes au RGPD ?",
        qEn: "Are you GDPR compliant?",
        aFr: "Oui. Gaméasù respecte le Règlement Général sur la Protection des Données (RGPD) pour tous ses clients européens et applique des standards équivalents pour ses clients hors UE. Nous disposons d'une politique de confidentialité détaillée et pouvons signer des DPA (Data Processing Agreements) avec nos clients.",
        aEn: "Yes. Gaméasù complies with the General Data Protection Regulation (GDPR) for all European clients and applies equivalent standards for non-EU clients. We have a detailed privacy policy and can sign Data Processing Agreements (DPAs) with our clients.",
      },
    ],
  },
  {
    categoryFr: "Support & Après-projet",
    categoryEn: "Support & Post-project",
    items: [
      {
        qFr: "Proposez-vous un support après le déploiement ?",
        qEn: "Do you offer support after deployment?",
        aFr: "Oui, systématiquement. Chaque déploiement inclut une période de garantie et nous proposons des contrats de support continu (helpdesk, maintenance préventive, monitoring, audits périodiques). Notre SLA garantit une réponse en moins de 4 heures pour tout incident critique.",
        aEn: "Yes, systematically. Every deployment includes a warranty period and we offer ongoing support contracts (helpdesk, preventive maintenance, monitoring, periodic audits). Our SLA guarantees a response within 4 hours for any critical incident.",
      },
      {
        qFr: "Assurez-vous la formation de nos équipes ?",
        qEn: "Do you provide training for our teams?",
        aFr: "Absolument. La formation est incluse dans chaque déploiement, sans surcoût. Nous formons à la fois vos équipes techniques (administrateurs, ingénieurs) et vos utilisateurs finals. Les formations sont disponibles en présentiel, à distance, et en plusieurs langues (FR, EN, langues locales).",
        aEn: "Absolutely. Training is included in every deployment at no extra cost. We train both your technical teams (administrators, engineers) and your end users. Training is available in person, remotely, and in multiple languages (FR, EN, local languages).",
      },
      {
        qFr: "Pouvez-vous travailler avec notre équipe IT interne ?",
        qEn: "Can you work alongside our internal IT team?",
        aFr: "Oui, c'est même notre modèle privilégié. Nous nous positionnons en complément de votre équipe interne : expertise pointue sur des sujets spécifiques, renfort sur des projets critiques, transfert de compétences. Nous adaptons notre niveau d'intervention selon votre maturité IT interne.",
        aEn: "Yes, this is actually our preferred model. We position ourselves alongside your internal team: specialized expertise on specific topics, reinforcement on critical projects, skills transfer. We adapt our level of intervention to your internal IT maturity.",
      },
    ],
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start justify-between gap-4 p-6 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="font-semibold text-slate-900 text-sm leading-relaxed">{q}</span>
        <ChevronDown
          size={18}
          className={`text-primary flex-shrink-0 mt-0.5 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 text-slate-500 text-sm leading-relaxed border-t border-slate-100 pt-4">
              {a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQ() {
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
              {fr ? "Foire aux questions" : "Frequently asked questions"}
            </p>
            <h1 className="text-3xl md:text-5xl font-bold text-slate-900 leading-tight mb-6">
              {fr ? "Toutes vos questions, nos réponses." : "All your questions, our answers."}
            </h1>
            <p className="text-xl text-slate-500 leading-relaxed max-w-2xl">
              {fr
                ? "Vous avez une question sur nos services, notre processus ou notre organisation ? Retrouvez ici les réponses aux questions les plus fréquentes."
                : "Have a question about our services, process, or organization? Find answers to the most frequently asked questions here."}
            </p>
          </motion.div>
        </div>
      </section>

      {/* FAQ body */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6 max-w-3xl">
          {faqs.map((cat, ci) => (
            <motion.div
              key={ci}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.05 }}
              transition={{ delay: ci * 0.08 }}
              className="mb-12"
            >
              <h2 className="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {ci + 1}
                </span>
                {fr ? cat.categoryFr : cat.categoryEn}
              </h2>
              <div className="space-y-3">
                {cat.items.map((item, ii) => (
                  <FAQItem key={ii} q={fr ? item.qFr : item.qEn} a={fr ? item.aFr : item.aEn} />
                ))}
              </div>
            </motion.div>
          ))}

          <div className="mt-12 p-8 bg-primary/5 border border-primary/15 rounded-2xl text-center">
            <Search size={32} className="text-primary mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              {fr ? "Vous ne trouvez pas votre réponse ?" : "Can't find your answer?"}
            </h3>
            <p className="text-slate-500 mb-6 text-sm">
              {fr
                ? "Notre équipe répond à toutes vos questions dans les 24 heures ouvrées."
                : "Our team answers all your questions within 24 business hours."}
            </p>
            <Link href="/contact">
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors cursor-pointer">
                <LinkIcon size={16} />
                {fr ? "Contacter notre équipe" : "Contact our team"}
              </div>
            </Link>
          </div>
        </div>
      </section>

      <CTASection
        title={fr ? "Prêt à démarrer ?" : "Ready to get started?"}
        subtitle={fr
          ? "Parlez à un expert Gaméasù et recevez une analyse gratuite de vos besoins technologiques."
          : "Speak with a Gaméasù expert and receive a free analysis of your technology needs."}
        btnText={fr ? "Consultation gratuite" : "Free consultation"}
        href="/contact"
      />
    </div>
  );
}
