import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { toast } from "sonner";
import { Send, Mail, CheckCircle2, AlertCircle, FileText } from "lucide-react";

type DocType = "proforma" | "order" | "invoice";

interface Props {
  docType: DocType;
  docId: string;
  referenceNumber: string;
  clientName: string | null;
  clientEmail?: string | null;
  totalAmount: number | null;
  onClose: () => void;
}

const DOC_LABELS: Record<DocType, string> = {
  proforma: "Devis",
  order: "Commande",
  invoice: "Facture",
};

const DOC_ENDPOINTS: Record<DocType, string> = {
  proforma: "proformas",
  order: "orders",
  invoice: "invoices",
};

export function SendEmailDialog({ docType, docId, referenceNumber, clientName, clientEmail, totalAmount, onClose }: Props) {
  const [to, setTo] = useState(clientEmail ?? "");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ delivered: boolean; provider: string; error?: string } | null>(null);

  const label = DOC_LABELS[docType];
  const endpoint = DOC_ENDPOINTS[docType];

  const handleSend = async () => {
    if (!to.trim() || !to.includes("@")) {
      toast.error("Adresse email invalide");
      return;
    }
    setSending(true);
    try {
      const res = await apiFetch<{ delivered: boolean; provider: string; error?: string; messageId?: string }>(
        `/api/${endpoint}/${docId}/send-email`,
        {
          method: "POST",
          body: JSON.stringify({ to: to.trim(), message: message.trim() || undefined }),
        }
      );
      setResult(res);
      if (res.delivered) {
        toast.success(`${label} envoyé avec succès`);
      } else {
        toast.error(`Échec d'envoi : ${res.error}`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur d'envoi");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#C8A24B]" />
            Envoyer le {label.toLowerCase()} par email
          </DialogTitle>
          <DialogDescription>
            Un email professionnel avec le détail du document sera envoyé au destinataire.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className={`rounded-lg p-4 flex items-start gap-3 ${result.delivered ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
            {result.delivered
              ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              : <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            }
            <div>
              <p className={`font-semibold text-sm ${result.delivered ? "text-emerald-800" : "text-red-800"}`}>
                {result.delivered ? "Email envoyé avec succès" : "Échec d'envoi"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {result.delivered
                  ? `Expédié via ${result.provider} à ${to}`
                  : result.error}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <div className="bg-muted/40 rounded-lg p-3 flex items-center gap-3 border">
              <FileText className="w-8 h-8 text-[#C8A24B] shrink-0" />
              <div>
                <p className="font-semibold text-sm">{label} {referenceNumber}</p>
                <p className="text-xs text-muted-foreground">{clientName ?? "Client non spécifié"}</p>
                {totalAmount != null && (
                  <p className="text-xs font-medium text-[#C8A24B] mt-0.5">{formatFCFA(totalAmount)}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="send-to">Destinataire *</Label>
              <Input
                id="send-to"
                type="email"
                value={to}
                onChange={e => setTo(e.target.value)}
                placeholder="contact@entreprise.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="send-msg">Message personnel <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
              <Textarea
                id="send-msg"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Bonjour, veuillez trouver ci-joint votre devis…"
                className="resize-none"
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {result ? "Fermer" : "Annuler"}
          </Button>
          {!result && (
            <Button onClick={handleSend} disabled={sending || !to.trim()} className="gap-2 bg-[#C8A24B] hover:bg-[#b08d3f] text-white">
              <Send className="w-4 h-4" />
              {sending ? "Envoi en cours…" : `Envoyer le ${label.toLowerCase()}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
