import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Phone, PhoneOff, Video, Mic, MicOff, VideoOff, Maximize2, Minimize2, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRealtime } from "@/lib/realtime";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { startRingtone, stopRingtone, startDialTone } from "@/lib/sound";
import { ensureNotifPermission, showDesktopNotif } from "@/lib/desktop-notifications";

type CallType = "audio" | "video" | "conference";

type IncomingCall = {
  callId: string;
  conversationId: string;
  type: CallType;
  roomUrl: string;
  initiatorId: string;
  initiatorName: string;
  initiatorAvatarUrl?: string | null;
};

type ActiveCall = {
  callId: string;
  conversationId: string;
  type: CallType;
  roomUrl: string;
  peerName: string;
  peerAvatarUrl?: string | null;
  startedAt: number;
};

type OutgoingCall = {
  callId: string;
  conversationId: string;
  type: CallType;
  roomUrl: string;
  peerName: string;
  peerAvatarUrl?: string | null;
};

type Ctx = {
  startCall: (opts: { conversationId: string; type: CallType; peerName: string; peerAvatarUrl?: string | null }) => Promise<void>;
  isBusy: boolean;
};

const CallCenterContext = createContext<Ctx | null>(null);
export const useCallCenter = () => {
  const v = useContext(CallCenterContext);
  if (!v) throw new Error("useCallCenter must be inside CallCenterProvider");
  return v;
};

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
}

export function CallCenterProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [outgoing, setOutgoing] = useState<OutgoingCall | null>(null);
  const [active, setActive] = useState<ActiveCall | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Ask Notification permission once authenticated
  useEffect(() => { if (user?.id) ensureNotifPermission(); }, [user?.id]);

  // Tick for active call timer
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  // Manage ringtone lifecycle
  useEffect(() => {
    if (incoming) {
      const stop = startRingtone();
      showDesktopNotif({
        title: `Appel entrant — ${incoming.initiatorName}`,
        body: incoming.type === "video" ? "Appel vidéo" : "Appel audio",
        tag: `call-${incoming.callId}`,
        requireInteraction: true,
        onClick: () => { /* focus only */ },
      });
      return () => stop();
    }
    return undefined;
  }, [incoming]);

  useEffect(() => {
    if (outgoing) {
      const stop = startDialTone();
      return () => stop();
    }
    return undefined;
  }, [outgoing]);

  // Realtime listeners
  useRealtime({
    "call:incoming": (p: IncomingCall) => {
      // Ignore if we're already in a call
      if (active || incoming || outgoing) return;
      setIncoming(p);
    },
    "call:accepted": (p: { callId: string; conversationId: string; roomUrl: string; acceptedBy: string }) => {
      // Close my own incoming modal if another participant accepted first
      if (incoming && incoming.callId === p.callId) setIncoming(null);
      // Caller side promotion
      if (outgoing && outgoing.callId === p.callId) {
        setActive({
          callId: outgoing.callId,
          conversationId: outgoing.conversationId,
          type: outgoing.type,
          roomUrl: outgoing.roomUrl,
          peerName: outgoing.peerName,
          peerAvatarUrl: outgoing.peerAvatarUrl,
          startedAt: Date.now(),
        });
        setOutgoing(null);
      }
    },
    "call:declined": (p: { callId: string }) => {
      if (outgoing && outgoing.callId === p.callId) setOutgoing(null);
      if (incoming && incoming.callId === p.callId) setIncoming(null);
    },
    "call:ended": (p: { callId: string }) => {
      if (incoming && incoming.callId === p.callId) setIncoming(null);
      if (outgoing && outgoing.callId === p.callId) setOutgoing(null);
      if (active && active.callId === p.callId) setActive(null);
    },
  }, [active?.callId, incoming?.callId, outgoing?.callId]);

  const startCall = useCallback<Ctx["startCall"]>(async ({ conversationId, type, peerName, peerAvatarUrl }) => {
    if (active || outgoing || incoming) return;
    try {
      const c = await apiFetch<{ id: string; roomUrl: string; type: CallType }>(`/api/calls`, {
        method: "POST",
        body: { type, conversationId } as any,
      });
      setOutgoing({
        callId: c.id,
        conversationId,
        type: c.type || type,
        roomUrl: c.roomUrl,
        peerName,
        peerAvatarUrl: peerAvatarUrl || null,
      });
    } catch (e: any) {
      alert(e?.message || "Impossible de démarrer l'appel");
    }
  }, [active, outgoing, incoming]);

  const acceptIncoming = useCallback(async () => {
    if (!incoming) return;
    try {
      await apiFetch(`/api/calls/${incoming.callId}`, { method: "PUT", body: { status: "active" } as any });
      setActive({
        callId: incoming.callId,
        conversationId: incoming.conversationId,
        type: incoming.type,
        roomUrl: incoming.roomUrl,
        peerName: incoming.initiatorName,
        peerAvatarUrl: incoming.initiatorAvatarUrl,
        startedAt: Date.now(),
      });
      setIncoming(null);
    } catch (e: any) { alert(e?.message || "Erreur"); }
  }, [incoming]);

  const declineIncoming = useCallback(async () => {
    if (!incoming) return;
    try {
      await apiFetch(`/api/calls/${incoming.callId}`, { method: "PUT", body: { status: "declined" } as any });
    } catch {/* ignore */}
    setIncoming(null);
  }, [incoming]);

  const cancelOutgoing = useCallback(async () => {
    if (!outgoing) return;
    try {
      await apiFetch(`/api/calls/${outgoing.callId}`, { method: "PUT", body: { status: "ended" } as any });
    } catch {/* ignore */}
    setOutgoing(null);
  }, [outgoing]);

  const endActive = useCallback(async () => {
    if (!active) return;
    try {
      await apiFetch(`/api/calls/${active.callId}`, { method: "PUT", body: { status: "completed" } as any });
    } catch {/* ignore */}
    setActive(null);
    setMinimized(false);
    setMuted(false);
    setCamOff(false);
  }, [active]);

  const ctxValue = useMemo<Ctx>(() => ({
    startCall,
    isBusy: !!(active || outgoing || incoming),
  }), [startCall, active, outgoing, incoming]);

  // Cleanup ringtone on unmount
  useEffect(() => () => { stopRingtone(); }, []);

  return (
    <CallCenterContext.Provider value={ctxValue}>
      {children}

      {/* INCOMING CALL — full-screen modal */}
      {incoming && (
        <div className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-200">
          <div className="w-full max-w-md mx-4 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-700/50 shadow-2xl overflow-hidden">
            <div className="px-8 pt-10 pb-8 flex flex-col items-center text-center">
              <div className="text-[11px] uppercase tracking-[0.2em] text-primary font-bold animate-pulse mb-2">
                Appel entrant · {incoming.type === "video" ? "Vidéo" : "Audio"}
              </div>
              <div className="relative my-4">
                <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
                <div className="absolute inset-[-6px] rounded-full border-2 border-primary/50 animate-pulse" />
                <Avatar className="w-28 h-28 border-4 border-slate-800 relative">
                  <AvatarImage src={incoming.initiatorAvatarUrl || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-3xl font-bold">
                    {incoming.initiatorName.split(" ").map(s => s[0]).slice(0, 2).join("")}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="text-2xl font-bold text-white mt-2">{incoming.initiatorName}</div>
              <div className="text-sm text-slate-400 mt-1">vous appelle…</div>
            </div>
            <div className="px-8 pb-10 flex items-center justify-between gap-6">
              <button
                onClick={declineIncoming}
                className="flex flex-col items-center gap-2 group"
                aria-label="Refuser"
              >
                <span className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-red-600/40 group-hover:shadow-red-600/60">
                  <PhoneOff className="w-7 h-7 text-white" />
                </span>
                <span className="text-xs text-slate-300">Refuser</span>
              </button>
              <button
                onClick={acceptIncoming}
                className="flex flex-col items-center gap-2 group"
                aria-label="Accepter"
              >
                <span className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-emerald-600/40 group-hover:shadow-emerald-600/60 animate-bounce">
                  {incoming.type === "video" ? <Video className="w-7 h-7 text-white" /> : <Phone className="w-7 h-7 text-white" />}
                </span>
                <span className="text-xs text-slate-300">Accepter</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OUTGOING CALL — ringing UI */}
      {outgoing && !active && (
        <div className="fixed inset-0 z-[190] bg-black/85 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-200">
          <div className="w-full max-w-md mx-4 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-700/50 shadow-2xl overflow-hidden">
            <div className="px-8 pt-10 pb-8 flex flex-col items-center text-center">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400 font-bold mb-2">
                Appel sortant · {outgoing.type === "video" ? "Vidéo" : "Audio"}
              </div>
              <div className="relative my-4">
                <div className="absolute inset-[-6px] rounded-full border-2 border-slate-600/50 animate-pulse" />
                <Avatar className="w-28 h-28 border-4 border-slate-800 relative">
                  <AvatarImage src={outgoing.peerAvatarUrl || undefined} />
                  <AvatarFallback className="bg-slate-700 text-white text-3xl font-bold">
                    {outgoing.peerName.split(" ").map(s => s[0]).slice(0, 2).join("")}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="text-2xl font-bold text-white mt-2">{outgoing.peerName}</div>
              <div className="text-sm text-slate-400 mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" />
                Sonnerie en cours…
              </div>
            </div>
            <div className="px-8 pb-10 flex items-center justify-center">
              <button
                onClick={cancelOutgoing}
                className="flex flex-col items-center gap-2 group"
                aria-label="Annuler"
              >
                <span className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-red-600/40">
                  <PhoneOff className="w-7 h-7 text-white" />
                </span>
                <span className="text-xs text-slate-300">Annuler</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE CALL — full-screen or minimized */}
      {active && !minimized && (
        <div className="fixed inset-0 z-[180] bg-gradient-to-br from-slate-950 via-slate-900 to-black flex flex-col animate-in fade-in duration-200">
          <div className="flex items-center justify-between px-6 py-4 bg-black/30 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <div className="text-sm text-white font-medium">Appel {active.type === "video" ? "vidéo" : "audio"} en cours</div>
              <div className="text-xs text-slate-400 font-mono">{formatDuration(now - active.startedAt)}</div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-white/10" onClick={() => setMinimized(true)}>
                <Minimize2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
            <Avatar className="w-40 h-40 border-4 border-white/10 shadow-2xl">
              <AvatarImage src={active.peerAvatarUrl || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-5xl font-bold">
                {active.peerName.split(" ").map(s => s[0]).slice(0, 2).join("")}
              </AvatarFallback>
            </Avatar>
            <div className="mt-6 text-3xl font-bold text-white">{active.peerName}</div>
            <div className="mt-2 text-sm text-slate-400">Connecté · qualité HD</div>

            <a
              href={active.roomUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-slate-200 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Ouvrir la salle d'appel
            </a>
          </div>

          <div className="px-6 py-6 bg-black/40 border-t border-white/10">
            <div className="max-w-md mx-auto flex items-center justify-center gap-4">
              <button
                onClick={() => setMuted((m) => !m)}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${muted ? "bg-red-600 hover:bg-red-700 text-white" : "bg-white/10 hover:bg-white/20 text-white"}`}
                aria-label={muted ? "Activer micro" : "Couper micro"}
              >
                {muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>
              {active.type === "video" && (
                <button
                  onClick={() => setCamOff((m) => !m)}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${camOff ? "bg-red-600 hover:bg-red-700 text-white" : "bg-white/10 hover:bg-white/20 text-white"}`}
                  aria-label={camOff ? "Activer caméra" : "Couper caméra"}
                >
                  {camOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                </button>
              )}
              <button
                onClick={endActive}
                className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 flex items-center justify-center shadow-lg shadow-red-600/40 text-white transition-all"
                aria-label="Raccrocher"
              >
                <PhoneOff className="w-7 h-7" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MINIMIZED ACTIVE CALL — floating pill */}
      {active && minimized && (
        <div className="fixed bottom-4 right-4 z-[180] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-200 max-w-[90vw]">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <Avatar className="w-9 h-9 shrink-0">
            <AvatarImage src={active.peerAvatarUrl || undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
              {active.peerName.split(" ").map(s => s[0]).slice(0, 2).join("")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="text-sm text-white font-medium truncate">{active.peerName}</div>
            <div className="text-xs text-slate-400 font-mono">{formatDuration(now - active.startedAt)}</div>
          </div>
          <button onClick={() => setMinimized(false)} className="ml-2 p-2 rounded-full hover:bg-white/10 text-slate-300" aria-label="Agrandir">
            <Maximize2 className="w-4 h-4" />
          </button>
          <button onClick={endActive} className="p-2 rounded-full bg-red-600 hover:bg-red-700 text-white" aria-label="Raccrocher">
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      )}
    </CallCenterContext.Provider>
  );
}
