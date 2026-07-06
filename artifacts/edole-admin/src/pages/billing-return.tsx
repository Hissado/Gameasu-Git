import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api";
import { formatFCFA, formatDate } from "@/lib/format";
import { CheckCircle2, XCircle, Clock, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Tx = {
  id: string;
  status: string;
  amount: number;
  method: string;
  reference: string | null;
  receiptNumber: string | null;
  confirmedAt: string | null;
  failedAt: string | null;
  createdAt: string;
};

const METHOD_LABELS: Record<string, string> = {
  card: "Carte bancaire (CinetPay)",
  mixx: "Mixx Mobile Money",
  flooz: "Flooz Mobile Money",
  mobile_money: "Mobile Money",
};

export default function BillingReturnPage() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref") ?? "";

  const [tx, setTx] = useState<Tx | null>(null);
  const [loading, setLoading] = useState(true);
  const [polls, setPolls] = useState(0);

  const maxPolls = 20;
  const pollInterval = 3000;

  useEffect(() => {
    if (!ref) { setLoading(false); return; }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await apiFetch(`/api/billing/cinetpay/transaction/${encodeURIComponent(ref)}`) as { data: Tx };
        if (!cancelled) {
          setTx(res.data);
          setLoading(false);

          const done = ["confirmed", "failed", "cancelled", "expired"].includes(res.data.status);
          if (!done) {
            setPolls((p) => {
              if (p < maxPolls) {
                timer = setTimeout(poll, pollInterval);
              }
              return p + 1;
            });
          }
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [ref]);

  const isConfirmed = tx?.status === "confirmed";
  const isFailed = tx?.status === "failed" || tx?.status === "cancelled" || tx?.status === "expired";
  const isPending = !isConfirmed && !isFailed;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
          {/* Header */}
          <div className="bg-[#0b0f1c] px-6 py-5">
            <div className="text-[#F37021] font-extrabold tracking-widest text-xs uppercase mb-1">Gameasu</div>
            <div className="text-white text-lg font-semibold">Résultat du paiement</div>
          </div>

          <div className="p-6 space-y-6">
            {loading ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-12 h-12 rounded-full border-4 border-amber-200 border-t-amber-500 animate-spin" />
                <p className="text-sm text-muted-foreground font-medium">Vérification du paiement en cours…</p>
                <p className="text-xs text-muted-foreground">Cela peut prendre quelques secondes.</p>
              </div>
            ) : !ref || !tx ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <XCircle className="w-12 h-12 text-slate-300" />
                <p className="font-semibold text-slate-700">Transaction introuvable</p>
                <p className="text-sm text-muted-foreground">La référence de paiement est invalide ou expirée.</p>
              </div>
            ) : isConfirmed ? (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
                  <CheckCircle2 className="w-9 h-9 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xl font-bold text-emerald-700">Paiement réussi !</p>
                  <p className="text-sm text-muted-foreground mt-1">Votre abonnement est actif et renouvelé.</p>
                </div>

                <div className="w-full rounded-xl bg-slate-50 border border-slate-100 divide-y divide-slate-100 text-sm mt-2">
                  {tx.receiptNumber && (
                    <div className="flex justify-between items-center px-4 py-2.5">
                      <span className="text-muted-foreground">N° de reçu</span>
                      <span className="font-semibold text-slate-800">{tx.receiptNumber}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center px-4 py-2.5">
                    <span className="text-muted-foreground">Référence</span>
                    <span className="font-mono text-xs text-slate-600">{tx.reference}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-2.5">
                    <span className="text-muted-foreground">Montant TTC</span>
                    <span className="font-bold text-emerald-700">{formatFCFA(tx.amount)}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-2.5">
                    <span className="text-muted-foreground">Méthode</span>
                    <span className="text-slate-700">{METHOD_LABELS[tx.method] ?? tx.method}</span>
                  </div>
                  {tx.confirmedAt && (
                    <div className="flex justify-between items-center px-4 py-2.5">
                      <span className="text-muted-foreground">Confirmé le</span>
                      <span className="text-slate-700">{formatDate(tx.confirmedAt)}</span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Un reçu a été envoyé à votre adresse email.
                </p>
              </div>
            ) : isFailed ? (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center">
                  <XCircle className="w-9 h-9 text-red-400" />
                </div>
                <div>
                  <p className="text-xl font-bold text-red-600">Paiement non abouti</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Le paiement a été {tx.status === "cancelled" ? "annulé" : tx.status === "expired" ? "expiré" : "refusé"}.
                  </p>
                </div>

                <div className="w-full rounded-xl bg-slate-50 border border-slate-100 divide-y divide-slate-100 text-sm mt-2">
                  <div className="flex justify-between items-center px-4 py-2.5">
                    <span className="text-muted-foreground">Référence</span>
                    <span className="font-mono text-xs text-slate-600">{tx.reference}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-2.5">
                    <span className="text-muted-foreground">Montant</span>
                    <span className="text-slate-700">{formatFCFA(tx.amount)}</span>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  Vous pouvez réessayer depuis votre espace abonnement ou choisir un autre mode de paiement.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center">
                  <Clock className="w-9 h-9 text-amber-500 animate-pulse" />
                </div>
                <div>
                  <p className="text-xl font-bold text-amber-700">Paiement en attente</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Nous attendons la confirmation de CinetPay.
                  </p>
                </div>

                <div className="w-full rounded-xl bg-slate-50 border border-slate-100 divide-y divide-slate-100 text-sm mt-2">
                  <div className="flex justify-between items-center px-4 py-2.5">
                    <span className="text-muted-foreground">Référence</span>
                    <span className="font-mono text-xs text-slate-600">{tx.reference}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-2.5">
                    <span className="text-muted-foreground">Montant</span>
                    <span className="text-slate-700">{formatFCFA(tx.amount)}</span>
                  </div>
                </div>

                {polls < maxPolls ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Vérification automatique en cours…
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    La confirmation peut prendre quelques minutes. Votre abonnement sera activé dès réception.
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => navigate("/abonnement")}
              >
                <ArrowLeft className="w-4 h-4" />
                Retour à l'abonnement
              </Button>
              {isFailed && (
                <Button
                  className="flex-1 bg-[#F37021] hover:bg-[#e06018] text-white font-semibold"
                  onClick={() => navigate("/abonnement")}
                >
                  Réessayer
                </Button>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Paiement sécurisé via CinetPay · Gameasu SaaS
        </p>
      </div>
    </div>
  );
}
