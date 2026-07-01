import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Briefcase, Users, Building2, FileText, Search,
  Power, PowerOff, Loader2, AlertTriangle, ChevronRight,
  Globe, Mail, Calendar, UserPlus, CheckCircle2, Send,
} from "lucide-react";
import { toast } from "sonner";

type ExpertFirm = {
  id: string; name: string; slug: string; country: string;
  email: string | null; plan: string; isActive: boolean;
  createdAt: string; memberCount: number; clientCount: number; pendingDocCount: number;
};

type Kpis = {
  totalFirms: number; activeFirms: number; totalClients: number; pendingDocs: number;
};

type ListData = { kpis: Kpis; firms: ExpertFirm[] };

type FirmMember = {
  id: string; userId: string; role: string;
  firstName: string; lastName: string; email: string;
  invitedAt: string; joinedAt: string | null;
};

type FirmClient = {
  id: string; orgId: string; orgName: string; orgCountry: string | null;
  accessLevel: string; isActive: boolean; grantedAt: string;
};

type FirmDoc = {
  id: string; title: string; status: string; dueDate: string | null;
  createdAt: string; orgName: string;
};

type FirmDetail = {
  firm: ExpertFirm;
  members: FirmMember[];
  clients: FirmClient[];
  docs: FirmDoc[];
};

const PLAN_COLOR: Record<string, string> = {
  starter: "bg-slate-50 text-slate-600 border-slate-200",
  growth: "bg-violet-50 text-violet-700 border-violet-200",
  professional: "bg-purple-50 text-purple-700 border-purple-200",
};

const ROLE_LABEL: Record<string, string> = {
  owner: "Propriétaire", admin: "Administrateur", member: "Membre",
};

const ACCESS_LABEL: Record<string, string> = {
  full: "Complet", read: "Lecture", billing: "Facturation",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.FC<{ className?: string }>; label: string; value: number; sub?: string; color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg ${color.replace("text-", "bg-").replace("-700", "-100").replace("-600", "-100")}`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type InviteForm = {
  firmName: string;
  country: string;
  plan: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
};

const EMPTY_INVITE: InviteForm = {
  firmName: "", country: "TG", plan: "starter",
  adminFirstName: "", adminLastName: "", adminEmail: "",
};

export default function ExpertFirmsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "suspended">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<ExpertFirm | null>(null);
  const [toggling, setToggling] = useState(false);

  // Invite dialog state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteForm>(EMPTY_INVITE);
  const [inviteSent, setInviteSent] = useState(false);

  const { data, isLoading } = useQuery<ListData>({
    queryKey: ["cockpit-expert-firms"],
    queryFn: () => apiFetch("/api/super-admin/expert-firms"),
    refetchInterval: 60_000,
  });

  const { data: detail, isLoading: loadDetail } = useQuery<FirmDetail>({
    queryKey: ["cockpit-expert-firm", selectedId],
    queryFn: () => apiFetch(`/api/super-admin/expert-firms/${selectedId}`),
    enabled: !!selectedId,
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiFetch(`/api/super-admin/expert-firms/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: (_, vars) => {
      toast.success(vars.isActive ? "Cabinet réactivé" : "Cabinet suspendu");
      qc.invalidateQueries({ queryKey: ["cockpit-expert-firms"] });
      qc.invalidateQueries({ queryKey: ["cockpit-expert-firm", vars.id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const inviteMut = useMutation({
    mutationFn: (form: InviteForm) =>
      apiFetch("/api/super-admin/expert-firms/invite", {
        method: "POST",
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      setInviteSent(true);
      qc.invalidateQueries({ queryKey: ["cockpit-expert-firms"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur lors de l'invitation"),
  });

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.firmName.trim()) { toast.error("Nom du cabinet requis"); return; }
    if (!inviteForm.adminEmail.trim()) { toast.error("Email de l'administrateur requis"); return; }
    if (!inviteForm.adminFirstName.trim() || !inviteForm.adminLastName.trim()) {
      toast.error("Prénom et nom de l'administrateur requis"); return;
    }
    inviteMut.mutate(inviteForm);
  };

  const handleInviteClose = () => {
    setInviteOpen(false);
    setInviteSent(false);
    setInviteForm(EMPTY_INVITE);
  };

  const rows = (data?.firms ?? []).filter((f) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!f.name.toLowerCase().includes(q) && !f.slug.toLowerCase().includes(q) && !(f.email ?? "").toLowerCase().includes(q)) return false;
    }
    if (filterStatus === "active" && !f.isActive) return false;
    if (filterStatus === "suspended" && f.isActive) return false;
    return true;
  });

  const kpis = data?.kpis ?? { totalFirms: 0, activeFirms: 0, totalClients: 0, pendingDocs: 0 };

  const handleToggleConfirm = async () => {
    if (!confirming) return;
    setToggling(true);
    try {
      await toggleMut.mutateAsync({ id: confirming.id, isActive: !confirming.isActive });
      setConfirming(null);
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cabinets experts</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Vue globale des cabinets comptables, consultants et agences utilisant le module Expert
          </p>
        </div>
        <Button
          onClick={() => { setInviteSent(false); setInviteForm(EMPTY_INVITE); setInviteOpen(true); }}
          className="shrink-0 gap-1.5"
        >
          <UserPlus className="w-4 h-4" />
          Inviter un cabinet
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Briefcase} label="Cabinets total" value={kpis.totalFirms} color="text-blue-600" />
        <KpiCard icon={Power} label="Cabinets actifs" value={kpis.activeFirms}
          sub={kpis.totalFirms > 0 ? `${Math.round(kpis.activeFirms / kpis.totalFirms * 100)}% actifs` : undefined}
          color="text-emerald-600" />
        <KpiCard icon={Building2} label="Clients gérés" value={kpis.totalClients} color="text-violet-600" />
        <KpiCard icon={FileText} label="Docs en attente" value={kpis.pendingDocs} color={kpis.pendingDocs > 0 ? "text-amber-600" : "text-slate-500"} />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un cabinet…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <div className="flex gap-2">
              {(["all", "active", "suspended"] as const).map((s) => (
                <Button key={s} variant={filterStatus === s ? "default" : "outline"} size="sm"
                  onClick={() => setFilterStatus(s)} className="h-9">
                  {s === "all" ? "Tous" : s === "active" ? "Actifs" : "Suspendus"}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              <Briefcase className="w-10 h-10 opacity-20" />
              <p className="text-sm">Aucun cabinet trouvé.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cabinet</TableHead>
                    <TableHead className="text-center">Plan</TableHead>
                    <TableHead className="text-center">Membres</TableHead>
                    <TableHead className="text-center">Clients</TableHead>
                    <TableHead className="text-center">Docs att.</TableHead>
                    <TableHead>Créé le</TableHead>
                    <TableHead className="text-center">Statut</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((f) => (
                    <TableRow key={f.id} className="cursor-pointer hover:bg-muted/40"
                      onClick={() => setSelectedId(f.id)}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">{f.name[0]?.toUpperCase()}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate max-w-[200px]">{f.name}</p>
                            <p className="text-xs text-muted-foreground">{f.country}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`text-[10px] capitalize ${PLAN_COLOR[f.plan] ?? PLAN_COLOR.starter}`}>
                          {f.plan}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm font-semibold">{f.memberCount}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm font-semibold">{f.clientCount}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {f.pendingDocCount > 0 ? (
                          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                            {f.pendingDocCount}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {fmtDate(f.createdAt)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${f.isActive ? "text-emerald-600" : "text-red-500"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${f.isActive ? "bg-emerald-500" : "bg-red-400"}`} />
                          {f.isActive ? "Actif" : "Suspendu"}
                        </span>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                          onClick={() => setSelectedId(f.id)}>
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {loadDetail || !detail ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <SheetHeader className="pb-4 border-b mb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">{detail.firm.name[0]?.toUpperCase()}</span>
                    </div>
                    <div>
                      <SheetTitle className="text-base leading-tight">{detail.firm.name}</SheetTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={`text-[10px] capitalize ${PLAN_COLOR[detail.firm.plan] ?? PLAN_COLOR.starter}`}>
                          {detail.firm.plan}
                        </Badge>
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${detail.firm.isActive ? "text-emerald-600" : "text-red-500"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${detail.firm.isActive ? "bg-emerald-500" : "bg-red-400"}`} />
                          {detail.firm.isActive ? "Actif" : "Suspendu"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant={detail.firm.isActive ? "outline" : "default"}
                    size="sm"
                    className={detail.firm.isActive ? "text-red-600 border-red-200 hover:bg-red-50" : ""}
                    onClick={() => setConfirming(detail.firm)}
                  >
                    {detail.firm.isActive
                      ? <><PowerOff className="w-3.5 h-3.5 mr-1.5" />Suspendre</>
                      : <><Power className="w-3.5 h-3.5 mr-1.5" />Réactiver</>
                    }
                  </Button>
                </div>

                {/* Meta */}
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-muted-foreground">
                  {detail.firm.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3 h-3" /><span className="truncate">{detail.firm.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3 h-3" /><span>{detail.firm.country}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" /><span>Créé le {fmtDate(detail.firm.createdAt)}</span>
                  </div>
                </div>
              </SheetHeader>

              <Tabs defaultValue="members">
                <TabsList className="w-full">
                  <TabsTrigger value="members" className="flex-1">
                    Membres <span className="ml-1 text-[10px] bg-muted rounded px-1">{detail.members.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="clients" className="flex-1">
                    Clients <span className="ml-1 text-[10px] bg-muted rounded px-1">{detail.clients.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="docs" className="flex-1">
                    Documents <span className="ml-1 text-[10px] bg-muted rounded px-1">{detail.docs.length}</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="members" className="mt-4 space-y-2">
                  {detail.members.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Aucun membre.</p>
                  ) : detail.members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/30">
                      <Avatar className="w-8 h-8 shrink-0">
                        <AvatarFallback className="text-[11px] bg-primary/10 text-primary">
                          {(m.firstName[0] + m.lastName[0]).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.firstName} {m.lastName}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {ROLE_LABEL[m.role] ?? m.role}
                      </Badge>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="clients" className="mt-4 space-y-2">
                  {detail.clients.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Aucun client lié.</p>
                  ) : detail.clients.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/30">
                      <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.orgName}</p>
                        <p className="text-xs text-muted-foreground">{c.orgCountry ?? "—"}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px]">{ACCESS_LABEL[c.accessLevel] ?? c.accessLevel}</Badge>
                        <span className={`w-1.5 h-1.5 rounded-full ${c.isActive ? "bg-emerald-500" : "bg-red-400"}`} />
                      </div>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="docs" className="mt-4 space-y-2">
                  {detail.docs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Aucune demande en cours.</p>
                  ) : detail.docs.map((d) => (
                    <div key={d.id} className="flex items-start gap-3 py-2.5 px-3 rounded-lg bg-muted/30">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{d.title}</p>
                        <p className="text-xs text-muted-foreground">{d.orgName} · {fmtDate(d.createdAt)}</p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${
                        d.status === "en_attente" ? "bg-amber-50 text-amber-700 border-amber-200"
                        : d.status === "recu" ? "bg-blue-50 text-blue-700 border-blue-200"
                        : d.status === "valide" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-red-50 text-red-700 border-red-200"
                      }`}>
                        {d.status === "en_attente" ? "En attente" : d.status === "recu" ? "Reçu"
                         : d.status === "valide" ? "Validé" : "Rejeté"}
                      </Badge>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Invite cabinet dialog */}
      <Dialog open={inviteOpen} onOpenChange={(o) => !o && handleInviteClose()}>
        <DialogContent className="sm:max-w-lg">
          {inviteSent ? (
            <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <div>
                <DialogTitle className="text-lg">Invitation envoyée !</DialogTitle>
                <p className="text-sm text-muted-foreground mt-2">
                  Un email a été envoyé à <strong>{inviteForm.adminEmail}</strong>.<br/>
                  Le cabinet <strong>{inviteForm.firmName}</strong> sera activé une fois l'invitation acceptée.
                </p>
              </div>
              <Button onClick={handleInviteClose} className="mt-2">Fermer</Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-primary" />
                  Inviter un nouveau cabinet
                </DialogTitle>
                <DialogDescription>
                  Un email d'invitation sera envoyé à l'administrateur du cabinet. Le cabinet sera actif après acceptation.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleInviteSubmit} className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="inv-firm">Nom du cabinet <span className="text-destructive">*</span></Label>
                  <Input
                    id="inv-firm"
                    placeholder="Ex : Cabinet Kofi Expertise"
                    required
                    value={inviteForm.firmName}
                    onChange={(e) => setInviteForm((f) => ({ ...f, firmName: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-country">Pays</Label>
                    <Input
                      id="inv-country"
                      placeholder="TG"
                      value={inviteForm.country}
                      onChange={(e) => setInviteForm((f) => ({ ...f, country: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-plan">Plan</Label>
                    <Select
                      value={inviteForm.plan}
                      onValueChange={(v) => setInviteForm((f) => ({ ...f, plan: v }))}
                    >
                      <SelectTrigger id="inv-plan">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="starter">Starter</SelectItem>
                        <SelectItem value="growth">Growth</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="pt-1 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                    Administrateur du cabinet
                  </p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="inv-fn">Prénom <span className="text-destructive">*</span></Label>
                      <Input
                        id="inv-fn"
                        required
                        value={inviteForm.adminFirstName}
                        onChange={(e) => setInviteForm((f) => ({ ...f, adminFirstName: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="inv-ln">Nom <span className="text-destructive">*</span></Label>
                      <Input
                        id="inv-ln"
                        required
                        value={inviteForm.adminLastName}
                        onChange={(e) => setInviteForm((f) => ({ ...f, adminLastName: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-email">Email <span className="text-destructive">*</span></Label>
                    <Input
                      id="inv-email"
                      type="email"
                      required
                      placeholder="admin@cabinet.com"
                      value={inviteForm.adminEmail}
                      onChange={(e) => setInviteForm((f) => ({ ...f, adminEmail: e.target.value }))}
                    />
                  </div>
                </div>

                <DialogFooter className="pt-2">
                  <Button type="button" variant="outline" onClick={handleInviteClose}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={inviteMut.isPending} className="gap-1.5">
                    {inviteMut.isPending
                      ? <><Loader2 className="w-4 h-4 animate-spin" />Envoi…</>
                      : <><Send className="w-4 h-4" />Envoyer l'invitation</>
                    }
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm toggle dialog */}
      <Dialog open={!!confirming} onOpenChange={(o) => !o && setConfirming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {confirming?.isActive ? "Suspendre le cabinet" : "Réactiver le cabinet"}
            </DialogTitle>
            <DialogDescription>
              {confirming?.isActive
                ? `Suspendre "${confirming?.name}" bloquera l'accès Expert pour tous ses membres. Les données sont conservées.`
                : `Réactiver "${confirming?.name}" restaurera l'accès Expert pour tous ses membres.`
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(null)} disabled={toggling}>Annuler</Button>
            <Button
              variant={confirming?.isActive ? "destructive" : "default"}
              onClick={handleToggleConfirm}
              disabled={toggling}
            >
              {toggling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {confirming?.isActive ? "Suspendre" : "Réactiver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
