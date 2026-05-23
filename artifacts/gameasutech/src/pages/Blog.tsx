import React, { useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { Calendar, Clock, ChevronDown, ChevronUp, Tag } from "lucide-react";

const articles = [
  {
    id: 1, titleFr: "Zero Trust : comment passer d'un modèle périmétrique à une sécurité sans frontières", titleEn: "Zero Trust: how to move from perimeter to borderless security",
    categoryFr: "Cybersécurité", categoryEn: "Cybersecurity", date: "2024-01-15", readTime: "8 min", featured: true,
    excerptFr: "Le modèle Zero Trust redéfinit la sécurité des entreprises modernes. « Ne jamais faire confiance, toujours vérifier » devient le standard incontournable.",
    excerptEn: "The Zero Trust model redefines security for modern enterprises. 'Never trust, always verify' is becoming the indispensable standard.",
    contentFr: `Le modèle traditionnel de sécurité périmétrique suppose que tout ce qui se trouve à l'intérieur du réseau d'entreprise est digne de confiance. Cette hypothèse est désormais caduque dans un monde où le travail hybride est la norme, où les applications migrent vers le cloud et où les menaces internes représentent jusqu'à 34% des incidents de sécurité.\n\nLe Zero Trust repose sur un principe fondamental : ne jamais accorder de confiance implicite, quelle que soit la localisation de l'utilisateur ou de l'appareil. Chaque accès doit être vérifié, authentifié et autorisé explicitement.\n\nLes trois piliers :\n1. Vérification systématique — MFA pour tous les accès.\n2. Principe du moindre privilège — accès strictement nécessaires.\n3. Microsegmentation — une compromission ne peut pas se propager latéralement.\n\nLes organisations qui ont adopté le Zero Trust rapportent en moyenne 50% moins d'incidents de sécurité critiques et une réduction significative du temps de détection des menaces.`,
    contentEn: `The traditional perimeter security model assumes that everything inside the corporate network is trustworthy. This assumption is now obsolete in a world where hybrid work is the norm, applications migrate to the cloud, and insider threats account for up to 34% of security incidents.\n\nZero Trust is built on a fundamental principle: never grant implicit trust, regardless of the user or device location. Every access must be verified, authenticated, and explicitly authorized.\n\nThree pillars:\n1. Systematic verification — MFA for all access.\n2. Least privilege — strictly necessary access only.\n3. Microsegmentation — a compromise cannot spread laterally.\n\nOrganizations that have adopted Zero Trust report an average of 50% fewer critical security incidents and significant reduction in threat detection time.`
  },
  {
    id: 2, titleFr: "Cloud hybride en Afrique : surmonter les défis de connectivité", titleEn: "Hybrid cloud in Africa: overcoming connectivity challenges",
    categoryFr: "Infrastructure", categoryEn: "Infrastructure", date: "2024-01-08", readTime: "6 min", featured: false,
    excerptFr: "Déployer des architectures cloud hybrides en Afrique nécessite une approche adaptée aux réalités locales. Retours d'expérience terrain.",
    excerptEn: "Deploying hybrid cloud architectures in Africa requires an approach adapted to local realities. Field experience insights.",
    contentFr: `La connectivité Internet reste inégale dans de nombreuses régions d'Afrique de l'Ouest. Les coupures de courant, les variations de bande passante et les latences élevées imposent une conception d'architecture particulière.\n\nStratégies éprouvées :\n• Backup LTE systématique avec basculement automatique en moins de 30 secondes.\n• Edge computing local pour les applications critiques.\n• Régions cloud africaines : AWS Cape Town, Azure Afrique du Sud, Orange Cloud Africa.\n• SD-WAN pour prioriser intelligemment le trafic et agréger plusieurs liens.`,
    contentEn: `Internet connectivity remains uneven in many regions of West Africa. Power outages, bandwidth variations, and high latencies impose particular architecture design requirements.\n\nProven strategies:\n• Systematic LTE backup with automatic failover in less than 30 seconds.\n• Local edge computing for latency-sensitive applications.\n• African cloud regions: AWS Cape Town, Azure South Africa, Orange Cloud Africa.\n• SD-WAN for intelligent traffic prioritization and multi-link aggregation.`
  },
  {
    id: 3, titleFr: "Intelligence artificielle pour les PME africaines : par où commencer ?", titleEn: "AI for African SMEs: where to start?",
    categoryFr: "Intelligence Artificielle", categoryEn: "Artificial Intelligence", date: "2023-12-20", readTime: "7 min", featured: false,
    excerptFr: "L'IA n'est plus réservée aux grands groupes. Voici comment les PME africaines peuvent en bénéficier concrètement, sans budget colossal.",
    excerptEn: "AI is no longer reserved for large corporations. Here's how African SMEs can start benefiting concretely, without a massive budget.",
    contentFr: `Trois cas d'usage accessibles immédiatement :\n\n1. Automatisation du support client — chatbots GPT pour traiter 60–80% des demandes. Coût de démarrage : quelques centaines de dollars/mois.\n\n2. Analytique prédictive des ventes — avec 12 mois de données historiques, réduction des stocks excédentaires de 20–30%.\n\n3. Traitement automatisé des documents — OCR intelligent pour factures et formulaires. ROI en 3 mois.\n\nLa clé : commencer petit, mesurer, itérer. Choisissez un processus, mesurez le ROI sur 3 mois, puis passez au suivant.`,
    contentEn: `Three immediately accessible use cases:\n\n1. Customer support automation — GPT chatbots handling 60–80% of requests. Startup cost: a few hundred dollars/month.\n\n2. Predictive sales analytics — with 12 months of historical data, reduce overstock by 20–30%.\n\n3. Automated document processing — intelligent OCR for invoices and forms. ROI in 3 months.\n\nThe key: start small, measure, iterate. Choose one process, measure ROI over 3 months, then move to the next.`
  },
  {
    id: 4, titleFr: "Microsoft 365 vs Google Workspace : quel choix pour les organisations africaines ?", titleEn: "Microsoft 365 vs Google Workspace: which for African organizations?",
    categoryFr: "Modern Workplace", categoryEn: "Modern Workplace", date: "2023-12-05", readTime: "5 min", featured: false,
    excerptFr: "Le choix dépend de critères souvent sous-estimés : conformité locale, connectivité offline, coût total et intégrations métier.",
    excerptEn: "The choice depends on often underestimated criteria: local compliance, offline connectivity, total cost, and business integrations.",
    contentFr: `Microsoft 365 s'impose pour les organisations utilisant l'écosystème Microsoft (Dynamics, Azure AD), les besoins enterprise, et la conformité souveraine. Teams Phone System remplace avantageusement un PABX.\n\nGoogle Workspace brille par sa simplicité, son prix et la collaboration en temps réel. Idéal pour PME et startups.\n\nFacteur clé en Afrique : M365 supporte le travail offline nativement. Google nécessite une configuration explicite, moins mature pour les environnements à connectivité intermittente.\n\nRecommandation : Grands groupes → M365. PME/ONG → Google Workspace. Les deux peuvent coexister.`,
    contentEn: `Microsoft 365 is right for organizations using the Microsoft ecosystem (Dynamics, Azure AD), enterprise needs, and sovereign compliance. Teams Phone System advantageously replaces a PBX.\n\nGoogle Workspace shines through simplicity, price, and real-time collaboration. Ideal for SMEs and startups.\n\nKey Africa factor: M365 supports offline work natively. Google requires explicit configuration, less mature for intermittent connectivity.\n\nRecommendation: Large groups → M365. SMEs/NGOs → Google Workspace. Both can coexist.`
  },
  {
    id: 5, titleFr: "Transformation digitale : les 5 erreurs les plus coûteuses", titleEn: "Digital transformation: the 5 most costly mistakes",
    categoryFr: "Conseil", categoryEn: "Consulting", date: "2023-11-18", readTime: "9 min", featured: false,
    excerptFr: "Après des dizaines de missions d'accompagnement, nous avons identifié les erreurs récurrentes qui font échouer les projets de transformation digitale.",
    excerptEn: "After dozens of consulting missions, we've identified the recurring mistakes that cause digital transformation projects to fail.",
    contentFr: `70% des projets de transformation digitale n'atteignent pas leurs objectifs. Voici les 5 erreurs les plus courantes :\n\n1. La technologie avant la stratégie — Acheter avant de définir le problème.\n2. Sous-estimer la conduite du changement — La technologie = 30%, l'humain = 70%.\n3. Tout faire en même temps — Préférer les quick wins progressifs.\n4. Ignorer la dette technique — Auditer l'existant avant de construire.\n5. Négliger la mesure — Définir des KPIs dès le démarrage.`,
    contentEn: `70% of digital transformation projects don't meet their objectives. The 5 most common mistakes:\n\n1. Technology before strategy — Buying before defining the problem.\n2. Underestimating change management — Technology = 30%, people = 70%.\n3. Wanting everything at once — Prefer progressive quick wins.\n4. Ignoring technical debt — Audit before building.\n5. Neglecting measurement — Define KPIs at project start.`
  },
  {
    id: 6, titleFr: "RGPD et protection des données en Afrique", titleEn: "GDPR and data protection in Africa",
    categoryFr: "Conformité", categoryEn: "Compliance", date: "2023-11-02", readTime: "6 min", featured: false,
    excerptFr: "Les régulations locales de protection des données se multiplient en Afrique. Ce que les entreprises doivent anticiper.",
    excerptEn: "Local data protection regulations are multiplying across Africa. What businesses need to anticipate.",
    contentFr: `Plus de 35 pays africains ont adopté ou sont en cours d'adoption d'une législation sur la protection des données, inspirée du RGPD.\n\nObligations clés : consentement explicite, droit à l'oubli, notification des violations, DPO dans certains cas, localisation des données.\n\nRecommandation : Réalisez un audit de vos flux de données, cartographiez les traitements, mettez à jour vos politiques et formez vos équipes. La conformité est une nécessité stratégique.`,
    contentEn: `More than 35 African countries have adopted or are adopting data protection legislation inspired by GDPR.\n\nKey obligations: explicit consent, right to erasure, breach notification, DPO in certain cases, data localization.\n\nRecommendation: Conduct a data flow audit, map your processing activities, update your privacy policies, and train your teams. Compliance is a strategic necessity.`
  }
];

export default function Blog() {
  const { language } = useLanguage();
  const fr = language === "fr";
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const featured = articles[0];
  const rest = articles.slice(1);

  return (
    <div className="min-h-screen bg-background">
      <section className="relative pt-32 pb-20 bg-gradient-to-br from-slate-50 via-blue-50/30 to-white overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10 max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Ressources & Insights" : "Resources & Insights"}</p>
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">{fr ? "Expertise & Perspectives" : "Expertise & Perspectives"}</h1>
            <p className="text-xl text-slate-500">{fr ? "Analyses approfondies, retours d'expérience et bonnes pratiques par nos experts IT." : "In-depth analysis, experience feedback, and best practices from our IT experts."}</p>
          </motion.div>
        </div>
      </section>

      {/* Featured */}
      <section className="py-12 bg-white border-b border-slate-100">
        <div className="container mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="bg-gradient-to-br from-primary/5 to-blue-50/40 border border-primary/15 rounded-2xl p-8 md:p-12 cursor-pointer hover:border-primary/30 transition-all"
              onClick={() => setExpandedId(expandedId === featured.id ? null : featured.id)}>
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full uppercase tracking-wide">{fr ? "À la une" : "Featured"}</span>
                <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">{fr ? featured.categoryFr : featured.categoryEn}</span>
                <div className="flex items-center gap-2 text-xs text-slate-400 ml-auto">
                  <Calendar size={12} />{featured.date}
                  <Clock size={12} className="ml-2" />{featured.readTime}
                </div>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4">{fr ? featured.titleFr : featured.titleEn}</h2>
              <p className="text-slate-500 leading-relaxed mb-5">{fr ? featured.excerptFr : featured.excerptEn}</p>
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                {expandedId === featured.id ? <><ChevronUp size={16} />{fr ? "Réduire" : "Collapse"}</> : <><ChevronDown size={16} />{fr ? "Lire l'article" : "Read article"}</>}
              </div>
              {expandedId === featured.id && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8 pt-8 border-t border-slate-200 text-slate-600 leading-relaxed whitespace-pre-wrap text-base">
                  {fr ? featured.contentFr : featured.contentEn}
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Articles */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rest.map((article, i) => (
              <motion.div key={article.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                <div className="h-full bg-white border border-slate-200 rounded-2xl p-8 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => setExpandedId(expandedId === article.id ? null : article.id)}>
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className="flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                      <Tag size={11} />{fr ? article.categoryFr : article.categoryEn}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-slate-400 ml-auto">
                      <Calendar size={11} />{article.date}
                      <Clock size={11} className="ml-1" />{article.readTime}
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{fr ? article.titleFr : article.titleEn}</h3>
                  <p className="text-slate-500 leading-relaxed text-sm mb-5">{fr ? article.excerptFr : article.excerptEn}</p>
                  <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                    {expandedId === article.id ? <><ChevronUp size={14} />{fr ? "Réduire" : "Collapse"}</> : <><ChevronDown size={14} />{fr ? "Lire la suite" : "Read more"}</>}
                  </div>
                  {expandedId === article.id && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 pt-6 border-t border-slate-100 text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                      {fr ? article.contentFr : article.contentEn}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
