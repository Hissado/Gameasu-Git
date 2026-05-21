import { ReactNode } from "react";
import { useLocation } from "wouter";
import { moduleKeyForPath } from "@/lib/saas";
import { useModuleEnabled, UpgradeRequired } from "@/components/FeatureGate";

/**
 * Gate appliqué AU NIVEAU DU ROUTAGE : si le chemin courant correspond à un
 * module désactivé sur l'organisation courante, on rend l'écran d'upsell à la
 * place du contenu — empêchant tout accès direct via URL (la navigation latérale
 * affiche aussi un cadenas, cf. Layout.tsx).
 *
 * Les routes hors `ROUTE_MODULE_MAP` (login, /billing, /workspace-settings,
 * /upgrade-required, /change-password, /admin/*) passent sans contrainte.
 */
export function RouteModuleGate({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const moduleKey = moduleKeyForPath(location);
  const { enabled, loading } = useModuleEnabled(moduleKey);

  if (!moduleKey) return <>{children}</>;
  if (loading) return <>{children}</>;
  if (!enabled) return <UpgradeRequired moduleKey={moduleKey} />;
  return <>{children}</>;
}
