import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { BRANDING } from "@/config/branding";

export default function AcceptInvitationPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [token, setToken] = useState<string>("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    if (t) setToken(t);
    else setError("Lien d'invitation invalide.");
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) { setError("8 caractères minimum"); return; }
    if (newPassword !== confirm) { setError("Les mots de passe ne correspondent pas"); return; }
    setBusy(true);
    try {
      const res = await apiFetch<any>("/api/auth/accept-invitation", { method: "POST", body: { token, newPassword } as any });
      login(res.token);
      setLocation("/");
    } catch (e: any) {
      setError(e?.body?.error || e?.message || "Erreur");
    } finally { setBusy(false); }
  };

  const isExpiredError = error?.toLowerCase().includes("expiré") || error?.toLowerCase().includes("invalide");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-white p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-primary" />
            Bienvenue dans {BRANDING.appName}
          </CardTitle>
          <CardDescription>Définissez le mot de passe qui vous servira à vous connecter.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="np">Nouveau mot de passe</Label>
              <div className="relative">
                <Input
                  id="np"
                  type={showNew ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showNew ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cf">Confirmation</Label>
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
                  aria-label={showConfirm ? "Masquer la confirmation" : "Afficher la confirmation"}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {error}
                  {isExpiredError && token && (
                    <p className="mt-1 text-xs opacity-80">
                      Ce lien a peut-être expiré. Demandez à votre administrateur de vous renvoyer une invitation.
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={busy || !token} className="w-full bg-primary hover:bg-primary/90">
              {busy ? "Validation…" : "Activer mon compte"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
