import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import {
  ShieldCheck, Stamp, FileSignature, CheckCircle2, Clock, AlertCircle,
  XCircle, Hash, Calendar, Plus, Eye, Trash2, RefreshCw, Info,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface DocumentSeal {
  id: string;
  documentType: string;
  documentId: string;
  contentHash: string;
  sealedAt: string;
  isValid: boolean;
  sealMetadata: Record<string, unknown> | null;
  revokedAt: string | null;
}

interface SignatureRequest {
  id: string;
  documentType: string;
  documentId: string;
  documentLabel: string;
  status: "pending" | "partially_signed" | "completed" | "rejected" | "cancelled";
  message: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  signers: Array<{
    id: string;
    signerEmail: string;
    signerName: string;
    signerRole: string | null;
    signerId: string | null;
    order: number;
    status: "pending" | "signed" | "rejected";
    signedAt: string | null;
    fingerprint: string | null;
  }>;
}

interface ComplianceDashboard {
  scans: { total: number; done: number; pending: number; error: number };
  seals: { total: number; valid: number; revoked: number };
  signatures: { total: number; pending: number; completed: number };
}

// ─── Sous-composants ─────────────────────────────────────────────────────────
const SIG_STATUS = {
  pending:          { label: "En attente",      color: "bg-yellow-100 text-yellow-800", icon: Clock },
  partially_signed: { label: "Partiel",          color: "bg-blue-100 text-blue-800",    icon: RefreshCw },
  completed:        { label: "Complété",         color: "bg-green-100 text-green-800",  icon: CheckCircle2 },
  rejected:         { label: "Refusé",           color: "bg-red-100 text-red-800",      icon: XCircle },
  cancelled:        { label: "Annulé",           color: "bg-gray-100 text-gray-600",    icon: XCircle },
} as const;

function SigStatusBadge({ status }: { status: SignatureRequest["status"] }) {
  const cfg = SIG_STATUS[status] ?? SIG_STATUS.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

// ─── Onglet Cachets numériques ────────────────────────────────────────────────
function SealsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ documentType: "invoice", documentId: "", contentToHash: "", documentLabel: "" });
  const [verifyId, setVerifyId] = useState<string | null>(null);
  const [verifyContent, setVerifyContent] = useState("");
  const [verifyResult, setVerifyResult] = useState<{ isIntact: boolean; storedHash: string; currentHash: string } | null>(null);

  const { data: seals = [], isLoading } = useQuery<DocumentSeal[]>({
    queryKey: ["compliance-seals"],
    queryFn: () => apiFetch("/api/compliance/seals"),
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => apiFetch("/api/compliance/seals", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["compliance-seals"] }); setShowCreate(false); toast({ title: "Cachet apposé" }); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/compliance/seals/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["compliance-seals"] }); toast({ title: "Cachet révoqué" }); },
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      apiFetch(`/api/compliance/seals/${id}/verify`, { method: "POST", body: JSON.stringify({ contentToHash: content }) }),
    onSuccess: (data) => setVerifyResult(data),
  });

  const DOC_TYPE_LABELS: Record<string, string> = {
    invoice: "Facture", proforma: "Proforma", contract: "Contrat", report: "Rapport", other: "Autre",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{seals.length} cachet(s) enregistré(s)</p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" /> Nouveau cachet
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-sm text-muted-foreground">Chargement…</div>
      ) : seals.length === 0 ? (
        <Card><CardContent className="py-10 text-center">
          <Stamp className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Aucun cachet numérique pour l'instant</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {seals.map((seal) => (
            <Card key={seal.id} className={seal.isValid ? "" : "opacity-60"}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{DOC_TYPE_LABELS[seal.documentType] ?? seal.documentType}</Badge>
                      {seal.isValid
                        ? <span className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Valide</span>
                        : <span className="text-xs text-red-600 font-medium flex items-center gap-1"><XCircle className="w-3 h-3" /> Révoqué</span>
                      }
                    </div>
                    <p className="text-xs font-mono text-muted-foreground truncate">
                      Hash : {seal.contentHash.slice(0, 24)}…
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(seal.sealedAt).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => { setVerifyId(seal.id); setVerifyContent(""); setVerifyResult(null); }}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    {seal.isValid && (
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700"
                        onClick={() => revokeMutation.mutate(seal.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog créer cachet */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Apposer un cachet numérique</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Type de document</Label>
              <select
                className="w-full mt-1 border rounded-md px-3 py-2 text-sm"
                value={form.documentType}
                onChange={(e) => setForm({ ...form, documentType: e.target.value })}
              >
                <option value="invoice">Facture</option>
                <option value="proforma">Proforma</option>
                <option value="contract">Contrat</option>
                <option value="report">Rapport</option>
                <option value="other">Autre</option>
              </select>
            </div>
            <div>
              <Label>ID du document</Label>
              <Input
                placeholder="UUID du document"
                value={form.documentId}
                onChange={(e) => setForm({ ...form, documentId: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Libellé</Label>
              <Input
                placeholder="Ex: Facture FAC-2026-00123"
                value={form.documentLabel}
                onChange={(e) => setForm({ ...form, documentLabel: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Contenu à hasher (données représentatives)</Label>
              <Textarea
                placeholder="Collez ici les données structurées du document à sceller…"
                value={form.contentToHash}
                onChange={(e) => setForm({ ...form, contentToHash: e.target.value })}
                className="mt-1"
                rows={4}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => createMutation.mutate(form)}
              disabled={!form.documentId || !form.contentToHash || createMutation.isPending}
            >
              {createMutation.isPending ? "Apposition…" : "Apposer le cachet"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog vérification */}
      <Dialog open={!!verifyId} onOpenChange={() => { setVerifyId(null); setVerifyResult(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Vérifier l'intégrité du cachet</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Contenu actuel du document (à comparer)</Label>
              <Textarea
                placeholder="Collez le contenu actuel du document pour vérifier s'il a été modifié…"
                value={verifyContent}
                onChange={(e) => setVerifyContent(e.target.value)}
                rows={4}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => verifyId && verifyMutation.mutate({ id: verifyId, content: verifyContent })}
              disabled={!verifyContent || verifyMutation.isPending}
            >
              Vérifier
            </Button>
            {verifyResult && (
              <div className={`p-3 rounded-lg ${verifyResult.isIntact ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                <div className="flex items-center gap-2 font-medium">
                  {verifyResult.isIntact
                    ? <><CheckCircle2 className="w-4 h-4" /> Document intact — le hash correspond</>
                    : <><AlertCircle className="w-4 h-4" /> Document modifié — les hash diffèrent</>
                  }
                </div>
                <p className="text-xs mt-1 font-mono">Stocké : {verifyResult.storedHash.slice(0, 24)}…</p>
                <p className="text-xs font-mono">Actuel  : {verifyResult.currentHash.slice(0, 24)}…</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Onglet Signatures ────────────────────────────────────────────────────────
function SignaturesTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<SignatureRequest | null>(null);
  const [form, setForm] = useState({
    documentType: "invoice",
    documentId: "",
    documentLabel: "",
    message: "",
    dueDate: "",
    signers: [{ email: "", name: "", role: "" }],
  });

  const { data: requests = [], isLoading } = useQuery<SignatureRequest[]>({
    queryKey: ["compliance-signature-requests"],
    queryFn: () => apiFetch("/api/compliance/signature-requests"),
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) =>
      apiFetch("/api/compliance/signature-requests", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compliance-signature-requests"] });
      setShowCreate(false);
      toast({ title: "Demande de signature envoyée" });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const signMutation = useMutation({
    mutationFn: ({ id, signerId, action }: { id: string; signerId: string; action: "sign" | "reject" }) =>
      apiFetch(`/api/compliance/signature-requests/${id}/sign`, { method: "POST", body: JSON.stringify({ signerId, action }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compliance-signature-requests"] });
      setSelected(null);
      toast({ title: "Action enregistrée" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/compliance/signature-requests/${id}/cancel`, { method: "PATCH" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["compliance-signature-requests"] }); toast({ title: "Demande annulée" }); },
  });

  const addSigner = () => setForm({ ...form, signers: [...form.signers, { email: "", name: "", role: "" }] });
  const removeSigner = (i: number) => setForm({ ...form, signers: form.signers.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{requests.length} demande(s) de signature</p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" /> Nouvelle demande
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-sm text-muted-foreground">Chargement…</div>
      ) : requests.length === 0 ? (
        <Card><CardContent className="py-10 text-center">
          <FileSignature className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Aucune demande de signature pour l'instant</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {requests.map((req) => (
            <Card key={req.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setSelected(req)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium truncate">{req.documentLabel}</p>
                    <div className="flex items-center gap-2">
                      <SigStatusBadge status={req.status} />
                      <span className="text-xs text-muted-foreground">
                        {req.signers.filter((s) => s.status === "signed").length}/{req.signers.length} signature(s)
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{new Date(req.createdAt).toLocaleDateString("fr-FR")}</p>
                  </div>
                  {req.dueDate && (
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">Échéance</p>
                      <p className="text-xs font-medium">{new Date(req.dueDate).toLocaleDateString("fr-FR")}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog détail signature */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.documentLabel}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <SigStatusBadge status={selected.status} />
                {selected.message && <p className="text-sm text-muted-foreground italic">"{selected.message}"</p>}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Signataires</p>
                {selected.signers.map((s, i) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                    <div>
                      <p className="text-sm font-medium">{s.signerName}</p>
                      <p className="text-xs text-muted-foreground">{s.signerEmail}</p>
                      {s.signerRole && <p className="text-xs text-muted-foreground">{s.signerRole}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {s.status === "signed"
                        ? <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Signé</span>
                        : s.status === "rejected"
                        ? <span className="text-xs text-red-600 flex items-center gap-1"><XCircle className="w-3 h-3" /> Refusé</span>
                        : s.signerId === user?.id
                        ? (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="h-7 text-green-600"
                              onClick={() => signMutation.mutate({ id: selected.id, signerId: s.signerId!, action: "sign" })}>
                              <CheckCircle2 className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-red-600"
                              onClick={() => signMutation.mutate({ id: selected.id, signerId: s.signerId!, action: "reject" })}>
                              <XCircle className="w-3 h-3" />
                            </Button>
                          </div>
                        )
                        : <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> En attente</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
              {selected.status === "pending" || selected.status === "partially_signed" ? (
                <Button
                  variant="outline" size="sm" className="w-full text-red-600"
                  onClick={() => cancelMutation.mutate(selected.id)}
                >
                  Annuler la demande
                </Button>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog créer demande */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouvelle demande de signature</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <select
                  className="w-full mt-1 border rounded-md px-3 py-2 text-sm"
                  value={form.documentType}
                  onChange={(e) => setForm({ ...form, documentType: e.target.value })}
                >
                  <option value="invoice">Facture</option>
                  <option value="proforma">Proforma</option>
                  <option value="contract">Contrat</option>
                  <option value="report">Rapport</option>
                  <option value="other">Autre</option>
                </select>
              </div>
              <div>
                <Label>ID du document</Label>
                <Input className="mt-1" value={form.documentId} onChange={(e) => setForm({ ...form, documentId: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Libellé du document</Label>
              <Input className="mt-1" placeholder="Ex: Contrat cadre Q3-2026" value={form.documentLabel} onChange={(e) => setForm({ ...form, documentLabel: e.target.value })} />
            </div>
            <div>
              <Label>Message (optionnel)</Label>
              <Textarea className="mt-1" rows={2} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            </div>
            <div>
              <Label>Date d'échéance (optionnel)</Label>
              <Input type="date" className="mt-1" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Signataires</Label>
                <Button variant="ghost" size="sm" onClick={addSigner}><Plus className="w-3 h-3 mr-1" /> Ajouter</Button>
              </div>
              {form.signers.map((s, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <Input placeholder="Nom" value={s.name} className="text-sm" onChange={(e) => {
                    const ns = [...form.signers]; ns[i] = { ...ns[i], name: e.target.value }; setForm({ ...form, signers: ns });
                  }} />
                  <Input placeholder="Email" value={s.email} className="text-sm" onChange={(e) => {
                    const ns = [...form.signers]; ns[i] = { ...ns[i], email: e.target.value }; setForm({ ...form, signers: ns });
                  }} />
                  {form.signers.length > 1 && (
                    <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 text-red-500" onClick={() => removeSigner(i)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              className="w-full"
              onClick={() => createMutation.mutate(form)}
              disabled={!form.documentId || !form.documentLabel || form.signers.some((s) => !s.email || !s.name) || createMutation.isPending}
            >
              {createMutation.isPending ? "Envoi…" : "Envoyer la demande"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function CompliancePage() {
  const { data: dashboard } = useQuery<ComplianceDashboard>({
    queryKey: ["compliance-dashboard"],
    queryFn: () => apiFetch("/api/compliance/dashboard"),
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" />
          Conformité & Signatures
        </h1>
        <p className="text-muted-foreground mt-1">Gestion des cachets numériques, workflows de signature interne et conformité documentaire</p>
      </div>

      {/* KPIs */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Cachets valides</p>
            <p className="text-2xl font-bold text-green-600">{dashboard.seals.valid}</p>
            <p className="text-xs text-muted-foreground">{dashboard.seals.revoked} révoqué(s)</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Signatures en attente</p>
            <p className="text-2xl font-bold text-yellow-600">{dashboard.signatures.pending}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Signatures complètes</p>
            <p className="text-2xl font-bold text-primary">{dashboard.signatures.completed}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Scans OCR traités</p>
            <p className="text-2xl font-bold">{dashboard.scans.done}</p>
            <p className="text-xs text-muted-foreground">{dashboard.scans.pending} en cours</p>
          </CardContent></Card>
        </div>
      )}

      <Tabs defaultValue="seals">
        <TabsList>
          <TabsTrigger value="seals" className="flex items-center gap-1.5">
            <Stamp className="w-3.5 h-3.5" /> Cachets numériques
          </TabsTrigger>
          <TabsTrigger value="signatures" className="flex items-center gap-1.5">
            <FileSignature className="w-3.5 h-3.5" /> Signatures
          </TabsTrigger>
        </TabsList>

        <TabsContent value="seals" className="mt-4"><SealsTab /></TabsContent>
        <TabsContent value="signatures" className="mt-4"><SignaturesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
