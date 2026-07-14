import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, Plus, Mail, Phone, FileSignature, Search, Users, MoreVertical, Edit, Eye } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ClientFormDialog, type ClientFull } from "./ClientFormDialog";
import { toast } from "sonner";

type Client = {
  id: string;
  name: string;
  commercialName?: string | null;
  email?: string | null;
  phone?: string | null;
  industry?: string | null;
  status: string;
  type?: string | null;
  city?: string | null;
  country?: string | null;
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  active:   { label: "Actif",    cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  client:   { label: "Client",   cls: "bg-blue-100 text-blue-700 border-blue-200" },
  prospect: { label: "Prospect", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  lead:     { label: "Lead",     cls: "bg-purple-50 text-purple-700 border-purple-200" },
  inactive: { label: "Inactif",  cls: "bg-slate-100 text-slate-500 border-slate-200" },
  vip:      { label: "VIP",      cls: "bg-rose-100 text-rose-700 border-rose-200" },
};

const TYPE_ICON: Record<string, string> = {
  entreprise:     "🏢",
  particulier:    "👤",
  administration: "🏛️",
  ong:            "🤝",
};

export default function ClientsWorkspace() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editClient, setEditClient] = useState<ClientFull | null>(null);

  const { data, isLoading } = useQuery<{ data: Client[] }>({
    queryKey: ["clients-ws", search],
    queryFn: () => apiFetch(`/api/clients?search=${encodeURIComponent(search)}&limit=200`),
  });

  const clients = data?.data ?? [];

  function openCreate() {
    setEditClient(null);
    setDialogOpen(true);
  }

  async function openEdit(id: string) {
    try {
      const full: ClientFull = await apiFetch(`/api/clients/${id}`);
      setEditClient(full);
      setDialogOpen(true);
    } catch {
      toast.error("Impossible de charger les données du client");
    }
  }

  function handleSuccess() {
    qc.invalidateQueries({ queryKey: ["clients-ws"] });
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Clients"
        icon={Building2}
        subtitle={`Portefeuille clients B2B · ${clients.length} tiers`}
        actions={
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-56 h-8 pl-8 text-sm"
              />
            </div>
            <Button onClick={openCreate} className="h-8 text-sm bg-orange-600 hover:bg-orange-700 text-white">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Nouveau client
            </Button>
          </>
        }
      />

      {isLoading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && clients.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground mb-1">Aucun client trouvé</p>
          <p className="text-xs text-muted-foreground mb-4">
            {search ? `Aucun résultat pour « ${search} »` : "Créez votre premier client pour démarrer."}
          </p>
          {!search && (
            <Button onClick={openCreate} size="sm" className="bg-orange-600 hover:bg-orange-700 text-white">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Créer un client
            </Button>
          )}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {clients.map(c => {
          const stBadge = STATUS_LABELS[c.status] ?? { label: c.status, cls: "bg-slate-100 text-slate-500 border-slate-200" };
          const typeIcon = TYPE_ICON[c.type || "entreprise"] || "🏢";
          return (
            <div key={c.id} className="relative group">
              <Link href={`/clients/${c.id}`}>
                <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer h-full">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 bg-primary/10 rounded-md flex items-center justify-center shrink-0 text-base">
                          {typeIcon}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold truncate text-sm">{c.name}</h3>
                          {c.commercialName && <p className="text-[10px] text-muted-foreground truncate italic">{c.commercialName}</p>}
                          {!c.commercialName && c.industry && <p className="text-[10px] text-muted-foreground truncate">{c.industry}</p>}
                        </div>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${stBadge.cls} shrink-0`}>{stBadge.label}</span>
                    </div>

                    {(c.city || c.country) && (
                      <p className="text-[10px] text-muted-foreground mb-1.5">
                        📍 {[c.city, c.country].filter(Boolean).join(", ")}
                      </p>
                    )}

                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
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

              {/* Menu actions — positionné en dehors du Link pour ne pas déclencher la navigation */}
              <div className="absolute top-2 right-2 z-10" onClick={e => e.preventDefault()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center w-7 h-7 rounded-md bg-white/90 hover:bg-white border border-border shadow-sm"
                      title="Actions"
                    >
                      <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem
                      className="gap-2 text-sm"
                      onClick={() => openEdit(c.id)}
                    >
                      <Edit className="w-3.5 h-3.5" /> Modifier
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="gap-2 text-sm"
                      onClick={() => navigate(`/clients/${c.id}`)}
                    >
                      <Eye className="w-3.5 h-3.5" /> Voir la fiche
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="gap-2 text-sm"
                      onClick={() => navigate("/devis")}
                    >
                      <FileSignature className="w-3.5 h-3.5" /> Créer un devis
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>

      <ClientFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditClient(null); }}
        client={editClient}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
