import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { QRCodeSVG } from "qrcode.react";
import { useEffect } from "react";

export default function CollaboratorBadgePrint() {
  const [, params] = useRoute("/collaborators/:id/badge");
  const collaboratorId = params?.id ?? "";

  const { data: collab, isLoading } = useQuery<any>({
    queryKey: ["badge-collab", collaboratorId],
    queryFn: () => apiFetch(`/api/collaborators/${collaboratorId}`),
    enabled: !!collaboratorId,
  });

  const { data: qrData } = useQuery<{
    token: string | null;
    status: string | null;
    createdAt: string | null;
  }>({
    queryKey: ["collab-qr-token", collaboratorId],
    queryFn: () => apiFetch(`/api/collaborators/${collaboratorId}/qr-token`),
    enabled: !!collaboratorId,
  });

  const { data: overviewData } = useQuery<any>({
    queryKey: ["hr-overview-badge", collaboratorId],
    queryFn: () => apiFetch(`/api/hr/overview/${collaboratorId}`),
    enabled: !!collaboratorId,
  });

  useEffect(() => {
    if (collab && !isLoading) {
      setTimeout(() => window.print(), 900);
    }
  }, [collab, isLoading]);

  if (isLoading || !collab) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "#64748b", fontFamily: "Arial, sans-serif" }}>
        Chargement du badge…
      </div>
    );
  }

  const c = collab.collaborator ?? collab;
  const position = overviewData?.position?.title ?? c.position ?? "";
  const department = overviewData?.department?.name ?? "";
  const employeeNumber = c.employeeNumber ?? "";
  const orgName = overviewData?.organization?.name ?? "GAMEASU";
  const qrToken = qrData?.token;
  const qrStatus = qrData?.status;

  const initials = `${(c.firstName ?? "")[0] ?? ""}${(c.lastName ?? "")[0] ?? ""}`.toUpperCase();

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: white; }
        @media screen {
          body { background: #f1f5f9; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 20px; gap: 16px; }
          .no-print { display: flex; }
        }
        @media print {
          body { background: white; margin: 0; }
          .no-print { display: none !important; }
          @page { size: A6 portrait; margin: 8mm; }
        }
      `}</style>

      {/* Screen-only toolbar */}
      <div className="no-print" style={{ gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => window.print()}
          style={{ padding: "8px 16px", background: "#2563EB", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          🖨 Imprimer (A6)
        </button>
        <button
          onClick={() => window.close()}
          style={{ padding: "8px 16px", background: "#475569", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", marginLeft: 8 }}
        >
          ✕ Fermer
        </button>
      </div>

      {/* A6 Badge — 105mm × 148mm portrait */}
      <div style={{
        width: "105mm",
        minHeight: "148mm",
        background: "white",
        border: "1px solid #e2e8f0",
        borderRadius: 4,
        overflow: "hidden",
        fontFamily: "Inter, Arial, sans-serif",
        boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Header band */}
        <div style={{
          background: "linear-gradient(135deg, #0F1A3A 0%, #1e3a6e 100%)",
          padding: "10mm 8mm 8mm",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "4mm",
        }}>
          {/* Org name */}
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "7pt", fontWeight: "bold", letterSpacing: "3px", textTransform: "uppercase" }}>
            {orgName}
          </div>

          {/* Avatar */}
          <div style={{
            width: "28mm",
            height: "28mm",
            borderRadius: "50%",
            overflow: "hidden",
            border: "2px solid rgba(255,255,255,0.35)",
            background: "#2563EB",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            {c.avatarUrl ? (
              <img src={c.avatarUrl} alt={initials} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ color: "white", fontWeight: "bold", fontSize: "13pt" }}>{initials}</span>
            )}
          </div>

          {/* Name */}
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "white", fontSize: "12pt", fontWeight: "700", lineHeight: 1.2 }}>
              {c.firstName} {c.lastName}
            </div>
            {position && (
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "8pt", marginTop: "1.5mm", fontWeight: "500" }}>
                {position}
              </div>
            )}
            {department && (
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "7pt", marginTop: "0.5mm" }}>
                {department}
              </div>
            )}
          </div>

          {/* Employee number */}
          {employeeNumber && (
            <div style={{
              background: "rgba(37,99,235,0.35)",
              border: "0.5px solid rgba(37,99,235,0.7)",
              borderRadius: "3px",
              padding: "1.5mm 4mm",
              color: "#93c5fd",
              fontSize: "7pt",
              fontFamily: "monospace",
              fontWeight: "600",
              letterSpacing: "1px",
            }}>
              {employeeNumber}
            </div>
          )}
        </div>

        {/* QR section */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "8mm",
          gap: "4mm",
          background: "white",
        }}>
          {qrToken && qrStatus === "active" ? (
            <>
              <div style={{
                padding: "4mm",
                border: "1px solid #e2e8f0",
                borderRadius: "4mm",
                background: "white",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}>
                <QRCodeSVG value={qrToken} size={150} level="M" marginSize={0} />
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "8pt", color: "#475569", fontWeight: "600" }}>Pointage par QR code</div>
                <div style={{ fontSize: "6pt", color: "#94a3b8", marginTop: "1mm" }}>Présentez ce code au kiosque de présence</div>
              </div>
            </>
          ) : qrToken && qrStatus === "disabled" ? (
            <div style={{ textAlign: "center", padding: "8mm" }}>
              <div style={{ fontSize: "20pt", marginBottom: "3mm" }}>⏸</div>
              <div style={{ fontSize: "8pt", color: "#92400e", fontWeight: "600" }}>Badge temporairement désactivé</div>
              <div style={{ fontSize: "6pt", color: "#b45309", marginTop: "1mm" }}>Contactez votre administrateur</div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "8mm" }}>
              <div style={{ fontSize: "20pt", marginBottom: "3mm" }}>📋</div>
              <div style={{ fontSize: "8pt", color: "#64748b", fontWeight: "600" }}>Badge de pointage</div>
              <div style={{ fontSize: "6pt", color: "#94a3b8", marginTop: "1mm" }}>Utilisez votre code PIN au kiosque</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          background: "#0F1A3A",
          height: "7mm",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 5mm",
        }}>
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "5pt", textTransform: "uppercase", letterSpacing: "1px" }}>
            GAMEASU ERP · Confidentiel
          </div>
          <div style={{
            width: "10mm",
            height: "2mm",
            background: "#2563EB",
            borderRadius: "1mm",
          }} />
        </div>
      </div>
    </>
  );
}
