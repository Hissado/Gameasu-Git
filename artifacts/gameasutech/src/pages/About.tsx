import React from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { CTASection } from "@/components/CTASection";
import { CheckCircle, Globe, Users, Award, Target, Heart, Lightbulb, Shield } from "lucide-react";

const values = [
  { icon: Award, keyFr: "Excellence", keyEn: "Excellence", descFr: "Nous maintenons les plus hauts standards de qualité dans chaque projet, chaque livraison et chaque interaction client.", descEn: "We maintain the highest standards of quality in every project, delivery, and client interaction." },
  { icon: Heart, keyFr: "Intégrité", keyEn: "Integrity", descFr: "La transparence et l'honnêteté guident chacune de nos décisions. Nous tenons nos engagements, toujours.", descEn: "Transparency and honesty guide every decision we make. We keep our commitments, always." },
  { icon: Lightbulb, keyFr: "Innovation", keyEn: "Innovation", descFr: "Nous investissons continuellement dans les nouvelles technologies pour offrir des solutions modernes et compétitives.", descEn: "We continuously invest in emerging technologies to offer modern, competitive solutions." },
  { icon: Users, keyFr: "Partenariat", keyEn: "Partnership", descFr: "Nous nous positionnons comme des partenaires de long terme, pas seulement des prestataires. Votre succès est notre succès.", descEn: "We position ourselves as long-term partners, not just vendors. Your success is our success." },
  { icon: Globe, keyFr: "Diversité", keyEn: "Diversity", descFr: "Enracinés en Afrique et connectés au monde, nous valorisons les perspectives multiculturelles comme force d'innovation.", descEn: "Rooted in Africa and connected to the world, we value multicultural perspectives as an innovation strength." },
  { icon: Shield, keyFr: "Fiabilité", keyEn: "Reliability", descFr: "Nos clients comptent sur nous pour des systèmes critiques. Nous prenons cette responsabilité au sérieux.", descEn: "Our clients rely on us for critical systems. We take this responsibility seriously." },
];

const milestones = [
  { year: "2010", eventFr: "Fondation de Gaméasù Technology aux États-Unis", eventEn: "Gaméasù Technology founded in the United States" },
  { year: "2013", eventFr: "Expansion en France et en Belgique", eventEn: "Expansion to France and Belgium" },
  { year: "2016", eventFr: "Ouverture du bureau Afrique à Lomé, Togo", eventEn: "Opening of Africa office in Lomé, Togo" },
  { year: "2018", eventFr: "Lancement au Canada et en Côte d'Ivoire", eventEn: "Launch in Canada and Côte d'Ivoire" },
  { year: "2021", eventFr: "Expansion au Mali — 500 projets livrés", eventEn: "Expansion to Mali — 500 projects delivered" },
  { year: "2024", eventFr: "Lancement de la practice IA & Automatisation", eventEn: "Launch of AI & Automation practice" },
];

const commitments = [
  { fr: "Réponse en moins de 4h pour tout incident critique", en: "Response within 4 hours for any critical incident" },
  { fr: "Chef de projet dédié pour chaque engagement", en: "Dedicated project manager for every engagement" },
  { fr: "Reporting de transparence mensuel", en: "Monthly transparency reporting" },
  { fr: "Formation incluse dans chaque déploiement", en: "Training included in every deployment" },
  { fr: "Support multilingue FR / EN / locales", en: "Multilingual support FR / EN / local languages" },
  { fr: "SLA garanti contractuellement", en: "Contractually guaranteed SLA" },
];

export default function About() {
  const { language } = useLanguage();
  const fr = language === "fr";

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative pt-32 pb-24 bg-gradient-to-br from-slate-50 via-blue-50/30 to-white overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-4xl">
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">
              {fr ? "À propos de nous" : "About us"}
            </p>
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900 leading-tight mb-8">
              {fr
                ? "Une entreprise née d'une ambition : connecter l'Afrique au monde technologique."
                : "A company born from one ambition: connecting Africa to the technology world."}
            </h1>
            <p className="text-xl text-slate-500 leading-relaxed max-w-3xl">
              {fr
                ? "Gaméasù Technology est à l'intersection d'un cabinet de conseil IT mondial et d'une entreprise technologique africaine ambitieuse — précise, fiable, et résolument tournée vers l'avenir."
                : "Gaméasù Technology stands at the intersection of a world-class IT consultancy and an ambitious African tech firm — precise, reliable, and firmly forward-looking."}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Mission / Vision */}
      <section className="py-20 bg-white border-y border-slate-100">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-primary/5 border border-primary/15 rounded-2xl p-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-lg bg-primary/10 text-primary"><Target size={24} /></div>
                <h2 className="text-2xl font-bold text-slate-900">{fr ? "Notre Mission" : "Our Mission"}</h2>
              </div>
              <p className="text-slate-600 leading-relaxed text-lg">
                {fr
                  ? "Accompagner les entreprises, institutions et organisations dans leur transformation numérique grâce à des solutions technologiques modernes, sécurisées et évolutives — en maintenant les plus hauts standards de qualité, partout dans le monde."
                  : "To support businesses, institutions, and organizations in their digital transformation through modern, secure, and scalable technology solutions — maintaining the highest quality standards everywhere in the world."}
              </p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="bg-white border border-slate-200 rounded-2xl p-10 hover:border-primary/30 transition-colors shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-lg bg-primary/10 text-primary"><Globe size={24} /></div>
                <h2 className="text-2xl font-bold text-slate-900">{fr ? "Notre Vision" : "Our Vision"}</h2>
              </div>
              <p className="text-slate-600 leading-relaxed text-lg">
                {fr
                  ? "Devenir le partenaire technologique de référence en Afrique francophone et dans la diaspora internationale, en bâtissant un pont entre les standards technologiques mondiaux et les réalités des marchés émergents."
                  : "To become the reference technology partner in French-speaking Africa and the international diaspora, building a bridge between global technology standards and emerging market realities."}
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-28 bg-gradient-to-br from-slate-50 to-blue-50/20">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Ce qui nous guide" : "What guides us"}</p>
            <h2 className="text-4xl font-bold text-slate-900 mb-4">{fr ? "Nos valeurs fondamentales" : "Our core values"}</h2>
            <p className="text-slate-500 text-lg">{fr ? "Les principes qui définissent notre façon de travailler et de nous engager." : "The principles that define how we work and engage with our clients."}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {values.map((v, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                <div className="group h-full bg-white border border-slate-200 rounded-xl p-8 hover:border-primary/40 hover:shadow-md transition-all duration-300">
                  <div className="p-3 rounded-lg bg-primary/8 text-primary inline-flex mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
                    <v.icon size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{fr ? v.keyFr : v.keyEn}</h3>
                  <p className="text-slate-500 leading-relaxed text-sm">{fr ? v.descFr : v.descEn}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-28 bg-white border-y border-slate-100">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Notre parcours" : "Our journey"}</p>
              <h2 className="text-4xl font-bold text-slate-900">{fr ? "15 ans d'innovation" : "15 years of innovation"}</h2>
            </div>
            <div className="relative">
              <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-200" />
              <div className="space-y-8">
                {milestones.map((m, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="flex gap-8 relative">
                    <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center flex-shrink-0 relative z-10 bg-white">
                      <span className="text-xs font-bold text-primary">{m.year.slice(2)}</span>
                    </div>
                    <div className="flex-1 pb-2 pt-2">
                      <div className="text-xs text-primary font-semibold mb-1">{m.year}</div>
                      <div className="text-slate-800 font-medium">{fr ? m.eventFr : m.eventEn}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Commitments */}
      <section className="py-28 bg-gradient-to-br from-slate-50 to-blue-50/20">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Notre engagement" : "Our commitment"}</p>
              <h2 className="text-4xl font-bold text-slate-900 mb-6">{fr ? "La qualité est une promesse, pas une option." : "Quality is a promise, not an option."}</h2>
              <p className="text-slate-500 text-lg leading-relaxed mb-10">
                {fr
                  ? "Chaque client reçoit un niveau de service comparable aux plus grandes entreprises technologiques mondiales — peu importe la taille du projet ou la géographie."
                  : "Every client receives service comparable to the world's largest technology firms — regardless of project size or geography."}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {commitments.map((c, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }} className="flex items-start gap-4 p-4 rounded-xl bg-white border border-slate-200 hover:border-primary/30 transition-colors shadow-sm">
                  <CheckCircle size={20} className="text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-slate-700 font-medium text-sm">{fr ? c.fr : c.en}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <CTASection
        title={fr ? "Démarrons ensemble" : "Let's get started"}
        subtitle={fr ? "Prêt à collaborer avec une équipe dédiée à votre succès technologique ?" : "Ready to work with a team dedicated to your technology success?"}
        btnText={fr ? "Nous contacter" : "Contact us"}
        href="/contact"
      />
    </div>
  );
}
