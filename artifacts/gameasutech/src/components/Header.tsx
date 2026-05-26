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
    { href: "/solutions", label: t.nav.solutions },
    { href: "/industries", label: t.nav.industries },
    { href: "/case-studies", label: t.nav.caseStudies },
    { href: "/blog", label: t.nav.blog },
  ];

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${
        isScrolled
          ? "bg-white/95 backdrop-blur-lg shadow-[0_4px_30px_rgba(0,0,0,0.06)] py-4"
          : "bg-white/90 backdrop-blur-md py-6 border-b border-slate-200/50"
      }`}
    >
      <div className="container mx-auto px-6 lg:px-10 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link href="/">
          <div className="cursor-pointer flex-shrink-0 flex items-center group">
            <img
              src={`${import.meta.env.BASE_URL}gameasutech-mark.png`}
              alt="Gaméasù"
              className="h-10 w-auto transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-2 flex-1 justify-center">
          <Link href="/">
            <div className={`px-5 py-2.5 rounded-full text-sm font-semibold cursor-pointer transition-all duration-300 tracking-wide ${
              location === "/" ? "text-primary bg-primary/5" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
            }`}>
              {t.nav.home}
            </div>
          </Link>

          <Link href="/about">
            <div className={`px-5 py-2.5 rounded-full text-sm font-semibold cursor-pointer transition-all duration-300 tracking-wide ${
              isActive("/about") ? "text-primary bg-primary/5" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
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
              <div className={`flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-semibold cursor-pointer transition-all duration-300 tracking-wide ${
                isServicesActive ? "text-primary bg-primary/5" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
              }`}>
                {t.nav.services}
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-300 ${servicesDropdownOpen ? "rotate-180 text-primary" : "text-slate-400"}`}
                />
              </div>
            </Link>

            {/* Premium Dropdown */}
            {servicesDropdownOpen && (
              <div
                className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-[400px] bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden z-50 p-3 transform transition-all"
                onMouseEnter={handleServicesMouseEnter}
                onMouseLeave={handleServicesMouseLeave}
              >
                <div className="grid gap-1.5">
                  {serviceSubLinks.map((sl) => (
                    <Link key={sl.href + sl.labelFr} href={sl.href}>
                      <div className="group flex items-start gap-4 p-4 rounded-xl hover:bg-slate-50 transition-all duration-300 cursor-pointer">
                        <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600 group-hover:bg-primary group-hover:text-white transition-colors duration-300 flex-shrink-0">
                          <sl.icon size={18} strokeWidth={1.5} />
                        </div>
                        <div className="min-w-0 pt-0.5">
                          <div className="font-bold text-slate-900 text-sm group-hover:text-primary transition-colors duration-300">
                            {fr ? sl.labelFr : sl.labelEn}
                          </div>
                          <div className="text-sm text-slate-500 mt-1 truncate">
                            {fr ? sl.descFr : sl.descEn}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="px-4 pt-4 pb-2 mt-2 border-t border-slate-100">
                  <Link href="/services">
                    <div className="flex items-center justify-between text-sm font-bold text-primary group cursor-pointer">
                      {fr ? "Explorer tous les services" : "Explore all services"}
                      <div className="p-1 rounded-full bg-primary/10 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                        <ChevronRight size={14} />
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {navLinks.slice(1).map((link) => (
            <Link key={link.href} href={link.href}>
              <div className={`px-5 py-2.5 rounded-full text-sm font-semibold cursor-pointer transition-all duration-300 tracking-wide ${
                isActive(link.href) ? "text-primary bg-primary/5" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
              }`}>
                {link.label}
              </div>
            </Link>
          ))}
        </nav>

        {/* Right: lang + CTA */}
        <div className="hidden lg:flex items-center gap-4 flex-shrink-0">
          <div className="flex items-center bg-slate-100/80 rounded-full p-1 border border-slate-200/50 shadow-inner">
            <button
              onClick={() => setLanguage("fr")}
              className={`px-3 py-1.5 text-[11px] font-bold tracking-wider rounded-full transition-all duration-300 ${
                language === "fr" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              FR
            </button>
            <button
              onClick={() => setLanguage("en")}
              className={`px-3 py-1.5 text-[11px] font-bold tracking-wider rounded-full transition-all duration-300 ${
                language === "en" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              EN
            </button>
          </div>
          <Link href="/contact">
            <div className="inline-flex items-center px-6 py-2.5 bg-foreground text-white text-sm font-bold tracking-wide rounded-full hover:bg-primary transition-all duration-300 cursor-pointer shadow-[0_4px_14px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.3)] hover:-translate-y-0.5">
              {t.nav.contact}
            </div>
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="lg:hidden p-2.5 rounded-full text-slate-900 hover:bg-slate-100 transition-colors"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Menu"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 w-full bg-white border-b border-slate-200 shadow-2xl pb-6 px-6">
          <nav className="flex flex-col space-y-1 mt-4">
            <Link href="/">
              <div className={`px-4 py-3.5 rounded-xl text-base font-bold cursor-pointer transition-colors ${
                location === "/" ? "text-primary bg-primary/5" : "text-slate-700 hover:bg-slate-50"
              }`}>
                {t.nav.home}
              </div>
            </Link>

            <Link href="/about">
              <div className={`px-4 py-3.5 rounded-xl text-base font-bold cursor-pointer transition-colors ${
                isActive("/about") ? "text-primary bg-primary/5" : "text-slate-700 hover:bg-slate-50"
              }`}>
                {t.nav.about}
              </div>
            </Link>

            {/* Services with mobile sub-links */}
            <div>
              <button
                onClick={() => setMobileServicesOpen(!mobileServicesOpen)}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-base font-bold cursor-pointer transition-colors text-left ${
                  isServicesActive ? "text-primary bg-primary/5" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {t.nav.services}
                <ChevronDown size={18} className={`transition-transform duration-300 ${mobileServicesOpen ? "rotate-180" : ""}`} />
              </button>
              {mobileServicesOpen && (
                <div className="mx-4 mt-2 mb-3 border-l-2 border-primary/20 pl-4 space-y-2">
                  {serviceSubLinks.map((sl) => (
                    <Link key={sl.href + sl.labelFr} href={sl.href}>
                      <div className="flex items-center gap-3 py-2.5 text-sm font-semibold text-slate-600 hover:text-primary cursor-pointer transition-colors">
                        <sl.icon size={16} className="text-primary flex-shrink-0" />
                        {fr ? sl.labelFr : sl.labelEn}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {navLinks.slice(1).map((link) => (
               <Link key={link.href} href={link.href}>
                 <div className={`px-4 py-3.5 rounded-xl text-base font-bold cursor-pointer transition-colors ${
                   isActive(link.href) ? "text-primary bg-primary/5" : "text-slate-700 hover:bg-slate-50"
                 }`}>
                   {link.label}
                 </div>
               </Link>
            ))}
          </nav>

          <div className="flex flex-col gap-5 mt-8 pt-6 border-t border-slate-100">
            <div className="flex items-center bg-slate-100 rounded-xl p-1 self-start">
              {(["fr", "en"] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`px-6 py-2.5 text-xs font-bold tracking-wider rounded-lg transition-all ${
                    language === lang ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
            <Link href="/contact">
              <div className="w-full text-center px-6 py-4 bg-foreground text-white text-base font-bold rounded-xl cursor-pointer hover:bg-primary transition-colors">
                {t.nav.contact}
              </div>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
