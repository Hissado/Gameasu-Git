import { useState } from "react";
import { useLocation } from "wouter";
import {
  useActiveFirm, useExpertClients, useDocRequests,
  useCreateDocRequest, useUpdateDocRequest,
  DOC_STATUS_LABEL, DOC_STATUS_COLOR,
} from "@/lib/expert-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, CheckCircle, XCircle, AlertCircle, Download } from "lucide-react";

function NewRequestModal({ firmId, orgId, open, onClose }: {
  firmId: string; orgId: string; open: boolean; onClose: () => void;
}) {
  const { toast } = useToast();
  const create = useCreateDocRequest(firmId, orgId);
  const [form, setForm] = useState({ title: "", description: "", dueDate: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({ title: form.title, description: form.description || undefined, dueDate: form.dueDate || undefined });
      toast({ title: "Demande créée" });
      onClose();
      setForm({ title: "", description: "", dueDate: "" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.body?.error, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nouvelle demande de document</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Titre *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Bilan comptable 2024" required />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Précisez le contenu attendu…" />
          </div>
          <div className="space-y-1.5">
            <Label>Date limite</Label>
            <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "Envoi…" : "Créer la demande"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function DocumentRequestsPage() {
  const [location] = useLocation();
  const params = new URLSearchParams(location.includes("?") ? location.split("?")[1] : "");
  const preselectedOrgId = params.get("orgId") ?? null;

  const { firmId } = useActiveFirm();
  const { data: clients } = useExpertClients(firmId);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(preselectedOrgId);
  const { data: requests, isLoading } = useDocRequests(firmId, selectedOrgId);
  const update = useUpdateDocRequest();
  const { toast } = useToast();
  const [newOpen, setNewOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = (requests ?? []).filter((r) => statusFilter === "all" || r.status === statusFilter);

  const handleAction = async (id: string, status: "validated" | "rejected") => {
    try {
      await update.mutateAsync({ id, status });
      toast({ title: status === "validated" ? "Document validé" : "Document rejeté" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.body?.error, variant: "destructive" });
    }
  };

  if (!firmId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Aucun cabinet sélectionné.</p>
      </div>
    );
  }

  const selectedOrg = clients?.find((c) => c.orgId === selectedOrgId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents demandés</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Suivi des demandes par client</p>
        </div>
        {selectedOrgId && (
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />Nouvelle demande
          </Button>
        )}
      </div>

      {/* Client selector + status filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={selectedOrgId ?? "none"} onValueChange={(v) => setSelectedOrgId(v === "none" ? null : v)}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Sélectionner un client…" />
          </SelectTrigger>
          <SelectContent>
            {(clients ?? []).map((c) => (
              <SelectItem key={c.orgId} value={c.orgId}>{c.org.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedOrgId && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="received">Reçu</SelectItem>
              <SelectItem value="validated">Validé</SelectItem>
              <SelectItem value="rejected">Rejeté</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Content */}
      {!selectedOrgId ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
            <FileText className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-muted-foreground">Sélectionnez un client pour voir ses demandes de documents.</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : !filtered.length ? (
        <Card>
          <CardContent className="py-14 flex flex-col items-center gap-3 text-center">
            <AlertCircle className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">
              {statusFilter !== "all" ? "Aucune demande pour ce statut." : `Aucune demande pour ${selectedOrg?.org.name ?? "ce client"}.`}
            </p>
            {statusFilter === "all" && (
              <Button size="sm" onClick={() => setNewOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" />Créer la première demande
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Card key={r.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-muted rounded-lg shrink-0">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{r.title}</span>
                      <Badge className={`text-[10px] border ${DOC_STATUS_COLOR[r.status]}`} variant="outline">
                        {DOC_STATUS_LABEL[r.status]}
                      </Badge>
                    </div>
                    {r.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</p>}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span>Créée le {new Date(r.createdAt).toLocaleDateString("fr-FR")}</span>
                      {r.dueDate && <span>· Échéance : {new Date(r.dueDate).toLocaleDateString("fr-FR")}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {r.fileUrl && (
                      <a href={r.fileUrl} target="_blank" rel="noreferrer">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Télécharger">
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </a>
                    )}
                    {r.status === "received" && (
                      <>
                        <Button
                          variant="ghost" size="sm"
                          className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50"
                          title="Valider"
                          onClick={() => handleAction(r.id, "validated")}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className="h-8 w-8 p-0 text-destructive/70 hover:bg-destructive/10"
                          title="Rejeter"
                          onClick={() => handleAction(r.id, "rejected")}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {firmId && selectedOrgId && (
        <NewRequestModal firmId={firmId} orgId={selectedOrgId} open={newOpen} onClose={() => setNewOpen(false)} />
      )}
    </div>
  );
}
