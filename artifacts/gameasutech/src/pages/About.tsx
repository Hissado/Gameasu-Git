import React from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { CTASection } from "@/components/CTASection";
import { CheckCircle, Globe, Users, Award, Target, Heart, Lightbulb, Shield } from "lucide-react";

const values = [
  { icon: Award, keyFr: "Excellence", keyEn: "Excellence", descFr: "Nous maintenons les plus hauts standards de qualité dans chaque projet, chaque livraison et chaque interaction client. L'excellence n'est pas une option, c'est notre engagement.", descEn: "We maintain the highest standards of quality in every project, delivery, and client interaction. Excellence is not optional — it is our commitment." },
  { icon: Heart, keyFr: "Intégrité", keyEn: "Integrity", descFr: "La transparence et l'honnêteté guident chacune de nos décisions. Nous tenons nos engagements, toujours, sans exception.", descEn: "Transparency and honesty guide every decision we make. We keep our commitments, always, without exception." },
  { icon: Lightbulb, keyFr: "Innovation", keyEn: "Innovation", descFr: "Nous investissons continuellement dans les technologies émergentes pour offrir des solutions modernes, compétitives et pérennes à nos clients.", descEn: "We continuously invest in emerging technologies to deliver modern, competitive, and future-proof solutions to our clients." },
  { icon: Users, keyFr: "Partenariat", keyEn: "Partnership", descFr: "Nous nous positionnons comme des partenaires stratégiques de long terme, pas seulement des prestataires. Votre succès est notre succès, sans compromis.", descEn: "We position ourselves as long-term strategic partners, not just vendors. Your success is our success — no compromises." },
  { icon: Globe, keyFr: "Présence internationale", keyEn: "Global Reach", descFr: "Fondés aux États-Unis, déployés à l'international dès 2026 — nous connectons les standards technologiques mondiaux aux réalités de chaque marché.", descEn: "Founded in the USA, deployed internationally from 2026 — we connect global technology standards to the realities of every market." },
  { icon: Shield, keyFr: "Fiabilité", keyEn: "Reliability", descFr: "Nos clients nous confient leurs systèmes critiques. Nous prenons cette responsabilité au sérieux et répondons présents à chaque moment qui compte.", descEn: "Our clients entrust us with their critical systems. We take this responsibility seriously and show up every time it matters." },
];

const milestones = [
  { year: "2023", eventFr: "Fondation de Gaméasù aux États-Unis — New Haven, CT", eventEn: "Gaméasù founded in the United States — New Haven, CT" },
  { year: "2024", eventFr: "Structuration de l'offre de services et constitution de l'équipe internationale", eventEn: "Service offering structured and international team built" },
  { year: "2025", eventFr: "Certifications technologiques clés : Microsoft, AWS, Google Cloud", eventEn: "Key technology certifications: Microsoft, AWS, Google Cloud" },
  { year: "2026", eventFr: "Expansion internationale : Canada, France, Belgique", eventEn: "International expansion: Canada, France, Belgium" },
  { year: "2026", eventFr: "Ouverture des bureaux Afrique de l'Ouest : Togo, Côte d'Ivoire, Mali", eventEn: "West Africa offices opened: Togo, Côte d'Ivoire, Mali" },
  { year: "2026", eventFr: "Lancement de la practice IA & Automatisation et présence dans 7 pays", eventEn: "AI & Automation practice launched — presence in 7 countries" },
];

const commitments = [
  { fr: "Réponse en moins de 4h pour tout incident critique", en: "Response within 4 hours for any critical incident" },
  { fr: "Chef de projet dédié pour chaque engagement", en: "Dedicated project manager for every engagement" },
  { fr: "Reporting de transparence mensuel", en: "Monthly transparency reporting" },
  { fr: "Formation incluse dans chaque déploiement", en: "Training included in every deployment" },
  { fr: "Support multilingue FR / EN / langues locales", en: "Multilingual support FR / EN / local languages" },
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
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900 leading-tight mb-6">
              {fr
                ? "Gaméasù transforme les ambitions digitales des entreprises en solutions technologiques concrètes, sécurisées et évolutives."
                : "Gaméasù transforms companies' digital ambitions into concrete, secure, and scalable technology solutions."}
            </h1>
            <p className="text-base font-semibold text-primary tracking-widest mb-6 uppercase">
              {fr ? "Innover · Transformer · Sécuriser" : "Innovate · Transform · Secure"}
            </p>
            <p className="text-xl text-slate-500 leading-relaxed max-w-3xl">
              {fr
                ? "Gaméasù se positionne à l'intersection d'un cabinet de conseil IT de premier plan et d'une entreprise technologique internationale ambitieuse — précise, fiable et résolument tournée vers l'avenir. Nous accompagnons les organisations dans leur transformation numérique à l'échelle mondiale, avec une forte connexion à l'Afrique et à sa diaspora."
                : "Gaméasù stands at the intersection of a leading IT consulting firm and an ambitious international technology company — precise, reliable, and firmly forward-looking. We support organizations in their digital transformation globally, with a strong connection to Africa and its diaspora."}
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
                  ? "Devenir le partenaire technologique de référence pour les organisations francophones et leurs diasporas à l'international, en bâtissant un pont entre les standards technologiques mondiaux et les réalités des marchés locaux."
                  : "To become the reference technology partner for French-speaking organizations and their international diasporas, building a bridge between global technology standards and local market realities."}
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
            <p className="text-slate-500 text-lg">{fr ? "Les principes qui définissent notre façon de travailler et de nous engager auprès de chaque client." : "The principles that define how we work and engage with every client."}</p>
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
              <h2 className="text-4xl font-bold text-slate-900">{fr ? "Fondée en 2023, déployée à l'international" : "Founded in 2023, deployed internationally"}</h2>
              <p className="text-slate-500 mt-4 text-lg">
                {fr
                  ? "Des États-Unis à l'Afrique de l'Ouest, en passant par l'Europe — une trajectoire de croissance internationale claire et maîtrisée."
                  : "From the United States to West Africa and Europe — a clear and controlled international growth trajectory."}
              </p>
            </div>
            <div className="relative">
              <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-200" />
              <div className="space-y-8">
                {milestones.map((m, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="flex gap-8 relative">
                    <div className="w-12 h-12 rounded-full bg-white border-2 border-primary flex items-center justify-center flex-shrink-0 relative z-10">
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
                  ? "Chaque client — qu'il soit en Amérique du Nord, en Europe ou en Afrique — reçoit un niveau de service comparable aux plus grandes entreprises technologiques mondiales. La géographie ne doit jamais être un obstacle à l'excellence."
                  : "Every client — whether in North America, Europe, or Africa — receives service comparable to the world's largest technology firms. Geography should never be a barrier to excellence."}
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
        subtitle={fr
          ? "Prêt à collaborer avec une équipe internationale dédiée à votre succès technologique ?"
          : "Ready to work with an international team dedicated to your technology success?"}
        btnText={fr ? "Parler à un expert" : "Talk to an expert"}
        href="/contact"
      />
    </div>
  );
}
