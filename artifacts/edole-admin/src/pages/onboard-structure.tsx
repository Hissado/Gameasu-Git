/**
 * Page publique d'auto-onboarding d'une structure.
 * Accessible via le lien généré en mode "Lien d'invitation" depuis /super-admin.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2, Building2, Copy } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatFCFA } from "@/lib/format";

type Plan = { id: string; code: string; name: string; monthlyPricePerSeat: number; currency: string; tagline?: string };
type InitData = {
  invitation: { contactEmail?: string; contactName?: string; suggestedPlanCode?: string; suggestedOrgName?: string; expiresAt: string };
  plans: Plan[];
  trialDays: number;
};

export default function OnboardStructurePage() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string>("");
  const [init, setInit] = useState<InitData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [orgName, setOrgName] = useState("");
  const [country, setCountry] = useState("TG");
  const [industry, setIndustry] = useState("");
  const [planCode, setPlanCode] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ acceptUrl: string; temporaryPassword: string; orgName: string; trialEndsAt: string } | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    if (!t) { setLoadError("Lien invalide."); return; }
    setToken(t);
    apiFetch<InitData>(`/api/structure-onboarding/${t}`)
      .then((d) => {
        setInit(d);
        setOrgName(d.invitation.suggestedOrgName ?? "");
        setPlanCode(d.invitation.suggestedPlanCode ?? d.plans[0]?.code ?? "");
        setAdminEmail(d.invitation.contactEmail ?? "");
        if (d.invitation.contactName) {
          const parts = d.invitation.contactName.trim().split(/\s+/);
          setAdminFirstName(parts[0] ?? "");
          setAdminLastName(parts.slice(1).join(" "));
        }
      })
      .catch((e: any) => setLoadError(e?.body?.error ?? "Lien invalide ou expiré"));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const r = await apiFetch<any>(`/api/structure-onboarding/${token}`, {
        method: "POST",
        body: { orgName, planCode, adminEmail, adminFirstName, adminLastName, country, industry: industry || undefined } as any,
      });
      setResult({ acceptUrl: r.acceptUrl, temporaryPassword: r.temporaryPassword, orgName: r.organization.name, trialEndsAt: r.trialEndsAt });
    } catch (e: any) {
      setError(e?.body?.error ?? e?.message ?? "Erreur");
    } finally { setBusy(false); }
  };

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-white p-4">
        <Card className="w-full max-w-md"><CardContent className="p-8 text-center">
          <p className="font-medium text-destructive mb-2">{loadError}</p>
          <Button variant="outline" onClick={() => setLocation("/login")}>Aller à la connexion</Button>
        </CardContent></Card>
      </div>
    );
  }
  if (!init) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-white p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CheckCircle2 className="w-6 h-6 text-emerald-600" />Espace créé</CardTitle>
            <CardDescription>{result.orgName} — essai gratuit jusqu'au {new Date(result.trialEndsAt).toLocaleDateString("fr-FR")}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-emerald-200 bg-emerald-50">
              <AlertDescription className="text-emerald-800 text-sm">
                Votre compte administrateur a été créé. Activez-le pour définir votre mot de passe et accéder à votre espace.
              </AlertDescription>
            </Alert>
            <Button className="w-full bg-primary hover:bg-primary/90" onClick={() => { window.location.href = result.acceptUrl; }}>
              Activer mon compte administrateur
            </Button>
            <div className="text-xs text-muted-foreground">
              <p>Mot de passe temporaire : <strong className="font-mono">{result.temporaryPassword}</strong></p>
              <button className="underline text-primary mt-1 inline-flex items-center gap-1" onClick={() => navigator.clipboard.writeText(result.acceptUrl)}>
                <Copy className="w-3 h-3" />Copier le lien
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-white p-4 py-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="w-6 h-6 text-primary" />Bienvenue sur Gaméasù</CardTitle>
          <CardDescription>Configurez votre organisation en quelques secondes. Essai gratuit {init.trialDays} jours, sans engagement.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Votre organisation</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Nom de la structure *</Label><Input required value={orgName} onChange={(e) => setOrgName(e.target.value)} /></div>
                <div><Label>Pays</Label><Input value={country} onChange={(e) => setCountry(e.target.value)} maxLength={2} /></div>
                <div><Label>Secteur</Label><Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="BTP, services…" /></div>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Plan d'abonnement</p>
              <Select value={planCode} onValueChange={setPlanCode}>
                <SelectTrigger><SelectValue placeholder="Choisir un plan" /></SelectTrigger>
                <SelectContent>
                  {init.plans.map((p) => (
                    <SelectItem key={p.code} value={p.code}>
                      <span className="font-medium">{p.name}</span> — {formatFCFA(p.monthlyPricePerSeat)}/siège/mois
                      {p.tagline ? <span className="text-xs text-muted-foreground ml-2">{p.tagline}</span> : null}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">L'abonnement démarre en essai {init.trialDays} jours, puis passe automatiquement en actif.</p>
            </div>

            <div className="space-y-3 pt-2 border-t">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Votre compte administrateur</p>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Prénom *</Label><Input required value={adminFirstName} onChange={(e) => setAdminFirstName(e.target.value)} /></div>
                <div><Label>Nom *</Label><Input required value={adminLastName} onChange={(e) => setAdminLastName(e.target.value)} /></div>
                <div className="col-span-2"><Label>Email *</Label><Input required type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} /></div>
              </div>
            </div>

            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

            <Button type="submit" disabled={busy || !orgName || !planCode || !adminEmail || !adminFirstName || !adminLastName} className="w-full bg-primary hover:bg-primary/90">
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Activer mon espace ({init.trialDays} jours gratuits)
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
