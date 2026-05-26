import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, MessageCircle, ChevronDown, Minimize2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { Link } from "wouter";

type Lang = "fr" | "en";

type BookingStep =
  | "idle"
  | "name"
  | "email"
  | "phone"
  | "country"
  | "company"
  | "service"
  | "date"
  | "message"
  | "done";

interface Message {
  id: string;
  role: "user" | "bot";
  text: string;
  time: Date;
  suggestions?: string[];
  link?: { label: string; href: string };
}

interface BookingData {
  name?: string;
  email?: string;
  phone?: string;
  country?: string;
  company?: string;
  service?: string;
  date?: string;
  message?: string;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

function detectLang(text: string, fallback: Lang): Lang {
  const frPattern =
    /\b(bonjour|salut|merci|oui|non|s'il|vous|nous|est|une|pour|avec|votre|notre|des|les|sur|par|que|qui|comment|quand|o[uù]|quel|quelle|je|il|elle|ils|elles|mais|donc|aussi|tr[eè]s|bien|bonne|avoir|être|faire|service|s[eé]curit[eé]|entreprise|rendez|vos|mes|mon|ma|plus|sans|tout|cette|cela|c'est|je suis|pouvez|voulez|besoin|pouvons|avons)\b/i;
  return frPattern.test(text) ? "fr" : fallback;
}

function isEmailValid(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

const KNOWLEDGE: Record<
  string,
  {
    patterns: RegExp;
    fr: string;
    en: string;
    suggestions_fr?: string[];
    suggestions_en?: string[];
    link?: { labelFr: string; labelEn: string; href: string };
  }
> = {
  greeting: {
    patterns:
      /\b(bonjour|bonsoir|salut|coucou|hello|hi|hey|good morning|good evening|good afternoon|greetings)\b/i,
    fr: "Bonjour ! Je suis Anne, votre assistante virtuelle Gaméasù. Comment puis-je vous aider aujourd'hui ?",
    en: "Hello! I'm Anne, your Gaméasù virtual assistant. How can I help you today?",
    suggestions_fr: [
      "Nos services",
      "Demander un rendez-vous",
      "Support technique",
      "Nous contacter",
    ],
    suggestions_en: [
      "Our services",
      "Book a consultation",
      "Technical support",
      "Contact us",
    ],
  },
  about: {
    patterns:
      /\b(qui êtes|who are|à propos|about|gameasu|gaméasù|gameasutech|entreprise|company|société|organization|organisation|slogan|fondée|founded|création|history|histoire)\b/i,
    fr: "Gaméasù est une entreprise technologique fondée en 2023, avec le slogan **Innover, Transformer, Sécuriser**. Nous accompagnons les entreprises, institutions et organisations en Afrique, en Amérique du Nord, en Europe et au-delà dans leur transformation numérique.",
    en: "Gaméasù is a technology company founded in 2023, with the motto **Innovate, Transform, Secure**. We support businesses, institutions and organizations across Africa, North America, Europe and beyond in their digital transformation.",
    suggestions_fr: ["Nos services", "Présence internationale", "Nous contacter"],
    suggestions_en: ["Our services", "International presence", "Contact us"],
    link: { labelFr: "En savoir plus sur nous", labelEn: "Learn more about us", href: "/about" },
  },
  services: {
    patterns:
      /\b(services|solutions|offre|offering|expertise|what do you|que faites|proposez|proposal|capabilities|quelles sont vos)\b/i,
    fr: "Gaméasù propose 9 domaines d'expertise IT :\n• Cybersécurité (SOC 24/7, audit)\n• Cloud & Infrastructure (AWS, Azure, GCP)\n• Intelligence Artificielle & Automatisation\n• Modern Workplace (Microsoft 365, Teams)\n• Services IT Managés (MSP)\n• Transformation Digitale\n• Sécurité Physique & Technologies\n• Services Professionnels\n• Data, Cloud & Expérience Digitale\n\nQuel service vous intéresse le plus ?",
    en: "Gaméasù offers 9 IT areas of expertise:\n• Cybersecurity (24/7 SOC, audit)\n• Cloud & Infrastructure (AWS, Azure, GCP)\n• Artificial Intelligence & Automation\n• Modern Workplace (Microsoft 365, Teams)\n• Managed IT Services (MSP)\n• Digital Transformation\n• Physical Security & Technology\n• Professional Services\n• Data, Cloud & Digital Experience\n\nWhich service interests you most?",
    suggestions_fr: ["Cybersécurité", "Cloud & Infrastructure", "Intelligence Artificielle", "Services Managés"],
    suggestions_en: ["Cybersecurity", "Cloud & Infrastructure", "Artificial Intelligence", "Managed Services"],
    link: { labelFr: "Voir tous les services", labelEn: "See all services", href: "/services" },
  },
  cybersecurity: {
    patterns:
      /\b(cyber|cybersécurité|cybersecurity|sécurité|security|soc|pentest|pénétration|penetration|edr|xdr|rgpd|gdpr|iso 27001|menace|threat|endpoint|firewall|pare-feu|audit sécurité|security audit)\b/i,
    fr: "Notre offre Cybersécurité comprend :\n• SOC managé 24/7 (détection & réponse)\n• Tests de pénétration (pentests)\n• Protection des endpoints (EDR/XDR)\n• Conformité RGPD & ISO 27001\n• Audit de sécurité complet\n• Formation et sensibilisation\n\nNous sécurisons votre environnement de bout en bout.",
    en: "Our Cybersecurity offering includes:\n• 24/7 managed SOC (detection & response)\n• Penetration testing (pentests)\n• Endpoint protection (EDR/XDR)\n• GDPR & ISO 27001 compliance\n• Full security audit\n• Training and awareness\n\nWe secure your entire environment end-to-end.",
    suggestions_fr: ["Demander un audit gratuit", "Prendre rendez-vous", "Autres services"],
    suggestions_en: ["Request a free audit", "Book a meeting", "Other services"],
    link: { labelFr: "En savoir plus", labelEn: "Learn more", href: "/cybersecurity" },
  },
  cloud: {
    patterns:
      /\b(cloud|infrastructure|réseau|network|sd-wan|sdwan|aws|azure|gcp|google cloud|migration|hébergement|hosting|hybrid|hybride|finops|datacenter|data center|saas|iaas|paas|serveur|server)\b/i,
    fr: "Notre expertise Cloud & Infrastructure couvre :\n• Architecture réseau & SD-WAN\n• Migration cloud multi-fournisseurs (AWS, Azure, GCP)\n• Infrastructure hybride et on-premise\n• FinOps & supervision de coûts\n• Continuité d'activité (PCA/PRA)\n\nNous concevons et déployons des architectures adaptées à vos besoins.",
    en: "Our Cloud & Infrastructure expertise covers:\n• Network architecture & SD-WAN\n• Multi-cloud migration (AWS, Azure, GCP)\n• Hybrid and on-premise infrastructure\n• FinOps & cost monitoring\n• Business continuity (BCP/DRP)\n\nWe design and deploy architectures tailored to your needs.",
    suggestions_fr: ["Évaluer mon infrastructure", "Prendre rendez-vous", "Autres services"],
    suggestions_en: ["Assess my infrastructure", "Book a meeting", "Other services"],
    link: { labelFr: "En savoir plus", labelEn: "Learn more", href: "/cloud-infrastructure" },
  },
  ai: {
    patterns:
      /\b(intelligence artificielle|artificial intelligence|ia\b|ai\b|automatisation|automation|rpa|chatbot|machine learning|ml|deep learning|prédictif|predictive|ocr|nlp|traitement|processing|robot|algorithm|data science)\b/i,
    fr: "Notre offre Intelligence Artificielle & Automatisation :\n• Chatbots & assistants IA personnalisés\n• RPA & automatisation des processus métier\n• Analytique prédictive & data science\n• OCR & traitement intelligent de documents\n• Tableaux de bord BI et insights\n\nNous transformons vos données en valeur business.",
    en: "Our Artificial Intelligence & Automation offering:\n• Custom chatbots & AI assistants\n• RPA & business process automation\n• Predictive analytics & data science\n• OCR & intelligent document processing\n• BI dashboards and insights\n\nWe turn your data into business value.",
    suggestions_fr: ["Explorer les solutions IA", "Prendre rendez-vous", "Autres services"],
    suggestions_en: ["Explore AI solutions", "Book a meeting", "Other services"],
    link: { labelFr: "En savoir plus", labelEn: "Learn more", href: "/ai-automation" },
  },
  workplace: {
    patterns:
      /\b(modern workplace|microsoft|365|teams|ucaas|collaboration|hybride|hybrid work|télétravail|remote work|unified communication|communication unifiée|audio.?vid[eé]o|visioconf|videoconf|endpoint management|poste de travail)\b/i,
    fr: "Notre solution Modern Workplace vous aide à :\n• Déployer et optimiser Microsoft 365 & Teams\n• Mettre en place une UCaaS performante\n• Gérer vos endpoints (PC, mobile, tablette)\n• Implémenter des outils audio-vidéo d'entreprise\n• Favoriser la collaboration hybride\n\nTravaillez mieux, où que vous soyez.",
    en: "Our Modern Workplace solution helps you:\n• Deploy and optimize Microsoft 365 & Teams\n• Implement a high-performance UCaaS\n• Manage your endpoints (PC, mobile, tablet)\n• Set up enterprise audio-video tools\n• Enable hybrid collaboration\n\nWork better, wherever you are.",
    suggestions_fr: ["Demander une démo", "Prendre rendez-vous", "Autres services"],
    suggestions_en: ["Request a demo", "Book a meeting", "Other services"],
    link: { labelFr: "Voir tous les services", labelEn: "See all services", href: "/services" },
  },
  msp: {
    patterns:
      /\b(msp|managed service|services managés|managed it|helpdesk|help desk|maintenance|supervision|monitoring|sla|niveau de service|proactive|infog[eé]rance|outsourcing|externalisation|support it)\b/i,
    fr: "Nos Services IT Managés (MSP) incluent :\n• Helpdesk L1/L2/L3 réactif\n• Supervision proactive 24/7\n• Maintenance préventive et corrective\n• SLA contractuellement garantis\n• Rapports mensuels détaillés\n\nNous gérons votre IT pour que vous puissiez vous concentrer sur votre cœur de métier.",
    en: "Our Managed IT Services (MSP) include:\n• Responsive L1/L2/L3 Helpdesk\n• Proactive 24/7 monitoring\n• Preventive and corrective maintenance\n• Contractually guaranteed SLAs\n• Detailed monthly reports\n\nWe manage your IT so you can focus on your core business.",
    suggestions_fr: ["Créer un ticket support", "Prendre rendez-vous", "Nous contacter"],
    suggestions_en: ["Create a support ticket", "Book a meeting", "Contact us"],
    link: { labelFr: "Support & MSP", labelEn: "Support & MSP", href: "/support" },
  },
  sectors: {
    patterns:
      /\b(secteurs|industries|industries|secteur|industry|banking|banque|finance|santé|health|éducation|education|mining|mines|gouvernement|government|telecom|telecom|btp|construction|logistique|logistics|retail|commerce|ngo|ong)\b/i,
    fr: "Gaméasù accompagne de nombreux secteurs :\n• Banque & Finance\n• Santé & Pharmaceutique\n• Éducation & Formation\n• Gouvernement & Secteur public\n• Mines & Ressources naturelles\n• Télécommunications\n• BTP & Construction\n• Logistique & Transport\n• ONG & Organismes internationaux\n\nNous adaptons nos solutions à chaque contexte métier.",
    en: "Gaméasù serves many sectors:\n• Banking & Finance\n• Healthcare & Pharmaceuticals\n• Education & Training\n• Government & Public Sector\n• Mining & Natural Resources\n• Telecommunications\n• Construction & Real Estate\n• Logistics & Transportation\n• NGOs & International Organizations\n\nWe adapt our solutions to each business context.",
    suggestions_fr: ["Voir nos réalisations", "Prendre rendez-vous", "Nos services"],
    suggestions_en: ["See our work", "Book a meeting", "Our services"],
    link: { labelFr: "Voir les secteurs", labelEn: "See industries", href: "/industries" },
  },
  international: {
    patterns:
      /\b(international|présence|presence|pays|country|countries|afrique|africa|amér|america|états.?unis|usa|canada|france|belgique|togo|côte d'ivoire|côte|ivory coast|mali|europe|world|monde|global)\b/i,
    fr: "Gaméasù est présent dans plusieurs pays :\n🇺🇸 États-Unis (Siège — New Haven, CT)\n🇨🇦 Canada\n🇫🇷 France\n🇧🇪 Belgique\n🇹🇬 Togo\n🇨🇮 Côte d'Ivoire\n🇲🇱 Mali\n\nNous intervenons localement avec une vision internationale.",
    en: "Gaméasù is present in several countries:\n🇺🇸 United States (HQ — New Haven, CT)\n🇨🇦 Canada\n🇫🇷 France\n🇧🇪 Belgium\n🇹🇬 Togo\n🇨🇮 Ivory Coast\n🇲🇱 Mali\n\nWe operate locally with an international vision.",
    suggestions_fr: ["Nous contacter", "À propos de nous", "Nos services"],
    suggestions_en: ["Contact us", "About us", "Our services"],
    link: { labelFr: "À propos", labelEn: "About us", href: "/about" },
  },
  contact: {
    patterns:
      /\b(contact|coordonn[eé]es|adresse|address|t[eé]l[eé]phone|phone|email|courriel|joindre|reach|where are you|o[uù] êtes.vous|parler [aà]|speak to)\b/i,
    fr: "Voici comment nous joindre :\n📍 195 Church Street, New Haven, CT, USA\n📞 +1 (203) 626-2309\n✉️ info@gameasu.tech\n\nNous répondons sous 24 heures ouvrées. Voulez-vous que je prenne vos coordonnées pour qu'un expert vous rappelle ?",
    en: "Here's how to reach us:\n📍 195 Church Street, New Haven, CT, USA\n📞 +1 (203) 626-2309\n✉️ info@gameasu.tech\n\nWe respond within 24 business hours. Would you like me to take your details so an expert can call you back?",
    suggestions_fr: ["Prendre rendez-vous", "Formulaire de contact", "Support technique"],
    suggestions_en: ["Book a meeting", "Contact form", "Technical support"],
    link: { labelFr: "Page contact", labelEn: "Contact page", href: "/contact" },
  },
  booking: {
    patterns:
      /\b(rendez.vous|appointment|consultation|réserver|book|schedule|planifier|meeting|réunion|demo|d[eé]mo|call|appel|contact me|contactez.moi|rappel|callback|entretien|interview)\b/i,
    fr: "Avec plaisir ! Je vais vous aider à planifier un rendez-vous avec nos experts. Commençons par votre nom complet.",
    en: "With pleasure! I'll help you schedule a meeting with our experts. Let's start with your full name.",
  },
  partnership: {
    patterns:
      /\b(partenariat|partnership|partner|partenaire|collaborat|alliance|reseller|revendeur|distributeur|distributor|channel|affiliate|affiliate)\b/i,
    fr: "Gaméasù accueille les opportunités de partenariat avec des intégrateurs, revendeurs, éditeurs logiciels et consultants. Nous offrons des conditions attractives et un support technique dédié à nos partenaires.",
    en: "Gaméasù welcomes partnership opportunities with integrators, resellers, software vendors, and consultants. We offer attractive terms and dedicated technical support to our partners.",
    suggestions_fr: ["Devenir partenaire", "Nous contacter", "Prendre rendez-vous"],
    suggestions_en: ["Become a partner", "Contact us", "Book a meeting"],
    link: { labelFr: "Nos partenaires", labelEn: "Our partners", href: "/partners" },
  },
  careers: {
    patterns:
      /\b(carrière|career|emploi|job|recrutement|recruitment|candidature|application|postuler|apply|rejoindre|join us|travailler|work with|talent|ingénieur|consultant|engineer|poste|position)\b/i,
    fr: "Gaméasù recrute des talents passionnés par la technologie ! Nous sommes toujours à la recherche d'ingénieurs certifiés, consultants et spécialistes IT. Envoyez votre candidature à info@gameasu.tech ou visitez notre page Carrières.",
    en: "Gaméasù is always looking for passionate technology talent! We recruit certified engineers, consultants and IT specialists. Send your application to info@gameasu.tech or visit our Careers page.",
    suggestions_fr: ["Voir les offres", "Candidature spontanée", "Nous contacter"],
    suggestions_en: ["See job offers", "Spontaneous application", "Contact us"],
    link: { labelFr: "Page Carrières", labelEn: "Careers page", href: "/careers" },
  },
  pricing: {
    patterns:
      /\b(prix|price|pricing|tarif|tarification|cost|devis|quote|quotation|combien|how much|forfait|package|abonnement|subscription)\b/i,
    fr: "Nos tarifs sont personnalisés selon la taille de votre organisation, vos besoins spécifiques et le périmètre des services souhaités. Je vous recommande de demander un devis sur mesure — c'est gratuit et sans engagement.",
    en: "Our pricing is tailored to your organization's size, specific needs, and service scope. I recommend requesting a custom quote — it's free and non-binding.",
    suggestions_fr: ["Demander un devis", "Prendre rendez-vous", "Nous contacter"],
    suggestions_en: ["Request a quote", "Book a meeting", "Contact us"],
    link: { labelFr: "Nous contacter", labelEn: "Contact us", href: "/contact" },
  },
  support: {
    patterns:
      /\b(support|ticket|incident|problème|problem|panne|outage|urgence|urgent|help|aide|assistance|dépannage|troubleshoot|bug|erreur|error|crash)\b/i,
    fr: "Pour un support technique, vous pouvez :\n📞 Appeler : +1 (203) 626-2309\n✉️ Email : support@gameasu.tech\n🌐 Portail : support.gameasu.tech\n\nPour les clients MSP, notre équipe est disponible 24/7. Souhaitez-vous créer un ticket de support ?",
    en: "For technical support, you can:\n📞 Call: +1 (203) 626-2309\n✉️ Email: support@gameasu.tech\n🌐 Portal: support.gameasu.tech\n\nFor MSP clients, our team is available 24/7. Would you like to create a support ticket?",
    suggestions_fr: ["Créer un ticket", "Nos services managés", "Prendre rendez-vous"],
    suggestions_en: ["Create a ticket", "Our managed services", "Book a meeting"],
    link: { labelFr: "Page Support", labelEn: "Support page", href: "/support" },
  },
  caseStudies: {
    patterns:
      /\b(r[eé]alisations|case stud|r[eé]f[eé]rence|reference|client|portfolio|exemple|example|success|r[eé]ussite|projets?\b)\b/i,
    fr: "Gaméasù a accompagné des organisations leaders dans des projets d'envergure en Afrique, en Amérique du Nord et en Europe. Découvrez nos réalisations pour voir comment nous avons transformé leurs défis IT en succès mesurables.",
    en: "Gaméasù has supported leading organizations in major projects across Africa, North America and Europe. Explore our case studies to see how we've turned their IT challenges into measurable successes.",
    suggestions_fr: ["Voir les réalisations", "Prendre rendez-vous", "Nos services"],
    suggestions_en: ["See case studies", "Book a meeting", "Our services"],
    link: { labelFr: "Voir les réalisations", labelEn: "View case studies", href: "/case-studies" },
  },
  thanks: {
    patterns:
      /\b(merci|thank|thanks|super|parfait|excellent|très bien|great|awesome|amazing|génial|bien reçu)\b/i,
    fr: "Avec plaisir ! N'hésitez pas si vous avez d'autres questions. Chez Gaméasù, nous sommes là pour vous accompagner.",
    en: "You're welcome! Don't hesitate if you have more questions. At Gaméasù, we're here to support you.",
    suggestions_fr: ["Nos services", "Prendre rendez-vous", "Nous contacter"],
    suggestions_en: ["Our services", "Book a meeting", "Contact us"],
  },
};

function getIntent(text: string) {
  for (const [key, val] of Object.entries(KNOWLEDGE)) {
    if (val.patterns.test(text)) return key;
  }
  return null;
}

function botMessage(
  text: string,
  suggestions?: string[],
  link?: { label: string; href: string }
): Message {
  return { id: uid(), role: "bot", text, time: new Date(), suggestions, link };
}

function userMessage(text: string): Message {
  return { id: uid(), role: "user", text, time: new Date() };
}

function formatText(text: string) {
  return text.split("\n").map((line, i) => {
    const bold = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    return (
      <p key={i} className={line === "" ? "h-2" : "mb-0.5"} dangerouslySetInnerHTML={{ __html: bold }} />
    );
  });
}

const BOOKING_LABELS = {
  name: { fr: "Votre nom complet :", en: "Your full name:" },
  email: { fr: "Votre adresse email :", en: "Your email address:" },
  phone: { fr: "Votre numéro de téléphone :", en: "Your phone number:" },
  country: { fr: "Votre pays :", en: "Your country:" },
  company: { fr: "Votre entreprise :", en: "Your company:" },
  service: {
    fr: "Quel service vous intéresse ?\n(ex. Cybersécurité, Cloud, IA, MSP…)",
    en: "Which service interests you?\n(e.g. Cybersecurity, Cloud, AI, MSP…)",
  },
  date: {
    fr: "Quelle date ou période vous convient le mieux ?",
    en: "What date or period works best for you?",
  },
  message: {
    fr: "Un message ou besoin spécifique à préciser ? (ou tapez 'non' pour passer)",
    en: "Any specific message or need to share? (or type 'no' to skip)",
  },
};

function getBookingPrompt(step: BookingStep, lang: Lang): string {
  if (step === "idle" || step === "done") return "";
  const label = BOOKING_LABELS[step as keyof typeof BOOKING_LABELS];
  return lang === "fr" ? label.fr : label.en;
}

export function ChatBot() {
  const { language } = useLanguage();
  const fr = language === "fr";
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [bookingStep, setBookingStep] = useState<BookingStep>("idle");
  const [bookingData, setBookingData] = useState<BookingData>({});
  const [detectedLang, setDetectedLang] = useState<Lang>(language as Lang);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDetectedLang(language as Lang);
  }, [language]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const pushBot = useCallback(
    (text: string, suggestions?: string[], link?: { label: string; href: string }) => {
      setIsTyping(true);
      const delay = Math.min(600 + text.length * 10, 1800);
      setTimeout(() => {
        setIsTyping(false);
        setMessages((prev) => [...prev, botMessage(text, suggestions, link)]);
        inputRef.current?.focus();
      }, delay);
    },
    []
  );

  const handleOpen = () => {
    setIsOpen(true);
    setIsMinimized(false);
    if (!hasGreeted) {
      setHasGreeted(true);
      const lang = language as Lang;
      const k = KNOWLEDGE.greeting;
      setTimeout(() => {
        setMessages([
          botMessage(
            lang === "fr" ? k.fr : k.en,
            lang === "fr" ? k.suggestions_fr : k.suggestions_en
          ),
        ]);
      }, 400);
    }
    setTimeout(() => inputRef.current?.focus(), 500);
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

  const processBookingStep = useCallback(
    (text: string, step: BookingStep, lang: Lang): { next: BookingStep; data: Partial<BookingData> } => {
      const t = text.trim();
      switch (step) {
        case "name":
          return { next: "email", data: { name: t } };
        case "email":
          if (!isEmailValid(t)) {
            pushBot(
              lang === "fr"
                ? "Cet email ne semble pas valide. Pouvez-vous le vérifier ?"
                : "This email doesn't look valid. Could you double-check it?"
            );
            return { next: "email", data: {} };
          }
          return { next: "phone", data: { email: t } };
        case "phone":
          return { next: "country", data: { phone: t } };
        case "country":
          return { next: "company", data: { country: t } };
        case "company":
          return { next: "service", data: { company: t } };
        case "service":
          return { next: "date", data: { service: t } };
        case "date":
          return { next: "message", data: { date: t } };
        case "message":
          return { next: "done", data: { message: t === "non" || t === "no" ? "" : t } };
        default:
          return { next: step, data: {} };
      }
    },
    [pushBot]
  );

  const handleSend = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isTyping) return;

      const lang = detectLang(trimmed, detectedLang);
      setDetectedLang(lang);

      setMessages((prev) => [...prev, userMessage(trimmed)]);
      setInput("");

      if (bookingStep !== "idle") {
        if (bookingStep === "done") return;
        const { next, data } = processBookingStep(trimmed, bookingStep, lang);
        const newData = { ...bookingData, ...data };
        setBookingData(newData);

        if (next === "done") {
          setBookingStep("done");
          const confirm =
            lang === "fr"
              ? `Merci, **${newData.name}**. Votre demande de rendez-vous a bien été enregistrée. L'équipe Gaméasù vous contactera rapidement pour confirmer les disponibilités.`
              : `Thank you, **${newData.name}**. Your appointment request has been received. The Gaméasù team will contact you shortly to confirm availability.`;
          pushBot(
            confirm,
            lang === "fr"
              ? ["Nos services", "Nous contacter", "Retour à l'accueil"]
              : ["Our services", "Contact us", "Back to home"]
          );
        } else if (next !== bookingStep) {
          setBookingStep(next);
          pushBot(getBookingPrompt(next, lang));
        }
        return;
      }

      const intent = getIntent(trimmed);

      if (intent === "booking") {
        setBookingStep("name");
        const k = KNOWLEDGE.booking;
        pushBot(lang === "fr" ? k.fr : k.en);
        setTimeout(() => {
          pushBot(getBookingPrompt("name", lang));
        }, 1200);
        return;
      }

      if (intent && KNOWLEDGE[intent]) {
        const k = KNOWLEDGE[intent];
        const response = lang === "fr" ? k.fr : k.en;
        const suggestions = lang === "fr" ? k.suggestions_fr : k.suggestions_en;
        const link =
          k.link
            ? { label: lang === "fr" ? k.link.labelFr : k.link.labelEn, href: k.link.href }
            : undefined;
        pushBot(response, suggestions, link);
        return;
      }

      const fallback =
        lang === "fr"
          ? "Je n'ai pas encore cette information précise, mais je peux transmettre votre demande à notre équipe afin qu'elle vous réponde rapidement. Souhaitez-vous prendre rendez-vous avec un expert ?"
          : "I don't have that specific information yet, but I can forward your request to our team so they can respond as soon as possible. Would you like to schedule a call with an expert?";
      pushBot(
        fallback,
        lang === "fr"
          ? ["Prendre rendez-vous", "Nous contacter", "Voir nos services"]
          : ["Book a meeting", "Contact us", "See our services"]
      );
    },
    [bookingStep, bookingData, detectedLang, isTyping, processBookingStep, pushBot]
  );

  const handleSuggestion = (suggestion: string) => {
    handleSend(suggestion);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            onClick={handleOpen}
            className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center gap-0 sm:gap-2.5 p-0 sm:pl-4 sm:pr-5 sm:py-3 w-14 h-14 sm:w-auto sm:h-auto justify-center bg-primary text-white rounded-full shadow-xl hover:shadow-2xl hover:bg-primary/90 transition-all duration-300 group"
            aria-label="Ouvrir le chat avec Anne"
          >
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 text-sm font-bold">
              A
            </div>
            <div className="hidden sm:flex flex-col items-start leading-none">
              <span className="text-sm font-bold">Anne</span>
              <span className="text-[10px] text-white/70 font-medium">
                {fr ? "Assistante Gaméasù" : "Gaméasù Assistant"}
              </span>
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={isMinimized ? { opacity: 1, y: 0, scale: 1, height: "auto" } : { opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed bottom-5 right-2 left-2 sm:left-auto sm:bottom-6 sm:right-6 sm:w-[370px] z-50 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
            style={{ maxHeight: "calc(100vh - 72px)" }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3.5 bg-primary text-white flex-shrink-0">
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-base font-bold">
                  A
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm leading-none">Anne</p>
                <p className="text-[11px] text-white/70 mt-0.5">
                  {fr ? "Assistante virtuelle Gaméasù" : "Gaméasù Virtual Assistant"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
                  aria-label="Minimiser"
                >
                  <ChevronDown size={16} className={`transition-transform ${isMinimized ? "rotate-180" : ""}`} />
                </button>
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
                  aria-label="Fermer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body (hidden when minimized) */}
            {!isMinimized && (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50 min-h-0" style={{ maxHeight: 380 }}>
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.role === "bot" && (
                        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mr-2 mt-0.5">
                          A
                        </div>
                      )}
                      <div className="flex flex-col max-w-[82%]">
                        <div
                          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                            msg.role === "user"
                              ? "bg-primary text-white rounded-br-sm"
                              : "bg-white text-slate-800 border border-slate-100 rounded-bl-sm shadow-sm"
                          }`}
                        >
                          {formatText(msg.text)}
                        </div>
                        {msg.link && (
                          <Link href={msg.link.href}>
                            <div className="mt-1.5 ml-1 text-xs font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1">
                              → {msg.link.label}
                            </div>
                          </Link>
                        )}
                        {msg.suggestions && msg.suggestions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2 ml-1">
                            {msg.suggestions.map((s) => (
                              <button
                                key={s}
                                onClick={() => handleSuggestion(s)}
                                className="text-xs px-3 py-1.5 rounded-full border border-primary/30 text-primary bg-white hover:bg-primary hover:text-white transition-all duration-200 font-medium shadow-sm"
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                        <span className="text-[10px] text-slate-400 mt-1 ml-1">{formatTime(msg.time)}</span>
                      </div>
                    </div>
                  ))}

                  {/* Typing indicator */}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mr-2 mt-0.5">
                        A
                      </div>
                      <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-sm px-4 py-3.5 shadow-sm">
                        <div className="flex items-center gap-1">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              className="w-2 h-2 bg-primary/50 rounded-full"
                              animate={{ y: [0, -5, 0] }}
                              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Booking progress indicator */}
                {bookingStep !== "idle" && bookingStep !== "done" && (
                  <div className="px-4 py-2 bg-primary/5 border-t border-primary/10 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="text-[11px] text-primary font-semibold">
                        {fr ? "Prise de rendez-vous" : "Booking appointment"}
                      </div>
                      <div className="flex gap-1 ml-auto">
                        {(["name", "email", "phone", "country", "company", "service", "date", "message"] as BookingStep[]).map(
                          (s, i) => {
                            const steps: BookingStep[] = ["name", "email", "phone", "country", "company", "service", "date", "message"];
                            const currentIdx = steps.indexOf(bookingStep);
                            return (
                              <div
                                key={s}
                                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                                  i < currentIdx ? "bg-primary" : i === currentIdx ? "bg-primary/60" : "bg-slate-200"
                                }`}
                              />
                            );
                          }
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Input */}
                <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-3 border-t border-slate-100 bg-white flex-shrink-0">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      bookingStep !== "idle" && bookingStep !== "done"
                        ? fr ? "Votre réponse…" : "Your answer…"
                        : fr ? "Posez votre question…" : "Ask your question…"
                    }
                    className="flex-1 text-sm px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 bg-slate-50 placeholder-slate-400 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isTyping}
                    className="p-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0 shadow-sm"
                  >
                    <Send size={16} />
                  </button>
                </form>

                {/* Footer branding */}
                <div className="px-4 py-1.5 bg-white border-t border-slate-50 text-center flex-shrink-0">
                  <span className="text-[10px] text-slate-300 font-medium">Gaméasù · Anne IA</span>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
