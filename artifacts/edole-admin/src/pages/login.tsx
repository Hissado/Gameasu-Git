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
  Shield, ChevronDown, Loader2, Eye, EyeOff,
  CheckCircle2, Mail, RefreshCw,
} from "lucide-react";

const DEVICE_TOKEN_KEY = "gameasu_device_token";
const PENDING_ORGS_KEY = "gameasu_pending_orgs";
const PENDING_TOKEN_KEY = "gameasu_pending_token";

const loginSchema = z.object({
  email: z.string().email("Adresse e-mail invalide"),
  password: z.string().min(1, "Le mot de passe est obligatoire"),
  rememberMe: z.boolean().optional(),
});
type LoginFormValues = z.infer<typeof loginSchema>;

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
    if (code.length !== 6) return;
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
    // Multi-org : si l'utilisateur appartient à plusieurs organisations, afficher le sélecteur
    if (Array.isArray(json.orgs) && json.orgs.length > 1) {
      localStorage.setItem(PENDING_ORGS_KEY, JSON.stringify(json.orgs));
      localStorage.setItem(PENDING_TOKEN_KEY, json.token);
      setLocation("/choisir-organisation");
      return;
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
    <div className="min-h-screen w-full flex flex-col items-center justify-between px-4 py-10"
      style={{ background: "#F3F4F6", fontFamily: "var(--app-font-display, system-ui)" }}>

      {/* ══ CARTE CENTRALE ══════════════════════════════════════════════════ */}
      <div /> {/* spacer */}
      <div className="w-full max-w-[440px]">

        {/* ── Étape 1 : Identifiants ─────────────────────────────────────── */}
        {step === "credentials" && (
          <div className="rounded-2xl bg-white px-10 py-10" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.08), 0 4px 24px rgba(0,0,0,0.06)", border: "1px solid #E5E7EB" }}>

            {/* Logo + titre */}
            <div className="text-center mb-8">
              <img src={BRANDING.logoFullTransparent} alt={BRANDING.appName} draggable={false}
                className="select-none mx-auto mb-5"
                style={{ height: "52px", width: "auto" }} />
              <h1 className="text-[20px] font-bold text-[#0E1A39]">
                Pilotez vos opérations en toute simplicité
              </h1>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-[13px] font-medium text-gray-700">Adresse e-mail</FormLabel>
                    <FormControl>
                      <Input placeholder="prenom.nom@entreprise.com" autoComplete="email"
                        className="h-11 rounded-lg text-[13.5px] border-gray-300 focus-visible:ring-blue-600"
                        {...field} />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )} />

                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-[13px] font-medium text-gray-700">Mot de passe</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showPassword ? "text" : "password"} placeholder="••••••••••"
                          autoComplete="current-password"
                          className="h-11 pr-10 rounded-lg text-[13.5px] border-gray-300 focus-visible:ring-blue-600"
                          {...field} />
                        <button type="button" onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                          tabIndex={-1}>
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )} />

                <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600 cursor-pointer" />
                  <span className="text-[13px] text-gray-600">Mémoriser cet appareil</span>
                </label>

                <div className="pt-1">
                  <button type="submit" disabled={isLoading}
                    className="w-full h-11 rounded-lg text-[14px] font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.985] disabled:opacity-60"
                    style={{ background: "#2563EB" }}>
                    {isLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" />Connexion…</>
                      : "Se connecter"}
                  </button>
                </div>

                <div className="text-center pt-1">
                  <button type="button"
                    onClick={() => { setStep("forgot"); setForgotEmail(form.getValues("email")); }}
                    className="text-[13px] text-blue-600 hover:underline transition-colors"
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                    Mot de passe oublié ?
                  </button>
                </div>
              </form>
            </Form>

            {/* Séparateur "Pas encore client ?" */}
            <div className="mt-5 border-t border-gray-100 pt-4 text-center space-y-2">
              <p className="text-[12px] text-gray-400">Vous n'avez pas encore de compte ?</p>
              <button type="button"
                onClick={() => setLocation("/register")}
                className="w-full h-10 rounded-lg text-[13.5px] font-semibold border-2 border-[#F37021] text-[#F37021] hover:bg-orange-50 transition-colors">
                Créer mon compte Gameasu
              </button>
            </div>

            {/* Comptes de démonstration — masqués en production */}
            {import.meta.env.DEV && (
              <div className="mt-5 border-t border-gray-100 pt-4">
                <button type="button" onClick={() => setShowDemo((v) => !v)}
                  className="w-full flex items-center justify-between text-[12px] text-gray-400 hover:text-gray-600 transition-colors">
                  <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" />Comptes de démonstration</span>
                  <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200"
                    style={{ transform: showDemo ? "rotate(180deg)" : "rotate(0deg)" }} />
                </button>
                {showDemo && (
                  <div className="mt-2 space-y-1">
                    {DEMO_ACCOUNTS.map(({ role, email, password }) => (
                      <button key={email} type="button" onClick={() => fillDemo(email, password)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left hover:bg-blue-50 transition-colors group">
                        <div>
                          <p className="text-[12px] font-semibold text-gray-700">{role}</p>
                          <p className="text-[10.5px] font-mono text-gray-400">{email}</p>
                        </div>
                        <span className="text-[11px] font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">Utiliser →</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Étape 2 : Code 2FA ─────────────────────────────────────────── */}
        {step === "2fa" && (
          <div className="rounded-2xl bg-white px-10 py-10" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.08), 0 4px 24px rgba(0,0,0,0.06)", border: "1px solid #E5E7EB" }}>
            <div className="text-center mb-6">
              <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: "rgba(37,99,235,0.10)" }}>
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <h1 className="text-[20px] font-bold text-[#0E1A39]">Code de vérification</h1>
              <p className="text-[12px] text-gray-500 mt-1">
                Code envoyé à <strong className="text-gray-700">{pendingEmail}</strong> · valide 10 min
              </p>
            </div>

            {devOtp && (
              <div className="mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium bg-amber-50 border border-amber-200 text-amber-800">
                🛠️ Dev — code : <strong className="font-mono tracking-widest ml-1">{devOtp}</strong>
              </div>
            )}

            <div className="flex gap-2 justify-center mb-5">
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
                  className="w-10 h-12 text-center text-[20px] font-bold rounded-lg transition-all outline-none border"
                  style={{
                    background: digit ? "#EFF6FF" : "#F9FAFB",
                    borderColor: digit ? "#2563EB" : "#D1D5DB",
                    color: "#0E1A39",
                  }}
                />
              ))}
            </div>

            <button onClick={() => onVerify2FA()} disabled={isLoading || otp.join("").length < 6}
              className="w-full h-11 rounded-lg text-[14px] font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.985] disabled:opacity-60"
              style={{ background: "#2563EB" }}>
              {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Vérification…</> : "Confirmer le code"}
            </button>

            <div className="mt-4 flex items-center justify-between text-[12px]">
              <button type="button" onClick={() => { setStep("credentials"); setTempToken(""); setOtp(["", "", "", "", "", ""]); }}
                className="text-gray-400 hover:text-blue-600 transition-colors">
                ← Retour
              </button>
              <button type="button" onClick={() => { setStep("credentials"); setTimeout(() => form.handleSubmit(onSubmit)(), 50); }}
                className="text-gray-400 hover:text-blue-600 transition-colors flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Renvoyer
              </button>
            </div>
          </div>
        )}

        {/* ── Étape 3 : Mot de passe oublié ──────────────────────────────── */}
        {step === "forgot" && (
          <div className="rounded-2xl bg-white px-10 py-10" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.08), 0 4px 24px rgba(0,0,0,0.06)", border: "1px solid #E5E7EB" }}>
            <h1 className="text-[22px] font-bold text-center text-[#0E1A39] mb-1" style={{ letterSpacing: "-0.02em" }}>
              Mot de passe oublié
            </h1>
            <p className="text-[12px] text-center text-gray-500 mb-6">
              Saisissez votre e-mail pour recevoir un lien de réinitialisation.
            </p>

            {forgotSent ? (
              <div className="text-center py-2">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 bg-emerald-50 border border-emerald-200">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <p className="font-semibold text-[14px] text-[#0E1A39] mb-1">E-mail envoyé !</p>
                <p className="text-[12px] text-gray-500">
                  Vérifiez votre boîte de réception.<br />Lien valable <strong>1 heure</strong>.
                </p>
                <button type="button"
                  onClick={() => { setStep("credentials"); setForgotSent(false); setForgotEmail(""); }}
                  className="mt-5 text-[12px] text-blue-600 hover:underline">
                  ← Retour à la connexion
                </button>
              </div>
            ) : (
              <form onSubmit={onForgotSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[#374151]">Adresse e-mail</label>
                  <input
                    type="email"
                    required
                    placeholder="prenom.nom@entreprise.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg text-[13.5px] outline-none border border-gray-300 focus:border-blue-600 transition-colors"
                    style={{ color: "#0E1A39" }}
                  />
                </div>
                <button type="submit" disabled={forgotLoading}
                  className="w-full h-11 rounded-lg text-[14px] font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-60"
                  style={{ background: "#2563EB" }}>
                  {forgotLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Envoi…</> : "Envoyer le lien"}
                </button>
                <div className="text-center">
                  <button type="button" onClick={() => setStep("credentials")}
                    className="text-[12px] text-gray-400 hover:text-blue-600 transition-colors">
                    ← Retour à la connexion
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* ══ PIED DE PAGE ════════════════════════════════════════════════════ */}
      <p className="text-center text-[11px] pb-2 text-gray-400">
        © {year} {BRANDING.legalName} · Connexion chiffrée TLS 1.3
      </p>
    </div>
  );
}
