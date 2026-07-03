import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
const INACTIVITY_FLAG_KEY = "gameasu_session_expired";
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"] as const;

export interface OrgEntry {
  id: string;
  name: string;
  legalName: string | null;
  logoUrl: string | null;
  slug: string;
  role: string;
  isPrimary: boolean;
}

interface AuthUser {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  avatarUrl?: string;
  phone?: string | null;
  organizationId?: string;
  organizationName?: string;
  organizationLegalName?: string;
  organizationLogoUrl?: string;
  orgs?: OrgEntry[];
}

interface AuthContextType {
  token: string | null;
  user: AuthUser | undefined;
  login: (token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  switchOrg: (orgId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("auth_token"));
  const [_, setLocation] = useLocation();
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  const { data: user } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      queryKey: ["auth-me"] as const,
    },
  });

  const login = useCallback((newToken: string) => {
    localStorage.removeItem(INACTIVITY_FLAG_KEY);
    localStorage.setItem("auth_token", newToken);
    setToken(newToken);
  }, []);

  const logout = useCallback((reason?: "inactivity") => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
      inactivityTimer.current = null;
    }
    const t = localStorage.getItem("auth_token");
    if (t) {
      fetch("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${t}` } }).catch(() => {});
    }
    if (reason === "inactivity") {
      localStorage.setItem(INACTIVITY_FLAG_KEY, "1");
    }
    localStorage.removeItem("auth_token");
    setToken(null);
    setLocation("/login");
  }, [setLocation]);

  const switchOrg = useCallback(async (orgId: string) => {
    const t = localStorage.getItem("auth_token");
    if (!t) throw new Error("Non authentifié");
    const res = await fetch("/api/auth/switch-org", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ orgId }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({})) as any;
      throw new Error(j.error ?? "Erreur lors du changement d'organisation");
    }
    // Invalider toutes les données — elles sont toutes liées à l'org active
    await queryClient.invalidateQueries();
  }, [queryClient]);

  // Déconnexion automatique si l'API renvoie 401.
  useEffect(() => {
    const handler = () => {
      if (localStorage.getItem("auth_token")) logout();
    };
    window.addEventListener("auth:unauthorized", handler);
    return () => window.removeEventListener("auth:unauthorized", handler);
  }, [logout]);

  // ── Timer d'inactivité ────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;

    const resetTimer = () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(() => {
        logout("inactivity");
      }, INACTIVITY_TIMEOUT_MS);
    };

    resetTimer();

    const opts: AddEventListenerOptions = { passive: true };
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, resetTimer, opts));

    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, resetTimer, opts));
    };
  }, [token, logout]);

  return (
    <AuthContext.Provider value={{ token, user: user as AuthUser | undefined, login, logout, isAuthenticated: !!token, switchOrg }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

/** Retourne et efface le flag de déconnexion par inactivité (à lire sur la page de login). */
export function consumeInactivityFlag(): boolean {
  const val = localStorage.getItem(INACTIVITY_FLAG_KEY);
  if (val) { localStorage.removeItem(INACTIVITY_FLAG_KEY); return true; }
  return false;
}
