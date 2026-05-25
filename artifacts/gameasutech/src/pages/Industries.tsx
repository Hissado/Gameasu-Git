import React, { useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { CTASection } from "@/components/CTASection";
import { Building2, Landmark, GraduationCap, HeartPulse, Banknote, Globe, Store, Factory, Heart, ChevronDown } from "lucide-react";

const industries = [
  { icon: Building2, labelFr: "Grandes Entreprises", labelEn: "Large Enterprises", descFr: "Pour les grands groupes opérant dans des environnements complexes et multi-sites, nous déployons des solutions IT de niveau enterprise.", descEn: "For large groups in complex, multi-site environments, we deploy enterprise-grade IT solutions.", solutions: ["Infrastructure multi-sites", "Governance & conformité", "Intégration ERP / SI", "Sécurité enterprise"], solutionsEn: ["Multi-site infrastructure", "Governance & compliance", "ERP / IS integration", "Enterprise security"], color: "border-blue-200 hover:border-blue-400", iconColor: "bg-blue-50 text-blue-700" },
  { icon: Banknote, labelFr: "Finance & Banque", labelEn: "Banking & Finance", descFr: "Conformité réglementaire stricte, résilience des systèmes et protection des données financières sensibles.", descEn: "Strict regulatory compliance, system resilience, and sensitive financial data protection.", solutions: ["Conformité réglementaire", "Cybersécurité financière", "Continuité d'activité", "Cloud sécurisé FINTECH"], solutionsEn: ["Regulatory compliance", "Financial cybersecurity", "Business continuity", "Secure FINTECH cloud"], color: "border-green-200 hover:border-green-400", iconColor: "bg-green-50 text-green-700" },
  { icon: HeartPulse, labelFr: "Santé", labelEn: "Healthcare", descFr: "Systèmes fiables disponibles 24/7, conformes aux réglementations médicales et sécurisant les données de santé.", descEn: "Reliable 24/7 systems, compliant with medical regulations, securing health data.", solutions: ["Sécurité données médicales", "Télémedecine & digital", "Conformité HIPAA / RGPD", "Infrastructure critique"], solutionsEn: ["Medical data security", "Telemedicine & digital", "HIPAA / GDPR compliance", "Critical infrastructure"], color: "border-red-200 hover:border-red-400", iconColor: "bg-red-50 text-red-700" },
  { icon: GraduationCap, labelFr: "Éducation", labelEn: "Education", descFr: "Campus connecté, collaboration pédagogique et sécurité adaptées aux environnements multi-utilisateurs.", descEn: "Connected campus, educational collaboration, and security for multi-user environments.", solutions: ["Campus connecté", "Plateformes e-learning", "Collaboration enseignants", "Sécurité multi-utilisateurs"], solutionsEn: ["Connected campus", "E-learning platforms", "Teacher collaboration", "Multi-user security"], color: "border-indigo-200 hover:border-indigo-400", iconColor: "bg-indigo-50 text-indigo-700" },
  { icon: Landmark, labelFr: "Institutions Publiques", labelEn: "Government", descFr: "Modernisation des services publics, e-gouvernement et souveraineté numérique pour les administrations.", descEn: "Public service modernization, e-government, and digital sovereignty for administrations.", solutions: ["Modernisation SI public", "E-gouvernement", "Souveraineté numérique", "Interopérabilité"], solutionsEn: ["Public IS modernization", "E-government", "Digital sovereignty", "Interoperability"], color: "border-slate-200 hover:border-slate-400", iconColor: "bg-slate-50 text-slate-700" },
  { icon: Globe, labelFr: "Organisations Internationales", labelEn: "International Organizations", descFr: "ONG et agences de développement avec expertise terrain et standards internationaux.", descEn: "NGOs and development agencies with field expertise and international standards.", solutions: ["Connectivité terrain", "Systèmes hors ligne / hybrides", "Formation locale", "Reporting & monitoring"], solutionsEn: ["Field connectivity", "Offline / hybrid systems", "Local training", "Reporting & monitoring"], color: "border-cyan-200 hover:border-cyan-400", iconColor: "bg-cyan-50 text-cyan-700" },
  { icon: Store, labelFr: "Commerce & Distribution", labelEn: "Retail & Distribution", descFr: "Connectez vos systèmes de vente, logistique et données clients pour des opérations fluides.", descEn: "Connect your sales systems, logistics, and customer data for smooth operations.", solutions: ["Systèmes POS & e-commerce", "Gestion logistique", "Analytique client", "Omnicanal"], solutionsEn: ["POS & e-commerce systems", "Logistics management", "Customer analytics", "Omnichannel"], color: "border-orange-200 hover:border-orange-400", iconColor: "bg-orange-50 text-orange-700" },
  { icon: Factory, labelFr: "Industrie & BTP", labelEn: "Industry & Construction", descFr: "Connectivité terrain, supervision des équipements, IoT industriel et gestion de projets intégrés.", descEn: "Field connectivity, equipment monitoring, industrial IoT, and integrated project management.", solutions: ["IoT industriel", "Supervision terrain", "Gestion de projets IT", "Sécurité physique"], solutionsEn: ["Industrial IoT", "Field supervision", "IT project management", "Physical security"], color: "border-yellow-200 hover:border-yellow-400", iconColor: "bg-yellow-50 text-yellow-700" },
  { icon: Heart, labelFr: "ONG & Impact Social", labelEn: "NGOs & Social Impact", descFr: "Solutions IT adaptées aux contraintes budgétaires avec des standards élevés de qualité.", descEn: "IT solutions adapted to budget constraints with high quality standards.", solutions: ["Solutions à coût maîtrisé", "Cloud mutualisé", "Outils de reporting", "Formation des équipes"], solutionsEn: ["Cost-controlled solutions", "Shared cloud", "Reporting tools", "Team training"], color: "border-pink-200 hover:border-pink-400", iconColor: "bg-pink-50 text-pink-700" },
];

export default function Industries() {
  const { language } = useLanguage();
  const fr = language === "fr";
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <section className="relative pt-32 pb-20 bg-gradient-to-br from-slate-50 via-blue-50/30 to-white overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
              <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Solutions sectorielles" : "Industry solutions"}</p>
              <h1 className="text-5xl md:text-6xl font-bold text-slate-900 leading-tight mb-6">
                {fr ? "Des solutions sur-mesure pour chaque secteur" : "Custom solutions built for your industry"}
              </h1>
              <p className="text-xl text-slate-500 leading-relaxed">
                {fr ? "Grâce à notre expérience transversale, nous déployons des solutions créatives et personnalisées, conçues pour les spécificités de votre secteur." : "Leveraging our cross-industry knowledge, we deploy creative, custom solutions for the specifics of your sector."}
              </p>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.7 }} className="hidden lg:block">
              <div className="relative rounded-2xl overflow-hidden h-72 bg-slate-200 shadow-xl">
                <img
                  src="https://images.unsplash.com/photo-1573497620053-ea5300f94f21?w=900&q=80&auto=format&fit=crop"
                  alt="Professionnels africains en environnement technologique"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-slate-900/40 to-transparent" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-16 pb-28 bg-white">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {industries.map((ind, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}>
                <div className={`group h-full bg-white border-2 ${ind.color} rounded-2xl p-8 cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1`}
                  onClick={() => setActiveIndex(activeIndex === i ? null : i)}>
                  <div className="flex items-start justify-between mb-6">
                    <div className={`p-3 rounded-xl ${ind.iconColor} transition-colors duration-300 flex-shrink-0`}>
                      <ind.icon size={26} />
                    </div>
                    <ChevronDown size={18} className={`text-slate-400 transition-transform duration-300 ${activeIndex === i ? 'rotate-180 text-primary' : ''}`} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{fr ? ind.labelFr : ind.labelEn}</h3>
                  <p className="text-slate-500 leading-relaxed text-sm mb-5">{fr ? ind.descFr : ind.descEn}</p>
                  <motion.div initial={false} animate={{ height: activeIndex === i ? 'auto' : 0, opacity: activeIndex === i ? 1 : 0 }} transition={{ duration: 0.3 }} style={{ overflow: 'hidden' }}>
                    <div className="border-t border-slate-100 pt-4 space-y-2">
                      <p className="text-xs text-primary font-bold uppercase tracking-wide mb-3">{fr ? "Solutions déployées" : "Deployed solutions"}</p>
                      {(fr ? ind.solutions : ind.solutionsEn).map((s, j) => (
                        <div key={j} className="flex items-center gap-2 text-sm text-slate-600">
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
