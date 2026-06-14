import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ScrollText, Search, RefreshCw } from "lucide-react";

type AuditLog = {
  id: string; action: string; resource: string; resourceId: string | null;
  metadata: unknown; createdAt: string;
  actorEmail: string | null; actorName: string | null;
};

const ACTION_COLORS: Record<string, string> = {
  "ticket.update":    "bg-blue-50 text-blue-700 border-blue-200",
  "ticket.comment":   "bg-indigo-50 text-indigo-700 border-indigo-200",
  "incident.create":  "bg-red-50 text-red-700 border-red-200",
  "incident.update":  "bg-orange-50 text-orange-700 border-orange-200",
  "org.suspend":      "bg-rose-50 text-rose-700 border-rose-200",
  "org.reactivate":   "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const RESOURCE_ICONS: Record<string, string> = {
  ticket: "🎫", incident: "🚨", org: "🏢", user: "👤", plan: "💳",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export default function AuditPage() {
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);

  const { data, isLoading, isFetching, refetch } = useQuery<{ total: number; rows: AuditLog[] }>({
    queryKey: ["cockpit-audit", limit],
    queryFn: () => apiFetch(`/api/super-admin/audit-logs?limit=${limit}`),
    refetchInterval: 60_000,
  });

  const rows = (data?.rows ?? []).filter((log) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.resource.toLowerCase().includes(q) ||
      (log.actorEmail ?? "").toLowerCase().includes(q) ||
      (log.actorName ?? "").toLowerCase().includes(q) ||
      (log.resourceId ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Cockpit</p>
          <h1 className="text-2xl font-bold tracking-tight">Journal d'audit</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {data?.total ?? 0} entrées au total · {data?.rows.length ?? 0} affichées
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Filtrer par action, ressource, acteur…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {([50, 100, 200] as const).map((n) => (
            <Button key={n} size="sm" variant={limit === n ? "default" : "outline"} className="h-8 text-xs" onClick={() => setLimit(n)}>
              {n} dernières
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-primary" />
            Événements ({rows.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {search ? "Aucun événement correspondant à votre recherche" : "Aucune entrée dans le journal"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-44">Date</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Ressource</TableHead>
                    <TableHead>Acteur</TableHead>
                    <TableHead>Détails</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((log) => (
                    <TableRow key={log.id} className="font-mono text-xs">
                      <TableCell className="whitespace-nowrap text-muted-foreground font-sans">
                        {fmtDate(log.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] font-mono ${ACTION_COLORS[log.action] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5">
                          <span>{RESOURCE_ICONS[log.resource] ?? "📋"}</span>
                          <span className="text-foreground font-sans text-xs">{log.resource}</span>
                          {log.resourceId && (
                            <span className="text-muted-foreground font-mono text-[10px] hidden sm:inline">
                              {log.resourceId.slice(0, 8)}…
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="font-sans">
                        <div>
                          {log.actorName && <p className="text-xs font-medium">{log.actorName}</p>}
                          {log.actorEmail && <p className="text-[10px] text-muted-foreground">{log.actorEmail}</p>}
                          {!log.actorName && !log.actorEmail && <span className="text-muted-foreground text-xs">Système</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.metadata ? (
                          <pre className="text-[10px] text-muted-foreground max-w-xs truncate bg-muted/40 px-2 py-1 rounded font-mono">
                            {JSON.stringify(log.metadata).slice(0, 80)}
                          </pre>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
