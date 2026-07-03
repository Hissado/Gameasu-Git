import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Briefcase, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { BRANDING } from "@/config/branding";

type InvitationInfo = {
  email: string;
  expiresAt: string;
  firm: { name: string; country: string; plan: string };
};

const PLAN_LABEL: Record<string, string> = {
  starter: "Starter",
  growth: "Growth",
  professional: "Professional",
  enterprise: "Enterprise",
};

export default function AcceptExpertInvitationPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();

  const [token, setToken] = useState<string>("");
  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    if (!t) {
      setTokenError("Lien d'invitation invalide.");
      setLoadingInfo(false);
      return;
    }
    setToken(t);

    apiFetch<InvitationInfo>(`/api/expert/invitation/${t}`)
      .then((data) => {
        setInfo(data);
        setLoadingInfo(false);
      })
      .catch((e: any) => {
        setTokenError(e?.body?.error ?? e?.message ?? "Lien invalide ou expiré.");
        setLoadingInfo(false);
      });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!firstName.trim() || !lastName.trim()) { setFormError("Prénom et nom sont requis."); return; }
    if (password.length < 8) { setFormError("8 caractères minimum pour le mot de passe."); return; }
    if (password !== confirm) { setFormError("Les mots de passe ne correspondent pas."); return; }

    setBusy(true);
    try {
      const res = await apiFetch<{ token: string; user: any; firm: any }>(
        "/api/expert/invitation/accept",
        { method: "POST", body: { token, firstName: firstName.trim(), lastName: lastName.trim(), password } as any },
      );
      setSuccess(true);
      login(res.token);
      setTimeout(() => setLocation("/expert"), 1500);
    } catch (e: any) {
      setFormError(e?.body?.error ?? e?.message ?? "Erreur lors de l'activation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Header branding */}
        <div className="text-center mb-6">
          <div className="text-[#F37021] font-extrabold tracking-widest text-xs uppercase mb-1">
            {BRANDING.appName}
          </div>
          <div className="text-white text-lg font-bold">Espace Cabinet Expert</div>
          <div className="text-slate-400 text-sm">Activez votre compte professionnel</div>
        </div>

        <Card className="border-0 shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Briefcase className="w-5 h-5 text-[#F37021]" />
              Créer votre compte administrateur
            </CardTitle>
            <CardDescription>
              Vous avez reçu une invitation pour rejoindre {BRANDING.appName} en tant que cabinet expert.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Token loading / error state */}
            {loadingInfo && (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Vérification de votre invitation…</span>
              </div>
            )}

            {!loadingInfo && tokenError && (
              <Alert variant="destructive">
                <AlertDescription>
                  {tokenError}
                  <p className="mt-1 text-xs opacity-80">
                    Si le problème persiste, contactez l'équipe Gameasu.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {!loadingInfo && info && !success && (
              <>
                {/* Firm info banner */}
                <div className="rounded-lg border bg-slate-50 p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-800">{info.firm.name}</span>
                    <Badge variant="outline" className="text-xs capitalize">
                      {PLAN_LABEL[info.firm.plan] ?? info.firm.plan}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-500">
                    Invitation pour&nbsp;<span className="font-medium text-slate-700">{info.email}</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    Expire le {new Date(info.expiresAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>

                <form onSubmit={submit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="fn">Prénom</Label>
                      <Input
                        id="fn"
                        autoComplete="given-name"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ln">Nom</Label>
                      <Input
                        id="ln"
                        autoComplete="family-name"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="pw">Mot de passe</Label>
                    <div className="relative">
                      <Input
                        id="pw"
                        type={showPw ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        minLength={8}
                        placeholder="8 caractères minimum"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cf">Confirmer le mot de passe</Label>
                    <div className="relative">
                      <Input
                        id="cf"
                        type={showConfirm ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        minLength={8}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {formError && (
                    <Alert variant="destructive">
                      <AlertDescription>{formError}</AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    disabled={busy}
                    className="w-full bg-[#F37021] hover:bg-[#d9621c] text-white font-semibold"
                  >
                    {busy ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" />Activation en cours…</>
                    ) : (
                      "Activer mon espace cabinet"
                    )}
                  </Button>
                </form>
              </>
            )}

            {success && (
              <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                <div className="font-semibold text-lg">Compte activé !</div>
                <div className="text-sm text-muted-foreground">
                  Bienvenue dans Gameasu. Redirection vers votre espace cabinet…
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
