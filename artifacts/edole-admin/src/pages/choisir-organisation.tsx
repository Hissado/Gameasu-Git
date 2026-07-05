import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { BRANDING } from "@/config/branding";
import { Building2, CheckCircle2, Loader2, ArrowRight, LogOut } from "lucide-react";

interface OrgEntry {
  id: string;
  name: string;
  legalName: string | null;
  logoUrl: string | null;
  slug: string;
  role: string;
  isPrimary: boolean;
}

const PENDING_ORGS_KEY = "gameasu_pending_orgs";
const PENDING_TOKEN_KEY = "gameasu_pending_token";

function roleLabel(role: string) {
  const MAP: Record<string, string> = {
    owner: "Propriétaire",
    admin: "Administrateur",
    manager: "Gestionnaire",
    member: "Membre",
  };
  return MAP[role] ?? role;
}

export default function ChoisirOrganisationPage() {
  const { login, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [orgs, setOrgs] = useState<OrgEntry[]>([]);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(PENDING_ORGS_KEY);
    const token = localStorage.getItem(PENDING_TOKEN_KEY);
    if (!raw || !token) {
      setLocation("/login");
      return;
    }
    try {
      setOrgs(JSON.parse(raw));
      setPendingToken(token);
    } catch {
      setLocation("/login");
    }
  }, []);

  const handleSelect = async (orgId: string) => {
    if (!pendingToken || selecting) return;
    setSelecting(orgId);
    try {
      const res = await fetch("/api/auth/switch-org", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${pendingToken}`,
        },
        body: JSON.stringify({ orgId }),
      });
      if (!res.ok) {
        const j = await res.json() as any;
        alert(j.error ?? "Erreur lors de la sélection de l'organisation.");
        setSelecting(null);
        return;
      }
      localStorage.removeItem(PENDING_ORGS_KEY);
      localStorage.removeItem(PENDING_TOKEN_KEY);
      login(pendingToken);
      setLocation("/");
    } catch {
      alert("Erreur réseau. Réessayez.");
      setSelecting(null);
    }
  };

  const handleCancel = () => {
    localStorage.removeItem(PENDING_ORGS_KEY);
    localStorage.removeItem(PENDING_TOKEN_KEY);
    logout();
  };

  if (orgs.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-between px-4 py-10"
      style={{ background: "#F3F4F6", fontFamily: "var(--app-font-display, system-ui)" }}>
      <div />
      <div className="w-full max-w-[460px]">
        <div className="rounded-2xl bg-white px-8 py-10"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.08), 0 4px 24px rgba(0,0,0,0.06)", border: "1px solid #E5E7EB" }}>

          <div className="text-center mb-8">
            <img src={BRANDING.logoFullTransparent} alt={BRANDING.appName} draggable={false}
              className="select-none mx-auto mb-5"
              style={{ height: "52px", width: "auto" }} />
            <h1 className="text-[19px] font-bold text-[#0E1A39] mb-1.5">
              Choisir un espace de travail
            </h1>
            <p className="text-[13px] text-gray-500">
              Votre compte est associé à {orgs.length} organisations. Sélectionnez celle dans laquelle vous souhaitez travailler.
            </p>
          </div>

          <div className="space-y-2.5">
            {orgs.map((org) => {
              const isSelecting = selecting === org.id;
              return (
                <button
                  key={org.id}
                  onClick={() => handleSelect(org.id)}
                  disabled={!!selecting}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all text-left group disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#0F1A3A] flex items-center justify-center shrink-0 overflow-hidden">
                    {org.logoUrl ? (
                      <img src={org.logoUrl} alt={org.name} className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-5 h-5 text-blue-400" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-[#0E1A39] truncate leading-snug">
                      {org.name}
                    </p>
                    {org.legalName && org.legalName !== org.name && (
                      <p className="text-[11.5px] text-gray-400 truncate">{org.legalName}</p>
                    )}
                    <span className="inline-block mt-0.5 text-[10.5px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">
                      {roleLabel(org.role)}
                    </span>
                  </div>

                  <div className="shrink-0">
                    {isSelecting ? (
                      <Loader2 className="w-4.5 h-4.5 animate-spin text-blue-600" />
                    ) : (
                      <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100 flex justify-center">
            <button
              onClick={handleCancel}
              className="flex items-center gap-1.5 text-[12.5px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Se déconnecter
            </button>
          </div>
        </div>

        <p className="text-center text-[11.5px] text-gray-400 mt-8">
          &copy; {new Date().getFullYear()} {BRANDING.appName} — Tous droits réservés
        </p>
      </div>
    </div>
  );
}
