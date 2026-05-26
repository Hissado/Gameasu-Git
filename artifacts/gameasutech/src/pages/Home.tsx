import React from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { Link } from "wouter";
import {
  ArrowRight, Shield, Cloud, Brain, Monitor, Zap,
  TrendingUp, CheckCircle, ChevronRight, ArrowUpRight,
  Building2, Landmark, GraduationCap, HeartPulse, Banknote, Factory
} from "lucide-react";
import { CTASection } from "@/components/CTASection";

const fadeUp = {
  hidden: { y: 20 },
  visible: (i = 0) => ({ y: 0, transition: { delay: i * 0.03, duration: 0.22 } })
};

const stats = [
  { value: "100+", labelFr: "Missions réalisées", labelEn: "Missions delivered" },
  { value: "7", labelFr: "Pays de présence", labelEn: "Countries" },
  { value: "98%", labelFr: "Satisfaction client", labelEn: "Client satisfaction" },
  { value: "2023", labelFr: "Fondée aux États-Unis", labelEn: "Founded in the USA" }
];

const services = [
  { icon: Shield, titleFr: "Cybersécurité", titleEn: "Cybersecurity", descFr: "SOC 24/7, audit de sécurité et protection des endpoints.", descEn: "24/7 SOC, security audit and endpoint protection.", href: "/cybersecurity" },
  { icon: Cloud, titleFr: "Cloud & Infrastructure", titleEn: "Cloud & Infrastructure", descFr: "Migration cloud, réseau SD-WAN et infrastructure hybride.", descEn: "Cloud migration, SD-WAN network and hybrid infrastructure.", href: "/cloud-infrastructure" },
  { icon: Brain, titleFr: "Intelligence Artificielle", titleEn: "Artificial Intelligence", descFr: "Automatisation, RPA, chatbots et analytique prédictive.", descEn: "Automation, RPA, chatbots and predictive analytics.", href: "/ai-automation" },
  { icon: Monitor, titleFr: "Modern Workplace", titleEn: "Modern Workplace", descFr: "Microsoft 365, Teams et solutions de collaboration hybride.", descEn: "Microsoft 365, Teams and hybrid collaboration solutions.", href: "/services" },
  { icon: Zap, titleFr: "Services Managés", titleEn: "Managed IT Services", descFr: "Helpdesk, supervision et maintenance proactive 24/7.", descEn: "Helpdesk, monitoring and proactive maintenance 24/7.", href: "/support" },
];

const whyUs = [
  { icon: "🌍", titleFr: "Ancrage africain, standards mondiaux", titleEn: "African roots, global standards", descFr: "Nés pour servir les marchés africains francophones avec les exigences techniques des leaders américains et européens.", descEn: "Built to serve French-speaking African markets with the technical standards of US and European leaders." },
  { icon: "🎓", titleFr: "Équipe 100% certifiée", titleEn: "100% certified team", descFr: "Microsoft, AWS, Cisco, Fortinet — chaque expert est certifié sur les technologies qu'il déploie.", descEn: "Microsoft, AWS, Cisco, Fortinet — every expert is certified on the technologies they deploy." },
  { icon: "⚡", titleFr: "Réactivité garantie 24/7", titleEn: "24/7 guaranteed response", descFr: "Réponse sous 4h pour tout incident critique, avec un chef de projet dédié à chaque mission.", descEn: "Response within 4 hours for any critical incident, with a dedicated project manager." },
];

const industries = [
  { icon: Building2, labelFr: "Grandes entreprises", labelEn: "Large enterprises" },
  { icon: Banknote, labelFr: "Finance & Banque", labelEn: "Banking & Finance" },
  { icon: HeartPulse, labelFr: "Santé", labelEn: "Healthcare" },
  { icon: GraduationCap, labelFr: "Éducation", labelEn: "Education" },
  { icon: Landmark, labelFr: "Secteur public", labelEn: "Government" },
  { icon: Factory, labelFr: "Industrie & Commerce", labelEn: "Industry & Retail" },
];

const resources = [
  { labelFr: "Nos Réalisations", labelEn: "Our Work", descFr: "Partenaire de confiance, nous livrons des solutions qui améliorent la performance opérationnelle.", descEn: "Trusted partner delivering solutions that enhance operational performance.", href: "/case-studies", ctaFr: "Voir nos projets", ctaEn: "See our work", gradient: "from-blue-700 to-blue-800" },
  { labelFr: "Ressources & Blog", labelEn: "Blog & Resources", descFr: "Découvrez l'expertise de nos consultants sur les grandes tendances technologiques.", descEn: "Explore insights from our consultants on major technology trends.", href: "/blog", ctaFr: "Lire le blog", ctaEn: "Read the blog", gradient: "from-indigo-700 to-indigo-800" },
  { labelFr: "Partenaires Technologiques", labelEn: "Technology Partners", descFr: "Des partenariats stratégiques avec les leaders technologiques mondiaux.", descEn: "Strategic partnerships with global technology leaders.", href: "/partners", ctaFr: "Nos partenaires", ctaEn: "Our partners", gradient: "from-slate-700 to-slate-800" },
];

export default function Home() {
  const { language } = useLanguage();
  const fr = language === "fr";

  return (
    <div className="min-h-screen bg-background">

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="relative pt-24 pb-16 overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/40 to-white">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-100/40 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-100/30 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none opacity-[0.3]"
          style={{ backgroundImage: "radial-gradient(circle, #93c5fd 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="container mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <motion.p
                initial={{ y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02, duration: 0.2 }}
                className="text-base font-semibold text-primary tracking-widest mb-5 uppercase"
              >
                {fr ? "Innover · Transformer · Sécuriser" : "Innovate · Transform · Secure"}
              </motion.p>

              <motion.h1
                initial={{ y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04, duration: 0.28 }}
                className="text-4xl sm:text-5xl md:text-6xl xl:text-7xl font-bold leading-[1.06] tracking-tight text-slate-900 mb-6"
              >
                {fr
                  ? <>Accélérez votre <span className="text-primary">transformation</span> numérique.</>
                  : <>Accelerate your <span className="text-primary">digital</span> transformation.</>}
              </motion.h1>

              <motion.p
                initial={{ y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06, duration: 0.25 }}
                className="text-xl text-slate-500 leading-relaxed mb-10 max-w-xl"
              >
                {fr
                  ? "Gaméasù accompagne les entreprises, institutions et organisations en Afrique, en Amérique du Nord et en Europe avec des solutions technologiques fiables, sécurisées et évolutives."
                  : "Gaméasù supports businesses, institutions and organizations across Africa, North America and Europe with reliable, secure and scalable technology solutions."}
              </motion.p>

              <motion.div
                initial={{ y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.2 }}
                className="flex flex-wrap gap-4"
              >
                <Link href="/contact">
                  <div className="group inline-flex items-center gap-3 px-8 py-4 bg-primary text-white font-semibold rounded-xl hover:bg-blue-700 transition-all duration-300 shadow-lg shadow-primary/25 hover:shadow-primary/40 cursor-pointer">
                    {fr ? "Demander une consultation" : "Request a consultation"}
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
                <Link href="/services">
                  <div className="inline-flex items-center gap-3 px-6 py-3.5 sm:px-8 sm:py-4 bg-white text-slate-800 font-semibold rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all duration-300 cursor-pointer shadow-sm">
                    {fr ? "Découvrir nos services" : "Discover our services"}
                  </div>
                </Link>
              </motion.div>

              {/* Stats — visible on mobile only */}
              <motion.div
                initial={{ y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10, duration: 0.25 }}
                className="grid grid-cols-2 gap-3 mt-8 lg:hidden"
              >
                {stats.map((s, i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <div className="text-xl font-bold text-slate-900 mb-0.5">{s.value}</div>
                    <div className="text-xs text-slate-500 font-medium leading-snug">{fr ? s.labelFr : s.labelEn}</div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Hero image + stats — desktop only */}
            <motion.div
              initial={{ x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.10, duration: 0.3 }}
              className="hidden lg:flex flex-col gap-4"
            >
              <div className="relative rounded-2xl overflow-hidden h-72 bg-slate-200 shadow-xl">
                <img
                  src={`${import.meta.env.BASE_URL}hero-meeting.webp`}
                  alt="Équipe Gaméasù en réunion"
                  className="w-full h-full object-cover"
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                />
              </div>
              <div className="grid grid-cols-4 gap-3">
                {stats.map((s, i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-center shadow-sm">
                    <div className="text-xl font-bold text-slate-900 mb-0.5">{s.value}</div>
                    <div className="text-[11px] text-slate-500 font-medium leading-snug">{fr ? s.labelFr : s.labelEn}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── SERVICES APERÇU ──────────────────────────────────────── */}
      <section className="py-16 bg-white border-y border-slate-100">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
            <div>
              <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-2">
                {fr ? "Nos expertises" : "Our expertise"}
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
                {fr ? "Des solutions de bout en bout" : "End-to-end technology solutions"}
              </h2>
            </div>
            <Link href="/services">
              <div className="inline-flex items-center gap-2 text-primary font-semibold text-sm border border-primary/30 px-4 py-2 rounded-lg hover:bg-primary/5 transition-colors cursor-pointer flex-shrink-0">
                {fr ? "Tous les services" : "All services"}
                <ChevronRight size={15} />
              </div>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {services.map((s, i) => (
              <motion.div key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.05 }}>
                <Link href={s.href}>
                  <div className="group h-full bg-white border border-slate-200 rounded-xl p-5 hover:border-primary/40 hover:shadow-md cursor-pointer transition-all duration-300 hover:-translate-y-0.5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-2.5 rounded-lg bg-primary/8 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                        <s.icon size={20} />
                      </div>
                      <ArrowUpRight size={14} className="text-slate-300 group-hover:text-primary transition-colors" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm mb-1.5">{fr ? s.titleFr : s.titleEn}</h3>
                    <p className="text-slate-500 text-xs leading-relaxed">{fr ? s.descFr : s.descEn}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── QUI SOMMES-NOUS ──────────────────────────────────────── */}
      <section className="py-16 bg-gradient-to-br from-slate-50 to-blue-50/20">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ x: -24 }} whileInView={{ x: 0 }} viewport={{ once: true, amount: 0.05 }} transition={{ duration: 0.25 }}>
              <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-3">
                {fr ? "Qui sommes-nous" : "Who we are"}
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight mb-5">
                {fr
                  ? <>Ingénieurs. Architectes. <span className="text-primary">Partenaires</span> de confiance.</>
                  : <>Engineers. Architects. <span className="text-primary">Trusted</span> Partners.</>}
              </h2>
              <p className="text-slate-500 text-lg leading-relaxed mb-7">
                {fr
                  ? "Fondée en 2023 aux États-Unis, Gaméasù délivre des solutions technologiques de bout en bout grâce à une équipe d'experts certifiés, présente dans 7 pays sur 3 continents."
                  : "Founded in 2023 in the United States, Gaméasù delivers end-to-end technology solutions through a team of certified experts, present in 7 countries across 3 continents."}
              </p>
              <div className="flex flex-wrap gap-5 mb-8">
                {(fr
                  ? ["Excellence", "Intégrité", "Innovation", "Partenariat"]
                  : ["Excellence", "Integrity", "Innovation", "Partnership"]
                ).map((v) => (
                  <div key={v} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <CheckCircle size={15} className="text-primary" />
                    {v}
                  </div>
                ))}
              </div>
              <Link href="/about">
                <div className="group inline-flex items-center gap-2 text-primary font-semibold hover:gap-3 transition-all cursor-pointer">
                  {fr ? "En savoir plus sur nous" : "Learn more about us"}
                  <ChevronRight size={17} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </motion.div>

            {/* Why us — 3 items */}
            <motion.div initial={{ x: 24 }} whileInView={{ x: 0 }} viewport={{ once: true, amount: 0.05 }} transition={{ duration: 0.25 }}
              className="flex flex-col gap-4">
              {whyUs.map((item, i) => (
                <div key={i} className="flex items-start gap-4 p-5 bg-white border border-slate-200 rounded-xl hover:border-primary/30 hover:shadow-sm transition-all duration-300">
                  <span className="text-2xl flex-shrink-0 mt-0.5">{item.icon}</span>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm mb-1">{fr ? item.titleFr : item.titleEn}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">{fr ? item.descFr : item.descEn}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── SECTEURS ─────────────────────────────────────────────── */}
      <section className="py-12 bg-white border-y border-slate-100">
        <div className="container mx-auto px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-1">
                {fr ? "Secteurs" : "Industries"}
              </p>
              <h2 className="text-2xl font-bold text-slate-900">
                {fr ? "Solutions sur-mesure pour chaque secteur" : "Tailored solutions for every industry"}
              </h2>
            </div>
            <Link href="/industries">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-primary border border-primary/30 px-4 py-2 rounded-lg hover:bg-primary/5 transition-colors cursor-pointer flex-shrink-0">
                {fr ? "Voir tous les secteurs" : "All industries"}
                <ChevronRight size={14} />
              </div>
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {industries.map((ind, i) => (
              <motion.div key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.05 }}>
                <Link href="/industries">
                  <div className="group flex flex-col items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-primary/40 hover:bg-primary/5 cursor-pointer transition-all duration-300 text-center">
                    <div className="p-2.5 rounded-lg bg-white text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300 shadow-sm">
                      <ind.icon size={20} />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 group-hover:text-primary transition-colors leading-tight">{fr ? ind.labelFr : ind.labelEn}</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── RESSOURCES ───────────────────────────────────────────── */}
      <section className="py-16 bg-gradient-to-br from-slate-50 to-blue-50/20">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-10">
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-3">
              {fr ? "Aller plus loin" : "Go further"}
            </p>
            <h2 className="text-3xl font-bold text-slate-900">
              {fr ? "Expertise et réalisations" : "Expertise & achievements"}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {resources.map((r, i) => (
              <motion.div key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.05 }}>
                <Link href={r.href}>
                  <div className={`group relative h-full bg-gradient-to-br ${r.gradient} rounded-2xl p-7 overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}>
                    <div className="absolute top-0 right-0 p-5 opacity-10 group-hover:opacity-20 transition-opacity">
                      <TrendingUp size={70} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3 relative z-10">{fr ? r.labelFr : r.labelEn}</h3>
                    <p className="text-white/70 leading-relaxed mb-6 relative z-10 text-sm">{fr ? r.descFr : r.descEn}</p>
                    <div className="inline-flex items-center gap-2 text-white font-semibold text-sm border-b border-white/40 pb-0.5 group-hover:border-white transition-colors relative z-10">
                      {fr ? r.ctaFr : r.ctaEn}
                      <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <CTASection
        title={fr ? "Parlez à un expert Gaméasù" : "Talk to a Gaméasù expert"}
        subtitle={fr
          ? "Décrivez votre projet et recevez une analyse personnalisée. Nos équipes répondent sous 24 heures."
          : "Describe your project and receive a personalized analysis. Our teams respond within 24 hours."}
        btnText={fr ? "Demander une consultation" : "Request a consultation"}
        href="/contact"
      />
    </div>
  );
}
