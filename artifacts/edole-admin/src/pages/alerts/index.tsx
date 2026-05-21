import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, RefreshCw, AlertTriangle, AlertCircle, Info, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { severityLabel } from "@/lib/intelligence";

type Alert = { id: string; kind: string; entityType?: string; entityId?: string; title: string; message?: string; severity: string; dueAt?: string; acknowledged: boolean; createdAt: string };

const SEV: Record<string, { color: string; icon: React.ComponentType<any> }> = {
  info: { color: "bg-blue-100 text-blue-700", icon: Info },
  warning: { color: "bg-amber-100 text-amber-700", icon: AlertTriangle },
  critical: { color: "bg-red-100 text-red-700", icon: AlertCircle },
};

const KIND_LABEL: Record<string, string> = {
  rental_return_soon: "Retour location proche",
  invoice_overdue: "Facture en retard",
  contract_expiring: "Contrat expirant",
  equipment_maintenance: "Équipement en maintenance",
};

const entityLink = (a: Alert): string | null => {
  if (!a.entityId) return null;
  switch (a.entityType) {
    case "rental": return `/rentals`;
    case "invoice": return `/invoices`;
    case "contract": return `/hr/contracts`;
    case "equipment": return `/equipment/${a.entityId}`;
    default: return null;
  }
};

export default function AlertsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: summary } = useQuery<{ openCount: number; bySeverity: any[]; byKind: any[] }>({
    queryKey: ["alerts-summary"],
    queryFn: () => apiFetch("/api/alerts/summary"),
  });
  const { data } = useQuery<{ data: Alert[] }>({
    queryKey: ["alerts", "open"],
    queryFn: () => apiFetch("/api/alerts?acknowledged=false&limit=200"),
  });

  const run = useMutation({
    mutationFn: () => apiFetch("/api/alerts/run", { method: "POST" }),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ["alerts"] }); qc.invalidateQueries({ queryKey: ["alerts-summary"] }); toast({ title: "Scan terminé", description: `${r.created} nouvelle(s) alerte(s).` }); },
  });

  const ack = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/alerts/${id}/ack`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["alerts"] }); qc.invalidateQueries({ queryKey: ["alerts-summary"] }); },
  });

  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/alerts/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["alerts"] }); qc.invalidateQueries({ queryKey: ["alerts-summary"] }); },
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3"><Bell className="w-7 h-7 text-primary" /> Alertes automatiques</h1>
          <p className="text-muted-foreground mt-1">Locations · Factures · Contrats · Équipements</p>
        </div>
        <Button variant="outline" onClick={() => run.mutate()} disabled={run.isPending}><RefreshCw className={`w-4 h-4 mr-2 ${run.isPending ? "animate-spin" : ""}`} /> Lancer un scan</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground font-bold">Alertes ouvertes</div><div className="text-3xl font-bold mt-1 text-primary">{summary?.openCount ?? 0}</div></CardContent></Card>
        {(summary?.bySeverity ?? []).map((s) => {
          const cfg = SEV[s.severity] || SEV.info;
          const Icon = cfg.icon;
          return <Card key={s.severity}><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground font-bold flex items-center gap-1"><Icon className="w-3 h-3" /> {severityLabel(s.severity)}</div><div className="text-3xl font-bold mt-1">{s.count}</div></CardContent></Card>;
        })}
      </div>

      <Card>
        <CardHeader className="border-b"><CardTitle className="text-base">Alertes en cours</CardTitle></CardHeader>
        <CardContent className="p-0">
          {(data?.data ?? []).length === 0 ? (
            <div className="p-12 text-center text-muted-foreground"><Check className="w-12 h-12 mx-auto mb-3 text-emerald-400" /> Aucune alerte ouverte. Tout est sous contrôle.</div>
          ) : (
            <ul className="divide-y">
              {data!.data.map((a) => {
                const cfg = SEV[a.severity] || SEV.info;
                const Icon = cfg.icon;
                const link = entityLink(a);
                return (
                  <li key={a.id} className="p-4 flex items-start gap-4 hover:bg-muted/20">
                    <div className={`p-2 rounded-md ${cfg.color}`}><Icon className="w-5 h-5" /></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{a.title}</span>
                        <Badge variant="outline" className="text-[10px]">{KIND_LABEL[a.kind] || a.kind}</Badge>
                      </div>
                      {a.message && <div className="text-sm text-muted-foreground mt-0.5">{a.message}</div>}
                      <div className="text-xs text-muted-foreground mt-1">Détectée le {new Date(a.createdAt).toLocaleString("fr-FR")}</div>
                    </div>
                    <div className="flex gap-1">
                      {link && <Link href={link}><Button size="sm" variant="outline">Ouvrir</Button></Link>}
                      <Button size="sm" variant="ghost" onClick={() => ack.mutate(a.id)}><Check className="w-4 h-4 mr-1" /> Acquitter</Button>
                      <Button size="icon" variant="ghost" onClick={() => del.mutate(a.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
