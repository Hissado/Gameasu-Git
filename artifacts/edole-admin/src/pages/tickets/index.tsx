import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LifeBuoy, Plus, Search, Filter, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Ticket = {
  id: string;
  subject: string;
  description?: string | null;
  category: string;
  priority: string;
  status: string;
  createdById?: string | null;
  assigneeId?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  createdBy?: { id: string; firstName: string; lastName: string; email: string } | null;
};

const STATUSES = [
  { v: "open", l: "Ouvert", c: "bg-blue-100 text-blue-800 border-blue-300" },
  { v: "in_progress", l: "En cours", c: "bg-amber-100 text-amber-800 border-amber-300" },
  { v: "resolved", l: "Résolu", c: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  { v: "closed", l: "Clôturé", c: "bg-muted text-foreground border" },
];
const PRIORITIES = [
  { v: "low", l: "Faible", c: "bg-muted text-foreground" },
  { v: "medium", l: "Moyenne", c: "bg-blue-100 text-blue-800" },
  { v: "high", l: "Haute", c: "bg-amber-100 text-amber-800" },
  { v: "urgent", l: "Urgente", c: "bg-red-100 text-red-800" },
];
const CATEGORIES = [
  { v: "bug", l: "Anomalie" },
  { v: "request", l: "Demande" },
  { v: "incident", l: "Incident" },
  { v: "question", l: "Question" },
  { v: "other", l: "Autre" },
  { v: "access", l: "Accès" },
  { v: "sync", l: "Synchronisation" },
  { v: "user_management", l: "Gestion utilisateurs" },
  { v: "technical", l: "Technique" },
];

const findStatus = (v: string) => STATUSES.find((s) => s.v === v) || { v, l: v, c: "bg-muted" };
const findPrio = (v: string) => PRIORITIES.find((p) => p.v === v) || { v, l: v, c: "bg-muted" };
const findCat = (v: string) => CATEGORIES.find((c) => c.v === v) || { v, l: v };

export default function TicketsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [open, setOpen] = useState(false);
  const empty = { subject: "", description: "", category: "request", priority: "medium" };
  const [form, setForm] = useState(empty);

  const { data, isLoading } = useQuery<{ data: Ticket[] }>({
    queryKey: ["tickets", search, status, priority],
    queryFn: () => apiFetch(`/api/tickets?search=${encodeURIComponent(search)}&status=${status}&priority=${priority}`),
  });
  const { data: stats } = useQuery<{ total: number; byStatus: Record<string, number> }>({
    queryKey: ["tickets-stats"],
    queryFn: () => apiFetch("/api/tickets/stats"),
  });

  const create = useMutation({
    mutationFn: () => apiFetch("/api/tickets", { method: "POST", body: form }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tickets"] }); qc.invalidateQueries({ queryKey: ["tickets-stats"] }); setOpen(false); setForm(empty); toast({ title: "Ticket créé" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiFetch(`/api/tickets/${id}`, { method: "PUT", body: { status } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tickets"] }); qc.invalidateQueries({ queryKey: ["tickets-stats"] }); toast({ title: "Statut mis à jour" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3"><LifeBuoy className="w-7 h-7 text-primary" /> Support & Demandes</h1>
          <p className="text-muted-foreground mt-1">Tickets internes pour signaler bugs, incidents et demandes d'assistance.</p>
        </div>
        <Button onClick={() => { setForm(empty); setOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Nouveau ticket</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground font-bold">Total</div><div className="text-3xl font-bold mt-1 text-primary">{stats?.total ?? 0}</div></CardContent></Card>
        {STATUSES.map((s) => (
          <Card key={s.v}>
            <CardContent className="p-5">
              <div className="text-xs uppercase text-muted-foreground font-bold">{s.l}</div>
              <div className="text-3xl font-bold mt-1">{stats?.byStatus?.[s.v] ?? 0}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="border-b py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-64"><Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" /><Input placeholder="Rechercher un sujet…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" /></div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded h-10 px-3 text-sm">
              <option value="">Tous statuts</option>
              {STATUSES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="border rounded h-10 px-3 text-sm">
              <option value="">Toutes priorités</option>
              {PRIORITIES.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Sujet</th>
                <th className="text-left p-3">Catégorie</th>
                <th className="text-left p-3">Priorité</th>
                <th className="text-left p-3">Créé par</th>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Chargement…</td></tr>
                : (data?.data ?? []).length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Aucun ticket pour le moment.</td></tr>
                : data!.data.map((t) => {
                  const s = findStatus(t.status);
                  const p = findPrio(t.priority);
                  const c = findCat(t.category);
                  return (
                    <tr key={t.id} className="border-b hover:bg-muted/20 align-top">
                      <td className="p-3">
                        <div className="font-medium">{t.subject}</div>
                        {t.description && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{t.description}</div>}
                      </td>
                      <td className="p-3"><Badge variant="outline">{c.l}</Badge></td>
                      <td className="p-3"><Badge variant="outline" className={p.c}>{p.l}</Badge></td>
                      <td className="p-3 text-xs text-muted-foreground">{t.createdBy ? `${t.createdBy.firstName} ${t.createdBy.lastName}`.trim() || t.createdBy.email : "—"}</td>
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(t.createdAt).toLocaleDateString("fr-FR")}</td>
                      <td className="p-3">
                        <select
                          value={t.status}
                          onChange={(e) => updateStatus.mutate({ id: t.id, status: e.target.value })}
                          className={`border rounded px-2 py-1 text-xs font-medium ${s.c}`}
                        >
                          {STATUSES.map((opt) => <option key={opt.v} value={opt.v}>{opt.l}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau ticket de support</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Sujet *</label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Résumé en une ligne" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Catégorie</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border rounded h-10 px-3 text-sm">
                  {CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Priorité</label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full border rounded h-10 px-3 text-sm">
                  {PRIORITIES.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Description</label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={5} placeholder="Détaillez le contexte, les étapes pour reproduire, l'impact attendu…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || form.subject.trim().length < 3}>Créer le ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
