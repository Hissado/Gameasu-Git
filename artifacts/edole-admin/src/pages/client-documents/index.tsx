import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { DOC_STATUS_LABEL, DOC_STATUS_COLOR } from "@/lib/expert-api";
import type { DocRequest, DocStatus } from "@/lib/expert-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Upload, Download, Clock, CheckCircle2, XCircle, AlertCircle, Inbox,
} from "lucide-react";

// ─── API hooks ────────────────────────────────────────────────────────────────

function useClientDocRequests() {
  return useQuery<DocRequest[]>({
    queryKey: ["expert/client/doc-requests"],
    queryFn: () => apiFetch("/api/expert/client/document-requests"),
    staleTime: 30_000,
  });
}

function useSubmitClientDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      file,
    }: {
      id: string;
      file: File;
    }) => {
      const { uploadURL, objectPath } = await apiFetch<{ uploadURL: string; objectPath: string }>(
        "/api/expert/client/document-requests/upload-url",
      );
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!putRes.ok) {
        throw new Error(`Échec du téléversement (${putRes.status})`);
      }
      const fileUrl = `/api/storage${objectPath}`;
      return apiFetch(`/api/expert/client/document-requests/${id}/submit`, {
        method: "PATCH",
        body: { fileUrl, fileName: file.name },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expert/client/doc-requests"] }),
  });
}

// ─── Upload dialog ────────────────────────────────────────────────────────────

function UploadDialog({
  request,
  open,
  onClose,
}: {
  request: DocRequest;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const submit = useSubmitClientDoc();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setSelectedFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    try {
      await submit.mutateAsync({ id: request.id, file: selectedFile });
      toast({ title: "Document déposé", description: "Le cabinet a été notifié." });
      onClose();
      setSelectedFile(null);
    } catch (err: any) {
      toast({
        title: "Erreur lors du dépôt",
        description: err?.body?.error ?? "Veuillez réessayer.",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Déposer un document</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-1">
            <p className="text-sm font-semibold">{request.title}</p>
            {request.description && (
              <p className="text-xs text-muted-foreground">{request.description}</p>
            )}
            {request.dueDate && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3" />
                Échéance : {new Date(request.dueDate).toLocaleDateString("fr-FR")}
              </p>
            )}
          </div>

          <div
            className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/40 hover:bg-primary/[0.02] transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="w-8 h-8 text-muted-foreground/50" />
            {selectedFile ? (
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} Mo
                </p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Cliquez pour sélectionner un fichier</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">PDF, Word, Excel, images — max 25 Mo</p>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp,.zip"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={!selectedFile || submit.isPending}>
              {submit.isPending ? "Envoi en cours…" : "Déposer le fichier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Status icon ──────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: DocStatus }) {
  if (status === "valide") return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
  if (status === "rejete") return <XCircle className="w-4 h-4 text-destructive" />;
  if (status === "recu") return <CheckCircle2 className="w-4 h-4 text-blue-600" />;
  return <Clock className="w-4 h-4 text-amber-600" />;
}

// ─── Request card ─────────────────────────────────────────────────────────────

function RequestCard({ request }: { request: DocRequest }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const canUpload = request.status === "en_attente" || request.status === "rejete";

  return (
    <>
      <Card className="hover:shadow-sm transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 p-2 rounded-lg bg-muted shrink-0">
              <StatusIcon status={request.status} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{request.title}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] border ${DOC_STATUS_COLOR[request.status]}`}
                >
                  {DOC_STATUS_LABEL[request.status]}
                </Badge>
              </div>

              {request.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {request.description}
                </p>
              )}

              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                <span>Demandé le {new Date(request.createdAt).toLocaleDateString("fr-FR")}</span>
                {request.dueDate && (
                  <span className="flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />
                    Échéance : {new Date(request.dueDate).toLocaleDateString("fr-FR")}
                  </span>
                )}
                {request.fileName && (
                  <span className="flex items-center gap-0.5 text-blue-600">
                    <FileText className="w-3 h-3" />
                    {request.fileName}
                  </span>
                )}
              </div>

              {request.status === "rejete" && (
                <p className="text-xs text-destructive mt-1.5 font-medium">
                  Le document a été rejeté. Veuillez en déposer un nouveau.
                </p>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {request.fileUrl && (
                <a href={request.fileUrl} target="_blank" rel="noreferrer">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Télécharger le fichier déposé">
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                </a>
              )}
              {canUpload && (
                <Button
                  size="sm"
                  variant={request.status === "rejete" ? "default" : "outline"}
                  className="h-8 text-xs gap-1.5"
                  onClick={() => setUploadOpen(true)}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Déposer
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <UploadDialog
        request={request}
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
      />
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "en_attente", label: "En attente" },
  { value: "recu", label: "Reçu" },
  { value: "valide", label: "Validé" },
  { value: "rejete", label: "Rejeté" },
];

export default function ClientDocumentsPage() {
  const { data: requests, isLoading } = useClientDocRequests();
  const [filter, setFilter] = useState("all");

  const allRequests = requests ?? [];
  const filtered =
    filter === "all" ? allRequests : allRequests.filter((r) => r.status === filter);

  const pendingCount = allRequests.filter(
    (r) => r.status === "en_attente" || r.status === "rejete",
  ).length;

  return (
    <div className="space-y-5 max-w-4xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Documents demandés</h1>
        <p className="text-muted-foreground mt-1">
          {pendingCount > 0 ? (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
              {pendingCount} document{pendingCount > 1 ? "s" : ""} en attente de dépôt
            </span>
          ) : (
            "Tous vos documents sont à jour ✓"
          )}
        </p>
      </div>

      {/* Filter pills */}
      {allRequests.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((opt) => {
            const count =
              opt.value === "all"
                ? allRequests.length
                : allRequests.filter((r) => r.status === opt.value).length;
            if (count === 0 && opt.value !== "all") return null;
            return (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                  filter === opt.value
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-primary"
                }`}
              >
                {opt.label}
                {count > 0 && (
                  <span
                    className={`ml-1.5 text-[10px] font-bold ${
                      filter === opt.value ? "text-white/80" : "text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
            {allRequests.length === 0 ? (
              <>
                <Inbox className="w-12 h-12 text-muted-foreground/30" />
                <p className="font-semibold text-muted-foreground">Aucune demande de document</p>
                <p className="text-sm text-muted-foreground">
                  Votre cabinet comptable n'a pas encore demandé de documents.
                </p>
              </>
            ) : (
              <>
                <AlertCircle className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm">
                  Aucune demande pour ce filtre.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <RequestCard key={r.id} request={r} />
          ))}
        </div>
      )}
    </div>
  );
}
