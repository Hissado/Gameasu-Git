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

  const { data: qrData } = useQuery<{ token: string | null }>({
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
      setTimeout(() => window.print(), 800);
    }
  }, [collab, isLoading]);

  if (isLoading || !collab) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-500">
        Chargement du badge…
      </div>
    );
  }

  const c = collab.collaborator ?? collab;
  const position = overviewData?.position?.title ?? c.position ?? "";
  const department = overviewData?.department?.name ?? "";
  const employeeNumber = c.employeeNumber ?? "";
  const qrToken = qrData?.token;

  const initials = `${(c.firstName ?? "")[0] ?? ""}${(c.lastName ?? "")[0] ?? ""}`.toUpperCase();

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body { margin: 0; padding: 0; background: white; }
          .no-print { display: none !important; }
          .badge-card { page-break-inside: avoid; }
          @page { size: 85.6mm 54mm landscape; margin: 0; }
        }
        @media screen {
          body { background: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        }
      `}</style>

      {/* Screen-only header */}
      <div className="no-print fixed top-4 left-1/2 -translate-x-1/2 z-50 flex gap-3">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium shadow hover:bg-blue-700 transition-colors"
        >
          🖨 Imprimer le badge
        </button>
        <button
          onClick={() => window.close()}
          className="px-4 py-2 bg-slate-600 text-white rounded-lg text-sm font-medium shadow hover:bg-slate-700 transition-colors"
        >
          ✕ Fermer
        </button>
      </div>

      {/* Badge card — 85.6mm × 54mm (landscape) */}
      <div
        className="badge-card"
        style={{
          width: "85.6mm",
          height: "54mm",
          background: "linear-gradient(135deg, #0F1A3A 0%, #1e3a6e 100%)",
          borderRadius: "3mm",
          overflow: "hidden",
          display: "flex",
          flexDirection: "row",
          fontFamily: "Inter, Arial, sans-serif",
          boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
          position: "relative",
        }}
      >
        {/* Left strip */}
        <div style={{
          width: "8mm",
          background: "#2563EB",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <div style={{
            color: "rgba(255,255,255,0.4)",
            fontSize: "5px",
            fontWeight: "bold",
            letterSpacing: "1px",
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            textTransform: "uppercase",
          }}>
            GAMEASU
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "row", padding: "4mm 3mm", gap: "3mm", alignItems: "center" }}>

          {/* Avatar */}
          <div style={{ flexShrink: 0 }}>
            <div style={{
              width: "18mm",
              height: "18mm",
              borderRadius: "50%",
              overflow: "hidden",
              border: "1.5px solid rgba(255,255,255,0.3)",
              background: "#2563EB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              {c.avatarUrl ? (
                <img src={c.avatarUrl} alt={initials} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ color: "white", fontWeight: "bold", fontSize: "7mm" }}>{initials}</span>
              )}
            </div>
          </div>

          {/* Identity */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "5mm", fontWeight: "700", color: "white", lineHeight: 1.1, marginBottom: "1mm" }}>
              {c.firstName} {c.lastName}
            </div>
            {position && (
              <div style={{ fontSize: "3mm", color: "rgba(255,255,255,0.7)", marginBottom: "0.5mm", fontWeight: "500" }}>
                {position}
              </div>
            )}
            {department && (
              <div style={{ fontSize: "2.5mm", color: "rgba(255,255,255,0.45)", marginBottom: "1.5mm" }}>
                {department}
              </div>
            )}
            {employeeNumber && (
              <div style={{
                display: "inline-block",
                background: "rgba(37,99,235,0.3)",
                border: "0.5px solid rgba(37,99,235,0.6)",
                borderRadius: "1mm",
                padding: "0.5mm 1.5mm",
                fontSize: "2.5mm",
                color: "#93c5fd",
                fontFamily: "monospace",
                fontWeight: "600",
                letterSpacing: "0.5px",
                marginBottom: "1.5mm",
              }}>
                {employeeNumber}
              </div>
            )}
            {/* Org name small */}
            <div style={{ fontSize: "2mm", color: "rgba(255,255,255,0.3)", marginTop: "1mm", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              GAMEASU ERP
            </div>
          </div>

          {/* QR code */}
          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "1mm" }}>
            <div style={{
              background: "white",
              padding: "2mm",
              borderRadius: "1.5mm",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              {qrToken ? (
                <QRCodeSVG
                  value={qrToken}
                  size={100}
                  level="M"
                  marginSize={0}
                />
              ) : (
                <div style={{ width: 100, height: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", borderRadius: "1mm" }}>
                  <span style={{ fontSize: "6mm", color: "#94a3b8" }}>—</span>
                </div>
              )}
            </div>
            <div style={{ fontSize: "1.8mm", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.3px" }}>
              {qrToken ? "Pointage QR" : "Sans QR"}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          position: "absolute",
          bottom: 0,
          left: "8mm",
          right: 0,
          height: "3.5mm",
          background: "rgba(37,99,235,0.15)",
          borderTop: "0.5px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          paddingLeft: "2mm",
        }}>
          <div style={{ fontSize: "1.8mm", color: "rgba(255,255,255,0.2)", letterSpacing: "0.5px" }}>
            gameasu.africa · Confidentiel
          </div>
        </div>
      </div>
    </>
  );
}
