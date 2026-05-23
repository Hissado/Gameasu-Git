import React from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { Link } from "wouter";
import {
  ArrowRight, ArrowUpRight, Shield, Cloud, Brain, Monitor, Zap,
  Users, Globe, TrendingUp, CheckCircle, ChevronRight,
  Building2, Landmark, GraduationCap, HeartPulse, Banknote, Factory
} from "lucide-react";
import { CTASection } from "@/components/CTASection";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.6 } })
};

const painPoints = [
  {
    icon: Shield,
    titleFr: "Menaces de sécurité ?",
    titleEn: "Security threats?",
    descFr: "Protégez votre organisation avec une cybersécurité avancée et une surveillance 24/7.",
    descEn: "Protect your organization with advanced cybersecurity and 24/7 monitoring.",
    href: "/cybersecurity",
    color: "from-blue-900/30 to-blue-800/10"
  },
  {
    icon: Globe,
    titleFr: "Travail hybride difficile ?",
    titleEn: "Struggling with hybrid work?",
    descFr: "Activez une collaboration fluide avec des solutions de travail moderne.",
    descEn: "Enable seamless collaboration with modern workplace solutions.",
    href: "/services",
    color: "from-indigo-900/30 to-indigo-800/10"
  },
  {
    icon: Zap,
    titleFr: "Prêt à vous transformer ?",
    titleEn: "Ready to transform?",
    descFr: "Modernisez l'ensemble de votre écosystème technologique de bout en bout.",
    descEn: "Modernize your entire technology ecosystem end-to-end.",
    href: "/ai-automation",
    color: "from-violet-900/30 to-violet-800/10"
  },
  {
    icon: Brain,
    titleFr: "Par où commencer ?",
    titleEn: "Not sure where to start?",
    descFr: "Obtenez une consultation gratuite pour identifier vos priorités critiques.",
    descEn: "Get a free consultation to identify your critical priorities.",
    href: "/contact",
    color: "from-cyan-900/30 to-cyan-800/10"
  }
];

const whatWeDo = [
  {
    icon: Monitor,
    titleFr: "Modern Workplace",
    titleEn: "Modern Workplace",
    descFr: "Des plateformes de communication unifiée, des outils de collaboration et des intégrations fluides qui transforment la façon dont les organisations travaillent.",
    descEn: "Unified communication platforms, collaboration tools, and seamless integrations that transform how organizations work across locations.",
    href: "/services"
  },
  {
    icon: Cloud,
    titleFr: "Infrastructure & Cloud",
    titleEn: "Infrastructure & Cloud",
    descFr: "Réseau haute performance, infrastructure cloud hybride et supervision intelligente pour une connectivité résiliente et des performances optimisées.",
    descEn: "High-performance networking, hybrid cloud infrastructure, and intelligent monitoring to ensure resilient connectivity and optimized performance.",
    href: "/cloud-infrastructure"
  },
  {
    icon: Shield,
    titleFr: "Cybersécurité & Sécurité Physique",
    titleEn: "Cyber & Physical Security",
    descFr: "Protection intégrée unissant cybersécurité avancée et sécurité physique : contrôle d'accès, vidéosurveillance et surveillance des menaces.",
    descEn: "Integrated protection uniting advanced cybersecurity with physical security, access control, surveillance, and threat monitoring.",
    href: "/cybersecurity"
  },
  {
    icon: Zap,
    titleFr: "Transformation Digitale",
    titleEn: "Digital Transformation",
    descFr: "Nous guidons les organisations à travers une transformation de bout en bout : plateformes agiles, migration cloud, automatisation des processus.",
    descEn: "We guide organizations through end-to-end transformation with agile platforms, cloud migration, process automation, and change management.",
    href: "/services"
  },
  {
    icon: Brain,
    titleFr: "Intelligence Artificielle",
    titleEn: "AI for Business",
    descFr: "Des plateformes alimentées par l'IA offrant analytique prédictive, automatisation intelligente et expériences personnalisées.",
    descEn: "AI-powered platforms delivering predictive analytics, automation, and personalized experiences that drive smarter operations.",
    href: "/ai-automation"
  }
];

const industries = [
  { icon: Building2, labelFr: "Grandes Entreprises", labelEn: "Global Enterprise" },
  { icon: Banknote, labelFr: "Finance & Banque", labelEn: "Banking + Finance" },
  { icon: HeartPulse, labelFr: "Santé", labelEn: "Healthcare" },
  { icon: GraduationCap, labelFr: "Éducation", labelEn: "Education" },
  { icon: Landmark, labelFr: "Institutions Publiques", labelEn: "Government" },
  { icon: Factory, labelFr: "Commerce & Industrie", labelEn: "Retail & Industry" }
];

const resources = [
  {
    labelFr: "Nos Réalisations",
    labelEn: "Our Work",
    descFr: "Partenaire de confiance livrant des solutions qui améliorent l'efficacité et l'expérience.",
    descEn: "Partnering with customers as a trusted adviser to deliver solutions that enhance efficiency.",
    href: "/case-studies",
    ctaFr: "Voir nos projets",
    ctaEn: "See our work",
    gradient: "from-blue-900 to-blue-800"
  },
  {
    labelFr: "Ressources & Blog",
    labelEn: "Our Blog",
    descFr: "Apprenez-en plus directement de nos experts sur les tendances technologiques majeures.",
    descEn: "Hear directly from our experts about leading trends in technology and innovation.",
    href: "/blog",
    ctaFr: "Lire le blog",
    ctaEn: "Go to the blog",
    gradient: "from-indigo-900 to-indigo-800"
  },
  {
    labelFr: "Partenaires Technologiques",
    labelEn: "Our Partners",
    descFr: "Des partenariats stratégiques avec les leaders technologiques mondiaux pour des solutions de pointe.",
    descEn: "Strategic partnerships with global technology leaders to deliver best-in-class solutions.",
    href: "/partners",
    ctaFr: "Découvrir nos partenaires",
    ctaEn: "Meet our partners",
    gradient: "from-violet-900 to-violet-800"
  }
];

const stats = [
  { value: "500+", labelFr: "Projets livrés", labelEn: "Projects delivered" },
  { value: "7", labelFr: "Pays de présence", labelEn: "Countries" },
  { value: "98%", labelFr: "Taux de satisfaction", labelEn: "Client satisfaction" },
  { value: "15+", labelFr: "Ans d'expérience", labelEn: "Years of expertise" }
];

const presence = [
  { flag: "🇺🇸", country: "United States", role: "Siège Social / HQ", city: "New York" },
  { flag: "🇨🇦", country: "Canada", role: "Bureau Régional", city: "Montréal" },
  { flag: "🇫🇷", country: "France", role: "Bureau Régional", city: "Paris" },
  { flag: "🇧🇪", country: "Belgique", role: "Bureau Régional", city: "Bruxelles" },
  { flag: "🇹🇬", country: "Togo", role: "Bureau Afrique", city: "Lomé" },
  { flag: "🇨🇮", country: "Côte d'Ivoire", role: "Bureau Afrique", city: "Abidjan" },
  { flag: "🇲🇱", country: "Mali", role: "Bureau Afrique", city: "Bamako" }
];

export default function Home() {
  const { language } = useLanguage();
  const fr = language === "fr";

  return (
    <div className="min-h-screen">

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center pt-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_60%_-10%,rgba(30,64,200,0.25)_0%,transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_10%_80%,rgba(30,64,200,0.12)_0%,transparent_60%)] pointer-events-none" />
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "50px 50px" }} />

        <div className="container mx-auto px-6 relative z-10 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold mb-8 tracking-wide uppercase"
              >
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                {fr ? "Partenaire technologique international" : "International Technology Partner"}
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.7 }}
                className="text-5xl md:text-6xl xl:text-7xl font-bold leading-[1.05] tracking-tight text-white mb-8"
              >
                {fr ? <>Nous faisons travailler <span className="text-primary">la technologie</span> pour vous.</> : <>We make <span className="text-primary">technology</span> work for people.</>}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}
                className="text-xl text-muted-foreground leading-relaxed mb-12 max-w-xl"
              >
                {fr
                  ? "Nous délivrons des expériences immersives en modernisant votre infrastructure, en optimisant vos opérations et en anticipant la compétition. De l'infrastructure physique au digital, Gaméasù est votre partenaire de confiance."
                  : "We deliver immersive experiences by modernizing your foundation, streamlining operations, and staying ahead of the competition. From physical to digital, Gaméasù is your trusted partner."}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}
                className="flex flex-wrap gap-4"
              >
                <Link href="/contact">
                  <div className="group inline-flex items-center gap-3 px-8 py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-all duration-300 shadow-[0_0_40px_-8px_rgba(30,64,200,0.8)] hover:shadow-[0_0_50px_-6px_rgba(30,64,200,0.9)] cursor-pointer">
                    {fr ? "Planifier une consultation" : "Schedule a consultation"}
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
                <Link href="/services">
                  <div className="inline-flex items-center gap-3 px-8 py-4 bg-white/5 text-white font-semibold rounded-xl border border-white/10 hover:bg-white/10 transition-all duration-300 cursor-pointer backdrop-blur-sm">
                    {fr ? "Découvrir nos services" : "Discover our services"}
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
                <div key={i} className="bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-8 flex flex-col justify-between hover:bg-white/8 hover:border-primary/30 transition-all duration-300">
                  <div className="text-4xl font-bold text-white mb-2">{s.value}</div>
                  <div className="text-sm text-muted-foreground font-medium">{fr ? s.labelFr : s.labelEn}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── PAIN-POINT CARDS ────────────────────────────────────── */}
      <section className="py-6 border-y border-border bg-card/50">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {painPoints.map((p, i) => (
              <motion.div key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                <Link href={p.href}>
                  <div className={`group relative h-full bg-gradient-to-br ${p.color} border border-border rounded-xl p-6 hover:border-primary/50 cursor-pointer transition-all duration-300 hover:-translate-y-1`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                        <p.icon size={22} />
                      </div>
                      <ArrowUpRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{fr ? p.titleFr : p.titleEn}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{fr ? p.descFr : p.descEn}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHO WE ARE ──────────────────────────────────────────── */}
      <section className="py-28 relative overflow-hidden">
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1/2 h-full bg-[radial-gradient(ellipse_at_right,rgba(30,64,200,0.08)_0%,transparent_70%)] pointer-events-none" />
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
              <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">
                {fr ? "Qui sommes-nous" : "Who we are"}
              </p>
              <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-8">
                {fr
                  ? <>Ingénieurs. Architectes. <span className="text-primary">Partenaires</span> de confiance.</>
                  : <>Engineers. Architects. <span className="text-primary">Trusted</span> Partners.</>}
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                {fr
                  ? "Gaméasù Technology délivre des solutions technologiques de bout en bout avec une équipe d'experts certifiés dédiés à votre réussite. Nous collaborons de la stratégie initiale au déploiement, en passant par la formation et le support continu."
                  : "Gaméasù Technology delivers end-to-end technology solutions with a team of certified experts dedicated to your success. We collaborate from initial strategy through deployment, training, and ongoing support."}
              </p>
              <p className="text-muted-foreground text-lg leading-relaxed mb-10">
                {fr
                  ? "Fondée sur l'héritage technologique africain et ancrée dans les standards mondiaux, notre entreprise incarne l'ambition d'une Afrique connectée, innovante et compétitive à l'échelle internationale."
                  : "Built on African technological heritage and anchored in global standards, our company embodies the ambition of a connected, innovative Africa, competitive on the international stage."}
              </p>
              <div className="flex flex-wrap gap-6 mb-10">
                {[
                  { valFr: "Excellence", valEn: "Excellence" },
                  { valFr: "Intégrité", valEn: "Integrity" },
                  { valFr: "Innovation", valEn: "Innovation" },
                  { valFr: "Partenariat", valEn: "Partnership" }
                ].map((v, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <CheckCircle size={16} className="text-primary" />
                    {fr ? v.valFr : v.valEn}
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

            {/* Visual: presence map/grid */}
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
              <div className="bg-card border border-border rounded-2xl p-8">
                <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-6">
                  {fr ? "Présence mondiale" : "Global presence"}
                </p>
                <div className="space-y-3">
                  {presence.map((p, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }} transition={{ delay: i * 0.07, duration: 0.4 }}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <span className="text-2xl flex-shrink-0">{p.flag}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white text-sm">{p.country}</div>
                        <div className="text-xs text-muted-foreground">{p.city} — {p.role}</div>
                      </div>
                      {i === 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium flex-shrink-0">HQ</span>
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
      <section className="py-28 bg-card border-y border-border">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">
              {fr ? "Ce que nous faisons" : "What we do"}
            </p>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              {fr ? "Des solutions de bout en bout" : "End-to-end technology solutions"}
            </h2>
            <p className="text-muted-foreground text-lg">
              {fr
                ? "De l'infrastructure à l'intelligence artificielle, nous couvrons l'intégralité de votre écosystème technologique."
                : "From infrastructure to artificial intelligence, we cover your entire technology ecosystem."}
            </p>
          </div>

          <div className="space-y-4">
            {whatWeDo.map((item, i) => (
              <motion.div key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                <Link href={item.href}>
                  <div className="group flex items-start gap-6 p-6 md:p-8 bg-background border border-border rounded-xl hover:border-primary/40 hover:bg-primary/3 transition-all duration-300 cursor-pointer">
                    <div className="flex-shrink-0 p-4 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                      <item.icon size={28} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <h3 className="text-xl font-bold text-white">{fr ? item.titleFr : item.titleEn}</h3>
                        <ArrowUpRight size={18} className="text-muted-foreground group-hover:text-primary flex-shrink-0 transition-colors" />
                      </div>
                      <p className="text-muted-foreground leading-relaxed">{fr ? item.descFr : item.descEn}</p>
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
      <section className="py-28 relative">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 items-start">
            <div className="lg:sticky lg:top-32">
              <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">
                {fr ? "Où nous excellons" : "Where we thrive"}
              </p>
              <h2 className="text-4xl font-bold text-white mb-6">
                {fr
                  ? "Des solutions sur-mesure pour chaque secteur"
                  : "Custom solutions built for your industry"}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-8">
                {fr
                  ? "Grâce à notre expérience transversale, nous déployons des solutions créatives et adaptées aux spécificités de chaque secteur d'activité."
                  : "Leveraging our extensive cross-industry knowledge, we deploy creative, custom solutions designed for your specific sector."}
              </p>
              <Link href="/industries">
                <div className="group inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors cursor-pointer">
                  {fr ? "Voir tous les secteurs" : "View all industries"}
                  <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </div>

            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {industries.map((ind, i) => (
                <motion.div key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                  <Link href="/industries">
                    <div className="group flex items-center gap-4 p-6 bg-card border border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all duration-300">
                      <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300 flex-shrink-0">
                        <ind.icon size={22} />
                      </div>
                      <div>
                        <div className="font-semibold text-white">{fr ? ind.labelFr : ind.labelEn}</div>
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary ml-auto transition-colors" />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── RESOURCES ───────────────────────────────────────────── */}
      <section className="py-28 bg-card border-t border-border">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">
              {fr ? "Ressources" : "Resources"}
            </p>
            <h2 className="text-4xl font-bold text-white mb-4">
              {fr ? "Expertise et réalisations" : "Expertise & achievements"}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {resources.map((r, i) => (
              <motion.div key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                <Link href={r.href}>
                  <div className={`group relative h-full bg-gradient-to-br ${r.gradient} rounded-2xl p-8 overflow-hidden cursor-pointer border border-white/10 hover:border-primary/40 transition-all duration-300 hover:-translate-y-1`}>
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                      <TrendingUp size={80} />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4 relative z-10">{fr ? r.labelFr : r.labelEn}</h3>
                    <p className="text-white/70 leading-relaxed mb-8 relative z-10">{fr ? r.descFr : r.descEn}</p>
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

      {/* ── CTA ─────────────────────────────────────────────────── */}
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
