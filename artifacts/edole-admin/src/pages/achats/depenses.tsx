import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageHeader } from "@/components/ui/page-header";
import { formatFCFA, formatDate } from "@/lib/format";
import { toast } from "sonner";
import {
  Plus, Search, FileText, CheckCircle2, XCircle, Send, CreditCard,
  Receipt, ChevronRight, AlertCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ExpenseReport = {
  id: string; title: string; description: string | null;
  status: string; totalAmount: number; currency: string;
  periodStart: string | null; periodEnd: string | null;
  submittedAt: string | null; approvedAt: string | null; paidAt: string | null;
  rejectionReason: string | null; notes: string | null;
  collaboratorId: string; createdAt: string;
  firstName: string | null; lastName: string | null;
  poste: string | null; avatarUrl: string | null;
};

type ExpenseItem = {
  id: string; category: string; description: string;
  amount: number; currency: string; expenseDate: string;
  receiptUrl: string | null; isBillable: boolean;
  projectId: string | null; notes: string | null;
};

type ReportDetail = ExpenseReport & { items: ExpenseItem[] };

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Brouillon",  cls: "bg-slate-100 text-slate-600 border-slate-200" },
  submitted: { label: "Soumis",     cls: "bg-blue-50 text-blue-700 border-blue-200" },
  approved:  { label: "Approuvé",   cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected:  { label: "Refusé",     cls: "bg-red-50 text-red-700 border-red-200" },
  paid:      { label: "Payé",       cls: "bg-teal-50 text-teal-700 border-teal-200" },
};

const CATEGORIES = [
  "transport", "repas", "hébergement", "fournitures",
  "communication", "formation", "autre",
];

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, cls: "bg-slate-100 text-slate-600 border-slate-200" };
  return <Badge variant="outline" className={`text-xs ${s.cls}`}>{s.label}</Badge>;
}

// ─── New report dialog ────────────────────────────────────────────────────────

function NewReportDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Le titre est requis"); return; }
    setSaving(true);
    try {
      await apiFetch("/api/hr/expenses", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description || undefined,
          periodStart: periodStart || undefined,
          periodEnd: periodEnd || undefined,
        }),
      });
      toast.success("Note de frais créée");
      onSuccess(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle note de frais</DialogTitle>
          <DialogDescription>Créez votre rapport de dépenses</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Titre *</Label>
            <Input placeholder="Ex: Mission Lomé — Juin 2026" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea placeholder="Contexte ou commentaires…" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Période du</Label>
              <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Au</Label>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#F37021] hover:bg-[#d96318] text-white">
            {saving ? "Création…" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add item dialog ──────────────────────────────────────────────────────────

function AddItemDialog({ reportId, onClose, onSuccess }: { reportId: string; onClose: () => void; onSuccess: () => void }) {
  const [category, setCategory] = useState("transport");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!description.trim()) { toast.error("La description est requise"); return; }
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Le montant doit être positif"); return; }
    setSaving(true);
    try {
      await apiFetch(`/api/hr/expenses/${reportId}/items`, {
        method: "POST",
        body: JSON.stringify({ category, description: description.trim(), amount: amt, expenseDate }),
      });
      toast.success("Dépense ajoutée");
      onSuccess(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Ajouter une dépense</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Catégorie</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Description *</Label>
            <Input placeholder="Ex: Taxi aéroport" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Montant (FCFA) *</Label>
              <Input type="number" min={1} placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#F37021] hover:bg-[#d96318] text-white">
            {saving ? "Ajout…" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Report detail sheet ──────────────────────────────────────────────────────

function ReportDetailSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [addItem, setAddItem] = useState(false);

  const { data: report, refetch } = useQuery<ReportDetail>({
    queryKey: ["expense-report-detail", id],
    queryFn: () => apiFetch(`/api/hr/expenses/${id}`),
  });

  const refresh = () => { refetch(); qc.invalidateQueries({ queryKey: ["expense-reports"] }); };

  const action = async (path: string, method = "POST", body?: object) => {
    try {
      await apiFetch(path, { method, body: body ? JSON.stringify(body) : undefined });
      refresh();
      toast.success("Mis à jour");
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
  };

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {!report ? (
          <div className="space-y-3 p-4"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-32 w-full" /></div>
        ) : (
          <>
            <SheetHeader className="mb-4">
              <SheetTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[#F37021]" />
                {report.title}
              </SheetTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={report.status} />
                <span className="text-sm text-muted-foreground font-semibold">{formatFCFA(report.totalAmount)}</span>
                {report.periodStart && (
                  <span className="text-xs text-muted-foreground">{formatDate(report.periodStart)} — {report.periodEnd ? formatDate(report.periodEnd) : "…"}</span>
                )}
              </div>
            </SheetHeader>

            {/* Workflow actions */}
            <div className="flex flex-wrap gap-2 mb-4">
              {report.status === "draft" && (
                <Button size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => action(`/api/hr/expenses/${id}/submit`)}>
                  <Send className="w-3 h-3" /> Soumettre
                </Button>
              )}
              {report.status === "submitted" && (
                <>
                  <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => action(`/api/hr/expenses/${id}/approve`)}>
                    <CheckCircle2 className="w-3 h-3" /> Approuver
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => action(`/api/hr/expenses/${id}/reject`, "POST", { reason: "Refus" })}>
                    <XCircle className="w-3 h-3" /> Refuser
                  </Button>
                </>
              )}
              {report.status === "approved" && (
                <Button size="sm" className="gap-1 bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={() => action(`/api/hr/expenses/${id}/pay`)}>
                  <CreditCard className="w-3 h-3" /> Marquer payé
                </Button>
              )}
              {report.status === "draft" && (
                <Button size="sm" variant="outline" className="gap-1"
                  onClick={() => setAddItem(true)}>
                  <Plus className="w-3 h-3" /> Ajouter une dépense
                </Button>
              )}
            </div>

            {/* Rejection reason */}
            {report.status === "rejected" && report.rejectionReason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex gap-2 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{report.rejectionReason}</p>
              </div>
            )}

            {/* Items */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Lignes de dépenses ({report.items?.length ?? 0})
              </h3>
              {(!report.items || report.items.length === 0) ? (
                <p className="text-sm text-muted-foreground italic py-4 text-center">Aucune dépense saisie.</p>
              ) : (
                <div className="border rounded-lg divide-y">
                  {report.items.map(item => (
                    <div key={item.id} className="p-3 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">{item.category}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(item.expenseDate)}</span>
                          {item.isBillable && <span className="text-xs text-blue-600">Facturable</span>}
                        </div>
                      </div>
                      <p className="font-semibold text-sm shrink-0">{formatFCFA(item.amount)}</p>
                    </div>
                  ))}
                  <div className="p-3 flex justify-between font-semibold text-sm bg-slate-50">
                    <span>Total</span>
                    <span>{formatFCFA(report.totalAmount)}</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
      {addItem && report && (
        <AddItemDialog reportId={report.id} onClose={() => setAddItem(false)} onSuccess={refetch} />
      )}
    </Sheet>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AchatsDepenses() {
  const qc = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<ExpenseReport[]>({
    queryKey: ["expense-reports"],
    queryFn: () => apiFetch("/api/hr/expenses"),
  });

  const reports = data ?? [];
  const filtered = reports.filter(r => {
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) ||
      [r.firstName, r.lastName].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["expense-reports"] });

  const totalAmount = filtered.reduce((s, r) => s + r.totalAmount, 0);

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Notes de frais"
        subtitle={`${filtered.length} rapport${filtered.length !== 1 ? "s" : ""} · ${formatFCFA(totalAmount)}`}
        actions={
          <Button onClick={() => setNewOpen(true)} className="bg-[#F37021] hover:bg-[#d96318] text-white gap-2">
            <Plus className="w-4 h-4" /> Nouvelle note de frais
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Tous statuts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {filterStatus !== "all" && (
          <Button variant="ghost" size="sm" onClick={() => setFilterStatus("all")}>Effacer</Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Collaborateur</TableHead>
                <TableHead>Titre</TableHead>
                <TableHead>Période</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Créé le</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && [1, 2, 3].map(i => (
                <TableRow key={i}>{[1,2,3,4,5,6,7].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Aucune note de frais.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map(r => (
                <TableRow key={r.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setDetailId(r.id)}>
                  <TableCell className="text-sm">
                    <p className="font-medium">{[r.firstName, r.lastName].filter(Boolean).join(" ") || "—"}</p>
                    {r.poste && <p className="text-xs text-muted-foreground">{r.poste}</p>}
                  </TableCell>
                  <TableCell className="font-medium text-sm max-w-[200px] truncate">{r.title}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.periodStart ? `${formatDate(r.periodStart)}${r.periodEnd ? ` — ${formatDate(r.periodEnd)}` : ""}` : "—"}
                  </TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-right font-semibold">{formatFCFA(r.totalAmount)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</TableCell>
                  <TableCell>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {newOpen && <NewReportDialog onClose={() => setNewOpen(false)} onSuccess={refresh} />}
      {detailId && <ReportDetailSheet id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}
