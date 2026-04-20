import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase, Plus, Repeat, Calendar, ChevronRight, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Engagement = {
  id: string; clientId: string; name: string; description?: string;
  status: string; isRecurring: boolean;
  recurrencePattern?: { frequency: string; dayOfMonth?: number; dayOfWeek?: number; monthOfYear?: number } | null;
  startDate?: string; endDate?: string;
  clientName?: string; ownerName?: string;
  createdAt: string;
};
type Client = { id: string; name: string };

const FREQ_LABEL: Record<string, string> = {
  weekly: "Hebdomadaire", monthly: "Mensuel", quarterly: "Trimestriel", annual: "Annuel",
};

export default function ServicesIndex() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "recurring" | "oneoff">("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({
    clientId: "", name: "", description: "", isRecurring: false,
    frequency: "monthly", dayOfMonth: 1, startDate: "", endDate: "",
  });

  const { data, isLoading } = useQuery<{ data: Engagement[] }>({
    queryKey: ["engagements", filter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filter === "recurring") params.set("isRecurring", "true");
      if (filter === "oneoff") params.set("isRecurring", "false");
      const qs = params.toString();
      return apiFetch(`/api/engagements${qs ? "?" + qs : ""}`);
    },
  });

  const { data: clientsData } = useQuery<{ data: Client[] }>({
    queryKey: ["clients-options"],
    queryFn: () => apiFetch("/api/clients?limit=200"),
  });

  const create = useMutation({
    mutationFn: () => apiFetch("/api/engagements", {
      method: "POST",
      body: {
        clientId: form.clientId,
        name: form.name,
        description: form.description || undefined,
        isRecurring: form.isRecurring,
        recurrencePattern: form.isRecurring ? {
          frequency: form.frequency,
          ...(form.frequency === "monthly" || form.frequency === "quarterly" ? { dayOfMonth: Number(form.dayOfMonth) || 1 } : {}),
        } : null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["engagements"] });
      setOpen(false);
      setForm({ clientId: "", name: "", description: "", isRecurring: false, frequency: "monthly", dayOfMonth: 1, startDate: "", endDate: "" });
      toast({ title: "Engagement créé" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const filtered = useMemo(() => {
    const list = data?.data ?? [];
    if (!search) return list;
    const s = search.toLowerCase();
    return list.filter(e =>
      e.name.toLowerCase().includes(s) || (e.clientName ?? "").toLowerCase().includes(s)
    );
  }, [data, search]);

  // Groupe par client
  const grouped = useMemo(() => {
    const map = new Map<string, { clientId: string; clientName: string; items: Engagement[] }>();
    filtered.forEach(e => {
      const key = e.clientId;
      if (!map.has(key)) map.set(key, { clientId: e.clientId, clientName: e.clientName || "Client", items: [] });
      map.get(key)!.items.push(e);
    });
    return Array.from(map.values()).sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [filtered]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Briefcase className="w-7 h-7 text-primary" /> Services
          </h1>
          <p className="text-muted-foreground mt-1">Engagements et missions par client</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Rechercher un engagement ou un client…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-72" />
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="recurring">Récurrents</SelectItem>
              <SelectItem value="oneoff">Ponctuels</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> Nouvel engagement</Button>
        </div>
      </div>

      {isLoading && <div className="text-center text-muted-foreground py-12">Chargement…</div>}

      {!isLoading && grouped.length === 0 && (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Aucun engagement pour l'instant.</p>
          <p className="text-sm mt-1">Créez un premier engagement pour démarrer une mission récurrente avec un client.</p>
        </CardContent></Card>
      )}

      <div className="space-y-6">
        {grouped.map(g => (
          <div key={g.clientId}>
            <div className="flex items-center gap-2 mb-3 px-1">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{g.clientName}</h2>
              <Badge variant="outline" className="text-xs">{g.items.length}</Badge>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {g.items.map(e => (
                <Link key={e.id} href={`/services/${e.id}`}>
                  <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer h-full">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold line-clamp-2">{e.name}</h3>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      </div>
                      {e.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{e.description}</p>}
                      <div className="flex flex-wrap gap-1.5">
                        {e.isRecurring ? (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Repeat className="w-3 h-3" />
                            {FREQ_LABEL[e.recurrencePattern?.frequency || ""] || "Récurrent"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs gap-1"><Calendar className="w-3 h-3" />Ponctuel</Badge>
                        )}
                        <Badge variant={e.status === "active" ? "default" : "outline"} className="text-xs">
                          {e.status === "active" ? "Actif" : e.status === "paused" ? "En pause" : e.status === "completed" ? "Terminé" : e.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Dialog création */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Nouvel engagement</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Client *</label>
              <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir un client…" /></SelectTrigger>
                <SelectContent>
                  {(clientsData?.data ?? []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nom de l'engagement *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex. Maintenance trimestrielle" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <input id="recur" type="checkbox" checked={form.isRecurring} onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })} className="w-4 h-4" />
              <label htmlFor="recur" className="text-sm font-medium">Engagement récurrent</label>
            </div>
            {form.isRecurring && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Fréquence</label>
                  <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Hebdomadaire</SelectItem>
                      <SelectItem value="monthly">Mensuel</SelectItem>
                      <SelectItem value="quarterly">Trimestriel</SelectItem>
                      <SelectItem value="annual">Annuel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(form.frequency === "monthly" || form.frequency === "quarterly") && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Jour du mois</label>
                    <Input type="number" min="1" max="28" value={form.dayOfMonth} onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })} />
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Date de début</label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Date de fin</label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => create.mutate()} disabled={!form.clientId || !form.name || create.isPending}>
              {create.isPending ? "…" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
