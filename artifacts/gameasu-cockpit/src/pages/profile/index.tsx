import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  UserCircle, Lock, Monitor, Loader2, LogOut, Shield,
  CheckCircle2, AlertTriangle, Laptop, Smartphone,
} from "lucide-react";

type Profile = {
  id: string; email: string; firstName: string; lastName: string;
  phone: string | null; isActive: boolean;
  lastLoginAt: string | null; createdAt: string;
};

type SessionData = {
  sessions: { id: string; userAgent: string | null; ipAddress: string | null; createdAt: string; expiresAt: string }[];
  trustedDevices: { id: string; label: string | null; ipAddress: string | null; createdAt: string; expiresAt: string }[];
};

function fmtDatetime(d: string | null) {
  if (!d) return "Jamais";
  return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function parseUA(ua: string | null) {
  if (!ua) return { device: "Appareil inconnu", browser: "" };
  const isMobile = /mobile|android|iphone|ipad/i.test(ua);
  const browser = ua.includes("Chrome") ? "Chrome"
    : ua.includes("Firefox") ? "Firefox"
    : ua.includes("Safari") ? "Safari"
    : ua.includes("Edge") ? "Edge"
    : "Navigateur";
  const os = ua.includes("Windows") ? "Windows"
    : ua.includes("Mac") ? "macOS"
    : ua.includes("Linux") ? "Linux"
    : ua.includes("Android") ? "Android"
    : ua.includes("iOS") ? "iOS"
    : "Système";
  return { device: `${browser} sur ${os}`, browser, isMobile };
}

export default function ProfilePage() {
  const { user: authUser } = useAuth();
  const qc = useQueryClient();

  const [profileForm, setProfileForm] = useState<{ firstName: string; lastName: string; phone: string } | null>(null);
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [pwError, setPwError] = useState("");

  const { data: profile, isLoading } = useQuery<Profile>({
    queryKey: ["cockpit-me"],
    queryFn: () => apiFetch<Profile>("/api/super-admin/me"),
  });

  // Initialise le formulaire dès que le profil est chargé
  if (profile && !profileForm) {
    setProfileForm({ firstName: profile.firstName, lastName: profile.lastName, phone: profile.phone ?? "" });
  }

  const { data: sessionData } = useQuery({
    queryKey: ["cockpit-me-sessions"],
    queryFn: () => apiFetch<SessionData>("/api/super-admin/me/sessions"),
  });

  const profileMut = useMutation({
    mutationFn: (body: typeof profileForm) => apiFetch("/api/super-admin/me", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { toast.success("Profil mis à jour"); qc.invalidateQueries({ queryKey: ["cockpit-me"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const pwMut = useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      apiFetch("/api/super-admin/me/change-password", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success("Mot de passe changé avec succès");
      setPwForm({ current: "", newPw: "", confirm: "" });
      setPwError("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const revokeSessionsMut = useMutation({
    mutationFn: () => apiFetch("/api/super-admin/me/sessions", { method: "DELETE" }),
    onSuccess: () => { toast.success("Tous les appareils ont été déconnectés"); qc.invalidateQueries({ queryKey: ["cockpit-me-sessions"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const handlePwSubmit = () => {
    setPwError("");
    if (!pwForm.current || !pwForm.newPw || !pwForm.confirm) {
      setPwError("Tous les champs sont requis");
      return;
    }
    if (pwForm.newPw !== pwForm.confirm) {
      setPwError("Les mots de passe ne correspondent pas");
      return;
    }
    if (pwForm.newPw.length < 8) {
      setPwError("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }
    pwMut.mutate({ currentPassword: pwForm.current, newPassword: pwForm.newPw });
  };

  const initials = profile
    ? `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase()
    : (authUser?.email?.[0] ?? "?").toUpperCase();

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div>
      <div className="page-header mb-6">
        <div>
          <h1 className="page-title">Mon profil</h1>
          <p className="page-subtitle">Gérez vos informations personnelles, votre mot de passe et vos sessions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne gauche — avatar + stats */}
        <div className="space-y-4">
          <Card className="premium-card">
            <CardContent className="pt-6 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-primary">{initials}</span>
              </div>
              <p className="font-semibold text-base">{profile ? `${profile.firstName} ${profile.lastName}` : authUser?.email}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{profile?.email}</p>
              <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-xs font-semibold text-primary">
                <Shield className="w-3 h-3" /> Super Admin
              </div>
            </CardContent>
          </Card>
          <Card className="premium-card">
            <CardContent className="pt-5 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Dernière connexion</span>
                <span className="font-medium text-xs text-right">{fmtDatetime(profile?.lastLoginAt ?? null)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Compte créé</span>
                <span className="font-medium text-xs text-right">{profile ? new Date(profile.createdAt).toLocaleDateString("fr-FR") : "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sessions actives</span>
                <span className="font-medium">{sessionData?.sessions.length ?? 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Appareils mémorisés</span>
                <span className="font-medium">{sessionData?.trustedDevices.length ?? 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Colonne droite — forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Informations personnelles */}
          <Card className="premium-card">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <UserCircle className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Informations personnelles</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Prénom</Label>
                  <Input
                    value={profileForm?.firstName ?? ""}
                    onChange={e => setProfileForm(f => f ? { ...f, firstName: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Nom</Label>
                  <Input
                    value={profileForm?.lastName ?? ""}
                    onChange={e => setProfileForm(f => f ? { ...f, lastName: e.target.value } : null)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Adresse email</Label>
                <Input value={profile?.email ?? ""} disabled className="bg-muted/50 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">L'email ne peut pas être modifié depuis cette interface.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Téléphone</Label>
                <Input
                  type="tel"
                  placeholder="+228 90 00 00 00"
                  value={profileForm?.phone ?? ""}
                  onChange={e => setProfileForm(f => f ? { ...f, phone: e.target.value } : null)}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => profileForm && profileMut.mutate(profileForm)}
                  disabled={profileMut.isPending}
                  className="gap-2"
                >
                  {profileMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Enregistrer
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Changement de mot de passe */}
          <Card className="premium-card">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Changer le mot de passe</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Mot de passe actuel</Label>
                <Input type="password" value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Nouveau mot de passe</Label>
                <Input type="password" value={pwForm.newPw} onChange={e => setPwForm(f => ({ ...f, newPw: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Confirmer le nouveau mot de passe</Label>
                <Input type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
              </div>

              {/* Règles */}
              <div className="space-y-1.5 p-3 bg-muted/50 rounded-lg">
                <p className="text-xs font-medium text-muted-foreground mb-2">Règles de sécurité</p>
                {[
                  { ok: pwForm.newPw.length >= 8, label: "Au moins 8 caractères" },
                  { ok: /[A-Z]/.test(pwForm.newPw), label: "Au moins une majuscule" },
                  { ok: /[0-9]/.test(pwForm.newPw), label: "Au moins un chiffre" },
                  { ok: pwForm.newPw === pwForm.confirm && pwForm.confirm.length > 0, label: "Les mots de passe correspondent" },
                ].map(r => (
                  <div key={r.label} className="flex items-center gap-2 text-xs">
                    {r.ok
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      : <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                    }
                    <span className={r.ok ? "text-emerald-600" : "text-muted-foreground"}>{r.label}</span>
                  </div>
                ))}
              </div>

              {pwError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {pwError}
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handlePwSubmit} disabled={pwMut.isPending} className="gap-2">
                  {pwMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Changer le mot de passe
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sessions actives */}
          <Card className="premium-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-primary" />
                  <CardTitle className="text-sm font-semibold">Sessions & appareils</CardTitle>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50 gap-2"
                  onClick={() => { if (confirm("Déconnecter tous les autres appareils ?")) revokeSessionsMut.mutate(); }}
                  disabled={revokeSessionsMut.isPending}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Tout déconnecter
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!sessionData || (sessionData.sessions.length === 0 && sessionData.trustedDevices.length === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune session active</p>
              ) : (
                <div className="space-y-3">
                  {sessionData.sessions.map(s => {
                    const { device, isMobile } = parseUA(s.userAgent);
                    return (
                      <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                        <div className="mt-0.5 shrink-0">
                          {isMobile
                            ? <Smartphone className="w-4 h-4 text-muted-foreground" />
                            : <Laptop className="w-4 h-4 text-muted-foreground" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{device}</p>
                          <p className="text-xs text-muted-foreground">
                            IP : {s.ipAddress ?? "inconnue"} · Connexion le {fmtDatetime(s.createdAt)}
                          </p>
                          <p className="text-xs text-muted-foreground">Expire le {fmtDatetime(s.expiresAt)}</p>
                        </div>
                        <div className="shrink-0">
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" title="Active" />
                        </div>
                      </div>
                    );
                  })}
                  {sessionData.trustedDevices.length > 0 && (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-1">Appareils mémorisés (bypass 2FA)</p>
                      {sessionData.trustedDevices.map(d => (
                        <div key={d.id} className="flex items-start gap-3 p-3 rounded-lg border border-dashed">
                          <Laptop className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{d.label ?? "Appareil mémorisé"}</p>
                            <p className="text-xs text-muted-foreground">
                              IP : {d.ipAddress ?? "inconnue"} · Ajouté le {fmtDatetime(d.createdAt)}
                            </p>
                            <p className="text-xs text-muted-foreground">Expire le {fmtDatetime(d.expiresAt)}</p>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
