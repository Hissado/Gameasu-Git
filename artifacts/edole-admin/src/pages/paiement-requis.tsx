/**
 * Page de blocage — Paiement requis
 * Affichée aux comptes dont l'abonnement est en statut "pending_payment".
 * ProtectedRoute y redirige automatiquement via /paiement-requis.
 */
import React from "react";
import { useLocation } from "wouter";
import { BRANDING } from "@/config/branding";
import { useCurrentSubscription } from "@/lib/saas";
import { formatFCFA } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { CreditCard, LogOut, Loader2, ShieldAlert } from "lucide-react";

const PERIOD_LABELS: Record<string, string> = {
  monthly: "mensuel", quarterly: "trimestriel",
  semiannual: "semestriel", annual: "annuel",
};

export default function PaiementRequisPage() {
  const [, setLocation] = useLocation();
  const { logout } = useAuth();
  const { data: sub, isLoading } = useCurrentSubscription();

  const year = new Date().getFullYear();

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-between px-4 py-10"
      style={{ background: "#F3F4F6", fontFamily: "var(--app-font-display, system-ui)" }}
    >
      <div /> {/* spacer top */}

      <div className="w-full max-w-[480px]">
        <div className="text-center mb-8">
          <img
            src={BRANDING.logoFullTransparent}
            alt={BRANDING.appName}
            draggable={false}
            className="select-none mx-auto"
            style={{ height: "48px", width: "auto" }}
          />
        </div>

        <div
          className="rounded-2xl bg-white px-10 py-10"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.08), 0 4px 24px rgba(0,0,0,0.06)", border: "1px solid #E5E7EB" }}
        >
          {/* Icône */}
          <div className="flex justify-center mb-5">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: "#FFF7ED", border: "2px solid #FDBA74" }}
            >
              <ShieldAlert className="w-7 h-7 text-orange-500" />
            </div>
          </div>

          {/* Titre */}
          <h1 className="text-[20px] font-bold text-center text-[#0E1A39] mb-2">
            Paiement requis pour activer votre espace
          </h1>
          <p className="text-[13px] text-center text-gray-500 mb-7 leading-relaxed">
            Votre organisation a été créée avec succès. Pour accéder à vos modules, finalisez le paiement de votre abonnement.
          </p>

          {/* Récapitulatif abonnement */}
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : sub ? (
            <div
              className="rounded-xl px-5 py-4 mb-6"
              style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
            >
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Votre abonnement</p>
              <div className="space-y-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">Formule</span>
                  <span className="font-semibold text-[#0E1A39]">{(sub as any).planName ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Utilisateurs</span>
                  <span className="font-semibold text-[#0E1A39]">{(sub as any).seats ?? 1} siège{((sub as any).seats ?? 1) > 1 ? "s" : ""}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Facturation</span>
                  <span className="font-semibold text-[#0E1A39] capitalize">{PERIOD_LABELS[(sub as any).billingCycle ?? "monthly"] ?? (sub as any).billingCycle}</span>
                </div>
                <div
                  className="flex justify-between pt-2 mt-2 border-t border-gray-200"
                >
                  <span className="font-semibold text-[#0E1A39]">Montant à régler</span>
                  <span className="text-[16px] font-extrabold" style={{ color: "#F37021" }}>
                    {formatFCFA(((sub as any).unitPrice ?? 0) * ((sub as any).seats ?? 1))} TTC
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {/* CTA principal */}
          <button
            onClick={() => setLocation("/abonnement?openPay=1")}
            className="w-full h-11 rounded-lg text-[14px] font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.985] mb-3"
            style={{ background: "#2563EB" }}
          >
            <CreditCard className="w-4 h-4" />
            Finaliser mon paiement
          </button>

          <p className="text-[11.5px] text-center text-gray-400 mb-5 leading-relaxed">
            Paiements acceptés&nbsp;: carte bancaire, Mobile Money, virement, dépôt en agence.
          </p>

          {/* Lien déconnexion */}
          <div className="border-t border-gray-100 pt-4 text-center">
            <button
              type="button"
              onClick={() => { logout(); setLocation("/login"); }}
              className="text-[12px] text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1 mx-auto"
            >
              <LogOut className="w-3.5 h-3.5" />
              Se déconnecter
            </button>
          </div>
        </div>
      </div>

      <p className="text-center text-[11px] pb-2 text-gray-400 mt-8">
        © {year} {BRANDING.legalName} · Support&nbsp;: support@gameasu.com
      </p>
    </div>
  );
}
