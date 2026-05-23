import React from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { Link } from "wouter";
import { ArrowRight, ChevronRight, Shield, Cloud, Brain, Briefcase, Database, Monitor } from "lucide-react";
import { ServiceCard } from "@/components/ServiceCard";
import { CTASection } from "@/components/CTASection";

export default function Home() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center pt-20 overflow-hidden">
        {/* Abstract dark tech background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(30,64,200,0.15)_0%,transparent_50%)] pointer-events-none"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8"
            >
              <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
              Global IT Solutions Provider
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 leading-tight"
            >
              {t.hero.title}
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl leading-relaxed"
            >
              {t.hero.subtitle}
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap gap-4"
            >
              <Link href="/contact">
                <div className="inline-flex items-center px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_-5px_rgba(30,64,200,0.5)] cursor-pointer">
                  {t.hero.cta}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </div>
              </Link>
              <Link href="/services">
                <div className="inline-flex items-center px-8 py-4 bg-secondary text-secondary-foreground font-semibold rounded-lg border border-border hover:bg-secondary/80 transition-all cursor-pointer">
                  {t.nav.services}
                </div>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Services Preview */}
      <section className="py-24 bg-card border-y border-border relative">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">{t.services.title}</h2>
              <p className="text-muted-foreground text-lg">{t.services.subtitle}</p>
            </div>
            <Link href="/services">
              <div className="inline-flex items-center text-primary font-medium hover:underline cursor-pointer">
                {t.common.readMore} <ChevronRight className="ml-1 h-4 w-4" />
              </div>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ServiceCard 
              title={t.services.s4.title} 
              desc={t.services.s4.desc} 
              icon={Shield} 
              href="/cybersecurity" 
              index={0}
            />
            <ServiceCard 
              title={t.services.s2.title} 
              desc={t.services.s2.desc} 
              icon={Cloud} 
              href="/cloud-infrastructure" 
              index={1}
            />
            <ServiceCard 
              title={t.services.s6.title} 
              desc={t.services.s6.desc} 
              icon={Brain} 
              href="/ai-automation" 
              index={2}
            />
          </div>
        </div>
      </section>
      
      {/* Global Presence */}
      <section className="py-24 relative overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Présence Internationale</h2>
            <p className="text-muted-foreground text-lg">Des bureaux stratégiques pour un accompagnement de proximité, où que vous soyez.</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {['🇺🇸 USA (HQ)', '🇨🇦 Canada', '🇫🇷 France', '🇧🇪 Belgium', '🇹🇬 Togo', '🇨🇮 Côte d\'Ivoire'].map((loc, i) => (
              <div key={i} className="bg-card border border-border p-6 rounded-xl text-center hover:border-primary/50 transition-colors">
                <div className="text-3xl mb-3">{loc.split(' ')[0]}</div>
                <div className="font-semibold">{loc.split(' ').slice(1).join(' ')}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTASection 
        title={t.contact.title} 
        subtitle={t.contact.subtitle} 
        btnText={t.hero.cta} 
        href="/contact" 
      />
    </div>
  );
}
