/**
 * Phase 8 — Documents IA : page Intelligence.
 * Vue d'ensemble (classifiés, non classés, signatures en attente) + actions IA.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Sparkles, FileText, FileSignature, AlertTriangle, ExternalLink, CheckCircle2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Doc = {
  id: string; name: string; fileUrl: string; mimeType?: string | null;
  category: string; aiCategory?: string | null; aiConfidence?: string | null;
  aiSummary?: string | null; aiTags?: string[] | null; aiAnalyzedAt?: string | null;
  aiProvider?: string | null;
  signatureStatus: string | null;
  signers?: Array<{ name: string; email?: string; role?: string; signedAt?: string }> | null;
  signedAt?: string | null;
  createdAt: string;
};

type Overview = {
  aiAvailable: boolean;
  total: number; analyzed: number; notClassified: number;
  byAiCategory: { category: string; count: number }[];
  bySignature: { status: string; count: number }[];
  pendingSign: Doc[];
  recentAnalyses: Doc[];
};

const CAT_LABEL: Record<string, string> = {
  contract: "Contrat", invoice: "Facture", quote: "Devis", proforma: "Proforma",
  receipt: "Reçu", purchase_order: "Bon de commande", report: "Rapport",
  certificate: "Certificat", id: "Pièce d'identité", tax: "Fiscal",
  hr: "RH", payslip: "Bulletin de paie", photo: "Photo", plan: "Plan",
  specification: "CCTP", minutes: "PV", other: "Autre",
};
const SIG_BADGE: Record<string, { cls: string; label: string }> = {
  none: { cls: "bg-muted text-muted-foreground", label: "—" },
  pending: { cls: "bg-amber-50 text-amber-700 border-amber-200", label: "En attente" },
  signed: { cls: "bg-green-50 text-green-700 border-green-200", label: "Signé" },
  refused: { cls: "bg-red-50 text-red-700 border-red-200", label: "Refusé" },
};

export default function DocumentsIntelligencePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [signDoc, setSignDoc] = useState<Doc | null>(null);
  const [signers, setSigners] = useState<{ name: string; email: string }[]>([{ name: "", email: "" }]);

  const { data: overview, isLoading } = useQuery<Overview>({
    queryKey: ["documents-intelligence"],
    queryFn: () => apiFetch("/api/documents/intelligence/overview"),
  });

  const { data: unclassified } = useQuery<{ data: Doc[] }>({
    queryKey: ["documents-unclassified"],
    queryFn: () => apiFetch("/api/documents?category=other&limit=50"),
  });

  const analyze = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/documents/${id}/analyze`, { method: "POST" }),
    onSuccess: (r: any) => {
      toast({ title: "Analyse terminée", description: `Catégorie IA : ${CAT_LABEL[r.document.aiCategory] ?? r.document.aiCategory} (${r.provider})` });
      qc.invalidateQueries({ queryKey: ["documents-intelligence"] });
      qc.invalidateQueries({ queryKey: ["documents-unclassified"] });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const requestSignature = useMutation({
    mutationFn: ({ id, signers }: { id: string; signers: { name: string; email: string }[] }) =>
      apiFetch(`/api/documents/${id}/request-signature`, {
        method: "POST",
        body: JSON.stringify({ signers: signers.filter((s) => s.name.trim()) }),
      }),
    onSuccess: () => {
      toast({ title: "Workflow de signature lancé" });
      setSignDoc(null);
      setSigners([{ name: "", email: "" }]);
      qc.invalidateQueries({ queryKey: ["documents-intelligence"] });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const sign = useMutation({
    mutationFn: ({ id, signerEmail }: { id: string; signerEmail: string }) =>
      apiFetch(`/api/documents/${id}/sign`, { method: "POST", body: JSON.stringify({ signerEmail }) }),
    onSuccess: () => {
      toast({ title: "Signature enregistrée" });
      qc.invalidateQueries({ queryKey: ["documents-intelligence"] });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  if (isLoading || !overview) return <div className="py-12 text-center text-muted-foreground"><Loader2 className="w-6 h-6 mx-auto animate-spin" /></div>;

  const pendingPct = overview.bySignature.find((s) => s.status === "pending")?.count ?? 0;
  const signedPct = overview.bySignature.find((s) => s.status === "signed")?.count ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Documents IA</p>
        <h1 className="text-3xl font-bold tracking-tight">Intelligence documentaire</h1>
        <p className="text-muted-foreground mt-1">Classification automatique, résumé et signature électronique.</p>
        {!overview.aiAvailable && (
          <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />IA non configurée (OPENAI_API_KEY manquante) — analyse heuristique active.
          </p>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold">Documents</p><p className="text-2xl font-bold">{overview.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold">Analysés par IA</p><p className="text-2xl font-bold text-primary">{overview.analyzed}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold">Non classés</p><p className={`text-2xl font-bold ${overview.notClassified > 0 ? "text-amber-700" : ""}`}>{overview.notClassified}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold">Signatures en cours</p><p className="text-2xl font-bold text-amber-700">{pendingPct}</p><p className="text-[10px] text-muted-foreground mt-1">{signedPct} signé(s)</p></CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />Répartition IA</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {overview.byAiCategory.length === 0 && <p className="text-xs italic text-muted-foreground">Aucun document analysé.</p>}
            {overview.byAiCategory.sort((a, b) => b.count - a.count).map((r) => (
              <div key={r.category} className="flex justify-between text-sm border-b last:border-0 py-1">
                <span>{CAT_LABEL[r.category] ?? r.category}</span>
                <Badge variant="outline">{r.count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4 text-primary" />À classer ({unclassified?.data.length ?? 0})</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-auto">
            {(!unclassified?.data || unclassified.data.length === 0) && <p className="text-xs italic text-muted-foreground">Tous les documents sont classés.</p>}
            {unclassified?.data.map((d) => (
              <div key={d.id} className="flex items-start justify-between gap-2 text-sm border rounded p-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{d.name}</p>
                  <p className="text-[10px] text-muted-foreground">{d.mimeType ?? "type inconnu"} · {new Date(d.createdAt).toLocaleDateString("fr-FR")}</p>
                </div>
                <Button size="sm" variant="outline" disabled={analyze.isPending} onClick={() => analyze.mutate(d.id)}>
                  {analyze.isPending && analyze.variables === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Sparkles className="w-3.5 h-3.5 mr-1" />Analyser</>}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><FileSignature className="w-4 h-4 text-primary" />Signatures en attente ({overview.pendingSign.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {overview.pendingSign.length === 0 && <p className="text-xs italic text-muted-foreground">Aucun workflow de signature en cours.</p>}
          {overview.pendingSign.map((d) => {
            const sig = SIG_BADGE[d.signatureStatus ?? "none"] ?? SIG_BADGE.none;
            return (
              <div key={d.id} className="border rounded p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{d.name}</p>
                    <div className="flex gap-2 items-center mt-1">
                      <Badge variant="outline" className={sig.cls}>{sig.label}</Badge>
                      <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" />Voir</a>
                    </div>
                  </div>
                </div>
                <div className="text-xs space-y-1">
                  {(d.signers ?? []).map((s, i) => (
                    <div key={i} className="flex items-center justify-between border-l-2 pl-2 border-muted">
                      <span>
                        {s.signedAt ? <CheckCircle2 className="w-3 h-3 inline text-green-600 mr-1" /> : <Clock className="w-3 h-3 inline text-amber-500 mr-1" />}
                        <span className="font-medium">{s.name}</span>{s.email ? ` · ${s.email}` : ""}{s.role ? ` (${s.role})` : ""}
                      </span>
                      {!s.signedAt && s.email && (
                        <Button size="sm" variant="ghost" className="h-6 text-[10px]" disabled={sign.isPending} onClick={() => sign.mutate({ id: d.id, signerEmail: s.email! })}>Marquer signé</Button>
                      )}
                      {s.signedAt && <span className="text-[10px] text-muted-foreground">{new Date(s.signedAt).toLocaleString("fr-FR")}</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />Dernières analyses</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {overview.recentAnalyses.length === 0 && <p className="text-xs italic text-muted-foreground">Aucune analyse récente.</p>}
          {overview.recentAnalyses.map((d) => (
            <div key={d.id} className="border rounded p-3 space-y-1">
              <div className="flex justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{d.name}</p>
                  <div className="flex gap-2 items-center mt-0.5 flex-wrap">
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">{CAT_LABEL[d.aiCategory ?? ""] ?? d.aiCategory}</Badge>
                    {d.aiConfidence && <span className="text-[10px] text-muted-foreground">Confiance {Math.round(Number(d.aiConfidence) * 100)}%</span>}
                    <span className="text-[10px] text-muted-foreground">{d.aiProvider}</span>
                    {(d.aiTags ?? []).slice(0, 4).map((t, i) => <Badge key={i} variant="outline" className="text-[10px]">{t}</Badge>)}
                  </div>
                </div>
                {(d.signatureStatus === "none" || !d.signatureStatus) && (
                  <Button size="sm" variant="outline" onClick={() => { setSignDoc(d); setSigners([{ name: "", email: "" }]); }}>
                    <FileSignature className="w-3.5 h-3.5 mr-1" />Demander signature
                  </Button>
                )}
              </div>
              {d.aiSummary && <p className="text-xs text-muted-foreground italic">{d.aiSummary}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!signDoc} onOpenChange={(o) => !o && setSignDoc(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Demander la signature — {signDoc?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {signers.map((s, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                <Input placeholder="Nom du signataire" value={s.name} onChange={(e) => setSigners((arr) => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                <Input placeholder="Email (optionnel)" value={s.email} onChange={(e) => setSigners((arr) => arr.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} />
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setSigners((arr) => [...arr, { name: "", email: "" }])}>+ Ajouter un signataire</Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignDoc(null)}>Annuler</Button>
            <Button disabled={requestSignature.isPending || !signers.some((s) => s.name.trim())} onClick={() => signDoc && requestSignature.mutate({ id: signDoc.id, signers })}>Lancer le workflow</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
