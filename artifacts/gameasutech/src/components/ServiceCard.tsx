import React from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useLanguage } from "@/context/LanguageContext";
import { ArrowRight } from "lucide-react";

export function ServiceCard({ title, desc, icon: Icon, href, index = 0 }: { title: string; desc: string; icon: any; href: string; index?: number }) {
  const { t } = useLanguage();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
    >
      <Link href={href}>
        <div className="group h-full bg-card border border-border rounded-xl p-8 transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_30px_-5px_rgba(30,64,200,0.3)] cursor-pointer relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-10 transition-opacity duration-500">
            <Icon size={120} className="text-primary" />
          </div>
          <div className="mb-6 inline-flex p-4 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300 relative z-10">
            <Icon size={32} />
          </div>
          <h3 className="text-xl font-bold mb-4 text-foreground relative z-10">{title}</h3>
          <p className="text-muted-foreground mb-8 relative z-10 leading-relaxed">{desc}</p>
          <div className="mt-auto flex items-center text-primary font-medium text-sm relative z-10">
            {t.common.learnMore}
            <ArrowRight size={16} className="ml-2 group-hover:translate-x-2 transition-transform" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
