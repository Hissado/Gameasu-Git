import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cancelApiRequests } from "@/lib/api";

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;  // 30 minutes
const INACTIVITY_WARNING_MS =  2 * 60 * 1000;  // avertissement 2 min avant expiration
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
  name?: string;
  email?: string;
  role?: string;
  avatarUrl?: string;
  phone?: string | null;
  organizationId?: string;
  organizationName?: string;
  organizationLegalName?: string;
  organizationLogoUrl?: string;
  orgs?: OrgEntry[];
  subscriptionStatus?: string | null;
}

interface AuthContextType {
  token: string | null;
  user: AuthUser | undefined;
  login: (token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  switchOrg: (orgId: string) => Promise<void>;
  showInactivityWarning: boolean;
  extendSession: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("auth_token"));
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [_, setLocation] = useLocation();
  const warnTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  const { data: user } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchInterval: (query: any) =>
        query.state.data?.subscriptionStatus === "pending_payment" ? 5000 : false,
      queryKey: ["auth-me"] as const,
    },
  });

  const clearTimers = useCallback(() => {
    if (warnTimerRef.current)   { clearTimeout(warnTimerRef.current);   warnTimerRef.current   = null; }
    if (expireTimerRef.current) { clearTimeout(expireTimerRef.current); expireTimerRef.current = null; }
  }, []);

  const logout = useCallback((reason?: "inactivity") => {
    clearTimers();
    setShowInactivityWarning(false);
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
  }, [setLocation, clearTimers]);

  const startTimers = useCallback(() => {
    clearTimers();
    setShowInactivityWarning(false);
    warnTimerRef.current = setTimeout(
      () => setShowInactivityWarning(true),
      INACTIVITY_TIMEOUT_MS - INACTIVITY_WARNING_MS,
    );
    expireTimerRef.current = setTimeout(
      () => logout("inactivity"),
      INACTIVITY_TIMEOUT_MS,
    );
  }, [clearTimers, logout]);

  const extendSession = useCallback(() => {
    startTimers();
  }, [startTimers]);

  const login = useCallback((newToken: string) => {
    localStorage.removeItem(INACTIVITY_FLAG_KEY);
    localStorage.setItem("auth_token", newToken);
    setToken(newToken);
  }, []);

  const switchOrg = useCallback(async (orgId: string) => {
    const t = localStorage.getItem("auth_token");
    if (!t) throw new Error("Non authentifié");
    cancelApiRequests("Changement d’organisation");
    await queryClient.cancelQueries();
    queryClient.clear();
    const res = await fetch("/api/auth/switch-org", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ orgId }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({})) as any;
      throw new Error(j.error ?? "Erreur lors du changement d'organisation");
    }
    await queryClient.invalidateQueries({ queryKey: ["auth-me"] });
  }, [queryClient]);

  // Déconnexion automatique si l'API renvoie 401
  useEffect(() => {
    const handler = () => {
      if (localStorage.getItem("auth_token")) logout();
    };
    window.addEventListener("auth:unauthorized", handler);
    return () => window.removeEventListener("auth:unauthorized", handler);
  }, [logout]);

  // Timer d'inactivité : avertissement à 28 min, déconnexion à 30 min
  useEffect(() => {
    if (!token) {
      clearTimers();
      setShowInactivityWarning(false);
      return;
    }
    startTimers();
    const opts: AddEventListenerOptions = { passive: true };
    ACTIVITY_EVENTS.forEach(ev => window.addEventListener(ev, startTimers, opts));
    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, startTimers, opts));
    };
  }, [token, startTimers, clearTimers]);

  return (
    <AuthContext.Provider value={{
      token,
      user: user as AuthUser | undefined,
      login,
      logout,
      isAuthenticated: !!token,
      switchOrg,
      showInactivityWarning,
      extendSession,
    }}>
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
