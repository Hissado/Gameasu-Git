import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { PageHeader } from "@/components/ui/page-header";
import { formatFCFA, formatDate } from "@/lib/format";
import { toast } from "sonner";
import {
  Plus, Search, Trash2, CheckCircle2, XCircle, CreditCard,
  Receipt, ChevronRight, Filter,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ExpenseReport = {
  id: string; title: string; status: string; totalAmount: number;
  collaboratorId: string; collaboratorName: string; department: string | null;
  submittedAt: string | null; approvedAt: string | null; paidAt: string | null;
  notes: string | null; createdAt: string;
};

type ExpenseItem = {
  id: string; category: string; description: string;
  amount: number; currency: string; expenseDate: string;
  receiptUrl: string | null; isBillable: boolean;
  projectId: string | null; notes: string | null;
};

type ReportDetail = ExpenseReport & { items: ExpenseItem[] };

type Collaborator = { id: string; firstName: string; lastName: string; department: string | null };

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft:      { label: "Brouillon",   cls: "bg-muted text-muted-foreground border" },
  submitted:  { label: "Soumis",      cls: "bg-blue-50 text-blue-700 border-blue-200" },
  en_revision:{ label: "En révision", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  approved:   { label: "Approuvé",    cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected:   { label: "Refusé",      cls: "bg-red-50 text-red-700 border-red-200" },
  paid:       { label: "Remboursé",   cls: "bg-green-50 text-green-700 border-green-200" },
  rembourse:  { label: "Remboursé",   cls: "bg-green-50 text-green-700 border-green-200" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, cls: "bg-muted text-muted-foreground border" };
  return <Badge variant="outline" className={`text-xs ${s.cls}`}>{s.label}</Badge>;
}

const EXPENSE_CATEGORIES = [
  "transport", "hébergement", "repas", "fournitures",
  "téléphone", "sous-traitance", "autres",
];

// ─── Ligne de dépense locale (avant soumission) ───────────────────────────────

type LocalItem = {
  key: string;
  category: string;
  description: string;
  amount: string;
  expenseDate: string;
  receiptUrl: string;
  isBillable: boolean;
  notes: string;
};

function emptyItem(): LocalItem {
  return {
    key: crypto.randomUUID(),
    category: "transport",
    description: "",
    amount: "",
    expenseDate: new Date().toISOString().slice(0, 10),
    receiptUrl: "",
    isBillable: false,
    notes: "",
  };
}

// ─── Formulaire de création de note de frais ─────────────────────────────────

function CreateExpenseSheet({ collabs, onClose, onSuccess }: {
  collabs: Collaborator[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [collaboratorId, setCollaboratorId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<LocalItem[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);

  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (key: string) => setItems(prev => prev.filter(i => i.key !== key));
  const updateItem = (key: string, field: keyof LocalItem, value: string | boolean) =>
    setItems(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i));

  const totalAmount = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  const handleSubmit = async (doSubmit: boolean) => {
    if (!title.trim()) { toast.error("Titre requis"); return; }
    if (!collaboratorId) { toast.error("Sélectionnez un collaborateur"); return; }
    const validItems = items.filter(i => i.description.trim() && i.amount && parseFloat(i.amount) > 0 && i.expenseDate);
    if (validItems.length === 0) { toast.error("Ajoutez au moins une ligne de dépense valide"); return; }

    setSaving(true);
    try {
      // 1. Create report
      const report = await apiFetch<{ id: string }>("/api/purchases/expenses", {
        method: "POST",
        body: JSON.stringify({
          collaboratorId,
          title: title.trim(),
          description: description.trim() || null,
          periodStart: periodStart || null,
          periodEnd: periodEnd || null,
          status: "draft",
        }),
      });

      // 2. Add items
      for (const item of validItems) {
        await apiFetch(`/api/purchases/expenses/${report.id}/items`, {
          method: "POST",
          body: JSON.stringify({
            category: item.category,
            description: item.description,
            amount: parseFloat(item.amount),
            expenseDate: item.expenseDate,
            receiptUrl: item.receiptUrl || null,
            isBillable: item.isBillable,
            notes: item.notes || null,
          }),
        });
      }

      // 3. Optionally submit
      if (doSubmit) {
        await apiFetch(`/api/purchases/expenses/${report.id}`, {
          method: "PUT",
          body: JSON.stringify({ status: "submitted" }),
        });
      }

      toast.success(doSubmit ? "Note de frais soumise" : "Note de frais créée en brouillon");
      onSuccess(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Erreur lors de la création"); } finally { setSaving(false); }
  };

  return (
    <Sheet open onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-[#2563EB]" />
            Nouvelle note de frais
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-5 mt-5 pr-1">
          {/* En-tête */}
          <div className="space-y-3">
            <div>
              <Label>Titre <span className="text-red-500">*</span></Label>
              <Input className="mt-1" placeholder="Ex: Déplacement Lomé — janvier 2026" value={title} onChange={e => setTitle(e.target.value)} />
            </div>

            <div>
              <Label>Collaborateur <span className="text-red-500">*</span></Label>
              <Select value={collaboratorId} onValueChange={setCollaboratorId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Sélectionner un collaborateur" /></SelectTrigger>
                <SelectContent>
                  {collabs.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}{c.department ? ` — ${c.department}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Période — début</Label>
                <Input type="date" className="mt-1" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
              </div>
              <div>
                <Label>Période — fin</Label>
                <Input type="date" className="mt-1" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Description / notes</Label>
              <Textarea className="mt-1" placeholder="Contexte optionnel…" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
            </div>
          </div>

          {/* Lignes de dépense */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-foreground">Lignes de dépense</p>
              <Button variant="outline" size="sm" onClick={addItem} className="h-7 text-xs">
                <Plus className="h-3 w-3 mr-1" />Ajouter
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={item.key} className="border rounded-lg p-3 space-y-2 bg-muted/50">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Ligne {idx + 1}</p>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(item.key)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Catégorie</Label>
                      <Select value={item.category} onValueChange={v => updateItem(item.key, "category", v)}>
                        <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Date <span className="text-red-500">*</span></Label>
                      <Input type="date" className="h-8 text-xs mt-0.5" value={item.expenseDate} onChange={e => updateItem(item.key, "expenseDate", e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Description <span className="text-red-500">*</span></Label>
                    <Input className="h-8 text-xs mt-0.5" placeholder="Libellé de la dépense" value={item.description} onChange={e => updateItem(item.key, "description", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Montant (FCFA) <span className="text-red-500">*</span></Label>
                      <Input type="number" className="h-8 text-xs mt-0.5" placeholder="0" value={item.amount} onChange={e => updateItem(item.key, "amount", e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">URL justificatif</Label>
                      <Input className="h-8 text-xs mt-0.5" placeholder="https://…" value={item.receiptUrl} onChange={e => updateItem(item.key, "receiptUrl", e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between mt-3 px-2 py-2 bg-muted rounded-lg">
              <span className="text-sm font-medium text-muted-foreground">Total estimé</span>
              <span className="font-bold text-[#2563EB]">{formatFCFA(totalAmount)}</span>
            </div>
          </div>
        </div>

        <SheetFooter className="pt-4 border-t gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button variant="outline" onClick={() => handleSubmit(false)} disabled={saving}>
            {saving ? "…" : "Enregistrer en brouillon"}
          </Button>
          <Button className="bg-[#2563EB] hover:bg-[#d96518]" onClick={() => handleSubmit(true)} disabled={saving}>
            <CheckCircle2 className="h-4 w-4 mr-1" />
            {saving ? "Soumission…" : "Soumettre"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Detail sheet ─────────────────────────────────────────────────────────────

function ReportDetailSheet({ reportId, onClose, onRefresh }: {
  reportId: string; onClose: () => void; onRefresh: () => void;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const { data: detail, isLoading } = useQuery<ReportDetail>({
    queryKey: ["purchases-expense-detail", reportId],
    queryFn: () => apiFetch(`/api/purchases/expenses/${reportId}`),
  });

  const doAction = async (status: "approved" | "rejected" | "paid", reason?: string) => {
    setSaving(status);
    try {
      await apiFetch(`/api/purchases/expenses/${reportId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, ...(reason ? { rejectionReason: reason } : {}) }),
      });
      toast.success(
        status === "approved" ? "Note de frais approuvée" :
        status === "rejected" ? "Note de frais refusée" : "Paiement enregistré"
      );
      onRefresh(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setSaving(null); }
  };

  return (
    <Sheet open onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-[520px] sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-[#2563EB]" />
            Note de frais
          </SheetTitle>
        </SheetHeader>
        {isLoading && <div className="space-y-3 mt-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>}
        {detail && (
          <div className="space-y-5 mt-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-base">{detail.title}</h3>
                <p className="text-sm text-muted-foreground">{detail.collaboratorName}{detail.department ? ` · ${detail.department}` : ""}</p>
              </div>
              <StatusBadge status={detail.status} />
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold text-base">{formatFCFA(detail.totalAmount)}</span>
              </div>
              {detail.submittedAt && <div className="flex justify-between text-xs text-muted-foreground">
                <span>Soumis le</span><span>{formatDate(detail.submittedAt)}</span>
              </div>}
              {detail.approvedAt && <div className="flex justify-between text-xs text-muted-foreground">
                <span>Approuvé le</span><span>{formatDate(detail.approvedAt)}</span>
              </div>}
              {detail.paidAt && <div className="flex justify-between text-xs text-muted-foreground">
                <span>Payé le</span><span>{formatDate(detail.paidAt)}</span>
              </div>}
            </div>

            {detail.notes && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <p className="font-medium mb-0.5">Motif de refus</p>
                <p>{detail.notes}</p>
              </div>
            )}

            {detail.items.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2 text-foreground">Lignes de dépense</p>
                <div className="space-y-2">
                  {detail.items.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 border">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.description}</p>
                        <p className="text-xs text-muted-foreground">{item.category} · {formatDate(item.expenseDate)}</p>
                        {item.receiptUrl && (
                          <a href={item.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                            Justificatif →
                          </a>
                        )}
                      </div>
                      <span className="font-semibold text-sm ml-3">{formatFCFA(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {detail.status === "submitted" && (
              <div className="flex gap-2 pt-2 border-t">
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => doAction("approved")} disabled={!!saving}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />{saving === "approved" ? "…" : "Approuver"}
                </Button>
                <Button variant="outline" className="flex-1 text-red-600 border-red-200 hover:bg-red-50" onClick={() => setRejectOpen(true)} disabled={!!saving}>
                  <XCircle className="h-4 w-4 mr-1" />Refuser
                </Button>
              </div>
            )}
            {detail.status === "approved" && (
              <Button className="w-full bg-[#2563EB] hover:bg-[#d96518]" onClick={() => doAction("paid")} disabled={!!saving}>
                <CreditCard className="h-4 w-4 mr-1" />{saving === "paid" ? "…" : "Marquer comme payé"}
              </Button>
            )}
          </div>
        )}
      </SheetContent>

      {rejectOpen && (
        <Dialog open onOpenChange={v => !v && setRejectOpen(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Motif de refus</DialogTitle>
              <DialogDescription>Cette raison sera transmise au collaborateur.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Label>Motif <span className="text-red-500">*</span></Label>
              <Textarea placeholder="Indiquez le motif…" value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectOpen(false)}>Annuler</Button>
              <Button variant="destructive" disabled={!rejectReason.trim() || !!saving}
                onClick={() => { setRejectOpen(false); doAction("rejected", rejectReason.trim()); }}>
                <XCircle className="h-4 w-4 mr-1" />Confirmer le refus
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Sheet>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DepensesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [collaboratorFilter, setCollaboratorFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const params = new URLSearchParams({ limit: "100" });
  if (statusFilter !== "all") params.set("status", statusFilter);
  if (collaboratorFilter !== "all") params.set("collaboratorId", collaboratorFilter);
  if (categoryFilter !== "all") params.set("category", categoryFilter);
  if (periodFrom) params.set("periodFrom", periodFrom);
  if (periodTo) params.set("periodTo", periodTo);

  const { data, isLoading } = useQuery<{ data: ExpenseReport[]; total: number }>({
    queryKey: ["purchases-expenses", statusFilter, collaboratorFilter, categoryFilter, periodFrom, periodTo],
    queryFn: () => apiFetch(`/api/purchases/expenses?${params}`),
  });

  const { data: collabData } = useQuery<{ data: Collaborator[] }>({
    queryKey: ["collaborators-list"],
    queryFn: () => apiFetch("/api/collaborators?limit=200"),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["purchases-expenses"] });

  const rows = (data?.data ?? []).filter(r =>
    !search || r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.collaboratorName.toLowerCase().includes(search.toLowerCase())
  );

  const kpis = {
    total: rows.length,
    pending: rows.filter(r => r.status === "submitted").length,
    approved: rows.filter(r => r.status === "approved").length,
    totalAmount: rows.reduce((s, r) => s + r.totalAmount, 0),
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <PageHeader
        title="Dépenses"
        subtitle="Notes de frais — vue manager toutes équipes"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refresh}>
              <Filter className="h-4 w-4 mr-1" />Actualiser
            </Button>
            <Button size="sm" className="bg-[#2563EB] hover:bg-[#d96518] text-white" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />Nouvelle note de frais
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total rapports", value: kpis.total, fmt: "count" },
          { label: "En attente", value: kpis.pending, fmt: "count" },
          { label: "Approuvés", value: kpis.approved, fmt: "count" },
          { label: "Montant total", value: kpis.totalAmount, fmt: "money" },
        ].map(({ label, value, fmt }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className="text-xl font-bold">{fmt === "money" ? formatFCFA(value) : value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/60" />
              <Input placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={collaboratorFilter} onValueChange={setCollaboratorFilter}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Collaborateur" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {(collabData?.data ?? []).map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Catégorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {EXPENSE_CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div>
              <Input type="date" placeholder="Début" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} className="h-9" />
            </div>
            <div>
              <Input type="date" placeholder="Fin" value={periodTo} onChange={e => setPeriodTo(e.target.value)} className="h-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liste */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Receipt className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
              <p>Aucune note de frais correspondante</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Titre</TableHead>
                  <TableHead>Collaborateur</TableHead>
                  <TableHead>Département</TableHead>
                  <TableHead>Soumis le</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedId(r.id)}>
                    <TableCell className="font-medium text-sm">{r.title}</TableCell>
                    <TableCell className="text-sm">{r.collaboratorName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.department ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.submittedAt ? formatDate(r.submittedAt) : "—"}</TableCell>
                    <TableCell className="text-right font-semibold text-sm">{formatFCFA(r.totalAmount)}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground/60" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedId && (
        <ReportDetailSheet
          reportId={selectedId}
          onClose={() => setSelectedId(null)}
          onRefresh={() => { refresh(); setSelectedId(null); }}
        />
      )}

      {createOpen && (
        <CreateExpenseSheet
          collabs={collabData?.data ?? []}
          onClose={() => setCreateOpen(false)}
          onSuccess={() => { refresh(); setCreateOpen(false); }}
        />
      )}
    </div>
  );
}
