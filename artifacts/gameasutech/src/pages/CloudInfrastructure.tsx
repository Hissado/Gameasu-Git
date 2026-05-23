import React from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { CTASection } from "@/components/CTASection";
import { Cloud, Network, Server, Globe, Activity, Lock, ArrowRight, CheckCircle } from "lucide-react";
import { Link } from "wouter";

const services = [
  {
    icon: Cloud,
    titleFr: "Migration Cloud",
    titleEn: "Cloud Migration",
    descFr: "Migration sécurisée vers AWS, Azure ou GCP. Évaluation, planification, exécution par vagues et optimisation post-migration.",
    descEn: "Secure migration to AWS, Azure, or GCP. Assessment, planning, phased execution, and post-migration optimization."
  },
  {
    icon: Network,
    titleFr: "Réseau & SD-WAN",
    titleEn: "Network & SD-WAN",
    descFr: "Architecture réseau haute performance, SD-WAN pour les sites distribués, MPLS, connectivité LTE de backup et QoS.",
    descEn: "High-performance network architecture, SD-WAN for distributed sites, MPLS, LTE backup connectivity, and QoS."
  },
  {
    icon: Server,
    titleFr: "Infrastructure Hybride",
    titleEn: "Hybrid Infrastructure",
    descFr: "Conception et opération d'environnements hybrides on-premise / cloud : virtualisation, HCI, containers, Kubernetes.",
    descEn: "Design and operation of hybrid on-premise / cloud environments: virtualization, HCI, containers, Kubernetes."
  },
  {
    icon: Activity,
    titleFr: "Supervision & FinOps",
    titleEn: "Monitoring & FinOps",
    descFr: "Supervision proactive de l'infrastructure, alerting, capacity planning et optimisation des coûts cloud (FinOps).",
    descEn: "Proactive infrastructure monitoring, alerting, capacity planning, and cloud cost optimization (FinOps)."
  },
  {
    icon: Lock,
    titleFr: "Backup & PCA",
    titleEn: "Backup & BCP",
    descFr: "Stratégies de sauvegarde 3-2-1, plan de continuité d'activité (PCA), PRA et tests de restauration réguliers.",
    descEn: "3-2-1 backup strategies, business continuity planning (BCP), disaster recovery, and regular restoration tests."
  },
  {
    icon: Globe,
    titleFr: "Connectivité Internationale",
    titleEn: "International Connectivity",
    descFr: "Liens Internet, connectivité inter-sites, points de présence en Afrique et en Europe pour vos opérations multi-continents.",
    descEn: "Internet links, inter-site connectivity, points of presence in Africa and Europe for your multi-continent operations."
  }
];

const cloudProviders = ["Amazon Web Services", "Microsoft Azure", "Google Cloud Platform", "OVHcloud", "Scaleway", "Orange Cloud", "Huawei Cloud"];

const deploymentModels = [
  { titleFr: "Cloud Public", titleEn: "Public Cloud", descFr: "Scalabilité maximale, paiement à l'usage, idéal pour les workloads variables.", descEn: "Maximum scalability, pay-as-you-go, ideal for variable workloads." },
  { titleFr: "Cloud Privé", titleEn: "Private Cloud", descFr: "Contrôle total, conformité renforcée, pour les données sensibles et réglementées.", descEn: "Full control, enhanced compliance, for sensitive and regulated data." },
  { titleFr: "Cloud Hybride", titleEn: "Hybrid Cloud", descFr: "Le meilleur des deux mondes : flexibilité cloud + contrôle on-premise, interconnectés.", descEn: "The best of both worlds: cloud flexibility + on-premise control, interconnected." },
  { titleFr: "Multi-Cloud", titleEn: "Multi-Cloud", descFr: "Résilience maximale en combinant plusieurs fournisseurs cloud selon les besoins.", descEn: "Maximum resilience by combining multiple cloud providers based on needs." }
];

export default function CloudInfrastructure() {
  const { language } = useLanguage();
  const fr = language === "fr";

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-20%,rgba(30,64,200,0.2)_0%,transparent_70%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_80%_50%,rgba(30,120,200,0.1)_0%,transparent_70%)] pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-semibold mb-6 uppercase tracking-wide">
              <Cloud size={14} />
              {fr ? "Cloud & Infrastructure" : "Cloud & Infrastructure"}
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6 max-w-4xl">
              {fr
                ? "Une infrastructure solide, résiliente et prête pour la croissance"
                : "Solid, resilient infrastructure ready for growth"}
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mb-10">
              {fr
                ? "Du réseau au cloud, en passant par la virtualisation et la supervision, nous construisons des fondations technologiques robustes sur lesquelles votre organisation peut compter — aujourd'hui et demain."
                : "From network to cloud, through virtualization and monitoring, we build robust technology foundations your organization can rely on — today and tomorrow."}
            </p>
            <Link href="/contact">
              <div className="group inline-flex items-center gap-3 px-8 py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-all cursor-pointer shadow-[0_0_30px_-5px_rgba(30,64,200,0.6)]">
                {fr ? "Évaluer votre infrastructure" : "Assess your infrastructure"}
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Services */}
      <section className="py-28">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Nos expertises" : "Our expertise"}</p>
            <h2 className="text-4xl font-bold text-white mb-4">{fr ? "De l'infrastructure au cloud managé" : "From infrastructure to managed cloud"}</h2>
            <p className="text-muted-foreground text-lg">{fr ? "Une couverture complète de votre stack infrastructure, du câblage physique au cloud native." : "Complete coverage of your infrastructure stack, from physical cabling to cloud native."}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                <div className="group h-full bg-card border border-border rounded-xl p-8 hover:border-primary/40 hover:bg-primary/3 transition-all duration-300">
                  <div className="p-3 rounded-lg bg-primary/10 text-primary inline-flex mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
                    <s.icon size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3">{fr ? s.titleFr : s.titleEn}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{fr ? s.descFr : s.descEn}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Deployment Models */}
      <section className="py-28 bg-card border-y border-border">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Modèles de déploiement" : "Deployment models"}</p>
            <h2 className="text-4xl font-bold text-white mb-4">{fr ? "Cloud Smart, pas Cloud First" : "Cloud Smart, not Cloud First"}</h2>
            <p className="text-muted-foreground text-lg">{fr ? "Nous choisissons le bon modèle pour chaque workload, pas le même modèle pour tout." : "We choose the right model for each workload, not the same model for everything."}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {deploymentModels.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <div className="h-full bg-background border border-border rounded-xl p-8 hover:border-primary/40 transition-colors">
                  <h3 className="text-xl font-bold text-white mb-3">{fr ? m.titleFr : m.titleEn}</h3>
                  <p className="text-muted-foreground leading-relaxed">{fr ? m.descFr : m.descEn}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Partners */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-white mb-2">{fr ? "Fournisseurs cloud certifiés" : "Certified cloud providers"}</h2>
            <p className="text-muted-foreground">{fr ? "Nous sommes partenaires certifiés des principaux fournisseurs cloud mondiaux." : "We are certified partners of the major global cloud providers."}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {cloudProviders.map((p, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}>
                <div className="px-5 py-2.5 bg-card border border-border rounded-xl text-sm font-medium text-foreground hover:border-primary/40 transition-colors">
                  {p}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Gameasutech */}
      <section className="py-20 bg-card border-t border-border">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Notre différence" : "Our difference"}</p>
              <h2 className="text-4xl font-bold text-white mb-6">{fr ? "L'expertise africaine dans les standards mondiaux" : "African expertise within global standards"}</h2>
              <p className="text-muted-foreground leading-relaxed text-lg">
                {fr
                  ? "Notre connaissance approfondie des contraintes locales (connectivité, énergie, réglementation) combinée à notre maîtrise des standards cloud mondiaux nous permet de concevoir des architectures robustes et adaptées aux réalités africaines."
                  : "Our deep knowledge of local constraints (connectivity, power, regulation) combined with our mastery of global cloud standards allows us to design robust architectures adapted to African realities."}
              </p>
            </div>
            <div className="space-y-4">
              {[
                { fr: "Architectures conçues pour les contraintes de connectivité africaines", en: "Architectures designed for African connectivity constraints" },
                { fr: "Expertise backup LTE pour les environnements à connectivité instable", en: "LTE backup expertise for unstable connectivity environments" },
                { fr: "Conformité aux réglementations locales de protection des données", en: "Compliance with local data protection regulations" },
                { fr: "Équipes locales au Togo, Côte d'Ivoire et Mali", en: "Local teams in Togo, Côte d'Ivoire, and Mali" },
                { fr: "Support en français, anglais et langues locales", en: "Support in French, English, and local languages" }
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-4 bg-background border border-border rounded-xl">
                  <CheckCircle size={18} className="text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground text-sm">{fr ? item.fr : item.en}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <CTASection
        title={fr ? "Évaluez votre infrastructure" : "Assess your infrastructure"}
        subtitle={fr ? "Obtenez un audit gratuit de votre infrastructure actuelle et une roadmap de modernisation adaptée à vos contraintes." : "Get a free audit of your current infrastructure and a modernization roadmap adapted to your constraints."}
        btnText={fr ? "Demander un audit" : "Request an audit"}
        href="/contact"
      />
    </div>
  );
}
