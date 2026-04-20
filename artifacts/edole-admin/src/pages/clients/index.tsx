import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Building2, Plus, Mail, Phone, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Client = { id: string; name: string; email?: string; phone?: string; industry?: string; status: string };

export default function ClientsWorkspace() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: "", email: "", phone: "", industry: "", status: "active" });

  const { data, isLoading } = useQuery<{ data: Client[] }>({
    queryKey: ["clients-ws", search],
    queryFn: () => apiFetch(`/api/clients?search=${encodeURIComponent(search)}&limit=200`),
  });

  const create = useMutation({
    mutationFn: () => apiFetch("/api/clients", { method: "POST", body: form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients-ws"] });
      setOpen(false);
      setForm({ name: "", email: "", phone: "", industry: "", status: "active" });
      toast({ title: "Client créé" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Building2 className="w-7 h-7 text-primary" /> Clients
          </h1>
          <p className="text-muted-foreground mt-1">Portefeuille clients</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Nouveau client</Button>
        </div>
      </div>

      {isLoading && <div className="text-center text-muted-foreground py-12">Chargement…</div>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(data?.data ?? []).map(c => (
          <Link key={c.id} href={`/clients/${c.id}`}>
            <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer h-full">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 bg-primary/10 rounded-md flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="font-semibold truncate">{c.name}</h3>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
                {c.industry && <p className="text-xs text-muted-foreground mb-2">{c.industry}</p>}
                <div className="flex flex-wrap gap-1.5">
                  {c.email && <Badge variant="outline" className="text-xs gap-1"><Mail className="w-3 h-3" />Email</Badge>}
                  {c.phone && <Badge variant="outline" className="text-xs gap-1"><Phone className="w-3 h-3" />Téléphone</Badge>}
                  <Badge variant={c.status === "active" || c.status === "client" ? "default" : "outline"} className="text-xs">{c.status}</Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau client</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nom *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input placeholder="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input placeholder="Secteur" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => create.mutate()} disabled={!form.name || create.isPending}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
