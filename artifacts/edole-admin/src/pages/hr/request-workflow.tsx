import React, { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { HrShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/lib/permissions";
import { Plus, Paperclip, Check, X, FileText, Inbox } from "lucide-react";

// Configuration par type de demande (§10). Un seul composant sert 5 nœuds RH.
type TypeCfg = { type: string; title: string; subtitle: string; firstLabel: string; declaration?: boolean; dated?: boolean };
const BY_ROUTE: Record<string, TypeCfg> = {
  "/rh/pointage/permissions":  { type: "permission",      title: "Permissions",              subtitle: "Demandes de permission : demande, étude, pièces justificatives.", firstLabel: "Demande", dated: true },
  "/rh/pointage/deplacements": { type: "business_travel",  title: "Déplacements professionnels", subtitle: "Demandes de déplacement : demande, étude, pièces justificatives.", firstLabel: "Demande", dated: true },
  "/rh/pointage/missions":     { type: "mission",          title: "Missions",                 subtitle: "Ordres de mission : demande, étude, pièces justificatives.", firstLabel: "Demande", dated: true },
  "/rh/pointage/maladie":      { type: "sickness",         title: "Maladie",                  subtitle: "Déclaration de maladie et pièces justificatives.", firstLabel: "Déclaration", declaration: true, dated: true },
  "/rh/pointage/accident":     { type: "accident",         title: "Accident",                 subtitle: "Déclaration d'accident et pièces justificatives.", firstLabel: "Déclaration", declaration: true, dated: true },
};

const STATUS: Record<string, { label: string; color: string }> = {
  submitted:    { label: "Soumise",   color: "bg-blue-50 text-blue-700 border-blue-200" },
  under_review: { label: "En étude",  color: "bg-amber-50 text-amber-700 border-amber-200" },
  approved:     { label: "Approuvée", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected:     { label: "Rejetée",   color: "bg-rose-50 text-rose-700 border-rose-200" },
};

type Att = { name: string; url: string; uploadedAt: string };
type Req = {
  id: string; type: string; subject: string; description?: string | null;
  startDate?: string | null; endDate?: string | null; status: string;
  reviewNotes?: string | null; rejectionReason?: string | null;
  attachments?: Att[] | null; createdAt: string;
};

function Stepper({ cfg, status }: { cfg: TypeCfg; status: string }) {
  const steps = cfg.declaration
    ? [cfg.firstLabel, "Pièces justificatives", "Traitement"]
    : [cfg.firstLabel, "Étude de la demande", "Décision"];
  const idx = status === "submitted" ? 0 : status === "under_review" ? 1 : 2;
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <div className={`flex items-center gap-1.5 text-xs ${i <= idx ? "text-foreground font-medium" : "text-muted-foreground"}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border ${i < idx ? "bg-emerald-500 text-white border-emerald-500" : i === idx ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>
              {i < idx ? <Check className="w-3 h-3" /> : i + 1}
            </span>
            {s}
          </div>
          {i < steps.length - 1 && <div className="w-6 h-px bg-border" />}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function RequestWorkflow() {
  const [location] = useLocation();
  const path = location.split("?")[0];
  const cfg = BY_ROUTE[path] ?? BY_ROUTE["/rh/pointage/permissions"];
  const qc = useQueryClient();
  const { toast } = useToast();
  const perms = usePermissions();
  const canDecide = perms.has("hr.manage_leaves") && !perms.isReadOnly;

  const [createOpen, setCreateOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState({ subject: "", description: "", startDate: "", endDate: "" });

  const { data, isLoading } = useQuery<{ data: Req[] }>({
    queryKey: ["hr-requests", cfg.type],
    queryFn: () => apiFetch(`/api/hr/requests?type=${cfg.type}`),
  });
  const list = data?.data ?? [];
  const current = useMemo(() => list.find((r) => r.id === openId) ?? null, [list, openId]);

  const create = useMutation({
    mutationFn: (body: any) => apiFetch("/api/hr/requests", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-requests", cfg.type] });
      setCreateOpen(false); setForm({ subject: "", description: "", startDate: "", endDate: "" });
      toast({ title: "Demande enregistrée" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error ?? e?.message, variant: "destructive" }),
  });

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => apiFetch(`/api/hr/requests/${id}`, { method: "PATCH", body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-requests", cfg.type] }); toast({ title: "Demande mise à jour" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error ?? e?.message, variant: "destructive" }),
  });

  return (
    <HrShell
      title={cfg.title}
      subtitle={cfg.subtitle}
      actions={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-1" /> {cfg.declaration ? "Nouvelle déclaration" : "Nouvelle demande"}</Button>}
    >
      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
      ) : list.length === 0 ? (
        <Card className="border-dashed"><CardContent className="p-10 text-center">
          <Inbox className="w-8 h-8 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">Aucune {cfg.declaration ? "déclaration" : "demande"} pour le moment.</p>
          <Button size="sm" variant="outline" className="mt-4" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-1" /> Créer</Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {list.map((r) => {
            const st = STATUS[r.status] ?? STATUS.submitted;
            return (
              <Card key={r.id} className="cursor-pointer hover:border-primary/40" onClick={() => setOpenId(r.id)}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.subject}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.startDate ? new Date(r.startDate).toLocaleDateString("fr-FR") : ""}
                      {r.endDate ? ` → ${new Date(r.endDate).toLocaleDateString("fr-FR")}` : ""}
                      {(r.attachments?.length ?? 0) > 0 && <span className="ml-2 inline-flex items-center"><Paperclip className="w-3 h-3 mr-0.5" />{r.attachments!.length}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden md:block"><Stepper cfg={cfg} status={r.status} /></div>
                    <Badge className={`text-xs border ${st.color}`}>{st.label}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Création */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{cfg.declaration ? "Nouvelle déclaration" : "Nouvelle demande"} — {cfg.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Objet</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Objet de la demande" /></div>
            <div><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            {cfg.dated && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Du</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
                <div><Label className="text-xs">Au</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button disabled={!form.subject.trim() || create.isPending}
              onClick={() => create.mutate({ type: cfg.type, subject: form.subject, description: form.description, startDate: form.startDate || undefined, endDate: form.endDate || undefined })}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Détail + workflow */}
      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-lg">
          {current && (
            <>
              <DialogHeader><DialogTitle className="flex items-center gap-2">{current.subject}
                <Badge className={`text-xs border ${(STATUS[current.status] ?? STATUS.submitted).color}`}>{(STATUS[current.status] ?? STATUS.submitted).label}</Badge>
              </DialogTitle></DialogHeader>
              <div className="space-y-4 text-sm">
                <Stepper cfg={cfg} status={current.status} />
                {current.description && <p className="text-muted-foreground">{current.description}</p>}
                {(current.startDate || current.endDate) && (
                  <p className="text-xs text-muted-foreground">Période : {current.startDate ? new Date(current.startDate).toLocaleDateString("fr-FR") : "—"}{current.endDate ? ` → ${new Date(current.endDate).toLocaleDateString("fr-FR")}` : ""}</p>
                )}

                {/* Pièces justificatives */}
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Pièces justificatives</p>
                  <div className="space-y-1">
                    {(current.attachments ?? []).map((a, i) => (
                      <a key={i} href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline"><FileText className="w-3.5 h-3.5" />{a.name}</a>
                    ))}
                    {(current.attachments?.length ?? 0) === 0 && <p className="text-xs text-muted-foreground">Aucune pièce.</p>}
                  </div>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => {
                    const url = window.prompt("URL du document justificatif :");
                    if (!url) return;
                    const name = window.prompt("Nom du document :", "Justificatif") || "Justificatif";
                    const next = [...(current.attachments ?? []), { name, url, uploadedAt: new Date().toISOString() }];
                    patch.mutate({ id: current.id, body: { attachments: next } });
                  }}>
                    <Paperclip className="w-4 h-4 mr-1" /> Ajouter une pièce
                  </Button>
                </div>

                {current.status === "rejected" && current.rejectionReason && (
                  <p className="text-xs text-rose-600">Motif du rejet : {current.rejectionReason}</p>
                )}

                {/* Décision (décideur) */}
                {canDecide && current.status !== "approved" && (
                  <div className="border-t pt-3 flex flex-wrap gap-2">
                    {current.status === "submitted" && (
                      <Button size="sm" variant="outline" disabled={patch.isPending} onClick={() => patch.mutate({ id: current.id, body: { status: "under_review" } })}>Mettre à l'étude</Button>
                    )}
                    <Button size="sm" disabled={patch.isPending} onClick={() => patch.mutate({ id: current.id, body: { status: "approved" } })}><Check className="w-4 h-4 mr-1" /> Approuver</Button>
                    <Button size="sm" variant="outline" disabled={patch.isPending} onClick={() => {
                      const reason = window.prompt("Motif du rejet :", current.rejectionReason ?? "");
                      if (reason !== null) patch.mutate({ id: current.id, body: { status: "rejected", rejectionReason: reason } });
                    }}><X className="w-4 h-4 mr-1" /> Rejeter</Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
