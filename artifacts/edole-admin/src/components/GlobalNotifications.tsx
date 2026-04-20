import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useRealtime } from "@/lib/realtime";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { playMessagePing } from "@/lib/sound";
import { showDesktopNotif } from "@/lib/desktop-notifications";

/**
 * Global cross-app listener for messages + notifications. Mounted once.
 * Triggers in-app toast, desktop notification, and sound for new messages
 * arriving in conversations the user is NOT actively viewing.
 */
export function GlobalNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const qc = useQueryClient();
  const lastSoundAtRef = useRef(0);

  // Track current location so we know if user is in /messaging
  const locationRef = useRef(location);
  locationRef.current = location;

  useRealtime({
    "message:new": (msg: any) => {
      if (!msg || !user?.id) return;
      if (msg.senderId === user.id) return;
      // If user is currently on the messaging page, the page already handles UI updates.
      // Only fire notification when user is elsewhere.
      const onMessaging = locationRef.current?.startsWith("/messaging");
      if (onMessaging) return;
      // Throttle sound
      const now = Date.now();
      if (now - lastSoundAtRef.current > 1500) {
        playMessagePing();
        lastSoundAtRef.current = now;
      }
      const title = msg.senderName ? `Nouveau message · ${msg.senderName}` : "Nouveau message";
      const body = (msg.content || "").slice(0, 140) || "Pièce jointe";
      toast({ title, description: body });
      showDesktopNotif({
        title,
        body,
        tag: `msg-${msg.conversationId}`,
        onClick: () => navigate(`/messaging?c=${msg.conversationId}`),
      });
    },
    "notification:new": (n: any) => {
      if (!n) return;
      // Refresh notifications query
      qc.invalidateQueries({ queryKey: ["/api/notifications"] }).catch(() => {});
      // Toast only outside messaging (avoid duplicates on message-driven notifs)
      const onMessaging = locationRef.current?.startsWith("/messaging");
      if (n.type === "message" && onMessaging) return;
      toast({ title: n.title || "Notification", description: n.body || "" });
    },
  }, [user?.id]);

  // Also catch the conversation:bump unread bumps to invalidate conv list
  useRealtime({
    "conversation:bump": () => {
      qc.invalidateQueries({ queryKey: ["/api/conversations"] }).catch(() => {});
    },
  }, []);

  useEffect(() => {
    // No-op — placeholder for future SW registration / push subscription.
  }, []);

  return null;
}
