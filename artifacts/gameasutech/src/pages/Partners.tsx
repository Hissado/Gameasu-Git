import React from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { CTASection } from "@/components/CTASection";
import { Award, Globe, Handshake, Shield, CheckCircle } from "lucide-react";

const partnerCategories = [
  {
    labelFr: "Partenaires Technologiques",
    labelEn: "Technology Partners",
    descFr: "Des fournisseurs technologiques de référence mondiale dont nous déployons et supportons les solutions chez nos clients.",
    descEn: "World-class technology vendors whose solutions we deploy and support for our clients.",
    icon: Shield,
    partners: ["Microsoft", "Cisco", "VMware", "Fortinet", "Palo Alto Networks", "AWS", "Google Cloud", "ServiceNow"]
  },
  {
    labelFr: "Partenaires Institutionnels",
    labelEn: "Institutional Partners",
    descFr: "Des organisations et institutions avec lesquelles nous collaborons pour développer les compétences numériques en Afrique.",
    descEn: "Organizations and institutions with which we collaborate to develop digital skills in Africa.",
    icon: Globe,
    partners: ["Union Européenne", "Banque Mondiale", "PNUD", "GIZ", "AFD", "Alliance for AI"]
  },
  {
    labelFr: "Partenaires Stratégiques",
    labelEn: "Strategic Partners",
    descFr: "Des entreprises complémentaires avec lesquelles nous collaborons sur des projets d'envergure nécessitant une expertise pluridisciplinaire.",
    descEn: "Complementary companies with which we collaborate on large-scale projects requiring multidisciplinary expertise.",
    icon: Handshake,
    partners: ["Cabinets conseil locaux", "ESN partenaires", "Intégrateurs spécialisés", "Éditeurs logiciels"]
  }
];

const certifications = [
  "Microsoft Gold Partner",
  "Cisco Premier Partner",
  "AWS Consulting Partner",
  "Google Cloud Partner",
  "Fortinet Expert Partner",
  "ISO 27001 Certified"
];

const partnerBenefits = [
  { fr: "Accès aux dernières technologies et mises à jour", en: "Access to the latest technologies and updates" },
  { fr: "Support technique prioritaire des éditeurs", en: "Priority technical support from vendors" },
  { fr: "Formations et certifications continues", en: "Continuous training and certifications" },
  { fr: "Tarifs préférentiels répercutés aux clients", en: "Preferential pricing passed on to clients" },
  { fr: "Accès aux bêtas et programmes early-adopter", en: "Access to betas and early-adopter programs" },
  { fr: "Co-innovation et développement conjoint", en: "Co-innovation and joint development" }
];

export default function Partners() {
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
              {fr ? "Nos partenaires" : "Our partners"}
            </p>
            <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
              {fr ? "Des partenariats au service de votre excellence" : "Partnerships in service of your excellence"}
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl">
              {fr
                ? "Gaméasù Technology collabore avec les leaders technologiques mondiaux, des institutions stratégiques et des partenaires complémentaires pour délivrer des solutions fiables, performantes et à la pointe de l'innovation."
                : "Gaméasù Technology collaborates with global technology leaders, strategic institutions, and complementary partners to deliver reliable, high-performance, cutting-edge solutions."}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Certifications Banner */}
      <section className="py-12 bg-card border-y border-border">
        <div className="container mx-auto px-6">
          <p className="text-center text-sm text-primary font-semibold uppercase tracking-widest mb-8">
            {fr ? "Certifications & Accréditations" : "Certifications & Accreditations"}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {certifications.map((cert, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}>
                <div className="flex items-center gap-2 px-5 py-3 bg-primary/10 border border-primary/20 rounded-xl text-sm font-semibold text-white">
                  <Award size={16} className="text-primary" />
                  {cert}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Partner Categories */}
      <section className="py-28">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              {fr ? "Notre écosystème partenaires" : "Our partner ecosystem"}
            </h2>
            <p className="text-muted-foreground text-lg">
              {fr
                ? "Trois dimensions de partenariat pour vous offrir les meilleures solutions du marché."
                : "Three partnership dimensions to offer you the best solutions on the market."}
            </p>
          </div>

          <div className="space-y-8">
            {partnerCategories.map((cat, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <div className="bg-card border border-border rounded-2xl p-8 md:p-10">
                  <div className="flex items-start gap-6 mb-8">
                    <div className="p-4 rounded-xl bg-primary/10 text-primary flex-shrink-0">
                      <cat.icon size={28} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-2">{fr ? cat.labelFr : cat.labelEn}</h3>
                      <p className="text-muted-foreground leading-relaxed">{fr ? cat.descFr : cat.descEn}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 ml-0 md:ml-20">
                    {cat.partners.map((p, j) => (
                      <div key={j} className="px-4 py-2 bg-background border border-border rounded-lg text-sm font-medium text-foreground hover:border-primary/40 transition-colors">
                        {p}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Partner Benefits */}
      <section className="py-28 bg-card border-y border-border">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">
                {fr ? "Pourquoi ça compte" : "Why it matters"}
              </p>
              <h2 className="text-4xl font-bold text-white mb-6">
                {fr
                  ? "Des partenariats qui profitent directement à nos clients"
                  : "Partnerships that directly benefit our clients"}
              </h2>
              <p className="text-muted-foreground leading-relaxed text-lg">
                {fr
                  ? "Nos accréditations ne sont pas de simples labels — elles représentent un niveau d'expertise reconnu par les éditeurs, une priorité d'accès aux ressources techniques et un engagement de qualité vérifiable."
                  : "Our accreditations are not mere labels — they represent a level of expertise recognized by vendors, priority access to technical resources, and verifiable quality commitment."}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {partnerBenefits.map((b, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }} className="flex items-start gap-4 p-4 bg-background border border-border rounded-xl hover:border-primary/30 transition-colors">
                  <CheckCircle size={20} className="text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground">{fr ? b.fr : b.en}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Become a Partner */}
      <section className="py-28">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto">
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">
              {fr ? "Devenir partenaire" : "Become a partner"}
            </p>
            <h2 className="text-4xl font-bold text-white mb-6">
              {fr ? "Construisons ensemble" : "Let's build together"}
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed mb-10">
              {fr
                ? "Vous êtes un éditeur, un intégrateur ou une organisation cherchant à collaborer avec Gaméasù Technology sur le marché africain et international ? Contactez notre équipe partenariats."
                : "Are you a software vendor, integrator, or organization looking to collaborate with Gaméasù Technology in African and international markets? Contact our partnerships team."}
            </p>
            <a href="/contact" className="inline-flex items-center gap-3 px-8 py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors cursor-pointer">
              {fr ? "Discuter d'un partenariat" : "Discuss a partnership"}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
