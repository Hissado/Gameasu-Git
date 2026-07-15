import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calculator, Globe, Info } from "lucide-react";
import { BRANDING } from "@/config/branding";

export function AboutDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 text-[9.5px] text-white/20 hover:text-white/45 tracking-wide transition-colors py-1"
        title="À propos de Gaméasù"
      >
        <Info className="w-2.5 h-2.5" />
        À propos de {BRANDING.appName}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm font-sans">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-base">
              <img src={BRANDING.logoMark} alt={BRANDING.appName} className="h-6 w-auto" />
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground leading-relaxed">
            Plateforme de pilotage d'entreprise nouvelle génération, conçue pour les organisations
            d'Afrique de l'Ouest francophone.
          </p>

          <div className="bg-muted/60 rounded-xl p-3.5 text-[11.5px] space-y-2">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Info className="w-3 h-3" />Version
              </span>
              <span className="font-semibold text-foreground">2026</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Globe className="w-3 h-3" />Région
              </span>
              <span className="font-semibold text-foreground">Afrique de l'Ouest · FCFA (XOF)</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Calculator className="w-3 h-3" />Norme comptable
              </span>
              <span className="font-semibold text-foreground">SYSCOHADA</span>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground text-center pt-1">
            © 2025 Gameasu · Tous droits réservés
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
