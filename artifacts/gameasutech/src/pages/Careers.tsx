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
  { icon: Globe, titleFr: "Impact international réel", titleEn: "Real international impact", descFr: "Travaillez sur des projets qui transforment des entreprises, institutions et organisations dans 7 pays — des États-Unis à l'Afrique de l'Ouest.", descEn: "Work on projects transforming businesses, institutions, and organizations in 7 countries — from the USA to West Africa." },
  { icon: Zap, titleFr: "Technologies de pointe", titleEn: "Cutting-edge technology", descFr: "Accédez aux dernières certifications et collaborez avec les leaders technologiques mondiaux sur des projets concrets à fort impact.", descEn: "Access the latest certifications and collaborate with global technology leaders on high-impact, real-world projects." },
  { icon: Users, titleFr: "Équipe internationale", titleEn: "International team", descFr: "Une équipe diverse, multiculturelle et inclusive avec des expertises complémentaires réparties sur plusieurs continents.", descEn: "A diverse, multicultural, and inclusive team with complementary expertise spanning multiple continents." },
  { icon: TrendingUp, titleFr: "Croissance accélérée", titleEn: "Accelerated growth", descFr: "Un environnement en croissance rapide qui favorise l'évolution de carrière, avec un accompagnement personnalisé et des responsabilités réelles.", descEn: "A fast-growing environment that fosters career progression, with personalized mentoring and real responsibilities." },
  { icon: Heart, titleFr: "Équilibre vie pro/perso", titleEn: "Work-life balance", descFr: "Politique de télétravail flexible, congés généreux et culture d'entreprise fondée sur le respect du temps personnel et de la qualité de vie.", descEn: "Flexible remote work policy, generous leave, and company culture built on respect for personal time and quality of life." },
  { icon: Award, titleFr: "Formation continue", titleEn: "Continuous learning", descFr: "Budget formation annuel dédié, certifications prises en charge, accès aux conférences internationales et programme de mentoring interne.", descEn: "Dedicated annual training budget, sponsored certifications, access to international conferences, and internal mentoring program." }
];

const openings = [
  { titleFr: "Ingénieur Cybersécurité SOC", titleEn: "SOC Cybersecurity Engineer", locationFr: "Lomé, Togo (Hybride)", locationEn: "Lomé, Togo (Hybrid)", typeFr: "CDI", typeEn: "Full-time", expFr: "3+ ans", expEn: "3+ years" },
  { titleFr: "Architecte Cloud AWS / Azure", titleEn: "AWS / Azure Cloud Architect", locationFr: "New Haven, CT — USA (Hybride)", locationEn: "New Haven, CT — USA (Hybrid)", typeFr: "CDI", typeEn: "Full-time", expFr: "5+ ans", expEn: "5+ years" },
  { titleFr: "Consultant Transformation Digitale", titleEn: "Digital Transformation Consultant", locationFr: "Paris, France (Hybride)", locationEn: "Paris, France (Hybrid)", typeFr: "CDI", typeEn: "Full-time", expFr: "4+ ans", expEn: "4+ years" },
  { titleFr: "Ingénieur IA & Data Science", titleEn: "AI & Data Science Engineer", locationFr: "New Haven, CT — USA (Remote)", locationEn: "New Haven, CT — USA (Remote)", typeFr: "CDI", typeEn: "Full-time", expFr: "3+ ans", expEn: "3+ years" }
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
      <section className="relative pt-24 pb-12 bg-gradient-to-br from-slate-50 via-blue-50/30 to-white overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ y: 24 }} animate={{ opacity: 1, y: 0 }}>
              <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Carrières" : "Careers"}</p>
              <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
                {fr ? "Rejoignez une entreprise technologique internationale en pleine croissance" : "Join a fast-growing international technology company"}
              </h1>
              <p className="text-xl text-slate-500">
                {fr
                  ? "Gaméasù recrute des experts passionnés souhaitant contribuer à la transformation numérique des organisations à l'échelle mondiale — des États-Unis à l'Afrique de l'Ouest."
                  : "Gaméasù recruits passionate experts who want to contribute to the digital transformation of organizations on a global scale — from the USA to West Africa."}
              </p>
            </motion.div>
            <motion.div initial={{ x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.28 }} className="hidden lg:block">
              <div className="relative rounded-2xl overflow-hidden h-72 bg-slate-200 shadow-xl">
                <img
                  src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=900&q=80&auto=format&fit=crop"
                  alt="Équipe internationale diversifiée au travail"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/40 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5">
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3">
                    <span className="text-white text-sm font-medium">🌍 {fr ? "7 pays · Équipe internationale" : "7 countries · International team"}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Why join */}
      <section className="py-20 bg-white border-b border-slate-100">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Pourquoi nous rejoindre" : "Why join us"}</p>
            <h2 className="text-4xl font-bold text-slate-900 mb-4">{fr ? "6 raisons de rejoindre l'aventure Gaméasù" : "6 reasons to join the Gaméasù adventure"}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reasons.map((r, i) => (
              <motion.div key={i} initial={{ y: 20 }} whileInView={{ y: 0 }} viewport={{ once: true, amount: 0.05 }} transition={{ delay: i * 0.025 }}>
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
      <section className="py-20 bg-gradient-to-br from-slate-50 to-blue-50/20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Postes ouverts" : "Open positions"}</p>
            <h2 className="text-4xl font-bold text-slate-900">{fr ? "Opportunités actuelles" : "Current opportunities"}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {openings.map((o, i) => (
              <motion.div key={i} initial={{ y: 20 }} whileInView={{ y: 0 }} viewport={{ once: true, amount: 0.05 }} transition={{ delay: i * 0.025 }}>
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
      <section className="py-20 bg-white border-t border-slate-100">
        <div className="container mx-auto px-6 max-w-2xl">
          <div className="text-center mb-12">
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{fr ? "Candidature" : "Application"}</p>
            <h2 className="text-4xl font-bold text-slate-900 mb-4">{fr ? "Candidature spontanée" : "Spontaneous application"}</h2>
            <p className="text-slate-500">{fr ? "Aucun poste ne correspond à votre profil ? Envoyez-nous votre candidature — nous vous contacterons dès qu'une opportunité correspond à votre expertise." : "No matching position? Send us your application — we'll reach out as soon as an opportunity matches your expertise."}</p>
          </div>

          {submitted ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16 bg-primary/5 border border-primary/20 rounded-2xl">
              <CheckCircle size={56} className="text-primary mx-auto mb-6" />
              <h3 className="text-2xl font-bold text-slate-900 mb-3">{fr ? "Candidature reçue !" : "Application received!"}</h3>
              <p className="text-slate-500">{fr ? "Merci ! Nous examinerons votre profil avec attention et vous contacterons dans les meilleurs délais." : "Thank you! We will carefully review your profile and contact you as soon as possible."}</p>
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
                  <FormItem><FormLabel>{fr ? "Téléphone" : "Phone"}</FormLabel><FormControl><Input placeholder="+1 (203) 000-0000" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="position" render={({ field }) => (
                  <FormItem><FormLabel>{fr ? "Poste visé" : "Target position"}</FormLabel><FormControl><Input placeholder={fr ? "Ex: Architecte Cloud" : "Ex: Cloud Architect"} {...field} /></FormControl><FormMessage /></FormItem>
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
                  <FormItem><FormLabel>{fr ? "Lettre de motivation" : "Cover letter"}</FormLabel><FormControl><Textarea rows={5} placeholder={fr ? "Présentez-vous, vos compétences clés et expliquez votre intérêt pour Gaméasù..." : "Introduce yourself, your key skills, and explain your interest in Gaméasù..."} {...field} /></FormControl><FormMessage /></FormItem>
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
