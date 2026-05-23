import React from "react";
import { useLanguage } from "@/context/LanguageContext";
import { CTASection } from "@/components/CTASection";

export default function About() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="container mx-auto px-6">
        <h1 className="text-4xl font-bold mb-8">{t.about.title}</h1>
        <p className="text-xl text-muted-foreground max-w-3xl mb-12">{t.about.subtitle}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-24">
          <div className="bg-card p-8 rounded-xl border border-border">
            <h2 className="text-2xl font-bold mb-4">Notre Mission</h2>
            <p className="text-muted-foreground">Accompagner les entreprises dans leur évolution technologique avec rigueur et innovation.</p>
          </div>
          <div className="bg-card p-8 rounded-xl border border-border">
            <h2 className="text-2xl font-bold mb-4">Notre Vision</h2>
            <p className="text-muted-foreground">Devenir le partenaire technologique de référence en Afrique et à l'international.</p>
          </div>
        </div>
      </div>
      
      <CTASection 
        title={t.contact.title} 
        subtitle={t.contact.subtitle} 
        btnText={t.hero.cta} 
        href="/contact" 
      />
    </div>
  );
}
