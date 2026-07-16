import React, { useState } from "react";
import { HrShell } from "./_layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatFCFA } from "@/lib/format";
import { Plus, ArrowRight } from "lucide-react";

const API = "/api";
async function fetchJSON(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("auth_token");
  const r = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? r.statusText); }
  return r.json();
}

const MOVEMENT_TYPES: Record<string, { label: string; color: string }> = {
  promotion: { label: "Promotion", color: "bg-green-100 text-green-700 border-green-300" },
  mutation: { label: "Mutation", color: "bg-blue-100 text-blue-700 border-blue-300" },
  reclassification: { label: "Reclassification", color: "bg-orange-100 text-orange-700 border-orange-300" },
  departure: { label: "Départ", color: "bg-red-100 text-red-700 border-red-300" },
  retirement: { label: "Retraite", color: "bg-purple-100 text-purple-700 border-purple-300" },
  disciplinary: { label: "Disciplinaire", color: "bg-muted text-foreground border" },
};

export default function MovementsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [form, setForm] = useState({
    collaboratorId: "", type: "promotion", effectiveDate: "",
    previousSalary: "", newSalary: "", reason: "", notes: "",
  });

  const { data: movements = [], isLoading } = useQuery<any[]>({
    queryKey: ["hr-movements", filterType],
    queryFn: () => fetchJSON(`${API}/hr/movements${filterType !== "all" ? `?type=${filterType}` : ""}`),
  });

  const { data: collaborators = [] } = useQuery<any[]>({
    queryKey: ["collaborators-list"],
    queryFn: () => fetchJSON(`${API}/collaborators`).then((r) => r.data ?? r),
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => fetchJSON(`${API}/hr/movements`, {
      method: "POST",
      body: JSON.stringify({
        ...d,
        previousSalary: d.previousSalary ? Number(d.previousSalary) : undefined,
        newSalary: d.newSalary ? Number(d.newSalary) : undefined,
      }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-movements"] }); setOpen(false); toast({ title: "Mouvement enregistré" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const countByType = (type: string) => movements.filter((m: any) => m.type === type).length;

  return (
    <HrShell title="Mouvements du personnel" subtitle="Promotions, mutations, départs et reclassifications">
      <div className="space-y-6">
        {/* KPIs par type */}
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(MOVEMENT_TYPES).map(([k, v]) => (
            <Card key={k} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterType(filterType === k ? "all" : k)}>
              <CardContent className="pt-3 pb-2 text-center">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${v.color} mb-1`}>{v.label}</span>
                <p className="text-2xl font-bold">{countByType(k)}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-between items-center">
          <div className="flex gap-2 items-center">
            <h2 className="text-lg font-semibold">Historique des mouvements</h2>
            {filterType !== "all" && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => setFilterType("all")}>
                {MOVEMENT_TYPES[filterType]?.label} ×
              </Badge>
            )}
          </div>
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" />Enregistrer un mouvement</Button>
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-muted-foreground">Chargement…</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date effective</TableHead>
                <TableHead>Collaborateur</TableHead>
                <TableHead>Département</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Évolution salariale</TableHead>
                <TableHead>Motif</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Aucun mouvement enregistré</TableCell></TableRow>
              )}
              {movements.map((m: any) => {
                const typeInfo = MOVEMENT_TYPES[m.type];
                const salaryChanged = m.previousSalary != null && m.newSalary != null;
                const salaryDelta = salaryChanged ? m.newSalary - m.previousSalary : 0;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.effectiveDate}</TableCell>
                    <TableCell>{m.collaboratorName}</TableCell>
                    <TableCell className="text-muted-foreground">{m.department ?? "—"}</TableCell>
                    <TableCell>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${typeInfo?.color ?? ""}`}>
                        {typeInfo?.label ?? m.type}
                      </span>
                    </TableCell>
                    <TableCell>
                      {salaryChanged ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className="text-muted-foreground">{formatFCFA(m.previousSalary)}</span>
                          <ArrowRight className="w-3 h-3" />
                          <span className="font-medium">{formatFCFA(m.newSalary)}</span>
                          <span className={`text-xs ${salaryDelta >= 0 ? "text-green-600" : "text-red-600"}`}>
                            ({salaryDelta >= 0 ? "+" : ""}{formatFCFA(salaryDelta)})
                          </span>
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">{m.reason || "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Enregistrer un mouvement</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Collaborateur *</Label>
              <Select value={form.collaboratorId} onValueChange={(v) => setForm({ ...form, collaboratorId: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>{collaborators.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type de mouvement *</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(MOVEMENT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Date effective *</Label><Input type="date" value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Salaire précédent (FCFA)</Label><Input type="number" value={form.previousSalary} onChange={(e) => setForm({ ...form, previousSalary: e.target.value })} /></div>
              <div><Label>Nouveau salaire (FCFA)</Label><Input type="number" value={form.newSalary} onChange={(e) => setForm({ ...form, newSalary: e.target.value })} /></div>
            </div>
            <div><Label>Motif</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
