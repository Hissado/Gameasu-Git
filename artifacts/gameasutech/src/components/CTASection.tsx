import React from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";

export function CTASection({ title, subtitle, btnText, href }: { title: string; subtitle: string; btnText: string; href: string }) {
  return (
    <section className="py-24 bg-card relative overflow-hidden border-y border-border">
      <div className="absolute inset-0 bg-primary/5"></div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-full bg-[radial-gradient(ellipse_at_top,rgba(30,64,200,0.2)_0%,transparent_70%)] pointer-events-none"></div>
      
      <div className="container mx-auto px-6 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">{title}</h2>
          <p className="text-xl text-muted-foreground mb-10">{subtitle}</p>
          <Link href={href}>
            <div className="inline-flex items-center justify-center px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 cursor-pointer">
              {btnText}
            </div>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
