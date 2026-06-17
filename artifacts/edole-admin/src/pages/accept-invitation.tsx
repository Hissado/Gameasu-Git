import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2 } from "lucide-react";
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
              <Input id="np" type="password" autoComplete="new-password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cf">Confirmation</Label>
              <Input id="cf" type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <Button type="submit" disabled={busy || !token} className="w-full bg-primary hover:bg-primary/90">
              {busy ? "Validation…" : "Activer mon compte"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
