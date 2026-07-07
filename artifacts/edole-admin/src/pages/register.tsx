import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { BRANDING } from "@/config/branding";
import { cn } from "@/lib/utils";
import { Loader2, Eye, EyeOff, Check, ChevronLeft, Users } from "lucide-react";
import { PLAN_CATALOG, PERIODICITY_OPTIONS, calcPlanPricing } from "@/lib/pricing-config";
import { formatFCFA } from "@/lib/format";

const INDUSTRY_OPTIONS = [
  { value: "consulting",   label: "Conseil & Services" },
  { value: "btp",          label: "BTP & Construction" },
  { value: "commerce",     label: "Commerce & Distribution" },
  { value: "industrie",    label: "Industrie & Production" },
  { value: "sante",        label: "Santé & Médical" },
  { value: "education",    label: "Éducation & Formation" },
  { value: "transport",    label: "Transport & Logistique" },
  { value: "finance",      label: "Finance & Assurance" },
  { value: "technologie",  label: "Technologie & IT" },
  { value: "autre",        label: "Autre" },
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

const PERIOD_LABELS: Record<string, string> = {
  monthly:    "Mensuel",
  quarterly:  "Trimestriel",
  semiannual: "Semestriel",
  annual:     "Annuel",
};

const PLAN_BADGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  STARTER:  { bg: "#F8FAFC", text: "#475569", border: "#CBD5E1" },
  BUSINESS: { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
  PREMIUM:  { bg: "#F5F3FF", text: "#6D28D9", border: "#DDD6FE" },
};

const SELECTABLE_PLANS = [
  {
    code: "STARTER",
    name: "Starter",
    modules: 7,
    description: "L'essentiel pour gérer vos ventes, clients, factures et dépenses au quotidien.",
    color: "#0E1A39",
    badge: null as string | null,
    badgeBg: "",
  },
  {
    code: "BUSINESS",
    name: "Business",
    modules: 15,
    description: "Une formule complète pour piloter vos équipes, vos opérations, votre paie et votre budget.",
    color: "#1D4ED8",
    badge: "Populaire",
    badgeBg: "#1D4ED8",
  },
  {
    code: "PREMIUM",
    name: "Premium",
    modules: 24,
    description: "Le niveau avancé pour centraliser, automatiser et piloter toute votre organisation avec précision.",
    color: "#F37021",
    badge: "Complet",
    badgeBg: "#F37021",
  },
];

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const params = new URLSearchParams(window.location.search);
  const hasPlanFromUrl = params.get("plan") !== null;
  const rawPlan = (params.get("plan") ?? "BUSINESS").toUpperCase();
  const rawSeats = parseInt(params.get("seats") ?? params.get("users") ?? "1") || 1;
  const rawPeriodicity = params.get("periodicity") ?? params.get("period") ?? params.get("billing_cycle") ?? "monthly";
  const rawPromo = params.get("promo") ?? params.get("code") ?? "";

  const initPlan = ["STARTER", "BUSINESS", "PREMIUM"].includes(rawPlan) ? rawPlan : "BUSINESS";
  const initSeats = Math.min(500, Math.max(1, rawSeats));
  const initPeriodicity = ["monthly", "quarterly", "semiannual", "annual"].includes(rawPeriodicity) ? rawPeriodicity : "monthly";

  const [step, setStep] = useState<"select" | "form">(hasPlanFromUrl ? "form" : "select");
  const [selectedPlan, setSelectedPlan] = useState(initPlan);
  const [selectedSeats, setSelectedSeats] = useState(initSeats);
  const [selectedPeriodicity, setSelectedPeriodicity] = useState(initPeriodicity);

  const planCode    = selectedPlan;
  const seats       = selectedSeats;
  const periodicity = selectedPeriodicity;

  const plan       = PLAN_CATALOG.find(p => p.code === planCode);
  const pricing    = plan && !plan.isEnterprise ? calcPlanPricing({ planCode, seats, periodicity: periodicity as any }) : null;
  const pricingData = pricing && !pricing.isEnterprise ? pricing : null;
  const planBadge  = PLAN_BADGE_COLORS[planCode] ?? PLAN_BADGE_COLORS.BUSINESS;

  const [form, setForm] = useState({
    orgName:         "",
    firstName:       "",
    lastName:        "",
    email:           "",
    password:        "",
    confirmPassword: "",
    phone:           "",
    city:            "",
    industry:        "",
    country:         "TG",
    promoCode:       rawPromo,
    terms:           false,
  });

  const [errors, setErrors]         = useState<Record<string, string>>({});
  const [loading, setLoading]       = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);

  const [emailStatus, setEmailStatus] = useState<"idle" | "checking" | "available" | "exists">("idle");
  useEffect(() => {
    if (!form.email.includes("@")) { setEmailStatus("idle"); return; }
    setEmailStatus("checking");
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch<{ available: boolean }>(`/api/public/check-email?email=${encodeURIComponent(form.email)}`);
        setEmailStatus(res.available ? "available" : "exists");
      } catch { setEmailStatus("idle"); }
    }, 500);
    return () => clearTimeout(t);
  }, [form.email]);

  function setFormField(field: string, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }));
    if (errors[field]) setErrors(e => { const n = { ...e }; delete n[field]; return n; });
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.orgName.trim())              e.orgName         = "Nom de l'organisation requis";
    if (!form.firstName.trim())            e.firstName       = "Prénom requis";
    if (!form.lastName.trim())             e.lastName        = "Nom requis";
    if (!form.email.includes("@"))         e.email           = "Adresse e-mail invalide";
    if (form.password.length < 8)          e.password        = "Minimum 8 caractères";
    if (form.password !== form.confirmPassword) e.confirmPassword = "Les mots de passe ne correspondent pas";
    if (!form.terms)                       e.terms           = "Vous devez accepter les conditions";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string }>("/api/public/register", {
        method: "POST",
        body: JSON.stringify({
          orgName:   form.orgName,
          firstName: form.firstName,
          lastName:  form.lastName,
          email:     form.email,
          password:  form.password,
          phone:     form.phone     || undefined,
          city:      form.city      || undefined,
          country:   form.country,
          industry:  form.industry  || undefined,
          planCode,
          seats,
          periodicity,
          promoCode: form.promoCode || undefined,
        }),
      });
      localStorage.setItem("auth_token", res.token);
      toast({ title: "Compte créé !", description: "Finalisez le paiement pour activer votre espace." });
      setLocation("/abonnement?openPay=1");
      window.location.reload();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erreur", description: err?.message ?? "Impossible de créer le compte." });
    } finally {
      setLoading(false);
    }
  }

  const year = new Date().getFullYear();

  // ─── ÉTAPE 0 : Simulateur de prix (style gameasu.com/tarifs) ─────────────
  if (step === "select") {
    return (
      <div
        className="min-h-screen w-full flex flex-col"
        style={{ background: "#EEF2FF", fontFamily: "var(--app-font-display, system-ui)" }}
      >
        {/* Header */}
        <div className="w-full flex items-center justify-center pt-8 pb-2 px-4">
          <img
            src={BRANDING.logoFullTransparent}
            alt={BRANDING.appName}
            draggable={false}
            className="select-none"
            style={{ height: "40px", width: "auto" }}
          />
        </div>

        <div className="flex-1 w-full max-w-[1080px] mx-auto px-4 py-10">

          {/* Titre */}
          <div className="text-center mb-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#1D4ED8] mb-3">SIMULATEUR DE PRIX</p>
            <h1 className="text-[28px] sm:text-[36px] font-extrabold text-[#0E1A39] leading-tight">
              Calculez votre abonnement
            </h1>
          </div>

          {/* ── Barre simulateur ─────────────────────────────────────────── */}
          <div
            className="rounded-2xl bg-white px-6 py-6 mt-8 mb-8"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 4px 20px rgba(0,0,0,0.08)", border: "1px solid #E5E7EB" }}
          >
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-8">

              {/* Colonne 1 : Utilisateurs */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Utilisateurs</span>
                </div>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-[40px] font-extrabold text-[#0E1A39] leading-none">{selectedSeats}</span>
                  <span className="text-[14px] text-gray-500">utilisateur{selectedSeats > 1 ? "s" : ""}</span>
                </div>
                {/* Slider */}
                <div className="relative">
                  <input
                    type="range"
                    min={1}
                    max={100}
                    value={Math.min(selectedSeats, 100)}
                    onChange={e => setSelectedSeats(Number(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{ accentColor: "#1D4ED8", background: `linear-gradient(to right, #1D4ED8 ${(Math.min(selectedSeats, 100) - 1) / 99 * 100}%, #E5E7EB ${(Math.min(selectedSeats, 100) - 1) / 99 * 100}%)` }}
                  />
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[11px] text-gray-400">1</span>
                    <span className="text-[11px] text-gray-400">50</span>
                    <span className="text-[11px] text-gray-400">100+</span>
                  </div>
                  {selectedSeats >= 100 && (
                    <div className="mt-3">
                      <input
                        type="number"
                        min={100}
                        max={500}
                        value={selectedSeats}
                        onChange={e => setSelectedSeats(Math.min(500, Math.max(1, Number(e.target.value) || 1)))}
                        className="w-28 h-8 rounded-lg border border-gray-200 text-center text-[13px] font-semibold text-[#0E1A39] focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="100+"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Colonne 2 : Périodicité */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Périodicité</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {PERIODICITY_OPTIONS.map(opt => {
                    const active = selectedPeriodicity === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSelectedPeriodicity(opt.value)}
                        className="rounded-xl py-3 px-4 text-left transition-all duration-100 focus:outline-none"
                        style={{
                          background: active ? "#1D4ED8" : "#F8FAFC",
                          border: active ? "1.5px solid #1D4ED8" : "1.5px solid #E5E7EB",
                        }}
                      >
                        <p className={`text-[13px] font-semibold ${active ? "text-white" : "text-[#0E1A39]"}`}>
                          {PERIOD_LABELS[opt.value]}
                        </p>
                        {opt.discount > 0 && (
                          <p className={`text-[11px] font-medium ${active ? "text-blue-200" : "text-emerald-600"}`}>
                            -{opt.discount * 100}%
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ── Cartes plan ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
            {SELECTABLE_PLANS.map(p => {
              const pr = calcPlanPricing({ planCode: p.code, seats: selectedSeats, periodicity: selectedPeriodicity as any });
              const prData = !pr.isEnterprise ? pr : null;
              const isSelected = selectedPlan === p.code;

              return (
                <div
                  key={p.code}
                  className="rounded-2xl bg-white flex flex-col transition-all duration-150"
                  style={{
                    border: isSelected ? `2px solid ${p.color}` : "2px solid #E5E7EB",
                    boxShadow: isSelected ? `0 0 0 4px ${p.color}18` : "0 1px 4px rgba(0,0,0,0.06)",
                  }}
                >
                  {/* Badge */}
                  <div className="px-5 pt-5 pb-0 flex items-start justify-between">
                    <div>
                      <p className="text-[15px] font-bold text-[#0E1A39] mb-0.5">{p.name}</p>
                      <p className="text-[11px] text-gray-400">{p.modules} modules</p>
                    </div>
                    {p.badge && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                        style={{ background: p.badgeBg }}
                      >
                        {p.badge}
                      </span>
                    )}
                  </div>

                  {/* Prix */}
                  <div className="px-5 pt-4 pb-2">
                    <p
                      className="text-[32px] font-extrabold leading-none mb-0.5"
                      style={{ color: p.color }}
                    >
                      {prData ? formatFCFA(prData.ttc) : "—"}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      TTC / mois
                    </p>
                    {prData && (
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {formatFCFA(prData.priceTTCPerSeat)} / util. / mois
                      </p>
                    )}
                  </div>

                  {/* Description */}
                  <div className="px-5 pb-4 flex-1">
                    <p className="text-[12px] text-gray-500 leading-relaxed">{p.description}</p>
                    {prData && prData.discount > 0 && (
                      <p className="text-[11px] text-emerald-600 font-semibold mt-2">
                        ✓ Remise {prData.discount * 100}% appliquée
                      </p>
                    )}
                  </div>

                  {/* CTA */}
                  <div className="px-5 pb-5">
                    <button
                      type="button"
                      onClick={() => { setSelectedPlan(p.code); setStep("form"); }}
                      className="w-full py-2.5 rounded-xl text-[13.5px] font-semibold transition-all duration-100 active:scale-[0.985]"
                      style={isSelected
                        ? { background: p.color, color: "#fff", border: `2px solid ${p.color}` }
                        : { background: "#fff", color: p.color, border: `2px solid ${p.color}` }
                      }
                    >
                      {isSelected ? "✓ Sélectionné · Continuer →" : "Sélectionner"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Offre Enterprise ─────────────────────────────────────────── */}
          <div
            className="rounded-2xl px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            style={{ background: "#0E1A39", border: "2px solid #1E293B" }}
          >
            <div>
              <p className="text-[15px] font-bold text-white mb-0.5">Offre Personnalisée</p>
              <p className="text-[12px] text-slate-400">Tous les modules · Utilisateurs illimités · SSO · Hébergement souverain · SLA dédié</p>
            </div>
            <a
              href="mailto:contact@gameasu.com"
              className="shrink-0 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-[#0E1A39] bg-white hover:bg-gray-100 transition-colors"
            >
              Contacter notre équipe →
            </a>
          </div>

          {/* Lien connexion */}
          <p className="text-center text-[12px] text-gray-500 mt-6">
            Déjà un compte ?{" "}
            <a href="/login" className="text-[#1D4ED8] hover:underline">Se connecter</a>
          </p>
        </div>

        <p className="text-center text-[11px] pb-4 text-gray-400">
          © {year} {BRANDING.legalName} · Connexion chiffrée TLS 1.3
        </p>
      </div>
    );
  }

  // ─── ÉTAPE 1 : Formulaire d'inscription ──────────────────────────────────
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-between px-4 py-10"
      style={{ background: "#F3F4F6", fontFamily: "var(--app-font-display, system-ui)" }}
    >
      <div />

      <div className="w-full max-w-[900px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src={BRANDING.logoFullTransparent}
            alt={BRANDING.appName}
            draggable={false}
            className="select-none mx-auto"
            style={{ height: "48px", width: "auto" }}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 items-start">

          {/* ══ COLONNE GAUCHE : Récapitulatif abonnement ═══════════════════ */}
          <div className="space-y-4">
            <div
              className="rounded-2xl bg-white px-7 py-7"
              style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.08), 0 4px 24px rgba(0,0,0,0.06)", border: "1px solid #E5E7EB" }}
            >
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Votre sélection</p>

              <div className="flex items-center gap-2 mb-4">
                <span
                  className="px-2.5 py-0.5 rounded-md text-[12px] font-bold"
                  style={{ background: planBadge.bg, color: planBadge.text, border: `1px solid ${planBadge.border}` }}
                >
                  {plan?.name ?? planCode}
                </span>
                {plan?.badge && (
                  <span className="text-[11px] font-medium" style={{ color: "#F37021" }}>⭐ {plan.badge}</span>
                )}
              </div>

              <div className="space-y-2.5 text-[13px] mb-5">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Utilisateurs</span>
                  <span className="font-semibold text-[#0E1A39]">{seats} siège{seats > 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Périodicité</span>
                  <span className="font-semibold text-[#0E1A39]">{PERIOD_LABELS[periodicity] ?? periodicity}</span>
                </div>
                {pricingData && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Prix / util. / mois</span>
                      <span className="font-semibold text-[#0E1A39]">{formatFCFA(pricingData.priceTTCPerSeat)} TTC</span>
                    </div>
                    <div className="border-t border-gray-100 pt-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-gray-400">
                        <span>Montant HT</span>
                        <span>{formatFCFA(pricingData.amountHT)}</span>
                      </div>
                      <div className="flex items-center justify-between text-gray-400">
                        <span>TVA 18 %</span>
                        <span>{formatFCFA(pricingData.tva)}</span>
                      </div>
                    </div>
                    <div
                      className="flex items-center justify-between rounded-xl px-4 py-3"
                      style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}
                    >
                      <span className="text-[13px] font-semibold text-[#1D4ED8]">Total TTC / mois</span>
                      <span className="text-[18px] font-extrabold text-[#1D4ED8]">{formatFCFA(pricingData.ttc)}</span>
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => setStep("select")}
                className="flex items-center gap-1 text-[12px] text-gray-400 hover:text-blue-600 transition-colors"
              >
                <ChevronLeft className="w-3 h-3" />
                Modifier ma sélection
              </button>
            </div>

            <div
              className="rounded-xl px-5 py-4"
              style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}
            >
              <p className="text-[12px] font-semibold text-[#92400E] mb-1">Prochaine étape : Paiement</p>
              <p className="text-[11.5px] text-[#78350F] leading-relaxed">
                Votre espace sera activé après validation du paiement. Plusieurs moyens acceptés&nbsp;: carte bancaire, Mobile Money, virement ou dépôt en agence.
              </p>
            </div>
          </div>

          {/* ══ COLONNE DROITE : Formulaire ════════════════════════════════ */}
          <div
            className="rounded-2xl bg-white px-8 py-8"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.08), 0 4px 24px rgba(0,0,0,0.06)", border: "1px solid #E5E7EB" }}
          >
            <h1 className="text-[20px] font-bold text-[#0E1A39] mb-1">Créer votre espace de travail</h1>
            <p className="text-[12.5px] text-gray-500 mb-6">
              Renseignez vos informations pour créer votre organisation sur Gameasu.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>

              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Organisation</p>
                <div className="space-y-3">
                  <Field label="Nom de l'organisation" required error={errors.orgName}>
                    <Input
                      value={form.orgName}
                      onChange={e => setFormField("orgName", e.target.value)}
                      placeholder="Ex. : Hissado Consulting"
                      className={fieldCls(!!errors.orgName)}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Secteur d'activité">
                      <select
                        value={form.industry}
                        onChange={e => setFormField("industry", e.target.value)}
                        className={fieldCls(false) + " cursor-pointer"}
                        style={{ height: "44px", paddingLeft: "12px", paddingRight: "12px", fontSize: "13.5px", borderRadius: "8px", border: "1px solid #D1D5DB", outline: "none", color: form.industry ? "#0E1A39" : "#9CA3AF" }}
                      >
                        <option value="">Secteur…</option>
                        {INDUSTRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Pays">
                      <select
                        value={form.country}
                        onChange={e => setFormField("country", e.target.value)}
                        className={fieldCls(false)}
                        style={{ height: "44px", paddingLeft: "12px", paddingRight: "12px", fontSize: "13.5px", borderRadius: "8px", border: "1px solid #D1D5DB", outline: "none", color: "#0E1A39" }}
                      >
                        {COUNTRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </Field>
                  </div>
                  <Field label="Ville">
                    <Input
                      value={form.city}
                      onChange={e => setFormField("city", e.target.value)}
                      placeholder="Lomé, Abidjan…"
                      className={fieldCls(false)}
                    />
                  </Field>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Compte administrateur</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Prénom" required error={errors.firstName}>
                      <Input
                        value={form.firstName}
                        onChange={e => setFormField("firstName", e.target.value)}
                        placeholder="Kodjo"
                        className={fieldCls(!!errors.firstName)}
                      />
                    </Field>
                    <Field label="Nom" required error={errors.lastName}>
                      <Input
                        value={form.lastName}
                        onChange={e => setFormField("lastName", e.target.value)}
                        placeholder="Hissado"
                        className={fieldCls(!!errors.lastName)}
                      />
                    </Field>
                  </div>

                  <Field label="Adresse e-mail professionnelle" required error={errors.email}>
                    <div className="relative">
                      <Input
                        type="email"
                        value={form.email}
                        onChange={e => setFormField("email", e.target.value)}
                        placeholder="vous@entreprise.com"
                        autoComplete="email"
                        className={cn(
                          fieldCls(!!errors.email),
                          "pr-9",
                          emailStatus === "available" && "border-emerald-400 focus-visible:ring-emerald-400",
                        )}
                      />
                      {emailStatus === "checking" && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-gray-400" />
                      )}
                      {emailStatus === "available" && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-500" />
                      )}
                    </div>
                    {emailStatus === "exists" && !errors.email && (
                      <p className="text-[11px] text-amber-600 mt-1">
                        Cet email existe déjà. Si c'est le vôtre, entrez votre mot de passe Gameasu pour créer une nouvelle organisation.
                      </p>
                    )}
                  </Field>

                  <Field label="Téléphone">
                    <Input
                      type="tel"
                      value={form.phone}
                      onChange={e => setFormField("phone", e.target.value)}
                      placeholder="+228 90 00 00 00"
                      className={fieldCls(false)}
                    />
                  </Field>

                  {(rawPromo || form.promoCode) && (
                    <Field label="Code promotionnel / partenaire">
                      <Input
                        value={form.promoCode}
                        onChange={e => setFormField("promoCode", e.target.value.toUpperCase())}
                        placeholder="EX. PARTNER2025"
                        className={fieldCls(false) + " font-mono tracking-wider"}
                      />
                    </Field>
                  )}

                  <Field label="Mot de passe" required error={errors.password}>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={form.password}
                        onChange={e => setFormField("password", e.target.value)}
                        placeholder="8 caractères minimum"
                        autoComplete="new-password"
                        className={cn(fieldCls(!!errors.password), "pr-10")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        tabIndex={-1}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {form.password.length > 0 && form.password.length < 8 && !errors.password && (
                      <p className="text-[11px] text-amber-500 mt-1">{8 - form.password.length} caractère{8 - form.password.length > 1 ? "s" : ""} manquant{8 - form.password.length > 1 ? "s" : ""}</p>
                    )}
                  </Field>

                  <Field label="Confirmer le mot de passe" required error={errors.confirmPassword}>
                    <div className="relative">
                      <Input
                        type={showConfirm ? "text" : "password"}
                        value={form.confirmPassword}
                        onChange={e => setFormField("confirmPassword", e.target.value)}
                        placeholder="Retapez votre mot de passe"
                        autoComplete="new-password"
                        className={cn(
                          fieldCls(!!errors.confirmPassword),
                          "pr-10",
                          form.confirmPassword && form.confirmPassword === form.password && "border-emerald-400",
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(v => !v)}
                        tabIndex={-1}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </Field>
                </div>
              </div>

              <div>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.terms}
                    onChange={e => setFormField("terms", e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded cursor-pointer"
                    style={{ accentColor: "#2563EB" }}
                  />
                  <span className="text-[12.5px] text-gray-600 leading-relaxed">
                    J'accepte les{" "}
                    <a href="#" className="text-blue-600 hover:underline">Conditions d'utilisation</a>
                    {" "}et la{" "}
                    <a href="#" className="text-blue-600 hover:underline">Politique de confidentialité</a>
                    {" "}de Gameasu.
                  </span>
                </label>
                {errors.terms && <p className="text-[11px] text-red-500 mt-1 ml-6">{errors.terms}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-lg text-[14px] font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.985] disabled:opacity-60"
                style={{ background: "#F37021" }}
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Création en cours…</>
                  : "Activer mon espace Gameasu →"}
              </button>

              <p className="text-center text-[12.5px] text-gray-500 pt-1">
                Déjà un compte ?{" "}
                <a href="/login" className="text-blue-600 hover:underline font-medium">Se connecter</a>
              </p>
            </form>
          </div>
        </div>
      </div>

      <p className="text-center text-[11px] pb-2 text-gray-400 mt-8">
        © {year} {BRANDING.legalName} · Connexion chiffrée TLS 1.3
      </p>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fieldCls(hasError: boolean) {
  return cn(
    "h-11 rounded-lg text-[13.5px] border-gray-300 focus-visible:ring-blue-600 w-full",
    hasError && "border-red-400 focus-visible:ring-red-400",
  );
}

function Field({
  label, required, error, children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[13px] font-medium text-gray-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}
