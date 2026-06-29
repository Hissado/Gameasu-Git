import { useState, useEffect, useRef, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

// ─── Types ──────────────────────────────────────────────────────
interface CollaboratorInfo {
  id: string;
  firstName: string;
  lastName: string;
  position: string | null;
  department: string | null;
  avatarUrl: string | null;
}

interface AttendanceSettings {
  requireGps: boolean;
  requirePhoto: boolean;
  trackByProject: boolean;
  trackBySite: boolean;
  lateThresholdMinutes: number;
  expectedDailyMinutes: number;
  sector: string;
}

interface KioskInfo {
  id: string;
  name: string;
  location: string | null;
  organizationId: string;
  settings: {
    photoEnabled?: boolean;
    requirePhoto?: boolean;
    orgName?: string | null;
    orgLogoUrl?: string | null;
    welcomeMessage?: string | null;
  };
  attendanceSettings?: AttendanceSettings;
}

type Screen = "idle" | "keypad" | "qr_scan" | "identified" | "site" | "photo" | "confirm" | "error";
type PunchKind = "clock_in" | "clock_out" | "break_start" | "break_end";
type PunchSource = "kiosk" | "qr";

const PUNCH_LABELS: Record<PunchKind, { label: string; sub: string; color: string; bg: string; icon: string }> = {
  clock_in:    { label: "Entrée",       sub: "Début de journée",  color: "text-emerald-300", bg: "bg-emerald-500/20 border-emerald-500/40 hover:bg-emerald-500/30", icon: "▶" },
  clock_out:   { label: "Sortie",       sub: "Fin de journée",    color: "text-red-300",     bg: "bg-red-500/20 border-red-500/40 hover:bg-red-500/30",             icon: "◼" },
  break_start: { label: "Pause",        sub: "Début de pause",    color: "text-amber-300",   bg: "bg-amber-500/20 border-amber-500/40 hover:bg-amber-500/30",       icon: "⏸" },
  break_end:   { label: "Fin de pause", sub: "Retour au travail", color: "text-sky-300",     bg: "bg-sky-500/20 border-sky-500/40 hover:bg-sky-500/30",             icon: "⏩" },
};

// ─── Clock ───────────────────────────────────────────────────────
function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const time = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const date = now.toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  return (
    <div className="text-center">
      <div className="text-7xl font-thin tracking-widest text-white tabular-nums">{time}</div>
      <div className="text-base text-white/50 mt-2 capitalize">{date}</div>
    </div>
  );
}

// ─── Site Selection Screen (trackBySite) ─────────────────────────
function SiteScreen({ onSelect, onCancel }: { onSelect: (site: string) => void; onCancel: () => void }) {
  const [site, setSite] = useState("");
  const SITES = ["Siège / Bureau", "Chantier Nord", "Chantier Sud", "Entrepôt", "Site client", "Autre"];
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-8">
      <div className="text-center">
        <div className="text-2xl font-semibold text-white mb-1">Sélection du site</div>
        <div className="text-sm text-white/50">Sur quel site travaillez-vous aujourd'hui ?</div>
      </div>
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        {SITES.map(s => (
          <button key={s}
            onClick={() => onSelect(s)}
            className="py-3 px-4 rounded-xl bg-white/10 border border-white/20 text-white text-sm font-medium hover:bg-blue-500/20 hover:border-blue-400/40 transition-all text-left"
          >
            {s}
          </button>
        ))}
      </div>
      <div className="w-full max-w-sm">
        <input
          value={site}
          onChange={e => setSite(e.target.value)}
          placeholder="Ou saisissez le nom du site…"
          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-blue-400/60"
          onKeyDown={e => e.key === "Enter" && site.trim() && onSelect(site.trim())}
        />
        <div className="flex gap-2 mt-3">
          {site.trim() && (
            <button onClick={() => onSelect(site.trim())}
              className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-500 transition-all text-sm">
              Confirmer
            </button>
          )}
          <button onClick={onCancel}
            className="flex-1 py-3 bg-white/10 border border-white/20 text-white/60 font-medium rounded-xl hover:bg-white/20 transition-all text-sm">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Idle Screen ─────────────────────────────────────────────────
function IdleScreen({
  kiosk,
  onPinCode,
  onQrScan,
}: {
  kiosk: KioskInfo | null;
  onPinCode: () => void;
  onQrScan: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-between h-full py-16 px-8 select-none">
      <div className="flex flex-col items-center gap-3">
        <div className="text-3xl font-bold tracking-widest text-white uppercase">
          {kiosk?.settings?.orgName ?? "Gameasu"}
        </div>
        <div className="text-sm text-white/40 uppercase tracking-widest">
          {kiosk?.name ?? "Kiosque de Pointage"}
          {kiosk?.location ? ` — ${kiosk.location}` : ""}
        </div>
      </div>

      <div className="flex flex-col items-center gap-8">
        <Clock />
        <div className="flex flex-col items-center gap-6 mt-4">
          <div className="text-lg text-white/60">
            {kiosk?.settings?.welcomeMessage ?? "Comment souhaitez-vous pointer ?"}
          </div>
          {/* QR primary button */}
          <button
            onClick={onQrScan}
            className="flex flex-col items-center justify-center gap-3 w-72 h-48 rounded-3xl bg-blue-600/40 border-2 border-blue-400/60 hover:bg-blue-600/55 active:scale-95 transition-all shadow-lg shadow-blue-500/20"
          >
            <span className="text-6xl">📷</span>
            <span className="text-blue-100 font-bold text-2xl">Scanner mon badge QR</span>
            <span className="text-blue-300/60 text-sm">Présentez votre badge devant la caméra</span>
          </button>
          {/* PIN fallback — smaller */}
          <button
            onClick={onPinCode}
            className="flex items-center justify-center gap-2.5 w-72 h-14 rounded-2xl bg-white/8 border border-white/15 hover:bg-white/12 active:scale-95 transition-all"
          >
            <span className="text-xl">🔢</span>
            <span className="text-white/60 font-medium text-base">Entrer mon code kiosk</span>
          </button>
        </div>
      </div>

      <div className="text-xs text-white/20 tracking-widest uppercase">Gameasu ERP © 2026</div>
    </div>
  );
}

// ─── Keypad Screen ───────────────────────────────────────────────
function KeypadScreen({
  onIdentify,
  onCancel,
  loading,
  error,
}: {
  onIdentify: (code: string) => void;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
}) {
  const [digits, setDigits] = useState<string[]>([]);

  const push = (d: string) => {
    if (digits.length < 4) {
      const next = [...digits, d];
      setDigits(next);
      if (next.length === 4) {
        onIdentify(next.join(""));
      }
    }
  };

  const pop = () => setDigits((prev) => prev.slice(0, -1));

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"];

  return (
    <div className="flex flex-col items-center justify-center h-full gap-10 px-8">
      <div className="text-2xl font-medium text-white/70">Entrez votre code</div>

      {/* Dots */}
      <div className="flex gap-5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-6 h-6 rounded-full border-2 transition-all duration-200 ${
              i < digits.length
                ? "bg-blue-500 border-blue-500 scale-110"
                : "bg-transparent border-white/30"
            }`}
          />
        ))}
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/40 rounded-xl px-6 py-3 text-red-300 text-center max-w-xs">
          {error}
        </div>
      )}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
        {keys.map((k) => {
          const isBackspace = k === "⌫";
          const isConfirm = k === "✓";
          return (
            <button
              key={k}
              onClick={() => {
                if (isBackspace) pop();
                else if (isConfirm) { if (digits.length === 4) onIdentify(digits.join("")); }
                else push(k);
              }}
              disabled={loading}
              className={`h-20 rounded-2xl text-2xl font-medium transition-all active:scale-95 border disabled:opacity-40
                ${isBackspace ? "bg-white/5 border-white/10 text-white/60 hover:bg-white/10" :
                  isConfirm ? "bg-blue-600/20 border-blue-500/40 text-blue-300 hover:bg-blue-600/30" :
                  "bg-white/8 border-white/12 text-white hover:bg-white/15 active:bg-white/20"
                }
              `}
            >
              {loading && isConfirm ? (
                <span className="animate-spin inline-block">⟳</span>
              ) : k}
            </button>
          );
        })}
      </div>

      <button onClick={onCancel} className="text-white/30 hover:text-white/60 text-sm transition-colors">
        ← Annuler
      </button>
    </div>
  );
}

// ─── QR Scan Screen ───────────────────────────────────────────────
function QrScanScreen({
  onScan,
  onCancel,
  loading,
  error,
}: {
  onScan: (token: string) => void;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
}) {
  const [cameraStatus, setCameraStatus] = useState<"starting" | "scanning" | "error">("starting");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<any>(null);
  const scannedRef = useRef(false);
  const QR_DIV_ID = "qr-scan-video";

  useEffect(() => {
    scannedRef.current = false;
    let qrInstance: any;

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      qrInstance = new Html5Qrcode(QR_DIV_ID, { verbose: false });
      scannerRef.current = qrInstance;

      qrInstance.start(
        { facingMode: "user" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        (decodedText: string) => {
          if (scannedRef.current) return;
          scannedRef.current = true;
          qrInstance.stop().catch(() => {});
          onScan(decodedText.trim());
        },
        () => {},
      )
        .then(() => setCameraStatus("scanning"))
        .catch((err: any) => {
          setCameraStatus("error");
          setCameraError(err?.message ?? "Caméra inaccessible. Vérifiez les autorisations.");
        });
    }).catch(() => {
      setCameraStatus("error");
      setCameraError("Impossible de charger le lecteur QR.");
    });

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [onScan]);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 px-6 select-none">
      <style>{`
        @keyframes scan-line { 0%,100%{top:12%} 50%{top:82%} }
        @keyframes corner-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .scan-corner { animation: corner-pulse 2s ease-in-out infinite; }
        .scan-line-anim { animation: scan-line 2.4s ease-in-out infinite; }
      `}</style>

      <div className="text-center">
        <div className="text-3xl font-bold text-white mb-1">📱 Scannez votre badge</div>
        <div className="text-base text-white/50">Présentez le QR code devant la caméra</div>
      </div>

      {cameraStatus === "error" ? (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500/40 flex items-center justify-center text-4xl">📷</div>
          <div className="text-red-400 font-semibold text-xl">Caméra inaccessible</div>
          <div className="text-white/50 text-sm max-w-xs text-center">{cameraError}</div>
          <div className="mt-2 px-5 py-3 bg-white/10 border border-white/20 rounded-xl text-white/50 text-sm text-center max-w-xs">
            Utilisez l'option <strong className="text-white/70">Code PIN</strong> comme alternative
          </div>
        </div>
      ) : (
        <div className="relative w-full max-w-sm">
          {/* Scanner container */}
          <div
            id={QR_DIV_ID}
            className="w-full rounded-2xl overflow-hidden bg-black"
            style={{ minHeight: 320 }}
          />

          {/* Animated corner frame overlay */}
          {cameraStatus === "scanning" && !loading && (
            <div className="absolute inset-0 pointer-events-none" style={{ borderRadius: 16 }}>
              {/* Top-left */}
              <div className="scan-corner absolute" style={{ top: "calc(50% - 100px)", left: "calc(50% - 100px)", width: 36, height: 36, borderTop: "4px solid #60a5fa", borderLeft: "4px solid #60a5fa", borderRadius: "6px 0 0 0" }} />
              {/* Top-right */}
              <div className="scan-corner absolute" style={{ top: "calc(50% - 100px)", right: "calc(50% - 100px)", width: 36, height: 36, borderTop: "4px solid #60a5fa", borderRight: "4px solid #60a5fa", borderRadius: "0 6px 0 0" }} />
              {/* Bottom-left */}
              <div className="scan-corner absolute" style={{ bottom: "calc(50% - 100px)", left: "calc(50% - 100px)", width: 36, height: 36, borderBottom: "4px solid #60a5fa", borderLeft: "4px solid #60a5fa", borderRadius: "0 0 0 6px" }} />
              {/* Bottom-right */}
              <div className="scan-corner absolute" style={{ bottom: "calc(50% - 100px)", right: "calc(50% - 100px)", width: 36, height: 36, borderBottom: "4px solid #60a5fa", borderRight: "4px solid #60a5fa", borderRadius: "0 0 6px 0" }} />
              {/* Scanning line */}
              <div className="scan-line-anim absolute left-1/2 -translate-x-1/2" style={{ width: 180, height: 2, background: "linear-gradient(90deg, transparent, #60a5fa, transparent)", borderRadius: 2 }} />
            </div>
          )}

          {cameraStatus === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-2xl">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <div className="text-white/60 text-sm">Activation de la caméra…</div>
              </div>
            </div>
          )}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90 rounded-2xl">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <div className="text-white/70 text-base font-medium">Identification…</div>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-500/20 border border-red-500/40 rounded-xl px-6 py-4 text-red-300 text-center max-w-sm text-base font-medium">
          {error}
        </div>
      )}

      <button onClick={onCancel} className="mt-2 px-6 py-3 bg-white/8 border border-white/15 rounded-xl text-white/40 hover:text-white/70 text-sm transition-colors">
        ← Retour à l'accueil
      </button>
    </div>
  );
}

// ─── Action Screen ───────────────────────────────────────────────
function ActionScreen({
  collaborator,
  onAction,
  onCancel,
  source,
}: {
  collaborator: CollaboratorInfo;
  onAction: (kind: PunchKind) => void;
  onCancel: () => void;
  source: PunchSource;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-8">
      {/* Collaborator card */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div className="w-24 h-24 rounded-full border-2 border-blue-400/60 overflow-hidden bg-white/10 flex items-center justify-center">
            {collaborator.avatarUrl ? (
              <img src={collaborator.avatarUrl} alt={collaborator.firstName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl font-bold text-blue-400">
                {collaborator.firstName[0]}{collaborator.lastName[0]}
              </span>
            )}
          </div>
          {source === "qr" && (
            <div className="absolute -bottom-1 -right-1 bg-blue-600 rounded-full p-1 border-2 border-slate-900">
              <span className="text-[10px]">QR</span>
            </div>
          )}
        </div>
        <div className="text-center">
          <div className="text-3xl font-semibold text-white">
            {collaborator.firstName} {collaborator.lastName}
          </div>
          {collaborator.position && (
            <div className="text-base text-white/60 mt-1">{collaborator.position}</div>
          )}
          {collaborator.department && (
            <div className="text-sm text-white/35 mt-0.5">{collaborator.department}</div>
          )}
        </div>
      </div>

      <div className="text-sm text-white/40">Sélectionnez votre action</div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-lg">
        {(Object.entries(PUNCH_LABELS) as [PunchKind, typeof PUNCH_LABELS[PunchKind]][]).map(([kind, meta]) => (
          <button
            key={kind}
            onClick={() => onAction(kind)}
            className={`flex flex-col items-center justify-center gap-2 h-32 rounded-2xl border-2 transition-all active:scale-95 ${meta.bg}`}
          >
            <span className="text-3xl">{meta.icon}</span>
            <span className={`text-xl font-semibold ${meta.color}`}>{meta.label}</span>
            <span className="text-xs text-white/40">{meta.sub}</span>
          </button>
        ))}
      </div>

      <button onClick={onCancel} className="text-white/30 hover:text-white/60 text-sm transition-colors">
        ← Retour
      </button>
    </div>
  );
}

// ─── Photo Screen ─────────────────────────────────────────────────
function PhotoScreen({
  onCapture,
  onSkip,
  requirePhoto = false,
}: {
  onCapture: (dataUrl: string) => void;
  onSkip: () => void;
  requirePhoto?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const capturedRef = useRef(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    const handleSkipOrError = (reason: string) => {
      if (requirePhoto) {
        setCameraError(reason);
      } else {
        onSkip();
      }
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } })
      .then((stream) => {
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) { stream.getTracks().forEach((t) => t.stop()); handleSkipOrError("Erreur d'accès à la caméra."); return; }
        video.srcObject = stream;
        video.oncanplay = () => {
          if (capturedRef.current) return;
          capturedRef.current = true;
          video.play();
          setTimeout(() => {
            const canvas = canvasRef.current;
            if (!canvas) { handleSkipOrError("Erreur de canvas."); return; }
            const ctx = canvas.getContext("2d");
            if (!ctx) { handleSkipOrError("Erreur de contexte."); return; }
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            ctx.drawImage(video, 0, 0);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
            stream.getTracks().forEach((t) => t.stop());
            onCapture(dataUrl);
          }, 1500);
        };
      })
      .catch(() => handleSkipOrError("Accès à la caméra refusé."));

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onCapture, onSkip, requirePhoto]);

  if (cameraError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5 px-8 text-center">
        <div className="text-5xl">📷</div>
        <div className="text-lg font-semibold text-red-400">Caméra requise</div>
        <div className="text-sm text-white/60 max-w-sm">{cameraError}</div>
        <div className="text-xs text-white/30">La photo est obligatoire pour ce site. Contactez votre administrateur.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-8">
      <div className="text-xl text-white/70">Photo de présence</div>
      <div className="text-sm text-white/40">Capture en cours…</div>
      <div className="rounded-2xl overflow-hidden border border-white/20 bg-black w-full max-w-sm aspect-video flex items-center justify-center">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

// ─── Confirm Screen ───────────────────────────────────────────────
function ConfirmScreen({
  collaborator,
  kind,
  onDone,
}: {
  collaborator: CollaboratorInfo;
  kind: PunchKind;
  onDone: () => void;
}) {
  const meta = PUNCH_LABELS[kind];
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    const done = setTimeout(onDone, 5000);
    return () => { clearInterval(t); clearTimeout(done); };
  }, [onDone]);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8">
      <div className="w-28 h-28 rounded-full bg-emerald-500/20 border-2 border-emerald-500/60 flex items-center justify-center animate-bounce">
        <span className="text-5xl">✓</span>
      </div>
      <div className="text-center">
        <div className="text-3xl font-semibold text-white">Pointage enregistré</div>
        <div className={`text-xl mt-2 ${meta.color}`}>{meta.label}</div>
        <div className="text-base text-white/50 mt-1">
          {collaborator.firstName} {collaborator.lastName}
        </div>
      </div>
      <div className="text-sm text-white/30">
        Retour automatique dans {countdown}s
      </div>
      <button onClick={onDone} className="px-6 py-3 bg-white/10 border border-white/20 text-white/60 rounded-xl hover:bg-white/15 transition-all">
        Terminer maintenant
      </button>
    </div>
  );
}

// ─── Error Screen ─────────────────────────────────────────────────
function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6">
      <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500/60 flex items-center justify-center">
        <span className="text-4xl">✕</span>
      </div>
      <div className="text-xl text-white/80 text-center max-w-sm">{message}</div>
      <button
        onClick={onRetry}
        className="px-8 py-4 bg-blue-600 text-white font-semibold text-lg rounded-xl hover:bg-blue-500 active:scale-95 transition-all"
      >
        Réessayer
      </button>
    </div>
  );
}

// ─── Token Setup Screen ───────────────────────────────────────────
function SetupScreen({ onSetup, tokenError }: { onSetup: (token: string) => void; tokenError?: string | null }) {
  const [input, setInput] = useState("");
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-8">
      <div className="text-2xl font-bold text-blue-400">Configuration du kiosk</div>
      <div className="text-white/50 text-center max-w-sm">
        Entrez le token du kiosk (visible dans la page d'administration Gameasu)
      </div>
      {tokenError && (
        <div className="bg-red-500/20 border border-red-500/40 rounded-xl px-6 py-3 text-red-300 text-center max-w-sm text-sm">
          {tokenError}
        </div>
      )}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        className="w-full max-w-md px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-center font-mono text-sm focus:outline-none focus:border-blue-400/60"
      />
      <button
        onClick={() => { if (input.trim()) onSetup(input.trim()); }}
        disabled={!input.trim()}
        className="px-8 py-4 bg-blue-600 disabled:opacity-40 text-white font-semibold rounded-xl hover:bg-blue-500 transition-all"
      >
        Activer le kiosk
      </button>
      <div className="text-xs text-white/20">
        Ou utilisez l'URL : <code className="text-white/40">/kiosk/?token=UUID</code>
      </div>
    </div>
  );
}

// ─── Main Kiosk App ───────────────────────────────────────────────
function KioskApp() {
  const [kioskToken, setKioskToken] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken) {
      localStorage.setItem("kiosk_token", urlToken);
      return urlToken;
    }
    return localStorage.getItem("kiosk_token");
  });

  const [kiosk, setKiosk] = useState<KioskInfo | null>(null);
  const [tokenValidating, setTokenValidating] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("idle");
  const [collaborator, setCollaborator] = useState<CollaboratorInfo | null>(null);
  const [selectedKind, setSelectedKind] = useState<PunchKind | null>(null);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [punchSource, setPunchSource] = useState<PunchSource>("kiosk");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const gpsRef = useRef<{ latitude: number; longitude: number; accuracyMeters: number } | null>(null);

  // Validate the kiosk token at startup and fetch kiosk info
  useEffect(() => {
    if (!kioskToken) return;
    setTokenValidating(true);
    setTokenError(null);
    fetch(`/api/kiosk/validate/${encodeURIComponent(kioskToken)}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const msg = data?.error ?? "Token invalide ou kiosk désactivé";
          setTokenError(msg);
          localStorage.removeItem("kiosk_token");
          setKioskToken(null);
          return;
        }
        const data = await res.json();
        setKiosk({
          id: data.id,
          name: data.name,
          location: data.location ?? null,
          organizationId: data.organizationId,
          settings: data.settings ?? {},
          attendanceSettings: data.attendanceSettings ?? undefined,
        });
      })
      .catch(() => {
        setTokenError("Erreur de connexion au serveur");
      })
      .finally(() => setTokenValidating(false));
  }, [kioskToken]);

  // Pre-warm camera permission
  useEffect(() => {
    if (!kioskToken) return;
    navigator.mediaDevices
      ?.getUserMedia({ video: true })
      .then((stream) => stream.getTracks().forEach((t) => t.stop()))
      .catch(() => {});
  }, [kioskToken]);

  const handleSetupToken = (token: string) => {
    localStorage.setItem("kiosk_token", token);
    setKioskToken(token);
  };

  const handleIdentify = useCallback(async (code: string) => {
    if (!kioskToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/kiosk/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, kioskToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur");
        setLoading(false);
        return;
      }
      setCollaborator(data.collaborator);
      setPunchSource("kiosk");
      setKiosk(prev => ({
        ...(data.kiosk ?? {}),
        attendanceSettings: prev?.attendanceSettings ?? data.kiosk?.attendanceSettings,
      }));
      setScreen("identified");
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }, [kioskToken]);

  const handleScanQr = useCallback(async (qrToken: string) => {
    if (!kioskToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/kiosk/scan-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken, kioskToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "QR code invalide ou expiré");
        setLoading(false);
        return;
      }
      setCollaborator(data.collaborator);
      setPunchSource("qr");
      setKiosk(prev => ({
        ...(data.kiosk ?? {}),
        attendanceSettings: prev?.attendanceSettings ?? data.kiosk?.attendanceSettings,
      }));
      setScreen("identified");
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }, [kioskToken]);

  const handleAction = (kind: PunchKind) => {
    setSelectedKind(kind);
    setSelectedSite(null);
    gpsRef.current = null;

    const attSettings = kiosk?.attendanceSettings;
    const requireGps = attSettings?.requireGps ?? false;
    const requirePhoto = attSettings?.requirePhoto ?? false;
    const trackBySite = attSettings?.trackBySite ?? false;

    const nextStep = (gpsOk: boolean) => {
      if (!gpsOk && requireGps) {
        setErrorMsg("La géolocalisation est requise pour pointer. Veuillez autoriser l'accès au GPS et réessayer.");
        setScreen("error");
        return;
      }
      if (trackBySite) { setScreen("site"); return; }
      if (requirePhoto) { setScreen("photo"); return; }
      doPunch(kind);
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          gpsRef.current = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracyMeters: Math.round(pos.coords.accuracy),
          };
          nextStep(true);
        },
        () => { gpsRef.current = null; nextStep(false); },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
      );
    } else {
      nextStep(false);
    }
  };

  const handleSiteSelected = (site: string) => {
    setSelectedSite(site);
    const requirePhoto = kiosk?.attendanceSettings?.requirePhoto ?? false;
    if (requirePhoto) {
      setScreen("photo");
    } else if (selectedKind) {
      doPunch(selectedKind, undefined, site);
    }
  };

  const doPunch = useCallback(async (kind: PunchKind, photoDataUrl?: string, site?: string) => {
    if (!kioskToken || !collaborator) return;
    setLoading(true);
    try {
      const gps = gpsRef.current;
      const res = await fetch("/api/kiosk/punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kioskToken,
          collaboratorId: collaborator.id,
          kind,
          source: punchSource,
          ...(photoDataUrl ? { photoDataUrl } : {}),
          ...(gps ? { latitude: gps.latitude, longitude: gps.longitude, accuracyMeters: gps.accuracyMeters } : {}),
          ...(site ? { siteName: site } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Erreur lors du pointage");
        setScreen("error");
        return;
      }
      setScreen("confirm");
    } catch {
      setErrorMsg("Erreur de connexion au serveur");
      setScreen("error");
    } finally {
      setLoading(false);
    }
  }, [kioskToken, collaborator, punchSource]);

  const reset = useCallback(() => {
    setScreen("idle");
    setCollaborator(null);
    setSelectedKind(null);
    setSelectedSite(null);
    setPunchSource("kiosk");
    setError(null);
    setErrorMsg("");
    setLoading(false);
  }, []);

  if (!kioskToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <SetupScreen onSetup={handleSetupToken} tokenError={tokenError} />
      </div>
    );
  }

  if (tokenValidating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-white">
          <span className="text-3xl animate-spin inline-block">⟳</span>
          <p className="text-white/50">Vérification du kiosk…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="h-screen max-w-2xl mx-auto">
        {screen === "idle" && (
          <IdleScreen
            kiosk={kiosk}
            onPinCode={() => setScreen("keypad")}
            onQrScan={() => setScreen("qr_scan")}
          />
        )}
        {screen === "keypad" && (
          <KeypadScreen
            onIdentify={handleIdentify}
            onCancel={reset}
            loading={loading}
            error={error}
          />
        )}
        {screen === "qr_scan" && (
          <QrScanScreen
            onScan={handleScanQr}
            onCancel={reset}
            loading={loading}
            error={error}
          />
        )}
        {screen === "identified" && collaborator && (
          <ActionScreen
            collaborator={collaborator}
            onAction={handleAction}
            onCancel={reset}
            source={punchSource}
          />
        )}
        {screen === "site" && selectedKind && (
          <SiteScreen
            onSelect={handleSiteSelected}
            onCancel={reset}
          />
        )}
        {screen === "photo" && selectedKind && (
          <PhotoScreen
            onCapture={(url) => doPunch(selectedKind, url, selectedSite ?? undefined)}
            onSkip={() => doPunch(selectedKind, undefined, selectedSite ?? undefined)}
            requirePhoto={kiosk?.attendanceSettings?.requirePhoto ?? false}
          />
        )}
        {screen === "confirm" && collaborator && selectedKind && (
          <ConfirmScreen
            collaborator={collaborator}
            kind={selectedKind}
            onDone={reset}
          />
        )}
        {screen === "error" && (
          <ErrorScreen message={errorMsg} onRetry={reset} />
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <KioskApp />
    </QueryClientProvider>
  );
}
