import React from "react";
import { useListNotifications, useMarkAllNotificationsRead } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck } from "lucide-react";

export default function NotificationsList() {
  const { data, isLoading, refetch } = useListNotifications();
  const markAllRead = useMarkAllNotificationsRead();

  const handleMarkAllRead = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => refetch(),
    });
  };

  const unreadCount = data?.data?.filter((n: any) => !n.isRead || n.isRead === "false").length || 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Centre de notifications</h1>
          <p className="text-muted-foreground mt-1">
            {unreadCount > 0
              ? `${unreadCount} notification${unreadCount > 1 ? "s" : ""} non lue${unreadCount > 1 ? "s" : ""}`
              : "Vous êtes à jour"}
          </p>
        </div>
        <Button variant="outline" onClick={handleMarkAllRead} disabled={markAllRead.isPending || unreadCount === 0}>
          <CheckCheck className="w-4 h-4 mr-2" />
          Tout marquer comme lu
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 divide-y divide-border">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Chargement des notifications…</div>
          ) : data?.data?.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Aucune notification</p>
              <p className="text-sm mt-1">Les alertes opérationnelles s'afficheront ici.</p>
            </div>
          ) : (
            data?.data?.map((notification: any) => {
              const unread = !notification.isRead || notification.isRead === "false";
              return (
                <div
                  key={notification.id}
                  className={`p-4 flex gap-4 transition-colors ${unread ? "bg-primary/5" : "bg-card"}`}
                >
                  <div className={`mt-0.5 rounded-md p-2 h-9 w-9 flex items-center justify-center shrink-0 ${
                    unread ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1 gap-3">
                      <h4 className={`text-sm ${unread ? "font-bold text-foreground" : "font-medium text-foreground/90"}`}>
                        {notification.title}
                      </h4>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(notification.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {notification.message || notification.body}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
