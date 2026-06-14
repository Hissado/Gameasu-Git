import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Ticket, MessageSquare, ChevronDown } from "lucide-react";
import { toast } from "sonner";

type TicketRow = {
  id: string; subject: string; category: string | null;
  priority: string; status: string;
  createdAt: string; updatedAt: string; resolvedAt: string | null;
  orgName: string | null; orgSlug: string | null;
  createdByName: string | null; createdByEmail: string | null;
  commentCount: number;
};

type Comment = { id: string; body: string; createdAt: string; authorName: string | null; authorEmail: string | null };

const STATUS_CFG: Record<string, { cls: string; label: string }> = {
  open:        { cls: "bg-amber-50 text-amber-700 border-amber-200",   label: "Ouvert" },
  in_progress: { cls: "bg-blue-50 text-blue-700 border-blue-200",     label: "En cours" },
  resolved:    { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Résolu" },
  closed:      { cls: "bg-slate-100 text-slate-600 border-slate-200", label: "Fermé" },
};

const PRIORITY_CFG: Record<string, { cls: string; label: string }> = {
  critical: { cls: "bg-red-50 text-red-700 border-red-200",    label: "Critique" },
  high:     { cls: "bg-orange-50 text-orange-700 border-orange-200", label: "Haute" },
  medium:   { cls: "bg-yellow-50 text-yellow-700 border-yellow-200", label: "Moyenne" },
  low:      { cls: "bg-slate-100 text-slate-600 border-slate-200",  label: "Faible" },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function TicketsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<TicketRow | null>(null);
  const [comment, setComment] = useState("");

  const { data, isLoading } = useQuery<{ count: number; rows: TicketRow[] }>({
    queryKey: ["cockpit-tickets"],
    queryFn: () => apiFetch("/api/super-admin/tickets"),
    refetchInterval: 30_000,
  });

  const comments = useQuery<{ count: number; rows: Comment[] }>({
    queryKey: ["cockpit-ticket-comments", selected?.id],
    queryFn: () => apiFetch(`/api/super-admin/tickets/${selected!.id}/comments`),
    enabled: !!selected,
  });

  const updateTicket = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiFetch(`/api/super-admin/tickets/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cockpit-tickets"] }); toast.success("Ticket mis à jour"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addComment = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      apiFetch(`/api/super-admin/tickets/${id}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cockpit-ticket-comments", selected?.id] });
      qc.invalidateQueries({ queryKey: ["cockpit-tickets"] });
      setComment("");
      toast.success("Commentaire ajouté");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (data?.rows ?? []).filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return t.subject.toLowerCase().includes(q) || (t.orgName ?? "").toLowerCase().includes(q);
  });

  const counts = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
  (data?.rows ?? []).forEach((t) => { if (t.status in counts) (counts as any)[t.status]++; });

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Cockpit</p>
        <h1 className="text-2xl font-bold tracking-tight">Tickets support</h1>
        <p className="text-muted-foreground text-sm mt-1">Vue cross-tenant — {data?.count ?? 0} tickets au total</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "open", "in_progress", "resolved", "closed"] as const).map((s) => (
          <Button
            key={s} size="sm" variant={statusFilter === s ? "default" : "outline"}
            onClick={() => setStatusFilter(s)}
            className="h-7 text-xs gap-1"
          >
            {s === "all" ? "Tous" : STATUS_CFG[s]?.label}
            <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
              {s === "all" ? (data?.count ?? 0) : (counts as any)[s] ?? 0}
            </Badge>
          </Button>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Rechercher par sujet ou organisation…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Ticket className="w-4 h-4 text-primary" />Tickets ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Aucun ticket trouvé</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sujet</TableHead>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Priorité</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-center">Commentaires</TableHead>
                    <TableHead>Créé le</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((t) => (
                    <TableRow key={t.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelected(t)}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{t.subject}</p>
                          {t.category && <p className="text-[10px] text-muted-foreground">{t.category}</p>}
                          {t.createdByEmail && <p className="text-[10px] text-muted-foreground">{t.createdByName ?? t.createdByEmail}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {t.orgName ? (
                          <div>
                            <p className="text-sm font-medium">{t.orgName}</p>
                            <p className="text-[10px] font-mono text-muted-foreground">{t.orgSlug}</p>
                          </div>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={(PRIORITY_CFG[t.priority] ?? PRIORITY_CFG.medium).cls}>
                          {(PRIORITY_CFG[t.priority] ?? PRIORITY_CFG.medium).label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={(STATUS_CFG[t.status] ?? STATUS_CFG.open).cls}>
                          {(STATUS_CFG[t.status] ?? STATUS_CFG.open).label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {t.commentCount > 0 ? (
                          <span className="flex items-center justify-center gap-1 text-sm">
                            <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />{t.commentCount}
                          </span>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(t.createdAt)}</TableCell>
                      <TableCell><ChevronDown className="w-4 h-4 text-muted-foreground rotate-[-90deg]" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ticket detail dialog */}
      {selected && (
        <Dialog open onOpenChange={(o) => { if (!o) setSelected(null); }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base">{selected.subject}</DialogTitle>
              <div className="flex gap-2 flex-wrap mt-1">
                <Badge variant="outline" className={(STATUS_CFG[selected.status] ?? STATUS_CFG.open).cls}>
                  {(STATUS_CFG[selected.status] ?? STATUS_CFG.open).label}
                </Badge>
                <Badge variant="outline" className={(PRIORITY_CFG[selected.priority] ?? PRIORITY_CFG.medium).cls}>
                  {(PRIORITY_CFG[selected.priority] ?? PRIORITY_CFG.medium).label}
                </Badge>
                {selected.orgName && <Badge variant="secondary">{selected.orgName}</Badge>}
              </div>
            </DialogHeader>

            <div className="space-y-4">
              {/* Quick actions */}
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Statut :</span>
                  <Select value={selected.status} onValueChange={(v) => updateTicket.mutate({ id: selected.id, body: { status: v } })}>
                    <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Ouvert</SelectItem>
                      <SelectItem value="in_progress">En cours</SelectItem>
                      <SelectItem value="resolved">Résolu</SelectItem>
                      <SelectItem value="closed">Fermé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Priorité :</span>
                  <Select value={selected.priority} onValueChange={(v) => updateTicket.mutate({ id: selected.id, body: { priority: v } })}>
                    <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Critique</SelectItem>
                      <SelectItem value="high">Haute</SelectItem>
                      <SelectItem value="medium">Moyenne</SelectItem>
                      <SelectItem value="low">Faible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Comments */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Commentaires</p>
                {comments.isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : comments.data?.rows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucun commentaire — soyez le premier à répondre.</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {(comments.data?.rows ?? []).map((c) => (
                      <div key={c.id} className="bg-muted/40 rounded-lg p-3">
                        <p className="text-sm">{c.body}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {c.authorName ?? c.authorEmail ?? "Anonyme"} · {fmtDate(c.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Ajouter un commentaire…"
                    className="text-sm min-h-[60px] resize-none"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSelected(null)}>Fermer</Button>
              <Button
                onClick={() => addComment.mutate({ id: selected.id, body: comment })}
                disabled={!comment.trim() || addComment.isPending}
              >
                {addComment.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Commenter
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
