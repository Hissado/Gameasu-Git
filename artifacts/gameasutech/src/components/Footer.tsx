import React from "react";
import { Link } from "wouter";
import { useLanguage } from "@/context/LanguageContext";
import { Mail, Phone, MapPin, Globe } from "lucide-react";

export function Footer() {
  const { t, language } = useLanguage();
  const fr = language === "fr";

  return (
    <footer className="bg-slate-900 text-white">
      <div className="container mx-auto px-6 pt-16 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          <div className="lg:col-span-2">
            <div className="mb-5">
              <div className="bg-white rounded-xl px-4 py-3 inline-flex items-center">
                <img
                  src={`${import.meta.env.BASE_URL}gameasutech-mark.png`}
                  alt="Gaméasù"
                  style={{ height: "34px", width: "auto", display: "block" }}
                />
              </div>
            </div>
            <p className="text-primary font-semibold text-sm mb-3 tracking-wide italic">
              {fr ? "Innover, Transformer, Sécuriser" : "Innovate, Transform, Secure"}
            </p>
            <p className="text-slate-400 text-sm leading-relaxed mb-6 max-w-xs">
              {fr
                ? "Fondée aux États-Unis en 2023, Gaméasù accompagne les entreprises, institutions et organisations dans leur transformation numérique à l'échelle mondiale."
                : "Founded in the United States in 2023, Gaméasù supports businesses, institutions, and organizations in their digital transformation worldwide."}
            </p>
            <div className="space-y-3">
              <a href="mailto:info@gameasu.tech" className="flex items-center gap-3 text-sm text-slate-400 hover:text-white transition-colors">
                <Mail size={15} className="text-primary flex-shrink-0" />
                info@gameasu.tech
              </a>
              <a href="tel:+12036262309" className="flex items-center gap-3 text-sm text-slate-400 hover:text-white transition-colors">
                <Phone size={15} className="text-primary flex-shrink-0" />
                +1 (203) 626-2309
              </a>
              <div className="flex items-start gap-3 text-sm text-slate-400">
                <MapPin size={15} className="text-primary flex-shrink-0 mt-0.5" />
                <span>195 Church Street, New Haven, CT — USA</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-white mb-5 text-sm uppercase tracking-widest">{t.nav.services}</h4>
            <ul className="space-y-3">
              {[
                { href: "/services", label: "Modern Workplace" },
                { href: "/cloud-infrastructure", label: fr ? "Cloud & Infrastructure" : "Cloud & Infrastructure" },
                { href: "/cybersecurity", label: fr ? "Cybersécurité" : "Cybersecurity" },
                { href: "/ai-automation", label: fr ? "Intelligence Artificielle" : "AI & Automation" },
                { href: "/services", label: fr ? "Services Managés" : "Managed Services" },
              ].map((item) => (
                <li key={item.href + item.label}>
                  <Link href={item.href}>
                    <div className="text-sm text-slate-400 hover:text-white cursor-pointer transition-colors">{item.label}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-5 text-sm uppercase tracking-widest">{fr ? "Entreprise" : "Company"}</h4>
            <ul className="space-y-3">
              {[
                { href: "/about", label: t.nav.about },
                { href: "/industries", label: t.nav.industries },
                { href: "/case-studies", label: t.nav.caseStudies },
                { href: "/partners", label: t.nav.partners },
                { href: "/careers", label: t.nav.careers },
                { href: "/blog", label: t.nav.blog },
              ].map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>
                    <div className="text-sm text-slate-400 hover:text-white cursor-pointer transition-colors">{item.label}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-5 text-sm uppercase tracking-widest">
              <Globe size={14} className="inline mr-2 text-primary" />
              {fr ? "Présence" : "Offices"}
            </h4>
            <ul className="space-y-2.5">
              {[
                { code: "us", labelFr: "États-Unis", labelEn: "United States", hq: true },
                { code: "ca", labelFr: "Canada", labelEn: "Canada" },
                { code: "fr", labelFr: "France", labelEn: "France" },
                { code: "be", labelFr: "Belgique", labelEn: "Belgium" },
                { code: "tg", labelFr: "Togo", labelEn: "Togo" },
                { code: "ci", labelFr: "Côte d'Ivoire", labelEn: "Côte d'Ivoire" },
                { code: "ml", labelFr: "Mali", labelEn: "Mali" },
              ].map((p, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-slate-400">
                  <img
                    src={`https://flagcdn.com/20x15/${p.code}.png`}
                    srcSet={`https://flagcdn.com/40x30/${p.code}.png 2x`}
                    width={20} height={15}
                    alt={fr ? p.labelFr : p.labelEn}
                    className="flex-shrink-0 rounded-sm"
                  />
                  <span>{fr ? p.labelFr : p.labelEn}</span>
                  {p.hq && (
                    <span className="text-xs text-primary font-semibold">{fr ? "Siège" : "HQ"}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800">
        <div className="container mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} Gaméasù. {fr ? "Tous droits réservés." : "All rights reserved."}
            <span className="ml-3 text-slate-600 italic">
              {fr ? "Innover, Transformer, Sécuriser" : "Innovate, Transform, Secure"}
            </span>
          </p>
          <div className="flex items-center gap-6 text-xs text-slate-500">
            <span className="hover:text-slate-300 cursor-pointer transition-colors">{fr ? "Politique de confidentialité" : "Privacy Policy"}</span>
            <span className="hover:text-slate-300 cursor-pointer transition-colors">{fr ? "Conditions d'utilisation" : "Terms of Use"}</span>
            <Link href="/support">
              <span className="hover:text-slate-300 cursor-pointer transition-colors">{t.nav.support}</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
