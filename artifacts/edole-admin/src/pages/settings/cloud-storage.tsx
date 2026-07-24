import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Cloud, CheckCircle2, XCircle, AlertTriangle, Loader2,
  RefreshCw, Trash2, ExternalLink, FolderOpen, Settings,
  Plug, ShieldCheck, Clock, FileArchive, ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

// ─── Types ─────────────────────────────────────────────────────────────────

interface Provider {
  id: string; label: string; description: string;
  icon: string; available: boolean;
}

interface Connection {
  id: string; provider: string; displayName?: string;
  accountEmail?: string; accountName?: string;
  status: "connected" | "disconnected" | "error" | "expired";
  syncEnabled: boolean; autoSync: boolean;
  rootFolderName?: string; lastSyncAt?: string;
  lastError?: string; connectedAt?: string;
  folderMap?: Record<string, string>;
}

interface SyncedFile {
  id: string; fileName: string; status: string;
  cloudViewUrl?: string; syncedAt?: string;
  gamesuModule?: string; fileSize?: number; errorMessage?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const PROVIDER_ICONS: Record<string, string> = {
  google_drive: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Google_Drive_icon_%282020%29.svg/48px-Google_Drive_icon_%282020%29.svg.png",
  onedrive:     "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Microsoft_Office_OneDrive_%282019%E2%80%93present%29.svg/48px-Microsoft_Office_OneDrive_%282019%E2%80%93present%29.svg.png",
  sharepoint:   "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Microsoft_Office_SharePoint_%282019%E2%80%93present%29.svg/48px-Microsoft_Office_SharePoint_%282019%E2%80%93present%29.svg.png",
  s3:           "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Amazon-S3-Logo.svg/48px-Amazon-S3-Logo.svg.png",
  dropbox:      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Dropbox_logo_2017.svg/48px-Dropbox_logo_2017.svg.png",
};

function StatusBadge({ status }: { status: Connection["status"] }) {
  const cfg = {
    connected:    { label: "Connecté",     className: "bg-green-100 text-green-700 border-green-200" },
    disconnected: { label: "Déconnecté",   className: "bg-muted text-muted-foreground" },
    error:        { label: "Erreur",       className: "bg-red-100 text-red-700 border-red-200" },
    expired:      { label: "Expiré",       className: "bg-amber-100 text-amber-700 border-amber-200" },
  }[status] ?? { label: status, className: "bg-muted" };
  return <Badge variant="outline" className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>;
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return formatDistanceToNow(new Date(d), { addSuffix: true, locale: fr });
}

function fmtSize(b?: number | null) {
  if (!b) return "";
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} Ko`;
  return `${(b / (1024 * 1024)).toFixed(1)} Mo`;
}

// ─── Page principale ───────────────────────────────────────────────────────

export default function CloudStoragePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [location] = useLocation();
  const [confirmDisconnect, setConfirmDisconnect] = useState<Connection | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  // Lire les query params pour les retours OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) {
      toast({ title: "Google Drive connecté !", description: "La structure de dossiers est en cours de création." });
      qc.invalidateQueries({ queryKey: ["cloud-connections"] });
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("error")) {
      toast({ title: "Connexion échouée", description: "L'autorisation a été refusée ou une erreur s'est produite.", variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ["cloud-providers"],
    queryFn:  () => apiFetch("/api/cloud-storage/providers"),
  });

  const { data: connections = [], isLoading: loadingConn } = useQuery<Connection[]>({
    queryKey: ["cloud-connections"],
    queryFn:  () => apiFetch("/api/cloud-storage/connections"),
  });

  const { data: recentFiles = [] } = useQuery<SyncedFile[]>({
    queryKey: ["cloud-files"],
    queryFn:  () => apiFetch("/api/cloud-storage/files"),
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/cloud-storage/connections/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Fournisseur déconnecté" });
      qc.invalidateQueries({ queryKey: ["cloud-connections"] });
      setConfirmDisconnect(null);
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de déconnecter.", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, key, val }: { id: string; key: string; val: boolean }) =>
      apiFetch(`/api/cloud-storage/connections/${id}`, { method: "PUT", body: JSON.stringify({ [key]: val }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cloud-connections"] }),
  });

  const handleConnect = async (providerId: string) => {
    setConnecting(providerId);
    try {
      const { url } = await apiFetch<{ url: string }>(`/api/cloud-storage/oauth/${providerId.replace("_drive", "").replace("google", "google")}/start`.replace("/oauth/google_drive/", "/oauth/google/"));
      window.location.href = url;
    } catch (err: any) {
      toast({ title: "Connexion impossible", description: err?.message ?? "Vérifiez la configuration des secrets GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET.", variant: "destructive" });
      setConnecting(null);
    }
  };

  const handleGoogleConnect = async () => {
    setConnecting("google_drive");
    try {
      const { url } = await apiFetch<{ url: string }>("/api/cloud-storage/oauth/google/start");
      window.location.href = url;
    } catch (err: any) {
      toast({ title: "Connexion impossible", description: err?.message ?? "Vérifiez GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET.", variant: "destructive" });
      setConnecting(null);
    }
  };

  const handleTest = async (conn: Connection) => {
    setTesting(conn.id);
    try {
      const result = await apiFetch<{ ok: boolean; quota?: string; error?: string }>(`/api/cloud-storage/connections/${conn.id}/test`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["cloud-connections"] });
      if (result.ok) {
        toast({ title: "Connexion vérifiée", description: `Quota : ${result.quota ?? "N/A"}` });
      } else {
        toast({ title: "Connexion échouée", description: result.error ?? "Vérifiez les credentials.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erreur", description: "Test impossible.", variant: "destructive" });
    } finally {
      setTesting(null);
    }
  };

  const connectedProviders = new Set(connections.filter(c => c.status === "connected").map(c => c.provider));

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Cloud className="w-6 h-6 text-primary" />
            Documents & Stockage cloud
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connectez votre espace de stockage cloud pour synchroniser automatiquement vos documents (factures, contrats, bulletins de paie…).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["cloud-connections"] })}>
          <RefreshCw className="w-4 h-4 mr-1" /> Actualiser
        </Button>
      </div>

      {/* Alerte sécurité */}
      <Alert>
        <ShieldCheck className="w-4 h-4" />
        <AlertDescription className="text-xs">
          <strong>Accès limité.</strong> Gameasu ne peut accéder qu'aux fichiers qu'il a lui-même créés dans votre Drive (scope <code>drive.file</code>).
          Vos fichiers personnels et professionnels existants ne sont jamais lus ni modifiés.
          Les tokens d'accès sont chiffrés en base (AES-256-GCM) et jamais exposés côté client.
        </AlertDescription>
      </Alert>

      {/* Connexions actives */}
      {connections.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Plug className="w-4 h-4" />
              Connexions configurées
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {connections.map(conn => (
                <div key={conn.id} className="flex items-center gap-4 p-4">
                  <img
                    src={PROVIDER_ICONS[conn.provider]}
                    alt={conn.provider}
                    className="w-8 h-8 object-contain shrink-0"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{conn.displayName ?? conn.provider}</span>
                      <StatusBadge status={conn.status} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 space-x-3">
                      {conn.accountEmail && <span>{conn.accountEmail}</span>}
                      {conn.rootFolderName && (
                        <span className="inline-flex items-center gap-1">
                          <FolderOpen className="w-3 h-3" /> {conn.rootFolderName}
                        </span>
                      )}
                      {conn.lastSyncAt && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Sync {fmtDate(conn.lastSyncAt)}
                        </span>
                      )}
                    </div>
                    {conn.lastError && (
                      <div className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {conn.lastError}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <Switch
                        id={`sync-${conn.id}`}
                        checked={conn.syncEnabled}
                        onCheckedChange={v => toggleMutation.mutate({ id: conn.id, key: "syncEnabled", val: v })}
                        className="scale-75"
                      />
                      <Label htmlFor={`sync-${conn.id}`} className="text-xs cursor-pointer">Sync active</Label>
                    </div>
                    <Button
                      size="sm" variant="outline" className="h-7 text-xs gap-1"
                      onClick={() => handleTest(conn)} disabled={testing === conn.id}
                    >
                      {testing === conn.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      Tester
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                      onClick={() => setConfirmDisconnect(conn)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Catalogue des fournisseurs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Fournisseurs disponibles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {providers.map(p => {
              const isConnected = connectedProviders.has(p.id);
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    p.available ? "hover:bg-muted/50 cursor-default" : "opacity-60"
                  } ${isConnected ? "border-green-200 bg-green-50/50" : "border"}`}
                >
                  <img
                    src={PROVIDER_ICONS[p.id]}
                    alt={p.label}
                    className="w-8 h-8 object-contain shrink-0"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{p.label}</span>
                      {isConnected && <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-200">Connecté</Badge>}
                      {!p.available && <Badge variant="outline" className="text-xs">Bientôt</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>
                  </div>
                  {p.available && !isConnected && p.id === "google_drive" && (
                    <Button
                      size="sm" className="shrink-0 gap-1 h-8 text-xs"
                      onClick={handleGoogleConnect}
                      disabled={connecting === p.id}
                    >
                      {connecting === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plug className="w-3 h-3" />}
                      Connecter
                    </Button>
                  )}
                  {isConnected && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Arborescence de dossiers */}
      {connections.some(c => c.status === "connected" && c.folderMap) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              Structure de dossiers créée
            </CardTitle>
          </CardHeader>
          <CardContent>
            {connections.filter(c => c.status === "connected" && c.folderMap).map(conn => (
              <div key={conn.id}>
                <div className="text-xs font-medium text-muted-foreground mb-2">{conn.displayName}</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(conn.folderMap ?? {}).filter(([k]) => k !== "root").map(([key, folderId]) => {
                    const labels: Record<string, string> = {
                      clients: "Clients", suppliers: "Fournisseurs",
                      hr: "Ressources humaines", accounting: "Comptabilité",
                      projects: "Projets", reports: "Rapports", backups: "Sauvegardes",
                    };
                    return (
                      <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground p-2 rounded border bg-muted/30">
                        <FolderOpen className="w-3 h-3 text-amber-500 shrink-0" />
                        {labels[key] ?? key}
                        <CheckCircle2 className="w-2.5 h-2.5 text-green-500 ml-auto shrink-0" />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Fichiers récemment synchronisés */}
      {recentFiles.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileArchive className="w-4 h-4" />
              Fichiers synchronisés récemment
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Fichier</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Synchronisé</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentFiles.slice(0, 15).map(f => (
                  <TableRow key={f.id} className="text-sm">
                    <TableCell className="text-xs font-medium">{f.fileName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{f.gamesuModule ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${
                        f.status === "synced" ? "bg-green-100 text-green-700 border-green-200" :
                        f.status === "failed" ? "bg-red-100 text-red-700 border-red-200" :
                        f.status === "pending" ? "bg-amber-100 text-amber-700 border-amber-200" :
                        ""
                      }`}>
                        {f.status === "synced" ? "Synchronisé" :
                         f.status === "failed" ? "Échec" :
                         f.status === "pending" ? "En attente" :
                         f.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(f.syncedAt)}</TableCell>
                    <TableCell>
                      {f.cloudViewUrl && (
                        <a href={f.cloudViewUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* État si aucune connexion */}
      {!loadingConn && connections.length === 0 && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center text-center text-muted-foreground">
            <Cloud className="w-12 h-12 mb-4 opacity-20" />
            <p className="font-medium text-foreground">Aucun stockage cloud configuré</p>
            <p className="text-sm mt-1 max-w-sm">
              Connectez Google Drive pour synchroniser automatiquement vos factures, contrats et documents RH.
            </p>
            <Button className="mt-4 gap-2" onClick={handleGoogleConnect} disabled={!!connecting}>
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
              Connecter Google Drive
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Informations de configuration */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configuration requise
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
              <span>Créez un projet dans <strong className="text-foreground">Google Cloud Console</strong> et activez l'API Google Drive.</span>
            </div>
            <div className="flex items-start gap-2">
              <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
              <span>Créez des identifiants OAuth 2.0 (Web application) et configurez <code className="bg-muted px-1 rounded">GOOGLE_CLIENT_ID</code> et <code className="bg-muted px-1 rounded">GOOGLE_CLIENT_SECRET</code> dans les secrets de l'application.</span>
            </div>
            <div className="flex items-start gap-2">
              <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
              <span>URI de redirection OAuth à ajouter dans Google Cloud Console :<br />
                <code className="bg-muted px-1 rounded break-all">{window.location.origin}/api/cloud-storage/oauth/google/callback</code>
              </span>
            </div>
            <div className="flex items-start gap-2">
              <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
              <span>Configurez <code className="bg-muted px-1 rounded">CLOUD_STORAGE_ENCRYPTION_KEY</code> (clé aléatoire 32+ caractères) pour le chiffrement des tokens.</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal de déconnexion */}
      <Dialog open={!!confirmDisconnect} onOpenChange={o => { if (!o) setConfirmDisconnect(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Déconnecter {confirmDisconnect?.displayName ?? confirmDisconnect?.provider} ?</DialogTitle>
            <DialogDescription>
              Les tokens d'accès seront supprimés. Les fichiers déjà synchronisés dans votre Drive restent intacts.
              La synchronisation automatique sera désactivée.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDisconnect(null)}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={() => confirmDisconnect && disconnectMutation.mutate(confirmDisconnect.id)}
              disabled={disconnectMutation.isPending}
            >
              {disconnectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Déconnecter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
