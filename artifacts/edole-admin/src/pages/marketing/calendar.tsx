import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { MarketingShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Send, BellRing } from "lucide-react";

type Event = { id: string; date: string; type: string; title: string; channel?: string; status?: string };

export default function MarketingCalendarPage() {
  const { data, isLoading } = useQuery<{ events: Event[] }>({
    queryKey: ["marketing-calendar"],
    queryFn: () => apiFetch("/api/marketing/calendar"),
  });

  const events = data?.events || [];
  // Regrouper par jour
  const byDay = events.reduce((acc: Record<string, Event[]>, e) => {
    const day = new Date(e.date).toISOString().slice(0, 10);
    (acc[day] ||= []).push(e);
    return acc;
  }, {});
  const days = Object.keys(byDay).sort();

  const now = Date.now();

  return (
    <MarketingShell title="Calendrier marketing" subtitle="Campagnes, alertes et automatisations sur les 90 prochains jours">
      {isLoading ? <div className="text-center py-12 text-muted-foreground">Chargement…</div>
        : days.length === 0 ? (
          <Card><CardContent className="p-12 text-center text-muted-foreground"><CalendarDays className="w-12 h-12 mx-auto mb-2 opacity-50" />Aucun événement programmé.</CardContent></Card>
        ) : (
          <div className="space-y-4">
            {days.map((day) => {
              const dayMs = new Date(day).getTime();
              const isPast = dayMs < now - 24 * 3600 * 1000;
              return (
                <Card key={day} className={isPast ? "opacity-70" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-semibold">
                        {new Date(day).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                      </div>
                      <Badge variant="outline">{byDay[day].length} événement(s)</Badge>
                    </div>
                    <ul className="space-y-2">
                      {byDay[day].map((e) => (
                        <li key={`${e.type}:${e.id}`} className="flex items-center gap-3 p-2 border rounded hover:bg-muted/30">
                          <div className={`w-9 h-9 rounded-md flex items-center justify-center ${e.type === "campaign" ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700"}`}>
                            {e.type === "campaign" ? <Send className="w-4 h-4" /> : <BellRing className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{e.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(e.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                              {e.channel && ` · ${e.channel}`}
                            </div>
                          </div>
                          {e.status && <Badge variant="outline" className="capitalize">{e.status}</Badge>}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
    </MarketingShell>
  );
}
