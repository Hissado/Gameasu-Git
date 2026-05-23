import React, { useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { CTASection } from "@/components/CTASection";
import { Building2, Landmark, GraduationCap, HeartPulse, Banknote, Globe, Store, Factory, Heart, Home, ShoppingCart, ChevronRight } from "lucide-react";

const industries = [
  {
    icon: Building2,
    labelFr: "Grandes Entreprises",
    labelEn: "Large Enterprises",
    descFr: "Pour les grands groupes opérant dans des environnements complexes et multi-sites, nous déployons des solutions IT de niveau enterprise : infrastructure haute disponibilité, gouvernance des données, sécurité avancée et intégration des systèmes hérités.",
    descEn: "For large groups operating in complex, multi-site environments, we deploy enterprise-grade IT solutions: high-availability infrastructure, data governance, advanced security, and legacy system integration.",
    solutions: ["Infrastructure multi-sites", "Governance & conformité", "Intégration ERP / SI", "Sécurité enterprise"],
    solutionsEn: ["Multi-site infrastructure", "Governance & compliance", "ERP / IS integration", "Enterprise security"],
    color: "from-blue-900/40 to-blue-800/20"
  },
  {
    icon: Banknote,
    labelFr: "Finance & Banque",
    labelEn: "Banking & Finance",
    descFr: "Les institutions financières font face à des exigences réglementaires strictes et des risques cyber croissants. Nous assurons la conformité, la résilience des systèmes et la protection des données financières sensibles.",
    descEn: "Financial institutions face strict regulatory requirements and growing cyber risks. We ensure compliance, system resilience, and protection of sensitive financial data.",
    solutions: ["Conformité réglementaire", "Cybersécurité financière", "Continuité d'activité", "Cloud sécurisé FINTECH"],
    solutionsEn: ["Regulatory compliance", "Financial cybersecurity", "Business continuity", "Secure FINTECH cloud"],
    color: "from-green-900/40 to-green-800/20"
  },
  {
    icon: HeartPulse,
    labelFr: "Santé",
    labelEn: "Healthcare",
    descFr: "Le secteur de la santé exige des systèmes fiables, disponibles 24/7 et conformes aux réglementations sur les données médicales. Nous sécurisons les infrastructures hospitalières et facilitons la digitalisation des parcours de soins.",
    descEn: "Healthcare requires reliable, 24/7 systems compliant with medical data regulations. We secure hospital infrastructures and facilitate the digitalization of care pathways.",
    solutions: ["Sécurité données médicales", "Télémedecine & digital", "Conformité HIPAA / RGPD", "Infrastructure critique"],
    solutionsEn: ["Medical data security", "Telemedicine & digital", "HIPAA / GDPR compliance", "Critical infrastructure"],
    color: "from-red-900/40 to-red-800/20"
  },
  {
    icon: GraduationCap,
    labelFr: "Éducation",
    labelEn: "Education",
    descFr: "Universités, écoles et organismes de formation bénéficient de nos solutions de campus connecté, de collaboration pédagogique et de sécurité adaptées aux environnements multi-utilisateurs et aux contraintes budgétaires.",
    descEn: "Universities, schools, and training organizations benefit from our connected campus solutions, pedagogical collaboration, and security adapted to multi-user environments.",
    solutions: ["Campus connecté", "Plateformes e-learning", "Collaboration enseignants", "Sécurité multi-utilisateurs"],
    solutionsEn: ["Connected campus", "E-learning platforms", "Teacher collaboration", "Multi-user security"],
    color: "from-indigo-900/40 to-indigo-800/20"
  },
  {
    icon: Landmark,
    labelFr: "Institutions Publiques",
    labelEn: "Government & Public Sector",
    descFr: "Administrations, collectivités et organismes publics ont besoin de systèmes robustes, conformes et accessibles. Nous accompagnons la modernisation des services publics et la digitalisation des procédures administratives.",
    descEn: "Government agencies, local authorities, and public bodies need robust, compliant, and accessible systems. We support public service modernization and administrative process digitalization.",
    solutions: ["Modernisation SI public", "E-gouvernement", "Souveraineté numérique", "Interopérabilité"],
    solutionsEn: ["Public IS modernization", "E-government", "Digital sovereignty", "Interoperability"],
    color: "from-slate-700/40 to-slate-600/20"
  },
  {
    icon: Globe,
    labelFr: "Organisations Internationales",
    labelEn: "International Organizations",
    descFr: "ONG, agences de développement et organisations multilatérales bénéficient de notre expertise terrain en Afrique et de nos standards internationaux pour des systèmes d'information résilients dans des contextes complexes.",
    descEn: "NGOs, development agencies, and multilateral organizations benefit from our African field expertise and international standards for resilient information systems in complex contexts.",
    solutions: ["Connectivité terrain", "Systèmes hors ligne / hybrides", "Formation locale", "Reporting & monitoring"],
    solutionsEn: ["Field connectivity", "Offline / hybrid systems", "Local training", "Reporting & monitoring"],
    color: "from-cyan-900/40 to-cyan-800/20"
  },
  {
    icon: Store,
    labelFr: "Commerce & Distribution",
    labelEn: "Retail & Distribution",
    descFr: "Dans un secteur où l'expérience client est reine, nous connectons vos systèmes de vente, votre logistique et vos données clients pour des opérations fluides et une prise de décision rapide.",
    descEn: "In a sector where customer experience is king, we connect your sales systems, logistics, and customer data for smooth operations and fast decision-making.",
    solutions: ["Systèmes POS & e-commerce", "Gestion logistique", "Analytique client", "Omnicanal"],
    solutionsEn: ["POS & e-commerce systems", "Logistics management", "Customer analytics", "Omnichannel"],
    color: "from-orange-900/40 to-orange-800/20"
  },
  {
    icon: Factory,
    labelFr: "Industrie & BTP",
    labelEn: "Industry & Construction",
    descFr: "Les entreprises industrielles et de construction bénéficient de nos solutions de connectivité terrain, de supervision des équipements, d'IoT industriel et de systèmes de gestion de projets intégrés.",
    descEn: "Industrial and construction companies benefit from our field connectivity solutions, equipment monitoring, industrial IoT, and integrated project management systems.",
    solutions: ["IoT industriel", "Supervision terrain", "Gestion de projets IT", "Sécurité physique"],
    solutionsEn: ["Industrial IoT", "Field supervision", "IT project management", "Physical security"],
    color: "from-yellow-900/40 to-yellow-800/20"
  },
  {
    icon: Heart,
    labelFr: "ONG & Impact Social",
    labelEn: "NGOs & Social Impact",
    descFr: "Les organisations à impact social bénéficient de solutions IT adaptées à leurs contraintes budgétaires tout en maintenant des standards élevés de sécurité, de conformité et de performance.",
    descEn: "Social impact organizations benefit from IT solutions adapted to their budget constraints while maintaining high standards of security, compliance, and performance.",
    solutions: ["Solutions à coût maîtrisé", "Cloud mutualisé", "Outils de reporting", "Formation des équipes"],
    solutionsEn: ["Cost-controlled solutions", "Shared cloud", "Reporting tools", "Team training"],
    color: "from-pink-900/40 to-pink-800/20"
  },
];

export default function Industries() {
  const { language } = useLanguage();
  const fr = language === "fr";
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-20%,rgba(30,64,200,0.2)_0%,transparent_70%)] pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-4xl">
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">
              {fr ? "Solutions sectorielles" : "Industry solutions"}
            </p>
            <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
              {fr ? "Des solutions sur-mesure pour chaque secteur" : "Custom solutions built for your industry"}
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl">
              {fr
                ? "Grâce à notre expérience transversale, nous déployons des solutions créatives et personnalisées, conçues pour les spécificités de votre secteur d'activité."
                : "Leveraging our cross-industry knowledge, we deploy creative, custom solutions designed for the specifics of your business sector."}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Industries Grid */}
      <section className="py-16 pb-28">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {industries.map((ind, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.07 }}
              >
                <div
                  className={`group h-full bg-gradient-to-br ${ind.color} border border-border rounded-2xl p-8 cursor-pointer transition-all duration-300 hover:border-primary/40 hover:-translate-y-1`}
                  onClick={() => setActiveIndex(activeIndex === i ? null : i)}
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                      <ind.icon size={26} />
                    </div>
                    <ChevronRight size={18} className={`text-muted-foreground transition-transform duration-300 ${activeIndex === i ? 'rotate-90 text-primary' : ''}`} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{fr ? ind.labelFr : ind.labelEn}</h3>
                  <p className="text-muted-foreground leading-relaxed text-sm mb-6">{fr ? ind.descFr : ind.descEn}</p>

                  <motion.div
                    initial={false}
                    animate={{ height: activeIndex === i ? 'auto' : 0, opacity: activeIndex === i ? 1 : 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="border-t border-border/50 pt-4 space-y-2">
                      <p className="text-xs text-primary font-semibold uppercase tracking-wide mb-3">
                        {fr ? "Solutions déployées" : "Deployed solutions"}
                      </p>
                      {(fr ? ind.solutions : ind.solutionsEn).map((s, j) => (
                        <div key={j} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                          {s}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <CTASection
        title={fr ? "Votre secteur, nos experts" : "Your industry, our experts"}
        subtitle={fr ? "Discutons de vos défis sectoriels spécifiques et construisons ensemble la solution adaptée." : "Let's discuss your specific industry challenges and build the right solution together."}
        btnText={fr ? "Parler à un expert" : "Talk to an expert"}
        href="/contact"
      />
    </div>
  );
}
