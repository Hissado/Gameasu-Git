import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Loader2, CheckCircle2, XCircle, Clock, AlertTriangle, Eye, Search,
  CreditCard, Building2, FileText, Download, RefreshCw, Settings,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";

type Declaration = {
  id: string;
  organizationId: string;
  orgName: string;
  orgSlug: string;
  orgContactEmail: string | null;
  amount: number;
  currency: string;
  method: string;
  status: string;
  reference: string | null;
  receiptNumber: string | null;
  rejectionReason: string | null;
  justificationUrl: string | null;
  notes: string | null;
  planCode: string | null;
  seats: number | null;
  periodicity: string | null;
  declaredAt: string | null;
  verifiedAt: string | null;
  payerPhone: string | null;
  createdAt: string;
};

type CinetpayTx = {
  id: string;
  orgName: string;
  orgSlug: string;
  reference: string | null;
  method: string;
  amount: number;
  currency: string;
  status: string;
  planCode: string | null;
  seats: number | null;
  periodicity: string | null;
  payerPhone: string | null;
  receiptNumber: string | null;
  isAutoConfirmed: boolean;
  createdAt: string;
  confirmedAt: string | null;
};

type BankCoords = {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  iban: string;
  bic: string;
  officeAddress: string;
  officeHours: string;
  checkOrder: string;
  officePhone: string;
};

const METHOD_LABELS: Record<string, string> = {
  virement: "Virement bancaire",
  depot_bancaire: "Dépôt bancaire",
  depot_bureau: "Dépôt au bureau",
  cheque: "Chèque",
};

const STATUS_CFG: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  pending_verification: { label: "En attente",   cls: "bg-amber-50 text-amber-700 border-amber-200",      icon: Clock },
  confirmed:           { label: "Confirmé",       cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  rejected:            { label: "Rejeté",          cls: "bg-red-50 text-red-700 border-red-200",             icon: XCircle },
  cancelled:           { label: "Annulé",          cls: "bg-slate-100 text-slate-600 border-slate-200",      icon: XCircle },
};

function fmtFCFA(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(n);
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function PaymentDeclarationsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Declaration | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [bankOpen, setBankOpen] = useState(false);
  const [bankDraft, setBankDraft] = useState<Partial<BankCoords>>({});

  const query = useQuery<{ data: Declaration[]; count: number }>({
    queryKey: ["cockpit-payment-declarations", statusFilter],
    queryFn: () => apiFetch(`/api/super-admin/payment-declarations${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`),
    refetchInterval: 30_000,
  });

  const bankQuery = useQuery<{ data: BankCoords }>({
    queryKey: ["cockpit-bank-coordinates"],
    queryFn: () => apiFetch("/api/super-admin/settings/bank-coordinates"),
    enabled: bankOpen,
  });

  const confirmMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/super-admin/payment-declarations/${id}/confirm`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => {
      toast.success("Paiement confirmé — abonnement activé");
      qc.invalidateQueries({ queryKey: ["cockpit-payment-declarations"] });
      qc.invalidateQueries({ queryKey: ["cockpit-payment-declarations-badge"] });
      setSelected(null);
    },
    onError: (e: Error) => toast.error(e.message ?? "Erreur lors de la confirmation"),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/super-admin/payment-declarations/${id}/cancel`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => {
      toast.success("Déclaration annulée");
      qc.invalidateQueries({ queryKey: ["cockpit-payment-declarations"] });
      qc.invalidateQueries({ queryKey: ["cockpit-payment-declarations-badge"] });
      setSelected(null);
    },
    onError: (e: Error) => toast.error(e.message ?? "Erreur lors de l'annulation"),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch(`/api/super-admin/payment-declarations/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: () => {
      toast.success("Déclaration rejetée — client notifié");
      qc.invalidateQueries({ queryKey: ["cockpit-payment-declarations"] });
      setSelected(null);
      setRejectOpen(false);
      setRejectReason("");
    },
    onError: (e: Error) => toast.error(e.message ?? "Erreur lors du rejet"),
  });

  const bankSaveMut = useMutation({
    mutationFn: (data: Partial<BankCoords>) =>
      apiFetch("/api/super-admin/settings/bank-coordinates", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast.success("Coordonnées bancaires enregistrées");
      qc.invalidateQueries({ queryKey: ["cockpit-bank-coordinates"] });
      setBankOpen(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Erreur"),
  });

  const cinetpayQuery = useQuery<{ data: CinetpayTx[]; count: number }>({
    queryKey: ["cockpit-cinetpay-transactions"],
    queryFn: () => apiFetch("/api/super-admin/cinetpay-transactions"),
    refetchInterval: 30_000,
  });
  const cinetpayRows = cinetpayQuery.data?.data ?? [];
  const cinetpayAutoCount = cinetpayRows.filter((r) => r.isAutoConfirmed).length;

  const rows = query.data?.data ?? [];
  const filtered = rows.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return r.orgName?.toLowerCase().includes(s) || r.reference?.toLowerCase().includes(s) || r.orgSlug?.toLowerCase().includes(s);
  });

  const pending = rows.filter((r) => r.status === "pending_verification").length;

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Déclarations de paiement</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Vérification des paiements manuels déclarés par les organisations</p>
        </div>
        <div className="flex gap-2">
          {pending > 0 && (
            <Badge className="bg-amber-500 text-white px-2.5 py-1 text-sm">
              <Clock className="w-3.5 h-3.5 mr-1" />{pending} en attente
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => { setBankDraft({}); setBankOpen(true); }}>
            <Settings className="w-3.5 h-3.5 mr-1" />Coordonnées bancaires
          </Button>
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["cockpit-payment-declarations"] })}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 h-8 text-sm" placeholder="Rechercher organisation, référence…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="pending_verification">En attente</SelectItem>
            <SelectItem value="confirmed">Confirmés</SelectItem>
            <SelectItem value="rejected">Rejetés</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {query.isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Aucune déclaration</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>Formule</TableHead>
                  <TableHead>Moyen de paiement</TableHead>
                  <TableHead className="text-right">Montant TTC</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Déclaré le</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => {
                  const cfg = STATUS_CFG[d.status] ?? { label: d.status, cls: "bg-slate-100 text-slate-600", icon: Clock };
                  const Icon = cfg.icon;
                  return (
                    <TableRow key={d.id} className={d.status === "pending_verification" ? "bg-amber-50/40" : ""}>
                      <TableCell>
                        <div className="font-medium text-sm">{d.orgName}</div>
                        <div className="text-xs text-muted-foreground">{d.orgSlug}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{d.reference ?? "—"}</TableCell>
                      <TableCell className="text-sm">
                        {d.planCode ? (
                          <span>{d.planCode} · {d.seats} util.</span>
                        ) : "—"}
                        {d.periodicity && <span className="ml-1 text-muted-foreground text-xs">({d.periodicity})</span>}
                      </TableCell>
                      <TableCell className="text-sm">{METHOD_LABELS[d.method] ?? d.method}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-sm">{fmtFCFA(d.amount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${cfg.cls} text-xs gap-1`}>
                          <Icon className="w-3 h-3" />{cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(d.declaredAt)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setSelected(d)} className="h-7 px-2">
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Section CinetPay automatique ───────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#F37021]" />
            Transactions CinetPay automatiques
            {cinetpayAutoCount > 0 && (
              <Badge className="bg-[#F37021] text-white text-xs ml-1">
                {cinetpayAutoCount} validé{cinetpayAutoCount > 1 ? "s" : ""} automatiquement
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {cinetpayQuery.isLoading ? (
            <div className="flex items-center justify-center h-28">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : cinetpayRows.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Aucune transaction CinetPay enregistrée
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>Méthode</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Validation</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cinetpayRows.map((tx) => {
                  const StatusIcon = tx.status === "confirmed" ? CheckCircle2
                    : tx.status === "failed" ? XCircle
                    : Clock;
                  const statusCls = tx.status === "confirmed"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : tx.status === "failed"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-amber-50 text-amber-700 border-amber-200";
                  const statusLabel = tx.status === "confirmed" ? "Confirmé"
                    : tx.status === "failed" ? "Échoué" : "En attente";
                  const MethodIcon = tx.method === "card" ? CreditCard : Smartphone;
                  const methodLabel = tx.method === "card" ? "Carte" : tx.method === "mixx" ? "Mixx" : tx.method === "flooz" ? "Flooz" : tx.method;
                  return (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{tx.orgName}</div>
                        <div className="text-xs text-muted-foreground">{tx.orgSlug}</div>
                      </TableCell>
                      <TableCell>
                        <p className="font-mono text-xs font-semibold">{tx.reference ?? "—"}</p>
                        {tx.receiptNumber && (
                          <p className="text-[10px] text-muted-foreground">{tx.receiptNumber}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                          <MethodIcon className="w-3.5 h-3.5 text-[#F37021]" />
                          {methodLabel}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-sm">
                        {fmtFCFA(tx.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${statusCls} text-xs gap-1`}>
                          <StatusIcon className="w-3 h-3" />{statusLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tx.isAutoConfirmed ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-[#F37021] font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Validé automatiquement
                          </span>
                        ) : tx.status === "pending" ? (
                          <span className="text-[11px] text-amber-600 italic">En attente webhook…</span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fmtDate(tx.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      {selected && (
        <Dialog open onOpenChange={(o) => { if (!o) setSelected(null); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Déclaration — {selected.reference}
              </DialogTitle>
              <DialogDescription>{selected.orgName}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Status */}
              {(() => {
                const cfg = STATUS_CFG[selected.status] ?? { label: selected.status, cls: "bg-slate-100 text-slate-600", icon: Clock };
                const Icon = cfg.icon;
                return (
                  <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${cfg.cls}`}>
                    <Icon className="w-4 h-4" />
                    <span className="font-semibold text-sm">{cfg.label}</span>
                    {selected.rejectionReason && <span className="text-xs ml-1">— {selected.rejectionReason}</span>}
                  </div>
                );
              })()}

              {/* Details */}
              <div className="rounded-xl border divide-y text-sm">
                {[
                  { label: "Organisation", value: `${selected.orgName} (${selected.orgSlug})` },
                  { label: "Contact", value: selected.orgContactEmail ?? "—" },
                  { label: "Formule", value: selected.planCode ? `${selected.planCode} — ${selected.seats} utilisateur${(selected.seats ?? 0) > 1 ? "s" : ""}` : "—" },
                  { label: "Périodicité", value: selected.periodicity ?? "—" },
                  { label: "Moyen de paiement", value: METHOD_LABELS[selected.method] ?? selected.method },
                  { label: "Montant TTC", value: fmtFCFA(selected.amount), bold: true },
                  { label: "Téléphone payeur", value: selected.payerPhone ?? "—" },
                  { label: "Notes", value: selected.notes ?? "—" },
                  { label: "Déclaré le", value: fmtDate(selected.declaredAt) },
                  { label: "Vérifié le", value: fmtDate(selected.verifiedAt) },
                  { label: "Numéro de reçu", value: selected.receiptNumber ?? "—" },
                ].map(({ label, value, bold }) => (
                  <div key={label} className="flex justify-between items-start px-3 py-2 gap-2">
                    <span className="text-muted-foreground shrink-0">{label}</span>
                    <span className={`text-right ${bold ? "font-bold text-primary" : "font-medium"}`}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Justificatif */}
              {selected.justificationUrl && (
                <div className="rounded-xl border p-3 flex items-center gap-3">
                  <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Justificatif joint</p>
                    <p className="text-xs text-muted-foreground truncate">{selected.justificationUrl}</p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/api/storage${selected.justificationUrl}`} target="_blank" rel="noreferrer">
                      <Download className="w-3.5 h-3.5 mr-1" />Ouvrir
                    </a>
                  </Button>
                </div>
              )}
            </div>

            {selected.status === "pending_verification" && (
              <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-slate-600"
                  disabled={cancelMut.isPending}
                  onClick={() => cancelMut.mutate(selected.id)}
                >
                  {cancelMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <XCircle className="w-4 h-4 mr-1.5" />}
                  Annuler
                </Button>
                <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setRejectOpen(true)}>
                  <XCircle className="w-4 h-4 mr-1.5" />Rejeter
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={confirmMut.isPending}
                  onClick={() => confirmMut.mutate(selected.id)}
                >
                  {confirmMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                  Confirmer le paiement
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Reject dialog */}
      {rejectOpen && selected && (
        <Dialog open onOpenChange={(o) => { if (!o) { setRejectOpen(false); setRejectReason(""); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Rejeter la déclaration</DialogTitle>
              <DialogDescription>Un email sera envoyé au client avec le motif de rejet.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Label>Motif du rejet <span className="text-red-500">*</span></Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ex : Justificatif illisible, montant incorrect, référence manquante…"
                rows={3}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => { setRejectOpen(false); setRejectReason(""); }}>Annuler</Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={!rejectReason.trim() || rejectMut.isPending}
                onClick={() => rejectMut.mutate({ id: selected.id, reason: rejectReason })}
              >
                {rejectMut.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
                Confirmer le rejet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Bank coordinates dialog */}
      <Dialog open={bankOpen} onOpenChange={(o) => { if (!o) setBankOpen(false); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Coordonnées bancaires Gameasu</DialogTitle>
            <DialogDescription>Ces informations sont affichées aux clients lors d'une déclaration de paiement.</DialogDescription>
          </DialogHeader>
          {bankQuery.isLoading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : (
            <div className="space-y-3 py-2">
              {([
                { key: "bankName", label: "Nom de la banque" },
                { key: "accountHolder", label: "Titulaire du compte" },
                { key: "accountNumber", label: "Numéro de compte" },
                { key: "iban", label: "IBAN" },
                { key: "bic", label: "BIC / SWIFT" },
                { key: "officeAddress", label: "Adresse du bureau" },
                { key: "officeHours", label: "Horaires du bureau" },
                { key: "officePhone", label: "Téléphone du bureau" },
                { key: "checkOrder", label: "Ordre du chèque" },
              ] as { key: keyof BankCoords; label: string }[]).map(({ key, label }) => (
                <div key={key}>
                  <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
                  <Input
                    className="text-sm"
                    value={bankDraft[key] ?? (bankQuery.data?.data?.[key] ?? "")}
                    onChange={(e) => setBankDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setBankOpen(false)}>Annuler</Button>
            <Button
              size="sm"
              disabled={bankSaveMut.isPending}
              onClick={() => {
                const merged = { ...(bankQuery.data?.data ?? {}), ...bankDraft };
                bankSaveMut.mutate(merged);
              }}
            >
              {bankSaveMut.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
