import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";

interface AuthUser {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  avatarUrl?: string;
}

interface AuthContextType {
  token: string | null;
  user: AuthUser | undefined;
  login: (token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("auth_token"));
  const [_, setLocation] = useLocation();

  // Garde la session "vivante" 5 minutes — évite un refetch /auth/me à chaque navigation.
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
    localStorage.setItem("auth_token", newToken);
    setToken(newToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    setToken(null);
    setLocation("/login");
  }, [setLocation]);

  // Déconnexion automatique si l'API renvoie 401.
  useEffect(() => {
    const handler = () => {
      if (localStorage.getItem("auth_token")) logout();
    };
    window.addEventListener("auth:unauthorized", handler);
    return () => window.removeEventListener("auth:unauthorized", handler);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ token, user: user as AuthUser | undefined, login, logout, isAuthenticated: !!token }}>
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
