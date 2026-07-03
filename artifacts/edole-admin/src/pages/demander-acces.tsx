import { useState } from "react";
import { useLocation } from "wouter";
import { BRANDING } from "@/config/branding";
import { CheckCircle2, Loader2, ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";

const ORG_SIZES = [
  "1 à 5 personnes",
  "6 à 20 personnes",
  "21 à 50 personnes",
  "51 à 100 personnes",
  "Plus de 100 personnes",
];

const MODULES = [
  "Finance",
  "Comptabilité",
  "Ventes & CRM",
  "Achats",
  "Stock",
  "Ressources Humaines",
  "Paie",
  "Présences & Kiosk",
  "Projets & Opérations",
  "Rapports",
  "Tous les modules",
  "Besoin personnalisé",
];

const SECTORS = [
  "BTP / Construction",
  "Commerce & Distribution",
  "Services professionnels",
  "Santé & Pharmacie",
  "Éducation & Formation",
  "Industrie & Manufacture",
  "Agriculture & Agro-alimentaire",
  "Transport & Logistique",
  "Hôtellerie & Restauration",
  "Technologies & Numérique",
  "ONG / Association",
  "Administration publique",
  "Autre",
];

const COUNTRIES = [
  "Togo", "Bénin", "Côte d'Ivoire", "Sénégal", "Cameroun", "Ghana", "Nigeria",
  "Burkina Faso", "Mali", "Niger", "Guinée", "RDC", "Congo", "Gabon", "Autre",
];

type FormData = {
  contactName: string;
  contactFunction: string;
  contactEmail: string;
  contactPhone: string;
  contactPreference: "email" | "phone" | "whatsapp";
  orgName: string;
  orgSector: string;
  orgDomain: string;
  orgSize: string;
  estimatedUsers: string;
  country: string;
  city: string;
  desiredModules: string[];
  mainNeed: string;
  message: string;
  consentGiven: boolean;
};

const INITIAL: FormData = {
  contactName: "", contactFunction: "", contactEmail: "", contactPhone: "",
  contactPreference: "email", orgName: "", orgSector: "", orgDomain: "",
  orgSize: "", estimatedUsers: "", country: "Togo", city: "",
  desiredModules: [], mainNeed: "", message: "", consentGiven: false,
};

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <label className="block text-[13px] font-medium text-gray-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}

const inputCls = "w-full h-10 px-3 rounded-lg text-[13.5px] outline-none border border-gray-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-100 transition-colors text-gray-800 placeholder-gray-400";
const selectCls = `${inputCls} bg-white cursor-pointer`;

export default function DemanderAccesPage() {
  const [, setLocation] = useLocation();
  const [form, setForm] = useState<FormData>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleModule = (m: string) =>
    setForm((f) => ({
      ...f,
      desiredModules: f.desiredModules.includes(m)
        ? f.desiredModules.filter((x) => x !== m)
        : [...f.desiredModules, m],
    }));

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (!form.contactName.trim()) errs.contactName = "Obligatoire";
    if (!form.contactEmail.trim()) errs.contactEmail = "Obligatoire";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) errs.contactEmail = "Email invalide";
    if (!form.orgName.trim()) errs.orgName = "Obligatoire";
    if (!form.orgSize) errs.orgSize = "Obligatoire";
    if (!form.consentGiven) errs.consentGiven = "Votre consentement est requis";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError("");
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as any;
        if (res.status === 429) {
          setGlobalError(json.error ?? "Trop de soumissions. Veuillez réessayer plus tard.");
        } else {
          setGlobalError(json.error ?? "Une erreur est survenue. Veuillez réessayer.");
        }
        return;
      }
      setSuccess(true);
    } catch {
      setGlobalError("Impossible de contacter le serveur. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  };

  const year = new Date().getFullYear();

  if (success) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-between px-4 py-10"
        style={{ background: "#F3F4F6" }}>
        <div />
        <div className="w-full max-w-md text-center">
          <div className="rounded-2xl bg-white px-10 py-12" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.08), 0 4px 24px rgba(0,0,0,0.06)", border: "1px solid #E5E7EB" }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-[22px] font-bold text-[#0E1A39] mb-3">Demande envoyée !</h1>
            <p className="text-[14px] text-gray-500 leading-relaxed mb-6">
              Votre demande a bien été envoyée. L'équipe Gameasu vous contactera dans les plus brefs délais.
              <br /><br />
              Un email de confirmation vous a été envoyé à <strong className="text-gray-700">{form.contactEmail}</strong>.
            </p>
            <button onClick={() => setLocation("/login")}
              className="w-full h-11 rounded-lg text-[14px] font-semibold text-white flex items-center justify-center gap-2 transition-all"
              style={{ background: "#2563EB" }}>
              Retour à la connexion
            </button>
          </div>
        </div>
        <p className="text-center text-[11px] pb-2 text-gray-400">
          © {year} {BRANDING.legalName} · Connexion chiffrée TLS 1.3
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-start justify-start px-4 py-8"
      style={{ background: "#F3F4F6", fontFamily: "var(--app-font-display, system-ui)" }}>

      <div className="w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button onClick={() => setLocation("/login")}
            className="flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-blue-600 transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" /> Retour à la connexion
          </button>
          <div className="flex items-center gap-3 mb-2">
            <img src={BRANDING.logoFullTransparent} alt={BRANDING.appName}
              draggable={false} className="select-none" style={{ height: "40px", width: "auto" }} />
          </div>
          <h1 className="text-[24px] font-bold text-[#0E1A39]">Demander un accès</h1>
          <p className="text-[14px] text-gray-500 mt-1">
            Vous n'êtes pas encore client Gameasu ? Remplissez ce formulaire — notre équipe vous contacte rapidement.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* Section 1 : Informations de contact */}
          <div className="rounded-2xl bg-white px-8 py-7 mb-4" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #E5E7EB" }}>
            <h2 className="text-[15px] font-semibold text-[#0E1A39] mb-5 pb-3 border-b border-gray-100">
              Informations de contact
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nom complet" required>
                <input type="text" className={inputCls} placeholder="Jean Dupont"
                  value={form.contactName} onChange={(e) => set("contactName", e.target.value)} />
                {errors.contactName && <p className="text-[11px] text-red-500 mt-0.5">{errors.contactName}</p>}
              </Field>
              <Field label="Fonction / Poste">
                <input type="text" className={inputCls} placeholder="Directeur général"
                  value={form.contactFunction} onChange={(e) => set("contactFunction", e.target.value)} />
              </Field>
              <Field label="Email professionnel" required>
                <input type="email" className={inputCls} placeholder="nom@entreprise.com"
                  value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
                {errors.contactEmail && <p className="text-[11px] text-red-500 mt-0.5">{errors.contactEmail}</p>}
              </Field>
              <Field label="Téléphone">
                <input type="tel" className={inputCls} placeholder="+228 90 00 00 00"
                  value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Préférence de contact">
                  <div className="flex gap-3 mt-1">
                    {(["email", "phone", "whatsapp"] as const).map((p) => (
                      <label key={p} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="contactPreference" value={p}
                          checked={form.contactPreference === p}
                          onChange={() => set("contactPreference", p)}
                          className="accent-blue-600" />
                        <span className="text-[13px] text-gray-700 capitalize">
                          {p === "email" ? "Email" : p === "phone" ? "Téléphone" : "WhatsApp"}
                        </span>
                      </label>
                    ))}
                  </div>
                </Field>
              </div>
            </div>
          </div>

          {/* Section 2 : Informations sur l'organisation */}
          <div className="rounded-2xl bg-white px-8 py-7 mb-4" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #E5E7EB" }}>
            <h2 className="text-[15px] font-semibold text-[#0E1A39] mb-5 pb-3 border-b border-gray-100">
              Votre organisation
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Field label="Nom de l'entreprise ou organisation" required>
                  <input type="text" className={inputCls} placeholder="ACME Sarl"
                    value={form.orgName} onChange={(e) => set("orgName", e.target.value)} />
                  {errors.orgName && <p className="text-[11px] text-red-500 mt-0.5">{errors.orgName}</p>}
                </Field>
              </div>
              <Field label="Secteur d'activité">
                <select className={selectCls} value={form.orgSector} onChange={(e) => set("orgSector", e.target.value)}>
                  <option value="">Sélectionnez…</option>
                  {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Domaine / Type d'activité" hint="Précisez votre activité principale">
                <input type="text" className={inputCls} placeholder="Ex : location de matériel BTP"
                  value={form.orgDomain} onChange={(e) => set("orgDomain", e.target.value)} />
              </Field>
              <Field label="Taille de l'organisation" required>
                <select className={selectCls} value={form.orgSize} onChange={(e) => set("orgSize", e.target.value)}>
                  <option value="">Sélectionnez…</option>
                  {ORG_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {errors.orgSize && <p className="text-[11px] text-red-500 mt-0.5">{errors.orgSize}</p>}
              </Field>
              <Field label="Nombre estimé d'utilisateurs">
                <input type="text" className={inputCls} placeholder="Ex : 15"
                  value={form.estimatedUsers} onChange={(e) => set("estimatedUsers", e.target.value)} />
              </Field>
              <Field label="Pays">
                <select className={selectCls} value={form.country} onChange={(e) => set("country", e.target.value)}>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Ville">
                <input type="text" className={inputCls} placeholder="Lomé"
                  value={form.city} onChange={(e) => set("city", e.target.value)} />
              </Field>
            </div>
          </div>

          {/* Section 3 : Modules et besoin */}
          <div className="rounded-2xl bg-white px-8 py-7 mb-4" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #E5E7EB" }}>
            <h2 className="text-[15px] font-semibold text-[#0E1A39] mb-5 pb-3 border-b border-gray-100">
              Modules souhaités &amp; besoin
            </h2>
            <Field label="Modules qui vous intéressent" hint="Sélectionnez tout ce qui correspond à votre besoin">
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {MODULES.map((m) => {
                  const checked = form.desiredModules.includes(m);
                  return (
                    <label key={m}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-[12.5px] ${
                        checked ? "border-blue-500 bg-blue-50 text-blue-700 font-medium" : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300"
                      }`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleModule(m)} className="sr-only" />
                      <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${checked ? "bg-blue-600 border-blue-600" : "border-gray-300"}`}>
                        {checked && <svg viewBox="0 0 10 8" className="w-2.5 h-2.5" fill="none"><path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </span>
                      {m}
                    </label>
                  );
                })}
              </div>
            </Field>

            <div className="mt-4 space-y-4">
              <Field label="Besoin principal">
                <input type="text" className={inputCls} placeholder="Ex : gérer mes chantiers et équipements"
                  value={form.mainNeed} onChange={(e) => set("mainNeed", e.target.value)} />
              </Field>

              {/* Bloc avancé masquable */}
              <button type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-blue-600 transition-colors">
                {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {showAdvanced ? "Masquer les champs optionnels" : "Ajouter un message ou commentaire (optionnel)"}
              </button>

              {showAdvanced && (
                <Field label="Message ou commentaire">
                  <textarea className={`${inputCls} h-24 py-2.5 resize-none`}
                    placeholder="Décrivez vos besoins spécifiques, vos contraintes ou vos attentes…"
                    value={form.message} onChange={(e) => set("message", e.target.value)} />
                </Field>
              )}
            </div>
          </div>

          {/* Section 4 : Consentement & envoi */}
          <div className="rounded-2xl bg-white px-8 py-7 mb-6" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #E5E7EB" }}>
            <label className={`flex items-start gap-3 cursor-pointer p-3 rounded-lg border transition-colors ${errors.consentGiven ? "border-red-300 bg-red-50" : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/30"}`}>
              <input type="checkbox" checked={form.consentGiven} onChange={(e) => set("consentGiven", e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-blue-600 cursor-pointer flex-shrink-0" />
              <span className="text-[13px] text-gray-600 leading-relaxed">
                J'accepte d'être contacté(e) par l'équipe Gameasu pour faire suite à cette demande d'accès.
                Les informations saisies seront utilisées uniquement dans le cadre de cet accompagnement.
                <span className="text-red-500 ml-0.5">*</span>
              </span>
            </label>
            {errors.consentGiven && <p className="text-[11px] text-red-500 mt-1.5 ml-1">{errors.consentGiven}</p>}

            {globalError && (
              <div className="mt-4 px-4 py-3 rounded-lg text-[13px] text-red-700 bg-red-50 border border-red-200">
                {globalError}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="mt-5 w-full h-12 rounded-lg text-[15px] font-semibold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.985] disabled:opacity-60"
              style={{ background: "#2563EB" }}>
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />Envoi en cours…</>
                : "Envoyer ma demande d'accès"}
            </button>
          </div>
        </form>

        <p className="text-center text-[11px] pb-4 text-gray-400">
          © {year} {BRANDING.legalName} · Connexion chiffrée TLS 1.3
        </p>
      </div>
    </div>
  );
}
