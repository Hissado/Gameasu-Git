import { useState, useRef, type FormEvent } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Shield, Loader2, Eye, EyeOff, Mail, RefreshCw, ArrowRight } from "lucide-react";

const DEVICE_TOKEN_KEY = "cockpit_device_token";

type Step = "credentials" | "2fa";

export default function LoginPage() {
  const { login, user } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [step, setStep] = useState<Step>("credentials");
  const [tempToken, setTempToken] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([null, null, null, null, null, null]);

  if (user) {
    navigate("/");
    return null;
  }

  // ─── Étape 1 : identifiants ────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const deviceToken = localStorage.getItem(DEVICE_TOKEN_KEY) ?? undefined;
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, ...(deviceToken ? { deviceToken } : {}) }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({})) as any;
        throw new Error(err.error ?? "Identifiants incorrects");
      }
      const data = await r.json() as any;

      if (data.status === "2fa_required") {
        setTempToken(data.tempToken);
        setStep("2fa");
        setOtp(["", "", "", "", "", ""]);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
        return;
      }

      // Trusted device bypass
      if (data.user?.role !== "super_admin") throw new Error("Accès réservé aux super-administrateurs Gaméasù");
      if (data.deviceToken) localStorage.setItem(DEVICE_TOKEN_KEY, data.deviceToken);
      login(data.token, data.user);
      navigate("/");
    } catch (err: unknown) {
      setError((err as Error).message ?? "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  // ─── Étape 2 : OTP ────────────────────────────────────────────────────
  const handleVerify2FA = async () => {
    const code = otp.join("").trim();
    if (code.length !== 6) { setError("Saisissez les 6 chiffres."); return; }
    setError("");
    setLoading(true);
    try {
      const r = await fetch("/api/auth/login/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempToken, code, rememberMe }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({})) as any;
        setError(err.error ?? "Code invalide");
        setOtp(["", "", "", "", "", ""]);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
        return;
      }
      const data = await r.json() as any;
      if (data.user?.role !== "super_admin") { setError("Accès réservé aux super-administrateurs Gaméasù"); return; }
      if (data.deviceToken) localStorage.setItem(DEVICE_TOKEN_KEY, data.deviceToken);
      login(data.token, data.user);
      navigate("/");
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (i: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[i] = digit;
    setOtp(next);
    if (digit && i < 5) otpRefs.current[i + 1]?.focus();
    if (next.join("").length === 6) setTimeout(() => handleVerify2FA(), 80);
  };

  const handleOtpKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
    if (e.key === "Enter") handleVerify2FA();
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6).split("");
    const next = [...otp];
    digits.forEach((d, i) => { next[i] = d; });
    setOtp(next);
    const focusIdx = Math.min(digits.length, 5);
    otpRefs.current[focusIdx]?.focus();
    if (digits.length === 6) setTimeout(() => handleVerify2FA(), 80);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 items-center justify-center mb-4">
            {step === "2fa" ? <Mail className="w-8 h-8 text-primary" /> : <Shield className="w-8 h-8 text-primary" />}
          </div>
          <h1 className="text-2xl font-bold text-white">Gaméasù Cockpit</h1>
          <p className="text-sm text-slate-400 mt-1">
            {step === "2fa" ? "Vérification en 2 étapes" : "Administration interne — accès restreint"}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm shadow-2xl">

          {/* ── Étape 1 ── */}
          {step === "credentials" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 uppercase tracking-wide">Adresse email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
                  placeholder="super.admin@gameasutech.com"
                  className="w-full px-3 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 uppercase tracking-wide">Mot de passe</label>
                <div className="relative">
                  <input type={showPwd ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 pr-10 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded accent-primary cursor-pointer" />
                <span className="text-xs text-slate-400">Mémoriser cet appareil (60 jours)</span>
              </label>

              {error && (
                <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-2.5 rounded-lg bg-primary text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                Accéder au Cockpit
              </button>
            </form>
          )}

          {/* ── Étape 2FA ── */}
          {step === "2fa" && (
            <div className="space-y-5">
              <p className="text-sm text-slate-300 text-center">
                Code envoyé à <span className="text-white font-medium">{email}</span>.<br />
                <span className="text-xs text-slate-500">Valide 10 minutes.</span>
              </p>

              {/* OTP */}
              <div className="flex gap-2 justify-center">
                {otp.map((digit, i) => (
                  <input key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    type="text" inputMode="numeric" maxLength={1} value={digit}
                    autoFocus={i === 0}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    onPaste={i === 0 ? handleOtpPaste : undefined}
                    className="w-10 h-12 text-center text-xl font-bold rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                    style={{ borderColor: digit ? "rgb(var(--primary))" : undefined }}
                  />
                ))}
              </div>

              {error && (
                <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</div>
              )}

              <button onClick={handleVerify2FA} disabled={loading || otp.join("").length < 6}
                className="w-full py-2.5 rounded-lg bg-primary text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Confirmer le code
              </button>

              <div className="flex justify-between text-xs text-slate-500">
                <button type="button" onClick={() => { setStep("credentials"); setTempToken(""); setError(""); }}
                  className="hover:text-slate-300 transition-colors">← Retour</button>
                <button type="button" onClick={() => { setStep("credentials"); setError(""); }}
                  className="hover:text-slate-300 transition-colors flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Renvoyer le code
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">Gaméasù Technology · Espace d'administration interne</p>
      </div>
    </div>
  );
}
