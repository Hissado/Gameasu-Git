import React from "react";
import { useLanguage } from "@/context/LanguageContext";
import { ServiceCard } from "@/components/ServiceCard";
import { CTASection } from "@/components/CTASection";
import { Monitor, Cloud, Zap, Shield, Lock, Brain, Wrench, Briefcase, Database } from "lucide-react";

export default function Services() {
  const { t } = useLanguage();
  
  const services = [
    { key: "s1", icon: Monitor, href: "/services" },
    { key: "s2", icon: Cloud, href: "/cloud-infrastructure" },
    { key: "s3", icon: Zap, href: "/services" },
    { key: "s4", icon: Shield, href: "/cybersecurity" },
    { key: "s5", icon: Lock, href: "/services" },
    { key: "s6", icon: Brain, href: "/ai-automation" },
    { key: "s7", icon: Wrench, href: "/services" },
    { key: "s8", icon: Briefcase, href: "/services" },
    { key: "s9", icon: Database, href: "/services" },
  ];

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="container mx-auto px-6 mb-24">
        <h1 className="text-4xl font-bold mb-4">{t.services.title}</h1>
        <p className="text-xl text-muted-foreground mb-12">{t.services.subtitle}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((s, i) => (
            <ServiceCard 
              key={s.key}
              title={(t.services as any)[s.key].title}
              desc={(t.services as any)[s.key].desc}
              icon={s.icon}
              href={s.href}
              index={i}
            />
          ))}
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
