import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useListCollaborators, getListCollaboratorsQueryKey,
} from "@workspace/api-client-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  MonitorSmartphone, Plus, Copy, Check, ToggleLeft, ToggleRight,
  Pencil, Users, Key, Loader2, MapPin, RefreshCw,
} from "lucide-react";

type Kiosk = {
  id: string;
  name: string;
  location?: string | null;
  description?: string | null;
  isActive: boolean;
  token: string;
  lastSeenAt?: string | null;
  createdAt: string;
};

type Collaborator = {
  id: string;
  firstName: string;
  lastName: string;
  position?: string;
  department?: string;
  kioskCode?: string | null;
  employmentStatus?: string;
};

const KIOSKS_QUERY_KEY = ["kiosks"] as const;

// ─── Kiosk Form Dialog ────────────────────────────────────────────────────────
function KioskDialog({
  open, onClose, kiosk,
}: {
  open: boolean;
  onClose: () => void;
  kiosk?: Kiosk | null;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(kiosk?.name ?? "");
  const [location, setLocation] = useState(kiosk?.location ?? "");
  const [description, setDescription] = useState(kiosk?.description ?? "");

  const createMutation = useMutation({
    mutationFn: (data: { name: string; location?: string; description?: string }) =>
      apiFetch("/api/kiosks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KIOSKS_QUERY_KEY });
      toast.success("Kiosk créé");
      onClose();
    },
    onError: () => toast.error("Erreur lors de la création"),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; location?: string; description?: string }) =>
      apiFetch(`/api/kiosks/${kiosk!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KIOSKS_QUERY_KEY });
      toast.success("Kiosk mis à jour");
      onClose();
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = () => {
    if (!name.trim()) { toast.error("Le nom est requis"); return; }
    const data = {
      name: name.trim(),
      location: location.trim() || undefined,
      description: description.trim() || undefined,
    };
    if (kiosk) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{kiosk ? "Modifier le kiosk" : "Nouveau kiosk"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Nom *</Label>
            <Input placeholder="Ex: Entrée principale" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Emplacement</Label>
            <Input placeholder="Ex: Bâtiment A, Rez-de-chaussée" value={location} onChange={e => setLocation(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Input placeholder="Description optionnelle" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {kiosk ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Kiosk Code Cell ─────────────────────────────────────────────────────────
function KioskCodeCell({ collaborator, onUpdate }: { collaborator: Collaborator; onUpdate: () => void }) {
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState(collaborator.kioskCode ?? "");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    const trimmed = code.trim();
    if (trimmed && !/^\d{4}$/.test(trimmed)) {
      toast.error("Code doit être 4 chiffres");
      return;
    }
    setLoading(true);
    try {
      await apiFetch(`/api/collaborators/${collaborator.id}/kiosk-code`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kioskCode: trimmed || null }),
      });
      toast.success("Code kiosk mis à jour");
      setEditing(false);
      onUpdate();
    } catch {
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setLoading(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="0000"
          className="w-20 h-7 text-center font-mono text-sm"
          maxLength={4}
          onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          autoFocus
        />
        <Button size="sm" className="h-7 px-2" onClick={save} disabled={loading}>
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {collaborator.kioskCode ? (
        <code className="bg-muted px-2 py-0.5 rounded font-mono text-sm font-bold tracking-widest">
          {collaborator.kioskCode}
        </code>
      ) : (
        <span className="text-muted-foreground text-sm">—</span>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
        onClick={() => { setCode(collaborator.kioskCode ?? ""); setEditing(true); }}
      >
        <Pencil className="w-3 h-3" />
      </Button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function KioskManagementPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKiosk, setEditingKiosk] = useState<Kiosk | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: kiosks = [], isLoading: kiosksLoading } = useQuery<Kiosk[]>({
    queryKey: KIOSKS_QUERY_KEY,
    queryFn: () => apiFetch<Kiosk[]>("/api/kiosks"),
  });

  const { data: collabsData, isLoading: collabsLoading } = useListCollaborators(
    { limit: 200 },
    { query: { queryKey: getListCollaboratorsQueryKey({ limit: 200 }) } }
  );
  const collaborators: Collaborator[] = (collabsData as any)?.data ?? [];

  const toggleMutation = useMutation({
    mutationFn: (k: Kiosk) =>
      apiFetch(`/api/kiosks/${k.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !k.isActive }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KIOSKS_QUERY_KEY }),
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const copyToken = (token: string, id: string) => {
    navigator.clipboard.writeText(token).then(() => {
      setCopiedId(id);
      toast.success("Token copié !");
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const copyKioskUrl = (token: string, id: string) => {
    const url = `${window.location.origin}/kiosk/?token=${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId("url-" + id);
      toast.success("URL kiosk copiée !");
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const fmtDate = (d: string | null | undefined) => {
    if (!d) return "Jamais";
    return new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MonitorSmartphone className="w-7 h-7 text-primary" />
            Gestion des kiosks
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bornes de pointage tablet — configurez et gérez vos kiosks de présence
          </p>
        </div>
        <Button onClick={() => { setEditingKiosk(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Nouveau kiosk
        </Button>
      </div>

      <Tabs defaultValue="kiosks">
        <TabsList>
          <TabsTrigger value="kiosks" className="flex items-center gap-1.5">
            <MonitorSmartphone className="w-4 h-4" /> Kiosks ({kiosks.length})
          </TabsTrigger>
          <TabsTrigger value="codes" className="flex items-center gap-1.5">
            <Key className="w-4 h-4" /> Codes collaborateurs
          </TabsTrigger>
        </TabsList>

        {/* ── Kiosks tab ─────────────────────────────────────────────────── */}
        <TabsContent value="kiosks" className="mt-4">
          {kiosksLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : kiosks.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <MonitorSmartphone className="w-12 h-12 text-muted-foreground/40 mb-4" />
                <p className="font-medium">Aucun kiosk configuré</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Créez votre premier kiosk pour commencer le pointage tablet
                </p>
                <Button className="mt-4" onClick={() => { setEditingKiosk(null); setDialogOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" /> Créer un kiosk
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {kiosks.map((k) => (
                <Card key={k.id} className={`relative ${!k.isActive ? "opacity-60" : ""}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{k.name}</CardTitle>
                        {k.location && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" /> {k.location}
                          </p>
                        )}
                      </div>
                      <Badge variant={k.isActive ? "default" : "secondary"} className="shrink-0">
                        {k.isActive ? "Actif" : "Inactif"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="bg-muted rounded-md p-2">
                      <p className="text-xs text-muted-foreground mb-1">Token d'accès</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-foreground truncate flex-1">{k.token}</code>
                        <Button
                          variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0"
                          onClick={() => copyToken(k.token, k.id)}
                        >
                          {copiedId === k.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" />
                        Dernière activité : {fmtDate(k.lastSeenAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        variant="outline" size="sm" className="flex-1 h-8"
                        onClick={() => copyKioskUrl(k.token, k.id)}
                      >
                        {copiedId === "url-" + k.id ? <Check className="w-3 h-3 mr-1 text-green-500" /> : <Copy className="w-3 h-3 mr-1" />}
                        Copier URL
                      </Button>
                      <Button
                        variant="outline" size="sm" className="h-8"
                        onClick={() => { setEditingKiosk(k); setDialogOpen(true); }}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost" size="sm" className="h-8"
                        onClick={() => toggleMutation.mutate(k)}
                        disabled={toggleMutation.isPending}
                      >
                        {k.isActive
                          ? <ToggleRight className="w-4 h-4 text-emerald-500" />
                          : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Codes tab ──────────────────────────────────────────────────── */}
        <TabsContent value="codes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="w-4 h-4" /> Codes PIN des collaborateurs
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Chaque collaborateur dispose d'un code à 4 chiffres unique pour s'identifier sur le kiosk.
                Cliquez sur <Pencil className="inline w-3 h-3 mx-0.5" /> pour modifier.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {collabsLoading ? (
                <div className="flex items-center justify-center h-24">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Collaborateur</TableHead>
                      <TableHead>Poste</TableHead>
                      <TableHead>Département</TableHead>
                      <TableHead>Code kiosk</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collaborators.filter(c => c.employmentStatus !== "terminated").map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          {c.firstName} {c.lastName}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.position ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.department ?? "—"}</TableCell>
                        <TableCell>
                          <KioskCodeCell
                            collaborator={c}
                            onUpdate={() => queryClient.invalidateQueries({ queryKey: getListCollaboratorsQueryKey({ limit: 200 }) })}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.employmentStatus === "active" ? "default" : "secondary"} className="text-xs">
                            {c.employmentStatus === "active" ? "Actif" : c.employmentStatus ?? "—"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {collaborators.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Aucun collaborateur
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <KioskDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingKiosk(null); }}
        kiosk={editingKiosk}
      />
    </div>
  );
}
