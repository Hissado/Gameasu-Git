import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { apiFetch } from "@/lib/api";
import { formatFCFA, formatDate } from "@/lib/format";
import { Download, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type DocType = "proforma" | "order" | "invoice";

type OrgInfo = {
  organizationName: string | null;
  organizationLegalName: string | null;
  organizationLogoUrl: string | null;
};

type Document = {
  id: string;
  referenceNumber: string;
  status: string;
  totalAmount: number | null;
  paidAmount?: number | null;
  clientId: string | null;
  clientName: string | null;
  notes: string | null;
  currency?: string | null;
  issuedAt?: string | null;
  createdAt?: string | null;
  dueDate?: string | null;
  validUntil?: string | null;
};

type Line = {
  id: string;
  description: string;
  quantity: number;
  unitPriceFcfa: number;
  discountPct: number;
  taxRatePct: number;
  totalFcfa: number;
  productId?: string | null;
};

const DOCTYPE_LABELS: Record<DocType, string> = {
  proforma: "DEVIS / PROFORMA",
  order: "BON DE COMMANDE",
  invoice: "FACTURE",
};

const DOCTYPE_API: Record<DocType, string> = {
  proforma: "proformas",
  order: "orders",
  invoice: "invoices",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  approved: "Approuvé",
  confirmed: "Confirmé",
  pending: "En attente",
  partially_paid: "Partiellement payé",
  paid: "Payé",
  overdue: "En retard",
  cancelled: "Annulé",
  rejected: "Rejeté",
  invoiced: "Facturé",
  delivered: "Livré",
};

function computeTotals(lines: Line[]) {
  const subtotalHT = lines.reduce(
    (s, l) => s + l.quantity * l.unitPriceFcfa * (1 - l.discountPct / 100),
    0,
  );
  const totalDiscount = lines.reduce(
    (s, l) => s + l.quantity * l.unitPriceFcfa * (l.discountPct / 100),
    0,
  );
  const totalTVA = lines.reduce((s, l) => {
    const ht = l.quantity * l.unitPriceFcfa * (1 - l.discountPct / 100);
    return s + ht * (l.taxRatePct / 100);
  }, 0);
  const totalTTC = lines.reduce((s, l) => s + l.totalFcfa, 0);
  return {
    subtotalHT: Math.round(subtotalHT),
    totalDiscount: Math.round(totalDiscount),
    totalTVA: Math.round(totalTVA),
    totalTTC: Math.round(totalTTC),
  };
}

export default function PrintDocumentPage() {
  const params = useParams<{ type: string; id: string }>();
  const docType = params.type as DocType;
  const docId = params.id;

  const [doc, setDoc] = useState<Document | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [org, setOrg] = useState<OrgInfo>({ organizationName: null, organizationLegalName: null, organizationLogoUrl: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!DOCTYPE_API[docType]) {
      setError("Type de document invalide.");
      setLoading(false);
      return;
    }
    const apiBase = DOCTYPE_API[docType];
    Promise.all([
      apiFetch<Document>(`/api/${apiBase}/${docId}`),
      apiFetch<{ data: Line[] }>(`/api/${apiBase}/${docId}/lines`),
      apiFetch<OrgInfo>("/api/auth/me").catch(() => ({ organizationName: null, organizationLegalName: null, organizationLogoUrl: null })),
    ])
      .then(([docData, linesData, meData]) => {
        setDoc(docData);
        setLines(linesData.data ?? []);
        setOrg({
          organizationName: (meData as any).organizationName ?? null,
          organizationLegalName: (meData as any).organizationLegalName ?? null,
          organizationLogoUrl: (meData as any).organizationLogoUrl ?? null,
        });
      })
      .catch(() => setError("Impossible de charger le document."))
      .finally(() => setLoading(false));
  }, [docType, docId]);

  useEffect(() => {
    if (!loading && doc) {
      document.title = `${DOCTYPE_LABELS[docType] ?? "Document"} — ${doc.referenceNumber}`;
    }
  }, [loading, doc, docType]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-[#C8A24B]" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white gap-4">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-slate-600">{error ?? "Document introuvable."}</p>
      </div>
    );
  }

  const totals = lines.length > 0 ? computeTotals(lines) : null;
  const docDate = doc.issuedAt ?? doc.createdAt ?? null;
  const secondaryDate =
    docType === "proforma"
      ? doc.validUntil
      : docType === "invoice"
        ? doc.dueDate
        : null;
  const secondaryLabel =
    docType === "proforma"
      ? "Valable jusqu'au"
      : docType === "invoice"
        ? "Échéance"
        : null;

  const orgDisplayName = org.organizationName ?? "Gameasu";
  const orgSubline = org.organizationLegalName ?? org.organizationName ?? "";

  return (
    <>
      <style>{`
        @media screen {
          body { background: #f1f5f9 !important; }
          .print-wrapper {
            max-width: 210mm;
            margin: 72px auto 40px;
            box-shadow: 0 4px 24px rgba(0,0,0,0.13);
            border-radius: 8px;
            overflow: hidden;
          }
        }
        @media print {
          .no-print { display: none !important; }
          body { margin: 0 !important; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: A4; margin: 0; }
          .print-wrapper {
            margin: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }
          .print-footer { page-break-inside: avoid; }
        }
      `}</style>

      {/* Barre de contrôle — masquée à l'impression */}
      <div
        className="no-print"
        style={{
          position: "fixed",
          top: "16px",
          right: "16px",
          zIndex: 50,
          background: "white",
          borderRadius: "8px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          border: "1px solid #e2e8f0",
        }}
      >
        <span style={{ fontSize: "13px", color: "#475569", fontWeight: 500 }}>
          {DOCTYPE_LABELS[docType]} — {doc.referenceNumber}
        </span>
        <Button
          onClick={() => window.print()}
          style={{ background: "#C8A24B", color: "white", display: "flex", alignItems: "center", gap: "6px" }}
        >
          <Download style={{ width: 16, height: 16 }} />
          Enregistrer PDF
        </Button>
      </div>

      {/* Document A4 */}
      <div
        className="print-wrapper"
        style={{
          background: "white",
          fontFamily: "'Segoe UI', Arial, sans-serif",
          fontSize: "10pt",
          color: "#1a1a2e",
          padding: "15mm 15mm 12mm 15mm",
          boxSizing: "border-box",
        }}
      >
        {/* En-tête : logo + titre */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "8mm",
            borderBottom: "2px solid #C8A24B",
            paddingBottom: "6mm",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {org.organizationLogoUrl ? (
              <img
                src={org.organizationLogoUrl}
                alt={orgDisplayName}
                style={{ height: "44px", objectFit: "contain", maxWidth: "140px" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "8px",
                  background: "#1a1a2e",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#C8A24B",
                  fontWeight: 700,
                  fontSize: "18pt",
                }}
              >
                {orgDisplayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div style={{ fontSize: "14pt", fontWeight: "bold", color: "#1a1a2e" }}>
                {orgDisplayName}
              </div>
              {orgSubline && orgSubline !== orgDisplayName && (
                <div style={{ fontSize: "8pt", color: "#6b7280" }}>{orgSubline}</div>
              )}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "18pt", fontWeight: "bold", color: "#C8A24B", marginBottom: "3px" }}>
              {DOCTYPE_LABELS[docType]}
            </div>
            <div style={{ fontSize: "12pt", fontWeight: "bold", color: "#1a1a2e", marginBottom: "4px" }}>
              N° {doc.referenceNumber}
            </div>
            <div
              style={{
                display: "inline-block",
                padding: "2px 8px",
                borderRadius: "12px",
                fontSize: "8pt",
                fontWeight: 600,
                backgroundColor: "#f3f4f6",
                color: "#374151",
              }}
            >
              {STATUS_LABELS[doc.status] ?? doc.status}
            </div>
          </div>
        </header>

        {/* Facturé à + Informations */}
        <section
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6mm", marginBottom: "8mm" }}
        >
          <div
            style={{
              backgroundColor: "#f9fafb",
              borderRadius: "6px",
              padding: "5mm",
              border: "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                fontSize: "7pt",
                fontWeight: 700,
                textTransform: "uppercase",
                color: "#9ca3af",
                letterSpacing: "0.08em",
                marginBottom: "3mm",
              }}
            >
              {docType === "order" ? "Client" : "Facturé à"}
            </div>
            <div style={{ fontSize: "11pt", fontWeight: 700, color: "#1a1a2e" }}>
              {doc.clientName ?? "—"}
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#f9fafb",
              borderRadius: "6px",
              padding: "5mm",
              border: "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                fontSize: "7pt",
                fontWeight: 700,
                textTransform: "uppercase",
                color: "#9ca3af",
                letterSpacing: "0.08em",
                marginBottom: "3mm",
              }}
            >
              Informations
            </div>
            {docDate && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                <span style={{ color: "#6b7280", fontSize: "9pt" }}>Date d'émission</span>
                <span style={{ fontWeight: 600, fontSize: "9pt" }}>{formatDate(docDate)}</span>
              </div>
            )}
            {secondaryDate && secondaryLabel && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                <span style={{ color: "#6b7280", fontSize: "9pt" }}>{secondaryLabel}</span>
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: "9pt",
                    color:
                      docType === "invoice" && doc.dueDate && new Date(doc.dueDate) < new Date()
                        ? "#dc2626"
                        : "#1a1a2e",
                  }}
                >
                  {formatDate(secondaryDate)}
                </span>
              </div>
            )}
            {docType === "invoice" && doc.paidAmount != null && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#6b7280", fontSize: "9pt" }}>Déjà encaissé</span>
                <span style={{ fontWeight: 600, fontSize: "9pt", color: "#059669" }}>
                  {formatFCFA(doc.paidAmount)}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Lignes */}
        {lines.length > 0 ? (
          <section style={{ marginBottom: "8mm" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
              <thead>
                <tr style={{ backgroundColor: "#1a1a2e", color: "white" }}>
                  <th style={{ padding: "3mm", textAlign: "left", fontWeight: 600, width: "35%" }}>Description</th>
                  <th style={{ padding: "3mm", textAlign: "right", fontWeight: 600, width: "8%" }}>Qté</th>
                  <th style={{ padding: "3mm", textAlign: "right", fontWeight: 600, width: "17%" }}>P.U. HT (FCFA)</th>
                  <th style={{ padding: "3mm", textAlign: "right", fontWeight: 600, width: "10%" }}>Remise</th>
                  <th style={{ padding: "3mm", textAlign: "right", fontWeight: 600, width: "10%" }}>TVA</th>
                  <th style={{ padding: "3mm", textAlign: "right", fontWeight: 600, width: "20%" }}>Total TTC (FCFA)</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr
                    key={line.id}
                    style={{
                      backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f9fafb",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    <td style={{ padding: "2.5mm 3mm", fontWeight: 500 }}>{line.description}</td>
                    <td style={{ padding: "2.5mm 3mm", textAlign: "right" }}>{line.quantity}</td>
                    <td style={{ padding: "2.5mm 3mm", textAlign: "right" }}>{formatFCFA(line.unitPriceFcfa)}</td>
                    <td style={{ padding: "2.5mm 3mm", textAlign: "right", color: line.discountPct > 0 ? "#dc2626" : "#9ca3af" }}>
                      {line.discountPct > 0 ? `${line.discountPct}%` : "—"}
                    </td>
                    <td style={{ padding: "2.5mm 3mm", textAlign: "right" }}>{line.taxRatePct}%</td>
                    <td style={{ padding: "2.5mm 3mm", textAlign: "right", fontWeight: 700, color: "#1a1a2e" }}>
                      {formatFCFA(line.totalFcfa)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totals && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4mm" }}>
                <div style={{ minWidth: "80mm" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5mm 3mm", borderBottom: "1px solid #e5e7eb" }}>
                    <span style={{ color: "#6b7280", fontSize: "9pt" }}>Sous-total HT</span>
                    <span style={{ fontWeight: 600, fontSize: "9pt" }}>{formatFCFA(totals.subtotalHT)}</span>
                  </div>
                  {totals.totalDiscount > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5mm 3mm", borderBottom: "1px solid #e5e7eb" }}>
                      <span style={{ color: "#dc2626", fontSize: "9pt" }}>Remises</span>
                      <span style={{ fontWeight: 600, fontSize: "9pt", color: "#dc2626" }}>− {formatFCFA(totals.totalDiscount)}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5mm 3mm", borderBottom: "1px solid #e5e7eb" }}>
                    <span style={{ color: "#6b7280", fontSize: "9pt" }}>Total TVA</span>
                    <span style={{ fontWeight: 600, fontSize: "9pt" }}>{formatFCFA(totals.totalTVA)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3mm", backgroundColor: "#1a1a2e", borderRadius: "0 0 4px 4px" }}>
                    <span style={{ color: "white", fontWeight: 700, fontSize: "11pt" }}>TOTAL TTC</span>
                    <span style={{ color: "#C8A24B", fontWeight: 700, fontSize: "11pt" }}>{formatFCFA(totals.totalTTC)}</span>
                  </div>
                </div>
              </div>
            )}
          </section>
        ) : (
          doc.totalAmount != null && (
            <section style={{ marginBottom: "8mm" }}>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "4mm 6mm",
                    backgroundColor: "#1a1a2e",
                    borderRadius: "6px",
                    minWidth: "80mm",
                  }}
                >
                  <span style={{ color: "white", fontWeight: 700, fontSize: "11pt" }}>MONTANT TOTAL</span>
                  <span style={{ color: "#C8A24B", fontWeight: 700, fontSize: "11pt" }}>{formatFCFA(doc.totalAmount)}</span>
                </div>
              </div>
            </section>
          )
        )}

        {/* Récapitulatif paiement (factures) */}
        {docType === "invoice" && doc.paidAmount != null && doc.totalAmount != null && (
          <section
            style={{
              marginBottom: "6mm",
              padding: "4mm 5mm",
              backgroundColor: "#f0fdf4",
              border: "1px solid #86efac",
              borderRadius: "6px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
              <span style={{ color: "#6b7280", fontSize: "9pt" }}>Montant payé</span>
              <span style={{ fontWeight: 700, fontSize: "9pt", color: "#059669" }}>{formatFCFA(doc.paidAmount)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#1a1a2e", fontWeight: 700, fontSize: "10pt" }}>Reste à payer</span>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: "10pt",
                  color: doc.totalAmount - doc.paidAmount > 0 ? "#dc2626" : "#059669",
                }}
              >
                {formatFCFA(Math.max(0, doc.totalAmount - doc.paidAmount))}
              </span>
            </div>
          </section>
        )}

        {/* Notes */}
        {doc.notes && (
          <section
            style={{
              marginBottom: "6mm",
              padding: "4mm 5mm",
              backgroundColor: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: "6px",
            }}
          >
            <div
              style={{
                fontSize: "7pt",
                fontWeight: 700,
                textTransform: "uppercase",
                color: "#9ca3af",
                letterSpacing: "0.08em",
                marginBottom: "2mm",
              }}
            >
              Notes & conditions
            </div>
            <p style={{ fontSize: "9pt", color: "#374151", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
              {doc.notes}
            </p>
          </section>
        )}

        {/* Pied de page — flux normal (pas absolu) */}
        <footer
          className="print-footer"
          style={{
            marginTop: "8mm",
            borderTop: "1px solid #e5e7eb",
            paddingTop: "4mm",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "7.5pt", color: "#9ca3af" }}>
            Document établi par {orgDisplayName}
          </span>
          <span style={{ fontSize: "7.5pt", color: "#9ca3af" }}>
            {new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
          </span>
        </footer>
      </div>
    </>
  );
}
