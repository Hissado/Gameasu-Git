type DesktopNotifOpts = {
  title: string;
  body?: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
  onClick?: () => void;
};

export function canNotify(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function ensureNotifPermission(): Promise<NotificationPermission> {
  if (!canNotify()) return "denied";
  if (Notification.permission === "default") {
    try { return await Notification.requestPermission(); } catch { return "denied"; }
  }
  return Notification.permission;
}

export function showDesktopNotif({ title, body, icon, tag, requireInteraction, onClick }: DesktopNotifOpts) {
  if (!canNotify() || Notification.permission !== "granted") return null;
  // Only show desktop notif when document is hidden / not focused, otherwise in-app toast suffices.
  if (typeof document !== "undefined" && document.visibilityState === "visible" && document.hasFocus()) {
    return null;
  }
  try {
    const n = new Notification(title, { body, icon, tag, requireInteraction });
    if (onClick) n.onclick = () => { try { window.focus(); } catch {/* */} onClick(); n.close(); };
    return n;
  } catch { return null; }
}
