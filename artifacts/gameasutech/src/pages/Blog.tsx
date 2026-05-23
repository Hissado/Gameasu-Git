import React, { useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { CTASection } from "@/components/CTASection";
import { Calendar, Clock, Tag, ArrowRight, ChevronRight } from "lucide-react";

const articles = [
  {
    id: 1,
    categoryFr: "Transformation Digitale",
    categoryEn: "Digital Transformation",
    titleFr: "Les enjeux de la transformation digitale en 2026",
    titleEn: "The challenges of digital transformation in 2026",
    excerptFr: "En 2026, la transformation digitale n'est plus une option mais une condition de survie. Les organisations qui n'ont pas encore entamé cette transition structurelle font face à une pression concurrentielle croissante...",
    excerptEn: "In 2026, digital transformation is no longer optional but a survival condition. Organizations that have not yet begun this structural transition face growing competitive pressure...",
    bodyFr: `En 2026, la transformation digitale n'est plus une option mais une condition de survie pour les entreprises de toutes tailles. Les organisations qui ont entamé cette transition bénéficient d'avantages compétitifs considérables : agilité opérationnelle, meilleure expérience client, coûts réduits et capacité d'innovation accélérée.

Les principaux enjeux que nous observons chez nos clients incluent la modernisation des systèmes hérités (legacy), l'intégration des données dispersées dans des silos organisationnels, la gestion du changement humain et culturel, et la sécurisation des nouveaux périmètres digitaux.

Chez Gaméasù Technology, notre approche de la transformation digitale est méthodique et progressive. Nous commençons toujours par un audit complet de l'existant, avant de définir une roadmap réaliste alignée sur les objectifs métiers. La transformation n'est pas un projet IT — c'est un projet d'entreprise qui engage l'ensemble de l'organisation.`,
    bodyEn: `In 2026, digital transformation is no longer optional but a survival condition for organizations of all sizes. Those that have embraced this transition enjoy considerable competitive advantages: operational agility, better customer experience, reduced costs, and accelerated innovation capacity.

The main challenges we observe with our clients include modernizing legacy systems, integrating data dispersed across organizational silos, managing human and cultural change, and securing new digital perimeters.

At Gaméasù Technology, our approach to digital transformation is methodical and progressive. We always start with a comprehensive audit of the existing state before defining a realistic roadmap aligned with business objectives. Transformation is not an IT project — it is a business project that engages the entire organization.`,
    date: "2026-05-10",
    readTime: "6 min",
    featured: true
  },
  {
    id: 2,
    categoryFr: "Cybersécurité",
    categoryEn: "Cybersecurity",
    titleFr: "Pourquoi la cybersécurité est devenue un enjeu stratégique",
    titleEn: "Why cybersecurity has become a strategic issue",
    excerptFr: "Les cyberattaques ont augmenté de 300% en trois ans. Pour les directions générales, la sécurité informatique n'est plus l'affaire exclusive de la DSI — elle est devenue une priorité de gouvernance...",
    excerptEn: "Cyberattacks have increased by 300% in three years. For leadership teams, IT security is no longer the exclusive domain of IT departments — it has become a governance priority...",
    bodyFr: `Les cyberattaques ont augmenté de 300% en trois ans. Les ransomwares, les attaques par phishing sophistiqué et les violations de données font désormais la une des médias généralistes, touchant des hôpitaux, des administrations publiques et des entreprises cotées.

Pour les directions générales, la sécurité informatique n'est plus l'affaire exclusive de la DSI. Elle est devenue une priorité de gouvernance qui engage la responsabilité des conseils d'administration. Les régulateurs (RGPD, NIS2 en Europe, DORA pour le secteur financier) imposent des obligations croissantes et des sanctions significatives.

Notre approche de la cybersécurité est holistique : nous combinons les technologies (SOC, EDR, SIEM), les processus (gestion des incidents, plans de continuité) et l'humain (formations, simulations de phishing). La sécurité efficace est une culture, pas un produit.`,
    bodyEn: `Cyberattacks have increased by 300% in three years. Ransomware, sophisticated phishing attacks, and data breaches now make general media headlines, affecting hospitals, public administrations, and listed companies.

For leadership teams, IT security is no longer the exclusive domain of IT departments. It has become a governance priority that engages board of director responsibility. Regulators (GDPR, NIS2 in Europe, DORA for financial sector) impose growing obligations and significant penalties.

Our approach to cybersecurity is holistic: we combine technologies (SOC, EDR, SIEM), processes (incident management, continuity plans), and people (training, phishing simulations). Effective security is a culture, not a product.`,
    date: "2026-04-22",
    readTime: "5 min",
    featured: false
  },
  {
    id: 3,
    categoryFr: "Intelligence Artificielle",
    categoryEn: "Artificial Intelligence",
    titleFr: "Comment l'IA transforme les opérations des entreprises",
    titleEn: "How AI is transforming business operations",
    excerptFr: "L'intelligence artificielle est passée du stade expérimental au déploiement à grande échelle. Les entreprises qui intègrent l'IA dans leurs opérations enregistrent des gains de productivité de 20 à 40%...",
    excerptEn: "Artificial intelligence has moved from experimental to large-scale deployment. Companies integrating AI into their operations report productivity gains of 20 to 40%...",
    bodyFr: `L'intelligence artificielle est passée du stade expérimental au déploiement à grande échelle dans presque tous les secteurs. Les entreprises qui ont su intégrer l'IA dans leurs opérations enregistrent des gains de productivité de 20 à 40%, une réduction significative des erreurs humaines et une capacité d'analyse bien supérieure à ce que permettaient les méthodes traditionnelles.

Concrètement, nous observons des cas d'usage dans la gestion documentaire intelligente (extraction automatique d'informations), le service client augmenté (assistants conversationnels), la maintenance prédictive, la détection de fraudes et l'automatisation des processus répétitifs (RPA + IA).

L'enjeu n'est pas de remplacer l'humain mais de l'augmenter : libérer les collaborateurs des tâches à faible valeur ajoutée pour les recentrer sur la création de valeur, la relation client et l'innovation.`,
    bodyEn: `Artificial intelligence has moved from experimental to large-scale deployment across virtually every sector. Companies that have successfully integrated AI into their operations report productivity gains of 20 to 40%, significant reductions in human error, and analytical capabilities far beyond what traditional methods allowed.

Concretely, we observe use cases in intelligent document management (automatic information extraction), augmented customer service (conversational assistants), predictive maintenance, fraud detection, and automation of repetitive processes (RPA + AI).

The challenge is not to replace humans but to augment them: freeing employees from low-value tasks to refocus on value creation, customer relationships, and innovation.`,
    date: "2026-04-08",
    readTime: "7 min",
    featured: false
  },
  {
    id: 4,
    categoryFr: "Modern Workplace",
    categoryEn: "Modern Workplace",
    titleFr: "Modern Workplace : améliorer la collaboration des équipes distribuées",
    titleEn: "Modern Workplace: improving distributed team collaboration",
    excerptFr: "Le travail hybride est devenu la norme. Les organisations qui ont investi dans les bons outils de collaboration enregistrent une productivité 25% supérieure et un taux de rétention des talents significativement amélioré...",
    excerptEn: "Hybrid work has become the norm. Organizations that have invested in the right collaboration tools report 25% higher productivity and significantly improved talent retention rates...",
    bodyFr: `Le travail hybride est devenu la norme dans la plupart des organisations. Les salariés alternat entre bureau et télétravail, les équipes sont distribuées sur plusieurs fuseaux horaires, et les collaborateurs travaillent de plus en plus avec des partenaires externes.

Dans ce contexte, les outils de collaboration ne sont plus de simples commodités — ils sont le tissu connectif de l'organisation moderne. Les organisations qui ont investi dans les bons outils enregistrent une productivité supérieure de 25% et un taux de rétention des talents significativement amélioré.

Un Modern Workplace réussi repose sur trois piliers : des outils intégrés et intuitifs (messagerie, visioconférence, co-édition), une infrastructure fiable et sécurisée (réseau, cloud, endpoints), et une adoption utilisateur soutenue par la formation et l'accompagnement au changement.`,
    bodyEn: `Hybrid work has become the norm in most organizations. Employees alternate between office and remote work, teams are distributed across multiple time zones, and collaborators increasingly work with external partners.

In this context, collaboration tools are no longer mere commodities — they are the connective tissue of the modern organization. Organizations that have invested in the right tools report 25% higher productivity and significantly improved talent retention rates.

A successful Modern Workplace rests on three pillars: integrated and intuitive tools (messaging, video conferencing, co-editing), reliable and secure infrastructure (network, cloud, endpoints), and user adoption supported by training and change management.`,
    date: "2026-03-18",
    readTime: "5 min",
    featured: false
  },
  {
    id: 5,
    categoryFr: "Infrastructure & Cloud",
    categoryEn: "Infrastructure & Cloud",
    titleFr: "Cloud et infrastructure : bâtir une base technologique solide",
    titleEn: "Cloud and infrastructure: building a solid technology foundation",
    excerptFr: "Le cloud n'est plus un choix — c'est l'infrastructure de base de l'entreprise moderne. Mais une migration cloud réussie exige une stratégie claire, une architecture bien pensée et un accompagnement rigoureux...",
    excerptEn: "The cloud is no longer a choice — it is the foundational infrastructure of the modern enterprise. But a successful cloud migration requires a clear strategy, well-thought-out architecture, and rigorous support...",
    bodyFr: `Le cloud n'est plus un choix — c'est l'infrastructure de base de l'entreprise moderne. Selon les études récentes, 90% des entreprises utilisent désormais des services cloud, mais seulement 30% estiment en tirer pleinement la valeur promise.

Le fossé entre adoption et valeur s'explique souvent par des migrations précipitées, une architecture cloud-native insuffisante, des coûts non maîtrisés (cloud sprawl) et un manque de compétences internes pour opérer les environnements cloud.

Chez Gaméasù Technology, nous adoptons une approche Cloud Smart plutôt que Cloud First : chaque workload est évalué selon sa pertinence pour le cloud (on-premise, cloud public, cloud privé, ou hybride). Nous guidons les organisations de l'audit initial à la migration, en passant par l'optimisation continue et la formation des équipes.`,
    bodyEn: `The cloud is no longer a choice — it is the foundational infrastructure of the modern enterprise. According to recent studies, 90% of companies now use cloud services, but only 30% feel they are fully extracting the promised value.

The gap between adoption and value is often explained by rushed migrations, insufficient cloud-native architecture, uncontrolled costs (cloud sprawl), and a lack of internal skills to operate cloud environments.

At Gaméasù Technology, we take a Cloud Smart rather than Cloud First approach: each workload is evaluated for its cloud suitability (on-premise, public cloud, private cloud, or hybrid). We guide organizations from the initial audit through migration, continuous optimization, and team training.`,
    date: "2026-02-27",
    readTime: "6 min",
    featured: false
  },
  {
    id: 6,
    categoryFr: "Automatisation",
    categoryEn: "Automation",
    titleFr: "Automatisation : réduire les tâches répétitives et gagner en performance",
    titleEn: "Automation: reducing repetitive tasks and gaining performance",
    excerptFr: "L'automatisation des processus métiers (BPA) génère en moyenne 3 à 5 fois le ROI des projets IT traditionnels. Mais l'enjeu n'est pas d'automatiser pour automatiser — c'est d'identifier les bons processus...",
    excerptEn: "Business process automation (BPA) generates on average 3 to 5 times the ROI of traditional IT projects. But the challenge is not to automate for automation's sake — it's to identify the right processes...",
    bodyFr: `L'automatisation des processus métiers génère en moyenne 3 à 5 fois le ROI des projets IT traditionnels. Les organisations qui ont déployé des programmes d'automatisation robustes reportent des réductions de coûts opérationnels de 30 à 50% sur les processus concernés.

Mais l'enjeu n'est pas d'automatiser pour automatiser. L'automatisation mal ciblée peut amplifier des processus défectueux, créer de la rigidité organisationnelle et générer des résistances internes. Le premier travail est toujours d'optimiser le processus avant de l'automatiser.

Notre méthodologie en 4 étapes : (1) cartographie et priorisation des processus, (2) simplification et standardisation, (3) automatisation avec les bons outils (RPA, workflow, IA), (4) mesure continue de la performance et amélioration itérative.`,
    bodyEn: `Business process automation generates on average 3 to 5 times the ROI of traditional IT projects. Organizations that have deployed robust automation programs report operational cost reductions of 30 to 50% on the processes concerned.

But the challenge is not to automate for automation's sake. Poorly targeted automation can amplify defective processes, create organizational rigidity, and generate internal resistance. The first task is always to optimize the process before automating it.

Our 4-step methodology: (1) process mapping and prioritization, (2) simplification and standardization, (3) automation with the right tools (RPA, workflow, AI), (4) continuous performance measurement and iterative improvement.`,
    date: "2026-02-12",
    readTime: "5 min",
    featured: false
  }
];

export default function Blog() {
  const { language } = useLanguage();
  const fr = language === "fr";
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const featured = articles[0];
  const rest = articles.slice(1);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-20%,rgba(30,64,200,0.2)_0%,transparent_70%)] pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">
              {fr ? "Ressources & Insights" : "Resources & Insights"}
            </p>
            <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
              {fr ? "L'expertise de nos équipes" : "Expertise from our teams"}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl">
              {fr
                ? "Articles, analyses et perspectives de nos experts sur les grandes tendances technologiques qui façonnent l'avenir des entreprises."
                : "Articles, analyses, and perspectives from our experts on the major technology trends shaping the future of business."}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Featured Article */}
      <section className="pb-12">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="group bg-gradient-to-br from-primary/20 to-blue-900/10 border border-primary/20 rounded-2xl p-10 md:p-14 cursor-pointer hover:border-primary/40 transition-all duration-300"
            onClick={() => setExpandedId(expandedId === featured.id ? null : featured.id)}
          >
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-semibold uppercase tracking-wide">
                {fr ? featured.categoryFr : featured.categoryEn}
              </span>
              <span className="text-xs text-muted-foreground font-medium px-2 py-0.5 bg-primary/5 rounded">
                {fr ? "À la une" : "Featured"}
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
              {fr ? featured.titleFr : featured.titleEn}
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed mb-6 max-w-3xl">
              {fr ? featured.excerptFr : featured.excerptEn}
            </p>
            {expandedId === featured.id && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-muted-foreground leading-relaxed whitespace-pre-line mb-6">
                {fr ? featured.bodyFr : featured.bodyEn}
              </motion.div>
            )}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><Calendar size={14} /> {featured.date}</span>
                <span className="flex items-center gap-1.5"><Clock size={14} /> {featured.readTime}</span>
              </div>
              <div className="flex items-center gap-2 text-primary font-semibold text-sm group-hover:gap-3 transition-all">
                {expandedId === featured.id ? (fr ? "Réduire" : "Collapse") : (fr ? "Lire l'article" : "Read article")}
                <ArrowRight size={14} />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Articles Grid */}
      <section className="pb-28">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {rest.map((article, i) => (
              <motion.div key={article.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                <div
                  className="group h-full bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 cursor-pointer transition-all duration-300 hover:-translate-y-1 flex flex-col"
                  onClick={() => setExpandedId(expandedId === article.id ? null : article.id)}
                >
                  <div className="p-8 flex-1 flex flex-col">
                    <div className="flex items-center gap-3 mb-5">
                      <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                        {fr ? article.categoryFr : article.categoryEn}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3 leading-tight group-hover:text-primary transition-colors">
                      {fr ? article.titleFr : article.titleEn}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-4 flex-1">
                      {fr ? article.excerptFr : article.excerptEn}
                    </p>
                    {expandedId === article.id && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line mb-4">
                        {fr ? article.bodyFr : article.bodyEn}
                      </motion.div>
                    )}
                    <div className="flex items-center justify-between pt-4 border-t border-border mt-auto">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar size={12} /> {article.date}</span>
                        <span className="flex items-center gap-1"><Clock size={12} /> {article.readTime}</span>
                      </div>
                      <ChevronRight size={16} className={`text-muted-foreground group-hover:text-primary transition-all ${expandedId === article.id ? 'rotate-90' : ''}`} />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <CTASection
        title={fr ? "Parler à un expert" : "Talk to an expert"}
        subtitle={fr ? "Nos consultants sont disponibles pour discuter de vos défis technologiques spécifiques." : "Our consultants are available to discuss your specific technology challenges."}
        btnText={fr ? "Planifier un échange" : "Schedule a call"}
        href="/contact"
      />
    </div>
  );
}
