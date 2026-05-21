import React from "react";
import { MarketingShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileCode2, FormInput, Calendar, MessageCircle, Mail, UserPlus, Sparkles } from "lucide-react";

const FORMS = [
  { name: "Demande de devis", description: "Formulaire public pour récupérer des demandes de prix qualifiées.", icon: FormInput, status: "À configurer" },
  { name: "Demande de rappel", description: "Le visiteur laisse son numéro et son créneau préféré.", icon: MessageCircle, status: "À configurer" },
  { name: "Demande de démo", description: "Inscription à une démo guidée de la plateforme.", icon: Calendar, status: "À configurer" },
  { name: "Inscription newsletter", description: "Capte les emails pour les campagnes récurrentes.", icon: Mail, status: "À configurer" },
  { name: "Contact général", description: "Formulaire générique pour le pied de page du site.", icon: UserPlus, status: "À configurer" },
];

export default function FormsPage() {
  return (
    <MarketingShell title="Formulaires & pages" subtitle="Capture de leads et landing pages publiques">
      <Card className="mb-4 border-amber-200 bg-amber-50/40">
        <CardContent className="p-4 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <div className="font-semibold text-amber-900">Sous-module en préparation</div>
            <p className="text-sm text-amber-800 mt-1">
              L'ossature du module Marketing est en place. Les formulaires publics et landing pages sont prévus dans la prochaine itération — ils alimenteront automatiquement la table <code className="bg-amber-100 px-1 rounded text-xs">prospects</code> et déclencheront les workflows configurés dans <strong>Automatisations</strong>.
            </p>
            <p className="text-sm text-amber-800 mt-2">
              En attendant, vous pouvez créer manuellement des prospects dans l'onglet <strong>Prospects</strong> et les pousser vers vos audiences.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {FORMS.map((f) => (
          <Card key={f.name} className="opacity-70 hover:opacity-100 transition">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-md bg-muted text-muted-foreground flex items-center justify-center"><f.icon className="w-5 h-5" /></div>
                <Badge variant="outline">{f.status}</Badge>
              </div>
              <div className="font-semibold">{f.name}</div>
              <div className="text-xs text-muted-foreground">{f.description}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </MarketingShell>
  );
}
