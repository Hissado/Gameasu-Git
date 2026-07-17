import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Download, PackageOpen, RefreshCw, Trash2, Clock,
  CheckCircle2, XCircle, Loader2, AlertTriangle, ShieldAlert,
  Database, FileArchive, Info,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DataExport {
  id: string;
  status: "pending" | "generating" | "ready" | "downloaded" | "expired" | "failed";
  requestedAt: string;
  generatedAt?: string;
  expiresAt?: string;
  downloadedAt?: string;
  fileSize?: number;
  downloadCount: number;
  triggeredBy: string;
  reason?: string;
  requestedByEmail?: string;
  errorMessage?: string;
  stats?: Record<string, number>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSize(bytes?: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtRelative(d?: string | null): string {
  if (!d) return "";
  return formatDistanceToNow(new Date(d), { addSuffix: true, locale: fr });
}

function StatusBadge({ status }: { status: DataExport["status"] }) {
  const cfg = {
    pending:    { label: "En attente",    variant: "secondary" as const, icon: <Clock className="w-3 h-3" /> },
    generating: { label: "Génération…",   variant: "secondary" as const, icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    ready:      { label: "Prêt",          variant: "default" as const,   icon: <CheckCircle2 className="w-3 h-3" /> },
    downloaded: { label: "Téléchargé",    variant: "outline" as const,   icon: <Download className="w-3 h-3" /> },
    expired:    { label: "Expiré",        variant: "outline" as const,   icon: <XCircle className="w-3 h-3" /> },
    failed:     { label: "Échec",         variant: "destructive" as const,icon: <XCircle className="w-3 h-3" /> },
  }[status] ?? { label: status, variant: "outline" as const, icon: null };

  return (
    <Badge variant={cfg.variant} className="gap-1 text-xs">
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function DataExportsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const { data: exports = [], isLoading, refetch } = useQuery<DataExport[]>({
    queryKey: ["data-exports"],
    queryFn: () => apiFetch("/api/data/exports"),
    refetchInterval: (query) => {
      const hasActive = (query.state.data ?? []).some(
        (e: DataExport) => e.status === "pending" || e.status === "generating"
      );
      return hasActive ? 3000 : false;
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: { reason: string }) =>
      apiFetch("/api/data/exports", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast({ title: "Export lancé", description: "La génération du fichier a démarré. Vous serez notifié dès qu'il sera prêt." });
      qc.invalidateQueries({ queryKey: ["data-exports"] });
      setShowCreate(false);
      setReason("");
      setConfirmChecked(false);
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de lancer l'export.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/data/exports/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Export supprimé" }); qc.invalidateQueries({ queryKey: ["data-exports"] }); },
    onError: () => toast({ title: "Erreur", description: "Impossible de supprimer.", variant: "destructive" }),
  });

  const handleDownload = async (exp: DataExport) => {
    if (exp.status !== "ready") return;
    setDownloading(exp.id);
    try {
      const detail = await apiFetch(`/api/data/exports/${exp.id}`);
      const token = detail?.downloadToken ?? "";
      window.open(`/api/data/exports/${exp.id}/download?token=${token}`, "_blank");
      setTimeout(() => { qc.invalidateQueries({ queryKey: ["data-exports"] }); }, 2000);
    } catch {
      toast({ title: "Erreur", description: "Impossible de télécharger.", variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const totalRows = exports.reduce((acc, e) => {
    const s = e.stats ?? {};
    return acc + Object.values(s).reduce((a, v) => a + (v > 0 ? v : 0), 0);
  }, 0);

  const readyCount = exports.filter(e => e.status === "ready").length;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" />
            Données & Exports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Exportez l'intégralité des données de votre organisation dans un fichier ZIP sécurisé.
            Les exports contiennent tous vos enregistrements au format CSV lisible par tout tableur.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-1" /> Actualiser
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <FileArchive className="w-4 h-4 mr-1" /> Nouvel export
          </Button>
        </div>
      </div>

      {/* Alerte sécurité */}
      <Alert>
        <ShieldAlert className="w-4 h-4" />
        <AlertDescription className="text-xs">
          <strong>Données confidentielles.</strong> Les exports contiennent des données sensibles de votre organisation.
          Les liens de téléchargement expirent automatiquement après 24 heures.
          Conservez les archives dans un emplacement sécurisé et limitez leur accès aux personnes autorisées.
          Les mots de passe, tokens et secrets ne sont jamais inclus.
        </AlertDescription>
      </Alert>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{exports.length}</div>
            <div className="text-xs text-muted-foreground">Exports créés</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-green-600">{readyCount}</div>
            <div className="text-xs text-muted-foreground">Disponibles au téléchargement</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{fmtSize(exports.reduce((a, e) => a + (e.fileSize ?? 0), 0))}</div>
            <div className="text-xs text-muted-foreground">Volume total stocké</div>
          </CardContent>
        </Card>
      </div>

      {/* Ce que contient l'export */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Info className="w-4 h-4" />
            Contenu de l'export complet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
            {[
              "Clients & contacts", "Opportunités CRM", "Projets & phases", "Tâches",
              "Collaborateurs", "Contrats RH", "Équipements", "Locations",
              "Commandes & devis", "Factures & paiements", "Fournisseurs", "Plan comptable",
              "Écritures comptables", "Bulletins de paie", "Budgets FP&A", "Journal d'audit",
              "Utilisateurs (sans MDP)", "Comptes bancaires", "Départements", "Postes",
            ].map(item => (
              <div key={item} className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                {item}
              </div>
            ))}
          </div>
          <Separator className="my-3" />
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-400" /> Mots de passe</span>
            <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-400" /> Tokens de session</span>
            <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-400" /> Codes 2FA</span>
            <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-400" /> Clés API privées</span>
          </div>
        </CardContent>
      </Card>

      {/* Historique des exports */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Historique des exports</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Chargement…
            </div>
          ) : exports.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <PackageOpen className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">Aucun export créé</p>
              <p className="text-xs mt-1">Créez votre premier export pour télécharger vos données.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Demandé par</TableHead>
                  <TableHead>Motif</TableHead>
                  <TableHead className="text-right">Taille</TableHead>
                  <TableHead className="text-right">Exp. dans</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {exports.map(exp => (
                  <TableRow key={exp.id} className="text-sm">
                    <TableCell className="text-xs">
                      <div>{fmtDate(exp.requestedAt)}</div>
                      <div className="text-muted-foreground">{fmtRelative(exp.requestedAt)}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={exp.status} />
                      {exp.status === "generating" && (
                        <div className="text-xs text-muted-foreground mt-0.5">En cours…</div>
                      )}
                      {exp.errorMessage && (
                        <div className="text-xs text-red-500 mt-0.5 max-w-[150px] truncate" title={exp.errorMessage}>
                          {exp.errorMessage}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{exp.requestedByEmail ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{exp.reason ?? "—"}</TableCell>
                    <TableCell className="text-right text-xs">{fmtSize(exp.fileSize)}</TableCell>
                    <TableCell className="text-right text-xs">
                      {exp.status === "ready" && exp.expiresAt
                        ? <span className="text-amber-600">{fmtRelative(exp.expiresAt)}</span>
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end">
                        {exp.status === "ready" && (
                          <Button
                            size="sm" variant="default"
                            className="h-7 text-xs gap-1"
                            disabled={downloading === exp.id}
                            onClick={() => handleDownload(exp)}
                          >
                            {downloading === exp.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <Download className="w-3 h-3" />
                            }
                            Télécharger
                          </Button>
                        )}
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                          onClick={() => deleteMutation.mutate(exp.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Politique d'expiration */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-start gap-3 text-xs text-muted-foreground">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <strong className="text-foreground">Politique de conservation :</strong>{" "}
              Les archives d'export sont automatiquement supprimées après 24 heures.
              Les exports générés il y a plus de 25 heures sont nettoyés automatiquement.
              Téléchargez et conservez votre archive dans un emplacement sécurisé dès qu'elle est prête.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal de création */}
      <Dialog open={showCreate} onOpenChange={o => { setShowCreate(o); if (!o) { setReason(""); setConfirmChecked(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileArchive className="w-5 h-5 text-primary" />
              Nouvel export complet
            </DialogTitle>
            <DialogDescription>
              Génère un fichier ZIP contenant toutes les données de votre organisation en format CSV.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Alert variant="destructive" className="py-2">
              <ShieldAlert className="w-4 h-4" />
              <AlertDescription className="text-xs">
                Cet export contient des données confidentielles. Conservez-le dans un emplacement
                sécurisé et limitez son accès aux personnes autorisées.
              </AlertDescription>
            </Alert>

            <div>
              <Label className="text-xs font-medium">Motif de l'export (facultatif)</Label>
              <Textarea
                className="mt-1 text-sm resize-none"
                rows={2}
                placeholder="Ex : Migration vers un autre système, archivage annuel, audit externe…"
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            </div>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 shrink-0"
                checked={confirmChecked}
                onChange={e => setConfirmChecked(e.target.checked)}
              />
              <span className="text-xs text-muted-foreground">
                Je reconnais que cet export contient des données confidentielles et je m'engage
                à le conserver de manière sécurisée et à ne pas le partager avec des personnes non autorisées.
              </span>
            </label>

            <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground space-y-1">
              <div className="font-medium text-foreground">Ce que vous obtenez :</div>
              <div>• Un fichier ZIP contenant ~35 fichiers CSV par domaine métier</div>
              <div>• Un fichier <code>manifest.json</code> avec les métadonnées</div>
              <div>• Lien de téléchargement valide 24 heures</div>
              <div>• Opération tracée dans le journal d'audit</div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button
              disabled={!confirmChecked || createMutation.isPending}
              onClick={() => createMutation.mutate({ reason })}
            >
              {createMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Lancement…</>
                : <><FileArchive className="w-4 h-4 mr-1" /> Lancer l'export</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
