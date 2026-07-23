import { useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Compass, RotateCcw, ArrowLeft, LayoutDashboard } from "lucide-react";

/**
 * Page d'erreur / route introuvable — en français, avec actions de sortie
 * (audit P2 §F #13). Affiche une référence d'erreur courte réutilisable au
 * support, et journalise le détail technique en console (pas à l'écran).
 */
export default function NotFound() {
  const [location, navigate] = useLocation();

  // Référence d'erreur courte, stable pour cet affichage (base36 du temps).
  const errorRef = useMemo(() => `ERR-${Date.now().toString(36).toUpperCase()}`, []);

  // Détail technique en console uniquement — jamais exposé à l'utilisateur.
  if (typeof console !== "undefined") {
    console.warn(`[404] Route introuvable : ${location} (${errorRef})`);
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-6 text-center space-y-5">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Compass className="h-7 w-7 text-primary" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold">Page introuvable</h1>
            <p className="text-sm text-muted-foreground">
              La page que vous cherchez n'existe pas ou a été déplacée. Vérifiez
              l'adresse ou revenez à une page connue.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RotateCcw className="w-4 h-4 mr-1.5" /> Réessayer
            </Button>
            <Button variant="outline" onClick={() => window.history.back()}>
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Retour
            </Button>
            <Button onClick={() => navigate("/")}>
              <LayoutDashboard className="w-4 h-4 mr-1.5" /> Tableau de bord
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground pt-1">
            Référence : <span className="font-mono">{errorRef}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
