import React, { useMemo, useState } from "react";
import { useListNotifications, useMarkAllNotificationsRead, useMarkNotificationRead } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Bell, CheckCheck, CheckCircle2, AlertTriangle, Info, Clock,
  FolderKanban, CheckSquare, MessageSquare, CreditCard, UserCheck,
  Eye, ArrowRight, Filter, Inbox,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Types & helpers ───────────────────────────────────────────────────────────

type NotifType = "task" | "project" | "approval" | "payment" | "message" | "hr" | "info" | "alert";

function classifyNotif(n: any): NotifType {
  const t = (n.type || "").toLowerCase();
  const title = (n.title || "").toLowerCase();
  if (t.includes("task") || title.includes("tâche")) return "task";
  if (t.includes("project") || title.includes("projet")) return "project";
  if (t.includes("approval") || title.includes("approbation") || title.includes("approuv")) return "approval";
  if (t.includes("payment") || title.includes("paiement") || title.includes("facture")) return "payment";
  if (t.includes("message") || title.includes("message") || title.includes("commentaire")) return "message";
  if (t.includes("hr") || title.includes("congé") || title.includes("rh") || title.includes("contrat")) return "hr";
  if (t.includes("alert") || title.includes("alerte") || title.includes("anomalie")) return "alert";
  return "info";
}

const NOTIF_ICON: Record<NotifType, { icon: React.ReactNode; bg: string; text: string }> = {
  task:     { icon: <CheckSquare className="w-4 h-4" />,    bg: "bg-primary/10",  text: "text-primary" },
  project:  { icon: <FolderKanban className="w-4 h-4" />,   bg: "bg-blue-100",    text: "text-blue-600" },
  approval: { icon: <UserCheck className="w-4 h-4" />,      bg: "bg-amber-100",   text: "text-amber-700" },
  payment:  { icon: <CreditCard className="w-4 h-4" />,     bg: "bg-emerald-100", text: "text-emerald-700" },
  message:  { icon: <MessageSquare className="w-4 h-4" />,  bg: "bg-violet-100",  text: "text-violet-700" },
  hr:       { icon: <UserCheck className="w-4 h-4" />,      bg: "bg-sky-100",     text: "text-sky-700" },
  alert:    { icon: <AlertTriangle className="w-4 h-4" />,  bg: "bg-red-100",     text: "text-red-600" },
  info:     { icon: <Info className="w-4 h-4" />,           bg: "bg-slate-100",   text: "text-slate-600" },
};

function getActionLink(n: any): string | null {
  const type = classifyNotif(n);
  if (n.link) return n.link;
  if (type === "task") return n.taskId ? `/tasks/${n.taskId}` : "/tasks";
  if (type === "project") return n.projectId ? `/projects/${n.projectId}` : "/projects";
  if (type === "approval") return "/approvals";
  if (type === "payment") return "/payments";
  if (type === "message") return "/messaging";
  if (type === "hr") return "/hr";
  return null;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d}j`;
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function groupByDate(notifications: any[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: Array<{ label: string; items: any[] }> = [
    { label: "Aujourd'hui", items: [] },
    { label: "Hier", items: [] },
    { label: "Cette semaine", items: [] },
    { label: "Plus ancien", items: [] },
  ];

  notifications.forEach(n => {
    const d = new Date(n.createdAt);
    if (d >= today) groups[0].items.push(n);
    else if (d >= yesterday) groups[1].items.push(n);
    else if (d >= weekAgo) groups[2].items.push(n);
    else groups[3].items.push(n);
  });

  return groups.filter(g => g.items.length > 0);
}

// ── NotificationItem ──────────────────────────────────────────────────────────

function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: any;
  onMarkRead: (id: string) => void;
}) {
  const unread = !notification.isRead || notification.isRead === "false";
  const type = classifyNotif(notification);
  const iconCfg = NOTIF_ICON[type];
  const actionLink = getActionLink(notification);

  return (
    <div className={`px-4 py-3.5 flex gap-3.5 transition-colors group ${unread ? "bg-primary/[0.03] hover:bg-primary/[0.06]" : "hover:bg-slate-50/50"}`}>
      {/* Icon */}
      <div className={`mt-0.5 rounded-lg p-2 h-9 w-9 flex items-center justify-center shrink-0 ${
        unread ? `${iconCfg.bg} ${iconCfg.text}` : "bg-muted text-muted-foreground"
      }`}>
        {iconCfg.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-2 mb-0.5">
          <h4 className={`text-sm leading-snug ${unread ? "font-bold text-foreground" : "font-medium text-foreground/90"}`}>
            {notification.title}
          </h4>
          <div className="flex items-center gap-1.5 shrink-0 ml-1">
            {unread && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
              {relativeTime(notification.createdAt)}
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {notification.message || notification.body}
        </p>

        {/* Inline actions */}
        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          {type === "approval" && (
            <>
              <Link href="/approvals">
                <Button size="sm" className="h-7 text-xs bg-primary hover:bg-primary/90 font-semibold">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Examiner
                </Button>
              </Link>
            </>
          )}
          {type === "task" && (
            <Link href={actionLink || "/tasks"}>
              <Button size="sm" variant="outline" className="h-7 text-xs font-medium border-primary/30 text-primary hover:bg-primary/5">
                <CheckSquare className="w-3 h-3 mr-1" />
                Voir la tâche
              </Button>
            </Link>
          )}
          {type === "message" && (
            <Link href="/messaging">
              <Button size="sm" variant="outline" className="h-7 text-xs font-medium">
                <MessageSquare className="w-3 h-3 mr-1" />
                Répondre
              </Button>
            </Link>
          )}
          {type === "project" && (
            <Link href={actionLink || "/projects"}>
              <Button size="sm" variant="outline" className="h-7 text-xs font-medium">
                <FolderKanban className="w-3 h-3 mr-1" />
                Voir le projet
              </Button>
            </Link>
          )}
          {type === "payment" && (
            <Link href="/payments">
              <Button size="sm" variant="outline" className="h-7 text-xs font-medium">
                <CreditCard className="w-3 h-3 mr-1" />
                Voir paiement
              </Button>
            </Link>
          )}
          {type === "hr" && (
            <Link href="/hr/leaves">
              <Button size="sm" variant="outline" className="h-7 text-xs font-medium">
                <UserCheck className="w-3 h-3 mr-1" />
                Voir RH
              </Button>
            </Link>
          )}
          {actionLink && !["approval", "task", "message", "project", "payment", "hr"].includes(type) && (
            <Link href={actionLink}>
              <Button size="sm" variant="outline" className="h-7 text-xs font-medium">
                <Eye className="w-3 h-3 mr-1" />
                Voir
              </Button>
            </Link>
          )}

          {unread && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-muted-foreground hover:text-foreground ml-auto"
              onClick={() => onMarkRead(notification.id)}
            >
              <CheckCheck className="w-3 h-3 mr-1" />
              Lu
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const FILTER_OPTIONS = [
  { value: "all", label: "Toutes" },
  { value: "unread", label: "Non lues" },
  { value: "task", label: "Tâches" },
  { value: "project", label: "Projets" },
  { value: "approval", label: "Approbations" },
  { value: "payment", label: "Paiements" },
  { value: "message", label: "Messages" },
  { value: "hr", label: "RH" },
  { value: "alert", label: "Alertes" },
];

export default function NotificationsList() {
  const { data, isLoading, refetch } = useListNotifications();
  const markAllRead = useMarkAllNotificationsRead();
  const markOneRead = useMarkNotificationRead();
  const { toast } = useToast();
  const [filter, setFilter] = useState("all");

  const handleMarkAllRead = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => {
        refetch();
        toast({ title: "Notifications marquées comme lues", description: "Tout est à jour." });
      },
    });
  };

  const handleMarkRead = (id: string) => {
    markOneRead.mutate({ id }, {
      onSuccess: () => refetch(),
    });
  };

  const allNotifications = data?.data || [];

  const filtered = useMemo(() => {
    let list = allNotifications;
    if (filter === "unread") list = list.filter((n: any) => !n.isRead || n.isRead === "false");
    else if (filter !== "all") list = list.filter((n: any) => classifyNotif(n) === filter);
    return list;
  }, [allNotifications, filter]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);
  const unreadCount = allNotifications.filter((n: any) => !n.isRead || n.isRead === "false").length;

  return (
    <div className="space-y-5 max-w-4xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Centre de notifications</h1>
          <p className="text-muted-foreground mt-1">
            {unreadCount > 0
              ? <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary inline-block" />{unreadCount} non lue{unreadCount > 1 ? "s" : ""}</span>
              : "Vous êtes à jour ✓"
            }
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleMarkAllRead}
          disabled={markAllRead.isPending || unreadCount === 0}
          className="shrink-0"
        >
          <CheckCheck className="w-4 h-4 mr-2" />
          Tout marquer lu
        </Button>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {FILTER_OPTIONS.map(opt => {
          const count = opt.value === "all"
            ? allNotifications.length
            : opt.value === "unread"
              ? unreadCount
              : allNotifications.filter((n: any) => classifyNotif(n) === opt.value).length;
          if (count === 0 && opt.value !== "all" && opt.value !== "unread") return null;
          return (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                filter === opt.value
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-white text-slate-600 border-border hover:border-primary/40 hover:text-primary"
              }`}
            >
              {opt.label}
              {count > 0 && (
                <span className={`ml-1.5 text-[10px] font-bold ${filter === opt.value ? "text-white/80" : "text-muted-foreground"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Notifications list */}
      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground animate-pulse">
            Chargement des notifications…
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-16 text-center text-muted-foreground">
            <Inbox className="w-12 h-12 mx-auto mb-4 text-slate-200" />
            <p className="font-semibold text-slate-600">Aucune notification</p>
            <p className="text-sm mt-1">
              {filter !== "all" ? "Aucune notification pour ce filtre." : "Les alertes opérationnelles s'afficheront ici."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(group => (
            <div key={group.label}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {group.label}
                </span>
                <div className="flex-1 h-px bg-border/50" />
              </div>
              <Card className="overflow-hidden shadow-sm">
                <CardContent className="p-0 divide-y divide-border/40">
                  {group.items.map((notification: any) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkRead={handleMarkRead}
                    />
                  ))}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
