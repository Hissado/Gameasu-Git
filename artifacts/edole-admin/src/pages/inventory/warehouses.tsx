import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Warehouse, Package, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";

const API = "/api";
async function fetchJSON(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("auth_token");
  const r = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? r.statusText); }
  return r.json();
}

const TYPE_LABELS: Record<string, string> = {
  principal: "Principal", secondaire: "Secondaire", transit: "Transit", externe: "Externe",
};

export function WarehousesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", location: "", address: "", type: "principal", notes: "" });

  const { data: warehouses = [], isLoading } = useQuery<any[]>({
    queryKey: ["warehouses"],
    queryFn: () => fetchJSON(`${API}/inventory/warehouses`),
  });

  const { data: detail } = useQuery<any>({
    queryKey: ["warehouse-detail", expanded],
    queryFn: () => fetchJSON(`${API}/inventory/warehouses/${expanded}`),
    enabled: !!expanded,
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => fetchJSON(`${API}/inventory/warehouses`, { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["warehouses"] }); setOpen(false); toast({ title: "Magasin créé" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Warehouse className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Magasins / Dépôts</h2>
          <Badge variant="secondary">{warehouses.length}</Badge>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" />Nouveau magasin</Button>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">Chargement…</div>
      ) : warehouses.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground">Aucun magasin configuré</div>
      ) : (
        <div className="space-y-2">
          {warehouses.map((w: any) => {
            const isExp = expanded === w.id;
            return (
              <Card key={w.id} className="overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpanded(isExp ? null : w.id)}
                >
                  <div className="flex items-center gap-3">
                    {isExp ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <div>
                      <span className="font-mono text-xs text-muted-foreground mr-2">{w.code}</span>
                      <span className="font-semibold">{w.name}</span>
                      {w.location && <span className="ml-2 text-sm text-muted-foreground">· {w.location}</span>}
                    </div>
                    <Badge variant="outline">{TYPE_LABELS[w.type] ?? w.type}</Badge>
                    {!w.isActive && <Badge variant="secondary">Inactif</Badge>}
                  </div>
                </div>
                {isExp && detail?.id === w.id && (
                  <div className="border-t p-4 space-y-3">
                    {w.address && <p className="text-sm text-muted-foreground"><strong>Adresse :</strong> {w.address}</p>}
                    {w.notes && <p className="text-sm text-muted-foreground">{w.notes}</p>}
                    <h4 className="font-medium text-sm">Stock dans ce magasin</h4>
                    {detail.stock?.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucun stock enregistré</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Référence</TableHead>
                            <TableHead>Produit</TableHead>
                            <TableHead className="text-right">Quantité</TableHead>
                            <TableHead>Unité</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(detail.stock ?? []).map((s: any) => (
                            <TableRow key={s.productId}>
                              <TableCell className="font-mono text-xs">{s.productCode}</TableCell>
                              <TableCell>{s.productName}</TableCell>
                              <TableCell className={`text-right font-medium ${s.qty <= 0 ? "text-red-600" : ""}`}>
                                {Number(s.qty).toLocaleString("fr-FR")}
                              </TableCell>
                              <TableCell className="text-muted-foreground">{s.unit}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau magasin / dépôt</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Code *</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="ex: MAG-001" /></div>
              <div><Label>Nom *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Localisation</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Ville / Zone" /></div>
            <div><Label>Adresse complète</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function InternalRequestsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [form, setForm] = useState({
    reference: "", requesterDepartment: "", neededDate: "", priority: "normal", notes: "",
    lines: [{ description: "", quantity: "1", unit: "pcs" }],
  });

  const { data: requests = [], isLoading } = useQuery<any[]>({
    queryKey: ["internal-requests", filterStatus],
    queryFn: () => fetchJSON(`${API}/inventory/requests${filterStatus !== "all" ? `?status=${filterStatus}` : ""}`),
  });

  const { data: detail } = useQuery<any>({
    queryKey: ["internal-request-detail", expanded],
    queryFn: () => fetchJSON(`${API}/inventory/requests/${expanded}`),
    enabled: !!expanded,
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => fetchJSON(`${API}/inventory/requests`, {
      method: "POST",
      body: JSON.stringify({
        ...d,
        lines: d.lines.filter((l) => l.description || l.quantity),
      }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["internal-requests"] }); setOpen(false); toast({ title: "Demande créée" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const approveMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetchJSON(`${API}/inventory/requests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["internal-requests"] }),
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const STATUS_LABELS: Record<string, string> = {
    draft: "Brouillon", submitted: "Soumis", approved: "Approuvé",
    rejected: "Rejeté", fulfilled: "Servi", cancelled: "Annulé",
  };
  const STATUS_COLORS: Record<string, "default" | "secondary" | "outline"> = {
    draft: "secondary", submitted: "default", approved: "default",
    rejected: "outline", fulfilled: "outline", cancelled: "outline",
  };
  const PRIORITY_LABELS: Record<string, string> = { low: "Bas", normal: "Normal", high: "Élevé", urgent: "Urgent" };
  const PRIORITY_COLORS: Record<string, string> = {
    low: "text-muted-foreground", normal: "text-blue-600", high: "text-orange-600", urgent: "text-red-600 font-semibold",
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Demandes internes</h2>
          <Badge variant="secondary">{requests.length}</Badge>
        </div>
        <div className="flex gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" />Nouvelle demande</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">Chargement…</div>
      ) : requests.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground">Aucune demande</div>
      ) : (
        <div className="space-y-2">
          {requests.map((r: any) => {
            const isExp = expanded === r.id;
            return (
              <Card key={r.id} className="overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30"
                  onClick={() => setExpanded(isExp ? null : r.id)}
                >
                  <div className="flex items-center gap-3">
                    {isExp ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <span className="font-mono text-xs font-medium">{r.reference}</span>
                    {r.requesterDepartment && <span className="text-sm text-muted-foreground">{r.requesterDepartment}</span>}
                    <Badge variant={STATUS_COLORS[r.status]}>{STATUS_LABELS[r.status] ?? r.status}</Badge>
                    <span className={`text-xs ${PRIORITY_COLORS[r.priority] ?? ""}`}>{PRIORITY_LABELS[r.priority] ?? r.priority}</span>
                    {r.priority === "urgent" && <AlertTriangle className="w-4 h-4 text-red-500" />}
                  </div>
                  <div className="flex items-center gap-3">
                    {r.neededDate && <span className="text-sm text-muted-foreground">Besoin le {r.neededDate}</span>}
                    <span className="text-sm text-muted-foreground">{r.lineCount ?? 0} article(s)</span>
                    {r.status === "submitted" && (
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" onClick={() => approveMut.mutate({ id: r.id, status: "approved" })}>Approuver</Button>
                        <Button size="sm" variant="outline" onClick={() => approveMut.mutate({ id: r.id, status: "rejected" })}>Rejeter</Button>
                      </div>
                    )}
                    {r.status === "draft" && (
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); approveMut.mutate({ id: r.id, status: "submitted" }); }}>
                        Soumettre
                      </Button>
                    )}
                  </div>
                </div>
                {isExp && detail?.id === r.id && (
                  <div className="border-t p-4 space-y-3">
                    {r.notes && <p className="text-sm text-muted-foreground">{r.notes}</p>}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Article / Description</TableHead>
                          <TableHead className="text-right">Qté demandée</TableHead>
                          <TableHead className="text-right">Qté servie</TableHead>
                          <TableHead>Unité</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(detail.lines ?? []).map((l: any) => (
                          <TableRow key={l.id}>
                            <TableCell>{l.productName ?? l.description ?? "—"}</TableCell>
                            <TableCell className="text-right">{Number(l.quantity).toLocaleString("fr-FR")}</TableCell>
                            <TableCell className="text-right">{Number(l.servedQuantity ?? 0).toLocaleString("fr-FR")}</TableCell>
                            <TableCell>{l.unit}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouvelle demande interne</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Référence *</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="ex: DI-2026-001" /></div>
              <div><Label>Département demandeur</Label><Input value={form.requesterDepartment} onChange={(e) => setForm({ ...form, requesterDepartment: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date de besoin</Label><Input type="date" value={form.neededDate} onChange={(e) => setForm({ ...form, neededDate: e.target.value })} /></div>
              <div>
                <Label>Priorité</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[["low", "Bas"], ["normal", "Normal"], ["high", "Élevé"], ["urgent", "Urgent"]].map(([k, v]) =>
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Articles demandés</Label>
              {form.lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-5 gap-1 mt-1">
                  <Input className="col-span-3" placeholder="Description" value={line.description}
                    onChange={(e) => setForm({ ...form, lines: form.lines.map((l, i) => i === idx ? { ...l, description: e.target.value } : l) })} />
                  <Input type="number" placeholder="Qté" value={line.quantity}
                    onChange={(e) => setForm({ ...form, lines: form.lines.map((l, i) => i === idx ? { ...l, quantity: e.target.value } : l) })} />
                  <Input placeholder="Unité" value={line.unit}
                    onChange={(e) => setForm({ ...form, lines: form.lines.map((l, i) => i === idx ? { ...l, unit: e.target.value } : l) })} />
                </div>
              ))}
              <Button type="button" size="sm" variant="ghost" className="mt-1" onClick={() => setForm({ ...form, lines: [...form.lines, { description: "", quantity: "1", unit: "pcs" }] })}>
                + Ajouter une ligne
              </Button>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function WarehousesPage() {
  const [activeTab, setActiveTab] = useState<"warehouses" | "requests">("warehouses");
  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b pb-0">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "warehouses" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setActiveTab("warehouses")}
        >Magasins</button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "requests" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setActiveTab("requests")}
        >Demandes internes</button>
      </div>
      {activeTab === "warehouses" ? <WarehousesTab /> : <InternalRequestsTab />}
    </div>
  );
}
