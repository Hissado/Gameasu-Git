import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Building2, Plus, Mail, Phone, ChevronRight, FileSignature, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
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
      <PageHeader
        title="Clients"
        icon={Building2}
        subtitle="Portefeuille clients B2B"
        actions={
          <>
            <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56 h-9" />
            <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Nouveau client</Button>
          </>
        }
      />

      {isLoading && <div className="text-center text-muted-foreground py-12">Chargement…</div>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(data?.data ?? []).map(c => {
          const statusLabel: Record<string, { label: string; cls: string }> = {
            active:   { label: "Actif",      cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
            client:   { label: "Client",     cls: "bg-blue-100 text-blue-700 border-blue-200" },
            prospect: { label: "Prospect",   cls: "bg-amber-50 text-amber-700 border-amber-200" },
            inactive: { label: "Inactif",    cls: "bg-slate-100 text-slate-500 border-slate-200" },
            lead:     { label: "Lead",       cls: "bg-purple-50 text-purple-700 border-purple-200" },
          };
          const stBadge = statusLabel[c.status] ?? { label: c.status, cls: "bg-slate-100 text-slate-500 border-slate-200" };
          return (
            <div key={c.id} className="relative group">
              <Link href={`/clients/${c.id}`}>
                <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer h-full">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 bg-primary/10 rounded-md flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold truncate text-sm">{c.name}</h3>
                          {c.industry && <p className="text-[10px] text-muted-foreground truncate">{c.industry}</p>}
                        </div>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${stBadge.cls} shrink-0`}>{stBadge.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      {c.email && (
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground bg-slate-50 border border-border rounded px-1.5 py-0.5">
                          <Mail className="w-2.5 h-2.5" /> {c.email.split("@")[0]}…
                        </span>
                      )}
                      {c.phone && (
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground bg-slate-50 border border-border rounded px-1.5 py-0.5">
                          <Phone className="w-2.5 h-2.5" /> {c.phone}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
              {/* CTA rapide — visible au survol */}
              <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link href="/proformas">
                  <button
                    title="Créer un devis pour ce client"
                    className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1.5 rounded-md bg-[#2563EB] hover:bg-[#1d4ed8] text-white shadow-md transition-colors">
                    <FileSignature className="w-3 h-3" /> Devis
                  </button>
                </Link>
              </div>
            </div>
          );
        })}
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
