import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useListCollaborators, getListCollaboratorsQueryKey,
} from "@workspace/api-client-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
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
  Pencil, Users, Key, Loader2, MapPin, RefreshCw, BarChart2, Wifi, Clock,
  QrCode, RotateCcw, Trash2, Activity,
} from "lucide-react";

type Kiosk = {
  id: string;
  name: string;
  location?: string | null;
  description?: string | null;
  isActive: boolean;
  token: string;
  usageCount?: number;
  revokedAt?: string | null;
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
      toast.success("Kiosque créé");
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
      toast.success("Kiosque mis à jour");
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
          <DialogTitle>{kiosk ? "Modifier le kiosque" : "Nouveau kiosque"}</DialogTitle>
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
      toast.success("Code kiosque mis à jour");
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

// ─── QR Code Modal ────────────────────────────────────────────────────────────
function QrModal({ kiosk, onClose }: { kiosk: Kiosk; onClose: () => void }) {
  const kioskUrl = `${window.location.origin}/kiosk/?token=${kiosk.token}`;
  const [copied, setCopied] = useState(false);

  const copyUrl = () => {
    navigator.clipboard.writeText(kioskUrl).then(() => {
      setCopied(true);
      toast.success("URL kiosque copiée !");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            QR Code — {kiosk.name}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="p-4 bg-white rounded-xl border shadow-sm">
            <QRCodeSVG value={kioskUrl} size={200} level="M" includeMargin={false} />
          </div>
          {kiosk.location && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> {kiosk.location}
            </p>
          )}
          <p className="text-xs text-muted-foreground text-center break-all px-2 font-mono bg-muted rounded-md p-2 w-full">
            {kioskUrl}
          </p>
          {kiosk.usageCount !== undefined && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" />
              {kiosk.usageCount} utilisation{kiosk.usageCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={copyUrl}>
            {copied ? <Check className="w-4 h-4 mr-2 text-green-500" /> : <Copy className="w-4 h-4 mr-2" />}
            Copier l'URL
          </Button>
          <Button variant="outline" onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function KioskManagementPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKiosk, setEditingKiosk] = useState<Kiosk | null>(null);
  const [qrKiosk, setQrKiosk] = useState<Kiosk | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: kiosks = [], isLoading: kiosksLoading } = useQuery<Kiosk[]>({
    queryKey: KIOSKS_QUERY_KEY,
    queryFn: () => apiFetch<Kiosk[]>("/api/kiosks"),
  });

  const [activityDate, setActivityDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const { data: activityData, isLoading: activityLoading, refetch: refetchActivity } = useQuery<{
    date: string;
    summary: { totalPunches: number; uniqueEmployees: number; activeKiosks: number };
    kiosks: Array<{ id: string; name: string; location?: string | null; isActive: boolean; lastSeenAt?: string | null; punchCount: number; uniqueEmployees: number; lastPunchAt: string | null }>;
  }>({
    queryKey: ["kiosk-activity", activityDate],
    queryFn: () => apiFetch(`/api/kiosks/activity?date=${activityDate}`),
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

  const regenerateMutation = useMutation({
    mutationFn: (k: Kiosk) =>
      apiFetch<Kiosk>(`/api/kiosks/${k.id}/regenerate`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KIOSKS_QUERY_KEY });
      toast.success("Token régénéré — l'ancien lien est désormais invalide");
    },
    onError: () => toast.error("Erreur lors de la régénération du token"),
  });

  const deleteMutation = useMutation({
    mutationFn: (k: Kiosk) =>
      apiFetch(`/api/kiosks/${k.id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KIOSKS_QUERY_KEY });
      toast.success("Kiosque supprimé");
    },
    onError: () => toast.error("Erreur lors de la suppression"),
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
      toast.success("URL kiosque copiée !");
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const fmtDate = (d: string | null | undefined) => {
    if (!d) return "Jamais";
    return new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  };

  return (
    <div className="p-6 space-y-6">
      {qrKiosk && <QrModal kiosk={qrKiosk} onClose={() => setQrKiosk(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MonitorSmartphone className="w-7 h-7 text-primary" />
            Gestion des kiosques
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bornes de pointage tablette — configurez et gérez vos kiosques de présence
          </p>
        </div>
        <Button onClick={() => { setEditingKiosk(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Nouveau kiosque
        </Button>
      </div>

      <Tabs defaultValue="kiosks">
        <TabsList>
          <TabsTrigger value="kiosks" className="flex items-center gap-1.5">
            <MonitorSmartphone className="w-4 h-4" /> Kiosques ({kiosks.length})
          </TabsTrigger>
          <TabsTrigger value="codes" className="flex items-center gap-1.5">
            <Key className="w-4 h-4" /> Codes collaborateurs
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4" /> Activité
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
                <p className="font-medium">Aucun kiosque configuré</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Créez votre premier kiosque pour commencer le pointage sur tablette
                </p>
                <Button className="mt-4" onClick={() => { setEditingKiosk(null); setDialogOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" /> Créer un kiosque
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
                        Vu le : {fmtDate(k.lastSeenAt)}
                      </span>
                      {k.usageCount !== undefined && (
                        <span className="flex items-center gap-1">
                          <Activity className="w-3 h-3" />
                          {k.usageCount} accès
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                      <Button
                        variant="outline" size="sm" className="h-8 gap-1.5"
                        onClick={() => setQrKiosk(k)}
                        title="Afficher le QR code"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        QR
                      </Button>
                      <Button
                        variant="outline" size="sm" className="h-8 gap-1.5"
                        onClick={() => copyKioskUrl(k.token, k.id)}
                        title="Copier l'URL"
                      >
                        {copiedId === "url-" + k.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        URL
                      </Button>
                      <Button
                        variant="outline" size="sm" className="h-8"
                        onClick={() => { setEditingKiosk(k); setDialogOpen(true); }}
                        title="Modifier"
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="outline" size="sm" className="h-8"
                        title="Régénérer le token (invalide l'ancien lien)"
                        onClick={() => {
                          if (confirm(`Régénérer le token de "${k.name}" ? L'ancien QR code sera invalide.`)) {
                            regenerateMutation.mutate(k);
                          }
                        }}
                        disabled={regenerateMutation.isPending}
                      >
                        {regenerateMutation.isPending
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <RotateCcw className="w-3 h-3" />}
                      </Button>
                      <Button
                        variant="ghost" size="sm" className="h-8"
                        onClick={() => toggleMutation.mutate(k)}
                        disabled={toggleMutation.isPending}
                        title={k.isActive ? "Désactiver" : "Activer"}
                      >
                        {k.isActive
                          ? <ToggleRight className="w-4 h-4 text-emerald-500" />
                          : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                      </Button>
                      <Button
                        variant="ghost" size="sm" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Supprimer le kiosque"
                        onClick={() => {
                          if (confirm(`Supprimer définitivement "${k.name}" ? Cette action est irréversible.`)) {
                            deleteMutation.mutate(k);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-3 h-3" />
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
                Chaque collaborateur dispose d'un code à 4 chiffres unique pour s'identifier sur le kiosque.
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
                      <TableHead>Code kiosque</TableHead>
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

        {/* ── Activité tab ──────────────────────────────────────────────── */}
        <TabsContent value="activity" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={activityDate}
              onChange={e => setActivityDate(e.target.value)}
              className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <Button size="sm" variant="outline" onClick={() => refetchActivity()} disabled={activityLoading}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${activityLoading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
            <span className="text-sm text-muted-foreground ml-auto">Activité du {activityDate}</span>
          </div>

          {activityData && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: "Pointages total", value: activityData.summary.totalPunches, icon: Clock, color: "bg-blue-50 text-blue-600" },
                { label: "Employés uniques", value: activityData.summary.uniqueEmployees, icon: Users, color: "bg-emerald-50 text-emerald-600" },
                { label: "Kiosques actifs", value: activityData.summary.activeKiosks, icon: Wifi, color: "bg-orange-50 text-orange-600" },
              ].map(stat => (
                <Card key={stat.label}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stat.color}`}>
                      <stat.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="font-bold text-xl">{stat.value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart2 className="w-4 h-4" /> Détail par kiosque
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {activityLoading ? (
                <div className="flex items-center justify-center h-24">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kiosque</TableHead>
                      <TableHead>Emplacement</TableHead>
                      <TableHead className="text-center">Statut</TableHead>
                      <TableHead className="text-center">Pointages</TableHead>
                      <TableHead className="text-center">Employés</TableHead>
                      <TableHead>Dernier pointage</TableHead>
                      <TableHead>Vu pour la dernière fois</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(activityData?.kiosks ?? []).map(k => (
                      <TableRow key={k.id}>
                        <TableCell className="font-medium">{k.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {k.location ? <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{k.location}</span> : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={k.isActive ? "default" : "secondary"} className="text-xs">
                            {k.isActive ? "Actif" : "Inactif"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {k.punchCount > 0 ? (
                            <span className="text-primary font-bold">{k.punchCount}</span>
                          ) : <span className="text-muted-foreground">0</span>}
                        </TableCell>
                        <TableCell className="text-center">{k.uniqueEmployees || "—"}</TableCell>
                        <TableCell className="text-sm">
                          {k.lastPunchAt ? new Date(k.lastPunchAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {k.lastSeenAt ? new Date(k.lastSeenAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "Jamais"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!activityData?.kiosks?.length && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucun kiosk configuré</TableCell></TableRow>
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
