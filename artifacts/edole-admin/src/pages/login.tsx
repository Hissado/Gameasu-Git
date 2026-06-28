import React, { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth, consumeInactivityFlag } from "@/lib/auth";
import { useLocation } from "wouter";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { BRANDING } from "@/config/branding";
import {
  Shield, Globe2, TrendingUp, Users,
  ChevronDown, Loader2, Eye, EyeOff,
  ArrowRight, CheckCircle2, Mail, RefreshCw,
} from "lucide-react";

const DEVICE_TOKEN_KEY = "gameasu_device_token";

const loginSchema = z.object({
  email: z.string().email("Adresse e-mail invalide"),
  password: z.string().min(1, "Le mot de passe est obligatoire"),
  rememberMe: z.boolean().optional(),
});
type LoginFormValues = z.infer<typeof loginSchema>;

const FEATURES = [
  { icon: TrendingUp,  title: "Pilotage financier",           desc: "Budgets, prévisions et reporting consolidés en temps réel" },
  { icon: Globe2,      title: "Multi-entités & workspaces",   desc: "Gérez plusieurs filiales depuis une seule plateforme unifiée" },
  { icon: Shield,      title: "Sécurité niveau entreprise",   desc: "Chiffrement TLS 1.3, audit complet, contrôle d'accès RBAC" },
  { icon: Users,       title: "Collaboration en temps réel",  desc: "Équipes, rôles et droits d'accès granulaires" },
];

// Les identifiants de démo ne sont définis qu'en développement. En production,
// Vite remplace `import.meta.env.DEV` par `false`, donc ce tableau devient `[]`
// et les identifiants sont éliminés du bundle (aucune fuite côté client).
const DEMO_ACCOUNTS = import.meta.env.DEV
  ? [
      { role: "Super administrateur", email: "admin@gameasu.tech",      password: "admin123" },
      { role: "Directeur",            email: "directeur@gameasu.tech",  password: "admin123" },
      { role: "Commercial",           email: "commercial@gameasu.tech", password: "commercial123" },
      { role: "Finance",              email: "finance@gameasu.tech",    password: "finance123" },
    ]
  : [];

type Step = "credentials" | "2fa" | "forgot";

export default function LoginPage() {
  const { login } = useAuth();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("credentials");
  const [tempToken, setTempToken] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  // Afficher un message si la déconnexion était due à l'inactivité
  useEffect(() => {
    if (consumeInactivityFlag()) {
      toast({
        title: "Session expirée",
        description: "Vous avez été déconnecté après 60 minutes d'inactivité.",
      });
    }
  }, []);

  const [devOtp, setDevOtp] = useState<string | null>(null);

  // OTP input — 6 chiffres individuels
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([null, null, null, null, null, null]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  // ─── Étape 1 : soumettre identifiants ────────────────────────────────────
  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      const deviceToken = localStorage.getItem(DEVICE_TOKEN_KEY) ?? undefined;
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password, ...(deviceToken ? { deviceToken } : {}) }),
      });
      const json = await res.json() as any;

      if (!res.ok) {
        toast({ variant: "destructive", title: "Échec de la connexion", description: json.error ?? "Identifiants incorrects." });
        return;
      }

      if (json.status === "2fa_required") {
        setTempToken(json.tempToken);
        setPendingEmail(data.email);
        setStep("2fa");
        if (json.devOtp) {
          setDevOtp(json.devOtp);
          setOtp(json.devOtp.split(""));
        } else {
          setDevOtp(null);
          setOtp(["", "", "", "", "", ""]);
        }
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
        return;
      }

      // Trusted device bypass — session directe
      finishLogin(json);
    } catch {
      toast({ variant: "destructive", title: "Erreur réseau", description: "Impossible de contacter le serveur." });
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Étape 2 : valider le code OTP ───────────────────────────────────────
  const onVerify2FA = async (overrideDigits?: string[]) => {
    const code = (overrideDigits ?? otp).join("").trim();
    if (code.length !== 6) {
      toast({ variant: "destructive", title: "Code incomplet", description: "Saisissez les 6 chiffres." });
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempToken, code, rememberMe }),
      });
      const json = await res.json() as any;
      if (!res.ok) {
        toast({ variant: "destructive", title: "Code incorrect", description: json.error ?? "Le code est invalide ou expiré." });
        setOtp(["", "", "", "", "", ""]);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
        return;
      }
      finishLogin(json);
    } catch {
      toast({ variant: "destructive", title: "Erreur réseau", description: "Impossible de contacter le serveur." });
    } finally {
      setIsLoading(false);
    }
  };

  const finishLogin = (json: any) => {
    if (json.deviceToken) {
      localStorage.setItem(DEVICE_TOKEN_KEY, json.deviceToken);
    }
    login(json.token);
    setLocation("/");
  };

  // ─── OTP keyboard handling ────────────────────────────────────────────────
  const handleOtpChange = (i: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[i] = digit;
    setOtp(next);
    if (digit && i < 5) otpRefs.current[i + 1]?.focus();
    if (next.join("").length === 6) {
      setTimeout(() => onVerify2FA(next), 80);
    }
  };

  const handleOtpKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) {
      otpRefs.current[i - 1]?.focus();
    }
    if (e.key === "Enter") onVerify2FA();
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6).split("");
    const next = [...otp];
    digits.forEach((d, i) => { next[i] = d; });
    setOtp(next);
    const focusIdx = Math.min(digits.length, 5);
    otpRefs.current[focusIdx]?.focus();
    if (digits.length === 6) setTimeout(() => onVerify2FA(next), 80);
  };

  const onForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim().toLowerCase() }),
      });
      setForgotSent(true);
    } catch {
      setForgotSent(true);
    } finally {
      setForgotLoading(false);
    }
  };

  const fillDemo = (email: string, password: string) => {
    form.setValue("email", email);
    form.setValue("password", password);
    setShowDemo(false);
  };

  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen w-full flex" style={{ fontFamily: "var(--app-font-display, system-ui)" }}>

      {/* ══ PANNEAU GAUCHE ══════════════════════════════════════════════════ */}
      <div
        className="hidden lg:flex flex-col w-[48%] xl:w-[50%] relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #080E1C 0%, #0A1322 45%, #0C1830 100%)" }}
      >
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="absolute pointer-events-none"
          style={{ top: "-10%", left: "-5%", width: "60%", height: "55%",
            background: "radial-gradient(ellipse at center, rgba(29,108,232,0.13) 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div className="absolute pointer-events-none"
          style={{ bottom: "5%", right: "-8%", width: "55%", height: "50%",
            background: "radial-gradient(ellipse at center, rgba(91,163,240,0.08) 0%, transparent 70%)", filter: "blur(50px)" }} />
        <div className="absolute top-0 right-0 w-px h-full"
          style={{ background: "linear-gradient(180deg, transparent 0%, rgba(29,108,232,0.4) 25%, rgba(91,163,240,0.3) 75%, transparent 100%)" }} />

        <div className="relative flex-1 flex flex-col justify-between px-10 xl:px-14 py-14">
          <div>
            <img src={BRANDING.logoFullTransparent} alt={BRANDING.appName} draggable={false}
              className="h-auto select-none block"
              style={{ width: "220px", filter: "brightness(0) invert(1)", opacity: 0.95 }} />
          </div>

          <div>
            <div className="mb-12">
              <p className="text-[11px] font-semibold tracking-[0.18em] uppercase mb-4"
                style={{ color: "rgba(91,163,240,0.7)" }}>Plateforme ERP Gaméasù</p>
              <h2 className="text-[30px] xl:text-[34px] font-bold leading-[1.18] text-white mb-5"
                style={{ letterSpacing: "-0.03em" }}>
                Gérez votre entreprise<br />avec précision.
              </h2>
              <p className="text-[13.5px] leading-relaxed" style={{ color: "rgba(255,255,255,0.38)" }}>
                Une solution complète pour les organisations africaines qui veulent piloter leur performance en temps réel.
              </p>
            </div>

            <div className="w-12 h-px mb-10"
              style={{ background: "linear-gradient(90deg, rgba(29,108,232,0.6), transparent)" }} />

            <div className="space-y-5">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3.5">
                  <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(29,108,232,0.12)", border: "1px solid rgba(29,108,232,0.22)" }}>
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

          <div className="flex items-center justify-between">
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.18)" }}>© {year} {BRANDING.legalName}</p>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3" style={{ color: "rgba(91,163,240,0.3)" }} />
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.18)" }}>Connexion chiffrée TLS 1.3</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══ PANNEAU DROIT ════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col relative" style={{ background: "#FAFBFC" }}>
        <div className="absolute inset-0 pointer-events-none opacity-40"
          style={{ backgroundImage: "radial-gradient(rgba(29,108,232,0.04) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="absolute top-0 left-0 w-[400px] h-[300px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at top left, rgba(29,108,232,0.05) 0%, transparent 70%)" }} />

        <div className="relative lg:hidden flex justify-center pt-10 pb-2">
          <img src={BRANDING.logoFullTransparent} alt={BRANDING.appName} className="h-9 w-auto object-contain" />
        </div>

        <div className="relative flex-1 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-[400px]">

            {/* ── Étape 1 : Identifiants ───────────────────────────────── */}
            {step === "credentials" && (
              <>
                <div className="mb-9">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-5 rounded-full"
                      style={{ background: "linear-gradient(180deg, #1D6CE8 0%, #5BA3F0 100%)" }} />
                    <span className="text-[11px] font-bold tracking-[0.16em] uppercase" style={{ color: "#1D6CE8" }}>
                      Espace sécurisé
                    </span>
                  </div>
                  <h1 className="text-[28px] font-bold leading-tight text-[#080E1C]" style={{ letterSpacing: "-0.032em" }}>
                    Connexion
                  </h1>
                  <p className="text-[13px] mt-2 leading-relaxed" style={{ color: "rgba(8,14,28,0.42)" }}>
                    Accédez à votre espace de travail {BRANDING.appName}.
                  </p>
                </div>

                <div className="rounded-2xl p-7"
                  style={{ background: "#FFFFFF", boxShadow: "0 1px 3px rgba(8,14,28,0.06), 0 8px 32px rgba(8,14,28,0.07), 0 0 0 1px rgba(8,14,28,0.055)" }}>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                      <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-[11.5px] font-bold tracking-wide uppercase" style={{ color: "rgba(8,14,28,0.50)", letterSpacing: "0.08em" }}>
                            Adresse e-mail
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="prenom.nom@entreprise.com" autoComplete="email"
                              className="h-[46px] rounded-xl text-[13.5px] transition-all duration-200"
                              style={{ background: "#F6F8FB", border: "1.5px solid rgba(8,14,28,0.10)", color: "#080E1C" }}
                              {...field} />
                          </FormControl>
                          <FormMessage className="text-[11px]" />
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="password" render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-[11.5px] font-bold tracking-wide uppercase" style={{ color: "rgba(8,14,28,0.50)", letterSpacing: "0.08em" }}>
                            Mot de passe
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input type={showPassword ? "text" : "password"} placeholder="••••••••••"
                                autoComplete="current-password"
                                className="h-[46px] pr-12 rounded-xl text-[13.5px] transition-all duration-200"
                                style={{ background: "#F6F8FB", border: "1.5px solid rgba(8,14,28,0.10)", color: "#080E1C" }}
                                {...field} />
                              <button type="button" onClick={() => setShowPassword((v) => !v)}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                                style={{ color: "rgba(8,14,28,0.28)" }} tabIndex={-1}>
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage className="text-[11px]" />
                        </FormItem>
                      )} />

                      {/* Mot de passe oublié */}
                      <div className="flex justify-end -mt-1">
                        <button
                          type="button"
                          onClick={() => { setStep("forgot"); setForgotEmail(form.getValues("email")); }}
                          className="text-[12px] transition-colors"
                          style={{ color: "#1D6CE8", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                        >
                          Mot de passe oublié ?
                        </button>
                      </div>

                      {/* Mémoriser cet appareil */}
                      <label className="flex items-center gap-2.5 cursor-pointer group">
                        <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}
                          className="w-4 h-4 rounded accent-blue-600 cursor-pointer" />
                        <span className="text-[12px]" style={{ color: "rgba(8,14,28,0.55)" }}>
                          Mémoriser cet appareil <span style={{ color: "rgba(8,14,28,0.30)" }}>(60 jours, pas de 2FA)</span>
                        </span>
                      </label>

                      <div className="pt-1">
                        <button type="submit" disabled={isLoading}
                          className="w-full h-[46px] rounded-xl text-[13.5px] font-semibold text-white flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-[0.985] disabled:opacity-60"
                          style={{
                            background: isLoading ? "#1D6CE8" : "linear-gradient(135deg, #1D6CE8 0%, #1558C8 100%)",
                            boxShadow: isLoading ? "none" : "0 4px 20px rgba(29,108,232,0.32), 0 1px 3px rgba(29,108,232,0.2)",
                            letterSpacing: "-0.01em",
                          }}>
                          {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Authentification…</> : <><span>Accéder à la plateforme</span><ArrowRight className="w-4 h-4" /></>}
                        </button>
                      </div>
                    </form>
                  </Form>
                </div>

                {/* Comptes de démonstration — masqués en production pour ne pas exposer
                    d'identifiants valides sur la page de connexion publique. */}
                {import.meta.env.DEV && (
                <div className="mt-3">
                  <div className="rounded-xl overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.80)", backdropFilter: "blur(12px)", border: "1px solid rgba(8,14,28,0.07)", boxShadow: "0 1px 4px rgba(8,14,28,0.04)" }}>
                    <button type="button" onClick={() => setShowDemo((v) => !v)}
                      className="w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-white/60">
                      <div className="flex items-center gap-2.5">
                        <div className="w-5 h-5 rounded-md flex items-center justify-center"
                          style={{ background: "rgba(29,108,232,0.09)", border: "1px solid rgba(29,108,232,0.16)" }}>
                          <Shield className="w-3 h-3" style={{ color: "#1D6CE8" }} />
                        </div>
                        <span className="text-[12px] font-semibold" style={{ color: "rgba(8,14,28,0.55)" }}>Comptes de démonstration</span>
                      </div>
                      <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200"
                        style={{ color: "rgba(8,14,28,0.28)", transform: showDemo ? "rotate(180deg)" : "rotate(0deg)" }} />
                    </button>
                    {showDemo && (
                      <div style={{ borderTop: "1px solid rgba(8,14,28,0.06)" }}>
                        {DEMO_ACCOUNTS.map(({ role, email, password }) => (
                          <button key={email} type="button" onClick={() => fillDemo(email, password)}
                            className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors group"
                            style={{ borderBottom: "1px solid rgba(8,14,28,0.04)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(29,108,232,0.04)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                            <div>
                              <p className="text-[12px] font-semibold" style={{ color: "rgba(8,14,28,0.72)" }}>{role}</p>
                              <p className="text-[10.5px] font-mono mt-0.5" style={{ color: "rgba(8,14,28,0.35)" }}>{email}</p>
                            </div>
                            <span className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#1D6CE8" }}>
                              Utiliser →
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                )}
              </>
            )}

            {/* ── Étape 2 : Code 2FA ───────────────────────────────────── */}
            {step === "2fa" && (
              <>
                <div className="mb-9">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(29,108,232,0.10)", border: "1px solid rgba(29,108,232,0.20)" }}>
                      <Mail className="w-4 h-4" style={{ color: "#1D6CE8" }} />
                    </div>
                    <span className="text-[11px] font-bold tracking-[0.16em] uppercase" style={{ color: "#1D6CE8" }}>
                      Vérification en 2 étapes
                    </span>
                  </div>
                  <h1 className="text-[28px] font-bold leading-tight text-[#080E1C]" style={{ letterSpacing: "-0.032em" }}>
                    Code de vérification
                  </h1>
                  <p className="text-[13px] mt-2 leading-relaxed" style={{ color: "rgba(8,14,28,0.42)" }}>
                    Un code à 6 chiffres a été envoyé à <strong style={{ color: "rgba(8,14,28,0.65)" }}>{pendingEmail}</strong>.
                    <br />Valide 10 minutes.
                  </p>
                </div>

                {devOtp && (
                  <div className="mb-4 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium"
                    style={{ background: "rgba(234,179,8,0.10)", border: "1px solid rgba(234,179,8,0.35)", color: "#92400e" }}>
                    <span className="text-base">🛠️</span>
                    <span>Mode dev — code pré-rempli&nbsp;: <strong className="font-mono tracking-widest">{devOtp}</strong></span>
                  </div>
                )}

                <div className="rounded-2xl p-7"
                  style={{ background: "#FFFFFF", boxShadow: "0 1px 3px rgba(8,14,28,0.06), 0 8px 32px rgba(8,14,28,0.07), 0 0 0 1px rgba(8,14,28,0.055)" }}>

                  {/* Saisie OTP */}
                  <div className="flex gap-2 justify-center mb-6">
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => { otpRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        autoFocus={i === 0}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        onPaste={i === 0 ? handleOtpPaste : undefined}
                        className="w-11 h-14 text-center text-[22px] font-bold rounded-xl transition-all outline-none"
                        style={{
                          background: digit ? "rgba(29,108,232,0.06)" : "#F6F8FB",
                          border: digit ? "2px solid #1D6CE8" : "1.5px solid rgba(8,14,28,0.12)",
                          color: "#080E1C",
                        }}
                      />
                    ))}
                  </div>

                  <button onClick={() => onVerify2FA()} disabled={isLoading || otp.join("").length < 6}
                    className="w-full h-[46px] rounded-xl text-[13.5px] font-semibold text-white flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-[0.985] disabled:opacity-60"
                    style={{
                      background: isLoading ? "#1D6CE8" : "linear-gradient(135deg, #1D6CE8 0%, #1558C8 100%)",
                      boxShadow: isLoading ? "none" : "0 4px 20px rgba(29,108,232,0.32)",
                      letterSpacing: "-0.01em",
                    }}>
                    {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Vérification…</> : <><span>Confirmer le code</span><ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <button type="button" onClick={() => { setStep("credentials"); setTempToken(""); setOtp(["", "", "", "", "", ""]); }}
                    className="text-[12px] transition-colors"
                    style={{ color: "rgba(8,14,28,0.40)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#1D6CE8")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(8,14,28,0.40)")}>
                    ← Retour à la connexion
                  </button>
                  <button type="button" onClick={() => { setStep("credentials"); setTimeout(() => form.handleSubmit(onSubmit)(), 50); }}
                    className="text-[12px] flex items-center gap-1 transition-colors"
                    style={{ color: "rgba(8,14,28,0.40)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#1D6CE8")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(8,14,28,0.40)")}>
                    <RefreshCw className="w-3 h-3" /> Renvoyer le code
                  </button>
                </div>
              </>
            )}

            {/* ── Étape 3 : Mot de passe oublié ───────────────────────── */}
            {step === "forgot" && (
              <>
                <div className="mb-9">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(29,108,232,0.10)", border: "1px solid rgba(29,108,232,0.20)" }}>
                      <Mail className="w-4 h-4" style={{ color: "#1D6CE8" }} />
                    </div>
                    <span className="text-[11px] font-bold tracking-[0.16em] uppercase" style={{ color: "#1D6CE8" }}>
                      Réinitialisation
                    </span>
                  </div>
                  <h1 className="text-[28px] font-bold leading-tight text-[#080E1C]" style={{ letterSpacing: "-0.032em" }}>
                    Mot de passe oublié
                  </h1>
                  <p className="text-[13px] mt-2 leading-relaxed" style={{ color: "rgba(8,14,28,0.42)" }}>
                    Saisissez votre adresse e-mail. Si un compte existe, vous recevrez un lien de réinitialisation.
                  </p>
                </div>

                <div className="rounded-2xl p-7"
                  style={{ background: "#FFFFFF", boxShadow: "0 1px 3px rgba(8,14,28,0.06), 0 8px 32px rgba(8,14,28,0.07), 0 0 0 1px rgba(8,14,28,0.055)" }}>

                  {forgotSent ? (
                    <div className="text-center py-4">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                        style={{ background: "rgba(16,185,129,0.10)", border: "1.5px solid rgba(16,185,129,0.25)" }}>
                        <CheckCircle2 className="w-7 h-7" style={{ color: "#10b981" }} />
                      </div>
                      <p className="font-semibold text-[15px] text-[#080E1C] mb-1">E-mail envoyé !</p>
                      <p className="text-[12.5px] leading-relaxed" style={{ color: "rgba(8,14,28,0.45)" }}>
                        Vérifiez votre boîte de réception et cliquez sur le lien reçu.<br />
                        Le lien est valable <strong>1 heure</strong>.
                      </p>
                      <button
                        type="button"
                        onClick={() => { setStep("credentials"); setForgotSent(false); setForgotEmail(""); }}
                        className="mt-6 text-[12.5px] font-medium transition-colors"
                        style={{ color: "#1D6CE8" }}
                      >
                        ← Retour à la connexion
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={onForgotSubmit} className="space-y-5">
                      <div className="space-y-1.5">
                        <label className="text-[11.5px] font-bold tracking-wide uppercase"
                          style={{ color: "rgba(8,14,28,0.50)", letterSpacing: "0.08em" }}>
                          Adresse e-mail
                        </label>
                        <input
                          type="email"
                          required
                          placeholder="prenom.nom@entreprise.com"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          className="w-full h-[46px] px-3.5 rounded-xl text-[13.5px] outline-none transition-all"
                          style={{ background: "#F6F8FB", border: "1.5px solid rgba(8,14,28,0.10)", color: "#080E1C" }}
                          onFocus={(e) => (e.currentTarget.style.borderColor = "#1D6CE8")}
                          onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(8,14,28,0.10)")}
                        />
                      </div>

                      <div className="pt-1">
                        <button
                          type="submit"
                          disabled={forgotLoading}
                          className="w-full h-[46px] rounded-xl text-[13.5px] font-semibold text-white flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-[0.985] disabled:opacity-60"
                          style={{
                            background: "linear-gradient(135deg, #1D6CE8 0%, #1558C8 100%)",
                            boxShadow: "0 4px 20px rgba(29,108,232,0.32), 0 1px 3px rgba(29,108,232,0.2)",
                          }}>
                          {forgotLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Envoi…</> : <><span>Envoyer le lien</span><ArrowRight className="w-4 h-4" /></>}
                        </button>
                      </div>

                      <div className="text-center">
                        <button
                          type="button"
                          onClick={() => setStep("credentials")}
                          className="text-[12px] transition-colors"
                          style={{ color: "rgba(8,14,28,0.40)" }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#1D6CE8")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(8,14,28,0.40)")}>
                          ← Retour à la connexion
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </>
            )}

            <p className="text-center mt-6 text-[10.5px]" style={{ color: "rgba(8,14,28,0.22)" }}>
              En vous connectant, vous acceptez les conditions d'utilisation de {BRANDING.legalName}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
