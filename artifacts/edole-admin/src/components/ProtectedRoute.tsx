import React, { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user } = useAuth();
  const [location, setLocation] = useLocation();

  // Redirige vers /login si non connecté.
  useEffect(() => {
    if (!isAuthenticated) setLocation("/login");
  }, [isAuthenticated, setLocation]);

  // Force le changement de mot de passe à la première connexion.
  const mustChange = (user as any)?.mustChangePassword === true;
  useEffect(() => {
    if (isAuthenticated && mustChange && location !== "/change-password") {
      setLocation("/change-password");
    }
  }, [isAuthenticated, mustChange, location, setLocation]);

  // Écoute le 423 émis par l'API pour rediriger même si /auth/me n'a pas
  // encore retourné le flag (cas d'un onglet ouvert au moment du reset).
  useEffect(() => {
    const handler = () => setLocation("/change-password");
    window.addEventListener("auth:password-change-required", handler);
    return () => window.removeEventListener("auth:password-change-required", handler);
  }, [setLocation]);

  if (!isAuthenticated) return null;
  return <>{children}</>;
};
