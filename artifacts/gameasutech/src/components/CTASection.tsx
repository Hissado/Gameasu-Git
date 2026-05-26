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
    <section className="relative overflow-hidden bg-foreground py-32">
      {/* Premium minimal background texture */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.1)_0%,transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(37,99,235,0.1)_0%,transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.02]"
        style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "4rem 4rem" }} />

      <div className="container mx-auto px-6 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-4xl mx-auto"
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6 text-white leading-tight tracking-tight">
            {title}
          </h2>
          <p className="text-xl md:text-2xl text-slate-400 mb-12 leading-relaxed font-medium max-w-2xl mx-auto">
            {subtitle}
          </p>
          <Link href={href}>
            <div className="group inline-flex items-center gap-4 px-10 py-5 bg-primary text-white font-bold tracking-wide rounded-full hover:bg-blue-600 transition-all duration-500 shadow-[0_8px_30px_rgba(37,99,235,0.2)] hover:shadow-[0_8px_40px_rgba(37,99,235,0.4)] hover:-translate-y-1 cursor-pointer">
              {btnText}
              <ArrowRight size={20} className="group-hover:translate-x-1.5 transition-transform" />
            </div>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
