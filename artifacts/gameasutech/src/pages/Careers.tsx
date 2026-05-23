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
import { Users, Globe, TrendingUp, Heart, GraduationCap, Award, CheckCircle } from "lucide-react";

const values = [
  { icon: Globe, fr: "Impact Global", en: "Global Impact", descFr: "Travaillez sur des projets qui connectent l'Afrique au monde.", descEn: "Work on projects that connect Africa to the world." },
  { icon: TrendingUp, fr: "Croissance", en: "Growth", descFr: "Évoluez avec des experts certifiés dans un environnement stimulant.", descEn: "Grow with certified experts in a stimulating environment." },
  { icon: Heart, fr: "Culture inclusive", en: "Inclusive culture", descFr: "Diversité, respect et appartenance au cœur de notre organisation.", descEn: "Diversity, respect, and belonging at the heart of our organization." },
  { icon: GraduationCap, fr: "Formation continue", en: "Continuous learning", descFr: "Budget formation dédié, certifications prises en charge, conférences.", descEn: "Dedicated training budget, covered certifications, conferences." },
  { icon: Award, fr: "Excellence", en: "Excellence", descFr: "Rejoignez une équipe qui maintient les plus hauts standards.", descEn: "Join a team that maintains the highest standards." },
  { icon: Users, fr: "Équipe soudée", en: "Tight-knit team", descFr: "Une communauté internationale unie par une mission commune.", descEn: "An international community united by a common mission." }
];

const schema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  position: z.string().min(2),
  experience: z.string().min(1),
  message: z.string().min(20)
});

export default function Careers() {
  const { language } = useLanguage();
  const fr = language === "fr";
  const [submitted, setSubmitted] = useState(false);

  const form = useForm({ resolver: zodResolver(schema), defaultValues: { firstName: "", lastName: "", email: "", phone: "", position: "", experience: "", message: "" } });

  const onSubmit = () => { setTimeout(() => setSubmitted(true), 500); };

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-20%,rgba(30,64,200,0.2)_0%,transparent_70%)] pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">
              {fr ? "Rejoignez-nous" : "Join us"}
            </p>
            <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
              {fr ? "Construisez la technologie de demain avec nous" : "Build tomorrow's technology with us"}
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl">
              {fr
                ? "Chez Gaméasù Technology, nous croyons que les meilleurs projets technologiques sont construits par des équipes talentueuses, passionnées et engagées. Si vous partagez cette vision, rejoignez-nous."
                : "At Gaméasù Technology, we believe the best technology projects are built by talented, passionate, committed teams. If you share this vision, join us."}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Why Join */}
      <section className="py-24 bg-card border-y border-border">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-4xl font-bold text-white mb-4">{fr ? "Pourquoi nous rejoindre ?" : "Why join us?"}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {values.map((v, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}>
                <div className="group h-full bg-background border border-border rounded-xl p-7 hover:border-primary/40 hover:bg-primary/3 transition-all duration-300">
                  <div className="p-3 rounded-lg bg-primary/10 text-primary inline-flex mb-5 group-hover:bg-primary group-hover:text-white transition-colors">
                    <v.icon size={22} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{fr ? v.fr : v.en}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{fr ? v.descFr : v.descEn}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Current Openings */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl font-bold text-white mb-6">{fr ? "Postes ouverts" : "Open positions"}</h2>
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Users size={28} className="text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                {fr ? "Aucun poste ouvert actuellement" : "No open positions currently"}
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                {fr
                  ? "Nous n'avons pas de postes ouverts en ce moment, mais nous recevons toujours avec plaisir les candidatures spontanées de profils talentueux. Postulez ci-dessous et nous vous contacterons dès qu'une opportunité correspondra à votre profil."
                  : "We don't have any open positions right now, but we always welcome spontaneous applications from talented profiles. Apply below and we'll contact you as soon as an opportunity matches your profile."}
              </p>
              <div className="flex flex-wrap justify-center gap-3 text-sm text-muted-foreground">
                {[
                  fr ? "Consultant IT" : "IT Consultant",
                  fr ? "Ingénieur réseau" : "Network Engineer",
                  fr ? "Expert cybersécurité" : "Cybersecurity Expert",
                  fr ? "Chef de projet" : "Project Manager",
                  fr ? "Commercial IT" : "IT Sales"
                ].map((role, i) => (
                  <span key={i} className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-primary text-xs font-medium">{role}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Spontaneous Application Form */}
      <section className="py-24 bg-card border-t border-border">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-white mb-4">{fr ? "Candidature spontanée" : "Spontaneous application"}</h2>
              <p className="text-muted-foreground text-lg">{fr ? "Envoyez-nous votre profil et nous vous recontactons pour les opportunités futures." : "Send us your profile and we'll contact you for future opportunities."}</p>
            </div>

            {submitted ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16 bg-primary/5 border border-primary/20 rounded-2xl">
                <CheckCircle size={56} className="text-primary mx-auto mb-6" />
                <h3 className="text-2xl font-bold text-white mb-3">{fr ? "Candidature reçue !" : "Application received!"}</h3>
                <p className="text-muted-foreground">{fr ? "Nous avons bien reçu votre candidature. Notre équipe RH la traitera dans les meilleurs délais." : "We have received your application. Our HR team will process it as soon as possible."}</p>
              </motion.div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="firstName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{fr ? "Prénom" : "First name"}</FormLabel>
                        <FormControl><Input placeholder={fr ? "Jean" : "John"} {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="lastName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{fr ? "Nom" : "Last name"}</FormLabel>
                        <FormControl><Input placeholder={fr ? "Dupont" : "Doe"} {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl><Input type="email" placeholder="jean@example.com" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{fr ? "Téléphone" : "Phone"}</FormLabel>
                        <FormControl><Input placeholder="+33 6 00 00 00 00" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="position" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{fr ? "Poste recherché" : "Position sought"}</FormLabel>
                      <FormControl><Input placeholder={fr ? "Ex: Consultant en cybersécurité" : "Ex: Cybersecurity consultant"} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="experience" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{fr ? "Niveau d'expérience" : "Experience level"}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder={fr ? "Sélectionner" : "Select"} /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="junior">{fr ? "Junior (0-2 ans)" : "Junior (0-2 years)"}</SelectItem>
                          <SelectItem value="mid">{fr ? "Intermédiaire (3-5 ans)" : "Mid-level (3-5 years)"}</SelectItem>
                          <SelectItem value="senior">{fr ? "Senior (6-10 ans)" : "Senior (6-10 years)"}</SelectItem>
                          <SelectItem value="expert">{fr ? "Expert (10+ ans)" : "Expert (10+ years)"}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="message" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{fr ? "Lettre de motivation" : "Cover letter"}</FormLabel>
                      <FormControl><Textarea rows={5} placeholder={fr ? "Présentez-vous et expliquez pourquoi vous souhaitez rejoindre Gaméasù Technology..." : "Introduce yourself and explain why you want to join Gaméasù Technology..."} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? (fr ? "Envoi..." : "Sending...") : (fr ? "Envoyer ma candidature" : "Submit my application")}
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
