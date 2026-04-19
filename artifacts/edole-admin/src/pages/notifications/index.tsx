import React from "react";
import { useListNotifications, useMarkAllNotificationsRead } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Check } from "lucide-react";

export default function NotificationsList() {
  const { data, isLoading, refetch } = useListNotifications();
  const markAllRead = useMarkAllNotificationsRead();

  const handleMarkAllRead = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => refetch()
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-1">Stay updated on platform activity</p>
        </div>
        <Button variant="outline" onClick={handleMarkAllRead} disabled={markAllRead.isPending}>
          <Check className="w-4 h-4 mr-2" />
          Mark all as read
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 divide-y divide-border">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Loading notifications...</div>
          ) : data?.data?.length === 0 ? (
             <div className="p-8 text-center text-muted-foreground">You have no notifications.</div>
          ) : (
            data?.data?.map((notification) => (
              <div 
                key={notification.id} 
                className={`p-4 flex gap-4 ${notification.isRead ? "bg-background" : "bg-muted/30"}`}
              >
                <div className={`mt-1 rounded-full p-2 h-8 w-8 flex items-center justify-center ${notification.isRead ? "bg-muted text-muted-foreground" : "bg-primary/20 text-primary"}`}>
                  <Bell className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className={`text-sm ${notification.isRead ? "font-medium" : "font-bold"}`}>
                      {notification.title}
                    </h4>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                      {new Date(notification.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {notification.body}
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
