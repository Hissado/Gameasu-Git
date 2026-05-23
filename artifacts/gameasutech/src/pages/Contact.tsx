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
import { CheckCircle2 } from "lucide-react";

export default function Contact() {
  const { t, language } = useLanguage();
  const [isSubmitted, setIsSubmitted] = React.useState(false);

  const formSchema = z.object({
    name: z.string().min(2, language === 'fr' ? "Le nom est requis" : "Name is required"),
    email: z.string().email(language === 'fr' ? "Email invalide" : "Invalid email"),
    phone: z.string().min(5, language === 'fr' ? "Téléphone requis" : "Phone is required"),
    company: z.string().min(2, language === 'fr' ? "L'entreprise est requise" : "Company is required"),
    subject: z.string().min(2, language === 'fr' ? "Le sujet est requis" : "Subject is required"),
    message: z.string().min(10, language === 'fr' ? "Message trop court" : "Message too short"),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "", email: "", phone: "", company: "", subject: "", message: ""
    }
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
    setIsSubmitted(true);
  }

  return (
    <div className="min-h-screen pt-32 pb-24">
      <div className="container mx-auto px-6 max-w-6xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">{t.contact.title}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">{t.contact.subtitle}</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-card p-8 rounded-xl border border-border shadow-lg">
              <h3 className="text-xl font-bold mb-6 text-foreground">{language === 'fr' ? 'Informations de contact' : 'Contact Information'}</h3>
              
              <div className="space-y-6">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Email</div>
                  <div className="font-medium">contact@gameasutech.com</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">{language === 'fr' ? 'Téléphone' : 'Phone'}</div>
                  <div className="font-medium">+1 (555) 123-4567</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">{language === 'fr' ? 'Siège social' : 'Headquarters'}</div>
                  <div className="font-medium">San Francisco, CA<br/>United States</div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-card p-8 md:p-12 rounded-xl border border-border shadow-lg">
              {isSubmitted ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  className="flex flex-col items-center justify-center py-12 text-center"
                >
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 size={40} className="text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4">{t.common.success}</h3>
                  <p className="text-muted-foreground mb-8">
                    {language === 'fr' 
                      ? "Merci pour votre message. Notre équipe vous contactera dans les plus brefs délais." 
                      : "Thank you for your message. Our team will contact you shortly."}
                  </p>
                  <Button onClick={() => setIsSubmitted(false)} variant="outline">
                    {language === 'fr' ? 'Nouveau message' : 'New message'}
                  </Button>
                </motion.div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.contact.form.name}</FormLabel>
                          <FormControl><Input placeholder="John Doe" {...field} className="bg-background/50" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.contact.form.email}</FormLabel>
                          <FormControl><Input placeholder="john@company.com" {...field} className="bg-background/50" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="phone" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'fr' ? 'Téléphone' : 'Phone'}</FormLabel>
                          <FormControl><Input placeholder="+1 234 567 890" {...field} className="bg-background/50" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="company" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'fr' ? 'Entreprise' : 'Company'}</FormLabel>
                          <FormControl><Input placeholder="Acme Inc." {...field} className="bg-background/50" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    
                    <FormField control={form.control} name="subject" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === 'fr' ? 'Sujet' : 'Subject'}</FormLabel>
                        <FormControl><Input placeholder={language === 'fr' ? 'Comment pouvons-nous vous aider ?' : 'How can we help you?'} {...field} className="bg-background/50" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="message" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.contact.form.message}</FormLabel>
                        <FormControl><Textarea rows={5} placeholder={language === 'fr' ? 'Détaillez votre besoin...' : 'Detail your needs...'} {...field} className="bg-background/50 resize-none" /></FormControl>
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
  );
}
