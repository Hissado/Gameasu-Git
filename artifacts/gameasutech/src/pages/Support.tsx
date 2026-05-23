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
import { HeadphonesIcon, Clock, Globe, Zap, CheckCircle, Phone, Mail, MessageSquare } from "lucide-react";

const slaLevels = [
  { level: "P1", color: "bg-red-500/10 border-red-500/30 text-red-400", labelFr: "Critique", labelEn: "Critical", descFr: "Système en panne totale — production arrêtée", descEn: "Total system outage — production stopped", slaFr: "Réponse < 30 min / Résolution < 4h", slaEn: "Response < 30 min / Resolution < 4h" },
  { level: "P2", color: "bg-orange-500/10 border-orange-500/30 text-orange-400", labelFr: "Élevé", labelEn: "High", descFr: "Dégradation significative des performances", descEn: "Significant performance degradation", slaFr: "Réponse < 2h / Résolution < 8h", slaEn: "Response < 2h / Resolution < 8h" },
  { level: "P3", color: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400", labelFr: "Modéré", labelEn: "Moderate", descFr: "Impact limité, contournement disponible", descEn: "Limited impact, workaround available", slaFr: "Réponse < 4h / Résolution < 24h", slaEn: "Response < 4h / Resolution < 24h" },
  { level: "P4", color: "bg-blue-500/10 border-blue-500/30 text-blue-400", labelFr: "Faible", labelEn: "Low", descFr: "Demande de service, conseil ou amélioration", descEn: "Service request, advice, or enhancement", slaFr: "Réponse < 8h / Résolution < 5j", slaEn: "Response < 8h / Resolution < 5d" }
];

const channels = [
  { icon: Phone, labelFr: "Téléphone (urgences)", labelEn: "Phone (emergencies)", value: "+1 (555) 123-4567", note24x7: true },
  { icon: Mail, labelFr: "Email support", labelEn: "Email support", value: "support@gameasutech.com" },
  { icon: MessageSquare, labelFr: "Portail web", labelEn: "Web portal", value: "support.gameasutech.com" }
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

  const onSubmit = () => { setTimeout(() => setSubmitted(true), 500); };

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-20%,rgba(30,64,200,0.2)_0%,transparent_70%)] pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold mb-6 uppercase tracking-wide">
              <HeadphonesIcon size={14} />
              {fr ? "Support Client" : "Client Support"}
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6 max-w-4xl">
              {fr ? "Un support expert, disponible quand vous en avez besoin" : "Expert support, available when you need it"}
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl">
              {fr
                ? "Nos ingénieurs certifiés assurent le support de vos systèmes 24h/24, 7j/7, avec des engagements de niveau de service contractuels et une approche orientée résolution définitive."
                : "Our certified engineers support your systems 24/7, with contractual service level agreements and a root-cause resolution approach."}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Quick Contact Channels */}
      <section className="py-12 bg-card border-y border-border">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {channels.map((ch, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <div className="flex items-center gap-4 p-6 bg-background border border-border rounded-xl hover:border-primary/30 transition-colors">
                  <div className="p-3 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                    <ch.icon size={22} />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">{fr ? ch.labelFr : ch.labelEn}</div>
                    <div className="font-semibold text-white">{ch.value}</div>
                    {ch.note24x7 && <div className="text-xs text-primary mt-0.5">{fr ? "Urgences 24/7" : "24/7 emergencies"}</div>}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SLA Levels */}
      <section className="py-28">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Niveaux de priorité" : "Priority levels"}</p>
            <h2 className="text-4xl font-bold text-white mb-4">{fr ? "Des SLA clairs, contractuels et respectés" : "Clear, contractual, and respected SLAs"}</h2>
            <p className="text-muted-foreground text-lg">{fr ? "Nos engagements de service sont mesurés en continu et reportés chaque mois à nos clients." : "Our service commitments are continuously measured and reported to clients every month."}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {slaLevels.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <div className={`h-full bg-card border ${s.color} rounded-xl p-8`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`text-sm font-bold px-3 py-1 rounded-lg border ${s.color}`}>{s.level}</div>
                    <h3 className="text-lg font-bold text-white">{fr ? s.labelFr : s.labelEn}</h3>
                  </div>
                  <p className="text-muted-foreground mb-4">{fr ? s.descFr : s.descEn}</p>
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Clock size={14} className="text-primary" />
                    {fr ? s.slaFr : s.slaEn}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Ticket Form */}
      <section className="py-28 bg-card border-t border-border">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-white mb-4">{fr ? "Ouvrir un ticket de support" : "Open a support ticket"}</h2>
              <p className="text-muted-foreground text-lg">{fr ? "Décrivez votre incident ou demande. Nos ingénieurs vous répondront selon le SLA associé à votre priorité." : "Describe your incident or request. Our engineers will respond according to the SLA associated with your priority level."}</p>
            </div>

            {submitted ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16 bg-primary/5 border border-primary/20 rounded-2xl">
                <CheckCircle size={56} className="text-primary mx-auto mb-6" />
                <h3 className="text-2xl font-bold text-white mb-3">{fr ? "Ticket créé avec succès !" : "Ticket created successfully!"}</h3>
                <p className="text-muted-foreground">{fr ? "Vous allez recevoir un email de confirmation avec votre numéro de ticket. Notre équipe vous contactera selon le SLA de votre priorité." : "You will receive a confirmation email with your ticket number. Our team will contact you according to your priority SLA."}</p>
              </motion.div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{fr ? "Nom complet" : "Full name"}</FormLabel>
                        <FormControl><Input placeholder={fr ? "Jean Dupont" : "John Doe"} {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl><Input type="email" placeholder="jean@company.com" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="company" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{fr ? "Entreprise" : "Company"}</FormLabel>
                      <FormControl><Input placeholder={fr ? "Mon Entreprise SA" : "My Company Inc."} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="priority" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{fr ? "Priorité" : "Priority"}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder={fr ? "Choisir" : "Choose"} /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="P1">P1 — {fr ? "Critique" : "Critical"}</SelectItem>
                            <SelectItem value="P2">P2 — {fr ? "Élevé" : "High"}</SelectItem>
                            <SelectItem value="P3">P3 — {fr ? "Modéré" : "Moderate"}</SelectItem>
                            <SelectItem value="P4">P4 — {fr ? "Faible" : "Low"}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="category" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{fr ? "Catégorie" : "Category"}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder={fr ? "Choisir" : "Choose"} /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="network">{fr ? "Réseau" : "Network"}</SelectItem>
                            <SelectItem value="security">{fr ? "Sécurité" : "Security"}</SelectItem>
                            <SelectItem value="cloud">{fr ? "Cloud / Infrastructure" : "Cloud / Infrastructure"}</SelectItem>
                            <SelectItem value="endpoint">{fr ? "Postes utilisateurs" : "User endpoints"}</SelectItem>
                            <SelectItem value="app">{fr ? "Applications" : "Applications"}</SelectItem>
                            <SelectItem value="other">{fr ? "Autre" : "Other"}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="subject" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{fr ? "Sujet" : "Subject"}</FormLabel>
                      <FormControl><Input placeholder={fr ? "Résumé de l'incident" : "Incident summary"} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{fr ? "Description détaillée" : "Detailed description"}</FormLabel>
                      <FormControl><Textarea rows={5} placeholder={fr ? "Décrivez l'incident en détail : symptômes, utilisateurs impactés, heure de début, messages d'erreur..." : "Describe the incident in detail: symptoms, impacted users, start time, error messages..."} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? (fr ? "Envoi..." : "Sending...") : (fr ? "Soumettre le ticket" : "Submit ticket")}
                  </Button>
                </form>
              </Form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
