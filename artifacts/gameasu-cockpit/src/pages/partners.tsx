import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2, XCircle, Clock, Eye, Tag, Users, Percent,
  Plus, Pencil, Trash2, RefreshCw, Handshake, Gift, Search,
  TrendingUp, AlertCircle, ChevronRight,
} from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────

type PartnerProgram = {
  id: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  orgName: string;
  website: string | null;
  country: string | null;
  sector: string | null;
  estimatedClients: number | null;
  motivation: string | null;
  type: string;
  status: string;
  code: string | null;
  notes: string | null;
  totalReferrals: number;
  totalMrrFcfa: number;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

type PromoCode = {
  id: string;
  code: string;
  label: string;
  type: string;
  discountType: string;
  discountValue: number;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  partnerId: string | null;
  createdAt: string;
};

// ── Status config ─────────────────────────────────────────────────

const PARTNER_STATUS: Record<string, { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  pending:   { label: "En attente",   cls: "bg-amber-50 text-amber-700 border-amber-200",      icon: Clock },
  reviewing: { label: "En analyse",   cls: "bg-blue-50 text-blue-700 border-blue-200",          icon: RefreshCw },
  approved:  { label: "Approuvé",     cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  rejected:  { label: "Rejeté",       cls: "bg-red-50 text-red-700 border-red-200",             icon: XCircle },
  suspended: { label: "Suspendu",     cls: "bg-slate-100 text-slate-600 border-slate-200",      icon: AlertCircle },
};

const TYPE_LABELS: Record<string, string> = {
  commercial:  "Commercial",
  cabinet:     "Cabinet expert",
  trainer:     "Formateur",
  integrator:  "Intégrateur",
  ministry:    "Ministère / institution",
};

// ── Approve Dialog ────────────────────────────────────────────────

function ApproveDialog({
  partner,
  onClose,
}: {
  partner: PartnerProgram;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [discount, setDiscount] = useState(0);

  const approve = useMutation({
    mutationFn: () =>
      apiFetch(`/api/super-admin/partner-programs/${partner.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ discountPercent: discount }),
      }),
    onSuccess: () => {
      sonnerToast.success("Partenaire approuvé — email envoyé !");
      qc.invalidateQueries({ queryKey: ["partners"] });
      onClose();
    },
    onError: (e: any) => sonnerToast.error(e?.message ?? "Erreur lors de l'approbation"),
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Approuver {partner.orgName}
          </DialogTitle>
          <DialogDescription>
            Un code partenaire unique sera généré et envoyé par email à {partner.contactEmail}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Réduction accordée au code partenaire (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              0% = code de suivi uniquement (sans réduction pour le client final).
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={approve.isPending}>Annuler</Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => approve.mutate()}
            disabled={approve.isPending}
          >
            {approve.isPending ? "Approbation…" : "Approuver & envoyer le code"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Reject Dialog ─────────────────────────────────────────────────

function RejectDialog({
  partner,
  onClose,
}: {
  partner: PartnerProgram;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");

  const reject = useMutation({
    mutationFn: () =>
      apiFetch(`/api/super-admin/partner-programs/${partner.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      sonnerToast.success("Demande rejetée");
      qc.invalidateQueries({ queryKey: ["partners"] });
      onClose();
    },
    onError: (e: any) => sonnerToast.error(e?.message ?? "Erreur"),
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-600" /> Rejeter {partner.orgName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label>Motif (optionnel — inclus dans l'email)</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex : Profil ne correspond pas à notre programme actuellement…"
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={reject.isPending}>Annuler</Button>
          <Button variant="destructive" onClick={() => reject.mutate()} disabled={reject.isPending}>
            {reject.isPending ? "Rejet…" : "Confirmer le rejet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Detail Dialog ─────────────────────────────────────────────────

function PartnerDetailDialog({ partner, onClose }: { partner: PartnerProgram; onClose: () => void }) {
  const { data, isLoading } = useQuery<PartnerProgram & { codes: PromoCode[] }>({
    queryKey: ["partner-detail", partner.id],
    queryFn: () => apiFetch(`/api/super-admin/partner-programs/${partner.id}`),
  });

  const { data: referrals } = useQuery<{ referrals: Array<{ id: string; orgName: string; usedAt: string; discountApplied: number }>; totalDiscount: number }>({
    queryKey: ["partner-referrals", partner.id],
    queryFn: () => apiFetch(`/api/super-admin/partner-programs/${partner.id}/referrals`),
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{partner.orgName}</DialogTitle>
          <DialogDescription>{partner.contactName} · {partner.contactEmail}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="info">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info">Informations</TabsTrigger>
            <TabsTrigger value="codes">Codes</TabsTrigger>
            <TabsTrigger value="referrals">Clients générés</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-3 mt-3">
            {[
              ["Type", TYPE_LABELS[partner.type] ?? partner.type],
              ["Pays", partner.country],
              ["Secteur", partner.sector],
              ["Clients estimés", partner.estimatedClients],
              ["Site web", partner.website],
              ["Téléphone", partner.contactPhone],
              ["Motivation", partner.motivation],
              ["Notes", partner.notes],
            ].filter(([, v]) => v != null).map(([k, v]) => (
              <div key={String(k)} className="grid grid-cols-3 gap-2 text-sm">
                <span className="text-muted-foreground font-medium">{k}</span>
                <span className="col-span-2">{String(v)}</span>
              </div>
            ))}
            {partner.code && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <Tag className="w-4 h-4 text-emerald-600" />
                <span className="font-mono font-bold text-emerald-800 text-lg tracking-wider">{partner.code}</span>
              </div>
            )}
          </TabsContent>

          <TabsContent value="codes" className="space-y-2 mt-3">
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : data?.codes?.length ? (
              data.codes.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <code className="font-mono font-bold text-sm bg-muted px-2 py-1 rounded">{c.code}</code>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{c.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.discountValue}{c.discountType === "percent" ? "%" : " FCFA"} · utilisé {c.usedCount}×
                      {c.maxUses ? ` / ${c.maxUses} max` : ""}
                    </p>
                  </div>
                  <Badge variant={c.isActive ? "default" : "secondary"}>
                    {c.isActive ? "Actif" : "Inactif"}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun code associé</p>
            )}
          </TabsContent>

          <TabsContent value="referrals" className="space-y-2 mt-3">
            {referrals?.referrals?.length ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Total remise accordée : <strong>{new Intl.NumberFormat("fr-FR").format(referrals.totalDiscount)} FCFA</strong>
                </p>
                {referrals.referrals.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
                    <div className="flex-1">
                      <p className="font-medium">{r.orgName ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.usedAt).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <span className="text-emerald-700 font-semibold text-xs">
                      -{new Intl.NumberFormat("fr-FR").format(r.discountApplied)} FCFA
                    </span>
                  </div>
                ))}
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun client généré via ce partenaire</p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ── Promo Codes CRUD ──────────────────────────────────────────────

function PromoCodeDialog({
  code,
  onClose,
}: {
  code?: PromoCode;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isNew = !code;
  const [form, setForm] = useState({
    code:          code?.code ?? "",
    label:         code?.label ?? "",
    type:          code?.type ?? "promo",
    discountType:  code?.discountType ?? "percent",
    discountValue: code?.discountValue ?? 10,
    maxUses:       code?.maxUses?.toString() ?? "",
    expiresAt:     code?.expiresAt ? code.expiresAt.slice(0, 10) : "",
    isActive:      code?.isActive ?? true,
  });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        code:          form.code.toUpperCase().trim(),
        discountValue: Number(form.discountValue),
        maxUses:       form.maxUses ? Number(form.maxUses) : null,
        expiresAt:     form.expiresAt || null,
      };
      if (isNew) {
        return apiFetch("/api/super-admin/promo-codes", { method: "POST", body: JSON.stringify(body) });
      }
      return apiFetch(`/api/super-admin/promo-codes/${code!.id}`, { method: "PATCH", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      sonnerToast.success(isNew ? "Code créé" : "Code mis à jour");
      qc.invalidateQueries({ queryKey: ["promo-codes"] });
      onClose();
    },
    onError: (e: any) => sonnerToast.error(e?.message ?? "Erreur"),
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew ? "Créer un code promo" : `Modifier ${code!.code}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {isNew && (
            <div className="space-y-1.5">
              <Label>Code *</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="PROMO2025"
                className="font-mono"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Libellé *</Label>
            <Input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Ex : Promotion lancement"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                  <SelectItem value="promo">Promotion</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Type de remise</Label>
              <Select value={form.discountType} onValueChange={(v) => setForm({ ...form, discountType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Pourcentage (%)</SelectItem>
                  <SelectItem value="fixed">Montant fixe (FCFA)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valeur *</Label>
              <Input
                type="number"
                min={0}
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Utilisations max (vide = ∞)</Label>
              <Input
                type="number"
                min={1}
                value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                placeholder="Illimité"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Date d'expiration (optionnel)</Label>
            <Input
              type="date"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">Actif</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>Annuler</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.label || (!code && !form.code)}>
            {save.isPending ? "Enregistrement…" : isNew ? "Créer le code" : "Mettre à jour"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────

export default function PartnersPage() {
  const [activeTab, setActiveTab] = useState<"partners" | "promo">("partners");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [approveTarget, setApproveTarget] = useState<PartnerProgram | null>(null);
  const [rejectTarget, setRejectTarget]   = useState<PartnerProgram | null>(null);
  const [detailTarget, setDetailTarget]   = useState<PartnerProgram | null>(null);
  const [promoEdit, setPromoEdit]         = useState<PromoCode | "new" | null>(null);

  const qc = useQueryClient();

  const { data: partners = [], isLoading: partnersLoading } = useQuery<PartnerProgram[]>({
    queryKey: ["partners", statusFilter],
    queryFn: () => apiFetch(`/api/super-admin/partner-programs${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`),
  });

  const { data: promoCodes = [], isLoading: promoLoading } = useQuery<PromoCode[]>({
    queryKey: ["promo-codes"],
    queryFn: () => apiFetch("/api/super-admin/promo-codes"),
  });

  const { data: stats } = useQuery<{ totalCodes: number; totalUses: number; totalDiscount: number }>({
    queryKey: ["promo-stats"],
    queryFn: () => apiFetch("/api/super-admin/promo-codes/stats"),
  });

  const deletePromo = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/super-admin/promo-codes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      sonnerToast.success("Code supprimé");
      qc.invalidateQueries({ queryKey: ["promo-codes"] });
    },
    onError: (e: any) => sonnerToast.error(e?.message ?? "Erreur"),
  });

  const patchPartner = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/api/super-admin/partner-programs/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      sonnerToast.success("Statut mis à jour");
      qc.invalidateQueries({ queryKey: ["partners"] });
    },
  });

  const filteredPartners = partners.filter((p) => {
    const q = search.toLowerCase();
    return !q || p.orgName.toLowerCase().includes(q) || p.contactEmail.toLowerCase().includes(q) || p.contactName.toLowerCase().includes(q);
  });

  const filteredCodes = promoCodes.filter((c) => {
    const q = search.toLowerCase();
    return !q || c.code.toLowerCase().includes(q) || c.label.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Handshake className="w-6 h-6 text-primary" />
            Partenaires & Codes promo
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gérez les demandes partenaires et les codes de réduction
          </p>
        </div>
      </div>

      {/* KPI row */}
      {activeTab === "promo" && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Codes actifs",    value: stats?.totalCodes ?? 0,    icon: Tag },
            { label: "Total utilisations", value: stats?.totalUses ?? 0,  icon: Users },
            {
              label: "Remises accordées",
              value: `${new Intl.NumberFormat("fr-FR").format(stats?.totalDiscount ?? 0)} FCFA`,
              icon: TrendingUp,
            },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label} className="border-border">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Icon className="w-3.5 h-3.5" /> {label}
                </div>
                <p className="text-xl font-bold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "partners" | "promo")}>
        <div className="flex items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="partners" className="flex items-center gap-1.5">
              <Handshake className="w-4 h-4" />
              Demandes partenaires
              {partners.filter((p) => p.status === "pending").length > 0 && (
                <span className="ml-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                  {partners.filter((p) => p.status === "pending").length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="promo" className="flex items-center gap-1.5">
              <Gift className="w-4 h-4" /> Codes promo
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-48 h-9"
              />
            </div>
            {activeTab === "partners" && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {Object.entries(PARTNER_STATUS).map(([k, { label }]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {activeTab === "promo" && (
              <Button size="sm" onClick={() => setPromoEdit("new")} className="gap-1.5">
                <Plus className="w-4 h-4" /> Nouveau code
              </Button>
            )}
          </div>
        </div>

        {/* ── Partners Tab ── */}
        <TabsContent value="partners" className="mt-4 space-y-3">
          {partnersLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
          ) : filteredPartners.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Handshake className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucune demande partenaire</p>
            </div>
          ) : (
            filteredPartners.map((p) => {
              const cfg = PARTNER_STATUS[p.status] ?? PARTNER_STATUS.pending;
              const Icon = cfg.icon;
              return (
                <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:shadow-sm transition-shadow">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-sm truncate">{p.orgName}</p>
                      <span className={cn("inline-flex items-center gap-1 text-[11px] border rounded-full px-2 py-0.5 font-medium", cfg.cls)}>
                        <Icon className="w-3 h-3" /> {cfg.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                        {TYPE_LABELS[p.type] ?? p.type}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.contactName} · {p.contactEmail}
                      {p.country ? ` · ${p.country}` : ""}
                    </p>
                    {p.code && (
                      <code className="text-[11px] bg-emerald-100 text-emerald-800 rounded px-1.5 py-0.5 mt-1 inline-block font-mono">
                        {p.code}
                      </code>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => setDetailTarget(p)} className="gap-1">
                      <Eye className="w-3.5 h-3.5" /> Voir
                    </Button>
                    {p.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                          onClick={() => setApproveTarget(p)}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approuver
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50 gap-1"
                          onClick={() => setRejectTarget(p)}
                        >
                          <XCircle className="w-3.5 h-3.5" /> Rejeter
                        </Button>
                      </>
                    )}
                    {p.status === "approved" && (
                      <Button
                        size="sm" variant="outline"
                        className="text-amber-600 border-amber-200 hover:bg-amber-50"
                        onClick={() => patchPartner.mutate({ id: p.id, status: "suspended" })}
                      >
                        Suspendre
                      </Button>
                    )}
                    {p.status === "suspended" && (
                      <Button
                        size="sm" variant="outline"
                        className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                        onClick={() => patchPartner.mutate({ id: p.id, status: "approved" })}
                      >
                        Réactiver
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        {/* ── Promo Codes Tab ── */}
        <TabsContent value="promo" className="mt-4 space-y-3">
          {promoLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
          ) : filteredCodes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Gift className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucun code promo</p>
            </div>
          ) : (
            filteredCodes.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                <code className="font-mono font-bold text-base bg-muted px-3 py-1.5 rounded-lg min-w-[140px] text-center tracking-wider">
                  {c.code}
                </code>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.label}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <Percent className="w-3 h-3" />
                      {c.discountValue}{c.discountType === "percent" ? "%" : " FCFA"}
                    </span>
                    <span>Utilisé {c.usedCount}×{c.maxUses ? ` / ${c.maxUses}` : ""}</span>
                    {c.expiresAt && (
                      <span className={new Date(c.expiresAt) < new Date() ? "text-red-500" : ""}>
                        Exp. {new Date(c.expiresAt).toLocaleDateString("fr-FR")}
                      </span>
                    )}
                  </div>
                </div>
                <Badge variant={c.isActive ? "default" : "secondary"} className="shrink-0">
                  {c.isActive ? "Actif" : "Inactif"}
                </Badge>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => setPromoEdit(c)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => {
                      if (confirm(`Supprimer le code ${c.code} ?`)) deletePromo.mutate(c.id);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {approveTarget && <ApproveDialog partner={approveTarget} onClose={() => setApproveTarget(null)} />}
      {rejectTarget  && <RejectDialog  partner={rejectTarget}  onClose={() => setRejectTarget(null)} />}
      {detailTarget  && <PartnerDetailDialog partner={detailTarget} onClose={() => setDetailTarget(null)} />}
      {promoEdit != null && (
        <PromoCodeDialog
          code={promoEdit === "new" ? undefined : promoEdit}
          onClose={() => setPromoEdit(null)}
        />
      )}
    </div>
  );
}
