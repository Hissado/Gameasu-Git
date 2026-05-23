import React from "react";
import { Link } from "wouter";
import { useLanguage } from "@/context/LanguageContext";

export function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="bg-card border-t border-border pt-16 pb-8">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <img src={`${import.meta.env.BASE_URL}gameasutech-logo.png`} alt="Gameasu Technology" className="h-8" />
              <span className="font-bold text-xl">Gameasu</span>
            </div>
            <p className="text-muted-foreground text-sm">
              Global IT solutions for ambitious enterprises. Modern, secure, scalable.
            </p>
          </div>
          <div>
            <h4 className="font-bold mb-6">Company</h4>
            <ul className="space-y-3">
              <li><Link href="/about"><div className="text-sm text-muted-foreground hover:text-primary cursor-pointer">{t.nav.about}</div></Link></li>
              <li><Link href="/careers"><div className="text-sm text-muted-foreground hover:text-primary cursor-pointer">{t.nav.careers}</div></Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Gameasu Technology. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
