import React from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { CheckCircle2, Mail, Phone, MapPin, Clock } from "lucide-react";

export default function Contact() {
  const { t, language } = useLanguage();
  const fr = language === "fr";
  const [isSubmitted, setIsSubmitted] = React.useState(false);

  const formSchema = z.object({
    name: z.string().min(2, fr ? "Le nom est requis" : "Name is required"),
    email: z.string().email(fr ? "Email invalide" : "Invalid email"),
    phone: z.string().min(5, fr ? "Téléphone requis" : "Phone required"),
    company: z.string().min(2, fr ? "L'entreprise est requise" : "Company required"),
    subject: z.string().min(2, fr ? "Le sujet est requis" : "Subject required"),
    message: z.string().min(10, fr ? "Message trop court" : "Message too short"),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", email: "", phone: "", company: "", subject: "", message: "" }
  });

  function onSubmit() { setIsSubmitted(true); }

  const offices = [
    { code: "us", city: "New Haven, CT", detailFr: "États-Unis — Siège social", detailEn: "United States — Headquarters", hq: true },
    { code: "ca", city: "Montréal", detailFr: "Canada", detailEn: "Canada" },
    { code: "fr", city: "Paris", detailFr: "France", detailEn: "France" },
    { code: "be", city: "Bruxelles", detailFr: "Belgique", detailEn: "Belgium" },
    { code: "tg", city: "Lomé", detailFr: "Togo", detailEn: "Togo" },
    { code: "ci", city: "Abidjan", detailFr: "Côte d'Ivoire", detailEn: "Côte d'Ivoire" },
    { code: "ml", city: "Bamako", detailFr: "Mali", detailEn: "Mali" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative pt-32 pb-20 bg-gradient-to-br from-slate-50 via-blue-50/30 to-white overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10 max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-primary font-semibold uppercase tracking-widest text-sm mb-4">{t.nav.contact}</p>
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">{t.contact.title}</h1>
            <p className="text-xl text-slate-500 max-w-2xl">{t.contact.subtitle}</p>
          </motion.div>
        </div>
      </section>

      <div className="py-16 bg-white">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              {/* Contact info */}
              <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-6">{fr ? "Informations de contact" : "Contact Information"}</h3>
                <div className="space-y-5">
                  <a href="mailto:info@gameasu.tech" className="flex items-start gap-3 hover:text-primary transition-colors group">
                    <div className="p-2 rounded-lg bg-primary/8 text-primary flex-shrink-0 group-hover:bg-primary group-hover:text-white transition-colors"><Mail size={16} /></div>
                    <div>
                      <div className="text-xs text-slate-400 mb-0.5">Email</div>
                      <div className="font-medium text-slate-800 text-sm">info@gameasu.tech</div>
                    </div>
                  </a>
                  <a href="tel:+12036262309" className="flex items-start gap-3 hover:text-primary transition-colors group">
                    <div className="p-2 rounded-lg bg-primary/8 text-primary flex-shrink-0 group-hover:bg-primary group-hover:text-white transition-colors"><Phone size={16} /></div>
                    <div>
                      <div className="text-xs text-slate-400 mb-0.5">{fr ? "Téléphone" : "Phone"}</div>
                      <div className="font-medium text-slate-800 text-sm">+1 (203) 626-2309</div>
                    </div>
                  </a>
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/8 text-primary flex-shrink-0"><MapPin size={16} /></div>
                    <div>
                      <div className="text-xs text-slate-400 mb-0.5">{fr ? "Siège social" : "Headquarters"}</div>
                      <div className="font-medium text-slate-800 text-sm">195 Church Street<br />New Haven, CT — USA</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/8 text-primary flex-shrink-0"><Clock size={16} /></div>
                    <div>
                      <div className="text-xs text-slate-400 mb-0.5">{fr ? "Disponibilité" : "Availability"}</div>
                      <div className="font-medium text-slate-800 text-sm">{fr ? "Lun–Ven 9h–18h (ET)" : "Mon–Fri 9am–6pm (ET)"}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Offices */}
              <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-2">{fr ? "Nos bureaux" : "Our offices"}</h3>
                <p className="text-xs text-slate-400 mb-5">
                  {fr ? "Fondée aux États-Unis en 2023 · Expansion internationale dès 2026" : "Founded in the USA in 2023 · International expansion from 2026"}
                </p>
                <div className="space-y-2">
                  {offices.map((o, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                      <img
                        src={`https://flagcdn.com/24x18/${o.code}.png`}
                        srcSet={`https://flagcdn.com/48x36/${o.code}.png 2x`}
                        width={24} height={18}
                        alt={fr ? o.detailFr : o.detailEn}
                        className="flex-shrink-0 rounded-sm shadow-sm"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800 text-sm">{o.city}</span>
                          {o.hq && <span className="text-xs text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-full">{fr ? "Siège" : "HQ"}</span>}
                        </div>
                        <div className="text-xs text-slate-400">{fr ? o.detailFr : o.detailEn}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="lg:col-span-2">
              <div className="bg-white border border-slate-200 rounded-2xl p-8 md:p-10 shadow-sm">
                {isSubmitted ? (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                      <CheckCircle2 size={40} className="text-primary" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-4">{t.common.success}</h3>
                    <p className="text-slate-500 mb-8 max-w-sm">
                      {fr
                        ? "Merci pour votre message. Un expert Gaméasù vous contactera dans les 24 heures ouvrées."
                        : "Thank you for your message. A Gaméasù expert will contact you within 24 business hours."}
                    </p>
                    <Button onClick={() => setIsSubmitted(false)} variant="outline">
                      {fr ? "Nouveau message" : "New message"}
                    </Button>
                  </motion.div>
                ) : (
                  <Form {...form}>
                    <div className="mb-8">
                      <h2 className="text-2xl font-bold text-slate-900 mb-2">
                        {fr ? "Décrivez votre projet" : "Describe your project"}
                      </h2>
                      <p className="text-slate-500 text-sm">
                        {fr ? "Nos experts analyseront votre demande et reviendront vers vous sous 24h." : "Our experts will analyze your request and get back to you within 24 hours."}
                      </p>
                    </div>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FormField control={form.control} name="name" render={({ field }) => (
                          <FormItem><FormLabel>{t.contact.form.name}</FormLabel><FormControl><Input placeholder="Jean Dupont" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="email" render={({ field }) => (
                          <FormItem><FormLabel>{t.contact.form.email}</FormLabel><FormControl><Input placeholder="jean@company.com" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="phone" render={({ field }) => (
                          <FormItem><FormLabel>{fr ? "Téléphone" : "Phone"}</FormLabel><FormControl><Input placeholder="+1 203 626 2309" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="company" render={({ field }) => (
                          <FormItem><FormLabel>{fr ? "Entreprise / Organisation" : "Company / Organization"}</FormLabel><FormControl><Input placeholder="Acme Corp" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      <FormField control={form.control} name="subject" render={({ field }) => (
                        <FormItem><FormLabel>{fr ? "Domaine d'intervention" : "Area of interest"}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder={fr ? "Choisir votre besoin" : "Choose your need"} /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="cyber">{fr ? "Cybersécurité" : "Cybersecurity"}</SelectItem>
                              <SelectItem value="cloud">{fr ? "Cloud & Infrastructure" : "Cloud & Infrastructure"}</SelectItem>
                              <SelectItem value="ai">{fr ? "IA & Automatisation" : "AI & Automation"}</SelectItem>
                              <SelectItem value="workplace">{fr ? "Modern Workplace" : "Modern Workplace"}</SelectItem>
                              <SelectItem value="transformation">{fr ? "Transformation Digitale" : "Digital Transformation"}</SelectItem>
                              <SelectItem value="consulting">{fr ? "Conseil IT stratégique" : "Strategic IT Consulting"}</SelectItem>
                              <SelectItem value="other">{fr ? "Autre" : "Other"}</SelectItem>
                            </SelectContent>
                          </Select><FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="message" render={({ field }) => (
                        <FormItem><FormLabel>{t.contact.form.message}</FormLabel>
                          <FormControl><Textarea rows={5} placeholder={fr ? "Décrivez votre projet, vos défis et vos objectifs..." : "Describe your project, challenges, and goals..."} {...field} className="resize-none" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <Button type="submit" size="lg" className="w-full text-base font-semibold h-14">
                        {t.contact.form.submit}
                      </Button>
                    </form>
                  </Form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
