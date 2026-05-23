import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useLanguage } from "@/context/LanguageContext";
import { Menu, X } from "lucide-react";

export function Header() {
  const { language, setLanguage, t } = useLanguage();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 16);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const navLinks = [
    { href: "/about", label: t.nav.about },
    { href: "/services", label: t.nav.services },
    { href: "/industries", label: t.nav.industries },
    { href: "/case-studies", label: t.nav.caseStudies },
    { href: "/blog", label: t.nav.blog },
  ];

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-white/95 backdrop-blur-md shadow-[0_1px_20px_rgba(0,0,0,0.08)] py-3"
          : "bg-white/80 backdrop-blur-sm py-4 border-b border-slate-200/60"
      }`}
    >
      <div className="container mx-auto px-6 flex items-center justify-between gap-6">
        {/* Logo — icône seule, wordmark masqué */}
        <Link href="/">
          <div className="cursor-pointer flex-shrink-0">
            <img
              src={`${import.meta.env.BASE_URL}gameasutech-mark.png`}
              alt="Gaméasù"
              className="h-9 w-auto"
              style={{ maxWidth: "180px" }}
            />
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <div
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                  isActive(link.href)
                    ? "text-primary bg-primary/8 font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
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
                language === "fr"
                  ? "bg-primary text-white"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              FR
            </button>
            <button
              onClick={() => setLanguage("en")}
              className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                language === "en"
                  ? "bg-primary text-white"
                  : "text-slate-500 hover:text-slate-900"
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
        <div className="lg:hidden absolute top-full left-0 w-full bg-white border-b border-slate-200 shadow-lg py-4 px-6">
          <nav className="flex flex-col gap-1 mb-4">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <div
                  className={`px-4 py-3 rounded-lg text-sm font-medium cursor-pointer ${
                    isActive(link.href)
                      ? "text-primary bg-primary/8 font-semibold"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {link.label}
                </div>
              </Link>
            ))}
            <Link href="/contact">
              <div className="px-4 py-3 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
                {t.nav.contact}
              </div>
            </Link>
          </nav>
          <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-500 font-medium mr-2">Langue :</span>
            {(["fr", "en"] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                  language === lang
                    ? "bg-primary text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
