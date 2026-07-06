import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, CheckCircle2, Building2, ArrowRight, FileText, Phone, Upload, Info, Copy, Check as CheckIcon,
} from "lucide-react";
import { toast } from "sonner";

type BankCoords = {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  iban: string;
  bic: string;
  officeAddress: string;
  officeHours: string;
  checkOrder: string;
  officePhone: string;
};

const METHOD_OPTS = [
  { value: "virement",      label: "Virement bancaire",  desc: "Virement SEPA ou interbancaire depuis votre banque" },
  { value: "depot_bancaire", label: "Dépôt bancaire",    desc: "Dépôt d'espèces ou chèque en agence bancaire" },
  { value: "depot_bureau",   label: "Dépôt au bureau",   desc: "Dépôt d'espèces directement à nos bureaux" },
  { value: "cheque",         label: "Chèque",             desc: "Chèque établi à l'ordre de Gaméasù SARL" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  planCode: string;
  seats: number;
  periodicity: string;
  amountTTC: number;
  onSuccess?: () => void;
}

export function DeclarePaiementDialog({ open, onClose, planCode, seats, periodicity, amountTTC, onSuccess }: Props) {
  const [step, setStep] = useState<"method" | "details" | "success">("method");
  const [method, setMethod] = useState("");
  const [justificationUrl, setJustificationUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState("");
  const [payerPhone, setPayerPhone] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  }

  const bankQuery = useQuery<{ data: BankCoords }>({
    queryKey: ["bank-coordinates"],
    queryFn: () => apiFetch("/api/billing/bank-coordinates"),
    enabled: step === "details",
  });

  const declareMut = useMutation({
    mutationFn: () =>
      apiFetch("/api/billing/declare-payment", {
        method: "POST",
        body: JSON.stringify({
          planCode,
          seats,
          periodicity,
          method,
          justificationUrl,
          notes: notes || undefined,
          payerPhone: payerPhone || undefined,
        }),
      }),
    onSuccess: () => {
      setStep("success");
      onSuccess?.();
    },
    onError: (e: Error) => toast.error(e.message ?? "Erreur lors de la déclaration"),
  });

  async function handleUpload(file: File) {
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (25 Mo max)");
      return;
    }
    setUploading(true);
    try {
      const res = await apiFetch("/api/storage/uploads/request-url", {
        method: "POST",
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      }) as { uploadURL: string; objectPath: string };
      const { uploadURL, objectPath } = res;
      await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      setJustificationUrl(objectPath);
      toast.success("Justificatif téléversé");
    } catch {
      toast.error("Erreur lors du téléversement");
    } finally {
      setUploading(false);
    }
  }

  const selectedMethodLabel = METHOD_OPTS.find((m) => m.value === method)?.label ?? "";

  function reset() {
    setStep("method");
    setMethod("");
    setJustificationUrl(null);
    setNotes("");
    setPayerPhone("");
    onClose();
  }

  const coords = bankQuery.data?.data;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Déclarer un paiement manuel
          </DialogTitle>
          <DialogDescription>
            Virement, dépôt bancaire, dépôt au bureau ou chèque
          </DialogDescription>
        </DialogHeader>

        {/* ── Étape 1 : Choix du moyen de paiement ─────────────── */}
        {step === "method" && (
          <div className="space-y-4 py-2">
            {/* Résumé de la commande */}
            <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Formule</span>
                <span className="font-medium">{planCode} — {seats} utilisateur{seats > 1 ? "s" : ""}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Périodicité</span>
                <span className="font-medium capitalize">{periodicity === "monthly" ? "Mensuel" : "Annuel"}</span>
              </div>
              <div className="flex justify-between border-t pt-1 mt-1">
                <span className="text-muted-foreground font-medium">Montant TTC</span>
                <span className="font-bold text-primary text-base">{formatFCFA(amountTTC)}</span>
              </div>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Choisissez votre moyen de paiement</Label>
              <div className="space-y-2">
                {METHOD_OPTS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMethod(m.value)}
                    className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                      method === m.value
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/50 hover:bg-muted/40"
                    }`}
                  >
                    <div className="font-medium text-sm">{m.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={reset}>Annuler</Button>
              <Button
                size="sm"
                disabled={!method}
                onClick={() => setStep("details")}
              >
                Suivant <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── Étape 2 : Coordonnées + justificatif ─────────────── */}
        {step === "details" && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{selectedMethodLabel}</Badge>
            </div>

            {/* Coordonnées bancaires ou bureau */}
            {bankQuery.isLoading ? (
              <div className="flex items-center justify-center h-24"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : coords ? (
              <div className="rounded-xl border bg-blue-50/50 border-blue-100 divide-y divide-blue-100 text-sm">
                <div className="px-4 py-2 flex items-center gap-2 text-blue-800 font-medium">
                  <Building2 className="w-4 h-4" />
                  {method === "depot_bureau" ? "Adresse du bureau" : method === "cheque" ? "Ordre du chèque" : "Coordonnées bancaires"}
                </div>
                {method === "depot_bureau" ? (
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-muted-foreground text-xs shrink-0">Adresse</span>
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-right text-sm">{coords.officeAddress}</span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyText(coords.officeAddress, "address")}>
                          {copiedKey === "address" ? <CheckIcon className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </Button>
                      </div>
                    </div>
                    {coords.officeHours && <div className="text-muted-foreground text-xs">{coords.officeHours}</div>}
                    {coords.officePhone && <div className="text-muted-foreground text-xs">{coords.officePhone}</div>}
                    <div className="border-t pt-2 mt-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Montant exact à remettre</span>
                        <span className="font-bold text-primary">{formatFCFA(amountTTC)}</span>
                      </div>
                    </div>
                  </div>
                ) : method === "cheque" ? (
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-muted-foreground text-xs shrink-0">À l'ordre de</span>
                      <div className="flex items-center gap-1">
                        <span className="font-semibold">{coords.checkOrder}</span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyText(coords.checkOrder, "checkOrder")}>
                          {copiedKey === "checkOrder" ? <CheckIcon className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">{coords.officeAddress}</div>
                    <div className="border-t pt-2 flex justify-between text-xs">
                      <span className="text-muted-foreground">Montant du chèque</span>
                      <span className="font-bold text-primary">{formatFCFA(amountTTC)}</span>
                    </div>
                    <div className="text-xs text-amber-700">Libellé : indiquez votre organisation en dos de chèque</div>
                  </div>
                ) : (
                  <div className="px-4 py-3 space-y-1.5">
                    {[
                      { label: "Banque",    value: coords.bankName,       key: "bank",    copy: false },
                      { label: "Titulaire", value: coords.accountHolder,  key: "holder",  copy: true },
                      { label: "Compte",    value: coords.accountNumber,  key: "account", copy: true },
                      { label: "IBAN",      value: coords.iban,           key: "iban",    copy: true },
                      { label: "BIC/SWIFT", value: coords.bic,            key: "bic",     copy: true },
                    ].map(({ label, value, key, copy }) => (
                      <div key={label} className="flex justify-between items-center gap-2">
                        <span className="text-muted-foreground shrink-0 text-xs">{label}</span>
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs font-medium text-right break-all">{value}</span>
                          {copy && (
                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0" onClick={() => copyText(value, key)}>
                              {copiedKey === key ? <CheckIcon className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="border-t pt-2 flex justify-between text-xs mt-1">
                      <span className="text-muted-foreground">Montant exact à virer</span>
                      <Button variant="ghost" size="sm" className="h-5 px-1 text-xs font-bold text-primary" onClick={() => copyText(String(amountTTC), "amount")}>
                        {formatFCFA(amountTTC)} {copiedKey === "amount" ? <CheckIcon className="w-3 h-3 ml-1 text-emerald-500" /> : <Copy className="w-3 h-3 ml-1" />}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            <div className="rounded-xl border border-amber-100 bg-amber-50/50 px-4 py-3 flex gap-2 text-sm text-amber-800">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Effectuez le paiement, puis déclarez-le ci-dessous. Notre équipe vérifiera et activera votre abonnement sous 24–48h.</span>
            </div>

            {/* Téléphone payeur */}
            <div>
              <Label className="text-sm mb-1 block flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />Téléphone du payeur <span className="text-muted-foreground text-xs">(optionnel)</span>
              </Label>
              <Input
                placeholder="+228 XX XX XX XX"
                value={payerPhone}
                onChange={(e) => setPayerPhone(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Justificatif */}
            <div>
              <Label className="text-sm mb-1 block flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" />Justificatif de paiement <span className="text-muted-foreground text-xs">(recommandé)</span>
              </Label>
              {justificationUrl ? (
                <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="flex-1 truncate text-muted-foreground text-xs">{justificationUrl.split("/").pop()}</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setJustificationUrl(null)}>Supprimer</Button>
                </div>
              ) : (
                <label className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 cursor-pointer transition-colors ${uploading ? "opacity-50 pointer-events-none" : "hover:border-primary/50 hover:bg-muted/30"}`}>
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground text-center">
                        Cliquez pour joindre un reçu, virement ou relevé<br />
                        <span className="text-xs">(PDF, image — 25 Mo max)</span><br />
                        <span className="text-xs font-medium text-amber-700">Requis pour valider la déclaration</span>
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
                  />
                </label>
              )}
            </div>

            {/* Notes */}
            <div>
              <Label className="text-sm mb-1 block">Notes <span className="text-muted-foreground text-xs">(optionnel)</span></Label>
              <Textarea
                placeholder="Référence du virement, date de l'opération, informations complémentaires…"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-sm"
              />
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep("method")}>Retour</Button>
              <Button
                size="sm"
                disabled={declareMut.isPending || !justificationUrl}
                onClick={() => declareMut.mutate()}
              >
                {declareMut.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
                Confirmer la déclaration
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── Étape 3 : Succès ─────────────────────────────────── */}
        {step === "success" && (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Déclaration enregistrée !</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                Notre équipe vérifiera votre paiement sous 24 à 48 heures ouvrables. Vous recevrez un email de confirmation dès validation.
              </p>
            </div>
            <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm text-left space-y-1 max-w-xs mx-auto">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Moyen</span>
                <span className="font-medium">{selectedMethodLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Montant</span>
                <span className="font-bold text-primary">{formatFCFA(amountTTC)}</span>
              </div>
            </div>
            <Button size="sm" onClick={reset}>Fermer</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
