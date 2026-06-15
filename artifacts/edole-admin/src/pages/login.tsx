import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { BRANDING } from "@/config/branding";
import {
  Shield, Globe2, TrendingUp, Users,
  ChevronDown, Loader2, Eye, EyeOff,
  ArrowRight, CheckCircle2,
} from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Adresse e-mail invalide"),
  password: z.string().min(1, "Le mot de passe est obligatoire"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const FEATURES = [
  { icon: TrendingUp,  title: "Pilotage financier",           desc: "Budgets, prévisions et reporting consolidés en temps réel" },
  { icon: Globe2,      title: "Multi-entités & workspaces",   desc: "Gérez plusieurs filiales depuis une seule plateforme unifiée" },
  { icon: Shield,      title: "Sécurité niveau entreprise",   desc: "Chiffrement TLS 1.3, audit complet, contrôle d'accès RBAC" },
  { icon: Users,       title: "Collaboration en temps réel",  desc: "Équipes, rôles et droits d'accès granulaires" },
];

const DEMO_ACCOUNTS = [
  { role: "Super administrateur", email: "admin@gameasu.tech",      password: "admin123" },
  { role: "Directeur",            email: "directeur@gameasu.tech",  password: "admin123" },
  { role: "Commercial",           email: "commercial@gameasu.tech", password: "commercial123" },
  { role: "Finance",              email: "finance@gameasu.tech",    password: "finance123" },
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
    <div className="min-h-screen w-full flex" style={{ fontFamily: "var(--app-font-display, system-ui)" }}>

      {/* ══════════════════════════════════════════════
          PANNEAU GAUCHE — fond navy premium
      ══════════════════════════════════════════════ */}
      <div
        className="hidden lg:flex flex-col w-[48%] xl:w-[50%] relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #080E1C 0%, #0A1322 45%, #0C1830 100%)" }}
      >
        {/* Grille de points ultra-subtile */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

        {/* Orbe bleu électrique (couleur du G dans le logo) */}
        <div className="absolute pointer-events-none"
          style={{
            top: "-10%", left: "-5%",
            width: "60%", height: "55%",
            background: "radial-gradient(ellipse at center, rgba(29,108,232,0.13) 0%, transparent 70%)",
            filter: "blur(40px)",
          }} />
        {/* Orbe bleu clair (couleur du point dans le logo) */}
        <div className="absolute pointer-events-none"
          style={{
            bottom: "5%", right: "-8%",
            width: "55%", height: "50%",
            background: "radial-gradient(ellipse at center, rgba(91,163,240,0.08) 0%, transparent 70%)",
            filter: "blur(50px)",
          }} />

        {/* Liseré bleu électrique à droite — miroir du logo */}
        <div className="absolute top-0 right-0 w-px h-full"
          style={{ background: "linear-gradient(180deg, transparent 0%, rgba(29,108,232,0.4) 25%, rgba(91,163,240,0.3) 75%, transparent 100%)" }} />

        {/* Contenu */}
        <div className="relative flex-1 flex flex-col justify-between px-10 xl:px-14 py-14">

          {/* Logo seul — confiant, sans cartouche */}
          <div>
            <img
              src={BRANDING.logoFullTransparent}
              alt={BRANDING.appName}
              draggable={false}
              className="h-auto select-none block"
              style={{
                width: "220px",
                filter: "brightness(0) invert(1)",
                opacity: 0.95,
              }}
            />
          </div>

          {/* Zone centrale */}
          <div>
            {/* Accroche principale */}
            <div className="mb-12">
              <p className="text-[11px] font-semibold tracking-[0.18em] uppercase mb-4"
                style={{ color: "rgba(91,163,240,0.7)" }}>
                Plateforme ERP Gaméasù
              </p>
              <h2 className="text-[30px] xl:text-[34px] font-bold leading-[1.18] text-white mb-5"
                style={{ letterSpacing: "-0.03em" }}>
                Gérez votre entreprise<br />avec précision.
              </h2>
              <p className="text-[13.5px] leading-relaxed" style={{ color: "rgba(255,255,255,0.38)" }}>
                Une solution complète pour les organisations africaines qui veulent piloter leur performance en temps réel.
              </p>
            </div>

            {/* Séparateur */}
            <div className="w-12 h-px mb-10"
              style={{ background: "linear-gradient(90deg, rgba(29,108,232,0.6), transparent)" }} />

            {/* Fonctionnalités */}
            <div className="space-y-5">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3.5">
                  <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{
                      background: "rgba(29,108,232,0.12)",
                      border: "1px solid rgba(29,108,232,0.22)",
                    }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: "rgba(91,163,240,0.85)" }} />
                  </div>
                  <div>
                    <p className="text-[12.5px] font-semibold leading-none mb-1" style={{ color: "rgba(255,255,255,0.82)" }}>{title}</p>
                    <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.30)" }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.18)" }}>
              © {year} {BRANDING.legalName}
            </p>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3" style={{ color: "rgba(91,163,240,0.3)" }} />
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.18)" }}>Connexion chiffrée TLS 1.3</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          PANNEAU DROIT — formulaire
      ══════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col relative" style={{ background: "#FAFBFC" }}>
        {/* Subtil fond avec micro-texture */}
        <div className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage: "radial-gradient(rgba(29,108,232,0.04) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }} />
        {/* Halo bleu très subtil en haut à gauche */}
        <div className="absolute top-0 left-0 w-[400px] h-[300px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at top left, rgba(29,108,232,0.05) 0%, transparent 70%)" }} />

        {/* Logo mobile */}
        <div className="relative lg:hidden flex justify-center pt-10 pb-2">
          <img
            src={BRANDING.logoFullTransparent}
            alt={BRANDING.appName}
            className="h-9 w-auto object-contain"
          />
        </div>

        <div className="relative flex-1 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-[400px]">

            {/* En-tête formulaire */}
            <div className="mb-9">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 rounded-full"
                  style={{ background: "linear-gradient(180deg, #1D6CE8 0%, #5BA3F0 100%)" }} />
                <span className="text-[11px] font-bold tracking-[0.16em] uppercase"
                  style={{ color: "#1D6CE8" }}>
                  Espace sécurisé
                </span>
              </div>
              <h1 className="text-[28px] font-bold leading-tight text-[#080E1C]"
                style={{ letterSpacing: "-0.032em" }}>
                Connexion
              </h1>
              <p className="text-[13px] mt-2 leading-relaxed" style={{ color: "rgba(8,14,28,0.42)" }}>
                Accédez à votre espace de travail {BRANDING.appName}.
              </p>
            </div>

            {/* Carte formulaire */}
            <div
              className="rounded-2xl p-7"
              style={{
                background: "#FFFFFF",
                boxShadow: "0 1px 3px rgba(8,14,28,0.06), 0 8px 32px rgba(8,14,28,0.07), 0 0 0 1px rgba(8,14,28,0.055)",
              }}
            >
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

                  {/* Email */}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[11.5px] font-bold tracking-wide uppercase"
                          style={{ color: "rgba(8,14,28,0.50)", letterSpacing: "0.08em" }}>
                          Adresse e-mail
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="prenom.nom@entreprise.com"
                            autoComplete="email"
                            className="h-[46px] rounded-xl text-[13.5px] transition-all duration-200"
                            style={{
                              background: "#F6F8FB",
                              border: "1.5px solid rgba(8,14,28,0.10)",
                              color: "#080E1C",
                            }}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />

                  {/* Mot de passe */}
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-[11.5px] font-bold tracking-wide uppercase"
                            style={{ color: "rgba(8,14,28,0.50)", letterSpacing: "0.08em" }}>
                            Mot de passe
                          </FormLabel>
                        </div>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••••"
                              autoComplete="current-password"
                              className="h-[46px] pr-12 rounded-xl text-[13.5px] transition-all duration-200"
                              style={{
                                background: "#F6F8FB",
                                border: "1.5px solid rgba(8,14,28,0.10)",
                                color: "#080E1C",
                              }}
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((v) => !v)}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                              style={{ color: "rgba(8,14,28,0.28)" }}
                              tabIndex={-1}
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />

                  {/* Bouton */}
                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={loginMutation.isPending}
                      className="w-full h-[46px] rounded-xl text-[13.5px] font-semibold text-white flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-[0.985] disabled:opacity-60"
                      style={{
                        background: loginMutation.isPending
                          ? "#1D6CE8"
                          : "linear-gradient(135deg, #1D6CE8 0%, #1558C8 100%)",
                        boxShadow: loginMutation.isPending
                          ? "none"
                          : "0 4px 20px rgba(29,108,232,0.32), 0 1px 3px rgba(29,108,232,0.2)",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {loginMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />Authentification…</>
                      ) : (
                        <><span>Accéder à la plateforme</span><ArrowRight className="w-4 h-4" /></>
                      )}
                    </button>
                  </div>
                </form>
              </Form>
            </div>

            {/* Comptes de démonstration */}
            <div className="mt-3">
              <div
                className="rounded-xl overflow-hidden"
                style={{
                  background: "rgba(255,255,255,0.80)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(8,14,28,0.07)",
                  boxShadow: "0 1px 4px rgba(8,14,28,0.04)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowDemo((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-white/60"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center"
                      style={{ background: "rgba(29,108,232,0.09)", border: "1px solid rgba(29,108,232,0.16)" }}>
                      <Shield className="w-3 h-3" style={{ color: "#1D6CE8" }} />
                    </div>
                    <span className="text-[12px] font-semibold" style={{ color: "rgba(8,14,28,0.55)" }}>
                      Comptes de démonstration
                    </span>
                  </div>
                  <ChevronDown
                    className="w-3.5 h-3.5 transition-transform duration-200"
                    style={{ color: "rgba(8,14,28,0.28)", transform: showDemo ? "rotate(180deg)" : "rotate(0deg)" }}
                  />
                </button>

                {showDemo && (
                  <div style={{ borderTop: "1px solid rgba(8,14,28,0.06)" }}>
                    {DEMO_ACCOUNTS.map(({ role, email, password }) => (
                      <button
                        key={email}
                        type="button"
                        onClick={() => fillDemo(email, password)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors group"
                        style={{ borderBottom: "1px solid rgba(8,14,28,0.04)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(29,108,232,0.04)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <div>
                          <p className="text-[12px] font-semibold" style={{ color: "rgba(8,14,28,0.72)" }}>{role}</p>
                          <p className="text-[10.5px] font-mono mt-0.5" style={{ color: "rgba(8,14,28,0.35)" }}>{email}</p>
                        </div>
                        <span className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ color: "#1D6CE8" }}>
                          Utiliser →
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer formulaire */}
            <p className="text-center mt-6 text-[10.5px]" style={{ color: "rgba(8,14,28,0.22)" }}>
              En vous connectant, vous acceptez les conditions d'utilisation de {BRANDING.legalName}.
            </p>

          </div>
        </div>
      </div>
    </div>
  );
}
