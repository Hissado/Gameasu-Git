import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { BRANDING } from "@/config/branding";
import { Shield, Globe2, TrendingUp, Users, ChevronDown, Loader2, Eye, EyeOff } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Adresse e-mail invalide"),
  password: z.string().min(1, "Le mot de passe est obligatoire"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const FEATURES = [
  { icon: TrendingUp, title: "Pilotage financier", desc: "Budgets, prévisions et reporting consolidés" },
  { icon: Globe2,    title: "Multi-entités & workspaces", desc: "Gérez plusieurs filiales depuis une seule plateforme" },
  { icon: Shield,    title: "Sécurité niveau entreprise", desc: "Chiffrement TLS 1.3, audit complet, RBAC" },
  { icon: Users,     title: "Collaboration en temps réel", desc: "Équipes, rôles, droits d'accès granulaires" },
];

const DEMO_ACCOUNTS = [
  { role: "Super administrateur", email: "admin@edole.africa",      password: "admin123" },
  { role: "Responsable",          email: "manager@edole.africa",    password: "manager123" },
  { role: "Commercial",           email: "commercial@edole.africa", password: "commercial123" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const [showPassword, setShowPassword] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (data: LoginFormValues) => {
    loginMutation.mutate(
      { data },
      {
        onSuccess: (res) => { login(res.token); setLocation("/"); },
        onError: () => {
          toast({ variant: "destructive", title: "Échec de la connexion", description: "Identifiants incorrects. Vérifiez votre e-mail et votre mot de passe." });
        },
      },
    );
  };

  const fillDemo = (email: string, password: string) => {
    form.setValue("email", email);
    form.setValue("password", password);
    setShowDemo(false);
  };

  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen w-full flex" style={{ background: "#F5F4F1" }}>

      {/* ══════════════════════════════════════════════
          PANNEAU GAUCHE — fond navy unifié
      ══════════════════════════════════════════════ */}
      <div
        className="hidden lg:flex flex-col w-[52%] xl:w-[55%] relative overflow-hidden"
        style={{ background: "linear-gradient(155deg, #0F1A3A 0%, #0B1529 55%, #071020 100%)" }}
      >
        {/* Grille de points */}
        <div className="absolute inset-0 pointer-events-none"
             style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        {/* Halos */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: [
            "radial-gradient(ellipse 65% 50% at 40% 30%, rgba(200,162,75,0.08) 0%, transparent 65%)",
            "radial-gradient(ellipse 55% 45% at 70% 80%, rgba(15,26,58,0.5) 0%, transparent 60%)",
          ].join(","),
        }} />
        {/* Liseré doré gauche */}
        <div className="absolute top-0 left-0 w-[2px] h-full opacity-30"
             style={{ background: "linear-gradient(180deg, transparent 0%, #C8A24B 20%, #C8A24B 80%, transparent 100%)" }} />

        {/* Header interne */}
        <div className="relative flex items-center justify-end px-10 pt-7">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.04]">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-white/40 font-medium">Système opérationnel</span>
          </div>
        </div>

        {/* Contenu centré */}
        <div className="relative flex-1 flex flex-col items-center justify-center px-10 xl:px-14">

          {/* ── Logo dans un cadre blanc flottant ── */}
          <div
            className="w-full max-w-[460px] xl:max-w-[500px] rounded-2xl mb-10 px-2 py-2"
            style={{
              background: "linear-gradient(145deg, #FFFFFF 0%, #F8F5EE 100%)",
              boxShadow: "0 20px 60px -12px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06)",
            }}
          >
            <img
              src={BRANDING.logoFullTransparent}
              alt={BRANDING.appName}
              draggable={false}
              className="w-full h-auto object-contain select-none"
              style={{ filter: "drop-shadow(0 2px 8px rgba(15,26,58,0.06))" }}
            />
          </div>

          {/* Tagline */}
          <div className="text-center mb-10">
            <p className="text-white/85 text-[17px] xl:text-[18px] font-light tracking-wide leading-relaxed">
              {BRANDING.appTaglineFr}
            </p>
            <div className="mt-3 mx-auto h-[1px] w-10 bg-[#C8A24B]/50" />
          </div>

          {/* Fonctionnalités */}
          <div className="w-full max-w-[330px] xl:max-w-[360px] space-y-3.5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                     style={{ background: "rgba(200,162,75,0.10)", border: "1px solid rgba(200,162,75,0.18)" }}>
                  <Icon className="w-3.5 h-3.5 text-[#C8A24B]" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-white/85 leading-none mb-1">{title}</p>
                  <p className="text-[11.5px] text-white/38 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative px-10 pb-7 flex items-center justify-between">
          <p className="text-[10.5px] text-white/22">© {year} {BRANDING.legalName}</p>
          <div className="flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-white/18" />
            <span className="text-[10px] text-white/22">Connexion chiffrée TLS 1.3</span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          PANNEAU DROIT — formulaire
      ══════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col relative" style={{ background: "#F5F4F1" }}>
        {/* Très légère texture */}
        <div className="absolute inset-0 pointer-events-none opacity-25"
             style={{ backgroundImage: "radial-gradient(rgba(15,26,58,0.035) 1px, transparent 1px)", backgroundSize: "22px 22px" }} />

        {/* Logo mobile */}
        <div className="relative lg:hidden flex justify-center pt-10">
          <img src={BRANDING.logoFullTransparent} alt={BRANDING.appName}
               className="h-10 w-auto object-contain"
               style={{ filter: "drop-shadow(0 1px 3px rgba(15,26,58,0.12))" }} />
        </div>

        <div className="relative flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-[390px]">

            {/* En-tête */}
            <div className="mb-8">
              <h1
                className="text-[26px] font-bold leading-tight text-[#0F1A3A]"
                style={{ letterSpacing: "-0.028em", fontFamily: "var(--app-font-display, system-ui)" }}
              >
                Connexion
              </h1>
              <p className="text-[13.5px] text-[#0F1A3A]/45 mt-1.5 leading-relaxed">
                Accédez à votre espace de travail {BRANDING.appName}.
              </p>
            </div>

            {/* Formulaire dans une carte blanche */}
            <div
              className="rounded-2xl p-6"
              style={{
                background: "#FFFFFF",
                boxShadow: "0 2px 16px rgba(15,26,58,0.06), 0 0 0 1px rgba(15,26,58,0.06)",
              }}
            >
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[12.5px] font-semibold text-[#0F1A3A]/65 tracking-wide">
                          Adresse e-mail
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="prenom.nom@entreprise.com"
                            autoComplete="email"
                            className="h-11 bg-[#F8F7F4] border-[#0F1A3A]/12 text-[14px] placeholder:text-[#0F1A3A]/28 rounded-xl
                                       focus-visible:ring-2 focus-visible:ring-[#C8A24B]/35 focus-visible:border-[#C8A24B]/55 transition-all duration-200"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-[11.5px]" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[12.5px] font-semibold text-[#0F1A3A]/65 tracking-wide">
                          Mot de passe
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••••"
                              autoComplete="current-password"
                              className="h-11 pr-11 bg-[#F8F7F4] border-[#0F1A3A]/12 text-[14px] placeholder:text-[#0F1A3A]/28 rounded-xl
                                         focus-visible:ring-2 focus-visible:ring-[#C8A24B]/35 focus-visible:border-[#C8A24B]/55 transition-all duration-200"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((v) => !v)}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#0F1A3A]/28 hover:text-[#0F1A3A]/55 transition-colors"
                              tabIndex={-1}
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage className="text-[11.5px]" />
                      </FormItem>
                    )}
                  />

                  <div className="pt-1.5">
                    <button
                      type="submit"
                      disabled={loginMutation.isPending}
                      className="w-full h-11 rounded-xl text-[13.5px] font-semibold tracking-wide text-white transition-all duration-200 flex items-center justify-center gap-2.5
                                 disabled:opacity-60 active:scale-[0.985]"
                      style={{
                        background: "linear-gradient(135deg, #C8A24B 0%, #B8922E 100%)",
                        boxShadow: loginMutation.isPending ? "none" : "0 4px 14px rgba(200,162,75,0.30)",
                      }}
                    >
                      {loginMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />Authentification…</>
                      ) : "Accéder à la plateforme →"}
                    </button>
                  </div>
                </form>
              </Form>
            </div>

            {/* Démonstration */}
            <div className="mt-4">
              <div
                className="rounded-xl overflow-hidden border border-[#0F1A3A]/08"
                style={{ background: "rgba(255,255,255,0.65)", backdropFilter: "blur(8px)" }}
              >
                <button
                  type="button"
                  onClick={() => setShowDemo((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/80 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center"
                         style={{ background: "rgba(200,162,75,0.12)", border: "1px solid rgba(200,162,75,0.22)" }}>
                      <Shield className="w-3 h-3 text-[#C8A24B]" />
                    </div>
                    <span className="text-[12px] font-semibold text-[#0F1A3A]/60">Comptes de démonstration</span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-[#0F1A3A]/30 transition-transform duration-200 ${showDemo ? "rotate-180" : ""}`} />
                </button>

                {showDemo && (
                  <div className="border-t border-[#0F1A3A]/06 divide-y divide-[#0F1A3A]/05">
                    {DEMO_ACCOUNTS.map(({ role, email, password }) => (
                      <button
                        key={email}
                        type="button"
                        onClick={() => fillDemo(email, password)}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-[#C8A24B]/[0.05] transition-colors group"
                      >
                        <div>
                          <p className="text-[12px] font-semibold text-[#0F1A3A]/75 group-hover:text-[#0F1A3A]">{role}</p>
                          <p className="text-[10.5px] text-[#0F1A3A]/38 font-mono mt-0.5">{email}</p>
                        </div>
                        <span className="text-[10px] font-semibold text-[#C8A24B] opacity-0 group-hover:opacity-100 transition-opacity">
                          Utiliser
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Footer droit */}
        <div className="relative px-6 pb-6" />
      </div>
    </div>
  );
}
