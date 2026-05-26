import React from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useLanguage } from "@/context/LanguageContext";
import { ArrowUpRight } from "lucide-react";

export function ServiceCard({
  title,
  desc,
  icon: Icon,
  href,
  index = 0,
}: {
  title: string;
  desc: string;
  icon: any;
  href: string;
  index?: number;
}) {
  const { t } = useLanguage();
  return (
    <motion.div
      initial={{ y: 20 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
    >
      <Link href={href}>
        <div className="group h-full bg-white border border-slate-200 rounded-xl p-8 transition-all duration-300 hover:border-primary/40 hover:shadow-[0_4px_30px_rgba(37,99,235,0.12)] cursor-pointer relative overflow-hidden">
          {/* Hover background accent */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 to-blue-50/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="relative z-10">
            <div className="mb-6 inline-flex p-4 rounded-xl bg-primary/8 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300 shadow-sm">
              <Icon size={28} />
            </div>
            <h3 className="text-xl font-bold mb-3 text-slate-900">{title}</h3>
            <p className="text-slate-500 mb-8 leading-relaxed text-sm">{desc}</p>
            <div className="mt-auto flex items-center text-primary font-semibold text-sm gap-1 group-hover:gap-2 transition-all">
              {t.common.learnMore}
              <ArrowUpRight size={15} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
