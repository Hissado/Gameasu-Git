import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, CheckCircle2, Loader2, KeyRound } from "lucide-react";
import { BRANDING } from "@/config/branding";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string>("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    if (t) setToken(t);
    else setError("Lien invalide ou expiré. Faites une nouvelle demande depuis la page de connexion.");
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) { setError("8 caractères minimum."); return; }
    if (newPassword !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erreur lors de la réinitialisation."); return; }
      setDone(true);
      setTimeout(() => setLocation("/login"), 3000);
    } catch {
      setError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setBusy(false);
    }
  };

  const isExpired = error?.toLowerCase().includes("expiré") || error?.toLowerCase().includes("invalide");

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "#FAFBFC", fontFamily: "var(--app-font-display, system-ui)" }}
    >
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8">
          <img
            src={BRANDING.logoFullTransparent}
            alt={BRANDING.appName}
            className="h-9 w-auto object-contain mx-auto mb-6"
          />
          <div className="flex items-center justify-center gap-2 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(29,108,232,0.10)", border: "1px solid rgba(29,108,232,0.20)" }}
            >
              <KeyRound className="w-5 h-5" style={{ color: "#1D6CE8" }} />
            </div>
          </div>
          <h1 className="text-[24px] font-bold text-[#080E1C]" style={{ letterSpacing: "-0.03em" }}>
            Nouveau mot de passe
          </h1>
          <p className="text-[13px] mt-1.5" style={{ color: "rgba(8,14,28,0.45)" }}>
            Choisissez un mot de passe sécurisé pour votre compte.
          </p>
        </div>

        <div
          className="rounded-2xl p-7"
          style={{
            background: "#FFFFFF",
            boxShadow: "0 1px 3px rgba(8,14,28,0.06), 0 8px 32px rgba(8,14,28,0.07), 0 0 0 1px rgba(8,14,28,0.055)",
          }}
        >
          {done ? (
            <div className="text-center py-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(16,185,129,0.10)", border: "1.5px solid rgba(16,185,129,0.25)" }}
              >
                <CheckCircle2 className="w-7 h-7" style={{ color: "#10b981" }} />
              </div>
              <p className="font-semibold text-[15px] text-[#080E1C] mb-1">Mot de passe mis à jour !</p>
              <p className="text-[12.5px]" style={{ color: "rgba(8,14,28,0.45)" }}>
                Redirection vers la connexion dans quelques secondes…
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              {error && (
                <Alert variant="destructive" className="rounded-xl">
                  <AlertDescription className="text-[12.5px]">
                    {error}
                    {isExpired && (
                      <span>
                        {" "}
                        <a
                          href="/login"
                          className="underline font-semibold"
                          style={{ color: "#1D6CE8" }}
                        >
                          Faire une nouvelle demande
                        </a>
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <label
                  className="text-[11.5px] font-bold tracking-wide uppercase"
                  style={{ color: "rgba(8,14,28,0.50)", letterSpacing: "0.08em" }}
                >
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <Input
                    type={showNew ? "text" : "password"}
                    placeholder="8 caractères minimum"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="h-[46px] pr-12 rounded-xl text-[13.5px]"
                    style={{ background: "#F6F8FB", border: "1.5px solid rgba(8,14,28,0.10)", color: "#080E1C" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: "rgba(8,14,28,0.28)" }}
                    tabIndex={-1}
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  className="text-[11.5px] font-bold tracking-wide uppercase"
                  style={{ color: "rgba(8,14,28,0.50)", letterSpacing: "0.08em" }}
                >
                  Confirmer le mot de passe
                </label>
                <div className="relative">
                  <Input
                    type={showConfirm ? "text" : "password"}
                    placeholder="Répétez le mot de passe"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    className="h-[46px] pr-12 rounded-xl text-[13.5px]"
                    style={{ background: "#F6F8FB", border: "1.5px solid rgba(8,14,28,0.10)", color: "#080E1C" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: "rgba(8,14,28,0.28)" }}
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={busy || !token}
                  className="w-full h-[46px] rounded-xl text-[13.5px] font-semibold text-white flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-[0.985] disabled:opacity-60"
                  style={{
                    background: "linear-gradient(135deg, #1D6CE8 0%, #1558C8 100%)",
                    boxShadow: "0 4px 20px rgba(29,108,232,0.32), 0 1px 3px rgba(29,108,232,0.2)",
                  }}
                >
                  {busy ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Enregistrement…</>
                  ) : (
                    "Enregistrer le mot de passe"
                  )}
                </button>
              </div>

              <div className="text-center pt-1">
                <a
                  href="/login"
                  className="text-[12px] transition-colors"
                  style={{ color: "rgba(8,14,28,0.40)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#1D6CE8")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(8,14,28,0.40)")}
                >
                  ← Retour à la connexion
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
