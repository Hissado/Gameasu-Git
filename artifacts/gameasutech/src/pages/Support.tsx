import React, { useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HeadphonesIcon, Clock, CheckCircle, Phone, Mail, MessageSquare } from "lucide-react";

const slaLevels = [
  { level: "P1", colorBg: "bg-red-50 border-red-200", colorText: "text-red-700", labelFr: "Critique", labelEn: "Critical", descFr: "Système en panne totale — production arrêtée, impact majeur sur l'activité", descEn: "Total system outage — production stopped, major business impact", slaFr: "Réponse < 30 min / Résolution < 4h", slaEn: "Response < 30 min / Resolution < 4h" },
  { level: "P2", colorBg: "bg-orange-50 border-orange-200", colorText: "text-orange-700", labelFr: "Élevé", labelEn: "High", descFr: "Dégradation significative des performances ou perte partielle de fonctionnalités", descEn: "Significant performance degradation or partial loss of functionality", slaFr: "Réponse < 2h / Résolution < 8h", slaEn: "Response < 2h / Resolution < 8h" },
  { level: "P3", colorBg: "bg-yellow-50 border-yellow-200", colorText: "text-yellow-700", labelFr: "Modéré", labelEn: "Moderate", descFr: "Impact limité sur les opérations, contournement disponible", descEn: "Limited operational impact, workaround available", slaFr: "Réponse < 4h / Résolution < 24h", slaEn: "Response < 4h / Resolution < 24h" },
  { level: "P4", colorBg: "bg-blue-50 border-blue-200", colorText: "text-blue-700", labelFr: "Faible", labelEn: "Low", descFr: "Demande de service, conseil ou demande d'amélioration sans urgence", descEn: "Non-urgent service request, advice, or enhancement", slaFr: "Réponse < 8h / Résolution < 5j", slaEn: "Response < 8h / Resolution < 5d" }
];

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  company: z.string().min(2),
  priority: z.string().min(1),
  category: z.string().min(1),
  subject: z.string().min(5),
  description: z.string().min(20)
});

export default function Support() {
  const { language } = useLanguage();
  const fr = language === "fr";
  const [submitted, setSubmitted] = useState(false);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", company: "", priority: "", category: "", subject: "", description: "" }
  });

  const onSubmit = () => setTimeout(() => setSubmitted(true), 400);

  return (
    <div className="min-h-screen bg-background">
      <section className="relative pt-32 pb-20 bg-gradient-to-br from-slate-50 via-blue-50/30 to-white overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10 max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold mb-6 uppercase tracking-wide">
              <HeadphonesIcon size={14} />{fr ? "Support Client" : "Client Support"}
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
              {fr ? "Un support expert, disponible quand vous en avez besoin" : "Expert support, available when you need it"}
            </h1>
            <p className="text-xl text-slate-500">
              {fr
                ? "Nos ingénieurs certifiés assurent le support de vos systèmes critiques 24h/24, 7j/7, avec des niveaux de service contractuels mesurés et reportés chaque mois."
                : "Our certified engineers support your critical systems 24/7, with contractual service levels measured and reported monthly."}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Quick channels */}
      <section className="py-10 bg-white border-b border-slate-100">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: Phone, labelFr: "Téléphone (urgences P1/P2)", labelEn: "Phone (P1/P2 emergencies)", value: "+1 (203) 626-2309", note24x7: true },
              { icon: Mail, labelFr: "Email support", labelEn: "Email support", value: "support@gameasu.tech", note24x7: false },
              { icon: MessageSquare, labelFr: "Portail de tickets", labelEn: "Ticket portal", value: "support.gameasu.tech", note24x7: false }
            ].map((ch, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <div className="flex items-center gap-4 p-5 bg-white border border-slate-200 rounded-xl hover:border-primary/30 transition-colors shadow-sm">
                  <div className="p-3 rounded-lg bg-primary/8 text-primary flex-shrink-0"><ch.icon size={20} /></div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">{fr ? ch.labelFr : ch.labelEn}</div>
                    <div className="font-semibold text-slate-900 text-sm">{ch.value}</div>
                    {ch.note24x7 && <div className="text-xs text-primary font-semibold">{fr ? "Urgences 24/7" : "24/7 emergencies"}</div>}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SLA levels */}
      <section className="py-28 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Niveaux de priorité" : "Priority levels"}</p>
            <h2 className="text-4xl font-bold text-slate-900 mb-4">{fr ? "Des SLA clairs, contractuels et respectés" : "Clear, contractual, and respected SLAs"}</h2>
            <p className="text-slate-500 text-lg">{fr ? "Nos engagements sont mesurés en continu et reportés mensuellement à chaque client." : "Our commitments are continuously measured and reported to each client monthly."}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {slaLevels.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <div className={`h-full border-2 ${s.colorBg} rounded-xl p-8`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`text-sm font-bold px-3 py-1 rounded-lg ${s.colorText}`}>{s.level}</div>
                    <h3 className="text-lg font-bold text-slate-900">{fr ? s.labelFr : s.labelEn}</h3>
                  </div>
                  <p className="text-slate-600 mb-4 text-sm">{fr ? s.descFr : s.descEn}</p>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Clock size={14} className="text-primary" />
                    {fr ? s.slaFr : s.slaEn}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Ticket form */}
      <section className="py-28 bg-gradient-to-br from-slate-50 to-blue-50/20 border-t border-slate-100">
        <div className="container mx-auto px-6 max-w-2xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">{fr ? "Ouvrir un ticket de support" : "Open a support ticket"}</h2>
            <p className="text-slate-500 text-lg">{fr ? "Décrivez votre incident. Nos ingénieurs vous répondront selon le SLA correspondant à votre niveau de priorité." : "Describe your incident. Our engineers will respond according to the SLA for your priority level."}</p>
          </div>

          {submitted ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16 bg-primary/5 border border-primary/20 rounded-2xl">
              <CheckCircle size={56} className="text-primary mx-auto mb-6" />
              <h3 className="text-2xl font-bold text-slate-900 mb-3">{fr ? "Ticket créé !" : "Ticket created!"}</h3>
              <p className="text-slate-500">{fr ? "Vous recevrez un email de confirmation. Notre équipe vous contactera conformément à votre SLA." : "You will receive a confirmation email. Our team will contact you in accordance with your SLA."}</p>
            </motion.div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem><FormLabel>{fr ? "Nom complet" : "Full name"}</FormLabel><FormControl><Input placeholder="Jean Dupont" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="jean@company.com" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="company" render={({ field }) => (
                    <FormItem><FormLabel>{fr ? "Entreprise / Organisation" : "Company / Organization"}</FormLabel><FormControl><Input placeholder="Mon Entreprise" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="priority" render={({ field }) => (
                      <FormItem><FormLabel>{fr ? "Priorité" : "Priority"}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder={fr ? "Choisir" : "Choose"} /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="P1">P1 — {fr ? "Critique" : "Critical"}</SelectItem>
                            <SelectItem value="P2">P2 — {fr ? "Élevé" : "High"}</SelectItem>
                            <SelectItem value="P3">P3 — {fr ? "Modéré" : "Moderate"}</SelectItem>
                            <SelectItem value="P4">P4 — {fr ? "Faible" : "Low"}</SelectItem>
                          </SelectContent>
                        </Select><FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="category" render={({ field }) => (
                      <FormItem><FormLabel>{fr ? "Catégorie" : "Category"}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder={fr ? "Choisir" : "Choose"} /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="network">{fr ? "Réseau & Connectivité" : "Network & Connectivity"}</SelectItem>
                            <SelectItem value="security">{fr ? "Cybersécurité" : "Cybersecurity"}</SelectItem>
                            <SelectItem value="cloud">{fr ? "Cloud / Infrastructure" : "Cloud / Infrastructure"}</SelectItem>
                            <SelectItem value="endpoint">{fr ? "Postes utilisateurs" : "User endpoints"}</SelectItem>
                            <SelectItem value="app">{fr ? "Applications" : "Applications"}</SelectItem>
                            <SelectItem value="other">{fr ? "Autre" : "Other"}</SelectItem>
                          </SelectContent>
                        </Select><FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="subject" render={({ field }) => (
                    <FormItem><FormLabel>{fr ? "Sujet" : "Subject"}</FormLabel><FormControl><Input placeholder={fr ? "Résumé de l'incident" : "Incident summary"} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel>{fr ? "Description détaillée" : "Detailed description"}</FormLabel>
                      <FormControl><Textarea rows={5} placeholder={fr ? "Symptômes observés, utilisateurs impactés, heure de début, étapes de reproduction..." : "Observed symptoms, impacted users, start time, steps to reproduce..."} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? (fr ? "Envoi..." : "Sending...") : (fr ? "Soumettre le ticket" : "Submit ticket")}
                  </Button>
                </form>
              </Form>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
