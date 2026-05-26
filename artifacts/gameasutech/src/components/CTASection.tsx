import React from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

export function CTASection({
  title,
  subtitle,
  btnText,
  href,
}: {
  title: string;
  subtitle: string;
  btnText: string;
  href: string;
}) {
  return (
    <section className="relative overflow-hidden bg-slate-900 py-24">
      {/* Subtle blue glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_-10%,rgba(37,99,235,0.25)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "50px 50px" }} />

      <div className="container mx-auto px-6 relative z-10 text-center">
        <motion.div
          initial={{ y: 20 }}
          whileInView={{ y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-5 text-white leading-tight">
            {title}
          </h2>
          <p className="text-lg text-slate-400 mb-10 leading-relaxed">{subtitle}</p>
          <Link href={href}>
            <div className="group inline-flex items-center gap-3 px-8 py-4 bg-primary text-white font-semibold rounded-xl hover:bg-blue-500 transition-all duration-300 shadow-[0_0_40px_-8px_rgba(37,99,235,0.8)] hover:shadow-[0_0_50px_-6px_rgba(37,99,235,1)] cursor-pointer">
              {btnText}
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
