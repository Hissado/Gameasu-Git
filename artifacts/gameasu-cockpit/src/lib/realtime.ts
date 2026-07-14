import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";

let _socket: Socket | null = null;

function getToken(): string | null {
  return localStorage.getItem("cockpit_token");
}

export function getCockpitSocket(): Socket | null {
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

export function useRealtimeCockpit(
  events: Record<string, (payload: any) => void>,
  deps: React.DependencyList = [],
) {
  const handlersRef = useRef(events);
  handlersRef.current = events;

  useEffect(() => {
    const socket = getCockpitSocket();
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
