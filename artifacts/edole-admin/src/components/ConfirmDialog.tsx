import React, { useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Si défini, l'utilisateur doit retaper exactement cette valeur pour confirmer. */
  requireTypeToConfirm?: string;
  onConfirm: () => void | Promise<void>;
};

/**
 * Dialogue de confirmation réutilisable. Pour les actions destructives,
 * passer `destructive` et idéalement `requireTypeToConfirm` (le nom de la
 * ressource) afin de prévenir les suppressions accidentelles.
 */
export function ConfirmDialog({
  open, onOpenChange, title, description,
  confirmLabel = "Confirmer", cancelLabel = "Annuler",
  destructive = false, requireTypeToConfirm, onConfirm,
}: Props) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const requirementMet = !requireTypeToConfirm || typed === requireTypeToConfirm;

  const handleConfirm = async () => {
    if (!requirementMet) return;
    setBusy(true);
    try { await onConfirm(); onOpenChange(false); setTyped(""); }
    finally { setBusy(false); }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!busy) { onOpenChange(o); if (!o) setTyped(""); } }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {destructive && <AlertTriangle className="w-5 h-5 text-red-500" />}
            {title}
          </AlertDialogTitle>
          {description && <AlertDialogDescription asChild><div>{description}</div></AlertDialogDescription>}
        </AlertDialogHeader>
        {requireTypeToConfirm && (
          <div className="space-y-2">
            <Label className="text-sm">Tapez <span className="font-mono font-semibold">{requireTypeToConfirm}</span> pour confirmer</Label>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={requireTypeToConfirm} autoFocus />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancelLabel}</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={busy || !requirementMet}
          >
            {busy ? "Veuillez patienter…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
