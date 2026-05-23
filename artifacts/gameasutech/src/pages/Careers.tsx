import React, { useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { CTASection } from "@/components/CTASection";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, Globe, Zap, Users, TrendingUp, Heart, Award } from "lucide-react";

const reasons = [
  { icon: Globe, titleFr: "Impact international", titleEn: "International impact", descFr: "Travaillez sur des projets qui transforment des organisations dans 7 pays, de l'Afrique de l'Ouest aux États-Unis.", descEn: "Work on projects transforming organizations in 7 countries, from West Africa to the USA." },
  { icon: Zap, titleFr: "Technologies de pointe", titleEn: "Cutting-edge technology", descFr: "Accédez aux dernières certifications et travaillez avec les leaders technologiques mondiaux.", descEn: "Access the latest certifications and work with global technology leaders." },
  { icon: Users, titleFr: "Équipe multiculturelle", titleEn: "Multicultural team", descFr: "Une équipe diverse et inclusive avec des expertises complémentaires sur plusieurs continents.", descEn: "A diverse and inclusive team with complementary expertise across multiple continents." },
  { icon: TrendingUp, titleFr: "Croissance accélérée", titleEn: "Accelerated growth", descFr: "Un environnement qui favorise l'évolution rapide avec un accompagnement personnalisé.", descEn: "An environment that fosters rapid growth with personalized mentoring." },
  { icon: Heart, titleFr: "Équilibre vie pro/perso", titleEn: "Work-life balance", descFr: "Politique de télétravail flexible, congés généreux et culture du respect du temps personnel.", descEn: "Flexible remote work policy, generous leave, and culture of respecting personal time." },
  { icon: Award, titleFr: "Formation continue", titleEn: "Continuous learning", descFr: "Budget formation annuel, certifications prises en charge et conférences internationales.", descEn: "Annual training budget, sponsored certifications, and international conferences." }
];

const openings = [
  { titleFr: "Ingénieur Cybersécurité SOC", titleEn: "SOC Cybersecurity Engineer", locationFr: "Lomé, Togo (Hybride)", locationEn: "Lomé, Togo (Hybrid)", typeFr: "CDI", typeEn: "Full-time", expFr: "3+ ans", expEn: "3+ years" },
  { titleFr: "Architecte Cloud AWS / Azure", titleEn: "AWS / Azure Cloud Architect", locationFr: "Paris, France (Hybride)", locationEn: "Paris, France (Hybrid)", typeFr: "CDI", typeEn: "Full-time", expFr: "5+ ans", expEn: "5+ years" },
  { titleFr: "Consultant Transformation Digitale", titleEn: "Digital Transformation Consultant", locationFr: "Abidjan, Côte d'Ivoire", locationEn: "Abidjan, Côte d'Ivoire", typeFr: "CDI", typeEn: "Full-time", expFr: "4+ ans", expEn: "4+ years" },
  { titleFr: "Ingénieur IA & Data Science", titleEn: "AI & Data Science Engineer", locationFr: "New York, USA (Remote)", locationEn: "New York, USA (Remote)", typeFr: "CDI", typeEn: "Full-time", expFr: "3+ ans", expEn: "3+ years" }
];

const formSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(5),
  position: z.string().min(2),
  experience: z.string().min(1),
  motivation: z.string().min(20)
});

export default function Careers() {
  const { language } = useLanguage();
  const fr = language === "fr";
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", email: "", phone: "", position: "", experience: "", motivation: "" }
  });

  const onSubmit = () => setTimeout(() => setSubmitted(true), 400);

  return (
    <div className="min-h-screen bg-background">
      <section className="relative pt-32 pb-20 bg-gradient-to-br from-slate-50 via-blue-50/30 to-white overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10 max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Carrières" : "Careers"}</p>
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
              {fr ? "Rejoignez une équipe qui change la donne" : "Join a team that changes the game"}
            </h1>
            <p className="text-xl text-slate-500">
              {fr ? "Nous recrutons des experts passionnés qui souhaitent construire le futur numérique de l'Afrique et contribuer à des projets d'envergure internationale." : "We recruit passionate experts who want to build Africa's digital future and contribute to international-scale projects."}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Why join */}
      <section className="py-28 bg-white border-b border-slate-100">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Pourquoi nous rejoindre" : "Why join us"}</p>
            <h2 className="text-4xl font-bold text-slate-900 mb-4">{fr ? "6 raisons de faire partie de l'aventure" : "6 reasons to be part of the adventure"}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reasons.map((r, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                <div className="group h-full bg-white border border-slate-200 rounded-xl p-8 hover:border-primary/40 hover:shadow-md transition-all">
                  <div className="p-3 rounded-lg bg-primary/8 text-primary inline-flex mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
                    <r.icon size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3">{fr ? r.titleFr : r.titleEn}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{fr ? r.descFr : r.descEn}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Open positions */}
      <section className="py-28 bg-gradient-to-br from-slate-50 to-blue-50/20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Postes ouverts" : "Open positions"}</p>
            <h2 className="text-4xl font-bold text-slate-900">{fr ? "Opportunités actuelles" : "Current opportunities"}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {openings.map((o, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                <div className="group bg-white border border-slate-200 rounded-xl p-7 hover:border-primary/40 hover:shadow-md transition-all">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">{fr ? o.titleFr : o.titleEn}</h3>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-primary/8 text-primary text-xs font-semibold rounded-full">{fr ? o.locationFr : o.locationEn}</span>
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">{fr ? o.typeFr : o.typeEn}</span>
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">{fr ? o.expFr : o.expEn}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Application form */}
      <section className="py-28 bg-white border-t border-slate-100">
        <div className="container mx-auto px-6 max-w-2xl">
          <div className="text-center mb-12">
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Candidature" : "Application"}</p>
            <h2 className="text-4xl font-bold text-slate-900 mb-4">{fr ? "Candidature spontanée" : "Spontaneous application"}</h2>
            <p className="text-slate-500">{fr ? "Aucun poste ne correspond ? Envoyez-nous votre candidature et nous vous contacterons dès qu'une opportunité se présente." : "No matching position? Send us your application and we'll contact you when an opportunity arises."}</p>
          </div>

          {submitted ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16 bg-primary/5 border border-primary/20 rounded-2xl">
              <CheckCircle size={56} className="text-primary mx-auto mb-6" />
              <h3 className="text-2xl font-bold text-slate-900 mb-3">{fr ? "Candidature reçue !" : "Application received!"}</h3>
              <p className="text-slate-500">{fr ? "Nous examinerons votre profil et vous contacterons dans les meilleurs délais." : "We will review your profile and contact you as soon as possible."}</p>
            </motion.div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>{fr ? "Nom complet" : "Full name"}</FormLabel><FormControl><Input placeholder="Jean Dupont" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="jean@company.com" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>{fr ? "Téléphone" : "Phone"}</FormLabel><FormControl><Input placeholder="+228 90 00 00 00" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="position" render={({ field }) => (
                  <FormItem><FormLabel>{fr ? "Poste visé" : "Target position"}</FormLabel><FormControl><Input placeholder={fr ? "Ex: Ingénieur Cloud" : "Ex: Cloud Engineer"} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="experience" render={({ field }) => (
                  <FormItem><FormLabel>{fr ? "Années d'expérience" : "Years of experience"}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder={fr ? "Choisir" : "Choose"} /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="0-2">{fr ? "0 à 2 ans" : "0 to 2 years"}</SelectItem>
                        <SelectItem value="3-5">{fr ? "3 à 5 ans" : "3 to 5 years"}</SelectItem>
                        <SelectItem value="6-10">{fr ? "6 à 10 ans" : "6 to 10 years"}</SelectItem>
                        <SelectItem value="10+">{fr ? "10 ans et plus" : "10+ years"}</SelectItem>
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="motivation" render={({ field }) => (
                  <FormItem><FormLabel>{fr ? "Lettre de motivation" : "Cover letter"}</FormLabel><FormControl><Textarea rows={5} placeholder={fr ? "Présentez-vous et expliquez votre motivation..." : "Introduce yourself and explain your motivation..."} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (fr ? "Envoi..." : "Sending...") : (fr ? "Envoyer ma candidature" : "Submit application")}
                </Button>
              </form>
            </Form>
          )}
        </div>
      </section>
    </div>
  );
}
