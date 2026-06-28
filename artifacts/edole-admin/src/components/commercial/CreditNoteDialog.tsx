import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { toast } from "sonner";
import { MinusCircle, AlertTriangle, Info } from "lucide-react";

type CreditType = "full" | "partial";

interface Invoice {
  id: string;
  referenceNumber: string;
  totalAmount: number | null;
  paidAmount: number | null;
  clientName: string | null;
  clientId: string | null;
}

interface Props {
  invoice: Invoice;
  onClose: () => void;
  onSuccess: () => void;
}

const REASONS = [
  "Erreur de facturation",
  "Annulation partielle de commande",
  "Remise accordée après facturation",
  "Retour de marchandise",
  "Prestation non conforme",
  "Avoir commercial",
  "Autre",
];

export function CreditNoteDialog({ invoice, onClose, onSuccess }: Props) {
  const outstanding = Math.max(0, (invoice.totalAmount ?? 0) - (invoice.paidAmount ?? 0));
  const [creditType, setCreditType] = useState<CreditType>("full");
  const [amount, setAmount] = useState(String(invoice.totalAmount ?? 0));
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const maxAmount = invoice.totalAmount ?? 0;
  const effectiveAmount = Number(amount) || 0;
  const finalReason = reason === "Autre" ? customReason : reason;

  const handleCreditTypeChange = (v: CreditType) => {
    setCreditType(v);
    if (v === "full") setAmount(String(maxAmount));
  };

  const handleSave = async () => {
    if (!finalReason.trim()) { toast.error("Le motif est obligatoire"); return; }
    if (effectiveAmount <= 0) { toast.error("Le montant doit être positif"); return; }
    if (effectiveAmount > maxAmount) { toast.error(`Le montant ne peut pas dépasser ${formatFCFA(maxAmount)}`); return; }

    setSaving(true);
    try {
      await apiFetch(`/api/invoices/${invoice.id}/credit-note`, {
        method: "POST",
        body: JSON.stringify({
          amount: effectiveAmount,
          reason: finalReason,
          notes: notes || undefined,
        }),
      });
      toast.success("Note de crédit créée avec succès");
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MinusCircle className="w-5 h-5 text-amber-600" />
            Émettre une note de crédit / avoir
          </DialogTitle>
          <DialogDescription>
            Correction ou annulation partielle/totale de la facture {invoice.referenceNumber}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Facture d'origine : {invoice.referenceNumber}</p>
              <p>Client : {invoice.clientName ?? "—"}</p>
              <p>Montant facturé : {formatFCFA(invoice.totalAmount ?? 0)}</p>
              {outstanding > 0 && <p>Solde restant dû : {formatFCFA(outstanding)}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Type d'avoir</Label>
            <Select value={creditType} onValueChange={v => handleCreditTypeChange(v as CreditType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Avoir total — annulation complète de la facture</SelectItem>
                <SelectItem value="partial">Avoir partiel — correction d'un montant</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cn-amount">
              Montant de l'avoir * <span className="text-muted-foreground font-normal">(max {formatFCFA(maxAmount)})</span>
            </Label>
            <Input
              id="cn-amount"
              type="number"
              min="1"
              max={maxAmount}
              step="1"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              disabled={creditType === "full"}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Motif *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un motif…" />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {reason === "Autre" && (
            <div className="space-y-1.5">
              <Label htmlFor="cn-custom-reason">Préciser le motif *</Label>
              <Input
                id="cn-custom-reason"
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                placeholder="Décrivez le motif de l'avoir…"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="cn-notes">Notes internes <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
            <Textarea
              id="cn-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Informations complémentaires pour le dossier…"
              className="resize-none"
              rows={2}
            />
          </div>

          {effectiveAmount > 0 && finalReason && (
            <div className="bg-muted/50 rounded-lg p-3 border text-sm space-y-1">
              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Récapitulatif</p>
              <div className="flex justify-between">
                <span>Montant de l'avoir</span>
                <span className="font-bold text-amber-700">{formatFCFA(effectiveAmount)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>Solde après avoir</span>
                <span>{formatFCFA(Math.max(0, (invoice.totalAmount ?? 0) - effectiveAmount))}</span>
              </div>
            </div>
          )}

          {creditType === "full" && (invoice.paidAmount ?? 0) > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2 text-xs text-red-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Un paiement de {formatFCFA(invoice.paidAmount ?? 0)} a déjà été encaissé. Contactez votre comptable pour le remboursement.</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            onClick={handleSave}
            disabled={saving || !finalReason.trim() || effectiveAmount <= 0}
            className="gap-2 bg-primary hover:bg-primary/90 text-white"
          >
            <MinusCircle className="w-4 h-4" />
            {saving ? "Création…" : "Émettre l'avoir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
