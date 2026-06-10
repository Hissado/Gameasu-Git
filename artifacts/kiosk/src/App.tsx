import { useState, useEffect, useRef, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

// ─── Types ──────────────────────────────────────────────────────
interface CollaboratorInfo {
  id: string;
  firstName: string;
  lastName: string;
  position: string | null;
  avatarUrl: string | null;
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
}

type Screen = "idle" | "keypad" | "identified" | "photo" | "confirm" | "error";
type PunchKind = "clock_in" | "clock_out" | "break_start" | "break_end";

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

// ─── Idle Screen ─────────────────────────────────────────────────
function IdleScreen({ kiosk, onStart }: { kiosk: KioskInfo | null; onStart: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-between h-full py-16 px-8 cursor-pointer select-none"
      onClick={onStart}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="text-3xl font-bold tracking-widest text-amber-400 uppercase">
          {kiosk?.settings?.orgName ?? "Gaméasù"}
        </div>
        <div className="text-sm text-white/40 uppercase tracking-widest">
          {kiosk?.name ?? "Kiosk de Pointage"}
          {kiosk?.location ? ` — ${kiosk.location}` : ""}
        </div>
      </div>

      <div className="flex flex-col items-center gap-8">
        <Clock />
        <div className="flex flex-col items-center gap-2 mt-6">
          <div className="text-2xl text-white/70">
            {kiosk?.settings?.welcomeMessage ?? "Touchez pour pointer"}
          </div>
          <div className="text-sm text-white/30 mt-1">Tap anywhere to start</div>
        </div>
      </div>

      <div className="text-xs text-white/20 tracking-widest uppercase">Gaméasù ERP © 2026</div>
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
                ? "bg-amber-400 border-amber-400 scale-110"
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
                  isConfirm ? "bg-amber-400/20 border-amber-400/40 text-amber-300 hover:bg-amber-400/30" :
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

// ─── Action Screen ───────────────────────────────────────────────
function ActionScreen({
  collaborator,
  onAction,
  onCancel,
}: {
  collaborator: CollaboratorInfo;
  onAction: (kind: PunchKind) => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-8">
      {/* Collaborator card */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-24 h-24 rounded-full border-2 border-amber-400/60 overflow-hidden bg-white/10 flex items-center justify-center">
          {collaborator.avatarUrl ? (
            <img src={collaborator.avatarUrl} alt={collaborator.firstName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-4xl font-bold text-amber-400">
              {collaborator.firstName[0]}{collaborator.lastName[0]}
            </span>
          )}
        </div>
        <div className="text-center">
          <div className="text-3xl font-semibold text-white">
            {collaborator.firstName} {collaborator.lastName}
          </div>
          {collaborator.position && (
            <div className="text-base text-white/50 mt-1">{collaborator.position}</div>
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
}: {
  onCapture: (dataUrl: string) => void;
  onSkip: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setReady(true);
      })
      .catch(() => setError("Caméra non disponible"));

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.85);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCapture(dataUrl);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-8">
      <div className="text-xl text-white/70">Photo de présence</div>
      <div className="text-sm text-white/40">Regardez la caméra et prenez votre photo</div>

      <div className="relative rounded-2xl overflow-hidden border border-white/20 bg-black w-full max-w-sm aspect-video flex items-center justify-center">
        {error ? (
          <div className="text-white/40 text-center p-8">{error}</div>
        ) : (
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      <div className="flex gap-4">
        {!error && ready && (
          <button
            onClick={capture}
            className="px-8 py-4 bg-amber-400 text-slate-900 font-semibold text-lg rounded-xl hover:bg-amber-300 active:scale-95 transition-all"
          >
            📸 Prendre la photo
          </button>
        )}
        <button
          onClick={onSkip}
          className="px-8 py-4 bg-white/10 border border-white/20 text-white/60 text-lg rounded-xl hover:bg-white/15 active:scale-95 transition-all"
        >
          Passer
        </button>
      </div>
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
        className="px-8 py-4 bg-amber-400 text-slate-900 font-semibold text-lg rounded-xl hover:bg-amber-300 active:scale-95 transition-all"
      >
        Réessayer
      </button>
    </div>
  );
}

// ─── Token Setup Screen ───────────────────────────────────────────
function SetupScreen({ onSetup }: { onSetup: (token: string) => void }) {
  const [input, setInput] = useState("");
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-8">
      <div className="text-2xl font-bold text-amber-400">Configuration du kiosk</div>
      <div className="text-white/50 text-center max-w-sm">
        Entrez le token du kiosk (visible dans la page d'administration Gaméasù)
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        className="w-full max-w-md px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-center font-mono text-sm focus:outline-none focus:border-amber-400/60"
      />
      <button
        onClick={() => { if (input.trim()) onSetup(input.trim()); }}
        disabled={!input.trim()}
        className="px-8 py-4 bg-amber-400 disabled:opacity-40 text-slate-900 font-semibold rounded-xl hover:bg-amber-300 transition-all"
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
  const [screen, setScreen] = useState<Screen>("idle");
  const [collaborator, setCollaborator] = useState<CollaboratorInfo | null>(null);
  const [selectedKind, setSelectedKind] = useState<PunchKind | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Load kiosk info on mount
  useEffect(() => {
    if (!kioskToken) return;
    // We do a test identify call with a dummy code to get kiosk info
    // Actually we can't — let's store org name from first successful identify
    // The kiosk info is returned with the identify response
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
      setKiosk(data.kiosk);
      setScreen("identified");
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }, [kioskToken]);

  const handleAction = (kind: PunchKind) => {
    setSelectedKind(kind);
    setScreen("photo");
  };

  const doPunch = useCallback(async (kind: PunchKind, photoDataUrl?: string) => {
    if (!kioskToken || !collaborator) return;
    setLoading(true);
    try {
      const res = await fetch("/api/kiosk/punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kioskToken,
          collaboratorId: collaborator.id,
          kind,
          ...(photoDataUrl ? { photoDataUrl } : {}),
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
  }, [kioskToken, collaborator]);

  const reset = useCallback(() => {
    setScreen("idle");
    setCollaborator(null);
    setSelectedKind(null);
    setError(null);
    setErrorMsg("");
    setLoading(false);
  }, []);

  if (!kioskToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <SetupScreen onSetup={handleSetupToken} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="h-screen max-w-2xl mx-auto">
        {screen === "idle" && (
          <IdleScreen kiosk={kiosk} onStart={() => setScreen("keypad")} />
        )}
        {screen === "keypad" && (
          <KeypadScreen
            onIdentify={handleIdentify}
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
          />
        )}
        {screen === "photo" && selectedKind && (
          <PhotoScreen
            onCapture={(url) => doPunch(selectedKind, url)}
            onSkip={() => doPunch(selectedKind)}
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
