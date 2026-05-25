import React from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { Search, FileText, Rocket, GraduationCap, HeadphonesIcon } from "lucide-react";

const steps = [
  {
    icon: Search,
    numberFr: "01",
    numberEn: "01",
    titleFr: "Diagnostic & Audit",
    titleEn: "Diagnosis & Audit",
    descFr: "Nous analysons en profondeur votre infrastructure existante, vos besoins métiers et vos contraintes budgétaires pour établir un état des lieux précis et objectif.",
    descEn: "We conduct an in-depth analysis of your existing infrastructure, business needs, and budget constraints to establish an accurate and objective baseline.",
    durationFr: "1–2 semaines",
    durationEn: "1–2 weeks",
  },
  {
    icon: FileText,
    numberFr: "02",
    numberEn: "02",
    titleFr: "Stratégie & Proposition",
    titleEn: "Strategy & Proposal",
    descFr: "Sur la base du diagnostic, nous construisons une feuille de route technologique personnalisée avec des jalons clairs, un budget détaillé et des KPIs mesurables.",
    descEn: "Based on the diagnosis, we build a customized technology roadmap with clear milestones, a detailed budget, and measurable KPIs.",
    durationFr: "1–2 semaines",
    durationEn: "1–2 weeks",
  },
  {
    icon: Rocket,
    numberFr: "03",
    numberEn: "03",
    titleFr: "Déploiement & Intégration",
    titleEn: "Deployment & Integration",
    descFr: "Nos ingénieurs certifiés déploient la solution en minimisant les interruptions de service, avec des tests rigoureux à chaque étape et des rapports d'avancement réguliers.",
    descEn: "Our certified engineers deploy the solution while minimizing service disruptions, with rigorous testing at each stage and regular progress reports.",
    durationFr: "2–12 semaines",
    durationEn: "2–12 weeks",
  },
  {
    icon: GraduationCap,
    numberFr: "04",
    numberEn: "04",
    titleFr: "Formation & Transfert",
    titleEn: "Training & Knowledge Transfer",
    descFr: "Nous formons vos équipes techniques et utilisateurs finals pour assurer une adoption maximale et rendre vos équipes autonomes sur les nouvelles solutions.",
    descEn: "We train your technical and end-user teams to ensure maximum adoption and make your teams fully autonomous on the new solutions.",
    durationFr: "Incluse dans chaque projet",
    durationEn: "Included in every project",
  },
  {
    icon: HeadphonesIcon,
    numberFr: "05",
    numberEn: "05",
    titleFr: "Support & Amélioration Continue",
    titleEn: "Support & Continuous Improvement",
    descFr: "Notre équipe reste disponible après la mise en production pour le support technique, les mises à jour, les audits périodiques et l'optimisation continue de vos systèmes.",
    descEn: "Our team remains available after go-live for technical support, updates, periodic audits, and continuous optimization of your systems.",
    durationFr: "Continu",
    durationEn: "Ongoing",
  },
];

export function ProcessSteps() {
  const { language } = useLanguage();
  const fr = language === "fr";

  return (
    <section className="py-20 bg-white border-y border-slate-100">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">
            {fr ? "Notre méthode" : "How we work"}
          </p>
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            {fr ? "Un processus éprouvé, étape par étape" : "A proven process, step by step"}
          </h2>
          <p className="text-slate-500 text-lg">
            {fr
              ? "Chaque engagement suit une méthodologie structurée qui garantit clarté, maîtrise des délais et résultats mesurables."
              : "Every engagement follows a structured methodology that guarantees clarity, timeline control, and measurable results."}
          </p>
        </div>

        <div className="relative">
          {/* Connector line — desktop */}
          <div className="hidden lg:block absolute top-[52px] left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.55 }}
                className="flex flex-col items-center text-center"
              >
                <div className="relative mb-6">
                  <div className="w-[104px] h-[104px] rounded-full bg-primary/8 border-2 border-primary/20 flex items-center justify-center group hover:bg-primary hover:border-primary transition-all duration-300 cursor-default">
                    <step.icon size={36} className="text-primary group-hover:text-white transition-colors" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shadow-md">
                    {step.numberFr}
                  </div>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">
                  {fr ? step.titleFr : step.titleEn}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-3">
                  {fr ? step.descFr : step.descEn}
                </p>
                <span className="inline-block text-xs font-semibold text-primary bg-primary/8 px-3 py-1 rounded-full border border-primary/20">
                  {fr ? step.durationFr : step.durationEn}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
