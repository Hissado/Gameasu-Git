import React from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { CTASection } from "@/components/CTASection";
import { Cloud, Network, Server, Globe, Activity, Lock, ArrowRight, CheckCircle } from "lucide-react";
import { Link } from "wouter";

const services = [
  { icon: Cloud, titleFr: "Migration Cloud", titleEn: "Cloud Migration", descFr: "Migration sécurisée vers AWS, Azure ou GCP. Évaluation, planification, exécution par vagues et optimisation post-migration.", descEn: "Secure migration to AWS, Azure, or GCP. Assessment, planning, phased execution, and post-migration optimization." },
  { icon: Network, titleFr: "Réseau & SD-WAN", titleEn: "Network & SD-WAN", descFr: "Architecture réseau haute performance, SD-WAN pour les sites distribués, MPLS, connectivité LTE de backup et QoS.", descEn: "High-performance network architecture, SD-WAN for distributed sites, MPLS, LTE backup connectivity, and QoS." },
  { icon: Server, titleFr: "Infrastructure Hybride", titleEn: "Hybrid Infrastructure", descFr: "Conception et opération d'environnements hybrides on-premise / cloud : virtualisation, HCI, containers, Kubernetes.", descEn: "Design and operation of hybrid on-premise / cloud environments: virtualization, HCI, containers, Kubernetes." },
  { icon: Activity, titleFr: "Supervision & FinOps", titleEn: "Monitoring & FinOps", descFr: "Supervision proactive de l'infrastructure, alerting, capacity planning et optimisation des coûts cloud (FinOps).", descEn: "Proactive infrastructure monitoring, alerting, capacity planning, and cloud cost optimization (FinOps)." },
  { icon: Lock, titleFr: "Backup & PCA", titleEn: "Backup & BCP", descFr: "Stratégies de sauvegarde 3-2-1, plan de continuité d'activité (PCA), PRA et tests de restauration réguliers.", descEn: "3-2-1 backup strategies, business continuity planning (BCP), disaster recovery, and regular restoration tests." },
  { icon: Globe, titleFr: "Connectivité Internationale", titleEn: "International Connectivity", descFr: "Liens Internet, connectivité inter-sites avec points de présence en Afrique et en Europe.", descEn: "Internet links, inter-site connectivity, points of presence in Africa and Europe for multi-continent operations." }
];

const deploymentModels = [
  { titleFr: "Cloud Public", titleEn: "Public Cloud", descFr: "Scalabilité maximale, paiement à l'usage, idéal pour les workloads variables.", descEn: "Maximum scalability, pay-as-you-go, ideal for variable workloads." },
  { titleFr: "Cloud Privé", titleEn: "Private Cloud", descFr: "Contrôle total, conformité renforcée, pour les données sensibles et réglementées.", descEn: "Full control, enhanced compliance, for sensitive and regulated data." },
  { titleFr: "Cloud Hybride", titleEn: "Hybrid Cloud", descFr: "Le meilleur des deux mondes : flexibilité cloud + contrôle on-premise, interconnectés.", descEn: "The best of both worlds: cloud flexibility + on-premise control, interconnected." },
  { titleFr: "Multi-Cloud", titleEn: "Multi-Cloud", descFr: "Résilience maximale en combinant plusieurs fournisseurs cloud selon les besoins.", descEn: "Maximum resilience by combining multiple cloud providers based on needs." }
];

const cloudProviders = ["Amazon Web Services", "Microsoft Azure", "Google Cloud Platform", "OVHcloud", "Scaleway", "Orange Cloud", "Huawei Cloud"];

export default function CloudInfrastructure() {
  const { language } = useLanguage();
  const fr = language === "fr";

  return (
    <div className="min-h-screen bg-background">
      <section className="relative pt-24 pb-12 bg-gradient-to-br from-slate-50 via-cyan-50/20 to-white overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-100/30 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3 pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-100 border border-cyan-200 text-cyan-700 text-sm font-semibold mb-6 uppercase tracking-wide">
                <Cloud size={14} />
                {fr ? "Cloud & Infrastructure" : "Cloud & Infrastructure"}
              </div>
              <h1 className="text-5xl md:text-6xl font-bold text-slate-900 leading-tight mb-6">
                {fr ? "Une infrastructure solide, résiliente et prête pour la croissance" : "Solid, resilient infrastructure ready for growth"}
              </h1>
              <p className="text-xl text-slate-500 mb-10">
                {fr ? "Du réseau au cloud, en passant par la virtualisation et la supervision, nous construisons des fondations technologiques robustes sur lesquelles votre organisation peut compter." : "From network to cloud, through virtualization and monitoring, we build robust technology foundations your organization can rely on."}
              </p>
              <Link href="/contact">
                <div className="group inline-flex items-center gap-3 px-8 py-4 bg-primary text-white font-semibold rounded-xl hover:bg-blue-700 transition-all cursor-pointer shadow-lg shadow-primary/25">
                  {fr ? "Évaluer votre infrastructure" : "Assess your infrastructure"}
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.7 }} className="hidden lg:block">
              <div className="relative rounded-2xl overflow-hidden h-80 bg-slate-800 shadow-2xl">
                <img
                  src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=900&q=80&auto=format&fit=crop"
                  alt="Infrastructure cloud et data center"
                  className="w-full h-full object-cover opacity-85"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-cyan-900/50 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5">
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3">
                    <Cloud size={16} className="text-cyan-300 flex-shrink-0" />
                    <span className="text-white text-sm font-medium">{fr ? "AWS · Azure · GCP · Multi-cloud" : "AWS · Azure · GCP · Multi-cloud"}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Nos expertises" : "Our expertise"}</p>
            <h2 className="text-4xl font-bold text-slate-900 mb-4">{fr ? "De l'infrastructure au cloud managé" : "From infrastructure to managed cloud"}</h2>
            <p className="text-slate-500 text-lg">{fr ? "Une couverture complète de votre stack infrastructure, du câblage physique au cloud native." : "Complete coverage of your infrastructure stack, from physical cabling to cloud native."}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                <div className="group h-full bg-white border border-slate-200 rounded-xl p-8 hover:border-primary/40 hover:shadow-md transition-all duration-300">
                  <div className="p-3 rounded-lg bg-primary/8 text-primary inline-flex mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
                    <s.icon size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3">{fr ? s.titleFr : s.titleEn}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{fr ? s.descFr : s.descEn}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-slate-50 to-cyan-50/10 border-y border-slate-100">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Modèles de déploiement" : "Deployment models"}</p>
            <h2 className="text-4xl font-bold text-slate-900 mb-4">{fr ? "Cloud Smart, pas Cloud First" : "Cloud Smart, not Cloud First"}</h2>
            <p className="text-slate-500 text-lg">{fr ? "Nous choisissons le bon modèle pour chaque workload, pas le même modèle pour tout." : "We choose the right model for each workload, not the same model for everything."}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {deploymentModels.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <div className="h-full bg-white border border-slate-200 rounded-xl p-8 hover:border-primary/40 transition-colors shadow-sm">
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{fr ? m.titleFr : m.titleEn}</h3>
                  <p className="text-slate-500 leading-relaxed">{fr ? m.descFr : m.descEn}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-white border-b border-slate-100">
        <div className="container mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{fr ? "Fournisseurs cloud certifiés" : "Certified cloud providers"}</h2>
            <p className="text-slate-500">{fr ? "Nous sommes partenaires certifiés des principaux fournisseurs cloud mondiaux." : "We are certified partners of the major global cloud providers."}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {cloudProviders.map((p, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}>
                <div className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:border-primary/40 hover:text-primary transition-colors shadow-sm">
                  {p}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Notre différence" : "Our difference"}</p>
              <h2 className="text-4xl font-bold text-slate-900 mb-6">{fr ? "L'expertise africaine dans les standards mondiaux" : "African expertise within global standards"}</h2>
              <p className="text-slate-500 leading-relaxed text-lg">
                {fr ? "Notre connaissance approfondie des contraintes locales combinée à notre maîtrise des standards cloud mondiaux nous permet de concevoir des architectures robustes et adaptées aux réalités africaines." : "Our deep knowledge of local constraints combined with our mastery of global cloud standards allows us to design robust architectures adapted to African realities."}
              </p>
            </div>
            <div className="space-y-3">
              {[
                { fr: "Architectures conçues pour les contraintes de connectivité africaines", en: "Architectures designed for African connectivity constraints" },
                { fr: "Expertise backup LTE pour environnements à connectivité instable", en: "LTE backup expertise for unstable connectivity environments" },
                { fr: "Conformité aux réglementations locales de protection des données", en: "Compliance with local data protection regulations" },
                { fr: "Équipes locales au Togo, Côte d'Ivoire et Mali", en: "Local teams in Togo, Côte d'Ivoire, and Mali" },
                { fr: "Support en français, anglais et langues locales", en: "Support in French, English, and local languages" }
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                  <CheckCircle size={18} className="text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-slate-700 text-sm font-medium">{fr ? item.fr : item.en}</span>
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
