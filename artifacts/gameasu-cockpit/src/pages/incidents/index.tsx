import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertTriangle, Plus, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

type Incident = {
  id: string; title: string; description: string | null;
  severity: string; status: string; affectedServices: string | null;
  resolvedAt: string | null; createdAt: string; updatedAt: string;
  createdByName: string | null;
};

const SEV_CFG: Record<string, { cls: string; label: string }> = {
  critical: { cls: "bg-red-100 text-red-800 border-red-300",    label: "Critique" },
  high:     { cls: "bg-orange-50 text-orange-700 border-orange-200", label: "Élevée" },
  medium:   { cls: "bg-yellow-50 text-yellow-700 border-yellow-200", label: "Moyenne" },
  low:      { cls: "bg-slate-100 text-slate-600 border-slate-200",  label: "Faible" },
};

const STATUS_CFG: Record<string, { cls: string; label: string; icon: React.FC<{ className?: string }> }> = {
  open:         { cls: "bg-red-50 text-red-700 border-red-200",     label: "Actif",    icon: XCircle },
  investigating:{ cls: "bg-amber-50 text-amber-700 border-amber-200", label: "Enquête", icon: AlertTriangle },
  monitoring:   { cls: "bg-blue-50 text-blue-700 border-blue-200",  label: "Surveillance", icon: AlertTriangle },
  resolved:     { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Résolu", icon: CheckCircle2 },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function IncidentsPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [form, setForm] = useState({ title: "", description: "", severity: "medium", affectedServices: "" });
  const [newStatus, setNewStatus] = useState("");

  const { data, isLoading } = useQuery<{ count: number; rows: Incident[] }>({
    queryKey: ["cockpit-incidents"],
    queryFn: () => apiFetch("/api/super-admin/incidents"),
    refetchInterval: 30_000,
  });

  const createIncident = useMutation({
    mutationFn: () => apiFetch("/api/super-admin/incidents", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cockpit-incidents"] });
      qc.invalidateQueries({ queryKey: ["cockpit-health"] });
      setCreating(false);
      setForm({ title: "", description: "", severity: "medium", affectedServices: "" });
      toast.success("Incident créé");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateIncident = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiFetch(`/api/super-admin/incidents/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cockpit-incidents"] });
      qc.invalidateQueries({ queryKey: ["cockpit-health"] });
      toast.success("Incident mis à jour");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const active = (data?.rows ?? []).filter((i) => i.status !== "resolved");
  const resolved = (data?.rows ?? []).filter((i) => i.status === "resolved");

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Cockpit</p>
          <h1 className="text-2xl font-bold tracking-tight">Incidents plateforme</h1>
          <p className="text-muted-foreground text-sm mt-1">{active.length} actif(s) · {resolved.length} résolu(s)</p>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-2">
          <Plus className="w-4 h-4" />Déclarer un incident
        </Button>
      </div>

      {active.length === 0 && !isLoading && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <p className="text-sm text-emerald-800 font-medium">Tous les systèmes sont opérationnels</p>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-primary" />Incidents ({data?.count ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
          ) : !data?.rows.length ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Aucun incident déclaré</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Incident</TableHead>
                    <TableHead>Sévérité</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Services affectés</TableHead>
                    <TableHead>Déclaré le</TableHead>
                    <TableHead>Résolu le</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.rows ?? []).map((inc) => {
                    const sCfg = STATUS_CFG[inc.status] ?? STATUS_CFG.open;
                    const SIcon = sCfg.icon;
                    return (
                      <TableRow key={inc.id} className={inc.status === "resolved" ? "opacity-60" : ""}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{inc.title}</p>
                            {inc.description && <p className="text-xs text-muted-foreground line-clamp-1">{inc.description}</p>}
                            {inc.createdByName && <p className="text-[10px] text-muted-foreground">par {inc.createdByName}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={(SEV_CFG[inc.severity] ?? SEV_CFG.medium).cls}>
                            {(SEV_CFG[inc.severity] ?? SEV_CFG.medium).label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={sCfg.cls}>
                            <SIcon className="w-3 h-3 mr-1" />{sCfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{inc.affectedServices ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(inc.createdAt)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {inc.resolvedAt ? fmtDate(inc.resolvedAt) : "—"}
                        </TableCell>
                        <TableCell>
                          {inc.status !== "resolved" && (
                            <Button
                              size="sm" variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => { setSelected(inc); setNewStatus(inc.status); }}
                            >
                              Modifier
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create incident dialog */}
      <Dialog open={creating} onOpenChange={(o) => { if (!o) setCreating(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Déclarer un incident</DialogTitle>
            <DialogDescription>Déclarez un incident affectant la plateforme Gameasu.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Titre *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="ex. API lente — timeout Auth" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Décrivez l'impact et la portée…" className="min-h-[80px]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Sévérité</Label>
                <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critique</SelectItem>
                    <SelectItem value="high">Élevée</SelectItem>
                    <SelectItem value="medium">Moyenne</SelectItem>
                    <SelectItem value="low">Faible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Services affectés</Label>
                <Input value={form.affectedServices} onChange={(e) => setForm({ ...form, affectedServices: e.target.value })} placeholder="API, Auth, Dashboard…" />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreating(false)}>Annuler</Button>
            <Button onClick={() => createIncident.mutate()} disabled={!form.title.trim() || createIncident.isPending}>
              {createIncident.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Déclarer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update incident dialog */}
      {selected && (
        <Dialog open onOpenChange={(o) => { if (!o) setSelected(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mettre à jour l'incident</DialogTitle>
              <DialogDescription className="font-medium">{selected.title}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nouveau statut</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Actif</SelectItem>
                    <SelectItem value="investigating">En enquête</SelectItem>
                    <SelectItem value="monitoring">Sous surveillance</SelectItem>
                    <SelectItem value="resolved">Résolu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSelected(null)}>Annuler</Button>
              <Button
                onClick={() => {
                  updateIncident.mutate({ id: selected.id, body: { status: newStatus } });
                  setSelected(null);
                }}
                disabled={updateIncident.isPending}
              >
                {updateIncident.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
