import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { HrShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Position = { id: string; code: string; title: string; departmentId?: string; departmentName?: string; level?: number; description?: string };
type Dept = { id: string; name: string };

export default function PositionsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", title: "", departmentId: "", level: 1, description: "" });

  const { data } = useQuery<{ data: Position[] }>({ queryKey: ["hr-positions"], queryFn: () => apiFetch("/api/hr/positions") });
  const { data: depts } = useQuery<{ data: Dept[] }>({ queryKey: ["hr-departments"], queryFn: () => apiFetch("/api/hr/departments") });

  const createMut = useMutation({
    mutationFn: () => apiFetch("/api/hr/positions", { method: "POST", body: JSON.stringify({ ...form, departmentId: form.departmentId || null }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-positions"] }); setOpen(false); setForm({ code: "", title: "", departmentId: "", level: 1, description: "" }); toast({ title: "Poste créé" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/hr/positions/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-positions"] }); toast({ title: "Supprimé" }); },
  });

  const levelLabel = (l?: number) => ({ 1: "Junior", 2: "Confirmé", 3: "Senior", 4: "Lead", 5: "Direction" } as any)[l ?? 1] ?? "—";

  return (
    <HrShell
      title="Postes / Fonctions"
      subtitle="Postes par département"
      actions={<Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> Nouveau poste</Button>}
    >
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-3">Intitulé</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Département</th>
                <th className="px-4 py-3">Niveau</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(!data?.data || data.data.length === 0) && (
                <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">Aucun poste. Créez votre premier poste.</td></tr>
              )}
              {data?.data.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{p.title}</td>
                  <td className="px-4 py-3"><Badge variant="outline" className="font-mono text-xs">{p.code}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{p.departmentName || "—"}</td>
                  <td className="px-4 py-3"><Badge>{levelLabel(p.level)}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Supprimer ${p.title} ?`)) delMut.mutate(p.id); }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau poste</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Code</label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></div>
              <div><label className="text-sm font-medium">Niveau</label>
                <Select value={String(form.level)} onValueChange={(v) => setForm({ ...form, level: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 — Junior</SelectItem>
                    <SelectItem value="2">2 — Confirmé</SelectItem>
                    <SelectItem value="3">3 — Senior</SelectItem>
                    <SelectItem value="4">4 — Lead</SelectItem>
                    <SelectItem value="5">5 — Direction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><label className="text-sm font-medium">Intitulé</label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><label className="text-sm font-medium">Département</label>
              <Select value={form.departmentId} onValueChange={(v) => setForm({ ...form, departmentId: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {depts?.data.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium">Description</label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => createMut.mutate()} disabled={!form.code || !form.title || createMut.isPending}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
