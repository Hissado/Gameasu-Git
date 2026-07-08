import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Flame, Mail, Calendar, Clock, AlertTriangle, CheckCircle2, Search, History } from "lucide-react";
import { formatFCFA, formatFCFACompact, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Link } from "wouter";

type RelanceLog = {
  id: string;
  clientId: string | null;
  clientName: string | null;
  subject: string;
  preview: string | null;
  sentAt: string;
  status: string;
  toAddress: string | null;
};

type CollectionItem = {
  invoiceId: string;
  reference: string;
  clientId: string | null;
  clientName: string | null;
  outstanding: number;
  daysOverdue: number;
  dueDate: string | null;
  score: number;
  tier: "critical" | "high" | "medium" | "low";
  factors: { overdue: number; amount: number; age: number; history: number };
  clientHistory: { meanDelayDays: number; samples: number } | null;
};

type Collections = {
  count: number;
  totalOutstanding: number;
  ranked: CollectionItem[];
};

type Overview = {
  openCount: number;
  overdueCount: number;
  totalOutstanding: number;
  totalOverdue: number;
  dso: number;
};

const TIER_CFG: Record<string, { cls: string; label: string; bg: string }> = {
  critical: { cls: "bg-red-50 text-red-700 border-red-200", label: "Critique", bg: "bg-red-500" },
  high:     { cls: "bg-orange-50 text-orange-700 border-orange-200", label: "Élevé",  bg: "bg-orange-500" },
  medium:   { cls: "bg-amber-50 text-amber-700 border-amber-200", label: "Moyen",   bg: "bg-amber-400" },
  low:      { cls: "bg-blue-50 text-blue-700 border-blue-200", label: "Faible",  bg: "bg-blue-400" },
};

function getAgeBucket(daysOverdue: number): "1-30" | "31-60" | "61-90" | "90plus" {
  if (daysOverdue <= 30) return "1-30";
  if (daysOverdue <= 60) return "31-60";
  if (daysOverdue <= 90) return "61-90";
  return "90plus";
}

function dunningTemplate(client: string, ref: string, amount: number, days: number): string {
  if (days >= 60) {
    return `Madame, Monsieur,\n\nMalgré nos précédentes relances, nous constatons que la facture ${ref} d'un montant de ${formatFCFA(amount)}, échue il y a ${days} jours, demeure impayée à ce jour.\n\nNous vous mettons formellement en demeure de procéder au règlement de cette somme dans un délai de 5 jours ouvrables. À défaut, nous nous réserverons le droit d'engager les procédures de recouvrement nécessaires.\n\nNous restons disponibles pour convenir d'un règlement amiable.\n\nCordialement,`;
  }
  if (days >= 30) {
    return `Madame, Monsieur,\n\nSauf erreur de notre part, nous n'avons pas encore reçu le règlement de notre facture ${ref} d'un montant de ${formatFCFA(amount)}, dont l'échéance est dépassée depuis ${days} jours.\n\nNous vous saurions gré de bien vouloir procéder au règlement dans les meilleurs délais ou de nous contacter pour convenir d'un arrangement.\n\nCordialement,`;
  }
  return `Madame, Monsieur,\n\nNous nous permettons de vous rappeler que notre facture ${ref} d'un montant de ${formatFCFA(amount)} est arrivée à échéance et n'a pas encore été réglée.\n\nSauf erreur de votre part, nous vous remercions de bien vouloir procéder au règlement dans les prochains jours.\n\nCordialement,`;
}

function RelanceDialog({
  item,
  onClose,
  onSuccess,
}: {
  item: CollectionItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [subject, setSubject] = useState(
    `Rappel de paiement — Facture ${item.reference}${item.daysOverdue >= 60 ? " (Mise en demeure)" : ""}`
  );
  const [body, setBody] = useState(
    dunningTemplate(item.clientName ?? "Client", item.reference, item.outstanding, item.daysOverdue)
  );
  const [promiseDate, setPromiseDate] = useState("");
  const [promiseAmount, setPromiseAmount] = useState(String(item.outstanding));
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);
    try {
      await apiFetch(`/api/invoices/${item.invoiceId}/relance`, {
        method: "POST",
        body: JSON.stringify({ subject, body, promiseDate: promiseDate || undefined, promiseAmount: promiseAmount ? Number(promiseAmount) : undefined }),
      });
      toast.success("Relance enregistrée avec succès");
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'envoi de la relance");
    } finally {
      setSending(false);
    }
  };

  const tier = TIER_CFG[item.tier];

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Relancer {item.clientName ?? item.reference}
          </DialogTitle>
          <DialogDescription>
            Facture {item.reference} · {item.daysOverdue} jours de retard ·{" "}
            <Badge variant="outline" className={tier.cls}>{tier.label}</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-3 bg-muted/30 flex items-center justify-between gap-4 text-sm">
            <div>
              <p className="font-medium">{item.clientName ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Solde dû : <strong className="text-red-600">{formatFCFA(item.outstanding)}</strong></p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>Échéance : {item.dueDate ? formatDate(item.dueDate) : "—"}</p>
              <p>Score relance : <strong>{item.score}/100</strong></p>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Objet</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Message</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={9}
              className="font-mono text-sm leading-relaxed"
            />
            <div className="flex gap-2 flex-wrap">
              {[
                { label: "Rappel courtois (J+15)", days: 15 },
                { label: "Relance ferme (J+30)", days: 30 },
                { label: "Mise en demeure (J+60)", days: 60 },
              ].map((t) => (
                <Button
                  key={t.days}
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                  onClick={() => setBody(dunningTemplate(item.clientName ?? "Client", item.reference, item.outstanding, t.days))}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Promesse de paiement (optionnel)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Date promise</Label>
                <Input type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Montant promis (FCFA)</Label>
                <Input type="number" value={promiseAmount} onChange={(e) => setPromiseAmount(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
            Enregistrer la relance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceRow({ item, onRelance }: { item: CollectionItem; onRelance: (i: CollectionItem) => void }) {
  const tier = TIER_CFG[item.tier];
  return (
    <TableRow>
      <TableCell>
        <Link href={`/crm/clients/${item.clientId}`}>
          <p className="font-medium text-sm hover:underline cursor-pointer">{item.clientName ?? "—"}</p>
        </Link>
      </TableCell>
      <TableCell>
        <Link href="/factures">
          <span className="text-sm font-mono text-primary hover:underline cursor-pointer">{item.reference}</span>
        </Link>
      </TableCell>
      <TableCell className="text-sm">{item.dueDate ? formatDate(item.dueDate) : "—"}</TableCell>
      <TableCell>
        <Badge variant="outline" className={`${tier.cls} tabular-nums`}>
          {item.daysOverdue} j
        </Badge>
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">{formatFCFA(item.outstanding)}</TableCell>
      <TableCell>
        <Badge variant="outline" className={tier.cls}>{tier.label}</Badge>
      </TableCell>
      <TableCell className="text-right">
        <p className="text-xs font-bold text-primary">{item.score}/100</p>
      </TableCell>
      <TableCell>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onRelance(item)}>
          <Mail className="w-3 h-3" /> Relancer
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function RecouvrementPage() {
  const [search, setSearch] = useState("");
  const [relancingItem, setRelancingItem] = useState<CollectionItem | null>(null);
  const qc = useQueryClient();

  const collections = useQuery<Collections>({
    queryKey: ["recouvrement-collections"],
    queryFn: () => apiFetch("/api/finance/intelligence/collections"),
    refetchInterval: 60_000,
  });
  const overview = useQuery<Overview>({
    queryKey: ["recouvrement-overview"],
    queryFn: () => apiFetch("/api/finance/intelligence/overview"),
  });
  const history = useQuery<{ count: number; data: RelanceLog[] }>({
    queryKey: ["recouvrement-history"],
    queryFn: () => apiFetch("/api/finance/intelligence/relance-history?limit=100"),
  });

  const ov = overview.data;
  const allItems = collections.data?.ranked ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return allItems;
    const q = search.toLowerCase();
    return allItems.filter(
      (i) =>
        i.clientName?.toLowerCase().includes(q) ||
        i.reference.toLowerCase().includes(q)
    );
  }, [allItems, search]);

  const byBucket = useMemo(() => ({
    "1-30":   filtered.filter((i) => getAgeBucket(i.daysOverdue) === "1-30"),
    "31-60":  filtered.filter((i) => getAgeBucket(i.daysOverdue) === "31-60"),
    "61-90":  filtered.filter((i) => getAgeBucket(i.daysOverdue) === "61-90"),
    "90plus": filtered.filter((i) => getAgeBucket(i.daysOverdue) === "90plus"),
  }), [filtered]);

  const criticalAmount = allItems
    .filter((i) => i.tier === "critical")
    .reduce((s, i) => s + i.outstanding, 0);

  function handleRelanceSuccess() {
    qc.invalidateQueries({ queryKey: ["recouvrement-collections"] });
    qc.invalidateQueries({ queryKey: ["recouvrement-overview"] });
  }

  const tableHead = (
    <TableHeader>
      <TableRow>
        <TableHead>Client</TableHead>
        <TableHead>Facture</TableHead>
        <TableHead>Échéance</TableHead>
        <TableHead>Retard</TableHead>
        <TableHead className="text-right">Solde dû</TableHead>
        <TableHead>Priorité</TableHead>
        <TableHead className="text-right">Score</TableHead>
        <TableHead />
      </TableRow>
    </TableHeader>
  );

  function BucketTab({ items }: { items: CollectionItem[] }) {
    if (items.length === 0) {
      return (
        <div className="py-12 text-center">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500 opacity-60" />
          <p className="text-muted-foreground text-sm">Aucune facture dans cette tranche.</p>
        </div>
      );
    }
    return (
      <div className="rounded-md border overflow-hidden">
        <Table>
          {tableHead}
          <TableBody>
            {items.map((it) => (
              <InvoiceRow key={it.invoiceId} item={it} onRelance={setRelancingItem} />
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Recouvrement"
        subtitle="Tableau de bord des créances en retard, relances et promesses de paiement."
      />

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold">Encours total</p>
            {overview.isLoading ? <Loader2 className="w-5 h-5 animate-spin mt-2" /> : (
              <>
                <p className="text-2xl font-bold mt-1">{formatFCFACompact(ov?.totalOutstanding ?? 0)}</p>
                <p className="text-[10px] text-muted-foreground">{ov?.openCount ?? 0} factures ouvertes</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-red-500" /> En retard
            </p>
            {overview.isLoading ? <Loader2 className="w-5 h-5 animate-spin mt-2" /> : (
              <>
                <p className="text-2xl font-bold mt-1 text-red-600">{formatFCFACompact(ov?.totalOverdue ?? 0)}</p>
                <p className="text-[10px] text-muted-foreground">{ov?.overdueCount ?? 0} factures échues</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold flex items-center gap-1">
              <Clock className="w-3 h-3" /> DSO
            </p>
            {overview.isLoading ? <Loader2 className="w-5 h-5 animate-spin mt-2" /> : (
              <>
                <p className="text-2xl font-bold mt-1">{ov?.dso ?? 0} <span className="text-sm text-muted-foreground font-normal">jours</span></p>
                <p className="text-[10px] text-muted-foreground">Délai moyen encaissement</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-red-300 bg-red-50/30">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold flex items-center gap-1">
              <Flame className="w-3 h-3 text-red-600" /> Critique
            </p>
            {collections.isLoading ? <Loader2 className="w-5 h-5 animate-spin mt-2" /> : (
              <>
                <p className="text-2xl font-bold mt-1 text-red-600">{formatFCFACompact(criticalAmount)}</p>
                <p className="text-[10px] text-muted-foreground">{byBucket["90plus"].length} factures &gt; 90 j</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Rechercher un client ou une facture…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Tabs */}
      {collections.isLoading ? (
        <div className="py-16 text-center">
          <Loader2 className="w-7 h-7 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="all">
              Toutes ({filtered.length})
            </TabsTrigger>
            <TabsTrigger value="1-30" className="text-amber-700">
              1–30 j ({byBucket["1-30"].length})
            </TabsTrigger>
            <TabsTrigger value="31-60" className="text-orange-700">
              31–60 j ({byBucket["31-60"].length})
            </TabsTrigger>
            <TabsTrigger value="61-90" className="text-red-600">
              61–90 j ({byBucket["61-90"].length})
            </TabsTrigger>
            <TabsTrigger value="90plus" className="text-red-800 font-bold">
              +90 j ({byBucket["90plus"].length})
            </TabsTrigger>
            <TabsTrigger value="historique" className="text-muted-foreground ml-auto">
              <History className="w-3.5 h-3.5 mr-1.5" />
              Historique ({history.data?.count ?? 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            {filtered.length === 0 ? (
              <div className="py-12 text-center">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500 opacity-60" />
                <p className="text-muted-foreground text-sm">Aucune facture en retard. 🎉</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  {tableHead}
                  <TableBody>
                    {filtered.map((it) => (
                      <InvoiceRow key={it.invoiceId} item={it} onRelance={setRelancingItem} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="1-30" className="mt-4"><BucketTab items={byBucket["1-30"]} /></TabsContent>
          <TabsContent value="31-60" className="mt-4"><BucketTab items={byBucket["31-60"]} /></TabsContent>
          <TabsContent value="61-90" className="mt-4"><BucketTab items={byBucket["61-90"]} /></TabsContent>
          <TabsContent value="90plus" className="mt-4"><BucketTab items={byBucket["90plus"]} /></TabsContent>

          <TabsContent value="historique" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="w-4 h-4 text-muted-foreground" />
                  Historique des relances envoyées
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {history.isLoading ? (
                  <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
                ) : !history.data?.data.length ? (
                  <div className="py-12 text-center">
                    <Mail className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-muted-foreground text-sm">Aucune relance envoyée pour l'instant.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Client</TableHead>
                          <TableHead>Objet</TableHead>
                          <TableHead>Destinataire</TableHead>
                          <TableHead>Date d'envoi</TableHead>
                          <TableHead>Aperçu</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.data.data.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell>
                              {log.clientId ? (
                                <Link href={`/clients/${log.clientId}`}>
                                  <span className="text-sm font-medium hover:underline cursor-pointer text-primary">
                                    {log.clientName ?? "—"}
                                  </span>
                                </Link>
                              ) : (
                                <span className="text-sm text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <p className="text-sm truncate font-medium">{log.subject}</p>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{log.toAddress ?? "—"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3 h-3" />
                                {formatDate(log.sentAt)}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[240px]">
                              <p className="text-xs text-muted-foreground truncate">{log.preview ?? "—"}</p>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {relancingItem && (
        <RelanceDialog
          item={relancingItem}
          onClose={() => setRelancingItem(null)}
          onSuccess={handleRelanceSuccess}
        />
      )}
    </div>
  );
}
