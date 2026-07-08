/**
 * Phase 16 — Documents IA.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, FileText, FileSignature, FolderArchive, AlertCircle } from "lucide-react";

const KPI = ({ label, value, accent }: { label: string; value: string | number; accent?: string }) => (
  <Card><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold mb-1">{label}</p><p className={`text-2xl font-bold ${accent ?? ""}`}>{value}</p></CardContent></Card>
);

export default function DocumentsIntelligence() {
  const ov = useQuery<any>({ queryKey: ["doc-ov"], queryFn: () => apiFetch("/api/documents/intelligence/overview") });
  const cat = useQuery<any>({ queryKey: ["doc-cat"], queryFn: () => apiFetch("/api/documents/intelligence/by-category") });
  const sig = useQuery<any>({ queryKey: ["doc-sig"], queryFn: () => apiFetch("/api/documents/intelligence/pending-signature") });
  const un = useQuery<any>({ queryKey: ["doc-un"], queryFn: () => apiFetch("/api/documents/intelligence/unclassified") });

  if (ov.isLoading || !ov.data) return <div className="py-12 text-center"><Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground" /></div>;
  const o = ov.data;

  return (
    <div className="space-y-4">
      <div><p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1 flex items-center gap-2"><FolderArchive className="w-3 h-3" />Documents IA</p><h1 className="text-3xl font-bold tracking-tight">Intelligence documentaire</h1></div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-6">
        <KPI label="Total" value={o.total} />
        <KPI label="Classés IA" value={o.analyzed} accent="text-primary" />
        <KPI label="Taux classement" value={`${o.classificationRate}%`} />
        <KPI label="Signés" value={o.signed} accent="text-emerald-600" />
        <KPI label="En attente sign." value={o.pendingSignature} accent={o.pendingSignature > 0 ? "text-amber-600" : ""} />
        <KPI label="Non classés" value={o.unclassified} accent={o.unclassified > 0 ? "text-slate-600" : ""} />
      </div>

      <Tabs defaultValue="categories">
        <TabsList><TabsTrigger value="categories">Catégories</TabsTrigger><TabsTrigger value="signature">À signer</TabsTrigger><TabsTrigger value="unclassified">À classer</TabsTrigger></TabsList>

        <TabsContent value="categories" className="space-y-2">
          {cat.data?.categories?.map((c: any) => (
            <Card key={c.category}><CardContent className="p-3">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm font-medium capitalize">{c.category}</p>
                <span className="text-xs text-muted-foreground">{c.total} doc(s) — IA {c.ai} / manuel {c.manual}</span>
              </div>
              {Object.keys(c.aiBreakdown).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(c.aiBreakdown).map(([k, v]: any) => (
                    <Badge key={k} variant="outline" className="text-[10px]">{k} · {v}</Badge>
                  ))}
                </div>
              )}
            </CardContent></Card>
          ))}
        </TabsContent>

        <TabsContent value="signature" className="space-y-2">
          {sig.data?.rows?.length === 0 && <Card><CardContent className="p-6 text-center text-muted-foreground italic">Aucun document en attente de signature.</CardContent></Card>}
          {sig.data?.rows?.map((r: any) => (
            <Link key={r.id} href="/documents">
              <Card className="cursor-pointer hover:bg-muted"><CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2"><FileSignature className="w-4 h-4 text-amber-600" /><div><p className="text-sm font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.aiCategory ?? r.category} · {r.pendingSigners} signataire(s) en attente</p></div></div>
                <Badge variant="outline" className={r.tier === "urgent" ? "bg-red-50 text-red-700 border-red-200" : r.tier === "high" ? "bg-amber-50 text-amber-700 border-amber-200" : ""}>{r.ageDays}j</Badge>
              </CardContent></Card>
            </Link>
          ))}
        </TabsContent>

        <TabsContent value="unclassified" className="space-y-2">
          {un.data?.rows?.length === 0 && <Card><CardContent className="p-6 text-center text-muted-foreground italic">Tous les documents sont classés.</CardContent></Card>}
          {un.data?.rows?.map((r: any) => (
            <Link key={r.id} href="/documents">
              <Card className="cursor-pointer hover:bg-muted"><CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4 text-slate-500" /><div><p className="text-sm font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.category} · {r.mimeType ?? "?"}</p></div></div>
                <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString("fr-FR")}</span>
              </CardContent></Card>
            </Link>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
