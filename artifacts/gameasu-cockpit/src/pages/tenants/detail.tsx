import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Loader2, ArrowLeft, Building2, Users, CreditCard, Ticket, Activity,
  Power, PowerOff, CheckCircle2, XCircle, Clock, AlertTriangle, Mail,
  Calendar, TrendingUp, Shield, Package,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrgDetail = {
  org: {
    id: string; name: string; slug: string; industry: string | null;
    country: string | null; isActive: boolean; isDefault: boolean;
    createdAt: string; contactEmail: string | null; primaryColor: string | null;
    currency: string;
  };
  subscription: {
    id: string; planCode: string; planName: string; seats: number; unitPrice: number;
    cycle: string; status: string; currentPeriodStart: string; currentPeriodEnd: string;
    setupFee: number | null;
  } | null;
  mrr: number;
  metrics: {
    memberCount: number; moduleCount: number; ticketCount: number;
    openTickets: number; totalRevenue: number; failedPayments: number;
  };
};

type BillingRow = {
  id: string; kind: string; label: string; amount: number;
  amountHt: number; amountTva: number; amountTtc: number;
  currency: string; status: string; reference: string | null;
  occurredAt: string; metadata: Record<string, unknown> | null;
};

type BillingList = {
  rows: BillingRow[];
  summary: { totalPaid: number; totalFailed: number; totalPending: number };
};

type UserRow = {
  userId: string; role: string; isPrimary: boolean; joinedAt: string;
  firstName: string | null; lastName: string | null; email: string | null;
  userRole: string | null; isActive: boolean | null;
};

type TicketRow = {
  id: string; subject: string; category: string; priority: string;
  status: string; createdAt: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TVA_RATE = 0.18;

function fmtFCFA(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(n);
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

const BILLING_STATUS: Record<string, { cls: string; label: string }> = {
  paid:      { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Confirmé" },
  pending:   { cls: "bg-amber-50 text-amber-700 border-amber-200",    label: "En attente" },
  failed:    { cls: "bg-red-50 text-red-700 border-red-200",          label: "Échoué" },
  refunded:  { cls: "bg-purple-50 text-purple-700 border-purple-200", label: "Remboursé" },
  cancelled: { cls: "bg-gray-50 text-gray-500 border-gray-200",       label: "Annulé" },
  expired:   { cls: "bg-orange-50 text-orange-700 border-orange-200", label: "Expiré" },
  overdue:   { cls: "bg-red-50 text-red-700 border-red-200",          label: "En retard" },
};

const PRIORITY_CFG: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high:     "bg-orange-100 text-orange-700",
  medium:   "bg-amber-100 text-amber-700",
  low:      "bg-blue-100 text-blue-700",
};

const TICKET_STATUS_CFG: Record<string, string> = {
  open:        "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  resolved:    "bg-emerald-100 text-emerald-700",
  closed:      "bg-gray-100 text-gray-600",
};

const PLAN_COLOR: Record<string, string> = {
  STARTER: "bg-indigo-50 text-indigo-700 border-indigo-200",
  GROWTH: "bg-violet-50 text-violet-700 border-violet-200",
  PROFESSIONAL: "bg-purple-50 text-purple-700 border-purple-200",
  ENTERPRISE: "bg-pink-50 text-pink-700 border-pink-200",
};

type Tab = "overview" | "subscription" | "billing" | "users" | "tickets" | "actions";

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TenantDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id!;
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [confirming, setConfirming] = useState(false);
  const [toggling, setToggling] = useState(false);

  const detail = useQuery<OrgDetail>({
    queryKey: ["cockpit-org", id],
    queryFn: () => apiFetch(`/api/super-admin/organizations/${id}`),
  });
  const billing = useQuery<BillingList>({
    queryKey: ["cockpit-org-billing", id],
    queryFn: () => apiFetch(`/api/super-admin/organizations/${id}/billing`),
    enabled: tab === "billing",
  });
  const users = useQuery<{ rows: UserRow[] }>({
    queryKey: ["cockpit-org-users", id],
    queryFn: () => apiFetch(`/api/super-admin/organizations/${id}/users`),
    enabled: tab === "users",
  });
  const tickets = useQuery<{ rows: TicketRow[] }>({
    queryKey: ["cockpit-org-tickets", id],
    queryFn: () => apiFetch(`/api/super-admin/organizations/${id}/tickets`),
    enabled: tab === "tickets",
  });

  const d = detail.data;
  const org = d?.org;
  const sub = d?.subscription;
  const m = d?.metrics;

  const handleToggle = async () => {
    if (!org) return;
    setToggling(true);
    try {
      const action = org.isActive ? "suspend" : "reactivate";
      await apiFetch(`/api/super-admin/organizations/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      toast.success(action === "suspend" ? "Organisation suspendue" : "Organisation réactivée");
      qc.invalidateQueries({ queryKey: ["cockpit-org", id] });
      qc.invalidateQueries({ queryKey: ["cockpit-orgs"] });
      setConfirming(false);
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Erreur");
    } finally {
      setToggling(false);
    }
  };

  const TABS: { id: Tab; label: string; icon: typeof Building2 }[] = [
    { id: "overview",     label: "Vue d'ensemble",    icon: Activity },
    { id: "subscription", label: "Abonnement",        icon: CreditCard },
    { id: "billing",      label: "Paiements",         icon: TrendingUp },
    { id: "users",        label: "Utilisateurs",      icon: Users },
    { id: "tickets",      label: "Tickets",           icon: Ticket },
    { id: "actions",      label: "Actions",           icon: Shield },
  ];

  if (detail.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Organisation introuvable
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate("/tenants")} className="mt-0.5">
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />Retour
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight truncate">{org.name}</h1>
            <Badge variant="outline" className={org.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}>
              {org.isActive ? <><CheckCircle2 className="w-3 h-3 mr-1" />Active</> : <><XCircle className="w-3 h-3 mr-1" />Suspendue</>}
            </Badge>
            {sub?.planCode && <Badge variant="outline" className={PLAN_COLOR[sub.planCode] ?? ""}>{sub.planCode}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{org.slug} · {org.industry ?? "—"} · {org.country ?? "—"}</p>
        </div>
      </div>

      {/* Quick KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "MRR", value: fmtFCFA(d?.mrr ?? 0), icon: TrendingUp, color: "text-primary" },
          { label: "Revenus total", value: fmtFCFA(m?.totalRevenue ?? 0), icon: CreditCard, color: "text-emerald-600" },
          { label: "Membres", value: String(m?.memberCount ?? 0), icon: Users, color: "text-indigo-600" },
          { label: "Modules actifs", value: String(m?.moduleCount ?? 0), icon: Package, color: "text-violet-600" },
          { label: "Tickets ouverts", value: String(m?.openTickets ?? 0), icon: Ticket, color: m && m.openTickets > 0 ? "text-amber-600" : "text-muted-foreground" },
          { label: "Paiements échoués", value: String(m?.failedPayments ?? 0), icon: AlertTriangle, color: m && m.failedPayments > 0 ? "text-red-600" : "text-muted-foreground" },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-3">
              <p className="text-[10px] uppercase font-semibold text-muted-foreground truncate">{k.label}</p>
              <p className={`text-lg font-bold mt-0.5 truncate ${k.color}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-0 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Building2 className="w-4 h-4" />Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                { label: "Nom", value: org.name },
                { label: "Slug", value: <span className="font-mono text-xs">{org.slug}</span> },
                { label: "Secteur", value: org.industry ?? "—" },
                { label: "Pays", value: org.country ?? "—" },
                { label: "Email contact", value: org.contactEmail ?? "—" },
                { label: "Devise", value: org.currency },
                { label: "Créée le", value: fmtDate(org.createdAt) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-start gap-2">
                  <span className="text-muted-foreground shrink-0">{label}</span>
                  <span className="font-medium text-right break-all">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><CreditCard className="w-4 h-4" />Abonnement actif</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {sub ? (
                <>
                  {[
                    { label: "Plan", value: <Badge variant="outline" className={PLAN_COLOR[sub.planCode] ?? ""}>{sub.planName}</Badge> },
                    { label: "Sièges", value: `${sub.seats} utilisateurs` },
                    { label: "Prix unitaire", value: fmtFCFA(sub.unitPrice) },
                    { label: "Facturation", value: sub.cycle === "annual" ? "Annuelle" : "Mensuelle" },
                    { label: "Statut", value: <Badge variant="outline" className={BILLING_STATUS[sub.status]?.cls ?? ""}>{BILLING_STATUS[sub.status]?.label ?? sub.status}</Badge> },
                    { label: "Début période", value: fmtDate(sub.currentPeriodStart) },
                    { label: "Fin période", value: fmtDate(sub.currentPeriodEnd) },
                    { label: "MRR", value: <span className="font-bold text-primary">{fmtFCFA(d?.mrr ?? 0)}</span> },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center gap-2">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium text-right">{value}</span>
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-muted-foreground text-sm py-4 text-center">Aucun abonnement actif</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "subscription" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Détail de l'abonnement</CardTitle>
          </CardHeader>
          <CardContent>
            {sub ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "MRR", value: fmtFCFA(d?.mrr ?? 0), sub: "mensuel" },
                    { label: "ARR", value: fmtFCFA((d?.mrr ?? 0) * 12), sub: "annuel projeté" },
                    { label: "Sièges", value: String(sub.seats), sub: "utilisateurs inclus" },
                    { label: "Frais setup", value: fmtFCFA(sub.setupFee ?? 0), sub: "one-time" },
                  ].map((k) => (
                    <div key={k.label} className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">{k.label}</p>
                      <p className="text-xl font-bold text-foreground mt-1">{k.value}</p>
                      <p className="text-[10px] text-muted-foreground">{k.sub}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm border-t pt-4">
                  <div className="space-y-2">
                    <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><Badge variant="outline" className={PLAN_COLOR[sub.planCode] ?? ""}>{sub.planName}</Badge></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Cycle</span><span>{sub.cycle === "annual" ? "Annuel" : "Mensuel"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Statut</span><Badge variant="outline" className={BILLING_STATUS[sub.status]?.cls ?? ""}>{BILLING_STATUS[sub.status]?.label ?? sub.status}</Badge></div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between"><span className="text-muted-foreground">Période début</span><span>{fmtDate(sub.currentPeriodStart)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Période fin</span><span>{fmtDate(sub.currentPeriodEnd)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Renouvellement</span><span className="text-amber-600 font-medium flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(sub.currentPeriodEnd)}</span></div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">Aucun abonnement actif</p>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "billing" && (
        <div className="space-y-4">
          {billing.isLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total encaissé", value: fmtFCFA(billing.data?.summary.totalPaid ?? 0), cls: "text-emerald-600" },
                  { label: "En attente", value: fmtFCFA(billing.data?.summary.totalPending ?? 0), cls: "text-amber-600" },
                  { label: "Paiements échoués", value: String(billing.data?.summary.totalFailed ?? 0), cls: "text-red-600" },
                ].map((k) => (
                  <Card key={k.label}><CardContent className="p-3">
                    <p className="text-[10px] uppercase font-semibold text-muted-foreground">{k.label}</p>
                    <p className={`text-xl font-bold mt-1 ${k.cls}`}>{k.value}</p>
                  </CardContent></Card>
                ))}
              </div>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Historique des paiements</CardTitle>
                  <CardDescription>TVA 18% incluse dans les montants TTC</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Libellé</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Montant HT</TableHead>
                          <TableHead className="text-right">TVA 18%</TableHead>
                          <TableHead className="text-right">TTC</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Référence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(billing.data?.rows ?? []).length === 0 ? (
                          <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Aucun événement de facturation</TableCell></TableRow>
                        ) : (billing.data?.rows ?? []).map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(row.occurredAt)}</TableCell>
                            <TableCell className="text-sm max-w-[180px]"><p className="truncate">{row.label}</p></TableCell>
                            <TableCell><span className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{row.kind}</span></TableCell>
                            <TableCell className="text-right font-mono text-sm whitespace-nowrap">{fmtFCFA(row.amountHt)}</TableCell>
                            <TableCell className="text-right font-mono text-sm whitespace-nowrap text-muted-foreground">{fmtFCFA(row.amountTva)}</TableCell>
                            <TableCell className="text-right font-mono text-sm font-semibold whitespace-nowrap">{fmtFCFA(row.amountTtc)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-xs ${BILLING_STATUS[row.status]?.cls ?? ""}`}>
                                {BILLING_STATUS[row.status]?.label ?? row.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground max-w-[100px]">
                              <p className="truncate">{row.reference ?? "—"}</p>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {tab === "users" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Membres de l'organisation</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {users.isLoading ? (
              <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Rejoint le</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(users.data?.rows ?? []).length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucun membre</TableCell></TableRow>
                    ) : (users.data?.rows ?? []).map((u) => (
                      <TableRow key={u.userId}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-primary">
                                {(u.firstName ?? u.email ?? "?")[0]?.toUpperCase()}
                              </span>
                            </div>
                            <span className="text-sm font-medium">{[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}</span>
                            {u.isPrimary && <Badge variant="outline" className="text-[10px] py-0">Principal</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{u.email ?? "—"}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs bg-muted px-2 py-0.5 rounded capitalize">{u.role}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={u.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}>
                            {u.isActive ? "Actif" : "Inactif"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtDate(u.joinedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "tickets" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Tickets de support</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {tickets.isLoading ? (
              <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sujet</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead>Priorité</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Créé le</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(tickets.data?.rows ?? []).length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucun ticket</TableCell></TableRow>
                    ) : (tickets.data?.rows ?? []).map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm font-medium max-w-[240px]"><p className="truncate">{t.subject}</p></TableCell>
                        <TableCell><span className="text-xs bg-muted px-2 py-0.5 rounded">{t.category}</span></TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium capitalize ${PRIORITY_CFG[t.priority] ?? ""}`}>{t.priority}</span>
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium capitalize ${TICKET_STATUS_CFG[t.status] ?? ""}`}>{t.status}</span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(t.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "actions" && (
        <div className="space-y-4 max-w-xl">
          <Card className={org.isActive ? "border-red-200" : "border-emerald-200"}>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                {org.isActive ? <PowerOff className="w-4 h-4 text-red-500" /> : <Power className="w-4 h-4 text-emerald-500" />}
                {org.isActive ? "Suspendre l'organisation" : "Réactiver l'organisation"}
              </CardTitle>
              <CardDescription>
                {org.isActive
                  ? "Suspendre cette organisation bloquera l'accès à tous ses membres et mettra en pause son abonnement."
                  : "Réactiver cette organisation rétablira l'accès à tous ses membres."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {org.isDefault ? (
                <p className="text-sm text-amber-600 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  L'organisation par défaut ne peut pas être suspendue.
                </p>
              ) : (
                <Button
                  variant={org.isActive ? "destructive" : "default"}
                  onClick={() => setConfirming(true)}
                  className="gap-1.5"
                >
                  {org.isActive ? <><PowerOff className="w-4 h-4" />Suspendre</> : <><Power className="w-4 h-4" />Réactiver</>}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4" />Informations techniques</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">ID Organisation</span><span className="font-mono text-xs break-all">{org.id}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Org par défaut</span><span>{org.isDefault ? "Oui" : "Non"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Créée le</span><span>{fmtDate(org.createdAt)}</span></div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Confirm dialog */}
      <Dialog open={confirming} onOpenChange={(o) => { if (!o) setConfirming(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{org.isActive ? "Suspendre" : "Réactiver"} l'organisation</DialogTitle>
            <DialogDescription>
              {org.isActive
                ? `Suspendre "${org.name}" bloquera l'accès à tous ses membres.`
                : `Réactiver "${org.name}" rétablira l'accès à tous ses membres.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirming(false)}>Annuler</Button>
            <Button variant={org.isActive ? "destructive" : "default"} onClick={handleToggle} disabled={toggling}>
              {toggling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {org.isActive ? "Suspendre" : "Réactiver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
