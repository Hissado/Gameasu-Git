import React from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { Link } from "wouter";
import {
  ArrowRight, Shield, Cloud, Brain, Monitor, Zap,
  TrendingUp, CheckCircle, ChevronRight, ArrowUpRight,
  Building2, Landmark, GraduationCap, HeartPulse, Banknote, Factory,
  Globe
} from "lucide-react";
import { CTASection } from "@/components/CTASection";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] } })
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
  { icon: Globe, titleFr: "Ancrage africain, standards mondiaux", titleEn: "African roots, global standards", descFr: "Nés pour servir les marchés africains francophones avec les exigences techniques des leaders américains et européens.", descEn: "Built to serve French-speaking African markets with the technical standards of US and European leaders." },
  { icon: GraduationCap, titleFr: "Équipe 100% certifiée", titleEn: "100% certified team", descFr: "Microsoft, AWS, Cisco, Fortinet — chaque expert est certifié sur les technologies qu'il déploie.", descEn: "Microsoft, AWS, Cisco, Fortinet — every expert is certified on the technologies they deploy." },
  { icon: Zap, titleFr: "Réactivité garantie 24/7", titleEn: "24/7 guaranteed response", descFr: "Réponse sous 4h pour tout incident critique, avec un chef de projet dédié à chaque mission.", descEn: "Response within 4 hours for any critical incident, with a dedicated project manager." },
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
  { labelFr: "Nos Réalisations", labelEn: "Our Work", descFr: "Partenaire de confiance, nous livrons des solutions qui améliorent la performance opérationnelle.", descEn: "Trusted partner delivering solutions that enhance operational performance.", href: "/case-studies", ctaFr: "Voir nos projets", ctaEn: "See our work", bg: "bg-slate-900 text-white" },
  { labelFr: "Ressources & Blog", labelEn: "Blog & Resources", descFr: "Découvrez l'expertise de nos consultants sur les grandes tendances technologiques.", descEn: "Explore insights from our consultants on major technology trends.", href: "/blog", ctaFr: "Lire le blog", ctaEn: "Read the blog", bg: "bg-primary text-white" },
  { labelFr: "Partenaires Tech", labelEn: "Technology Partners", descFr: "Des partenariats stratégiques avec les leaders technologiques mondiaux.", descEn: "Strategic partnerships with global technology leaders.", href: "/partners", ctaFr: "Nos partenaires", ctaEn: "Our partners", bg: "bg-white border border-slate-200 text-slate-900" },
];

export default function Home() {
  const { language } = useLanguage();
  const fr = language === "fr";

  return (
    <div className="min-h-screen bg-background selection:bg-primary/20 selection:text-primary">

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 overflow-hidden bg-background">
        <div className="absolute inset-0 pointer-events-none opacity-[0.02]"
          style={{ backgroundImage: "linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)", backgroundSize: "4rem 4rem" }} />

        <div className="container mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            <div className="lg:col-span-7">
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6, ease: "easeOut" }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-600 tracking-widest uppercase mb-8"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                {fr ? "Innover · Transformer · Sécuriser" : "Innovate · Transform · Secure"}
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="text-5xl sm:text-6xl md:text-7xl font-extrabold leading-[1.05] tracking-tight text-foreground mb-8"
              >
                {fr
                  ? <>L'excellence en <span className="text-primary italic font-serif font-medium">transformation</span> numérique.</>
                  : <>Excellence in <span className="text-primary italic font-serif font-medium">digital</span> transformation.</>}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
                className="text-xl md:text-2xl text-slate-500 font-medium leading-relaxed mb-12 max-w-2xl"
              >
                {fr
                  ? "Gaméasù accompagne les entreprises et institutions du monde entier avec des solutions technologiques de pointe, sécurisées et évolutives."
                  : "Gaméasù supports businesses and institutions worldwide with cutting-edge, secure, and scalable technology solutions."}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6, ease: "easeOut" }}
                className="flex flex-wrap gap-4"
              >
                <Link href="/contact">
                  <div className="group inline-flex items-center gap-3 px-8 py-4 bg-foreground text-white font-bold tracking-wide rounded-full hover:bg-primary transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgba(37,99,235,0.3)] hover:-translate-y-1 cursor-pointer">
                    {fr ? "Demander une consultation" : "Request a consultation"}
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
                <Link href="/services">
                  <div className="inline-flex items-center gap-3 px-8 py-4 bg-white text-slate-900 font-bold tracking-wide rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md">
                    {fr ? "Découvrir nos expertises" : "Discover our expertise"}
                  </div>
                </Link>
              </motion.div>

              {/* Stats — visible on mobile only */}
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }}
                className="grid grid-cols-2 gap-4 mt-12 lg:hidden"
              >
                {stats.map((s, i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <div className="text-2xl font-extrabold text-foreground mb-1">{s.value}</div>
                    <div className="text-xs text-slate-500 font-bold tracking-wide uppercase">{fr ? s.labelFr : s.labelEn}</div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Hero image + stats — desktop only */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className="hidden lg:flex flex-col gap-6 lg:col-span-5"
            >
              <div className="relative rounded-[2rem] overflow-hidden aspect-[4/5] bg-slate-200 shadow-2xl shadow-slate-900/10 border-8 border-white">
                <img
                  src={`${import.meta.env.BASE_URL}hero-meeting.png`}
                  alt="Équipe Gaméasù en réunion"
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {stats.slice(0, 2).map((s, i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <div className="text-2xl font-extrabold text-foreground mb-1">{s.value}</div>
                    <div className="text-xs text-slate-500 font-bold tracking-wide uppercase">{fr ? s.labelFr : s.labelEn}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── SERVICES APERÇU ──────────────────────────────────────── */}
      <section className="py-24 bg-white border-t border-slate-100">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-16">
            <div className="max-w-2xl">
              <p className="text-primary font-bold uppercase tracking-widest text-xs mb-3">
                {fr ? "Nos expertises" : "Our expertise"}
              </p>
              <h2 className="text-4xl md:text-5xl font-extrabold text-foreground leading-tight">
                {fr ? "Solutions technologiques de pointe." : "Cutting-edge technology solutions."}
              </h2>
            </div>
            <Link href="/services">
              <div className="inline-flex items-center gap-2 text-foreground font-bold tracking-wide border-b-2 border-foreground pb-1 hover:text-primary hover:border-primary transition-colors cursor-pointer flex-shrink-0">
                {fr ? "Voir tous les services" : "All services"}
                <ArrowRight size={16} />
              </div>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {services.map((s, i) => (
              <motion.div key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                <Link href={s.href}>
                  <div className="group h-full bg-white border border-slate-200 rounded-[2rem] p-8 hover:border-primary/30 hover:shadow-2xl hover:shadow-slate-200/50 cursor-pointer transition-all duration-500 hover:-translate-y-1">
                    <div className="flex items-center justify-between mb-8">
                      <div className="p-4 rounded-2xl bg-slate-50 text-foreground group-hover:bg-primary group-hover:text-white transition-all duration-500">
                        <s.icon size={28} strokeWidth={1.5} />
                      </div>
                      <ArrowUpRight size={24} className="text-slate-300 group-hover:text-primary transition-colors duration-500" />
                    </div>
                    <h3 className="font-extrabold text-foreground text-xl mb-3">{fr ? s.titleFr : s.titleEn}</h3>
                    <p className="text-slate-500 text-base leading-relaxed font-medium">{fr ? s.descFr : s.descEn}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── QUI SOMMES-NOUS ──────────────────────────────────────── */}
      <section className="py-24 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-primary/10 blur-[120px] pointer-events-none rounded-full translate-x-1/2" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: "easeOut" }}>
              <p className="text-primary font-bold uppercase tracking-widest text-xs mb-4">
                {fr ? "Le standard Gaméasù" : "The Gaméasù Standard"}
              </p>
              <h2 className="text-4xl md:text-5xl font-extrabold leading-tight mb-8">
                {fr
                  ? <>Ingénieurs. Architectes. <span className="text-accent italic font-serif font-medium">Partenaires.</span></>
                  : <>Engineers. Architects. <span className="text-accent italic font-serif font-medium">Partners.</span></>}
              </h2>
              <p className="text-slate-400 text-xl leading-relaxed mb-10 font-medium">
                {fr
                  ? "Fondée en 2023, Gaméasù délivre des solutions d'infrastructure de classe mondiale, alliant une présence locale à des standards internationaux de sécurité et de performance."
                  : "Founded in 2023, Gaméasù delivers world-class infrastructure solutions, combining local presence with international standards of security and performance."}
              </p>
              <div className="flex flex-wrap gap-4 mb-10">
                {(fr
                  ? ["Excellence technique", "Intégrité", "Disponibilité 24/7", "Partenariat stratégique"]
                  : ["Technical excellence", "Integrity", "24/7 Availability", "Strategic partnership"]
                ).map((v) => (
                  <div key={v} className="flex items-center gap-2.5 px-4 py-2 rounded-full border border-slate-700 bg-slate-800/50 text-sm font-bold tracking-wide">
                    <CheckCircle size={16} className="text-accent" />
                    {v}
                  </div>
                ))}
              </div>
              <Link href="/about">
                <div className="group inline-flex items-center gap-3 text-white font-bold tracking-wide hover:text-accent transition-all cursor-pointer">
                  {fr ? "Découvrir notre histoire" : "Discover our history"}
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </motion.div>

            {/* Why us — 3 items */}
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: "easeOut" }}
              className="flex flex-col gap-6">
              {whyUs.map((item, i) => (
                <div key={i} className="flex items-start gap-6 p-8 bg-slate-800/50 border border-slate-700/50 rounded-[2rem] hover:border-accent/50 hover:bg-slate-800 transition-all duration-500">
                  <div className="p-3 bg-slate-900 rounded-xl text-accent flex-shrink-0 border border-slate-700">
                    <item.icon size={24} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-lg mb-2">{fr ? item.titleFr : item.titleEn}</h3>
                    <p className="text-slate-400 text-base leading-relaxed font-medium">{fr ? item.descFr : item.descEn}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── SECTEURS ─────────────────────────────────────────────── */}
      <section className="py-20 bg-slate-50 border-b border-slate-200">
        <div className="container mx-auto px-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-12">
            <div>
              <p className="text-primary font-bold uppercase tracking-widest text-xs mb-3">
                {fr ? "Expertise sectorielle" : "Industry expertise"}
              </p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground">
                {fr ? "Des solutions par industrie" : "Industry-specific solutions"}
              </h2>
            </div>
            <Link href="/industries">
              <div className="inline-flex items-center gap-2 text-sm font-bold text-foreground border-b-2 border-transparent hover:border-primary hover:text-primary transition-colors cursor-pointer flex-shrink-0 pb-1">
                {fr ? "Tous les secteurs" : "All industries"}
                <ArrowRight size={16} />
              </div>
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {industries.map((ind, i) => (
              <motion.div key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                <Link href="/industries">
                  <div className="group flex flex-col items-center gap-4 p-6 bg-white border border-slate-200 rounded-[1.5rem] hover:border-primary hover:shadow-lg cursor-pointer transition-all duration-300 text-center hover:-translate-y-1">
                    <div className="p-3 rounded-2xl bg-slate-50 text-slate-500 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                      <ind.icon size={28} strokeWidth={1.5} />
                    </div>
                    <span className="text-sm font-bold text-slate-700 group-hover:text-foreground transition-colors leading-tight">{fr ? ind.labelFr : ind.labelEn}</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── RESSOURCES ───────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-primary font-bold uppercase tracking-widest text-xs mb-3">
              {fr ? "Perspectives" : "Insights"}
            </p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-foreground">
              {fr ? "Ressources & Réalisations" : "Resources & Work"}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {resources.map((r, i) => (
              <motion.div key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                <Link href={r.href}>
                  <div className={`group h-full rounded-[2rem] p-10 overflow-hidden cursor-pointer transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl ${r.bg}`}>
                    <h3 className="text-2xl font-extrabold mb-4">{fr ? r.labelFr : r.labelEn}</h3>
                    <p className={`text-base leading-relaxed mb-10 font-medium ${r.bg.includes('bg-white') ? 'text-slate-500' : 'text-white/70'}`}>
                      {fr ? r.descFr : r.descEn}
                    </p>
                    <div className="inline-flex items-center gap-3 font-bold tracking-wide border-b-2 border-current pb-1 mt-auto">
                      {fr ? r.ctaFr : r.ctaEn}
                      <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <CTASection
        title={fr ? "Prêt à transformer votre organisation ?" : "Ready to transform your organization?"}
        subtitle={fr
          ? "Prenez rendez-vous avec nos architectes pour une évaluation de votre infrastructure."
          : "Schedule a meeting with our architects for an infrastructure assessment."}
        btnText={fr ? "Contacter nos équipes" : "Contact our teams"}
        href="/contact"
      />
    </div>
  );
}
