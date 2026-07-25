import React from "react";
import { useLocation } from "wouter";
import { HrShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Construction } from "lucide-react";
import { rhRouteEntries, RH_MODULE } from "@/config/rh-navigation";

/**
 * Gabarit générique des nœuds RH « planned » (§7) : jamais de page blanche ni de
 * lien inerte. Affiche titre, fil d'Ariane, description, éléments de niveau 4
 * prévus et un état « en cours » clair. La page réelle remplacera ce gabarit
 * sans toucher à la source de vérité (config/rh-navigation.ts).
 */
export default function HrPlaceholder() {
  const [location] = useLocation();
  const path = location.split("?")[0];
  const entry = rhRouteEntries().find((e) => e.route === path);
  const node = entry?.node;
  const title = node?.label ?? "Ressources Humaines";

  return (
    <HrShell title={title} subtitle={node?.description}>
      <Card className="border-dashed">
        <CardContent className="p-8 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-4">
            <Construction className="w-6 h-6 text-amber-600" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <div className="mt-1"><Badge variant="outline" className="text-xs text-amber-700 border-amber-200">En cours de développement</Badge></div>
          {node?.description && <p className="text-sm text-muted-foreground mt-3 max-w-xl mx-auto">{node.description}</p>}
          <p className="text-sm text-muted-foreground mt-3 max-w-xl mx-auto">
            Cette rubrique est structurée dans la navigation ({RH_MODULE.label}) et sera dotée de ses fonctionnalités métier prochainement.
          </p>

          {node?.elements && node.elements.length > 0 && (
            <div className="mt-6 text-left max-w-xl mx-auto">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Contenu prévu</p>
              <div className="flex flex-wrap gap-2">
                {node.elements.map((el) => (
                  <Badge key={el} variant="secondary" className="text-xs font-normal">{el}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </HrShell>
  );
}
