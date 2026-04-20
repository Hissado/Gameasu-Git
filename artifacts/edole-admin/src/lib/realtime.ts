import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";

let _socket: Socket | null = null;

function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

export function getSocket(): Socket | null {
  // Réutilise une socket existante (connectée OU en cours de connexion) pour
  // éviter une boucle reconnect/disconnect pendant la phase d'init.
  if (_socket) return _socket;
  const token = getToken();
  if (!token) return null;
  _socket = io({
    path: "/api/realtime",
    transports: ["websocket", "polling"],
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
  });
  return _socket;
}

export function disconnectSocket() {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}

export function useRealtime(
  events: Record<string, (payload: any) => void>,
  deps: React.DependencyList = [],
) {
  const handlersRef = useRef(events);
  handlersRef.current = events;

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const entries = Object.entries(handlersRef.current);
    const wrapped = entries.map(([event, _]) => {
      const fn = (payload: any) => handlersRef.current[event]?.(payload);
      socket.on(event, fn);
      return [event, fn] as const;
    });
    return () => {
      wrapped.forEach(([event, fn]) => socket.off(event, fn));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function useConversationRoom(conversationId: string | null) {
  useEffect(() => {
    if (!conversationId) return;
    const socket = getSocket();
    if (!socket) return;
    socket.emit("conversation:join", conversationId);
    return () => {
      socket.emit("conversation:leave", conversationId);
    };
  }, [conversationId]);
}

export function emitTyping(conversationId: string, isTyping: boolean) {
  const socket = getSocket();
  if (!socket) return;
  socket.emit(isTyping ? "typing:start" : "typing:stop", conversationId);
}
