import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { ShieldCheck, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    if (t) setToken(t);
    else setError("Lien invalide ou incomplet. Demandez un nouveau lien depuis la page de connexion.");
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Le mot de passe doit comporter au moins 8 caractères."); return; }
    if (password !== confirm) { setError("Les deux mots de passe ne correspondent pas."); return; }
    setLoading(true);
    try {
      const r = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Lien invalide ou expiré.");
      }
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 items-center justify-center mb-4">
            {done ? <CheckCircle2 className="w-8 h-8 text-primary" /> : <ShieldCheck className="w-8 h-8 text-primary" />}
          </div>
          <h1 className="text-2xl font-bold text-white">Gameasu Cockpit</h1>
          <p className="text-sm text-slate-400 mt-1">Définition du mot de passe</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm shadow-2xl">
          {done ? (
            <div className="space-y-4 text-center">
              <div className="text-sm text-emerald-300 bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-3 py-3">
                Mot de passe défini avec succès. Redirection vers la connexion…
              </div>
              <button onClick={() => navigate("/login")}
                className="w-full py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors">
                Se connecter
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 uppercase tracking-wide">Nouveau mot de passe</label>
                <div className="relative">
                  <input type={showPwd ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoFocus
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 pr-10 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 uppercase tracking-wide">Confirmer le mot de passe</label>
                <input type={showPwd ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8}
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" />
              </div>

              {error && (
                <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</div>
              )}

              <button type="submit" disabled={loading || !token}
                className="w-full py-2.5 rounded-lg bg-primary text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Définir mon mot de passe
              </button>

              <button type="button" onClick={() => navigate("/login")}
                className="w-full text-center text-xs text-slate-400 hover:text-slate-200 transition-colors">
                ← Retour à la connexion
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">Gameasu Technology · Espace d'administration interne</p>
      </div>
    </div>
  );
}
