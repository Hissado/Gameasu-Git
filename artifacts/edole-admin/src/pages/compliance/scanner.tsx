import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ScanLine, Upload, FileText, CheckCircle2, Clock, AlertCircle,
  RefreshCw, Eye, Pencil, Check, X, Building2, Hash, Calendar,
  DollarSign, Package, Info,
} from "lucide-react";
import { formatFCFA } from "@/lib/format";

interface InvoiceScan {
  id: string;
  fileName: string;
  mimeType: string;
  status: "pending" | "processing" | "done" | "error";
  aiConfidence: string | null;
  extractedData: Record<string, unknown> | null;
  linkedEntryId: string | null;
  processedAt: string | null;
  createdAt: string;
  notes: string | null;
}

interface ExtractedInvoice {
  documentType?: string;
  vendeur?: { nom?: string; nif?: string; adresse?: string; telephone?: string };
  client?: { nom?: string; nif?: string; adresse?: string };
  numero?: string;
  date?: string;
  dateEcheance?: string;
  lignes?: Array<{ description?: string; quantite?: number; prixUnitaire?: number; total?: number }>;
  montantHT?: number;
  montantTVA?: number;
  tauxTVA?: number;
  montantTTC?: number;
  devise?: string;
  modePaiement?: string;
  notes?: string;
}

const STATUS_CONFIG = {
  pending:    { label: "En attente",    color: "bg-yellow-100 text-yellow-800",  icon: Clock },
  processing: { label: "Traitement…",  color: "bg-blue-100 text-blue-800",     icon: RefreshCw },
  done:       { label: "Traité",        color: "bg-green-100 text-green-800",   icon: CheckCircle2 },
  error:      { label: "Erreur",        color: "bg-red-100 text-red-800",       icon: AlertCircle },
} as const;

function ScanStatusBadge({ status }: { status: InvoiceScan["status"] }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function ConfidenceBadge({ value }: { value: string | null }) {
  if (!value) return null;
  const pct = Math.round(parseFloat(value) * 100);
  const color = pct >= 80 ? "text-green-600" : pct >= 50 ? "text-yellow-600" : "text-red-600";
  return <span className={`text-xs font-medium ${color}`}>{pct}% confiance</span>;
}

function ExtractedDataView({ data }: { data: Record<string, unknown> }) {
  const d = data as ExtractedInvoice;
  if (!d || Object.keys(d).length === 0) return <p className="text-sm text-muted-foreground">Aucune donnée extraite.</p>;

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="grid grid-cols-2 gap-4">
        {d.numero && (
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Numéro</p>
              <p className="text-sm font-semibold">{d.numero}</p>
            </div>
          </div>
        )}
        {d.date && (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Date</p>
              <p className="text-sm font-semibold">{d.date}</p>
            </div>
          </div>
        )}
      </div>

      {/* Parties */}
      <div className="grid grid-cols-2 gap-4">
        {d.vendeur && (
          <div className="p-3 rounded-lg bg-muted/40">
            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><Building2 className="w-3 h-3" /> Vendeur</p>
            <p className="text-sm font-semibold">{d.vendeur.nom ?? "—"}</p>
            {d.vendeur.nif && <p className="text-xs text-muted-foreground">NIF: {d.vendeur.nif}</p>}
          </div>
        )}
        {d.client && (
          <div className="p-3 rounded-lg bg-muted/40">
            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><Building2 className="w-3 h-3" /> Client</p>
            <p className="text-sm font-semibold">{d.client.nom ?? "—"}</p>
            {d.client.nif && <p className="text-xs text-muted-foreground">NIF: {d.client.nif}</p>}
          </div>
        )}
      </div>

      {/* Lignes */}
      {d.lignes && d.lignes.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Package className="w-3 h-3" /> Lignes ({d.lignes.length})</p>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2">Description</th>
                  <th className="text-right px-3 py-2">Qté</th>
                  <th className="text-right px-3 py-2">PU</th>
                  <th className="text-right px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {d.lignes.map((l, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2">{l.description ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{l.quantite ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{l.prixUnitaire != null ? formatFCFA(l.prixUnitaire) : "—"}</td>
                    <td className="px-3 py-2 text-right font-medium">{l.total != null ? formatFCFA(l.total) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Totaux */}
      <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="w-4 h-4 text-primary" />
          <p className="text-xs font-medium text-primary">Montants</p>
        </div>
        <div className="space-y-1 text-sm">
          {d.montantHT != null && (
            <div className="flex justify-between"><span className="text-muted-foreground">Montant HT</span><span>{formatFCFA(d.montantHT)}</span></div>
          )}
          {d.montantTVA != null && (
            <div className="flex justify-between"><span className="text-muted-foreground">TVA {d.tauxTVA != null ? `(${d.tauxTVA}%)` : ""}</span><span>{formatFCFA(d.montantTVA)}</span></div>
          )}
          {d.montantTTC != null && (
            <div className="flex justify-between font-bold text-base border-t pt-1 mt-1"><span>Total TTC</span><span className="text-primary">{formatFCFA(d.montantTTC)}</span></div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InvoiceScannerPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedScan, setSelectedScan] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const { data: scans = [], isLoading } = useQuery<InvoiceScan[]>({
    queryKey: ["compliance-scans"],
    queryFn: () => apiFetch("/api/compliance/scans"),
    refetchInterval: (query) => {
      const data = query.state.data as InvoiceScan[] | undefined;
      if (data?.some((s) => s.status === "processing" || s.status === "pending")) return 3000;
      return false;
    },
  });

  const selected = scans.find((s) => s.id === selectedScan);

  const reprocessMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/compliance/scans/${id}/reprocess`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["compliance-scans"] }); toast({ title: "Retraitement lancé" }); },
  });

  const handleFile = useCallback(async (file: File) => {
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/heic", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Format non supporté", description: "PDF, PNG, JPEG ou HEIC uniquement.", variant: "destructive" });
      return;
    }
    setPendingFile(file);
  }, [toast]);

  const handleAnalyse = async () => {
    if (!pendingFile) return;
    setUploading(true);
    try {
      const { uploadURL, objectPath } = await apiFetch<{ uploadURL: string; objectPath: string }>("/api/storage/uploads/request-url", {
        method: "POST",
        body: { name: pendingFile.name, size: pendingFile.size, contentType: pendingFile.type },
      });
      await fetch(uploadURL, { method: "PUT", body: pendingFile, headers: { "Content-Type": pendingFile.type } });
      await apiFetch("/api/compliance/scan-invoice", {
        method: "POST",
        body: { fileUrl: `/api/storage${objectPath}`, fileName: pendingFile.name, mimeType: pendingFile.type },
      });
      qc.invalidateQueries({ queryKey: ["compliance-scans"] });
      setPendingFile(null);
      toast({ title: "Document envoyé", description: "L'analyse IA est en cours…" });
    } catch {
      toast({ title: "Erreur", description: "Impossible d'envoyer le document.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const totalDone = scans.filter((s) => s.status === "done").length;
  const totalPending = scans.filter((s) => s.status === "processing" || s.status === "pending").length;
  const totalError = scans.filter((s) => s.status === "error").length;
  const avgConfidence = scans
    .filter((s) => s.aiConfidence)
    .reduce((acc, s) => acc + parseFloat(s.aiConfidence!), 0) / (scans.filter((s) => s.aiConfidence).length || 1);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ScanLine className="w-6 h-6 text-primary" />
          Scanner intelligent de factures
        </h1>
        <p className="text-muted-foreground mt-1">Extrayez automatiquement les données de vos factures PDF/image par intelligence artificielle</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Documents traités</p>
          <p className="text-2xl font-bold text-green-600">{totalDone}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">En traitement</p>
          <p className="text-2xl font-bold text-blue-600">{totalPending}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Erreurs</p>
          <p className="text-2xl font-bold text-red-600">{totalError}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Confiance moy.</p>
          <p className="text-2xl font-bold text-primary">{isNaN(avgConfidence) ? "—" : `${Math.round(avgConfidence * 100)}%`}</p>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne gauche : upload + liste */}
        <div className="lg:col-span-1 space-y-4">
          {/* Formulaire upload fichier */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Upload className="w-4 h-4" /> Soumettre un document</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Zone drag-and-drop */}
              <div
                className={`relative border-2 border-dashed rounded-lg transition-colors cursor-pointer ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.heic,.webp"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
                />
                {pendingFile ? (
                  <div className="p-4 flex items-center gap-3">
                    <FileText className="w-8 h-8 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{pendingFile.name}</p>
                      <p className="text-xs text-muted-foreground">{(pendingFile.size / 1024).toFixed(0)} Ko · {pendingFile.type.split("/")[1]?.toUpperCase()}</p>
                    </div>
                    <button
                      className="ml-auto text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setPendingFile(null); }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm font-medium">Glissez votre facture ici</p>
                    <p className="text-xs text-muted-foreground mt-1">ou cliquez pour sélectionner</p>
                    <p className="text-xs text-muted-foreground mt-2">PDF, PNG, JPEG, HEIC</p>
                  </div>
                )}
              </div>

              <Button
                className="w-full"
                onClick={handleAnalyse}
                disabled={!pendingFile || uploading}
              >
                {uploading
                  ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Envoi en cours…</>
                  : <><ScanLine className="w-4 h-4 mr-2" /> Analyser</>}
              </Button>

              <div className="flex items-start gap-2 p-2 rounded bg-blue-50 text-blue-800 text-xs">
                <Info className="w-3 h-3 mt-0.5 shrink-0" />
                <span>L'IA extrait le vendeur, client, montants, lignes et dates. Vérifiez et corrigez avant comptabilisation.</span>
              </div>
            </CardContent>
          </Card>

          {/* Liste des scans */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Historique des scans</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Chargement…</div>
              ) : scans.length === 0 ? (
                <div className="p-6 text-center">
                  <ScanLine className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Aucun scan pour l'instant</p>
                </div>
              ) : (
                <div className="divide-y max-h-96 overflow-y-auto">
                  {scans.map((scan) => (
                    <button
                      key={scan.id}
                      className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${selectedScan === scan.id ? "bg-primary/5" : ""}`}
                      onClick={() => setSelectedScan(scan.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{scan.fileName}</p>
                          <p className="text-xs text-muted-foreground">{new Date(scan.createdAt).toLocaleDateString("fr-FR")}</p>
                        </div>
                        <ScanStatusBadge status={scan.status} />
                      </div>
                      {scan.aiConfidence && scan.status === "done" && (
                        <div className="mt-1"><ConfidenceBadge value={scan.aiConfidence} /></div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Colonne droite : détail du scan sélectionné */}
        <div className="lg:col-span-2">
          {!selected ? (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Sélectionnez un scan pour voir les données extraites</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{selected.fileName}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <ScanStatusBadge status={selected.status} />
                      {selected.aiConfidence && <ConfidenceBadge value={selected.aiConfidence} />}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {(selected.status === "error" || selected.status === "done") && (
                      <Button
                        variant="outline" size="sm"
                        onClick={() => reprocessMutation.mutate(selected.id)}
                        disabled={reprocessMutation.isPending}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" /> Retraiter
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {selected.status === "processing" || selected.status === "pending" ? (
                  <div className="text-center py-8">
                    <RefreshCw className="w-8 h-8 text-blue-500 mx-auto mb-3 animate-spin" />
                    <p className="text-sm text-muted-foreground">Analyse IA en cours…</p>
                    <p className="text-xs text-muted-foreground mt-1">Cela peut prendre quelques secondes</p>
                  </div>
                ) : selected.status === "error" ? (
                  <div className="p-4 rounded-lg bg-red-50 text-red-800">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="w-4 h-4" />
                      <span className="font-medium text-sm">Erreur d'analyse</span>
                    </div>
                    <p className="text-xs">{(selected.extractedData as Record<string, unknown>)?.errorMessage as string ?? "Erreur inconnue"}</p>
                  </div>
                ) : selected.extractedData ? (
                  <ExtractedDataView data={selected.extractedData} />
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune donnée extraite.</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
