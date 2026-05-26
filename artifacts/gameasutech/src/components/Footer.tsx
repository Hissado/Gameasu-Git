import React from "react";
import { Link } from "wouter";
import { useLanguage } from "@/context/LanguageContext";
import { Mail, Phone, MapPin, Globe } from "lucide-react";

export function Footer() {
  const { t, language } = useLanguage();
  const fr = language === "fr";

  return (
    <footer className="bg-foreground text-white pt-20 pb-10 border-t border-slate-800">
      <div className="container mx-auto px-6 lg:px-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8 mb-20">
          <div className="lg:col-span-4 pr-4">
            <div className="mb-8">
              <Link href="/">
                <img
                  src={`${import.meta.env.BASE_URL}gameasutech-mark.png`}
                  alt="Gaméasù"
                  className="cursor-pointer h-10 w-auto"
                  style={{ filter: "brightness(0) invert(1)" }}
                />
              </Link>
            </div>
            <p className="text-primary font-bold text-xs mb-4 tracking-widest uppercase">
              {fr ? "Innover · Transformer · Sécuriser" : "Innovate · Transform · Secure"}
            </p>
            <p className="text-slate-400 text-sm leading-relaxed mb-8 font-medium max-w-sm">
              {fr
                ? "Fondée aux États-Unis en 2023, Gaméasù accompagne les entreprises, institutions et organisations dans leur transformation numérique à l'échelle mondiale."
                : "Founded in the United States in 2023, Gaméasù supports businesses, institutions, and organizations in their digital transformation worldwide."}
            </p>
            <div className="space-y-4">
              <a href="mailto:info@gameasu.tech" className="flex items-center gap-3 text-sm font-bold text-white hover:text-primary transition-colors">
                <Mail size={16} className="text-slate-500" />
                info@gameasu.tech
              </a>
              <a href="tel:+12036262309" className="flex items-center gap-3 text-sm font-bold text-white hover:text-primary transition-colors">
                <Phone size={16} className="text-slate-500" />
                +1 (203) 626-2309
              </a>
              <div className="flex items-start gap-3 text-sm text-slate-400 font-medium">
                <MapPin size={16} className="text-slate-500 mt-0.5 flex-shrink-0" />
                <span>195 Church Street<br/>New Haven, CT — USA</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 lg:col-start-6">
            <h4 className="font-bold text-white mb-6 text-xs uppercase tracking-widest">{t.nav.services}</h4>
            <ul className="space-y-4">
              {[
                { href: "/services", label: fr ? "Modern Workplace" : "Modern Workplace" },
                { href: "/cloud-infrastructure", label: fr ? "Cloud & Infrastructure" : "Cloud & Infrastructure" },
                { href: "/cybersecurity", label: fr ? "Cybersécurité" : "Cybersecurity" },
                { href: "/ai-automation", label: fr ? "Intelligence Artificielle" : "AI & Automation" },
                { href: "/support", label: fr ? "Services Managés" : "Managed Services" },
              ].map((item) => (
                <li key={item.href + item.label}>
                  <Link href={item.href}>
                    <div className="group flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white cursor-pointer transition-colors">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-700 group-hover:bg-primary transition-colors" />
                      {item.label}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h4 className="font-bold text-white mb-6 text-xs uppercase tracking-widest">{fr ? "Entreprise" : "Company"}</h4>
            <ul className="space-y-4">
              {[
                { href: "/about", label: fr ? "À propos" : "About" },
                { href: "/industries", label: fr ? "Secteurs" : "Industries" },
                { href: "/case-studies", label: fr ? "Réalisations" : "Case Studies" },
                { href: "/partners", label: fr ? "Partenaires" : "Partners" },
                { href: "/careers", label: fr ? "Carrières" : "Careers" },
                { href: "/blog", label: fr ? "Ressources" : "Resources" },
                { href: "/faq", label: fr ? "FAQ" : "FAQ" },
              ].map((item) => (
                <li key={item.href + item.label}>
                  <Link href={item.href}>
                    <div className="group flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white cursor-pointer transition-colors">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-700 group-hover:bg-primary transition-colors" />
                      {item.label}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3">
            <h4 className="font-bold text-white mb-6 text-xs uppercase tracking-widest flex items-center gap-2">
              <Globe size={14} className="text-slate-500" />
              {fr ? "Présence Globale" : "Global Offices"}
            </h4>
            <div className="grid grid-cols-2 gap-4">
              {[
                { code: "us", labelFr: "États-Unis", labelEn: "United States", hq: true },
                { code: "ca", labelFr: "Canada", labelEn: "Canada" },
                { code: "fr", labelFr: "France", labelEn: "France" },
                { code: "be", labelFr: "Belgique", labelEn: "Belgium" },
                { code: "tg", labelFr: "Togo", labelEn: "Togo" },
                { code: "ci", labelFr: "Côte d'Ivoire", labelEn: "Côte d'Ivoire" },
                { code: "ml", labelFr: "Mali", labelEn: "Mali" },
              ].map((p, i) => (
                <div key={i} className="flex items-center gap-3 bg-slate-800/30 p-2 rounded-lg border border-slate-800">
                  <img
                    src={`https://flagcdn.com/w40/${p.code}.png`}
                    srcSet={`https://flagcdn.com/w80/${p.code}.png 2x`}
                    width={20}
                    alt={fr ? p.labelFr : p.labelEn}
                    className="flex-shrink-0 rounded-[2px]"
                  />
                  <div>
                    <div className="text-[11px] font-bold text-white leading-none">{fr ? p.labelFr : p.labelEn}</div>
                    {p.hq && <div className="text-[9px] text-accent font-bold mt-1 uppercase tracking-wider">{fr ? "Siège" : "HQ"}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-8 border-t border-slate-800 text-xs font-medium text-slate-500">
          <p>
            © {new Date().getFullYear()} Gaméasù. {fr ? "Tous droits réservés." : "All rights reserved."}
          </p>
          <div className="flex items-center gap-8">
            <Link href="/privacy">
              <span className="hover:text-white cursor-pointer transition-colors">{fr ? "Confidentialité" : "Privacy"}</span>
            </Link>
            <span className="hover:text-white cursor-pointer transition-colors">{fr ? "Conditions" : "Terms"}</span>
            <Link href="/support">
              <span className="hover:text-white cursor-pointer transition-colors">{t.nav.support}</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
