import { useState, useRef, type FormEvent } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Loader2, Eye, EyeOff, Mail, RefreshCw, Shield, CheckCircle2 } from "lucide-react";
import gameasuLogo from "@/assets/gameasu-logo.png";

const DEVICE_TOKEN_KEY = "cockpit_device_token";

type Step = "credentials" | "2fa" | "forgot";

export default function LoginPage() {
  const { login, user } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const [step, setStep] = useState<Step>("credentials");
  const [tempToken, setTempToken] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([null, null, null, null, null, null]);

  if (user) {
    navigate("/");
    return null;
  }

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

      if (data.user?.role !== "super_admin") throw new Error("Accès réservé aux super-administrateurs Gameasu");
      if (data.deviceToken) localStorage.setItem(DEVICE_TOKEN_KEY, data.deviceToken);
      login(data.token, data.user);
      navigate("/");
    } catch (err: unknown) {
      setError((err as Error).message ?? "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

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
      if (data.user?.role !== "super_admin") { setError("Accès réservé aux super-administrateurs Gameasu"); return; }
      if (data.deviceToken) localStorage.setItem(DEVICE_TOKEN_KEY, data.deviceToken);
      login(data.token, data.user);
      navigate("/");
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setForgotLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      setForgotSent(true);
    } catch {
      setForgotSent(true);
    } finally {
      setForgotLoading(false);
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

  const year = new Date().getFullYear();

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-between px-4 py-10"
      style={{ background: "#F3F4F6", fontFamily: "var(--app-font-display, system-ui)" }}
    >
      <div />

      <div className="w-full max-w-[420px]">

        {/* ── Identifiants ─────────────────────────────────────────────────── */}
        {step === "credentials" && (
          <div
            className="rounded-2xl bg-white px-10 py-10"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.08), 0 4px 24px rgba(0,0,0,0.06)", border: "1px solid #E5E7EB" }}
          >
            <div className="text-center mb-8">
              <img
                src={gameasuLogo}
                alt="Gameasu"
                draggable={false}
                className="select-none mx-auto mb-5"
                style={{ height: "48px", width: "auto" }}
              />
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-3"
                style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                <Shield className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">Administration interne</span>
              </div>
              <h1 className="text-[20px] font-bold text-[#0E1A39]">
                Accès Cockpit Gameasu
              </h1>
              <p className="text-[12.5px] text-gray-400 mt-1">Espace réservé aux super-administrateurs</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-gray-700">Adresse e-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="super.admin@gameasutech.com"
                  className="w-full h-11 px-3 rounded-lg text-[13.5px] outline-none transition-colors"
                  style={{ border: "1px solid #D1D5DB", color: "#0E1A39" }}
                  onFocus={(e) => { e.target.style.borderColor = "#2563EB"; e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.08)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "#D1D5DB"; e.target.style.boxShadow = "none"; }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-gray-700">Mot de passe</label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••••"
                    className="w-full h-11 px-3 pr-10 rounded-lg text-[13.5px] outline-none transition-colors"
                    style={{ border: "1px solid #D1D5DB", color: "#0E1A39" }}
                    onFocus={(e) => { e.target.style.borderColor = "#2563EB"; e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.08)"; }}
                    onBlur={(e) => { e.target.style.borderColor = "#D1D5DB"; e.target.style.boxShadow = "none"; }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer pt-0.5">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded cursor-pointer"
                  style={{ accentColor: "#2563EB" }}
                />
                <span className="text-[13px] text-gray-600">Mémoriser cet appareil (60 jours)</span>
              </label>

              {error && (
                <div className="text-[12.5px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
              )}

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-lg text-[14px] font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.985] disabled:opacity-60"
                  style={{ background: "#2563EB" }}
                >
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Connexion…</> : "Accéder au Cockpit"}
                </button>
              </div>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => { setForgotEmail(email); setForgotSent(false); setError(""); setStep("forgot"); }}
                  className="text-[13px] text-blue-600 hover:underline transition-colors"
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                >
                  Mot de passe oublié ?
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── 2FA ──────────────────────────────────────────────────────────── */}
        {step === "2fa" && (
          <div
            className="rounded-2xl bg-white px-10 py-10"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.08), 0 4px 24px rgba(0,0,0,0.06)", border: "1px solid #E5E7EB" }}
          >
            <div className="text-center mb-6">
              <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: "rgba(37,99,235,0.10)" }}>
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <h1 className="text-[20px] font-bold text-[#0E1A39]">Code de vérification</h1>
              <p className="text-[12px] text-gray-500 mt-1">
                Code envoyé à <strong className="text-gray-700">{email}</strong><br />
                <span className="text-gray-400">Valide 10 minutes</span>
              </p>
            </div>

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

            {error && (
              <div className="text-[12.5px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</div>
            )}

            <button
              onClick={handleVerify2FA}
              disabled={loading || otp.join("").length < 6}
              className="w-full h-11 rounded-lg text-[14px] font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.985] disabled:opacity-60"
              style={{ background: "#2563EB" }}
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Vérification…</> : "Confirmer le code"}
            </button>

            <div className="mt-4 flex items-center justify-between text-[12px]">
              <button
                type="button"
                onClick={() => { setStep("credentials"); setTempToken(""); setOtp(["", "", "", "", "", ""]); }}
                className="text-gray-400 hover:text-blue-600 transition-colors"
              >
                ← Retour
              </button>
              <button
                type="button"
                onClick={() => { setStep("credentials"); setError(""); }}
                className="text-gray-400 hover:text-blue-600 transition-colors flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Renvoyer le code
              </button>
            </div>
          </div>
        )}

        {/* ── Mot de passe oublié ──────────────────────────────────────────── */}
        {step === "forgot" && (
          <div
            className="rounded-2xl bg-white px-10 py-10"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.08), 0 4px 24px rgba(0,0,0,0.06)", border: "1px solid #E5E7EB" }}
          >
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
                  Si un compte super-administrateur existe pour cette adresse,<br />
                  un lien sécurisé vient d'être envoyé. Valable <strong>1 heure</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => { setStep("credentials"); setForgotSent(false); setForgotEmail(""); }}
                  className="mt-5 text-[12px] text-blue-600 hover:underline"
                >
                  ← Retour à la connexion
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-gray-700">Adresse e-mail</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    autoFocus
                    placeholder="cockpit@gameasu.com"
                    className="w-full h-11 px-3 rounded-lg text-[13.5px] outline-none transition-colors"
                    style={{ border: "1px solid #D1D5DB", color: "#0E1A39" }}
                    onFocus={(e) => { e.target.style.borderColor = "#2563EB"; e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.08)"; }}
                    onBlur={(e) => { e.target.style.borderColor = "#D1D5DB"; e.target.style.boxShadow = "none"; }}
                  />
                </div>
                {error && (
                  <div className="text-[12.5px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
                )}
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full h-11 rounded-lg text-[14px] font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-60"
                  style={{ background: "#2563EB" }}
                >
                  {forgotLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Envoi…</> : "Envoyer le lien sécurisé"}
                </button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => { setStep("credentials"); setError(""); }}
                    className="text-[12px] text-gray-400 hover:text-blue-600 transition-colors"
                  >
                    ← Retour à la connexion
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      <p className="text-center text-[11px] pb-2 text-gray-400">
        © {year} Gameasu Technology · Espace d'administration interne
      </p>
    </div>
  );
}
