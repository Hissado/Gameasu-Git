import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, Loader2, Eye, EyeOff, Building2, User, Mail, Lock, Phone, Globe } from "lucide-react";
import { PLAN_CATALOG, PERIODICITY_OPTIONS, calcPlanPricing } from "@/lib/pricing-config";
import { formatFCFA } from "@/lib/format";

const PLAN_ORDER = ["STARTER", "BUSINESS", "PREMIUM"];

const INDUSTRY_OPTIONS = [
  { value: "consulting", label: "Conseil & Services" },
  { value: "btp", label: "BTP & Construction" },
  { value: "commerce", label: "Commerce & Distribution" },
  { value: "industrie", label: "Industrie & Production" },
  { value: "sante", label: "Santé & Médical" },
  { value: "education", label: "Éducation & Formation" },
  { value: "transport", label: "Transport & Logistique" },
  { value: "finance", label: "Finance & Assurance" },
  { value: "technologie", label: "Technologie & IT" },
  { value: "autre", label: "Autre" },
];

const COUNTRY_OPTIONS = [
  { value: "TG", label: "Togo" },
  { value: "CI", label: "Côte d'Ivoire" },
  { value: "SN", label: "Sénégal" },
  { value: "BJ", label: "Bénin" },
  { value: "GH", label: "Ghana" },
  { value: "CM", label: "Cameroun" },
  { value: "BF", label: "Burkina Faso" },
  { value: "ML", label: "Mali" },
  { value: "GN", label: "Guinée" },
  { value: "CD", label: "RD Congo" },
];

const PLAN_COLORS: Record<string, { border: string; badge: string; button: string }> = {
  STARTER:  { border: "border-slate-300",  badge: "bg-slate-100 text-slate-700",   button: "bg-slate-700 hover:bg-slate-800" },
  BUSINESS: { border: "border-blue-400",   badge: "bg-blue-100 text-blue-700",     button: "bg-blue-600 hover:bg-blue-700" },
  PREMIUM:  { border: "border-purple-400", badge: "bg-purple-100 text-purple-700", button: "bg-purple-700 hover:bg-purple-800" },
};

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const params = new URLSearchParams(window.location.search);
  const paramPlan = (params.get("plan") ?? "BUSINESS").toUpperCase();
  const paramSeats = parseInt(params.get("seats") ?? "1") || 1;
  const paramPeriodicity = params.get("periodicity") ?? "monthly";

  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    orgName: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    industry: "",
    country: "TG",
    planCode: PLAN_ORDER.includes(paramPlan) ? paramPlan : "BUSINESS",
    seats: paramSeats,
    periodicity: ["monthly","quarterly","semiannual","annual"].includes(paramPeriodicity) ? paramPeriodicity : "monthly",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [emailChecked, setEmailChecked] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [emailCheckTimer, setEmailCheckTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const plan = PLAN_CATALOG.find(p => p.code === form.planCode);
  const pricing = plan && !plan.isEnterprise
    ? calcPlanPricing({ planCode: plan.code, seats: form.seats, periodicity: form.periodicity as any })
    : null;

  // Vérification email temps réel
  useEffect(() => {
    if (emailCheckTimer) clearTimeout(emailCheckTimer);
    if (!form.email || !form.email.includes("@")) {
      setEmailAvailable(null);
      setEmailChecked(false);
      return;
    }
    setEmailChecked(false);
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/public/check-email?email=${encodeURIComponent(form.email)}`) as { available: boolean };
        setEmailAvailable(res.available);
        setEmailChecked(true);
      } catch {
        setEmailAvailable(null);
      }
    }, 500);
    setEmailCheckTimer(timer);
    return () => clearTimeout(timer);
  }, [form.email]);

  function set(field: string, value: string | number) {
    setForm(f => ({ ...f, [field]: value }));
    if (errors[field]) setErrors(e => { const n = { ...e }; delete n[field]; return n; });
  }

  function validateStep1() {
    const e: Record<string, string> = {};
    if (!form.orgName.trim()) e.orgName = "Nom de l'organisation requis";
    if (!form.firstName.trim()) e.firstName = "Prénom requis";
    if (!form.lastName.trim()) e.lastName = "Nom requis";
    if (!form.email.includes("@")) e.email = "Email invalide";
    if (emailAvailable === false) e.email = "Cet email est déjà utilisé";
    if (form.password.length < 8) e.password = "Minimum 8 caractères";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function goToStep2() {
    if (validateStep1()) setStep(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch("/api/public/register", {
        method: "POST",
        body: JSON.stringify({
          orgName: form.orgName,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
          phone: form.phone || undefined,
          country: form.country,
          industry: form.industry || undefined,
          planCode: form.planCode,
          seats: form.seats,
          periodicity: form.periodicity,
        }),
      }) as { token: string };
      localStorage.setItem("auth_token", res.token);
      toast({ title: "Compte créé !", description: "Finalisez votre paiement pour activer votre espace." });
      setLocation("/facturation");
      window.location.reload();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erreur", description: err?.message ?? "Impossible de créer le compte." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#080E1C] via-[#0C1830] to-[#142040] flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="text-[#F37021] font-extrabold tracking-widest text-sm mb-3 uppercase">Gaméasù</div>
        <h1 className="text-white text-3xl font-bold mb-2">Créer votre espace de travail</h1>
        <p className="text-slate-400 text-sm">Démarrez gratuitement, aucune carte bancaire requise pour s'inscrire.</p>
      </div>

      <div className="w-full max-w-4xl">
        {/* Stepper */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {[
            { n: 1, label: "Vos informations" },
            { n: 2, label: "Votre formule" },
          ].map(({ n, label }) => (
            <React.Fragment key={n}>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                  step > n ? "bg-emerald-500 text-white" : step === n ? "bg-[#F37021] text-white" : "bg-slate-700 text-slate-400",
                )}>
                  {step > n ? <Check className="w-4 h-4" /> : n}
                </div>
                <span className={cn("text-sm font-medium hidden sm:block", step >= n ? "text-white" : "text-slate-500")}>
                  {label}
                </span>
              </div>
              {n < 2 && <div className="h-px w-12 bg-slate-600" />}
            </React.Fragment>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Colonne gauche : infos org */}
              <Card className="bg-[#0f1a2e] border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-[#F37021]" />
                    Votre organisation
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Ces informations identifient votre espace de travail.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-slate-300 mb-1.5 block">Nom de l'organisation <span className="text-red-400">*</span></Label>
                    <Input
                      value={form.orgName}
                      onChange={e => set("orgName", e.target.value)}
                      placeholder="Ex. : Hissado Consulting"
                      className={cn("bg-[#162035] border-slate-600 text-white placeholder:text-slate-500", errors.orgName && "border-red-500")}
                    />
                    {errors.orgName && <p className="text-red-400 text-xs mt-1">{errors.orgName}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-slate-300 mb-1.5 block">Secteur</Label>
                      <Select value={form.industry} onValueChange={v => set("industry", v)}>
                        <SelectTrigger className="bg-[#162035] border-slate-600 text-slate-300">
                          <SelectValue placeholder="Secteur…" />
                        </SelectTrigger>
                        <SelectContent>
                          {INDUSTRY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-slate-300 mb-1.5 block">Pays</Label>
                      <Select value={form.country} onValueChange={v => set("country", v)}>
                        <SelectTrigger className="bg-[#162035] border-slate-600 text-slate-300">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Colonne droite : infos compte */}
              <Card className="bg-[#0f1a2e] border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <User className="w-5 h-5 text-[#F37021]" />
                    Votre compte administrateur
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Ce compte aura tous les droits sur votre espace.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-slate-300 mb-1.5 block">Prénom <span className="text-red-400">*</span></Label>
                      <Input
                        value={form.firstName}
                        onChange={e => set("firstName", e.target.value)}
                        placeholder="Kodjo"
                        className={cn("bg-[#162035] border-slate-600 text-white placeholder:text-slate-500", errors.firstName && "border-red-500")}
                      />
                      {errors.firstName && <p className="text-red-400 text-xs mt-1">{errors.firstName}</p>}
                    </div>
                    <div>
                      <Label className="text-slate-300 mb-1.5 block">Nom <span className="text-red-400">*</span></Label>
                      <Input
                        value={form.lastName}
                        onChange={e => set("lastName", e.target.value)}
                        placeholder="Hissado"
                        className={cn("bg-[#162035] border-slate-600 text-white placeholder:text-slate-500", errors.lastName && "border-red-500")}
                      />
                      {errors.lastName && <p className="text-red-400 text-xs mt-1">{errors.lastName}</p>}
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-300 mb-1.5 block flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" /> Email <span className="text-red-400">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        type="email"
                        value={form.email}
                        onChange={e => set("email", e.target.value)}
                        placeholder="vous@exemple.com"
                        className={cn("bg-[#162035] border-slate-600 text-white placeholder:text-slate-500 pr-10",
                          errors.email && "border-red-500",
                          emailChecked && emailAvailable && "border-emerald-500",
                        )}
                      />
                      {emailChecked && (
                        <div className={cn("absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center",
                          emailAvailable ? "text-emerald-400" : "text-red-400")}>
                          {emailAvailable ? <Check className="w-3.5 h-3.5" /> : "✗"}
                        </div>
                      )}
                    </div>
                    {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                    {emailChecked && emailAvailable && <p className="text-emerald-400 text-xs mt-1">Email disponible ✓</p>}
                  </div>
                  <div>
                    <Label className="text-slate-300 mb-1.5 block flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" /> Mot de passe <span className="text-red-400">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={form.password}
                        onChange={e => set("password", e.target.value)}
                        placeholder="8 caractères minimum"
                        className={cn("bg-[#162035] border-slate-600 text-white placeholder:text-slate-500 pr-10", errors.password && "border-red-500")}
                      />
                      <button type="button" onClick={() => setShowPassword(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
                    {form.password.length > 0 && form.password.length < 8 && (
                      <p className="text-amber-400 text-xs mt-1">{8 - form.password.length} caractères manquants</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-slate-300 mb-1.5 block flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" /> Téléphone
                    </Label>
                    <Input
                      type="tel"
                      value={form.phone}
                      onChange={e => set("phone", e.target.value)}
                      placeholder="+228 90 00 00 00"
                      className="bg-[#162035] border-slate-600 text-white placeholder:text-slate-500"
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="lg:col-span-2 flex justify-between items-center">
                <a href="/login" className="text-slate-400 hover:text-slate-200 text-sm">
                  Déjà un compte ? Se connecter →
                </a>
                <Button
                  type="button"
                  onClick={goToStep2}
                  className="bg-[#F37021] hover:bg-[#d96318] text-white font-semibold px-8 py-2.5 rounded-lg"
                >
                  Suivant : choisir ma formule
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              {/* Sélecteur de plan */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PLAN_CATALOG.filter(p => !p.isEnterprise && PLAN_ORDER.includes(p.code)).map(p => {
                  const pricingP = calcPlanPricing({ planCode: p.code, seats: form.seats, periodicity: form.periodicity as any });
                  const colors = PLAN_COLORS[p.code] ?? PLAN_COLORS.BUSINESS;
                  const isSelected = form.planCode === p.code;
                  return (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => set("planCode", p.code)}
                      className={cn(
                        "text-left rounded-xl border-2 p-5 transition-all bg-[#0f1a2e] hover:border-opacity-80",
                        isSelected ? `${colors.border} ring-2 ring-offset-0 ring-offset-transparent` : "border-slate-700",
                      )}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", colors.badge)}>{p.name}</span>
                          {p.badge && <span className="ml-2 text-xs text-[#F37021] font-semibold">⭐ {p.badge}</span>}
                        </div>
                        {isSelected && <div className="w-5 h-5 rounded-full bg-[#F37021] flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
                      </div>
                      <div className="text-2xl font-bold text-white mb-0.5">
                        {formatFCFA(p.monthlyPriceTTC)}
                        <span className="text-sm font-normal text-slate-400"> /util/mois</span>
                      </div>
                      <p className="text-slate-400 text-xs mb-3">{p.tagline}</p>
                      <ul className="space-y-1">
                        {(p.features as readonly string[]).map((f: string) => (
                          <li key={f} className="text-slate-300 text-xs flex items-start gap-1.5">
                            <Check className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />{f}
                          </li>
                        ))}
                      </ul>
                      {pricingP && !pricingP.isEnterprise && isSelected && (
                        <div className="mt-4 pt-3 border-t border-slate-700">
                          <div className="text-[#F37021] font-bold">{formatFCFA(pricingP.ttc)} TTC</div>
                          <div className="text-slate-400 text-xs">pour {form.seats} siège{form.seats > 1 ? "s" : ""} × {pricingP.months} mois</div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Sièges + Périodicité */}
              <Card className="bg-[#0f1a2e] border-slate-700">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label className="text-slate-300 mb-1.5 block">Nombre de sièges (utilisateurs)</Label>
                      <div className="flex items-center gap-3">
                        <Button type="button" variant="outline" size="sm"
                          className="border-slate-600 text-slate-300 hover:bg-slate-700 w-8 h-8 p-0"
                          onClick={() => set("seats", Math.max(1, form.seats - 1))}>−</Button>
                        <span className="text-white text-xl font-bold w-12 text-center">{form.seats}</span>
                        <Button type="button" variant="outline" size="sm"
                          className="border-slate-600 text-slate-300 hover:bg-slate-700 w-8 h-8 p-0"
                          onClick={() => set("seats", Math.min(500, form.seats + 1))}>+</Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-slate-300 mb-1.5 block">Périodicité</Label>
                      <div className="flex flex-wrap gap-2">
                        {PERIODICITY_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => set("periodicity", opt.value)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-sm font-medium border transition-all",
                              form.periodicity === opt.value
                                ? "bg-[#F37021] border-[#F37021] text-white"
                                : "border-slate-600 text-slate-400 hover:border-slate-400",
                            )}
                          >
                            {opt.label}
                            {opt.discount > 0 && (
                              <span className="ml-1.5 text-xs opacity-75">−{opt.discount * 100}%</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Récapitulatif */}
              {pricing && !pricing.isEnterprise && plan && (
                <Card className="bg-gradient-to-br from-[#F37021]/10 to-transparent border-[#F37021]/30">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <p className="text-slate-400 text-sm mb-1">Récapitulatif de votre abonnement</p>
                        <p className="text-white font-semibold">
                          {plan.name} — {form.seats} siège{form.seats > 1 ? "s" : ""} — {PERIODICITY_OPTIONS.find(o => o.value === form.periodicity)?.label}
                        </p>
                        <p className="text-slate-400 text-xs mt-0.5">
                          HT : {formatFCFA(pricing.amountHT)} · TVA 18% : {formatFCFA(pricing.tva)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-[#F37021]">{formatFCFA(pricing.ttc)}</div>
                        <div className="text-slate-400 text-xs">TTC — paiement après inscription</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(1)}
                  className="border-slate-600 text-slate-300 hover:bg-slate-800">
                  ← Retour
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-[#F37021] hover:bg-[#d96318] text-white font-bold px-8 py-2.5 text-base rounded-lg"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Créer mon espace et passer au paiement →
                </Button>
              </div>
            </div>
          )}
        </form>

        <p className="text-center text-slate-500 text-xs mt-8">
          En créant votre espace, vous acceptez les{" "}
          <a href="#" className="text-slate-400 underline">Conditions d'utilisation</a> et la{" "}
          <a href="#" className="text-slate-400 underline">Politique de confidentialité</a> de Gaméasù.
        </p>
      </div>
    </div>
  );
}
