import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { QRCodeSVG } from "qrcode.react";
import { useRef, useState } from "react";
import { toPng } from "html-to-image";

export default function CollaboratorBadgePrint() {
  const [, params] = useRoute("/collaborators/:id/badge");
  const collaboratorId = params?.id ?? "";
  const badgeRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

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
    queryKey: ["hr-collab-overview-badge", collaboratorId],
    queryFn: () => apiFetch(`/api/hr/collaborators/${collaboratorId}/overview`),
    enabled: !!collaboratorId,
  });

  const handleDownload = async () => {
    if (!badgeRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(badgeRef.current, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: "white",
      });
      const link = document.createElement("a");
      const name = `${c?.firstName ?? "badge"}-${c?.lastName ?? ""}`.toLowerCase().replace(/\s+/g, "-");
      link.download = `badge-${name}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Erreur téléchargement badge:", err);
    } finally {
      setDownloading(false);
    }
  };

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
  const kioskCode = c.kioskCode ?? null;
  const orgName = overviewData?.organization?.name ?? overviewData?.organization?.legalName ?? "—";
  const orgLogoUrl = overviewData?.organization?.logoUrl ?? null;
  const qrToken = qrData?.token;
  const qrStatus = qrData?.status;
  const initials = `${(c.firstName ?? "")[0] ?? ""}${(c.lastName ?? "")[0] ?? ""}`.toUpperCase();

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #f1f5f9; }
        @media screen {
          body { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 24px; gap: 16px; }
          .toolbar { display: flex; gap: 10px; margin-bottom: 8px; }
        }
        @media print {
          body { background: white; margin: 0; }
          .toolbar { display: none !important; }
          @page { size: A6 portrait; margin: 6mm; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="toolbar">
        <button
          onClick={handleDownload}
          disabled={downloading}
          style={{
            padding: "10px 22px",
            background: downloading ? "#94a3b8" : "#2563EB",
            color: "white",
            border: "none",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            cursor: downloading ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
            transition: "background 0.2s",
          }}
        >
          {downloading ? "⏳ Génération…" : "⬇ Télécharger le badge (PNG)"}
        </button>
        <button
          onClick={() => window.print()}
          style={{
            padding: "10px 18px",
            background: "#475569",
            color: "white",
            border: "none",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          🖨 Imprimer
        </button>
        <button
          onClick={() => window.close()}
          style={{
            padding: "10px 14px",
            background: "#e2e8f0",
            color: "#475569",
            border: "none",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>

      {/* Badge card — captured for download */}
      <div
        ref={badgeRef}
        style={{
          width: "320px",
          background: "white",
          borderRadius: 16,
          overflow: "hidden",
          fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
        }}
      >
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #0F1A3A 0%, #1e3a6e 100%)",
          padding: "24px 20px 20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}>
          {/* Org identity */}
          {orgLogoUrl ? (
            <img
              src={orgLogoUrl}
              alt={orgName}
              style={{ height: 28, maxWidth: 140, objectFit: "contain", filter: "brightness(0) invert(1)", marginBottom: 2 }}
              crossOrigin="anonymous"
            />
          ) : (
            <div style={{
              color: "rgba(255,255,255,0.7)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 4,
              textTransform: "uppercase",
              marginBottom: 2,
            }}>
              {orgName}
            </div>
          )}

          {/* Avatar */}
          <div style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            overflow: "hidden",
            border: "3px solid rgba(255,255,255,0.3)",
            background: "#1d4ed8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            {c.avatarUrl ? (
              <img src={c.avatarUrl} alt={initials} style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="anonymous" />
            ) : (
              <span style={{ color: "white", fontWeight: 800, fontSize: 28 }}>{initials}</span>
            )}
          </div>

          {/* Name & role */}
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "white", fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>
              {c.firstName} {c.lastName}
            </div>
            {position && (
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 4, fontWeight: 500 }}>
                {position}
              </div>
            )}
            {department && (
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2 }}>
                {department}
              </div>
            )}
          </div>

          {/* Kiosk code pill */}
          {kioskCode && (
            <div style={{
              background: "rgba(37,99,235,0.35)",
              border: "1px solid rgba(99,149,255,0.5)",
              borderRadius: 8,
              padding: "5px 14px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 2,
            }}>
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, textTransform: "uppercase", letterSpacing: 2 }}>
                Code kiosque
              </span>
              <span style={{ color: "#93c5fd", fontSize: 15, fontFamily: "'Courier New', monospace", fontWeight: 800, letterSpacing: 4 }}>
                {kioskCode}
              </span>
            </div>
          )}
        </div>

        {/* QR / body */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "20px 20px 16px",
          gap: 10,
          background: "white",
        }}>
          {qrToken && qrStatus === "active" ? (
            <>
              <div style={{
                padding: 10,
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                background: "white",
                boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
              }}>
                <QRCodeSVG value={qrToken} size={160} level="M" marginSize={0} />
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "#334155", fontWeight: 700 }}>Pointage par QR code</div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3 }}>Présentez ce code au kiosque de présence</div>
              </div>
            </>
          ) : qrToken && qrStatus === "disabled" ? (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>⏸</div>
              <div style={{ fontSize: 12, color: "#92400e", fontWeight: 700 }}>Badge temporairement désactivé</div>
              <div style={{ fontSize: 10, color: "#b45309", marginTop: 4 }}>Contactez votre administrateur</div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>Badge de pointage</div>
              {kioskCode && (
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>
                  Code PIN : <strong>{kioskCode}</strong>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          background: "#0F1A3A",
          height: 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
        }}>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 8, textTransform: "uppercase", letterSpacing: 2 }}>
            {orgName} · Confidentiel
          </div>
          <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 8 }}>
            Gameasu ERP
          </div>
        </div>
      </div>

      {/* Download tip */}
      <div style={{ color: "#94a3b8", fontSize: 12, textAlign: "center", marginTop: 4 }}>
        Téléchargez le badge en PNG pour l'enregistrer sur votre téléphone ou l'imprimer.
      </div>
    </>
  );
}
