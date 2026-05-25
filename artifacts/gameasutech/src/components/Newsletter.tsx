import React, { useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { Mail, ArrowRight, CheckCircle } from "lucide-react";

export function Newsletter() {
  const { language } = useLanguage();
  const fr = language === "fr";
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 900);
  };

  return (
    <section className="py-16 bg-primary/5 border-y border-primary/10">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mx-auto text-center"
        >
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-5">
            <Mail size={22} />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-3">
            {fr ? "Restez à la pointe de la tech africaine" : "Stay ahead in African tech"}
          </h2>
          <p className="text-slate-500 text-lg mb-8">
            {fr
              ? "Recevez une fois par mois nos insights sur la transformation numérique, la cybersécurité et l'IA en Afrique et dans le monde."
              : "Receive our monthly insights on digital transformation, cybersecurity, and AI in Africa and around the world."}
          </p>

          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-center gap-3 p-5 bg-green-50 border border-green-200 rounded-xl text-green-700"
            >
              <CheckCircle size={22} />
              <span className="font-semibold">
                {fr ? "Merci ! Vous êtes inscrit(e) à la newsletter Gaméasù." : "Thank you! You're subscribed to the Gaméasù newsletter."}
              </span>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={fr ? "Votre adresse email professionnelle" : "Your professional email address"}
                required
                className="flex-1 px-5 py-3 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
              />
              <button
                type="submit"
                disabled={loading}
                className="group inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-60 whitespace-nowrap"
              >
                {loading
                  ? (fr ? "Inscription..." : "Subscribing...")
                  : (fr ? "S'inscrire" : "Subscribe")}
                {!loading && <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />}
              </button>
            </form>
          )}

          <p className="text-xs text-slate-400 mt-4">
            {fr
              ? "Pas de spam. Désabonnement en 1 clic. Conformité RGPD garantie."
              : "No spam. Unsubscribe in 1 click. GDPR compliant."}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
