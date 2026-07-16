/**
 * Phase 11 — Notifications IA : digest groupé intelligent.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, BellRing, Check, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Sample = { id: string; title: string; body: string; entityType: string | null; entityId: string | null; createdAt: string };
type Group = { key: string; type: string; entityType: string | null; label: string; count: number; unread: number; latestAt: string; priority: number; samples: Sample[] };
type Highlight = { id: string; title: string; body: string; type: string; entityType: string | null; entityId: string | null; createdAt: string };
type Digest = { window: "day" | "week"; total: number; unread: number; groups: Group[]; highlights: Highlight[] };

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

export default function NotificationsDigestPage() {
  const [window, setWindow] = useState<"day" | "week">("day");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const qc = useQueryClient();

  const digest = useQuery<Digest>({
    queryKey: ["notif-digest", window],
    queryFn: () => apiFetch(`/api/notifications/digest?window=${window}`),
  });

  const markRead = useMutation({
    mutationFn: (payload: { ids?: string[]; type?: string }) =>
      apiFetch("/api/notifications/digest/mark-read", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: (r: any) => {
      toast({ title: `${r.updated} notification(s) marquée(s) comme lues` });
      qc.invalidateQueries({ queryKey: ["notif-digest"] });
    },
  });

  const toggle = (k: string) => {
    const next = new Set(expanded);
    next.has(k) ? next.delete(k) : next.add(k);
    setExpanded(next);
  };

  if (digest.isLoading || !digest.data) return <div className="py-12 text-center"><Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground" /></div>;
  const d = digest.data;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Notifications IA</p>
        <h1 className="text-3xl font-bold tracking-tight">Digest intelligent</h1>
        <p className="text-muted-foreground mt-1">Vos notifications regroupées par catégorie, priorisées par urgence et volume.</p>
      </div>

      <div className="flex gap-2 items-center">
        <span className="text-sm text-muted-foreground">Période :</span>
        <Button size="sm" variant={window === "day" ? "default" : "outline"} onClick={() => setWindow("day")}>Aujourd'hui</Button>
        <Button size="sm" variant={window === "week" ? "default" : "outline"} onClick={() => setWindow("week")}>7 jours</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold">Total</p><p className="text-2xl font-bold">{d.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold">Non lues</p><p className="text-2xl font-bold text-primary">{d.unread}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold">Catégories</p><p className="text-2xl font-bold">{d.groups.length}</p></CardContent></Card>
      </div>

      {d.highlights.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/40">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-orange-600" />À traiter en priorité</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {d.highlights.map((h) => (
              <div key={h.id} className="border bg-card rounded p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{h.title}</p>
                    <p className="text-xs text-muted-foreground">{h.body}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant="outline">{h.type}</Badge>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{formatRelativeTime(h.createdAt)}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><BellRing className="w-4 h-4" />Catégories priorisées</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {d.groups.length === 0 && <p className="text-xs italic text-muted-foreground py-4 text-center">Aucune notification sur cette période.</p>}
          {d.groups.map((g) => {
            const isExp = expanded.has(g.key);
            return (
              <div key={g.key} className="border rounded">
                <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/40" onClick={() => toggle(g.key)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={g.priority >= 70 ? "bg-red-50 text-red-700 border-red-200" : g.priority >= 40 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"}>P{g.priority}</Badge>
                    <span className="font-medium text-sm">{g.label}</span>
                    {g.entityType && <span className="text-xs text-muted-foreground">· {g.entityType}</span>}
                    <Badge variant="secondary" className="text-[10px]">{g.unread} non lue(s) / {g.count}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{formatRelativeTime(g.latestAt)}</span>
                    {g.unread > 0 && (
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); markRead.mutate({ type: g.type, ...(g.entityType ? { entityType: g.entityType } : {}) }); }}>
                        <Check className="w-3 h-3 mr-1" />Tout lire
                      </Button>
                    )}
                    {isExp ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>
                {isExp && g.samples.length > 0 && (
                  <div className="border-t bg-muted/20 px-3 py-2 space-y-1.5">
                    {g.samples.map((s) => (
                      <div key={s.id} className="flex items-start justify-between gap-2 py-1">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{s.title}</p>
                          <p className="text-xs text-muted-foreground">{s.body}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-muted-foreground">{formatRelativeTime(s.createdAt)}</span>
                          <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => markRead.mutate({ ids: [s.id] })}>
                            <Check className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
