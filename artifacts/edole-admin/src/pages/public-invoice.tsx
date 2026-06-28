import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { formatFCFA } from "@/lib/format";

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

type PublicInvoice = {
  id: string; referenceNumber: string; status: string;
  totalAmount: number | null; paidAmount: number | null;
  dueDate: string | null; issuedAt: string | null; notes: string | null;
  clientName: string | null; clientEmail: string | null;
  dunningStatus: string | null;
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft:          { label: "Brouillon",    cls: "bg-slate-100 text-slate-600" },
  pending:        { label: "En attente",   cls: "bg-blue-50 text-blue-700" },
  partially_paid: { label: "Part. payée", cls: "bg-amber-50 text-amber-700" },
  paid:           { label: "Payée",        cls: "bg-emerald-100 text-emerald-700" },
  overdue:        { label: "En retard",    cls: "bg-red-50 text-red-700 font-bold" },
  cancelled:      { label: "Annulée",      cls: "bg-slate-50 text-slate-400" },
};

export default function PublicInvoicePage() {
  const [, params] = useRoute("/facture/:token");
  const token = params?.token;

  const { data: inv, isLoading, isError } = useQuery<PublicInvoice>({
    queryKey: ["public-invoice", token],
    queryFn: async () => {
      const r = await fetch(`/api/public/invoices/${token}`);
      if (!r.ok) throw new Error("Facture introuvable");
      return r.json();
    },
    enabled: !!token,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-muted-foreground text-sm">Chargement…</div>
      </div>
    );
  }

  if (isError || !inv) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-2">
          <div className="text-4xl">📄</div>
          <h2 className="font-semibold text-lg">Facture introuvable</h2>
          <p className="text-sm text-muted-foreground">Ce lien est invalide ou a expiré.</p>
        </div>
      </div>
    );
  }

  const remaining = Math.max(0, (inv.totalAmount ?? 0) - (inv.paidAmount ?? 0));
  const st = STATUS_LABEL[inv.status] ?? { label: inv.status, cls: "bg-slate-100 text-slate-600" };
  const isOverdue = inv.status === "overdue";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-10 px-4">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2563EB] flex items-center justify-center text-white font-bold text-lg">G</div>
          <div>
            <p className="font-bold text-lg leading-tight">Gameasu</p>
            <p className="text-xs text-muted-foreground">Plateforme de gestion d'entreprise</p>
          </div>
        </div>

        {/* Invoice card */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Facture</p>
              <h1 className="text-2xl font-bold tracking-tight mt-0.5">{inv.referenceNumber}</h1>
              {inv.clientName && <p className="text-sm text-muted-foreground mt-1">À l'attention de : <strong>{inv.clientName}</strong></p>}
            </div>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${st.cls}`}>{st.label}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Date d'émission</p>
              <p className="font-medium">{fmt(inv.issuedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Échéance</p>
              <p className={`font-medium ${isOverdue ? "text-red-600 font-bold" : ""}`}>{fmt(inv.dueDate)}</p>
            </div>
          </div>

          <div className={`rounded-xl p-4 space-y-3 ${isOverdue ? "bg-red-50 border border-red-100" : "bg-slate-50"}`}>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Montant total</span>
              <span className="font-semibold">{formatFCFA(inv.totalAmount ?? 0)}</span>
            </div>
            {(inv.paidAmount ?? 0) > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Déjà encaissé</span>
                <span className="font-semibold text-emerald-600">- {formatFCFA(inv.paidAmount ?? 0)}</span>
              </div>
            )}
            <div className="border-t pt-3 flex justify-between items-center">
              <span className="font-bold">Reste à payer</span>
              <span className={`text-xl font-bold ${isOverdue ? "text-red-600" : remaining === 0 ? "text-emerald-600" : "text-[#2563EB]"}`}>
                {remaining === 0 ? "Soldé ✓" : formatFCFA(remaining)}
              </span>
            </div>
          </div>

          {inv.notes && (
            <div className="text-sm text-muted-foreground border-t pt-4">
              <p className="font-semibold text-xs uppercase tracking-wide mb-1">Notes</p>
              <p className="whitespace-pre-wrap">{inv.notes}</p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Cette page est partagée uniquement à titre informatif. Pour tout renseignement, contactez votre interlocuteur commercial.
        </p>
      </div>
    </div>
  );
}
