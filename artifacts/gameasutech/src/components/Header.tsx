import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useLanguage } from "@/context/LanguageContext";
import { Menu, X, ChevronDown } from "lucide-react";

export function Header() {
  const { language, setLanguage, t } = useLanguage();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${isScrolled ? "bg-background/95 backdrop-blur-md border-b border-border py-4" : "bg-transparent py-6"}`}>
      <div className="container mx-auto px-6 flex items-center justify-between">
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer">
            <img src={`${import.meta.env.BASE_URL}gameasutech-logo.png`} alt="Gameasu Technology" className="h-8" />
            <span className="font-sans font-bold text-xl tracking-tight text-white">Gameasu</span>
          </div>
        </Link>
        
        <nav className="hidden lg:flex items-center gap-8">
          <Link href="/about"><div className={`text-sm font-medium hover:text-primary transition-colors cursor-pointer ${location === '/about' ? 'text-primary' : 'text-foreground'}`}>{t.nav.about}</div></Link>
          <Link href="/services"><div className={`text-sm font-medium hover:text-primary transition-colors cursor-pointer ${location.startsWith('/services') ? 'text-primary' : 'text-foreground'}`}>{t.nav.services}</div></Link>
          <Link href="/industries"><div className={`text-sm font-medium hover:text-primary transition-colors cursor-pointer ${location === '/industries' ? 'text-primary' : 'text-foreground'}`}>{t.nav.industries}</div></Link>
          <Link href="/contact"><div className={`text-sm font-medium hover:text-primary transition-colors cursor-pointer ${location === '/contact' ? 'text-primary' : 'text-foreground'}`}>{t.nav.contact}</div></Link>
          
          <div className="flex items-center gap-2 ml-4 border-l border-border pl-4">
            <button 
              onClick={() => setLanguage('fr')} 
              className={`text-xs font-bold ${language === 'fr' ? 'text-primary' : 'text-muted-foreground'}`}
            >
              FR
            </button>
            <span className="text-muted-foreground text-xs">|</span>
            <button 
              onClick={() => setLanguage('en')} 
              className={`text-xs font-bold ${language === 'en' ? 'text-primary' : 'text-muted-foreground'}`}
            >
              EN
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
}
