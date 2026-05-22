import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Filter, ShoppingCart, Calendar, Building, Receipt } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatFCFA } from "@/lib/format";
import { MoneyAmount } from "@/components/ui/money-amount";
import { toast } from "sonner";

type Client = { id: string; name: string };
type Order = {
  id: string; referenceNumber: string; status: string;
  totalAmount: number | null; clientName: string | null; createdAt: string;
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Brouillon",  cls: "bg-slate-100 text-slate-600 border-slate-200" },
  confirmed: { label: "Confirmée", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  delivered: { label: "Livrée",    cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  cancelled: { label: "Annulée",   cls: "bg-red-50 text-red-700 border-red-200" },
};

// ─── NewOrderDialog ───────────────────────────────────────────────────────────

function NewOrderDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { data: clientsData, isLoading: loadingClients } = useQuery<{ data: Client[] }>({
    queryKey: ["clients-list"],
    queryFn: () => apiFetch("/api/clients?limit=100"),
  });
  const clients = clientsData?.data ?? [];

  const [clientId, setClientId] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("draft");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!clientId) { toast.error("Sélectionnez un client"); return; }
    if (!amount || Number(amount) <= 0) { toast.error("Montant requis"); return; }
    setSaving(true);
    try {
      await apiFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          clientId,
          totalAmount: Number(amount),
          currency: "XOF",
          status,
          notes: notes || undefined,
        }),
      });
      toast.success("Commande créée avec succès");
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-[#C8A24B]" /> Créer une commande
          </DialogTitle>
          <DialogDescription>
            Bon de commande client — vous pourrez générer la facture depuis la fiche client.
          </DialogDescription>
        </DialogHeader>

        {loadingClients ? (
          <div className="py-4 space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Client *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un client…" />
                </SelectTrigger>
                <SelectContent>
                  {clients.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Aucun client trouvé</div>
                  ) : (
                    clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Montant total (FCFA) *</Label>
                <Input
                  type="number" min="0"
                  placeholder="5 000 000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Statut initial</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Brouillon</SelectItem>
                    <SelectItem value="confirmed">Confirmée</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Notes / Objet</Label>
              <Textarea
                rows={2}
                placeholder="Objet de la commande, conditions particulières…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button
            onClick={handleSave}
            disabled={saving || !clientId || loadingClients}
            className="bg-[#C8A24B] hover:bg-[#b8922b] text-white"
          >
            {saving ? "Création…" : "Créer la commande"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── GenerateInvoiceDialog ────────────────────────────────────────────────────

function useGenerateInvoice(qc: ReturnType<typeof useQueryClient>) {
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const generate = async (orderId: string) => {
    setGeneratingId(orderId);
    try {
      await apiFetch(`/api/orders/${orderId}/generate-invoice`, { method: "POST" });
      toast.success("Facture générée et comptabilisée");
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de la génération");
    } finally {
      setGeneratingId(null);
    }
  };

  return { generate, generatingId };
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OrdersList() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const { generate, generatingId } = useGenerateInvoice(qc);

  const { data, isLoading } = useQuery<{ data: Order[] }>({
    queryKey: ["orders"],
    queryFn: () => apiFetch("/api/orders?limit=50"),
  });

  const orders = (data?.data ?? []).filter((o) =>
    !search ||
    o.referenceNumber.toLowerCase().includes(search.toLowerCase()) ||
    (o.clientName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Bons de commande</h1>
          <p className="text-sm text-muted-foreground mt-1">Commandes clients validées</p>
        </div>
        <Button
          onClick={() => setNewOpen(true)}
          className="bg-[#C8A24B] hover:bg-[#b8922b] text-white font-semibold shadow-sm gap-1.5"
        >
          <Plus className="w-4 h-4" strokeWidth={3} />
          Créer une commande
        </Button>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg">Historique des commandes</CardTitle>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="N° Commande, Client…"
                  className="pl-9 bg-slate-50 focus-visible:ring-primary h-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button variant="outline" size="sm" className="h-9">
                <Filter className="w-4 h-4 mr-2" /> Filtres
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="font-semibold text-slate-600">N° Commande</TableHead>
                  <TableHead className="font-semibold text-slate-600">Client</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold text-slate-600">Date de création</TableHead>
                  <TableHead className="font-semibold text-slate-600">Statut</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">Total</TableHead>
                  <TableHead className="w-36 font-semibold text-slate-600">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <ShoppingCart className="w-12 h-12 text-slate-300 mb-4" />
                        <p className="text-lg font-medium text-slate-600">Aucune commande trouvée.</p>
                        <p className="text-sm mt-1">Cliquez sur « Créer une commande » pour commencer.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => {
                    const st = STATUS_MAP[order.status] ?? { label: order.status, cls: "bg-slate-100 text-slate-600 border-slate-200" };
                    return (
                      <TableRow key={order.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-mono text-sm font-bold text-primary">
                          {order.referenceNumber}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-medium text-sm text-slate-800">{order.clientName || "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            {formatDate(order.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${st.cls}`}>
                            {st.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <MoneyAmount amount={order.totalAmount} size="lg" />
                        </TableCell>
                        <TableCell>
                          {order.status !== "cancelled" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              disabled={generatingId === order.id}
                              onClick={() => generate(order.id)}
                            >
                              <Receipt className="w-3 h-3" />
                              {generatingId === order.id ? "…" : "Facturer"}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {newOpen && (
        <NewOrderDialog
          onClose={() => setNewOpen(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["orders"] })}
        />
      )}
    </div>
  );
}
