import { useState } from "react";
import { Link } from "wouter";
import {
  useActiveFirm, useExpertClients, useAddClientOrg, useUnlinkClient,
  ACCESS_LABEL, PLAN_COLOR,
} from "@/lib/expert-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, Plus, Search, Settings, FileText, Trash2, AlertCircle, Users2,
} from "lucide-react";

function AddClientModal({ firmId, open, onClose }: { firmId: string; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const add = useAddClientOrg(firmId);
  const [form, setForm] = useState({
    name: "", country: "TG",
    ownerFirstName: "", ownerLastName: "", ownerEmail: "",
    accessLevel: "read",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.ownerEmail.trim()) return;
    try {
      await add.mutateAsync(form);
      toast({ title: "Client ajouté", description: "Un email d'invitation a été envoyé au dirigeant." });
      onClose();
      setForm({ name: "", country: "TG", ownerFirstName: "", ownerLastName: "", ownerEmail: "", accessLevel: "read" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.body?.error ?? "Erreur lors de la création", variant: "destructive" });
    }
  };

  const f = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter un client</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Nom de l'organisation *</Label>
              <Input value={form.name} onChange={(e) => f("name", e.target.value)} placeholder="Entreprise SA" required />
            </div>
            <div className="space-y-1.5">
              <Label>Pays</Label>
              <Input value={form.country} onChange={(e) => f("country", e.target.value)} placeholder="TG" maxLength={3} />
            </div>
            <div className="space-y-1.5">
              <Label>Niveau d'accès</Label>
              <Select value={form.accessLevel} onValueChange={(v) => f("accessLevel", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">Lecture seule</SelectItem>
                  <SelectItem value="full">Accès complet</SelectItem>
                  <SelectItem value="billing">Facturation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Dirigeant / administrateur</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Prénom *</Label>
                <Input value={form.ownerFirstName} onChange={(e) => f("ownerFirstName", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Nom *</Label>
                <Input value={form.ownerLastName} onChange={(e) => f("ownerLastName", e.target.value)} required />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>E-mail *</Label>
                <Input type="email" value={form.ownerEmail} onChange={(e) => f("ownerEmail", e.target.value)} placeholder="dirigeant@entreprise.com" required />
                <p className="text-xs text-muted-foreground">Un lien d'invitation sécurisé lui sera envoyé.</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={add.isPending}>
              {add.isPending ? "Création…" : "Créer et inviter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ExpertClientsPage() {
  const { firmId } = useActiveFirm();
  const { data: clients, isLoading } = useExpertClients(firmId);
  const unlink = useUnlinkClient(firmId ?? "");
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [accessFilter, setAccessFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [toUnlink, setToUnlink] = useState<{ id: string; name: string } | null>(null);

  if (!firmId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <AlertCircle className="w-10 h-10 text-muted-foreground/40" />
        <p className="text-muted-foreground">Aucun cabinet sélectionné. Accédez au <Link href="/expert" className="text-primary underline">tableau de bord Expert</Link> pour créer ou sélectionner un cabinet.</p>
      </div>
    );
  }

  const filtered = (clients ?? []).filter((c) => {
    const name = c.org.name.toLowerCase();
    if (search && !name.includes(search.toLowerCase())) return false;
    if (accessFilter !== "all" && c.accessLevel !== accessFilter) return false;
    return true;
  });

  const handleUnlink = async () => {
    if (!toUnlink) return;
    try {
      await unlink.mutateAsync(toUnlink.id);
      toast({ title: "Client délié" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.body?.error, variant: "destructive" });
    }
    setToUnlink(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mes clients</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{clients?.length ?? 0} organisation{(clients?.length ?? 0) !== 1 ? "s" : ""} liée{(clients?.length ?? 0) !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />Ajouter un client
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <Input className="pl-9" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={accessFilter} onValueChange={setAccessFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Niveau d'accès" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les accès</SelectItem>
            <SelectItem value="full">Accès complet</SelectItem>
            <SelectItem value="read">Lecture seule</SelectItem>
            <SelectItem value="billing">Facturation</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : !filtered.length ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
            <Building2 className="w-10 h-10 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">
              {search || accessFilter !== "all" ? "Aucun client ne correspond aux filtres" : "Aucun client lié à ce cabinet"}
            </p>
            {!search && accessFilter === "all" && (
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" />Ajouter le premier client
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((c) => (
            <Card key={c.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{c.org.name}</span>
                    {!c.isActive && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50">Inactif</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.org.country} · {ACCESS_LABEL[c.accessLevel]}
                    {c.subscription ? ` · ${c.subscription.planName}` : ""}
                  </p>
                </div>
                {c.subscription && (
                  <Badge className={`text-[10px] hidden sm:inline-flex border ${PLAN_COLOR[c.subscription.planCode] ?? "bg-slate-100 text-slate-600"}`} variant="outline">
                    {c.subscription.planName}
                  </Badge>
                )}
                <div className="flex items-center gap-1 shrink-0">
                  <Link href={`/expert/client-config?orgId=${c.orgId}`}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Configuration">
                      <Settings className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                  <Link href={`/expert/document-requests?orgId=${c.orgId}`}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Documents">
                      <FileText className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                  <Link href={`/expert/users-permissions?orgId=${c.orgId}`}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Utilisateurs">
                      <Users2 className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost" size="sm"
                    className="h-8 w-8 p-0 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                    title="Délier"
                    onClick={() => setToUnlink({ id: c.orgId, name: c.org.name })}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddClientModal firmId={firmId} open={addOpen} onClose={() => setAddOpen(false)} />

      <ConfirmDialog
        open={!!toUnlink}
        onOpenChange={(o) => { if (!o) setToUnlink(null); }}
        title="Délier ce client ?"
        description={`"${toUnlink?.name}" sera retiré de votre liste de clients. L'organisation et ses données ne seront pas supprimées.`}
        confirmLabel="Délier"
        destructive
        onConfirm={handleUnlink}
      />
    </div>
  );
}
