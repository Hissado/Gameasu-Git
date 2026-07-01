import { Link } from "wouter";
import { useActiveFirm, useExpertDashboard, useExpertClients, useCreateFirm, useInviteFirmMember, ACCESS_LABEL, PLAN_COLOR } from "@/lib/expert-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { formatFCFA } from "@/lib/format";
import {
  Building2, FileText, FolderKanban, AlertCircle,
  ChevronRight, Plus, Network, TrendingUp, Wallet, Clock, UserPlus, Bell,
} from "lucide-react";

function KpiCard({ icon: Icon, label, value, sub, color = "blue" }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string | number; sub?: string; color?: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <Card>
      <CardContent className="p-5 flex items-start gap-4">
        <div className={`p-2.5 rounded-xl ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground leading-none">{label}</p>
          <p className="text-2xl font-bold tracking-tight mt-1">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateFirmModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const { setFirm } = useActiveFirm();
  const create = useCreateFirm();
  const [form, setForm] = useState({ name: "", country: "TG", email: "", phone: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      const firm = await create.mutateAsync(form);
      setFirm(firm.id);
      toast({ title: "Cabinet créé avec succès" });
      onClose();
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.body?.error ?? "Erreur inconnue", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Créer votre cabinet</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Nom du cabinet *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Cabinet Dupont & Associés" required />
          </div>
          <div className="space-y-1.5">
            <Label>Pays</Label>
            <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="TG" maxLength={3} />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail du cabinet</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contact@cabinet.com" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Création…" : "Créer le cabinet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InviteCollaborateurModal({ firmId, open, onClose }: { firmId: string; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const invite = useInviteFirmMember(firmId);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", role: "member" });

  const f = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    invite.mutate(form, {
      onSuccess: () => {
        toast({ title: "Invitation envoyée", description: "Un e-mail d'invitation a été envoyé au collaborateur." });
        onClose();
        setForm({ firstName: "", lastName: "", email: "", role: "member" });
      },
      onError: (err: any) => {
        toast({ title: "Erreur", description: err?.body?.error ?? "Erreur lors de l'invitation", variant: "destructive" });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Inviter un collaborateur</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prénom *</Label>
              <Input value={form.firstName} onChange={(e) => f("firstName", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Nom *</Label>
              <Input value={form.lastName} onChange={(e) => f("lastName", e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>E-mail *</Label>
            <Input type="email" value={form.email} onChange={(e) => f("email", e.target.value)} placeholder="collaborateur@cabinet.com" required />
          </div>
          <div className="space-y-1.5">
            <Label>Rôle</Label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={form.role}
              onChange={(e) => f("role", e.target.value)}
            >
              <option value="member">Collaborateur</option>
              <option value="admin">Administrateur</option>
              <option value="owner">Propriétaire</option>
            </select>
          </div>
          <p className="text-xs text-muted-foreground">Un lien d'invitation sécurisé lui sera envoyé par e-mail.</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={invite.isPending}>
              {invite.isPending ? "Envoi…" : "Inviter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ExpertDashboard() {
  const { firmId, activeFirm, firms } = useActiveFirm();
  const { data: dashboard, isLoading: loadKpi } = useExpertDashboard(firmId);
  const { data: clients, isLoading: loadClients } = useExpertClients(firmId);
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  if (!firms.length && !firmId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="p-4 bg-primary/10 rounded-2xl">
          <Network className="w-12 h-12 text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold">Portail Expert</h2>
          <p className="text-muted-foreground mt-2 max-w-sm">
            Gérez plusieurs organisations clientes depuis un espace centralisé.
            Commencez par créer votre cabinet.
          </p>
        </div>
        <Button size="lg" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />Créer mon cabinet
        </Button>
        <CreateFirmModal open={createOpen} onClose={() => setCreateOpen(false)} />
      </div>
    );
  }

  const kpis = dashboard ?? { clientCount: 0, activeSubscriptions: 0, pendingDocumentRequests: 0, totalInvoiced: 0, totalPaid: 0, activeProjects: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{activeFirm?.name ?? "Portail Expert"}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Vue consolidée de vos clients</p>
        </div>
        <div className="flex items-center gap-2">
          {firmId && (
            <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" />Inviter un collaborateur
            </Button>
          )}
          <Link href="/expert/clients">
            <Button variant="outline" size="sm">
              Gérer les clients <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      {loadKpi ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5 h-24 animate-pulse bg-muted rounded-xl" /></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard icon={Building2} label="Clients" value={kpis.clientCount} color="blue" />
          <KpiCard icon={TrendingUp} label="Abonnements actifs" value={kpis.activeSubscriptions} color="emerald" />
          <KpiCard icon={FolderKanban} label="Projets actifs" value={kpis.activeProjects} color="purple" />
          <KpiCard icon={Clock} label="Documents en attente" value={kpis.pendingDocumentRequests} color="amber" />
          <KpiCard icon={FileText} label="Facturé (cumul)" value={formatFCFA(kpis.totalInvoiced)} color="blue" />
          <KpiCard icon={Wallet} label="Encaissé (cumul)" value={formatFCFA(kpis.totalPaid)} color="emerald" />
        </div>
      )}

      {/* Alertes prioritaires */}
      {!loadKpi && !loadClients && (
        (() => {
          const alerts: { key: string; color: string; icon: React.ReactNode; text: string; href?: string }[] = [];
          if (kpis.pendingDocumentRequests > 0) {
            alerts.push({
              key: "docs",
              color: "amber",
              icon: <FileText className="w-4 h-4 text-amber-600 shrink-0" />,
              text: `${kpis.pendingDocumentRequests} demande${kpis.pendingDocumentRequests > 1 ? "s" : ""} de document${kpis.pendingDocumentRequests > 1 ? "s" : ""} en attente`,
              href: "/expert/document-requests",
            });
          }
          const inactiveCount = (clients ?? []).filter((c) => !c.isActive).length;
          if (inactiveCount > 0) {
            alerts.push({
              key: "inactive",
              color: "red",
              icon: <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />,
              text: `${inactiveCount} client${inactiveCount > 1 ? "s" : ""} avec accès inactif`,
              href: "/expert/clients",
            });
          }
          const noSubscription = (clients ?? []).filter((c) => !c.subscription).length;
          if (noSubscription > 0) {
            alerts.push({
              key: "nosub",
              color: "slate",
              icon: <Clock className="w-4 h-4 text-slate-500 shrink-0" />,
              text: `${noSubscription} client${noSubscription > 1 ? "s" : ""} sans abonnement actif`,
              href: "/expert/clients",
            });
          }
          if (!alerts.length) return null;
          return (
            <Card className="border-amber-200 bg-amber-50/40">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Bell className="w-4 h-4 text-amber-600" />
                  <p className="text-sm font-semibold text-amber-800">Alertes prioritaires</p>
                </div>
                <div className="space-y-2">
                  {alerts.map((a) => (
                    <div key={a.key} className="flex items-center gap-2 text-sm">
                      {a.icon}
                      <span className="flex-1">{a.text}</span>
                      {a.href && (
                        <Link href={a.href}>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-primary">
                            Voir <ChevronRight className="w-3 h-3 ml-0.5" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })()
      )}

      {/* Clients list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-base">Mes clients</h2>
          <Link href="/expert/clients">
            <Button variant="ghost" size="sm" className="text-primary">
              Voir tout <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </div>

        {loadClients ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        ) : !clients?.length ? (
          <Card>
            <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
              <AlertCircle className="w-8 h-8 text-muted-foreground/50" />
              <p className="text-muted-foreground text-sm">Aucun client lié à ce cabinet.</p>
              <Link href="/expert/clients">
                <Button size="sm"><Plus className="w-4 h-4 mr-1.5" />Ajouter un client</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {(clients ?? []).slice(0, 8).map((c) => (
              <Card key={c.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{c.org.name}</p>
                    <p className="text-xs text-muted-foreground">{c.org.country} · {ACCESS_LABEL[c.accessLevel] ?? c.accessLevel}</p>
                  </div>
                  {c.subscription ? (
                    <Badge className={`text-[10px] font-semibold border ${PLAN_COLOR[c.subscription.planCode] ?? "bg-slate-100 text-slate-600"}`} variant="outline">
                      {c.subscription.planName}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">Sans plan</Badge>
                  )}
                  {!c.isActive && (
                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50">Inactif</Badge>
                  )}
                  <Link href={`/expert/client-config?orgId=${c.orgId}`}>
                    <Button variant="ghost" size="sm" className="shrink-0">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateFirmModal open={createOpen} onClose={() => setCreateOpen(false)} />
      {firmId && (
        <InviteCollaborateurModal firmId={firmId} open={inviteOpen} onClose={() => setInviteOpen(false)} />
      )}
    </div>
  );
}
