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
  { icon: TrendingUp, title: "Pilotage financier OHADA", desc: "Budgets, prévisions et reporting en temps réel" },
  { icon: Globe2,    title: "Multi-entités & workspaces", desc: "Gérez plusieurs filiales depuis une seule plateforme" },
  { icon: Shield,    title: "Sécurité entreprise", desc: "Chiffrement de bout en bout et audit complet" },
  { icon: Users,     title: "Collaboration avancée", desc: "Équipes, rôles et droits d'accès granulaires" },
];

const DEMO_ACCOUNTS = [
  { role: "Super admin",  email: "admin@edole.africa",      password: "admin123" },
  { role: "Responsable",  email: "manager@edole.africa",    password: "manager123" },
  { role: "Commercial",   email: "commercial@edole.africa", password: "commercial123" },
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
          toast({ variant: "destructive", title: "Échec de la connexion", description: "Identifiants incorrects. Vérifiez votre e-mail et mot de passe." });
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
    <div className="min-h-screen w-full flex bg-[#0A1628]">

      {/* ═══════════════════════════════════════════════════
          PANNEAU GAUCHE — Identité de marque
      ═══════════════════════════════════════════════════ */}
      <div className="hidden lg:flex flex-col w-[52%] xl:w-[58%] relative overflow-hidden">

        {/* ── Zone HAUTE : fond blanc avec logo original ── */}
        <div className="relative flex flex-col items-center justify-center px-10 xl:px-16 py-12"
             style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F7F4EE 100%)", minHeight: "42%" }}>
          {/* Texture très subtile */}
          <div className="absolute inset-0 pointer-events-none opacity-40"
               style={{ backgroundImage: "radial-gradient(rgba(15,26,58,0.04) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
          {/* Halo or derrière le logo */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-24 pointer-events-none"
               style={{ background: "radial-gradient(ellipse at 50% 100%, rgba(200,162,75,0.10) 0%, transparent 70%)" }} />

          {/* Barre de statut en haut */}
          <div className="absolute top-5 right-6">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#0F1A3A]/10 bg-white/80 shadow-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-[#0F1A3A]/50 font-medium">Système opérationnel</span>
            </div>
          </div>

          {/* Logo original en couleurs */}
          <div className="relative w-full max-w-[300px] xl:max-w-[360px]">
            <img
              src={BRANDING.logoFullTransparent}
              alt={BRANDING.appName}
              draggable={false}
              className="w-full h-auto object-contain select-none"
              style={{ filter: "drop-shadow(0 4px 16px rgba(15,26,58,0.08))" }}
            />
          </div>
        </div>

        {/* Séparateur avec vague */}
        <div className="relative h-px bg-gradient-to-r from-transparent via-[#C8A24B]/30 to-transparent" />

        {/* ── Zone BASSE : fond navy avec tagline + features ── */}
        <div
          className="relative flex-1 flex flex-col px-10 xl:px-14 py-10 overflow-hidden"
          style={{ background: "linear-gradient(160deg, #0F1A3A 0%, #0A1628 70%, #071020 100%)" }}
        >
          {/* Texture points */}
          <div className="absolute inset-0 pointer-events-none"
               style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
          {/* Halo lumineux */}
          <div className="absolute inset-0 pointer-events-none"
               style={{ background: "radial-gradient(ellipse 70% 60% at 30% 20%, rgba(200,162,75,0.07) 0%, transparent 65%)" }} />
          {/* Ligne dorée verticale */}
          <div className="absolute top-0 left-0 w-px h-full opacity-15"
               style={{ background: "linear-gradient(180deg, #C8A24B 0%, transparent 100%)" }} />

          {/* Tagline */}
          <div className="relative mb-8">
            <p className="text-white/90 text-lg xl:text-xl font-light tracking-wide leading-relaxed">
              {BRANDING.appTaglineFr}
            </p>
            <div className="mt-3 h-px w-12 bg-gradient-to-r from-[#C8A24B] to-transparent opacity-70" />
          </div>

          {/* Features */}
          <div className="relative flex-1 space-y-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3.5">
                <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                     style={{ background: "rgba(200,162,75,0.12)", border: "1px solid rgba(200,162,75,0.20)" }}>
                  <Icon className="w-3.5 h-3.5 text-[#C8A24B]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white/85 leading-none mb-1">{title}</p>
                  <p className="text-xs text-white/40 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer gauche */}
          <div className="relative mt-8 flex items-center justify-between">
            <p className="text-[11px] text-white/25">© {year} {BRANDING.legalName}</p>
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-white/20" />
              <span className="text-[10px] text-white/25">TLS 1.3</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          PANNEAU DROIT — Formulaire
      ═══════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col bg-[#F8F7F4] relative">
        {/* Texture très subtile */}
        <div className="absolute inset-0 pointer-events-none opacity-30"
             style={{ backgroundImage: "radial-gradient(rgba(15,26,58,0.03) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />

        {/* Logo mobile */}
        <div className="relative lg:hidden flex justify-center pt-10 pb-2">
          <img src={BRANDING.logoFullTransparent} alt={BRANDING.appName}
               className="h-12 w-auto object-contain" style={{ filter: "brightness(0) saturate(100%) invert(12%) sepia(47%) saturate(1200%) hue-rotate(200deg)" }} />
        </div>

        <div className="relative flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-[400px]">

            {/* En-tête formulaire */}
            <div className="mb-8">
              <h1 className="text-[28px] font-bold tracking-tight text-[#0F1A3A] leading-tight mb-1.5"
                  style={{ fontFamily: "var(--font-display, system-ui)", letterSpacing: "-0.025em" }}>
                Connexion
              </h1>
              <p className="text-[14px] text-[#0F1A3A]/50 leading-relaxed">
                Accédez à votre espace de travail {BRANDING.appName}.
              </p>
            </div>

            {/* Formulaire */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-[13px] font-semibold text-[#0F1A3A]/70 tracking-wide">
                        Adresse e-mail
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="prenom.nom@entreprise.com"
                          autoComplete="email"
                          className="h-11 border-[#0F1A3A]/15 bg-white text-[14px] placeholder:text-[#0F1A3A]/30
                                     focus-visible:ring-2 focus-visible:ring-[#C8A24B]/40 focus-visible:border-[#C8A24B]/70
                                     transition-all duration-200 shadow-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-[12px]" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-[13px] font-semibold text-[#0F1A3A]/70 tracking-wide">
                        Mot de passe
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••••"
                            autoComplete="current-password"
                            className="h-11 pr-10 border-[#0F1A3A]/15 bg-white text-[14px] placeholder:text-[#0F1A3A]/30
                                       focus-visible:ring-2 focus-visible:ring-[#C8A24B]/40 focus-visible:border-[#C8A24B]/70
                                       transition-all duration-200 shadow-sm"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0F1A3A]/30 hover:text-[#0F1A3A]/60 transition-colors"
                            tabIndex={-1}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage className="text-[12px]" />
                    </FormItem>
                  )}
                />

                <div className="pt-1">
                  <Button
                    type="submit"
                    disabled={loginMutation.isPending}
                    className="w-full h-11 text-[14px] font-semibold tracking-wide transition-all duration-200
                               shadow-lg hover:shadow-xl active:scale-[0.99]"
                    style={{
                      background: loginMutation.isPending
                        ? "rgba(15,26,58,0.4)"
                        : "linear-gradient(135deg, #C8A24B 0%, #B8922E 100%)",
                      color: "#fff",
                      border: "none",
                    }}
                  >
                    {loginMutation.isPending ? (
                      <span className="flex items-center gap-2.5">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Authentification en cours…
                      </span>
                    ) : "Accéder à la plateforme"}
                  </Button>
                </div>
              </form>
            </Form>

            {/* Séparateur */}
            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-[#0F1A3A]/10" />
              <span className="text-[11px] text-[#0F1A3A]/35 font-medium tracking-widest uppercase">Démo</span>
              <div className="flex-1 h-px bg-[#0F1A3A]/10" />
            </div>

            {/* Accès démonstration */}
            <div className="rounded-xl border border-[#0F1A3A]/10 bg-white overflow-hidden shadow-sm">
              <button
                type="button"
                onClick={() => setShowDemo((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#0F1A3A]/[0.02] transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center"
                       style={{ background: "rgba(200,162,75,0.10)", border: "1px solid rgba(200,162,75,0.20)" }}>
                    <Shield className="w-3 h-3 text-[#C8A24B]" />
                  </div>
                  <span className="text-[12px] font-semibold text-[#0F1A3A]/70">Comptes de démonstration</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-[#0F1A3A]/35 transition-transform duration-200 ${showDemo ? "rotate-180" : ""}`} />
              </button>

              {showDemo && (
                <div className="border-t border-[#0F1A3A]/08 divide-y divide-[#0F1A3A]/06">
                  {DEMO_ACCOUNTS.map(({ role, email, password }) => (
                    <button
                      key={email}
                      type="button"
                      onClick={() => fillDemo(email, password)}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-[#C8A24B]/[0.04] transition-colors group"
                    >
                      <div>
                        <p className="text-[12px] font-semibold text-[#0F1A3A]/80 group-hover:text-[#0F1A3A]">{role}</p>
                        <p className="text-[11px] text-[#0F1A3A]/40 font-mono mt-0.5">{email}</p>
                      </div>
                      <span className="text-[10px] font-medium text-[#C8A24B] opacity-0 group-hover:opacity-100 transition-opacity">
                        Utiliser →
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Footer droit */}
        <div className="relative px-6 pb-6 text-center">
          <p className="text-[11px] text-[#0F1A3A]/30 leading-relaxed">
            {BRANDING.marketBaseline}
          </p>
          <p className="text-[10px] text-[#0F1A3A]/20 mt-1">
            © {year} {BRANDING.legalName} — Tous droits réservés.
          </p>
        </div>
      </div>
    </div>
  );
}
