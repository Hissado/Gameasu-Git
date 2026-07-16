import React from "react";
import { Card, CardContent } from "@/components/ui/card";

function shortDateFr(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

interface Props {
  activity: any[];
}

export function ActivitySection({ activity }: Props) {
  return (
    <section>
      <div className="flex items-end justify-between gap-4 mb-3">
        <div>
          <h2 className="text-base font-bold text-foreground">Activité récente</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Derniers événements dans l'organisation</p>
        </div>
      </div>
      {activity.length === 0 ? (
        <Card className="shadow-sm border"><CardContent className="py-10 text-center text-sm text-muted-foreground">Aucune activité récente.</CardContent></Card>
      ) : (
        <div className="space-y-1">
          {activity.slice(0, 8).map((a: any, i: number) => (
            <div key={a.id ?? i} className="flex items-start gap-3 py-2.5 border-b border last:border-0">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground leading-snug">{a.description}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{a.userName || "Système"} · {shortDateFr(a.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
