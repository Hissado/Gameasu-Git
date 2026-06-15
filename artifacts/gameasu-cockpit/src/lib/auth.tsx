import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type CockpitUser = {
  id: string;
  email: string;
  name: string | null;
  firstName?: string;
  lastName?: string;
  role: string;
};

type AuthCtx = {
  user: CockpitUser | null;
  token: string | null;
  /** Stocke directement un token + user déjà vérifiés côté login page. */
  login: (token: string, user: CockpitUser) => void;
  logout: () => void;
  isLoading: boolean;
};

const AuthContext = createContext<AuthCtx | null>(null);

const TOKEN_KEY = "cockpit_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CockpitUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(true);

  // Rehydrate la session au montage (page refresh)
  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (!r.ok) throw new Error("unauthorized");
        return r.json();
      })
      .then((data: any) => {
        if (data.role !== "super_admin") throw new Error("forbidden");
        setUser({ id: data.id, email: data.email, name: `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim(), firstName: data.firstName, lastName: data.lastName, role: data.role });
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  const login = (newToken: string, cockpitUser: CockpitUser) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(cockpitUser);
  };

  const logout = () => {
    // Invalider la session côté serveur
    if (token) {
      fetch("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
