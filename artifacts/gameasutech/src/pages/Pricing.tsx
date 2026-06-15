import React, { useState } from "react";
import { Link } from "wouter";
import {
  Check, X, ChevronRight, Calculator, Zap, Building2, Crown, Sparkles,
  Phone, Mail, Globe, Users, Clock, Wallet, MessageSquare, SendHorizontal, Loader2,
} from "lucide-react";

// ── Données plans ─────────────────────────────────────────────────────────────
const TVA = 0.18;

type Plan = {
  code: string;
  name: string;
  pricePerUser: number;
  setupFee: number;
  minUsers: number;
  maxUsers: number | null;
  badge?: string;
  badgeCls?: string;
  icon: React.ReactNode;
  color: string;
  features: string[];
  notIncluded?: string[];
  cta: string;
  popular?: boolean;
};

const PLANS: Plan[] = [
  {
    code: "STARTER",
    name: "Starter",
    pricePerUser: 8000,
    setupFee: 0,
    minUsers: 1,
    maxUsers: 10,
    icon: <Zap className="w-5 h-5" />,
    color: "from-slate-500 to-slate-600",
    badge: "Gratuit à l'installation",
    badgeCls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    features: [
      "Jusqu'à 10 utilisateurs",
      "Tableau de bord & KPIs",
      "Gestion de projets & tâches",
      "CRM (clients, pipeline)",
      "Facturation & paiements",
      "Pointage kiosque",
      "Notifications",
      "Support standard",
    ],
    notIncluded: ["RH & Paie", "FP&A financier", "Inventaire avancé"],
    cta: "Démarrer gratuitement",
  },
  {
    code: "GROWTH",
    name: "Growth",
    pricePerUser: 18000,
    setupFee: 250000,
    minUsers: 5,
    maxUsers: 30,
    icon: <Building2 className="w-5 h-5" />,
    color: "from-primary to-orange-600",
    badge: "Le plus populaire",
    badgeCls: "bg-primary/10 text-primary border-primary/20",
    popular: true,
    features: [
      "Jusqu'à 30 utilisateurs",
      "Tout Starter +",
      "Équipements & locations",
      "Logistique & livraisons",
      "Messagerie interne temps réel",
      "RH & gestion des collaborateurs",
      "Paie & bulletins de salaire",
      "Reporting avancé",
    ],
    notIncluded: ["FP&A financier", "Inventaire avancé"],
    cta: "Choisir Growth",
  },
  {
    code: "PROFESSIONAL",
    name: "Professional",
    pricePerUser: 35000,
    setupFee: 750000,
    minUsers: 15,
    maxUsers: 100,
    icon: <Crown className="w-5 h-5" />,
    color: "from-violet-500 to-violet-700",
    features: [
      "Jusqu'à 100 utilisateurs",
      "Tout Growth +",
      "FP&A (reporting financier)",
      "Budgets & forecasts",
      "Inventaire & stocks",
      "Automatisation & alertes",
      "Analytics & intelligence",
      "Intégrations comptables",
      "Support prioritaire",
    ],
    cta: "Choisir Professional",
  },
  {
    code: "ENTERPRISE",
    name: "Enterprise",
    pricePerUser: 60000,
    setupFee: 2500000,
    minUsers: 50,
    maxUsers: null,
    icon: <Sparkles className="w-5 h-5" />,
    color: "from-slate-700 to-slate-900",
    features: [
      "Utilisateurs illimités",
      "Tout Professional +",
      "Multi-organisations",
      "SSO / IAM personnalisé",
      "API dédiée & webhooks",
      "SLA & uptime garantis",
      "Accompagnement dédié",
      "Déploiement on-premise possible",
    ],
    cta: "Contacter les ventes",
  },
];

// ── Helpers format ────────────────────────────────────────────────────────────
function fcfa(n: number) {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + " FCFA";
}

// ── Composant carte plan ──────────────────────────────────────────────────────
function PlanCard({ plan, selected, onSelect }: { plan: Plan; selected: boolean; onSelect: () => void }) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border-2 transition-all cursor-pointer
        ${plan.popular
          ? "border-primary shadow-xl shadow-primary/10 scale-[1.02]"
          : selected
          ? "border-primary/40 shadow-lg"
          : "border-slate-200 hover:border-slate-300 hover:shadow-md"
        }
        bg-white p-6`}
      onClick={onSelect}
    >
      {plan.popular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full shadow">
          Le plus populaire
        </div>
      )}

      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${plan.color} text-white mb-4`}>
        {plan.icon}
      </div>

      <div className="mb-1">
        <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
        {plan.badge && (
          <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border mt-1 ${plan.badgeCls}`}>
            {plan.badge}
          </span>
        )}
      </div>

      <div className="mt-3 mb-1">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-extrabold text-slate-900">
            {new Intl.NumberFormat("fr-FR").format(plan.pricePerUser)}
          </span>
          <span className="text-sm text-slate-500 font-medium">FCFA HT/user/mois</span>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          {plan.maxUsers ? `${plan.minUsers}–${plan.maxUsers} utilisateurs` : `${plan.minUsers}+ utilisateurs`}
        </p>
      </div>

      <div className="mt-3 py-3 border-y border-slate-100">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Frais d'installation (unique)</span>
          <span className={`font-semibold ${plan.setupFee === 0 ? "text-emerald-600" : "text-slate-900"}`}>
            {plan.setupFee === 0 ? "Offert" : fcfa(plan.setupFee) + " HT"}
          </span>
        </div>
      </div>

      <ul className="mt-4 space-y-2 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
            <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            {f}
          </li>
        ))}
        {plan.notIncluded?.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-slate-400">
            <X className="w-4 h-4 shrink-0 mt-0.5" />
            {f}
          </li>
        ))}
      </ul>

      <Link href="/contact">
        <div className={`mt-6 w-full py-2.5 rounded-xl text-sm font-semibold text-center cursor-pointer transition-all
          ${plan.popular
            ? "bg-primary text-white hover:bg-primary/90 shadow-sm"
            : "bg-slate-100 text-slate-800 hover:bg-slate-200"
          }`}>
          {plan.cta}
        </div>
      </Link>
    </div>
  );
}

// ── Simulateur ────────────────────────────────────────────────────────────────
function PricingSimulator() {
  const [selectedPlan, setSelectedPlan] = useState<Plan>(PLANS[1]);
  const [userCount, setUserCount] = useState(10);

  const min = selectedPlan.minUsers;
  const max = selectedPlan.maxUsers ?? 200;
  const safeCount = Math.max(min, Math.min(max, userCount));
  const monthlyHT = safeCount * selectedPlan.pricePerUser;
  const setupHT = selectedPlan.setupFee;
  const sousTotal1erMois = monthlyHT + setupHT;
  const tva = sousTotal1erMois * TVA;
  const ttc = sousTotal1erMois + tva;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-primary/5 to-orange-50 px-6 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-1">
          <Calculator className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-slate-900">Simulateur de coût</h3>
        </div>
        <p className="text-sm text-slate-500">Estimez votre budget en quelques secondes</p>
      </div>

      <div className="p-6 space-y-5">
        {/* Sélection plan */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Formule</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PLANS.map((p) => (
              <button
                key={p.code}
                onClick={() => {
                  setSelectedPlan(p);
                  setUserCount(Math.max(p.minUsers, Math.min(p.maxUsers ?? 200, userCount)));
                }}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-all border
                  ${selectedPlan.code === p.code
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:border-primary/50"
                  }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Nombre d'utilisateurs */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-700">Nombre d'utilisateurs</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={min}
                max={max}
                value={userCount}
                onChange={(e) => setUserCount(Math.max(min, Math.min(max, parseInt(e.target.value) || min)))}
                className="w-20 border border-slate-200 rounded-lg px-2 py-1 text-sm text-center font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <span className="text-sm text-slate-400">/ {selectedPlan.maxUsers ?? "∞"} max</span>
            </div>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            value={safeCount}
            onChange={(e) => setUserCount(parseInt(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>{min}</span>
            <span>{max === 200 ? "200+" : max}</span>
          </div>
        </div>

        {/* Résultat */}
        <div className="rounded-xl bg-slate-50 border border-slate-200 divide-y divide-slate-200 overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3">
            <div>
              <span className="text-sm text-slate-600">Abonnement mensuel HT</span>
              <span className="block text-xs text-slate-400">{safeCount} utilisateurs × {fcfa(selectedPlan.pricePerUser)}</span>
            </div>
            <span className="font-semibold text-slate-900">{fcfa(monthlyHT)}</span>
          </div>
          <div className="flex justify-between items-center px-4 py-3">
            <div>
              <span className="text-sm text-slate-600">Frais d'installation HT</span>
              <span className="block text-xs text-slate-400">Unique, à la première facturation</span>
            </div>
            <span className={`font-semibold ${setupHT === 0 ? "text-emerald-600" : "text-slate-900"}`}>
              {setupHT === 0 ? "Offert" : fcfa(setupHT)}
            </span>
          </div>
          <div className="flex justify-between items-center px-4 py-3 bg-slate-100/70">
            <span className="text-sm font-medium text-slate-700">Sous-total HT</span>
            <span className="font-bold text-slate-900">{fcfa(sousTotal1erMois)}</span>
          </div>
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-sm text-slate-500">TVA 18%</span>
            <span className="text-slate-700 font-medium">{fcfa(Math.round(tva))}</span>
          </div>
          <div className="flex justify-between items-center px-4 py-4 bg-primary/5">
            <div>
              <span className="text-sm font-bold text-slate-900">Total à payer aujourd'hui TTC</span>
              <span className="block text-xs text-slate-400">1er mois (abonnement + installation)</span>
            </div>
            <span className="text-xl font-extrabold text-primary">{fcfa(Math.round(ttc))}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 text-xs text-slate-400">
          <div className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> L'abonnement est récurrent mensellement</div>
          <div className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> Les frais d'installation sont prélevés une seule fois</div>
          <div className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> Tous les montants sont affichés HT, TVA 18% appliquée à la facturation</div>
        </div>
      </div>
    </div>
  );
}

// ── Formulaire demande app personnalisée ──────────────────────────────────────
type FormData = {
  orgName: string; contactPerson: string; email: string; phone: string;
  country: string; industry: string; description: string;
  expectedUsers: string; preferredTimeline: string; budgetRange: string;
};

const EMPTY_FORM: FormData = {
  orgName: "", contactPerson: "", email: "", phone: "", country: "",
  industry: "", description: "", expectedUsers: "", preferredTimeline: "", budgetRange: "",
};

const TIMELINES = ["Moins d'1 mois", "1 à 3 mois", "3 à 6 mois", "6 mois et plus", "Pas encore défini"];
const BUDGETS = ["< 5 000 000 FCFA", "5–15 M FCFA", "15–50 M FCFA", "> 50 M FCFA", "Budget non défini"];
const INDUSTRIES = [
  "BTP / Construction", "Mining & Ressources", "Commerce & Distribution", "Santé & Pharmacie",
  "Éducation & Formation", "Logistique & Transport", "Finance & Assurance",
  "Agriculture & Agro-industrie", "Industrie manufacturière", "Administration publique", "Autre",
];

function CustomAppModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.orgName || !form.contactPerson || !form.email) { setError("Veuillez remplir les champs obligatoires."); return; }
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}api/public/custom-app-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error("Erreur serveur");
      setSent(true);
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer ou nous contacter directement.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-xl font-bold text-slate-900">Demande d'application personnalisée</h3>
          <p className="text-sm text-slate-500 mt-1">Notre équipe vous contacte sous 48 h pour analyser votre besoin.</p>
        </div>

        {sent ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 mb-2">Demande envoyée !</h4>
            <p className="text-slate-500 text-sm mb-6">
              Nous avons bien reçu votre demande pour <strong>{form.orgName}</strong>.<br />
              L'équipe Gaméasù vous contactera à <strong>{form.email}</strong> sous 48 h ouvrables.
            </p>
            <button onClick={onClose} className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
              Fermer
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nom de l'organisation *</label>
                <input value={form.orgName} onChange={set("orgName")} required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" placeholder="Ex : SOGELEC Cameroun" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Personne de contact *</label>
                <input value={form.contactPerson} onChange={set("contactPerson")} required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" placeholder="Nom et prénom" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email *</label>
                <input type="email" value={form.email} onChange={set("email")} required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" placeholder="contact@organisation.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Téléphone</label>
                <input value={form.phone} onChange={set("phone")} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" placeholder="+228 90 00 00 00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Pays</label>
                <input value={form.country} onChange={set("country")} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" placeholder="Togo, Cameroun, Côte d'Ivoire…" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Secteur d'activité</label>
                <select value={form.industry} onChange={set("industry")} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-white">
                  <option value="">Sélectionner…</option>
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nombre d'utilisateurs estimé</label>
                <input value={form.expectedUsers} onChange={set("expectedUsers")} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" placeholder="Ex : 50–200" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Délai souhaité</label>
                <select value={form.preferredTimeline} onChange={set("preferredTimeline")} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-white">
                  <option value="">Sélectionner…</option>
                  {TIMELINES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Budget approximatif</label>
                <select value={form.budgetRange} onChange={set("budgetRange")} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-white">
                  <option value="">Sélectionner…</option>
                  {BUDGETS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Description de vos besoins</label>
                <textarea value={form.description} onChange={set("description")} rows={4} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" placeholder="Décrivez vos processus métier, vos besoins spécifiques, les fonctionnalités souhaitées…" />
              </div>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                Annuler
              </button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizontal className="w-4 h-4" />}
                Envoyer la demande
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function PricingPage() {
  const [selectedPlan, setSelectedPlan] = useState<Plan>(PLANS[1]);
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="pt-20 min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero */}
      <section className="py-16 px-4 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
          <Calculator className="w-3.5 h-3.5" />
          Tarification transparente
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mb-4 leading-tight">
          Des tarifs clairs,<br />sans mauvaise surprise
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto mb-3">
          Abonnement mensuel par utilisateur · Frais d'installation uniques · TVA 18% à la facturation
        </p>
        <p className="text-sm text-slate-400">Tous les prix sont affichés <strong>hors taxes (HT)</strong>. La TVA de 18% est appliquée uniquement lors du paiement.</p>
      </section>

      {/* Plans */}
      <section className="py-8 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.code}
              plan={plan}
              selected={selectedPlan.code === plan.code}
              onSelect={() => setSelectedPlan(plan)}
            />
          ))}
        </div>
      </section>

      {/* Simulateur */}
      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Simulateur de coût</h2>
            <p className="text-slate-500">Calculez votre budget en choisissant votre formule et le nombre d'utilisateurs.</p>
          </div>
          <PricingSimulator />
        </div>
      </section>

      {/* Tableau récap HT/TTC */}
      <section className="py-10 px-4 bg-slate-50 border-y border-slate-200">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">Récapitulatif de facturation</h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Élément</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Fréquence</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-700">Remarque</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-4 py-3 text-slate-700">Abonnement mensuel HT</td>
                  <td className="px-4 py-3 text-slate-500">Mensuel récurrent</td>
                  <td className="px-4 py-3 text-right text-slate-500">N utilisateurs × prix/user</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-700">Frais d'installation HT</td>
                  <td className="px-4 py-3 text-slate-500">
                    <span className="inline-flex items-center bg-amber-50 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full border border-amber-200">
                      Unique
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">1ère facturation uniquement</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-700">Sous-total HT</td>
                  <td className="px-4 py-3 text-slate-500">—</td>
                  <td className="px-4 py-3 text-right text-slate-500">Abonnement + installation</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-700">TVA 18%</td>
                  <td className="px-4 py-3 text-slate-500">Sur chaque facture</td>
                  <td className="px-4 py-3 text-right text-slate-500">Appliquée au paiement</td>
                </tr>
                <tr className="bg-primary/5">
                  <td className="px-4 py-3 font-bold text-slate-900">Total TTC</td>
                  <td className="px-4 py-3 text-slate-500">Montant réel prélevé</td>
                  <td className="px-4 py-3 text-right font-bold text-primary">Prix HT × 1,18</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Section application personnalisée */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-slate-900 to-slate-700 rounded-3xl p-10 text-center text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 70% 30%, #f97316 0%, transparent 60%)" }} />
            <div className="relative">
              <div className="inline-flex items-center gap-2 bg-white/10 text-white/90 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Application sur mesure
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 leading-tight">
                Vous souhaitez une application<br />personnalisée pour votre organisation ?
              </h2>
              <p className="text-white/70 text-lg mb-3 max-w-2xl mx-auto">
                L'équipe Gaméasù vous accompagne pour concevoir une solution adaptée à vos besoins, vos processus et votre secteur d'activité.
              </p>
              <p className="text-white/50 text-sm mb-8">
                Analyse des besoins · Architecture sur mesure · Développement dédié · Déploiement & maintenance
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={() => setShowModal(true)}
                  className="inline-flex items-center gap-2 px-8 py-3.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5"
                >
                  <MessageSquare className="w-4 h-4" />
                  Demander une application personnalisée
                </button>
                <Link href="/contact">
                  <div className="inline-flex items-center gap-2 px-6 py-3.5 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-all cursor-pointer">
                    <Mail className="w-4 h-4" />
                    Contacter Gaméasù
                  </div>
                </Link>
              </div>
            </div>
          </div>

          {/* Contact infos */}
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { icon: <Phone className="w-5 h-5" />, label: "Appelez-nous", value: "+228 90 00 00 00" },
              { icon: <Mail className="w-5 h-5" />, label: "Écrivez-nous", value: "contact@gameasu.africa" },
              { icon: <Globe className="w-5 h-5" />, label: "Présence", value: "Togo · Afrique de l'Ouest" },
            ].map((c) => (
              <div key={c.label} className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="p-2 bg-primary/10 text-primary rounded-lg flex-shrink-0">{c.icon}</div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">{c.label}</p>
                  <p className="text-sm font-semibold text-slate-900">{c.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ rapide */}
      <section className="py-12 px-4 bg-slate-50 border-t border-slate-200">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">Questions fréquentes</h2>
          <div className="space-y-4">
            {[
              {
                q: "Les frais d'installation sont-ils vraiment uniques ?",
                a: "Oui. Les frais d'installation sont prélevés une seule fois lors de votre premier paiement. Ils ne sont pas récurrents et ne s'appliquent pas aux renouvellements mensuels.",
              },
              {
                q: "Puis-je changer de formule après souscription ?",
                a: "Absolument. Vous pouvez évoluer vers un plan supérieur à tout moment. Le changement prend effet au début du mois suivant et les frais d'installation ne sont pas refacturés.",
              },
              {
                q: "Quand la TVA est-elle appliquée ?",
                a: "La TVA de 18% est appliquée uniquement lors de la facturation et du paiement. Tous les prix affichés sur ce site sont hors taxes (HT).",
              },
              {
                q: "Comment fonctionne le plan Enterprise ?",
                a: "Le plan Enterprise est sur mesure. Contactez notre équipe commerciale pour une offre adaptée à votre volume, vos contraintes réglementaires et vos exigences d'intégration.",
              },
            ].map((faq) => (
              <div key={faq.q} className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-2 text-sm">{faq.q}</h3>
                <p className="text-sm text-slate-500">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-16 px-4 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Prêt à démarrer ?</h2>
          <p className="text-slate-500 mb-6">Souscrivez en ligne ou contactez nos équipes pour un accompagnement personnalisé.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/contact">
              <div className="inline-flex items-center gap-2 px-7 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors cursor-pointer shadow-sm">
                Démarrer maintenant <ChevronRight className="w-4 h-4" />
              </div>
            </Link>
            <Link href="/solutions">
              <div className="inline-flex items-center gap-2 px-7 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors cursor-pointer">
                Voir les fonctionnalités
              </div>
            </Link>
          </div>
        </div>
      </section>

      {showModal && <CustomAppModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
