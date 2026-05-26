import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useLanguage } from "@/context/LanguageContext";
import { Menu, X, ChevronDown, Shield, Cloud, Brain, Monitor, Wrench, ChevronRight } from "lucide-react";

const serviceSubLinks = [
  { href: "/cybersecurity", icon: Shield, labelFr: "Cybersécurité", labelEn: "Cybersecurity", descFr: "SOC 24/7, audit, protection des menaces", descEn: "24/7 SOC, audit, threat protection" },
  { href: "/cloud-infrastructure", icon: Cloud, labelFr: "Cloud & Infrastructure", labelEn: "Cloud & Infrastructure", descFr: "Migration cloud, réseau, SD-WAN", descEn: "Cloud migration, network, SD-WAN" },
  { href: "/ai-automation", icon: Brain, labelFr: "Intelligence Artificielle", labelEn: "Artificial Intelligence", descFr: "Automatisation, RPA, analytique prédictive", descEn: "Automation, RPA, predictive analytics" },
  { href: "/services", icon: Monitor, labelFr: "Modern Workplace", labelEn: "Modern Workplace", descFr: "Microsoft 365, Teams, collaboration", descEn: "Microsoft 365, Teams, collaboration" },
  { href: "/support", icon: Wrench, labelFr: "Services Managés (MSP)", labelEn: "Managed Services (MSP)", descFr: "Helpdesk, supervision, maintenance", descEn: "Helpdesk, monitoring, maintenance" },
];

export function Header() {
  const { language, setLanguage, t } = useLanguage();
  const fr = language === "fr";
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
  const [servicesDropdownOpen, setServicesDropdownOpen] = useState(false);
  const [location] = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 16);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setMobileServicesOpen(false);
    setServicesDropdownOpen(false);
  }, [location]);

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  const isServicesActive =
    isActive("/services") ||
    isActive("/cybersecurity") ||
    isActive("/cloud-infrastructure") ||
    isActive("/ai-automation") ||
    isActive("/support");

  const handleServicesMouseEnter = () => {
    if (dropdownTimer.current) clearTimeout(dropdownTimer.current);
    setServicesDropdownOpen(true);
  };

  const handleServicesMouseLeave = () => {
    dropdownTimer.current = setTimeout(() => setServicesDropdownOpen(false), 120);
  };

  const navLinks = [
    { href: "/about", label: t.nav.about },
    { href: "/industries", label: t.nav.industries },
    { href: "/case-studies", label: t.nav.caseStudies },
    { href: "/blog", label: t.nav.blog },
  ];

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-white/95 backdrop-blur-md shadow-[0_1px_20px_rgba(0,0,0,0.08)] py-3"
          : "bg-white/80 backdrop-blur-sm py-4 border-b border-slate-200/60"
      }`}
    >
      <div className="container mx-auto px-6 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link href="/">
          <div className="cursor-pointer flex-shrink-0">
            <img
              src={`${import.meta.env.BASE_URL}gameasutech-mark.png`}
              alt="Gaméasù"
              className="h-9 w-auto"
              style={{ maxWidth: "160px" }}
            />
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
          <Link href="/">
            <div className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 ${
              location === "/" ? "text-primary bg-primary/8 font-semibold" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}>
              {t.nav.home}
            </div>
          </Link>

          <Link href="/about">
            <div className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 ${
              isActive("/about") ? "text-primary bg-primary/8 font-semibold" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}>
              {t.nav.about}
            </div>
          </Link>

          {/* Services with dropdown */}
          <div
            ref={dropdownRef}
            className="relative"
            onMouseEnter={handleServicesMouseEnter}
            onMouseLeave={handleServicesMouseLeave}
          >
            <Link href="/services">
              <div className={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 ${
                isServicesActive ? "text-primary bg-primary/8 font-semibold" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}>
                {t.nav.services}
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${servicesDropdownOpen ? "rotate-180" : ""}`}
                />
              </div>
            </Link>

            {servicesDropdownOpen && (
              <div
                className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 py-2"
                onMouseEnter={handleServicesMouseEnter}
                onMouseLeave={handleServicesMouseLeave}
              >
                {serviceSubLinks.map((sl) => (
                  <Link key={sl.href + sl.labelFr} href={sl.href}>
                    <div className="group flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer">
                      <div className="p-1.5 rounded-lg bg-primary/8 text-primary group-hover:bg-primary group-hover:text-white transition-colors flex-shrink-0 mt-0.5">
                        <sl.icon size={15} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 text-sm group-hover:text-primary transition-colors">
                          {fr ? sl.labelFr : sl.labelEn}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 truncate">
                          {fr ? sl.descFr : sl.descEn}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
                <div className="px-5 pt-2 pb-3 border-t border-slate-100 mt-1">
                  <Link href="/services">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:gap-2.5 transition-all cursor-pointer">
                      {fr ? "Voir tous les services" : "See all services"}
                      <ChevronRight size={12} />
                    </div>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {navLinks.slice(1).map((link) => (
            <Link key={link.href} href={link.href}>
              <div className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 ${
                isActive(link.href) ? "text-primary bg-primary/8 font-semibold" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}>
                {link.label}
              </div>
            </Link>
          ))}
        </nav>

        {/* Right: lang + CTA */}
        <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setLanguage("fr")}
              className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                language === "fr" ? "bg-primary text-white" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              FR
            </button>
            <button
              onClick={() => setLanguage("en")}
              className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                language === "en" ? "bg-primary text-white" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              EN
            </button>
          </div>
          <Link href="/contact">
            <div className="inline-flex items-center px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors cursor-pointer shadow-sm">
              {t.nav.contact}
            </div>
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Menu"
        >
          {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 w-full bg-white border-b border-slate-200 shadow-lg pb-4 px-4">
          <nav className="flex flex-col">
            <Link href="/">
              <div className={`px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                location === "/" ? "text-primary bg-primary/8 font-semibold" : "text-slate-700 hover:bg-slate-50"
              }`}>
                {t.nav.home}
              </div>
            </Link>

            <Link href="/about">
              <div className={`px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                isActive("/about") ? "text-primary bg-primary/8 font-semibold" : "text-slate-700 hover:bg-slate-50"
              }`}>
                {t.nav.about}
              </div>
            </Link>

            {/* Services with mobile sub-links */}
            <div>
              <button
                onClick={() => setMobileServicesOpen(!mobileServicesOpen)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors text-left ${
                  isServicesActive ? "text-primary bg-primary/8 font-semibold" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {t.nav.services}
                <ChevronDown size={14} className={`transition-transform duration-200 ${mobileServicesOpen ? "rotate-180" : ""}`} />
              </button>
              {mobileServicesOpen && (
                <div className="ml-3 mt-1 mb-1 border-l-2 border-primary/20 pl-3 space-y-0.5">
                  {serviceSubLinks.map((sl) => (
                    <Link key={sl.href + sl.labelFr} href={sl.href}>
                      <div className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-slate-600 hover:text-primary hover:bg-slate-50 cursor-pointer transition-colors">
                        <sl.icon size={14} className="text-primary flex-shrink-0" />
                        {fr ? sl.labelFr : sl.labelEn}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link href="/industries">
              <div className={`px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                isActive("/industries") ? "text-primary bg-primary/8 font-semibold" : "text-slate-700 hover:bg-slate-50"
              }`}>
                {t.nav.industries}
              </div>
            </Link>
            <Link href="/case-studies">
              <div className={`px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                isActive("/case-studies") ? "text-primary bg-primary/8 font-semibold" : "text-slate-700 hover:bg-slate-50"
              }`}>
                {t.nav.caseStudies}
              </div>
            </Link>
            <Link href="/blog">
              <div className={`px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                isActive("/blog") ? "text-primary bg-primary/8 font-semibold" : "text-slate-700 hover:bg-slate-50"
              }`}>
                {t.nav.blog}
              </div>
            </Link>
          </nav>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
            <Link href="/contact">
              <div className="inline-flex items-center px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg cursor-pointer">
                {t.nav.contact}
              </div>
            </Link>
            <div className="flex items-center gap-1 border border-slate-200 rounded-lg overflow-hidden">
              {(["fr", "en"] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                    language === lang ? "bg-primary text-white" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
