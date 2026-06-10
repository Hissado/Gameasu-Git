import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { HrShell } from "./_layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { formatFCFA } from "@/lib/format";
import {
  User, CalendarDays, FolderArchive, Banknote, Phone, MapPin, Shield,
  Plus, Loader2, CheckCircle2, Clock, XCircle, ExternalLink, Pencil, Save, X
} from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  congé_payé: "Congé payé", RTT: "RTT", maladie: "Maladie",
  maternité: "Maternité", paternité: "Paternité", sans_solde: "Sans solde",
  formation: "Formation", exceptionnel: "Exceptionnel", autre: "Autre",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  cancelled: "bg-slate-100 text-slate-600 border-slate-200",
};
const STATUS_LABELS: Record<string, string> = { pending: "En attente", approved: "Approuvé", rejected: "Refusé", cancelled: "Annulé" };
const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3 h-3" />, approved: <CheckCircle2 className="w-3 h-3" />,
  rejected: <XCircle className="w-3 h-3" />, cancelled: <XCircle className="w-3 h-3" />,
};

function calcDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start), e = new Date(end);
  let d = 0; const cur = new Date(s);
  while (cur <= e) { if (cur.getDay() !== 0 && cur.getDay() !== 6) d++; cur.setDate(cur.getDate() + 1); }
  return d;
}

export default function MySpacePage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editProfile, setEditProfile] = useState(false);
  const [openLeave, setOpenLeave] = useState(false);
  const [profileForm, setProfileForm] = useState({ phone: "", address: "", emergencyContact: "" });
  const [leaveForm, setLeaveForm] = useState({ type: "congé_payé", startDate: "", endDate: "", days: "", reason: "" });

  const { data: profile, isLoading: loadingProfile } = useQuery<any>({
    queryKey: ["hr-me-profile"],
    queryFn: () => apiFetch("/api/hr/me/profile"),
  });

  const { data: leavesData } = useQuery<{ data: any[] }>({
    queryKey: ["hr-me-leaves"],
    queryFn: () => apiFetch("/api/hr/me/leave-requests"),
    enabled: !!profile,
  });

  const { data: balancesData } = useQuery<{ data: any[] }>({
    queryKey: ["hr-me-balances"],
    queryFn: () => apiFetch("/api/hr/me/leave-balance"),
    enabled: !!profile,
  });

  const { data: payslipsData } = useQuery<{ data: any[] }>({
    queryKey: ["hr-me-payslips"],
    queryFn: () => apiFetch("/api/hr/me/payslips"),
    enabled: !!profile,
  });

  const { data: docsData } = useQuery<{ data: any[] }>({
    queryKey: ["hr-me-docs"],
    queryFn: () => apiFetch("/api/hr/me/documents"),
    enabled: !!profile,
  });

  const { data: contractData } = useQuery<any>({
    queryKey: ["hr-me-contract"],
    queryFn: () => apiFetch("/api/hr/me/contract"),
    enabled: !!profile,
  });

  const updateProfileMut = useMutation({
    mutationFn: () => apiFetch("/api/hr/me/profile", { method: "PATCH", body: JSON.stringify(profileForm) }),
    onSuccess: () => { toast({ title: "Profil mis à jour" }); setEditProfile(false); qc.invalidateQueries({ queryKey: ["hr-me-profile"] }); },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const createLeaveMut = useMutation({
    mutationFn: () => apiFetch("/api/hr/me/leave-requests", {
      method: "POST",
      body: JSON.stringify({ ...leaveForm, days: leaveForm.days ? Number(leaveForm.days) : calcDays(leaveForm.startDate, leaveForm.endDate) }),
    }),
    onSuccess: () => {
      toast({ title: "Demande de congé envoyée" });
      setOpenLeave(false);
      setLeaveForm({ type: "congé_payé", startDate: "", endDate: "", days: "", reason: "" });
      qc.invalidateQueries({ queryKey: ["hr-me-leaves"] });
      qc.invalidateQueries({ queryKey: ["hr-me-balances"] });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const cancelLeaveMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/hr/me/leave-requests/${id}/cancel`, { method: "PATCH" }),
    onSuccess: () => { toast({ title: "Demande annulée" }); qc.invalidateQueries({ queryKey: ["hr-me-leaves"] }); },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  if (loadingProfile) {
    return (
      <HrShell title="Mon espace" subtitle="Portail employé">
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Chargement…
        </div>
      </HrShell>
    );
  }

  if (!profile) {
    return (
      <HrShell title="Mon espace" subtitle="Portail employé">
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Aucun profil collaborateur associé à votre compte</p>
            <p className="text-xs mt-1">Contactez votre administrateur RH pour lier votre compte.</p>
          </CardContent>
        </Card>
      </HrShell>
    );
  }

  const fullName = `${profile.firstName} ${profile.lastName}`;
  const initials = `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase();
  const leaves = leavesData?.data ?? [];
  const balances = balancesData?.data ?? [];
  const payslips = payslipsData?.data ?? [];
  const docs = docsData?.data ?? [];

  const pendingLeaves = leaves.filter((l: any) => l.status === "pending").length;
  const totalBalanceDays = balances.reduce((sum: number, b: any) => sum + (Number(b.remaining) > 0 ? Number(b.remaining) : 0), 0);

  return (
    <HrShell
      title="Mon espace"
      subtitle={`Bienvenue, ${profile.firstName} — portail employé`}
      actions={
        <Button onClick={() => setOpenLeave(true)} size="sm">
          <Plus className="w-4 h-4 mr-2" />Demande de congé
        </Button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne gauche : profil */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 pb-4">
              <div className="flex flex-col items-center text-center mb-4">
                <Avatar className="w-20 h-20 mb-3 border-2 border-primary/20">
                  {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} />}
                  <AvatarFallback className="text-xl font-bold bg-slate-700 text-white">{initials}</AvatarFallback>
                </Avatar>
                <h2 className="text-lg font-bold text-foreground">{fullName}</h2>
                <p className="text-sm text-muted-foreground">{profile.jobTitle || profile.position || "—"}</p>
                {profile.employmentStatus && (
                  <Badge variant="outline" className="mt-1 text-xs capitalize">{profile.employmentStatus}</Badge>
                )}
              </div>

              <Separator className="my-3" />

              {!editProfile ? (
                <div className="space-y-2 text-sm">
                  {profile.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span>{profile.phone}</span>
                    </div>
                  )}
                  {profile.address && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{profile.address}</span>
                    </div>
                  )}
                  {profile.emergencyContact && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Shield className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate text-xs">{profile.emergencyContact}</span>
                    </div>
                  )}
                  <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => {
                    setProfileForm({ phone: profile.phone ?? "", address: profile.address ?? "", emergencyContact: profile.emergencyContact ?? "" });
                    setEditProfile(true);
                  }}>
                    <Pencil className="w-3.5 h-3.5 mr-2" />Modifier mes infos
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div><Label className="text-xs">Téléphone</Label><Input value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} /></div>
                  <div><Label className="text-xs">Adresse</Label><Input value={profileForm.address} onChange={e => setProfileForm(f => ({ ...f, address: e.target.value }))} /></div>
                  <div><Label className="text-xs">Contact d'urgence</Label><Input value={profileForm.emergencyContact} onChange={e => setProfileForm(f => ({ ...f, emergencyContact: e.target.value }))} placeholder="Nom — Téléphone" /></div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={() => updateProfileMut.mutate()} disabled={updateProfileMut.isPending}>
                      {updateProfileMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}Sauvegarder
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditProfile(false)}><X className="w-3 h-3" /></Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contrat actif */}
          {contractData && (
            <Card>
              <CardHeader className="pb-2 pt-4"><CardTitle className="text-xs uppercase text-muted-foreground">Mon contrat</CardTitle></CardHeader>
              <CardContent className="pb-4 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Type</span><Badge variant="outline" className="text-xs">{contractData.type}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Depuis</span><span>{new Date(contractData.startDate).toLocaleDateString("fr-FR")}</span></div>
                {contractData.endDate && <div className="flex justify-between"><span className="text-muted-foreground">Jusqu'au</span><span>{new Date(contractData.endDate).toLocaleDateString("fr-FR")}</span></div>}
                {contractData.monthlySalary && <div className="flex justify-between"><span className="text-muted-foreground">Salaire brut</span><span className="font-semibold">{formatFCFA(Number(contractData.monthlySalary))}</span></div>}
              </CardContent>
            </Card>
          )}

          {/* KPIs rapides */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Solde congés</p>
                <p className="text-2xl font-bold text-emerald-600">{Math.round(totalBalanceDays)}</p>
                <p className="text-xs text-muted-foreground">jours restants</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">En attente</p>
                <p className="text-2xl font-bold text-amber-600">{pendingLeaves}</p>
                <p className="text-xs text-muted-foreground">demande{pendingLeaves !== 1 ? "s" : ""}</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Colonne droite : tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="conges">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="conges" className="gap-1.5"><CalendarDays className="w-4 h-4" />Congés</TabsTrigger>
              <TabsTrigger value="soldes" className="gap-1.5"><CheckCircle2 className="w-4 h-4" />Soldes</TabsTrigger>
              <TabsTrigger value="bulletins" className="gap-1.5"><Banknote className="w-4 h-4" />Bulletins</TabsTrigger>
              <TabsTrigger value="documents" className="gap-1.5"><FolderArchive className="w-4 h-4" />Documents</TabsTrigger>
            </TabsList>

            {/* Mes congés */}
            <TabsContent value="conges" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  {leaves.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">Aucune demande de congé</p>
                      <Button size="sm" className="mt-3" onClick={() => setOpenLeave(true)}><Plus className="w-3 h-3 mr-1" />Faire une demande</Button>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-xs uppercase text-muted-foreground border-b">
                        <tr>
                          <th className="text-left px-4 py-2.5">Type</th>
                          <th className="text-left px-4 py-2.5">Période</th>
                          <th className="text-center px-4 py-2.5">Jours</th>
                          <th className="text-center px-4 py-2.5">Statut</th>
                          <th className="px-4 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaves.map((l: any) => (
                          <tr key={l.id} className="border-t hover:bg-muted/20">
                            <td className="px-4 py-2.5"><Badge variant="outline" className="text-xs">{TYPE_LABELS[l.type] ?? l.type}</Badge></td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">
                              {new Date(l.startDate).toLocaleDateString("fr-FR")} → {new Date(l.endDate).toLocaleDateString("fr-FR")}
                            </td>
                            <td className="px-4 py-2.5 text-center font-semibold">{l.days}</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[l.status] ?? ""}`}>
                                {STATUS_ICONS[l.status]}{STATUS_LABELS[l.status] ?? l.status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {l.status === "pending" && (
                                <Button size="sm" variant="ghost" className="h-6 text-xs text-muted-foreground" onClick={() => { if (confirm("Annuler cette demande ?")) cancelLeaveMut.mutate(l.id); }}>
                                  Annuler
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Soldes */}
            <TabsContent value="soldes" className="mt-4">
              {balances.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Aucun solde défini pour cette année</p>
                  <p className="text-xs mt-1">Contactez votre gestionnaire RH.</p>
                </CardContent></Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {balances.map((b: any) => {
                    const total = Number(b.allocated) + Number(b.carried);
                    const pct = total > 0 ? Math.min(100, Math.round((Number(b.used) / total) * 100)) : 0;
                    const remaining = Number(b.remaining);
                    return (
                      <Card key={b.id}>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <p className="text-sm font-semibold">{TYPE_LABELS[b.leaveType] ?? b.leaveType}</p>
                            <Badge variant={remaining < 0 ? "destructive" : remaining < 3 ? "outline" : "secondary"} className="text-xs">
                              {remaining > 0 ? `${remaining} j restants` : remaining === 0 ? "Épuisé" : `${Math.abs(remaining)} j dépassés`}
                            </Badge>
                          </div>
                          <Progress value={pct} className={`h-2 ${remaining < 0 ? "[&>div]:bg-red-500" : pct > 80 ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500"}`} />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Utilisé : {b.used} j</span>
                            <span>Alloué : {total} j</span>
                          </div>
                          {Number(b.carried) > 0 && <p className="text-xs text-muted-foreground">dont {b.carried} j de report N-1</p>}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Bulletins de paie */}
            <TabsContent value="bulletins" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  {payslips.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <Banknote className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">Aucun bulletin disponible</p>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-xs uppercase text-muted-foreground border-b">
                        <tr>
                          <th className="text-left px-4 py-2.5">Période</th>
                          <th className="text-right px-4 py-2.5">Brut</th>
                          <th className="text-right px-4 py-2.5">Net</th>
                          <th className="text-center px-4 py-2.5">Statut</th>
                          <th className="px-4 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {payslips.map((p: any) => (
                          <tr key={p.id} className="border-t hover:bg-muted/20">
                            <td className="px-4 py-2.5 font-medium">{p.period}</td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground">{formatFCFA(Number(p.grossSalary))}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">{formatFCFA(Number(p.netSalary))}</td>
                            <td className="px-4 py-2.5 text-center"><Badge variant="secondary" className="text-xs capitalize">{p.status}</Badge></td>
                            <td className="px-4 py-2.5 text-right">
                              <a href={`/api/hr/me/payslips/${p.id}/pdf`} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" variant="ghost" className="h-6 text-xs"><ExternalLink className="w-3 h-3 mr-1" />PDF</Button>
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Documents */}
            <TabsContent value="documents" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  {docs.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <FolderArchive className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">Aucun document dans votre coffre-fort</p>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-xs uppercase text-muted-foreground border-b">
                        <tr>
                          <th className="text-left px-4 py-2.5">Type</th>
                          <th className="text-left px-4 py-2.5">Document</th>
                          <th className="text-left px-4 py-2.5">Expire le</th>
                          <th className="px-4 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {docs.map((d: any) => {
                          const expired = d.expiresAt && new Date(d.expiresAt) < new Date();
                          return (
                            <tr key={d.id} className="border-t hover:bg-muted/20">
                              <td className="px-4 py-2.5"><Badge variant="outline" className="text-xs">{d.type}</Badge></td>
                              <td className="px-4 py-2.5 font-medium">{d.name}</td>
                              <td className="px-4 py-2.5 text-xs">
                                {d.expiresAt
                                  ? <span className={expired ? "text-destructive font-semibold" : "text-muted-foreground"}>{new Date(d.expiresAt).toLocaleDateString("fr-FR")}</span>
                                  : <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <a href={d.fileUrl} target="_blank" rel="noopener noreferrer">
                                  <Button size="sm" variant="ghost" className="h-6 text-xs"><ExternalLink className="w-3 h-3" /></Button>
                                </a>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Dialog : demande de congé */}
      <Dialog open={openLeave} onOpenChange={setOpenLeave}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Demande de congé</DialogTitle>
            <DialogDescription>Votre demande sera envoyée à votre manager pour approbation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold">Type de congé</Label>
              <Select value={leaveForm.type} onValueChange={v => setLeaveForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Date de début</Label>
                <Input type="date" value={leaveForm.startDate} onChange={e => setLeaveForm(f => ({ ...f, startDate: e.target.value, days: "" }))} />
              </div>
              <div>
                <Label className="text-xs font-semibold">Date de fin</Label>
                <Input type="date" value={leaveForm.endDate} onChange={e => setLeaveForm(f => ({ ...f, endDate: e.target.value, days: "" }))} />
              </div>
            </div>
            {leaveForm.startDate && leaveForm.endDate && (
              <p className="text-xs text-muted-foreground">Durée estimée : <strong>{calcDays(leaveForm.startDate, leaveForm.endDate)} jours ouvrables</strong></p>
            )}
            <div>
              <Label className="text-xs font-semibold">Motif (optionnel)</Label>
              <Textarea rows={2} value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))} placeholder="Décrivez brièvement le motif…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenLeave(false)}>Annuler</Button>
            <Button disabled={!leaveForm.type || !leaveForm.startDate || !leaveForm.endDate || createLeaveMut.isPending} onClick={() => createLeaveMut.mutate()}>
              {createLeaveMut.isPending && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
              Envoyer la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
