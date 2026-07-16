import React from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronRight, FolderKanban } from "lucide-react";
import { formatFCFACompact } from "@/lib/format";

function shortDateFr(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

interface Props {
  activeProjects: any[];
}

export function ProjectsSection({ activeProjects }: Props) {
  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">Projets actifs</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Projets en cours triés par valeur</p>
        </div>
        <Button variant="ghost" size="sm" className="text-xs" asChild>
          <Link href="/projets">Tous les projets <ChevronRight className="w-3.5 h-3.5 ml-0.5" /></Link>
        </Button>
      </div>
      <div className="mt-3 space-y-2">
        {activeProjects.length === 0 ? (
          <Card className="shadow-sm border"><CardContent className="py-10 text-center text-sm text-muted-foreground">Aucun projet actif.</CardContent></Card>
        ) : activeProjects.map((p: any) => {
          const progress = Number(p.progress || 0);
          return (
            <Link key={p.id} href={`/projets/${p.id}`}
              className="flex items-center gap-4 p-4 rounded-xl border border bg-card hover:border-primary/40 hover:shadow-sm transition-all group">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><FolderKanban className="w-4 h-4 text-primary" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-4 mb-1.5">
                  <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{p.name}</p>
                  <p className="text-sm font-bold text-foreground shrink-0 tabular-nums">{formatFCFACompact(Number(p.budget || 0))}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={progress} className="h-1.5 flex-1" />
                  <span className="text-xs font-semibold text-muted-foreground w-9 text-right">{progress}%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{p.clientName || "Client interne"}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
