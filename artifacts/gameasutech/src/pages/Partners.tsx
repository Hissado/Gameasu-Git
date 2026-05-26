import React from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { CTASection } from "@/components/CTASection";
import { Award, Globe, Handshake, Shield, CheckCircle } from "lucide-react";

const partnerCategories = [
  {
    icon: Shield,
    labelFr: "Partenaires Cybersécurité",
    labelEn: "Cybersecurity Partners",
    descFr: "Les leaders mondiaux de la cybersécurité pour protéger les systèmes et données de vos organisations.",
    descEn: "Global cybersecurity leaders to protect the systems and data of your organizations.",
    partners: ["CrowdStrike", "Palo Alto Networks", "Fortinet", "SentinelOne", "Qualys", "Darktrace"]
  },
  {
    icon: Globe,
    labelFr: "Partenaires Cloud & Infrastructure",
    labelEn: "Cloud & Infrastructure Partners",
    descFr: "Les principales plateformes cloud et solutions d'infrastructure pour des déploiements fiables et évolutifs.",
    descEn: "Leading cloud platforms and infrastructure solutions for reliable, scalable deployments.",
    partners: ["Amazon Web Services", "Microsoft Azure", "Google Cloud", "VMware", "Cisco", "Juniper Networks"]
  },
  {
    icon: Award,
    labelFr: "Partenaires Modern Workplace",
    labelEn: "Modern Workplace Partners",
    descFr: "Solutions de collaboration, productivité et communication pour les équipes modernes et hybrides.",
    descEn: "Collaboration, productivity, and communication solutions for modern and hybrid teams.",
    partners: ["Microsoft 365", "Google Workspace", "Zoom", "Poly", "Logitech", "Jabra"]
  }
];

const certifications = [
  { name: "Microsoft Solutions Partner", year: "2024" },
  { name: "AWS Select Consulting Partner", year: "2024" },
  { name: "Google Cloud Partner", year: "2025" },
  { name: "Fortinet Authorized Partner", year: "2024" },
  { name: "Cisco Select Partner", year: "2025" },
  { name: "CrowdStrike Partner", year: "2025" }
];

const partnerBenefits = [
  { fr: "Accès à nos certifications et expertises partenaires", en: "Access to our partner certifications and expertise" },
  { fr: "Programme de co-vente et partage des opportunités", en: "Co-selling program and opportunity sharing" },
  { fr: "Formation et enablement technique conjoint", en: "Joint technical training and enablement" },
  { fr: "Support pré-vente et post-vente dédié", en: "Dedicated pre-sales and post-sales support" },
  { fr: "Marketing conjoint et co-branding", en: "Joint marketing and co-branding" },
  { fr: "Accès prioritaire aux nouvelles certifications", en: "Priority access to new certifications" }
];

export default function Partners() {
  const { language } = useLanguage();
  const fr = language === "fr";

  return (
    <div className="min-h-screen bg-background">
      <section className="relative pt-24 pb-12 bg-gradient-to-br from-slate-50 via-blue-50/30 to-white overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
              <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Partenaires" : "Partners"}</p>
              <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
                {fr ? "Un écosystème de partenaires de classe mondiale" : "A world-class partner ecosystem"}
              </h1>
              <p className="text-xl text-slate-500">
                {fr
                  ? "Gaméasù s'appuie sur les leaders technologiques mondiaux pour vous offrir des solutions de référence, implémentées par des ingénieurs certifiés et des équipes expertes."
                  : "Gaméasù relies on global technology leaders to offer you best-in-class solutions, implemented by certified engineers and expert teams."}
              </p>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.28 }} className="w-full">
              <div className="relative rounded-2xl overflow-hidden shadow-xl bg-slate-100">
                <img
                  src={`${import.meta.env.BASE_URL}partners-banner.webp`}
                  alt="Écosystème de partenaires technologiques Gaméasù — Microsoft, AWS, Google Cloud, Cisco, IBM, Fortinet et plus"
                  className="w-full h-auto object-cover"
                  loading="eager"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section className="py-12 bg-white border-b border-slate-100">
        <div className="container mx-auto px-6">
          <p className="text-center text-sm text-slate-500 font-semibold uppercase tracking-widest mb-8">{fr ? "Certifications & accréditations" : "Certifications & accreditations"}</p>
          <div className="flex flex-wrap justify-center gap-4">
            {certifications.map((cert, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, amount: 0.05 }} transition={{ delay: i * 0.025 }}>
                <div className="bg-white border border-slate-200 rounded-xl px-6 py-3 flex items-center gap-3 hover:border-primary/40 hover:shadow-sm transition-all shadow-sm">
                  <Award size={16} className="text-primary flex-shrink-0" />
                  <span className="text-sm font-semibold text-slate-800">{cert.name}</span>
                  <span className="text-xs text-slate-400">{fr ? `depuis ${cert.year}` : `since ${cert.year}`}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Partner categories */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Nos partenaires" : "Our partners"}</p>
            <h2 className="text-4xl font-bold text-slate-900 mb-4">{fr ? "Technologie de premier plan" : "Best-in-class technology"}</h2>
            <p className="text-slate-500 text-lg">{fr ? "Chaque partenaire est sélectionné pour son excellence technologique, sa fiabilité et son alignement avec nos exigences de qualité." : "Each partner is selected for technological excellence, reliability, and alignment with our quality standards."}</p>
          </div>
          <div className="space-y-8">
            {partnerCategories.map((cat, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.05 }} transition={{ delay: i * 0.03 }}>
                <div className="bg-white border border-slate-200 rounded-2xl p-8 hover:border-primary/30 transition-colors shadow-sm">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 rounded-xl bg-primary/8 text-primary flex-shrink-0">
                      <cat.icon size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">{fr ? cat.labelFr : cat.labelEn}</h3>
                      <p className="text-slate-500 text-sm">{fr ? cat.descFr : cat.descEn}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {cat.partners.map((p, j) => (
                      <span key={j} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:border-primary/40 hover:text-primary transition-colors cursor-default">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Become a partner */}
      <section className="py-20 bg-gradient-to-br from-slate-50 to-blue-50/20 border-y border-slate-100">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-primary/8 text-primary">
                  <Handshake size={28} />
                </div>
              </div>
              <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Programme partenaire" : "Partner program"}</p>
              <h2 className="text-4xl font-bold text-slate-900 mb-6">{fr ? "Devenez partenaire Gaméasù" : "Become a Gaméasù partner"}</h2>
              <p className="text-slate-500 leading-relaxed text-lg mb-10">
                {fr
                  ? "Nous recherchons des partenaires technologiques, des intégrateurs et des revendeurs qui partagent nos valeurs d'excellence et notre engagement pour l'innovation, la transformation digitale et la sécurité des organisations."
                  : "We are looking for technology partners, integrators, and resellers who share our values of excellence and our commitment to innovation, digital transformation, and organizational security."}
              </p>
            </div>
            <div className="space-y-3">
              {partnerBenefits.map((b, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.05 }} transition={{ delay: i * 0.025 }}>
                  <div className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:border-primary/30 transition-colors shadow-sm">
                    <CheckCircle size={18} className="text-primary flex-shrink-0" />
                    <span className="text-slate-700 text-sm font-medium">{fr ? b.fr : b.en}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <CTASection
        title={fr ? "Construisons ensemble" : "Let's build together"}
        subtitle={fr
          ? "Contactez notre équipe partenaires pour discuter d'une collaboration stratégique et mutuellement bénéfique."
          : "Contact our partner team to discuss a strategic, mutually beneficial collaboration."}
        btnText={fr ? "Devenir partenaire" : "Become a partner"}
        href="/contact"
      />
    </div>
  );
}
