import React from "react";
import { Link } from "wouter";
import { useLanguage } from "@/context/LanguageContext";
import { Mail, Phone, MapPin, Globe } from "lucide-react";

export function Footer() {
  const { t, language } = useLanguage();
  const fr = language === "fr";

  return (
    <footer className="bg-slate-900 text-white">
      {/* Main footer content */}
      <div className="container mx-auto px-6 pt-16 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="mb-6">
              <div className="bg-white rounded-xl p-3 inline-block">
                <img
                  src={`${import.meta.env.BASE_URL}gameasutech-logo.png`}
                  alt="Gaméasù Technology"
                  className="h-10 w-auto"
                  style={{ maxWidth: "180px" }}
                />
              </div>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-6 max-w-xs">
              {fr
                ? "Solutions IT globales pour les entreprises ambitieuses. Modernes, sécurisées, évolutives — de l'Afrique au monde."
                : "Global IT solutions for ambitious enterprises. Modern, secure, scalable — from Africa to the world."}
            </p>
            <div className="space-y-3">
              <a href="mailto:contact@gameasutech.com" className="flex items-center gap-3 text-sm text-slate-400 hover:text-white transition-colors">
                <Mail size={15} className="text-primary flex-shrink-0" />
                contact@gameasutech.com
              </a>
              <a href="tel:+15551234567" className="flex items-center gap-3 text-sm text-slate-400 hover:text-white transition-colors">
                <Phone size={15} className="text-primary flex-shrink-0" />
                +1 (555) 123-4567
              </a>
              <div className="flex items-start gap-3 text-sm text-slate-400">
                <MapPin size={15} className="text-primary flex-shrink-0 mt-0.5" />
                <span>New York, NY — United States (HQ)</span>
              </div>
            </div>
          </div>

          {/* Services */}
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

          {/* Company */}
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

          {/* Presence */}
          <div>
            <h4 className="font-bold text-white mb-5 text-sm uppercase tracking-widest">
              <Globe size={14} className="inline mr-2 text-primary" />
              {fr ? "Présence" : "Offices"}
            </h4>
            <ul className="space-y-2.5">
              {[
                { flag: "🇺🇸", city: "New York", role: "HQ" },
                { flag: "🇨🇦", city: "Montréal" },
                { flag: "🇫🇷", city: "Paris" },
                { flag: "🇧🇪", city: "Bruxelles" },
                { flag: "🇹🇬", city: "Lomé" },
                { flag: "🇨🇮", city: "Abidjan" },
                { flag: "🇲🇱", city: "Bamako" },
              ].map((p, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-slate-400">
                  <span>{p.flag}</span>
                  <span>{p.city}</span>
                  {p.role && (
                    <span className="text-xs text-primary font-semibold">{p.role}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-slate-800">
        <div className="container mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} Gaméasù Technology. {fr ? "Tous droits réservés." : "All rights reserved."}
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
