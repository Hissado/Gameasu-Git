import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { Quote, ChevronLeft, ChevronRight, Star } from "lucide-react";

const testimonials = [
  {
    nameFr: "Kwame Asante",
    nameEn: "Kwame Asante",
    roleFr: "Directeur des Systèmes d'Information",
    roleEn: "Chief Information Officer",
    companyFr: "Groupe Bancaire Atlantique, Abidjan",
    companyEn: "Atlantique Banking Group, Abidjan",
    quoteFr: "Gaméasù a transformé notre infrastructure IT en moins de quatre mois. Nous avons réduit nos coûts opérationnels de 38% et notre SOC surveille maintenant nos systèmes 24h/24. Un partenaire qui comprend vraiment les enjeux des marchés africains.",
    quoteEn: "Gaméasù transformed our IT infrastructure in under four months. We reduced operational costs by 38% and our SOC now monitors our systems around the clock. A partner who truly understands African market challenges.",
    country: "ci",
    sector: "Finance",
    stars: 5,
  },
  {
    nameFr: "Dr. Fatoumata Diallo",
    nameEn: "Dr. Fatoumata Diallo",
    roleFr: "Directrice Générale",
    roleEn: "Managing Director",
    companyFr: "Clinique Santé Plus, Lomé",
    companyEn: "Santé Plus Clinic, Lomé",
    quoteFr: "Le déploiement de notre système de gestion hospitalière a été exemplaire. L'équipe Gaméasù a su s'adapter aux contraintes de connectivité locales sans jamais compromettre la qualité. Nous sommes maintenant 100% numérisés.",
    quoteEn: "The deployment of our hospital management system was exemplary. The Gaméasù team adapted to local connectivity constraints without ever compromising quality. We are now 100% digitized.",
    country: "tg",
    sector: "Santé",
    stars: 5,
  },
  {
    nameFr: "Marc-Antoine Bédard",
    nameEn: "Marc-Antoine Bédard",
    roleFr: "Responsable Technologie",
    roleEn: "Head of Technology",
    companyFr: "StartupNord Inc., Montréal",
    companyEn: "StartupNord Inc., Montreal",
    quoteFr: "Nous avions besoin d'une expertise cloud et cybersécurité à la hauteur de nos ambitions internationales. Gaméasù nous a apporté exactement ça, avec une réactivité et une transparence que nous n'avions jamais rencontrées chez d'autres prestataires.",
    quoteEn: "We needed cloud and cybersecurity expertise that matched our international ambitions. Gaméasù delivered exactly that, with a responsiveness and transparency we had never encountered with other service providers.",
    country: "ca",
    sector: "Tech",
    stars: 5,
  },
  {
    nameFr: "Moussa Coulibaly",
    nameEn: "Moussa Coulibaly",
    roleFr: "Secrétaire Général",
    roleEn: "Secretary General",
    companyFr: "Ministère de l'Éducation, Bamako",
    companyEn: "Ministry of Education, Bamako",
    quoteFr: "La migration de nos serveurs vers le cloud et la formation de nos équipes se sont passées sans interruption de service. Gaméasù a fait preuve d'un professionnalisme remarquable et d'une vraie compréhension du secteur public africain.",
    quoteEn: "The migration of our servers to the cloud and the training of our teams took place without any service interruption. Gaméasù demonstrated remarkable professionalism and a genuine understanding of the African public sector.",
    country: "ml",
    sector: "Éducation",
    stars: 5,
  },
  {
    nameFr: "Isabelle Moreau",
    nameEn: "Isabelle Moreau",
    roleFr: "DSI",
    roleEn: "CIO",
    companyFr: "Groupe Industriel Horizon, Bruxelles",
    companyEn: "Horizon Industrial Group, Brussels",
    quoteFr: "Leur approche structurée — diagnostic, proposition, déploiement, formation et support continu — nous a permis de maîtriser chaque étape de notre transformation. Je recommande Gaméasù à toute organisation sérieuse sur son avenir numérique.",
    quoteEn: "Their structured approach — diagnosis, proposal, deployment, training, and ongoing support — allowed us to master every step of our transformation. I recommend Gaméasù to any organization serious about its digital future.",
    country: "be",
    sector: "Industrie",
    stars: 5,
  },
];

export function Testimonials() {
  const { language } = useLanguage();
  const fr = language === "fr";
  const [current, setCurrent] = useState(0);

  const prev = () => setCurrent((c) => (c === 0 ? testimonials.length - 1 : c - 1));
  const next = () => setCurrent((c) => (c === testimonials.length - 1 ? 0 : c + 1));

  const t = testimonials[current];

  return (
    <section className="py-20 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">
            {fr ? "Ce que disent nos clients" : "What our clients say"}
          </p>
          <h2 className="text-4xl font-bold text-white mb-4">
            {fr ? "La confiance, notre premier actif" : "Trust is our greatest asset"}
          </h2>
          <p className="text-slate-400 text-lg">
            {fr
              ? "Des organisations à travers 7 pays nous font confiance pour leurs transformations les plus critiques."
              : "Organizations across 7 countries trust us with their most critical transformations."}
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="relative bg-white/5 border border-white/10 rounded-3xl p-10 md:p-14 backdrop-blur-sm"
            >
              <Quote size={48} className="text-primary/30 absolute top-8 left-10" />

              <div className="flex gap-1 mb-8 mt-4">
                {Array.from({ length: t.stars }).map((_, i) => (
                  <Star key={i} size={16} className="fill-primary text-primary" />
                ))}
              </div>

              <blockquote className="text-white/90 text-xl md:text-2xl leading-relaxed font-light mb-10 relative z-10">
                "{fr ? t.quoteFr : t.quoteEn}"
              </blockquote>

              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                  <img
                    src={`https://flagcdn.com/24x18/${t.country}.png`}
                    srcSet={`https://flagcdn.com/48x36/${t.country}.png 2x`}
                    width={24}
                    height={18}
                    alt=""
                    className="rounded-sm"
                  />
                </div>
                <div>
                  <div className="font-bold text-white text-base">{fr ? t.nameFr : t.nameEn}</div>
                  <div className="text-slate-400 text-sm">{fr ? t.roleFr : t.roleEn}</div>
                  <div className="text-primary text-xs font-semibold mt-0.5">{fr ? t.companyFr : t.companyEn}</div>
                </div>
                <span className="ml-auto text-xs text-white/30 border border-white/10 px-3 py-1 rounded-full">
                  {t.sector}
                </span>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-center gap-6 mt-8">
            <button
              onClick={prev}
              className="p-3 rounded-full border border-white/20 text-white/60 hover:border-primary hover:text-primary transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex gap-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    i === current ? "bg-primary w-6" : "bg-white/25"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={next}
              className="p-3 rounded-full border border-white/20 text-white/60 hover:border-primary hover:text-primary transition-all"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
