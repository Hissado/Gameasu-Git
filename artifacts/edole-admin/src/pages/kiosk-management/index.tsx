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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  MonitorSmartphone, Plus, Copy, Check, ToggleLeft, ToggleRight,
  Pencil, Users, Key, Loader2, MapPin, RefreshCw, BarChart2, Wifi, Clock,
  QrCode, RotateCcw, Trash2, Activity, ShieldOff, Link2, AlertTriangle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Kiosk = {
  id: string;
  name: string;
  location?: string | null;
  description?: string | null;
  departmentId?: string | null;
  isActive: boolean;
  lastSeenAt?: string | null;
  createdAt: string;
};

type KioskToken = {
  id: string;
  kioskId: string;
  label: string;
  departmentId?: string | null;
  isActive: boolean;
  usageCount: number;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
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
const KIOSK_TOKENS_QUERY_KEY = ["kiosk-tokens"] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function kioskUrl(tokenId: string) {
  return `${window.location.origin}/kiosk/?token=${tokenId}`;
}

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
  const [departmentId, setDepartmentId] = useState<string>(kiosk?.departmentId ?? "_none");

  const { data: deptsData } = useQuery<{ data: { id: string; name: string }[] }>({
    queryKey: ["hr-departments"],
    queryFn: () => apiFetch("/api/hr/departments"),
  });
  const departments = deptsData?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (data: { name: string; location?: string; description?: string; departmentId?: string | null }) =>
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
    mutationFn: (data: { name?: string; location?: string; description?: string; departmentId?: string | null }) =>
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
      departmentId: departmentId === "_none" ? null : departmentId,
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
            <Label>Département</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Aucun département" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Aucun département —</SelectItem>
                {departments.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

// ─── Add Token Dialog ─────────────────────────────────────────────────────────
function AddTokenDialog({
  kiosk, onSubmit, isPending, onClose,
}: {
  kiosk: Kiosk;
  onSubmit: (data: { kioskId: string; label: string; departmentId?: string | null }) => void;
  isPending: boolean;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [departmentId, setDepartmentId] = useState("_none");

  const { data: deptsData } = useQuery<{ data: { id: string; name: string }[] }>({
    queryKey: ["hr-departments"],
    queryFn: () => apiFetch("/api/hr/departments"),
  });
  const departments = deptsData?.data ?? [];

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            Ajouter un lien — {kiosk.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Label *</Label>
            <Input placeholder="Ex: Accès principal, Entrée A…" value={label} onChange={e => setLabel(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Département</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger><SelectValue placeholder="Aucun département" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Aucun département —</SelectItem>
                {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Annuler</Button>
          <Button onClick={() => {
            if (!label.trim()) { toast.error("Label requis"); return; }
            onSubmit({ kioskId: kiosk.id, label: label.trim(), departmentId: departmentId === "_none" ? null : departmentId });
          }} disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Créer le lien
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Token Dialog ────────────────────────────────────────────────────────
function EditTokenDialog({
  token, onSubmit, isPending, onClose,
}: {
  token: KioskToken;
  onSubmit: (data: { label: string; departmentId?: string | null }) => void;
  isPending: boolean;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(token.label);
  const [departmentId, setDepartmentId] = useState(token.departmentId ?? "_none");

  const { data: deptsData } = useQuery<{ data: { id: string; name: string }[] }>({
    queryKey: ["hr-departments"],
    queryFn: () => apiFetch("/api/hr/departments"),
  });
  const departments = deptsData?.data ?? [];

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-primary" />
            Modifier le lien
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Label *</Label>
            <Input value={label} onChange={e => setLabel(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Département</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger><SelectValue placeholder="Aucun département" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Aucun département —</SelectItem>
                {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Annuler</Button>
          <Button onClick={() => {
            if (!label.trim()) { toast.error("Label requis"); return; }
            onSubmit({ label: label.trim(), departmentId: departmentId === "_none" ? null : departmentId });
          }} disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── QR View Dialog (persistent — affichable à tout moment) ───────────────────
function QrViewDialog({
  token, onClose,
}: {
  token: KioskToken;
  onClose: () => void;
}) {
  const url = kioskUrl(token.id);
  const [copied, setCopied] = useState(false);

  const copyUrl = () => {
    navigator.clipboard.writeText(url).then(() => {
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
            QR Code — {token.label}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 bg-white rounded-xl border shadow-sm">
              <QRCodeSVG value={url} size={180} level="M" includeMargin={false} />
            </div>
            <p className="text-xs text-muted-foreground text-center break-all font-mono bg-muted rounded-md p-2 w-full">
              {url}
            </p>
          </div>
          {!token.isActive || token.revokedAt ? (
            <div className="bg-orange-50 border border-orange-200 rounded-md p-3 text-sm text-orange-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Ce lien est {token.revokedAt ? "révoqué" : "inactif"} et ne permettra pas l'accès au kiosque.</span>
            </div>
          ) : null}
        </div>
        <DialogFooter className="flex gap-2">
          <Button className="flex-1" onClick={copyUrl}>
            {copied ? <Check className="w-4 h-4 mr-2 text-green-500" /> : <Copy className="w-4 h-4 mr-2" />}
            Copier l'URL
          </Button>
          <Button variant="outline" onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── New Token Modal (shown after create/regenerate — affiche aussi rawToken) ──
function NewTokenModal({
  tokenId, label, kioskName, rawToken, onClose,
}: {
  tokenId: string;
  label: string;
  kioskName: string;
  rawToken: string;
  onClose: () => void;
}) {
  const url = kioskUrl(tokenId);
  const [copied, setCopied] = useState(false);

  const copyUrl = () => {
    navigator.clipboard.writeText(url).then(() => {
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
            Lien créé — {kioskName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm"><span className="font-medium">Label :</span> {label}</p>
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 bg-white rounded-xl border shadow-sm">
              <QRCodeSVG value={url} size={180} level="M" includeMargin={false} />
            </div>
            <p className="text-xs text-muted-foreground text-center break-all font-mono bg-muted rounded-md p-2 w-full">
              {url}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Ce lien restera accessible depuis la liste des liens pour générer à nouveau le QR code.
          </p>
          {rawToken && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                Afficher l'empreinte du token (avancé)
              </summary>
              <code className="block mt-1 break-all font-mono bg-muted rounded-md p-2 text-[10px]">{rawToken}</code>
            </details>
          )}
        </div>
        <DialogFooter className="flex gap-2">
          <Button className="flex-1" onClick={copyUrl}>
            {copied ? <Check className="w-4 h-4 mr-2 text-green-500" /> : <Copy className="w-4 h-4 mr-2" />}
            Copier l'URL
          </Button>
          <Button variant="outline" onClick={onClose}>Fermer</Button>
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function KioskManagementPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKiosk, setEditingKiosk] = useState<Kiosk | null>(null);
  const [addTokenKiosk, setAddTokenKiosk] = useState<Kiosk | null>(null);
  const [newTokenInfo, setNewTokenInfo] = useState<{ tokenId: string; label: string; kioskName: string; rawToken: string } | null>(null);
  const [qrToken, setQrToken] = useState<KioskToken | null>(null);
  const [editToken, setEditToken] = useState<KioskToken | null>(null);

  const { data: kiosks = [], isLoading: kiosksLoading } = useQuery<Kiosk[]>({
    queryKey: KIOSKS_QUERY_KEY,
    queryFn: () => apiFetch<Kiosk[]>("/api/kiosks"),
  });

  const { data: allTokens = [] } = useQuery<KioskToken[]>({
    queryKey: KIOSK_TOKENS_QUERY_KEY,
    queryFn: () => apiFetch<KioskToken[]>("/api/kiosk/tokens"),
  });

  // Grouper les tokens par kioskId
  const tokensByKiosk = allTokens.reduce<Record<string, KioskToken[]>>((acc, t) => {
    if (!acc[t.kioskId]) acc[t.kioskId] = [];
    acc[t.kioskId]!.push(t);
    return acc;
  }, {});

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

  // ── Mutations kiosk device ─────────────────────────────────────────────────
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

  const deleteMutation = useMutation({
    mutationFn: (k: Kiosk) =>
      apiFetch(`/api/kiosks/${k.id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KIOSKS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: KIOSK_TOKENS_QUERY_KEY });
      toast.success("Kiosque supprimé");
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  // ── Mutations kiosk_tokens ─────────────────────────────────────────────────
  const createTokenMutation = useMutation({
    mutationFn: (data: { kioskId: string; label: string; departmentId?: string | null }) =>
      apiFetch<KioskToken & { rawToken: string }>("/api/kiosk/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: KIOSK_TOKENS_QUERY_KEY });
      const kiosk = kiosks.find(k => k.id === vars.kioskId);
      setNewTokenInfo({ tokenId: data.id, rawToken: data.rawToken, label: data.label, kioskName: kiosk?.name ?? "" });
      setAddTokenKiosk(null);
    },
    onError: () => toast.error("Erreur lors de la création du lien"),
  });

  const regenerateTokenMutation = useMutation({
    mutationFn: ({ tokenId }: { tokenId: string; kioskName: string; label: string }) =>
      apiFetch<KioskToken & { rawToken: string }>(`/api/kiosk/tokens/${tokenId}/regenerate`, { method: "POST" }),
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: KIOSK_TOKENS_QUERY_KEY });
      setNewTokenInfo({ tokenId: data.id, rawToken: data.rawToken, label: vars.label, kioskName: vars.kioskName });
    },
    onError: () => toast.error("Erreur lors de la régénération"),
  });

  const patchTokenMutation = useMutation({
    mutationFn: ({ tokenId, data }: { tokenId: string; data: { label?: string; departmentId?: string | null } }) =>
      apiFetch<KioskToken>(`/api/kiosk/tokens/${tokenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KIOSK_TOKENS_QUERY_KEY });
      toast.success("Lien mis à jour");
      setEditToken(null);
    },
    onError: () => toast.error("Erreur lors de la mise à jour du lien"),
  });

  const revokeTokenMutation = useMutation({
    mutationFn: (tokenId: string) =>
      apiFetch(`/api/kiosk/tokens/${tokenId}/revoke`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KIOSK_TOKENS_QUERY_KEY });
      toast.success("Lien révoqué");
    },
    onError: () => toast.error("Erreur lors de la révocation"),
  });

  const deleteTokenMutation = useMutation({
    mutationFn: (tokenId: string) =>
      apiFetch(`/api/kiosk/tokens/${tokenId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KIOSK_TOKENS_QUERY_KEY });
      toast.success("Lien supprimé");
    },
    onError: () => toast.error("Erreur lors de la suppression du lien"),
  });

  const fmtDate = (d: string | null | undefined) => {
    if (!d) return "Jamais";
    return new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  };

  // Copier URL sans ouvrir le dialogue QR
  const copyTokenUrl = (tokenId: string) => {
    navigator.clipboard.writeText(kioskUrl(tokenId)).then(() => {
      toast.success("URL kiosque copiée !");
    });
  };

  return (
    <div className="p-6 space-y-6">
      {newTokenInfo && (
        <NewTokenModal
          tokenId={newTokenInfo.tokenId}
          rawToken={newTokenInfo.rawToken}
          label={newTokenInfo.label}
          kioskName={newTokenInfo.kioskName}
          onClose={() => setNewTokenInfo(null)}
        />
      )}
      {addTokenKiosk && (
        <AddTokenDialog
          kiosk={addTokenKiosk}
          onSubmit={(data) => createTokenMutation.mutate(data)}
          isPending={createTokenMutation.isPending}
          onClose={() => setAddTokenKiosk(null)}
        />
      )}
      {qrToken && (
        <QrViewDialog
          token={qrToken}
          onClose={() => setQrToken(null)}
        />
      )}
      {editToken && (
        <EditTokenDialog
          token={editToken}
          onSubmit={(data) => patchTokenMutation.mutate({ tokenId: editToken.id, data })}
          isPending={patchTokenMutation.isPending}
          onClose={() => setEditToken(null)}
        />
      )}

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
              {kiosks.map((k) => {
                const tokens = tokensByKiosk[k.id] ?? [];
                return (
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
                        <Badge variant={k.isActive ? "default" : "secondary"}>
                          {k.isActive ? "Actif" : "Inactif"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Liens d'accès (kiosk_tokens) */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <Link2 className="w-3 h-3" /> Liens d'accès
                          </p>
                          <Button
                            variant="ghost" size="sm"
                            className="h-6 px-2 text-xs gap-1"
                            onClick={() => setAddTokenKiosk(k)}
                          >
                            <Plus className="w-3 h-3" />Ajouter
                          </Button>
                        </div>
                        {tokens.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic bg-muted/40 rounded-md p-2 text-center">
                            Aucun lien — cliquez sur Ajouter pour créer un lien d'accès
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {tokens.map(t => (
                              <div key={t.id} className={`border rounded-md p-2 text-xs ${!t.isActive ? "opacity-60 bg-muted/20" : "bg-background"}`}>
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="font-medium truncate flex-1">{t.label}</span>
                                  <Badge
                                    variant={t.revokedAt ? "outline" : t.isActive ? "default" : "secondary"}
                                    className={`text-[10px] h-4 shrink-0 ${t.revokedAt ? "text-orange-600 border-orange-300 bg-orange-50" : ""}`}
                                  >
                                    {t.revokedAt ? "Révoqué" : t.isActive ? "Actif" : "Inactif"}
                                  </Badge>
                                </div>
                                <div className="flex items-center justify-between mt-1.5">
                                  <span className="text-muted-foreground flex items-center gap-1">
                                    <Activity className="w-3 h-3" />
                                    {t.usageCount} accès
                                    {t.lastUsedAt && <span> · {new Date(t.lastUsedAt).toLocaleDateString("fr-FR")}</span>}
                                  </span>
                                  <div className="flex items-center gap-0.5">
                                    {/* Copier URL — toujours disponible */}
                                    <Button
                                      variant="ghost" size="sm" className="h-5 w-5 p-0"
                                      title="Copier l'URL du kiosque"
                                      onClick={() => copyTokenUrl(t.id)}
                                    >
                                      <Copy className="w-2.5 h-2.5" />
                                    </Button>
                                    {/* Afficher QR — toujours disponible */}
                                    <Button
                                      variant="ghost" size="sm" className="h-5 w-5 p-0"
                                      title="Afficher le QR code"
                                      onClick={() => setQrToken(t)}
                                    >
                                      <QrCode className="w-2.5 h-2.5" />
                                    </Button>
                                    {/* Éditer label/département */}
                                    <Button
                                      variant="ghost" size="sm" className="h-5 w-5 p-0"
                                      title="Modifier le label ou le département"
                                      onClick={() => setEditToken(t)}
                                    >
                                      <Pencil className="w-2.5 h-2.5" />
                                    </Button>
                                    {/* Régénérer le hash (invalide l'ancien QR) */}
                                    <Button
                                      variant="ghost" size="sm" className="h-5 w-5 p-0"
                                      title="Régénérer le lien (l'ancien token sera invalide)"
                                      onClick={() => {
                                        if (confirm(`Régénérer le lien "${t.label}" ? L'ancien token sera invalide.`)) {
                                          regenerateTokenMutation.mutate({ tokenId: t.id, kioskName: k.name, label: t.label });
                                        }
                                      }}
                                      disabled={regenerateTokenMutation.isPending}
                                    >
                                      <RotateCcw className="w-2.5 h-2.5" />
                                    </Button>
                                    {!t.revokedAt && (
                                      <Button
                                        variant="ghost" size="sm"
                                        className="h-5 w-5 p-0 text-orange-500 hover:text-orange-700"
                                        title="Révoquer le lien"
                                        onClick={() => {
                                          if (confirm(`Révoquer le lien "${t.label}" ?`)) {
                                            revokeTokenMutation.mutate(t.id);
                                          }
                                        }}
                                        disabled={revokeTokenMutation.isPending}
                                      >
                                        <ShieldOff className="w-2.5 h-2.5" />
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost" size="sm"
                                      className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                                      title="Supprimer ce lien"
                                      onClick={() => {
                                        if (confirm(`Supprimer le lien "${t.label}" définitivement ?`)) {
                                          deleteTokenMutation.mutate(t.id);
                                        }
                                      }}
                                      disabled={deleteTokenMutation.isPending}
                                    >
                                      <Trash2 className="w-2.5 h-2.5" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <RefreshCw className="w-3 h-3" />
                        <span>Vu le : {fmtDate(k.lastSeenAt)}</span>
                      </div>

                      {/* Actions sur la borne */}
                      <div className="flex items-center gap-1.5 pt-1 flex-wrap border-t">
                        <Button
                          variant="outline" size="sm" className="h-8"
                          onClick={() => { setEditingKiosk(k); setDialogOpen(true); }}
                          title="Modifier la borne"
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="h-8"
                          onClick={() => toggleMutation.mutate(k)}
                          disabled={toggleMutation.isPending}
                          title={k.isActive ? "Désactiver la borne" : "Activer la borne"}
                        >
                          {k.isActive
                            ? <ToggleRight className="w-4 h-4 text-emerald-500" />
                            : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                          title="Supprimer la borne"
                          onClick={() => {
                            if (confirm(`Supprimer définitivement "${k.name}" et tous ses liens ? Cette action est irréversible.`)) {
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
                );
              })}
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
              className="border rounded-md px-3 py-1.5 text-sm"
              value={activityDate}
              onChange={e => setActivityDate(e.target.value)}
            />
            <Button variant="outline" size="sm" onClick={() => refetchActivity()} disabled={activityLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${activityLoading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
          </div>

          {activityLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : activityData ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">{activityData.summary.totalPunches}</div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" /> Pointages totaux
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">{activityData.summary.uniqueEmployees}</div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Users className="w-3 h-3" /> Collaborateurs uniques
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">{activityData.summary.activeKiosks}</div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Wifi className="w-3 h-3" /> Kiosques actifs
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Activité par kiosque</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kiosque</TableHead>
                        <TableHead>Emplacement</TableHead>
                        <TableHead className="text-right">Pointages</TableHead>
                        <TableHead className="text-right">Collaborateurs</TableHead>
                        <TableHead>Dernier pointage</TableHead>
                        <TableHead>État</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activityData.kiosks.map(k => (
                        <TableRow key={k.id}>
                          <TableCell className="font-medium">{k.name}</TableCell>
                          <TableCell className="text-muted-foreground">{k.location ?? "—"}</TableCell>
                          <TableCell className="text-right">{k.punchCount}</TableCell>
                          <TableCell className="text-right">{k.uniqueEmployees}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {k.lastPunchAt ? new Date(k.lastPunchAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={k.isActive ? "default" : "secondary"} className="text-xs">
                              {k.isActive ? "Actif" : "Inactif"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {activityData.kiosks.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Aucune activité ce jour
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <BarChart2 className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">Aucune donnée disponible</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {dialogOpen && (
        <KioskDialog
          open={dialogOpen}
          kiosk={editingKiosk}
          onClose={() => { setDialogOpen(false); setEditingKiosk(null); queryClient.invalidateQueries({ queryKey: KIOSKS_QUERY_KEY }); }}
        />
      )}
    </div>
  );
}
