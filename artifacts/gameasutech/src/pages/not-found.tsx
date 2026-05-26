import React from "react";
import { Link } from "wouter";
import { useLanguage } from "@/context/LanguageContext";
import { motion } from "framer-motion";
import { Home, ArrowLeft, Search } from "lucide-react";

export default function NotFound() {
  const { language } = useLanguage();
  const fr = language === "fr";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-white flex items-center justify-center px-6 pt-20">
      <motion.div
        initial={{ y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="text-center max-w-lg"
      >
        <div className="relative inline-block mb-8">
          <span className="text-[120px] font-bold text-slate-100 leading-none select-none">404</span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="p-4 rounded-2xl bg-primary/10 text-primary">
              <Search size={36} />
            </div>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-slate-900 mb-4">
          {fr ? "Page introuvable" : "Page not found"}
        </h1>
        <p className="text-slate-500 leading-relaxed mb-10">
          {fr
            ? "La page que vous recherchez n'existe pas ou a été déplacée. Revenez à l'accueil ou explorez nos services."
            : "The page you're looking for doesn't exist or has been moved. Go back home or explore our services."}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors cursor-pointer shadow-sm">
              <Home size={16} />
              {fr ? "Retour à l'accueil" : "Back to home"}
            </div>
          </Link>
          <Link href="/contact">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer">
              <ArrowLeft size={16} />
              {fr ? "Nous contacter" : "Contact us"}
            </div>
          </Link>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200">
          <p className="text-xs text-slate-400 mb-4">{fr ? "Pages populaires" : "Popular pages"}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              { href: "/services", labelFr: "Services", labelEn: "Services" },
              { href: "/solutions", labelFr: "Solutions", labelEn: "Solutions" },
              { href: "/about", labelFr: "À propos", labelEn: "About" },
              { href: "/case-studies", labelFr: "Réalisations", labelEn: "Case Studies" },
              { href: "/contact", labelFr: "Contact", labelEn: "Contact" },
            ].map((link) => (
              <Link key={link.href} href={link.href}>
                <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:text-primary hover:border-primary/30 transition-colors cursor-pointer">
                  {fr ? link.labelFr : link.labelEn}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
