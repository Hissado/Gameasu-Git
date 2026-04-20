import React, { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, ShieldAlert } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

/**
 * Page de changement de mot de passe. Utilisée :
 *  - À la première connexion (mustChangePassword=true) — la nav globale est bloquée.
 *  - Volontairement depuis /settings.
 */
export default function ChangePasswordPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const forced = (user as any)?.mustChangePassword === true;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) { setError("8 caractères minimum"); return; }
    if (newPassword !== confirm) { setError("Les mots de passe ne correspondent pas"); return; }
    if (currentPassword === newPassword) { setError("Le nouveau mot de passe doit être différent de l'actuel"); return; }
    setBusy(true);
    try {
      await apiFetch("/api/auth/change-password", { method: "POST", body: { currentPassword, newPassword } as any });
      toast({ title: "Mot de passe mis à jour", description: "Bienvenue ! Vous pouvez maintenant utiliser la plateforme." });
      // Recharge complète pour invalider /auth/me et débloquer la nav.
      window.location.href = "/";
    } catch (e: any) {
      setError(e?.body?.error || e?.message || "Erreur");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            {forced ? "Définissez votre mot de passe" : "Changer mon mot de passe"}
          </CardTitle>
          <CardDescription>
            {forced
              ? "Pour des raisons de sécurité, vous devez personnaliser votre mot de passe avant d'accéder à la plateforme."
              : "Choisissez un nouveau mot de passe d'au moins 8 caractères."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {forced && (
            <Alert className="mb-4 border-orange-200 bg-orange-50 text-orange-900">
              <ShieldAlert className="h-4 w-4 text-orange-600" />
              <AlertDescription>Tant que ce changement n'est pas effectué, l'accès est restreint.</AlertDescription>
            </Alert>
          )}
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cur">Mot de passe actuel</Label>
              <Input id="cur" type="password" autoComplete="current-password" required value={currentPassword} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new">Nouveau mot de passe</Label>
              <Input id="new" type="password" autoComplete="new-password" required minLength={8} value={newPassword} onChange={(e) => setNew(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conf">Confirmation</Label>
              <Input id="conf" type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="flex justify-end gap-2 pt-2">
              {!forced && <Button type="button" variant="ghost" onClick={() => setLocation("/")}>Annuler</Button>}
              <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90">
                {busy ? "Enregistrement…" : "Mettre à jour"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
