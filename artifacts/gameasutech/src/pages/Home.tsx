import React from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { Link } from "wouter";
import {
  ArrowRight, ArrowUpRight, Shield, Cloud, Brain, Monitor, Zap,
  Globe, TrendingUp, CheckCircle, ChevronRight,
  Building2, Landmark, GraduationCap, HeartPulse, Banknote, Factory
} from "lucide-react";
import { CTASection } from "@/components/CTASection";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.55 } })
};

const painPoints = [
  { icon: Shield, titleFr: "Menaces de sécurité ?", titleEn: "Security threats?", descFr: "Protégez votre organisation avec une cybersécurité avancée et une surveillance 24/7.", descEn: "Protect your organization with advanced cybersecurity and 24/7 monitoring.", href: "/cybersecurity", accent: "text-blue-700 bg-blue-100", border: "hover:border-blue-300" },
  { icon: Globe, titleFr: "Travail hybride difficile ?", titleEn: "Struggling with hybrid work?", descFr: "Activez une collaboration fluide avec des solutions de travail moderne.", descEn: "Enable seamless collaboration with modern workplace solutions.", href: "/services", accent: "text-indigo-700 bg-indigo-100", border: "hover:border-indigo-300" },
  { icon: Zap, titleFr: "Prêt à vous transformer ?", titleEn: "Ready to transform?", descFr: "Modernisez votre écosystème technologique de bout en bout.", descEn: "Modernize your entire technology ecosystem end-to-end.", href: "/ai-automation", accent: "text-violet-700 bg-violet-100", border: "hover:border-violet-300" },
  { icon: Brain, titleFr: "Par où commencer ?", titleEn: "Not sure where to start?", descFr: "Obtenez une consultation gratuite pour identifier vos priorités critiques.", descEn: "Get a free consultation to identify your critical priorities.", href: "/contact", accent: "text-sky-700 bg-sky-100", border: "hover:border-sky-300" }
];

const whatWeDo = [
  { icon: Monitor, titleFr: "Modern Workplace", titleEn: "Modern Workplace", descFr: "Plateformes de communication unifiée, outils de collaboration et intégrations qui transforment la façon dont vos équipes travaillent.", descEn: "Unified communication platforms, collaboration tools, and seamless integrations that transform how your teams work.", href: "/services" },
  { icon: Cloud, titleFr: "Infrastructure & Cloud", titleEn: "Infrastructure & Cloud", descFr: "Réseau haute performance, cloud hybride et supervision intelligente pour une connectivité résiliente et des performances optimisées.", descEn: "High-performance networking, hybrid cloud infrastructure, and intelligent monitoring for resilient connectivity and optimized performance.", href: "/cloud-infrastructure" },
  { icon: Shield, titleFr: "Cybersécurité & Sécurité Physique", titleEn: "Cyber & Physical Security", descFr: "Protection intégrée : cybersécurité avancée, contrôle d'accès, vidéosurveillance et surveillance des menaces.", descEn: "Integrated protection: advanced cybersecurity, access control, surveillance, and threat monitoring across digital & physical.", href: "/cybersecurity" },
  { icon: Zap, titleFr: "Transformation Digitale", titleEn: "Digital Transformation", descFr: "Migration cloud, automatisation des processus et modernisation complète de votre SI — de la stratégie au déploiement.", descEn: "Cloud migration, process automation, and complete IS modernization — from strategy to deployment.", href: "/services" },
  { icon: Brain, titleFr: "Intelligence Artificielle", titleEn: "AI for Business", descFr: "Analytique prédictive, automatisation intelligente et expériences personnalisées qui génèrent des opérations plus intelligentes.", descEn: "Predictive analytics, intelligent automation, and personalized experiences that drive smarter operations.", href: "/ai-automation" }
];

const industries = [
  { icon: Building2, labelFr: "Grandes Entreprises", labelEn: "Large Enterprises" },
  { icon: Banknote, labelFr: "Finance & Banque", labelEn: "Banking & Finance" },
  { icon: HeartPulse, labelFr: "Santé", labelEn: "Healthcare" },
  { icon: GraduationCap, labelFr: "Éducation", labelEn: "Education" },
  { icon: Landmark, labelFr: "Institutions Publiques", labelEn: "Government" },
  { icon: Factory, labelFr: "Industrie & Commerce", labelEn: "Industry & Retail" }
];

const resources = [
  { labelFr: "Nos Réalisations", labelEn: "Our Work", descFr: "Partenaire de confiance livrant des solutions qui améliorent l'efficacité et l'expérience client.", descEn: "Trusted partner delivering solutions that enhance efficiency and client experience.", href: "/case-studies", ctaFr: "Voir nos projets", ctaEn: "See our work", gradient: "from-blue-700 to-blue-800" },
  { labelFr: "Ressources & Blog", labelEn: "Our Blog", descFr: "Découvrez l'expertise de nos consultants sur les grandes tendances technologiques.", descEn: "Hear directly from our experts on leading technology trends and industry insights.", href: "/blog", ctaFr: "Lire le blog", ctaEn: "Go to the blog", gradient: "from-indigo-700 to-indigo-800" },
  { labelFr: "Partenaires Technologiques", labelEn: "Our Partners", descFr: "Des partenariats stratégiques avec les leaders technologiques mondiaux.", descEn: "Strategic partnerships with global technology leaders for best-in-class solutions.", href: "/partners", ctaFr: "Nos partenaires", ctaEn: "Our partners", gradient: "from-slate-700 to-slate-800" }
];

const stats = [
  { value: "500+", labelFr: "Projets livrés", labelEn: "Projects delivered" },
  { value: "7", labelFr: "Pays de présence", labelEn: "Countries" },
  { value: "98%", labelFr: "Satisfaction client", labelEn: "Client satisfaction" },
  { value: "15+", labelFr: "Ans d'expertise", labelEn: "Years of expertise" }
];

const presence = [
  { flag: "🇺🇸", country: "United States", role: "HQ", city: "New York" },
  { flag: "🇨🇦", country: "Canada", city: "Montréal" },
  { flag: "🇫🇷", country: "France", city: "Paris" },
  { flag: "🇧🇪", country: "Belgique", city: "Bruxelles" },
  { flag: "🇹🇬", country: "Togo", city: "Lomé" },
  { flag: "🇨🇮", country: "Côte d'Ivoire", city: "Abidjan" },
  { flag: "🇲🇱", country: "Mali", city: "Bamako" }
];

export default function Home() {
  const { language } = useLanguage();
  const fr = language === "fr";

  return (
    <div className="min-h-screen bg-background">

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center pt-24 overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/40 to-white">
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-100/40 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-100/30 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 pointer-events-none" />
        {/* Subtle dot grid */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.35]"
          style={{ backgroundImage: "radial-gradient(circle, #93c5fd 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="container mx-auto px-6 relative z-10 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold mb-8 tracking-wide"
              >
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                {fr ? "Partenaire technologique international" : "International Technology Partner"}
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.7 }}
                className="text-5xl md:text-6xl xl:text-7xl font-bold leading-[1.06] tracking-tight text-slate-900 mb-8"
              >
                {fr
                  ? <>Nous faisons travailler <span className="text-primary">la technologie</span> pour vous.</>
                  : <>We make <span className="text-primary">technology</span> work for people.</>}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}
                className="text-xl text-slate-500 leading-relaxed mb-12 max-w-xl"
              >
                {fr
                  ? "Solutions technologiques modernes, sécurisées et évolutives — de l'infrastructure physique au digital, pour les entreprises ambitieuses du monde entier."
                  : "Modern, secure, and scalable technology solutions — from physical infrastructure to digital, for ambitious companies worldwide."}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}
                className="flex flex-wrap gap-4"
              >
                <Link href="/contact">
                  <div className="group inline-flex items-center gap-3 px-8 py-4 bg-primary text-white font-semibold rounded-xl hover:bg-blue-700 transition-all duration-300 shadow-lg shadow-primary/25 hover:shadow-primary/40 cursor-pointer">
                    {fr ? "Planifier une consultation" : "Schedule a consultation"}
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
                <Link href="/services">
                  <div className="inline-flex items-center gap-3 px-8 py-4 bg-white text-slate-800 font-semibold rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all duration-300 cursor-pointer shadow-sm">
                    {fr ? "Nos services" : "Our services"}
                  </div>
                </Link>
              </motion.div>
            </div>

            {/* Stats panel */}
            <motion.div
              initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4, duration: 0.8 }}
              className="hidden lg:grid grid-cols-2 gap-4"
            >
              {stats.map((s, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-2xl p-8 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300">
                  <div className="text-4xl font-bold text-slate-900 mb-2">{s.value}</div>
                  <div className="text-sm text-slate-500 font-medium">{fr ? s.labelFr : s.labelEn}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── PAIN-POINT CARDS ────────────────────────────────────── */}
      <section className="py-6 border-y border-slate-200 bg-white">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {painPoints.map((p, i) => (
              <motion.div key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                <Link href={p.href}>
                  <div className={`group h-full bg-white border border-slate-200 rounded-xl p-6 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${p.border}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-lg ${p.accent}`}>
                        <p.icon size={22} />
                      </div>
                      <ArrowUpRight size={16} className="text-slate-300 group-hover:text-primary transition-colors mt-1" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mb-2">{fr ? p.titleFr : p.titleEn}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{fr ? p.descFr : p.descEn}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHO WE ARE ──────────────────────────────────────────── */}
      <section className="py-28 bg-gradient-to-br from-slate-50 to-blue-50/20">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
              <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">
                {fr ? "Qui sommes-nous" : "Who we are"}
              </p>
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 leading-tight mb-8">
                {fr
                  ? <>Ingénieurs. Architectes. <span className="text-primary">Partenaires</span> de confiance.</>
                  : <>Engineers. Architects. <span className="text-primary">Trusted</span> Partners.</>}
              </h2>
              <p className="text-slate-500 text-lg leading-relaxed mb-6">
                {fr
                  ? "Gaméasù Technology délivre des solutions technologiques de bout en bout avec une équipe d'experts certifiés dédiés à votre réussite. Nous collaborons de la stratégie initiale au déploiement, en passant par la formation et le support continu."
                  : "Gaméasù Technology delivers end-to-end technology solutions with a team of certified experts dedicated to your success. We collaborate from initial strategy through deployment, training, and ongoing support."}
              </p>
              <p className="text-slate-500 text-lg leading-relaxed mb-10">
                {fr
                  ? "Fondée sur l'ambition d'une Afrique connectée et ancrée dans les standards mondiaux, notre entreprise incarne l'innovation internationale au service des marchés émergents."
                  : "Built on the ambition of a connected Africa and anchored in global standards, our company embodies international innovation in service of emerging markets."}
              </p>
              <div className="flex flex-wrap gap-5 mb-10">
                {["Excellence", "Intégrité", "Innovation", "Partenariat"].map((v, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <CheckCircle size={16} className="text-primary" />
                    {v}
                  </div>
                ))}
              </div>
              <Link href="/about">
                <div className="group inline-flex items-center gap-2 text-primary font-semibold hover:gap-3 transition-all cursor-pointer">
                  {fr ? "En savoir plus sur nous" : "Learn more about us"}
                  <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
              <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <p className="text-sm font-bold text-slate-900 uppercase tracking-widest">
                    {fr ? "Présence mondiale" : "Global presence"}
                  </p>
                  <span className="text-xs text-primary font-semibold bg-primary/10 px-3 py-1 rounded-full">7 {fr ? "pays" : "countries"}</span>
                </div>
                <div className="space-y-2">
                  {presence.map((p, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }} transition={{ delay: i * 0.07, duration: 0.4 }}
                      className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-2xl flex-shrink-0">{p.flag}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 text-sm">{p.country}</div>
                        <div className="text-xs text-slate-500">{p.city}</div>
                      </div>
                      {p.role && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold flex-shrink-0">{p.role}</span>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── WHAT WE DO ──────────────────────────────────────────── */}
      <section className="py-28 bg-white border-y border-slate-100">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">
              {fr ? "Ce que nous faisons" : "What we do"}
            </p>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              {fr ? "Des solutions de bout en bout" : "End-to-end technology solutions"}
            </h2>
            <p className="text-slate-500 text-lg">
              {fr
                ? "De l'infrastructure à l'intelligence artificielle, nous couvrons l'intégralité de votre écosystème technologique."
                : "From infrastructure to artificial intelligence, we cover your entire technology ecosystem."}
            </p>
          </div>

          <div className="space-y-3">
            {whatWeDo.map((item, i) => (
              <motion.div key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                <Link href={item.href}>
                  <div className="group flex items-start gap-6 p-6 md:p-8 bg-white border border-slate-200 rounded-xl hover:border-primary/40 hover:shadow-md transition-all duration-300 cursor-pointer">
                    <div className="flex-shrink-0 p-4 rounded-xl bg-primary/8 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300 shadow-sm">
                      <item.icon size={26} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <h3 className="text-xl font-bold text-slate-900">{fr ? item.titleFr : item.titleEn}</h3>
                        <ArrowUpRight size={18} className="text-slate-300 group-hover:text-primary flex-shrink-0 transition-colors" />
                      </div>
                      <p className="text-slate-500 leading-relaxed">{fr ? item.descFr : item.descEn}</p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link href="/services">
              <div className="inline-flex items-center gap-2 text-primary font-semibold hover:underline cursor-pointer">
                {fr ? "Voir tous nos services" : "View all our services"}
                <ChevronRight size={16} />
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ── INDUSTRIES ──────────────────────────────────────────── */}
      <section className="py-28 bg-gradient-to-br from-slate-50 to-blue-50/20">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 items-start">
            <div className="lg:sticky lg:top-32">
              <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">
                {fr ? "Où nous excellons" : "Where we thrive"}
              </p>
              <h2 className="text-4xl font-bold text-slate-900 mb-6">
                {fr ? "Des solutions sur-mesure pour chaque secteur" : "Custom solutions for every industry"}
              </h2>
              <p className="text-slate-500 leading-relaxed mb-8">
                {fr
                  ? "Grâce à notre expérience transversale, nous déployons des solutions créatives et adaptées aux spécificités de chaque secteur."
                  : "Leveraging our cross-industry experience, we deploy creative solutions adapted to each sector's specifics."}
              </p>
              <Link href="/industries">
                <div className="group inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors cursor-pointer shadow-md shadow-primary/20">
                  {fr ? "Tous les secteurs" : "All industries"}
                  <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </div>

            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {industries.map((ind, i) => (
                <motion.div key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                  <Link href="/industries">
                    <div className="group flex items-center gap-4 p-5 bg-white border border-slate-200 rounded-xl hover:border-primary/40 hover:shadow-md cursor-pointer transition-all duration-300">
                      <div className="p-3 rounded-lg bg-primary/8 text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300 flex-shrink-0">
                        <ind.icon size={20} />
                      </div>
                      <div className="font-semibold text-slate-800 text-sm">{fr ? ind.labelFr : ind.labelEn}</div>
                      <ChevronRight size={15} className="text-slate-300 group-hover:text-primary ml-auto transition-colors" />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── RESOURCES ───────────────────────────────────────────── */}
      <section className="py-28 bg-white border-t border-slate-100">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">
              {fr ? "Ressources" : "Resources"}
            </p>
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              {fr ? "Expertise et réalisations" : "Expertise & achievements"}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {resources.map((r, i) => (
              <motion.div key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                <Link href={r.href}>
                  <div className={`group relative h-full bg-gradient-to-br ${r.gradient} rounded-2xl p-8 overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}>
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                      <TrendingUp size={80} />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4 relative z-10">{fr ? r.labelFr : r.labelEn}</h3>
                    <p className="text-white/75 leading-relaxed mb-8 relative z-10 text-sm">{fr ? r.descFr : r.descEn}</p>
                    <div className="inline-flex items-center gap-2 text-white font-semibold text-sm border-b border-white/40 pb-0.5 group-hover:border-white transition-colors relative z-10">
                      {fr ? r.ctaFr : r.ctaEn}
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <CTASection
        title={fr ? "Prêt à démarrer ?" : "Ready to get started?"}
        subtitle={fr
          ? "Discutons de la façon dont Gaméasù Technology peut transformer votre organisation avec les bonnes solutions technologiques."
          : "Let's discuss how Gaméasù Technology can transform your organization with the right technology solutions."}
        btnText={fr ? "Démarrer une conversation" : "Start a conversation"}
        href="/contact"
      />
    </div>
  );
}
