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
import { Plus, Star } from "lucide-react";

const API = "/api";
async function fetchJSON(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("auth_token");
  const r = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? r.statusText); }
  return r.json();
}

const STATUS_LABELS: Record<string, string> = { draft: "Brouillon", submitted: "Soumis", acknowledged: "Validé", validated: "Approuvé" };
const STATUS_COLORS: Record<string, "default" | "secondary" | "outline"> = { draft: "secondary", submitted: "default", acknowledged: "outline", validated: "default" };
const RATING_LABELS: Record<number, string> = { 1: "Insuffisant", 2: "En développement", 3: "Satisfaisant", 4: "Bien", 5: "Excellent" };
const TYPE_LABELS: Record<string, string> = { annual: "Annuelle", semi_annual: "Semestrielle", quarterly: "Trimestrielle", probation: "Période d'essai", "360": "360°" };

function RatingStars({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{RATING_LABELS[rating]}</span>
    </div>
  );
}

export default function EvaluationsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [form, setForm] = useState({
    collaboratorId: "", type: "annual", period: String(new Date().getFullYear()),
    reviewDate: "", overallRating: "", strengths: "", areasForImprovement: "", goals: "", notes: "",
  });

  const { data: evaluations = [], isLoading } = useQuery<any[]>({
    queryKey: ["hr-evaluations"],
    queryFn: () => fetchJSON(`${API}/hr/evaluations`),
  });

  const { data: collaborators = [] } = useQuery<any[]>({
    queryKey: ["collaborators-list"],
    queryFn: () => fetchJSON(`${API}/collaborators`).then((r) => r.data ?? r),
  });

  const { data: detail } = useQuery<any>({
    queryKey: ["hr-evaluation", detailId],
    queryFn: () => fetchJSON(`${API}/hr/evaluations/${detailId}`),
    enabled: !!detailId,
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => fetchJSON(`${API}/hr/evaluations`, {
      method: "POST",
      body: JSON.stringify({ ...d, overallRating: d.overallRating ? Number(d.overallRating) : undefined }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-evaluations"] }); setOpen(false); toast({ title: "Évaluation créée" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetchJSON(`${API}/hr/evaluations/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-evaluations"] }); qc.invalidateQueries({ queryKey: ["hr-evaluation", detailId] }); toast({ title: "Statut mis à jour" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const avgRating = evaluations.filter((e) => e.overallRating).reduce((s, e) => s + e.overallRating, 0) /
    (evaluations.filter((e) => e.overallRating).length || 1);

  return (
    <HrShell title="Évaluations de performance" subtitle="Suivi des évaluations annuelles et périodiques">
      <div className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total", value: evaluations.length },
            { label: "En cours", value: evaluations.filter((e) => e.status === "draft" || e.status === "submitted").length },
            { label: "Validées", value: evaluations.filter((e) => e.status === "acknowledged" || e.status === "validated").length },
            { label: "Note moyenne", value: evaluations.filter((e) => e.overallRating).length ? avgRating.toFixed(1) + " / 5" : "—" },
          ].map((k) => (
            <Card key={k.label}><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{k.label}</p><p className="text-2xl font-bold">{k.value}</p></CardContent></Card>
          ))}
        </div>

        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Toutes les évaluations</h2>
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" />Nouvelle évaluation</Button>
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-muted-foreground">Chargement…</div>
        ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Collaborateur</TableHead>
                <TableHead className="hidden sm:table-cell">Département</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead className="hidden md:table-cell">Période</TableHead>
                <TableHead className="hidden md:table-cell">Date entretien</TableHead>
                <TableHead>Note globale</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evaluations.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Aucune évaluation</TableCell></TableRow>
              )}
              {evaluations.map((ev: any) => (
                <TableRow key={ev.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setDetailId(ev.id === detailId ? null : ev.id)}>
                  <TableCell className="font-medium">{ev.collaboratorName}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{ev.department ?? "—"}</TableCell>
                  <TableCell className="hidden sm:table-cell">{TYPE_LABELS[ev.type] ?? ev.type}</TableCell>
                  <TableCell className="hidden md:table-cell">{ev.period}</TableCell>
                  <TableCell className="hidden md:table-cell">{ev.reviewDate ?? "—"}</TableCell>
                  <TableCell><RatingStars rating={ev.overallRating} /></TableCell>
                  <TableCell><Badge variant={STATUS_COLORS[ev.status]}>{STATUS_LABELS[ev.status] ?? ev.status}</Badge></TableCell>
                  <TableCell>
                    {ev.status === "draft" && (
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: ev.id, status: "submitted" }); }}>
                        Soumettre
                      </Button>
                    )}
                    {ev.status === "submitted" && (
                      <Button size="sm" onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: ev.id, status: "acknowledged" }); }}>
                        Valider
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}

        {/* Détail inline */}
        {detail && detailId && (
          <Card className="border-primary/30">
            <CardContent className="pt-5 space-y-4">
              <h3 className="font-semibold text-base">{detail.collaboratorName} — {TYPE_LABELS[detail.type] ?? detail.type} {detail.period}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div><p className="text-muted-foreground mb-1">Points forts</p><p>{detail.strengths || "—"}</p></div>
                <div><p className="text-muted-foreground mb-1">Axes d'amélioration</p><p>{detail.areasForImprovement || "—"}</p></div>
                <div><p className="text-muted-foreground mb-1">Objectifs</p><p>{detail.goals || "—"}</p></div>
              </div>
              {detail.notes && <div className="text-sm"><p className="text-muted-foreground mb-1">Notes</p><p>{detail.notes}</p></div>}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouvelle évaluation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Collaborateur *</Label>
              <Select value={form.collaboratorId} onValueChange={(v) => setForm({ ...form, collaboratorId: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>{(Array.isArray(collaborators) ? collaborators : []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Période</Label><Input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="2026 ou 2026-Q1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date d'entretien</Label><Input type="date" value={form.reviewDate} onChange={(e) => setForm({ ...form, reviewDate: e.target.value })} /></div>
              <div>
                <Label>Note globale (1-5)</Label>
                <Select value={form.overallRating} onValueChange={(v) => setForm({ ...form, overallRating: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n} — {RATING_LABELS[n]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Points forts</Label><Textarea value={form.strengths} onChange={(e) => setForm({ ...form, strengths: e.target.value })} rows={2} /></div>
            <div><Label>Axes d'amélioration</Label><Textarea value={form.areasForImprovement} onChange={(e) => setForm({ ...form, areasForImprovement: e.target.value })} rows={2} /></div>
            <div><Label>Objectifs</Label><Textarea value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
