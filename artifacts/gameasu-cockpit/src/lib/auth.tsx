import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";

export type CockpitUser = {
  id: string;
  email: string;
  name: string | null;
  firstName?: string;
  lastName?: string;
  role: string;
};

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;  // 30 minutes
const INACTIVITY_WARNING_MS =  2 * 60 * 1000;  // avertissement 2 min avant expiration
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"] as const;
const TOKEN_KEY = "cockpit_token";

type AuthCtx = {
  user: CockpitUser | null;
  token: string | null;
  login: (token: string, user: CockpitUser) => void;
  logout: () => void;
  isLoading: boolean;
  showInactivityWarning: boolean;
  extendSession: () => void;
};

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CockpitUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(true);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const warnTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rehydrate la session au montage
  useEffect(() => {
    if (!token) { setIsLoading(false); return; }
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error("unauthorized"); return r.json(); })
      .then((data: any) => {
        if (data.role !== "super_admin") throw new Error("forbidden");
        setUser({ id: data.id, email: data.email, name: `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim(), firstName: data.firstName, lastName: data.lastName, role: data.role });
      })
      .catch(() => { localStorage.removeItem(TOKEN_KEY); setToken(null); setUser(null); })
      .finally(() => setIsLoading(false));
  }, [token]);

  const clearTimers = useCallback(() => {
    if (warnTimerRef.current)   { clearTimeout(warnTimerRef.current);   warnTimerRef.current   = null; }
    if (expireTimerRef.current) { clearTimeout(expireTimerRef.current); expireTimerRef.current = null; }
  }, []);

  const logout = useCallback(() => {
    clearTimers();
    setShowInactivityWarning(false);
    if (token) {
      fetch("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, [token, clearTimers]);

  const startTimers = useCallback(() => {
    clearTimers();
    setShowInactivityWarning(false);
    warnTimerRef.current = setTimeout(
      () => setShowInactivityWarning(true),
      INACTIVITY_TIMEOUT_MS - INACTIVITY_WARNING_MS,
    );
    expireTimerRef.current = setTimeout(() => {
      clearTimers();
      setShowInactivityWarning(false);
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    }, INACTIVITY_TIMEOUT_MS);
  }, [clearTimers]);

  const extendSession = useCallback(() => {
    startTimers();
  }, [startTimers]);

  const login = (newToken: string, cockpitUser: CockpitUser) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(cockpitUser);
  };

  // Timer d'inactivité
  useEffect(() => {
    if (!token) { clearTimers(); setShowInactivityWarning(false); return; }
    startTimers();
    const opts: AddEventListenerOptions = { passive: true };
    ACTIVITY_EVENTS.forEach(ev => window.addEventListener(ev, startTimers, opts));
    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, startTimers, opts));
    };
  }, [token, startTimers, clearTimers]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading, showInactivityWarning, extendSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
