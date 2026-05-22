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
import { Plus, GraduationCap, Users, Clock, DollarSign, ChevronDown, ChevronRight } from "lucide-react";

const API = "/api";
async function fetchJSON(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("auth_token");
  const r = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? r.statusText); }
  return r.json();
}

const STATUS_LABELS: Record<string, string> = { planned: "Planifiée", ongoing: "En cours", completed: "Terminée", cancelled: "Annulée" };
const STATUS_COLORS: Record<string, "default" | "secondary" | "outline"> = { planned: "secondary", ongoing: "default", completed: "outline", cancelled: "outline" };
const TYPE_LABELS: Record<string, string> = { interne: "Interne", externe: "Externe", e_learning: "E-learning", conference: "Conférence", coaching: "Coaching" };

export default function TrainingPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [addParticipantOpen, setAddParticipantOpen] = useState<string | null>(null);
  const [participantCollab, setParticipantCollab] = useState("");
  const [form, setForm] = useState({
    title: "", type: "externe", provider: "", location: "",
    startDate: "", endDate: "", durationHours: "", cost: "", maxParticipants: "", notes: "",
  });

  const { data: sessions = [], isLoading } = useQuery<any[]>({
    queryKey: ["hr-training"],
    queryFn: () => fetchJSON(`${API}/hr/training`),
  });

  const { data: detail } = useQuery<any>({
    queryKey: ["hr-training-detail", expanded],
    queryFn: () => fetchJSON(`${API}/hr/training/${expanded}`),
    enabled: !!expanded,
  });

  const { data: collaborators = [] } = useQuery<any[]>({
    queryKey: ["collaborators-list"],
    queryFn: () => fetchJSON(`${API}/collaborators`).then((r) => r.data ?? r),
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => fetchJSON(`${API}/hr/training`, {
      method: "POST",
      body: JSON.stringify({
        ...d,
        durationHours: d.durationHours ? Number(d.durationHours) : undefined,
        cost: d.cost ? Number(d.cost) : undefined,
        maxParticipants: d.maxParticipants ? Number(d.maxParticipants) : undefined,
      }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-training"] }); setOpen(false); toast({ title: "Formation créée" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const addParticipant = useMutation({
    mutationFn: ({ sessionId, collaboratorId }: { sessionId: string; collaboratorId: string }) =>
      fetchJSON(`${API}/hr/training/${sessionId}/participants`, { method: "POST", body: JSON.stringify({ collaboratorId }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-training-detail", expanded] }); setAddParticipantOpen(null); toast({ title: "Participant ajouté" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetchJSON(`${API}/hr/training/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-training"] }),
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const totalCost = sessions.reduce((s: number, t: any) => s + (t.cost != null ? Number(t.cost) : 0), 0);
  const totalParticipants = sessions.reduce((s: number, t: any) => s + (t.participantCount ?? 0), 0);

  return (
    <HrShell title="Formations" subtitle="Sessions de formation et développement des compétences">
      <div className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: GraduationCap, label: "Sessions", value: sessions.length, color: "text-blue-600 bg-blue-50" },
            { icon: Users, label: "Participants", value: totalParticipants, color: "text-orange-600 bg-orange-50" },
            { icon: Clock, label: "En cours", value: sessions.filter((s: any) => s.status === "ongoing").length, color: "text-purple-600 bg-purple-50" },
            { icon: DollarSign, label: "Budget total", value: formatFCFA(totalCost), color: "text-green-600 bg-green-50" },
          ].map((k) => (
            <Card key={k.label}>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${k.color}`}><k.icon className="w-5 h-5" /></div>
                  <div><p className="text-xs text-muted-foreground">{k.label}</p><p className="text-xl font-bold">{k.value}</p></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Sessions de formation</h2>
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" />Nouvelle formation</Button>
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-muted-foreground">Chargement…</div>
        ) : sessions.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">Aucune formation planifiée</div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s: any) => {
              const isExp = expanded === s.id;
              return (
                <Card key={s.id} className="overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30" onClick={() => setExpanded(isExp ? null : s.id)}>
                    <div className="flex items-center gap-3">
                      {isExp ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <div>
                        <span className="font-semibold">{s.title}</span>
                        {s.provider && <span className="ml-2 text-sm text-muted-foreground">· {s.provider}</span>}
                      </div>
                      <Badge variant={STATUS_COLORS[s.status]}>{STATUS_LABELS[s.status] ?? s.status}</Badge>
                      <Badge variant="outline">{TYPE_LABELS[s.type] ?? s.type}</Badge>
                    </div>
                    <div className="flex items-center gap-4">
                      {s.startDate && <span className="text-sm text-muted-foreground">{s.startDate}</span>}
                      <span className="text-sm font-medium">{s.participantCount ?? 0} participant(s)</span>
                      {s.cost != null && <span className="text-sm font-medium">{formatFCFA(Number(s.cost))}</span>}
                      {s.status === "planned" && (
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: s.id, status: "ongoing" }); }}>
                          Démarrer
                        </Button>
                      )}
                      {s.status === "ongoing" && (
                        <Button size="sm" onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: s.id, status: "completed" }); }}>
                          Terminer
                        </Button>
                      )}
                    </div>
                  </div>
                  {isExp && detail?.id === s.id && (
                    <div className="border-t">
                      <div className="p-4 flex justify-between items-center">
                        <h4 className="font-medium">Participants ({detail.participants?.length ?? 0})</h4>
                        <Button size="sm" variant="outline" onClick={() => setAddParticipantOpen(s.id)}>
                          <Plus className="w-3 h-3 mr-1" />Ajouter
                        </Button>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nom</TableHead>
                            <TableHead>Département</TableHead>
                            <TableHead>Statut</TableHead>
                            <TableHead>Note</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(detail.participants ?? []).map((p: any) => (
                            <TableRow key={p.id}>
                              <TableCell>{p.collaboratorName}</TableCell>
                              <TableCell className="text-muted-foreground">{p.department ?? "—"}</TableCell>
                              <TableCell><Badge variant="secondary">{p.status}</Badge></TableCell>
                              <TableCell>{p.score ?? "—"}</TableCell>
                            </TableRow>
                          ))}
                          {(!detail.participants || detail.participants.length === 0) && (
                            <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">Aucun participant inscrit</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog create */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouvelle formation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Titre *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Organisme / Formateur</Label><Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date début</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
              <div><Label>Date fin</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Durée (h)</Label><Input type="number" value={form.durationHours} onChange={(e) => setForm({ ...form, durationHours: e.target.value })} /></div>
              <div><Label>Coût (FCFA)</Label><Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></div>
              <div><Label>Max participants</Label><Input type="number" value={form.maxParticipants} onChange={(e) => setForm({ ...form, maxParticipants: e.target.value })} /></div>
            </div>
            <div><Label>Lieu</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog add participant */}
      <Dialog open={!!addParticipantOpen} onOpenChange={() => setAddParticipantOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter un participant</DialogTitle></DialogHeader>
          <div>
            <Label>Collaborateur</Label>
            <Select value={participantCollab} onValueChange={setParticipantCollab}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>{collaborators.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddParticipantOpen(null)}>Annuler</Button>
            <Button
              onClick={() => addParticipantOpen && addParticipant.mutate({ sessionId: addParticipantOpen, collaboratorId: participantCollab })}
              disabled={!participantCollab || addParticipant.isPending}
            >
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
